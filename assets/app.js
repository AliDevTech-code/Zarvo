/* ============================================================
   Zarvo storefront
   Products come from assets/catalog.js (single source of truth).
   ============================================================ */
(() => {
  "use strict";

  const PRODUCTS = window.ZARVO_PRODUCTS || [];
  const CONTENT = window.ZARVO_CONTENT || {};
  const WHATSAPP_NUMBER = "923221137342";
  const DELIVERY_TEXT = "3–7 days";
  const CART_KEY = "zarvo-cart-v2";
  const FAV_KEY = "zarvo-favorites";
  const MAX_QTY = 30;

  const $ = (id) => document.getElementById(id);
  const money = (n) => "Rs. " + Number(n || 0).toLocaleString("en-PK");
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const findProduct = (id) => PRODUCTS.find((p) => p[0] === id);
  const optionsOf = (p) => (Array.isArray(p[5]) && p[5].length ? p[5] : ["Standard Size"]);
  const baseTitle = document.title;

  let activeCategory = "All";
  let favorites = loadFavorites();
  let cart = loadCart();

  /* ---------------- storage ---------------- */
  function loadFavorites() {
    try {
      const list = JSON.parse(localStorage.getItem(FAV_KEY) || "[]");
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  function loadCart() {
    try {
      localStorage.removeItem("zarvo-cart"); // legacy format (no size)
      const list = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      if (!Array.isArray(list)) return [];
      return list
        .filter((item) => item && findProduct(item.id))
        .map((item) => ({
          id: item.id,
          v: String(item.v || optionsOf(findProduct(item.id))[0]),
          q: Math.min(MAX_QTY, Math.max(1, Number(item.q) || 1)),
        }));
    } catch {
      return [];
    }
  }

  function saveCart() {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    renderCart();
  }

  const cartCount = () => cart.reduce((sum, item) => sum + item.q, 0);
  const cartTotal = () => cart.reduce((sum, item) => {
    const p = findProduct(item.id);
    return sum + (p ? p[3] * item.q : 0);
  }, 0);

  /* ---------------- tiny UI helpers ---------------- */
  let toastTimer;
  function toast(text) {
    const el = $("toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
  }

  function lockScroll(lock) {
    document.body.classList.toggle("no-scroll", lock);
  }

  function openOverlay(el) {
    if (!el) return;
    el.classList.add("open");
    lockScroll(true);
    const focusable = el.querySelector("button, a, input, select, textarea");
    if (focusable) setTimeout(() => focusable.focus({ preventScroll: true }), 60);
  }

  function closeOverlay(el) {
    if (!el) return;
    el.classList.remove("open");
    if (!document.querySelector(".overlay.open, .modal.open")) lockScroll(false);
  }

  /* ---------------- categories ---------------- */
  const categories = ["All", "Fashion", "Beauty", "Electronics", "Home", "Accessories", "Men's Shoes", "Sports Shoes", "Khussa"];

  function renderCategories() {
    const host = $("categoryList");
    if (!host) return;
    host.innerHTML = categories
      .map((c) => `<button class="cat ${activeCategory === c ? "active" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`)
      .join("");
    host.querySelectorAll(".cat").forEach((btn) => {
      btn.onclick = () => {
        activeCategory = btn.dataset.cat;
        renderCategories();
        renderProducts();
      };
    });
  }

  /* ---------------- product cards ---------------- */
  function productCard(p) {
    const [id, name, category, price, image] = p;
    const multi = optionsOf(p).length > 1;
    const fav = favorites.includes(id);
    return `
      <article class="card" data-product="${esc(id)}">
        <div class="photo">
          <span class="tag">${esc(category)}</span>
          <img src="${esc(image)}" alt="${esc(name)}" loading="lazy" decoding="async"
               onerror="this.parentElement.classList.add('image-fallback');this.remove()">
        </div>
        <div class="cardbody">
          <div class="category">${esc(category)}</div>
          <h3><a class="card-link" href="/products/${esc(id)}/" data-open="${esc(id)}">${esc(name)}</a></h3>
          <div class="price">${money(price)}</div>
          <div class="product-actions">
            <button class="heart-add ${fav ? "is-favorite" : ""}" aria-label="Save to wishlist" aria-pressed="${fav}" data-heart="${esc(id)}">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20.8 8.7c0 5.2-8.8 11-8.8 11S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/></svg>
            </button>
            <button class="buy-now" data-buy="${esc(id)}">${multi ? "SELECT SIZE" : "ADD TO BAG"}</button>
          </div>
        </div>
      </article>`;
  }

  function bindCards(root) {
    root.querySelectorAll("[data-heart]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        toggleFavorite(btn.dataset.heart, btn);
      };
    });
    root.querySelectorAll("[data-buy]").forEach((btn) => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const p = findProduct(btn.dataset.buy);
        if (!p) return;
        if (optionsOf(p).length > 1) {
          openProduct(p[0]);
          toast("Choose your size first");
          return;
        }
        addToCart(p[0], optionsOf(p)[0]);
      };
    });
    root.querySelectorAll("[data-open]").forEach((link) => {
      link.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openProduct(link.dataset.open);
      };
    });
    root.querySelectorAll(".card[data-product]").forEach((card) => {
      card.onclick = () => openProduct(card.dataset.product);
    });
  }

  function renderProducts() {
    const grid = $("productGrid");
    if (!grid) return;
    const q = ($("search")?.value || "").trim().toLowerCase();
    const sort = $("sort")?.value || "featured";
    let list = PRODUCTS.filter((p) => {
      const inCategory = activeCategory === "All" || p[2] === activeCategory;
      const matches = !q || (p[1] + " " + p[2]).toLowerCase().includes(q);
      return inCategory && matches;
    });
    if (sort === "low") list.sort((a, b) => a[3] - b[3]);
    if (sort === "high") list.sort((a, b) => b[3] - a[3]);
    if (sort === "az") list.sort((a, b) => a[1].localeCompare(b[1]));

    const count = $("resultCount");
    if (count) count.textContent = `${list.length} product${list.length === 1 ? "" : "s"} to explore`;
    grid.innerHTML = list.length
      ? list.map(productCard).join("")
      : '<div class="empty">No products found. Try another search or category.</div>';
    bindCards(grid);
  }

  function toggleFavorite(id, button) {
    const i = favorites.indexOf(id);
    if (i >= 0) favorites.splice(i, 1);
    else favorites.push(id);
    localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    if (button) {
      button.classList.toggle("is-favorite", favorites.includes(id));
      button.setAttribute("aria-pressed", String(favorites.includes(id)));
    }
    toast(favorites.includes(id) ? "Saved to wishlist" : "Removed from wishlist");
  }

  /* ---------------- product detail ---------------- */
  function openProduct(id) {
    const p = findProduct(id);
    if (!p) return;
    const [pid, name, category, price, image] = p;
    const content = CONTENT[id] || { description: "A selected everyday product from Zarvo.", faqs: [] };
    const opts = optionsOf(p);
    const multi = opts.length > 1;
    const fav = favorites.includes(id);
    const faqMarkup = (content.faqs || [])
      .map((f) => `<details class="product-faq"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`)
      .join("");

    document.querySelectorAll("main > *:not(#productDetail)").forEach((el) => (el.hidden = true));
    const detail = $("productDetail");
    detail.hidden = false;
    detail.innerHTML = `
      <button class="back-shop" id="backShop" type="button">← Back to shop</button>
      <div class="detail-grid">
        <div class="detail-photo">
          <img src="${esc(image)}" alt="${esc(name)}" onerror="this.parentElement.classList.add('image-fallback');this.remove()">
        </div>
        <div class="detail-info">
          <div class="category">${esc(category)}</div>
          <h1>${esc(name)}</h1>
          <div class="detail-price">${money(price)}</div>
          <p class="detail-desc">${esc(content.description)}</p>
          <div class="detail-meta">
            <div class="meta-pill">✓ Free delivery</div>
            <div class="meta-pill">✓ Cash on Delivery</div>
            <div class="meta-pill">✓ Delivered in ${DELIVERY_TEXT}</div>
            <div class="meta-pill">✓ 7-day eligible returns</div>
          </div>
          ${multi
            ? `<label for="variantChoice"><b style="font-size:12px">Select size</b></label>
               <select id="variantChoice" class="variant-select">
                 <option value="">Choose an option</option>
                 ${opts.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join("")}
               </select>
               <p class="variant-hint">Not sure about the size? Message us on WhatsApp before ordering.</p>`
            : `<p class="variant-hint" style="margin:0 0 14px"><b>Option:</b> ${esc(opts[0])}</p>`}
          <div class="detail-actions">
            <button class="heart-add ${fav ? "is-favorite" : ""}" id="detailHeart" aria-label="Save to wishlist" aria-pressed="${fav}">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M20.8 8.7c0 5.2-8.8 11-8.8 11S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z"/></svg>
            </button>
            <button class="add-cart" id="detailAdd" type="button">ADD TO BAG</button>
            <button class="buy-now" id="detailBuy" type="button">BUY NOW</button>
          </div>
          <a class="detail-wa" href="https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(`Assalam o Alaikum, I have a question about ${name} (${money(price)}) on Zarvo.`)}" target="_blank" rel="noopener">Ask about this product on WhatsApp →</a>
        </div>
      </div>
      <section class="product-faqs"><h2>Questions about this product</h2>${faqMarkup}</section>
      <h2 class="related-title">You may also like</h2>
      <div class="products" id="relatedProducts"></div>`;

    const chosenVariant = () => {
      if (!multi) return opts[0];
      const v = $("variantChoice")?.value || "";
      if (!v) {
        toast("Please select a size first");
        $("variantChoice")?.focus();
        return "";
      }
      return v;
    };

    $("backShop").onclick = closeProduct;
    $("detailHeart").onclick = () => toggleFavorite(id, $("detailHeart"));
    $("detailAdd").onclick = () => {
      const v = chosenVariant();
      if (v) addToCart(id, v);
    };
    $("detailBuy").onclick = () => {
      const v = chosenVariant();
      if (!v) return;
      if (addToCart(id, v, true)) openCheckout();
    };

    const related = [
      ...PRODUCTS.filter((x) => x[0] !== id && x[2] === category),
      ...PRODUCTS.filter((x) => x[0] !== id && x[2] !== category),
    ].slice(0, 4);
    const relatedHost = $("relatedProducts");
    relatedHost.innerHTML = related.map(productCard).join("");
    bindCards(relatedHost);

    document.title = `${name} Price in Pakistan | Zarvo`;
    history.pushState({ product: id }, "", `#product/${id}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeProduct() {
    const detail = $("productDetail");
    if (!detail || detail.hidden) return;
    detail.hidden = true;
    document.querySelectorAll("main > *:not(#productDetail)").forEach((el) => (el.hidden = false));
    document.title = baseTitle;
    if (location.hash.startsWith("#product/")) history.pushState({}, "", location.pathname + location.search);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------------- cart ---------------- */
  function addToCart(id, variant, silent = false) {
    const p = findProduct(id);
    if (!p) return false;
    const v = variant || optionsOf(p)[0];
    const line = cart.find((x) => x.id === id && x.v === v);
    if (line) {
      if (line.q >= MAX_QTY) {
        toast(`Maximum ${MAX_QTY} units per item`);
        return false;
      }
      line.q += 1;
    } else {
      cart.push({ id, v, q: 1 });
    }
    saveCart();
    if (!silent) toast("Added to your bag");
    return true;
  }

  function renderCart() {
    const host = $("cartItems");
    if (!host) return;
    if (!cart.length) {
      host.innerHTML = `<div class="cart-empty"><p>Your bag is empty.</p><button type="button" id="startShopping">Start shopping</button></div>`;
      const start = $("startShopping");
      if (start) start.onclick = () => {
        closeOverlay($("cartOverlay"));
        $("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    } else {
      host.innerHTML = cart
        .map((item, index) => {
          const p = findProduct(item.id);
          if (!p) return "";
          return `
            <div class="cartrow">
              <img src="${esc(p[4])}" alt="" loading="lazy">
              <div>
                <b>${esc(p[1])}</b>
                <small>${money(p[3])}</small>
                <span class="cart-variant">${esc(item.v)}</span>
                <div class="qty">
                  <button type="button" data-dec="${index}" aria-label="Decrease quantity">−</button>
                  <span>${item.q}</span>
                  <button type="button" data-inc="${index}" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <div class="cart-row-actions">
                <b>${money(p[3] * item.q)}</b>
                <button class="cart-remove" data-remove="${index}" type="button">Remove</button>
              </div>
            </div>`;
        })
        .join("");
    }
    $("cartTotal").textContent = money(cartTotal());
    const btn = $("checkoutBtn");
    btn.disabled = !cart.length;
    btn.style.opacity = cart.length ? 1 : 0.5;
    $("cartCount").textContent = cartCount();
  }

  function bindCartEvents() {
    const host = $("cartItems");
    host.addEventListener("click", (e) => {
      const inc = e.target.closest("[data-inc]");
      const dec = e.target.closest("[data-dec]");
      const rem = e.target.closest("[data-remove]");
      if (inc) {
        const item = cart[Number(inc.dataset.inc)];
        if (!item) return;
        if (item.q >= MAX_QTY) return toast(`Maximum ${MAX_QTY} units per item`);
        item.q += 1;
        saveCart();
      } else if (dec) {
        const index = Number(dec.dataset.dec);
        const item = cart[index];
        if (!item) return;
        item.q -= 1;
        if (item.q <= 0) cart.splice(index, 1);
        saveCart();
      } else if (rem) {
        cart.splice(Number(rem.dataset.remove), 1);
        saveCart();
        toast("Item removed from bag");
      }
    });
  }

  /* ---------------- checkout ---------------- */
  function normalizePhone(raw) {
    let d = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
    if (/^92(3\d{9})$/.test(d)) d = "0" + d.slice(2);
    if (/^3\d{9}$/.test(d)) d = "0" + d;
    return /^03\d{9}$/.test(d) ? d : "";
  }

  function prettyPhone(d) {
    return d ? `${d.slice(0, 4)} ${d.slice(4)}` : "";
  }

  function renderCheckoutSummary() {
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

  function openCheckout() {
    if (!cart.length) {
      toast("Your bag is empty");
      return;
    }
    renderCheckoutSummary();
    $("orderResult").textContent = "";
    closeOverlay($("cartOverlay"));
    openOverlay($("checkoutModal"));
  }

  function readForm() {
    const val = (id) => $(id)?.value.trim() || "";
    return {
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
  }

  function showSuccess(order) {
    $("successOrderId").textContent = order.id;
    const rows = order.items
      .map((item) => `<div class="srow"><span>${esc(item.name)}${item.variant ? ` · ${esc(item.variant)}` : ""} × ${item.quantity}</span><b>${money(item.lineTotal)}</b></div>`)
      .join("");
    $("successSummary").innerHTML = `${rows}
      <div class="srow stotal"><span>Total</span><span>${money(order.total)}</span></div>
      <div class="srow" style="align-items:flex-start"><span>Deliver to</span><span style="text-align:right"><b>${esc(order.name)}</b><br>${esc(order.address)}</span></div>`;
    const text = `Assalam o Alaikum, I just placed order ${order.id} on Zarvo. Total: ${money(order.total)} (Cash on Delivery). Please confirm.`;
    $("successWhatsApp").href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    closeOverlay($("checkoutModal"));
    openOverlay($("orderSuccess"));
    setTimeout(() => $("successClose")?.focus({ preventScroll: true }), 80);
  }

  async function submitOrder(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    const result = $("orderResult");
    const data = readForm();

    result.textContent = "";
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

    const address = [data.house, data.street, data.area, data.landmark, data.city, data.province, data.postal]
      .filter(Boolean)
      .join(", ");
    const items = cart
      .map((item) => {
        const p = findProduct(item.id);
        return p ? {
          id: item.id,
          name: p[1],
          category: p[2],
          variant: item.v,
          unitPrice: p[3],
          quantity: item.q,
          lineTotal: p[3] * item.q,
        } : null;
      })
      .filter(Boolean);
    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);

    submit.disabled = true;
    submit.textContent = "Sending order…";
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
      result.textContent = error.message || "Something went wrong. Please try again or message us on WhatsApp.";
      toast("Order not sent — please try again");
    } finally {
      submit.disabled = false;
      submit.textContent = "Place order";
    }
  }

  /* ---------------- header / navigation ---------------- */
  function initNavigation() {
    const menu = $("navlinks");
    const backdrop = $("menuBackdrop");
    const menuBtn = $("menuBtn");
    const searchWrap = $("searchWrap");
    const searchToggle = $("searchToggle");
    const searchInput = $("search");

    const closeMenu = () => {
      menu?.classList.remove("show");
      backdrop?.classList.remove("show");
      menuBtn?.setAttribute("aria-expanded", "false");
      lockScroll(false);
    };
    const openMenu = () => {
      menu?.classList.add("show");
      backdrop?.classList.add("show");
      menuBtn?.setAttribute("aria-expanded", "true");
    };

    menuBtn?.setAttribute("aria-expanded", "false");
    menuBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (menu?.classList.contains("show")) closeMenu();
      else openMenu();
    });
    backdrop?.addEventListener("click", closeMenu);
    menu?.querySelectorAll("a").forEach((a) => a.addEventListener("click", closeMenu));
    document.addEventListener("click", (e) => {
      if (menu?.classList.contains("show") && !menu.contains(e.target) && !menuBtn?.contains(e.target)) closeMenu();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      closeMenu();
      searchWrap?.classList.remove("open");
      closeOverlay($("cartOverlay"));
      closeOverlay($("checkoutModal"));
    });

    searchToggle?.addEventListener("click", (e) => {
      e.stopPropagation();
      searchWrap.classList.toggle("open");
      if (searchWrap.classList.contains("open")) searchInput?.focus();
    });
    document.addEventListener("click", (e) => {
      if (searchWrap && !searchWrap.contains(e.target)) searchWrap.classList.remove("open");
    });
    searchInput?.addEventListener("input", renderProducts);
    $("sort")?.addEventListener("change", renderProducts);
  }

  /* ---------------- hero + banners ---------------- */
  function initHero() {
    const slides = PRODUCTS.slice(0, 4);
    const img = $("heroImage");
    const dots = $("heroDots");
    if (!img || !dots || !slides.length) return;
    let index = 0;
    let timer;
    const draw = () => {
      const p = slides[index];
      img.style.display = "block";
      img.parentElement.classList.remove("hero-fallback");
      img.style.opacity = "0";
      const next = new Image();
      next.onload = () => {
        img.src = p[4];
        img.alt = p[1];
        img.style.opacity = "1";
      };
      next.onerror = () => {
        img.style.display = "none";
        img.parentElement.classList.add("hero-fallback");
      };
      next.src = p[4];
      dots.innerHTML = slides
        .map((_, i) => `<button type="button" class="${i === index ? "active" : ""}" aria-label="Slide ${i + 1}" data-slide="${i}"></button>`)
        .join("");
      dots.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          index = Number(b.dataset.slide);
          draw();
          restart();
        };
      });
    };
    const next = () => {
      index = (index + 1) % slides.length;
      draw();
    };
    const prev = () => {
      index = (index + slides.length - 1) % slides.length;
      draw();
    };
    const restart = () => {
      clearInterval(timer);
      timer = setInterval(next, 5000);
    };
    $("heroNext")?.addEventListener("click", () => {
      next();
      restart();
    });
    $("heroPrev")?.addEventListener("click", () => {
      prev();
      restart();
    });
    draw();
    restart();
  }

  function initBanners() {
    const mobile = document.querySelector(".hero-mobile-marquee");
    if (mobile) {
      const tiles = PRODUCTS.slice(0, 12).map((p) => `<img src="${esc(p[4])}" alt="" loading="lazy">`).join("");
      mobile.innerHTML = tiles + tiles;
    }
    const marquee = $("imageMarquee");
    if (marquee) {
      const items = PRODUCTS.slice(0, 16);
      const make = (arr) =>
        arr
          .map((p) => `<div class="marquee-item"><img src="${esc(p[4])}" alt="${esc(p[1])}" loading="lazy" onerror="this.style.display='none'"><span>${esc(p[1])}</span></div>`)
          .join("");
      marquee.innerHTML = make(items) + make(items);
    }
    const track = $("visualSwiper");
    if (track) {
      track.innerHTML = PRODUCTS.slice(0, 12)
        .map((p) => `<article class="visual-card" data-visual="${esc(p[0])}"><img src="${esc(p[4])}" alt="${esc(p[1])}" loading="lazy"><div><b>${esc(p[1])}</b><span>${money(p[3])}</span></div></article>`)
        .join("");
      track.querySelectorAll("[data-visual]").forEach((card) => card.addEventListener("click", () => openProduct(card.dataset.visual)));
      $("visualPrev")?.addEventListener("click", () => track.scrollBy({ left: -430, behavior: "smooth" }));
      $("visualNext")?.addEventListener("click", () => track.scrollBy({ left: 430, behavior: "smooth" }));
    }
  }

  /* ---------------- boot ---------------- */
  function init() {
    initNavigation();
    initHero();
    initBanners();
    bindCartEvents();
    renderCategories();
    renderProducts();
    renderCart();
    $("year").textContent = new Date().getFullYear();

    $("cartBtn").onclick = () => openOverlay($("cartOverlay"));
    $("closeCart").onclick = () => closeOverlay($("cartOverlay"));
    $("cartOverlay").onclick = (e) => {
      if (e.target.id === "cartOverlay") closeOverlay($("cartOverlay"));
    };
    $("checkoutBtn").onclick = openCheckout;
    $("closeCheckout").onclick = () => closeOverlay($("checkoutModal"));
    $("cancelCheckout").onclick = () => {
      closeOverlay($("checkoutModal"));
      openOverlay($("cartOverlay"));
    };
    $("checkoutModal").onclick = (e) => {
      if (e.target.id === "checkoutModal") closeOverlay($("checkoutModal"));
    };
    $("orderForm").addEventListener("submit", submitOrder);
    $("successClose").onclick = () => {
      closeOverlay($("orderSuccess"));
      window.scrollTo({ top: 0, behavior: "smooth" });
      $("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.addEventListener("popstate", () => {
      if (!location.hash.startsWith("#product/")) closeProduct();
    });

    if (location.hash.startsWith("#product/")) {
      const id = decodeURIComponent(location.hash.slice(9));
      if (findProduct(id)) openProduct(id);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
