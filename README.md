# Zarvo

Pakistan-focused online store for everyday fashion, footwear, beauty, electronics, accessories and home products.

- Live site: https://zarvo-seven.vercel.app
- Orders: website checkout → Telegram notification → confirmation on WhatsApp/phone
- Payment: Cash on Delivery, free delivery across Pakistan, usual delivery window 3–7 days

## Stack

Plain HTML, CSS and JavaScript. No framework, no database, no build step. Hosted on Vercel with one serverless function for Telegram order delivery.

```
index.html                 Storefront (products rendered from assets/catalog.js)
products/<slug>/index.html 26 product landing pages (static, SEO + JSON-LD)
shipping.html              Delivery & Cash on Delivery
returns.html               Returns & Exchanges
privacy.html               Privacy Policy
terms.html                 Terms of Service
contact.html               Contact
assets/site.css            Storefront styles
assets/pages.css           Product page + policy page styles
assets/catalog.js          Single source of truth for products and content
assets/app.js              Storefront logic: cart, checkout, success screen
api/order.js               POST /api/order → validates and sends Telegram message
api/prices.js              Generated price map used for server-side validation
sitemap.xml, robots.txt    SEO files
llms.txt                   Summary for AI assistants
logo/zarvo-logo.webp       Optimised logo (source JPG kept for reference)
```

## Order flow

1. Customer picks a product and size, opens the bag and fills in the checkout form.
2. `assets/app.js` validates the form, normalises the phone number and POSTs to `/api/order`.
3. `api/order.js` validates again on the server, recalculates prices from `api/prices.js`, rate-limits by IP, creates an Order ID (`ZRV-YYMMDD-XXXX`) and sends the full order to Telegram.
4. The site shows a full order-success screen with the Order ID, items, total, address and a WhatsApp confirmation button.

The order message includes each item's size/variant, quantity, price and the customer's complete address.

## Environment variables (Vercel)

| Variable | Purpose |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Bot token from @BotFather |
| `TELEGRAM_CHAT_ID` | Chat or group ID that receives order messages |

Set these in **Vercel → Project → Settings → Environment Variables** for Production (and Preview if needed). Without them `/api/order` returns `503`.

## Local development

```bash
npx serve .
```

The static site works with any static server. `/api/order` needs Vercel's runtime:

```bash
npx vercel dev
```

Always test order delivery in a Telegram test chat. Do not place fake orders against the production bot.

## Editing products

`assets/catalog.js` is the single source of truth for the storefront:

```js
window.ZARVO_PRODUCTS = [
  ["product-slug", "Product name", "Category", 1999, "image-url", ["Small", "Medium"]],
];
```

- Index `0`: slug (also used for `/products/<slug>/`)
- Index `1`: display name
- Index `2`: category
- Index `3`: price in PKR
- Index `4`: image URL
- Index `5`: available sizes/variants (`["Standard Size"]` for single-variant products)

If you change a price or add a product, update `api/prices.js` too, otherwise the server will reject orders for the missing product or use the old price. You can regenerate it from the catalog:

```bash
node scripts/generate-prices.mjs
```

Product landing pages under `products/` are static and generated from the catalog data. Keep their prices, titles and canonical URLs in sync when products change.

## Editorial rules

- Prices shown on the product page are the current listed price.
- Delivery is free across Pakistan; orders are usually delivered in 3–7 days after confirmation.
- Returns are accepted within 7 days for eligible unused products; opened hygiene-sensitive products are excluded.
- Zarvo is an independent store and does not claim every supplier-sourced item is an authorised branded product.
- Professional inline SVG icons only — no icon fonts and no emoji used as UI icons.
