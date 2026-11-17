import PRICES from "./prices.js";

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6;
const hits = new Map();

const clean = (value, max = 500) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

const formatRs = (n) => "Rs. " + Number(n || 0).toLocaleString("en-US");

function normalizePhone(raw) {
  let d = String(raw || "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^92(3\d{9})$/.test(d)) d = "0" + d.slice(2);
  if (/^3\d{9}$/.test(d)) d = "0" + d;
  if (!/^03\d{9}$/.test(d)) return "";
  return `${d.slice(0, 4)} ${d.slice(4)}`;
}

function makeOrderId(now) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      year: "2-digit",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  const date = `${parts.year}${parts.month}${parts.day}`;
  const random = 1000 + Math.floor(Math.random() * 9000);
  return `ZRV-${date}-${random}`;
}

function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > WINDOW_MS) {
    entry.count = 0;
    entry.start = now;
  }
  entry.count += 1;
  hits.set(ip, entry);
  if (hits.size > 5000) hits.clear();
  return entry.count > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ success: false, error: "Method not allowed." });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(503).json({ success: false, error: "Order notifications are not configured yet." });
  }

  const ip =
    (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
    (req.socket && req.socket.remoteAddress) ||
    "unknown";
  if (rateLimited(ip)) {
    return res.status(429).json({
      success: false,
      error: "Too many order attempts. Please wait a few minutes or message our WhatsApp support.",
    });
  }

  try {
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }
    if (!body || typeof body !== "object") {
      return res.status(400).json({ success: false, error: "Invalid order request." });
    }

    // Honeypot: real customers never fill this hidden field.
    if (body.website) {
      return res.status(200).json({ success: true, orderId: makeOrderId(new Date()) });
    }

    const customer = body.customer && typeof body.customer === "object" ? body.customer : {};
    const rawItems = Array.isArray(body.items) ? body.items : [];

    const name = clean(customer.name, 80);
    const phone = normalizePhone(customer.phone);
    const address = clean(customer.address, 700);
    const note = clean(customer.note, 300);

    if (name.length < 3) {
      return res.status(400).json({ success: false, error: "Please enter your full name." });
    }
    if (!phone) {
      return res.status(400).json({ success: false, error: "Please enter a valid mobile number, for example 0300 1234567." });
    }
    if (address.length < 10) {
      return res.status(400).json({ success: false, error: "Please enter a complete delivery address." });
    }
    if (!rawItems.length) {
      return res.status(400).json({ success: false, error: "Your bag is empty. Please add a product first." });
    }
    if (rawItems.length > 40) {
      return res.status(400).json({ success: false, error: "Too many different products in one order." });
    }

    const items = [];
    for (const raw of rawItems) {
      const id = clean(raw && raw.id, 120);
      const product = PRICES[id];
      if (!product) {
        return res.status(400).json({
          success: false,
          error: "One of the products in your bag is no longer available. Please refresh the page and try again.",
        });
      }
      const quantity = Math.max(1, Math.min(99, Number(raw.quantity) || 1));
      const variant = clean(raw.variant, 40) || "Standard Size";
      items.push({
        id,
        name: product.n,
        variant,
        quantity,
        unitPrice: product.p,
        lineTotal: product.p * quantity,
      });
    }

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    if (!total || total > 2000000) {
      return res.status(400).json({ success: false, error: "Order total is not valid. Please refresh and try again." });
    }

    const now = new Date();
    const orderId = makeOrderId(now);
    const placedAt = new Intl.DateTimeFormat("en-PK", {
      timeZone: "Asia/Karachi",
      dateStyle: "medium",
      timeStyle: "short",
    }).format(now);

    const itemLines = items.map(
      (item, index) =>
        `${index + 1}. ${item.name}\n   Size/option: ${item.variant}\n   ${item.quantity} × ${formatRs(item.unitPrice)} = ${formatRs(item.lineTotal)}`
    );

    const message = [
      "🛍️ ZARVO — NEW ORDER",
      `Order ID: ${orderId}`,
      `Time: ${placedAt} (PKT)`,
      "",
      "CUSTOMER",
      `Name: ${name}`,
      `Phone: ${phone}`,
      `Address: ${address}`,
      note ? `Note: ${note}` : null,
      "",
      "ORDER ITEMS",
      ...itemLines,
      "",
      "DELIVERY: FREE · 3–7 days",
      `TOTAL: ${formatRs(total)}`,
      "PAYMENT: Cash on Delivery",
      "",
      "Please confirm this order with the customer.",
    ]
      .filter((line) => line !== null)
      .join("\n");

    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }),
    });
    const telegramData = await telegramResponse.json().catch(() => ({}));

    if (!telegramResponse.ok || !telegramData.ok) {
      console.error("Telegram order notification failed:", telegramData.description || telegramResponse.status);
      return res.status(502).json({
        success: false,
        error: "We could not send your order. Please try again, or message our WhatsApp support.",
      });
    }

    return res.status(200).json({ success: true, orderId, total });
  } catch (error) {
    console.error("Order API error:", error);
    return res.status(500).json({ success: false, error: "Server error while placing your order. Please try again." });
  }
}
