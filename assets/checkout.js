/* ============================================================
   Zarvo checkout page
   Reads the bag from localStorage and sends the order to the API.
   ============================================================ */
(() => {
  "use strict";

  const PRODUCTS = window.ZARVO_PRODUCTS || [];
  const WHATSAPP_NUMBER = "923221137342";
  const DELIVERY_TEXT = "3–7 days";
  const CART_KEY = "zarvo-cart-v2";
  const MAX_QTY = 30;

  const $ = (id) => document.getElementById(id);
  const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const findProduct = (id) => PRODUCTS.find((p) => p[0] === id);
  const optionsOf = (p) => (Array.isArray(p[5]) && p[5].length ? p[5] : ["Standard Size"]);

  let cart = loadCart();

  function loadCart() {
    try {
      const list = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(list)
        ? list.filter((item) => findProduct(item.id) && item.q > 0).map((item) => ({ ...item, q: Math.min(item.q, MAX_QTY) }))
        : [];
    } catch {
      return [];
    }
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {}
  }

  const cartTotal = () =>
    cart.reduce((sum, item) => {
      const p = findProduct(item.id);
      return p ? sum + p[3] * item.q : sum;
    }, 0);

  function toast(text) {
    const el = $("toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function addToCart(id, variant) {
    const p = findProduct(id);
    if (!p) return false;
    const v = variant || optionsOf(p)[0];
    const line = cart.find((x) => x.id === id && x.v === v);
    if (line) {
      if (line.q >= MAX_QTY) return false;
      line.q += 1;
    } else {
      cart.push({ id, v, q: 1 });
    }
    saveCart();
    return true;
  }

  function readAddParams() {
    const params = new URLSearchParams(location.search);
    const id = params.get("add");
    if (!id || !findProduct(id)) return;
    const p = findProduct(id);
    const opts = optionsOf(p);
    const size = params.get("size") || (opts.length === 1 ? opts[0] : "");
    history.replaceState({}, "", location.pathname);
    if (opts.includes(size)) addToCart(id, size);
  }

  function showEmpty() {
    $("checkoutMain").hidden = true;
    $("orderSuccess").hidden = true;
    $("coEmpty").hidden = false;
  }

  function renderSummary() {
    const host = $("checkoutSummary");
    if (!host) return;
    const rows = cart
      .map((item) => {
        const p = findProduct(item.id);
        if (!p) return "";
        return `<div class="sumrow"><span>${esc(p[1])}${item.v ? ` · ${esc(item.v)}` : ""} × ${item.q}</span><b>${money(p[3] * item.q)}</b></div>`;
      })
      .join("");
    host.innerHTML = `${rows}
      <div class="sumrow"><span>Delivery</span><b>FREE · ${DELIVERY_TEXT}</b></div>
      <div class="sumrow sumtotal"><span>Total (Cash on Delivery)</span><span>${money(cartTotal())}</span></div>`;
  }

  function normalizePhone(raw) {
    let d = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (/^92(3\d{9})$/.test(d)) d = "0" + d.slice(2);
    if (/^3\d{9}$/.test(d)) d = "0" + d;
    return /^03\d{9}$/.test(d) ? d : "";
  }

  const prettyPhone = (d) => (d ? `${d.slice(0, 4)} ${d.slice(4)}` : "");

  function showSuccess(order) {
    $("successOrderId").textContent = order.id;
    const rows = order.items
      .map(
        (item) =>
          `<div class="srow"><span>${esc(item.name)}${item.variant ? ` · ${esc(item.variant)}` : ""} × ${item.quantity}</span><b>${money(item.lineTotal)}</b></div>`
      )
      .join("");
    $("successSummary").innerHTML = `${rows}
      <div class="srow stotal"><span>Total</span><span>${money(order.total)}</span></div>
      <div class="srow" style="align-items:flex-start"><span>Deliver to</span><span style="text-align:right"><b>${esc(order.name)}</b><br>${esc(order.address)}</span></div>`;
    const text = `Assalam o Alaikum, I just placed order ${order.id} on Zarvo. Total: ${money(order.total)} (Cash on Delivery). Please confirm.`;
    $("successWhatsApp").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    $("checkoutMain").hidden = true;
    $("coEmpty").hidden = true;
    $("orderSuccess").hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = $("placeOrder");
    const result = $("orderResult");
    const val = (id) => $(id)?.value.trim() || "";
    const data = {
      name: val("customerName"),
      phone: val("customerPhone"),
      house: val("customerHouse"),
      street: val("customerStreet"),
      area: val("customerArea"),
      landmark: val("customerLandmark"),
      city: val("customerCity"),
      province: val("customerProvince"),
      postal: val("customerPostal"),
      note: val("customerNote"),
      honeypot: val("companyWebsite"),
    };

    result.textContent = "";
    if (!cart.length) {
      showEmpty();
      return;
    }
    if (data.name.length < 3) {
      result.textContent = "Please enter your full name.";
      $("customerName").focus();
      return;
    }
    const phone = normalizePhone(data.phone);
    if (!phone) {
      result.textContent = "Please enter a valid mobile number, for example 0300 1234567.";
      $("customerPhone").focus();
      return;
    }
    if (!data.house || !data.street || !data.area || !data.city || !data.province) {
      result.textContent = "Please complete your complete delivery address.";
      return;
    }

    const address = [data.house, data.street, data.area, data.landmark, data.city, data.province, data.postal].filter(Boolean).join(", ");
    const items = cart
      .map((item) => {
        const p = findProduct(item.id);
        return p
          ? { id: item.id, name: p[1], category: p[2], variant: item.v, unitPrice: p[3], quantity: item.q, lineTotal: p[3] * item.q }
          : null;
      })
      .filter(Boolean);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    submit.disabled = true;
    submit.innerHTML = "Sending order…";
    result.textContent = "Please wait while we send your order.";

    try {
      const response = await fetch("/api/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: { name: data.name, phone: prettyPhone(phone), address, note: data.note },
          items,
          total,
          currency: "PKR",
          website: data.honeypot,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.error || "Order could not be sent. Please try again.");

      const snapshot = { id: payload.orderId, items, total, name: data.name, phone: prettyPhone(phone), address };
      form.reset();
      cart = [];
      saveCart();
      result.textContent = "";
      showSuccess(snapshot);
    } catch (error) {
      result.textContent = error.message || "Something went wrong. Please try again or message our WhatsApp support.";
      toast("Order not sent — please try again");
    } finally {
      submit.disabled = false;
      submit.innerHTML = '<svg class="ic"><use href="#i-bag"/></svg> Place order';
    }
  }

  function init() {
    readAddParams();
    if (!cart.length) {
      showEmpty();
      return;
    }
    renderSummary();
    $("orderForm").addEventListener("submit", submitOrder);
    $("year")?.replaceChildren(document.createTextNode(new Date().getFullYear()));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
