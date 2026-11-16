export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ success: false, error: "Method not allowed." }); }
  const token = process.env.TELEGRAM_BOT_TOKEN, chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ success: false, error: "Order notifications are not configured yet." });
  try {
    const body = req.body || {}, customer = body.customer || {}, items = Array.isArray(body.items) ? body.items : [];
    if (!customer.name || !customer.phone || !customer.address || !items.length) return res.status(400).json({ success: false, error: "Please complete all required order details." });
    if (items.length > 40) return res.status(400).json({ success: false, error: "Too many different products in one order." });
    const clean = (value, max = 500) => String(value ?? "").replace(/[<>]/g, "").slice(0, max);
    const lines = items.map((item, index) => {
      const name = clean(item.name, 180), qty = Math.max(1, Math.min(99, Number(item.quantity) || 1)), unit = Math.max(0, Number(item.unitPrice) || 0), line = Math.max(0, Number(item.lineTotal) || unit * qty);
      return `${index + 1}. ${name}\n   ${qty} × Rs. ${unit.toLocaleString("en-PK")} = Rs. ${line.toLocaleString("en-PK")}`;
    });
    const total = Math.max(0, Number(body.total) || 0);
    const message = ["🛍️ ZARVO — NEW ORDER", "", `Customer: ${clean(customer.name, 100)}`, `Phone: ${clean(customer.phone, 40)}`, `Delivery address: ${clean(customer.address, 700)}`, "", "ORDER ITEMS", ...lines, "", "Delivery: FREE", `TOTAL: Rs. ${total.toLocaleString("en-PK")}`, "", "Payment: Cash on Delivery"].join("\n");
    const telegramResponse = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text: message, disable_web_page_preview: true }) });
    const telegramData = await telegramResponse.json();
    if (!telegramResponse.ok || !telegramData.ok) { console.error("Telegram order notification failed:", telegramData.description || telegramResponse.status); return res.status(502).json({ success: false, error: "Telegram could not receive the order. Please try again." }); }
    return res.status(200).json({ success: true });
  } catch (error) { console.error("Order API error:", error); return res.status(500).json({ success: false, error: "Server error while placing your order." }); }
}
