import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const catalogPath = path.join(root, "assets", "catalog.js");

const source = fs.readFileSync(catalogPath, "utf8");
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox);

const products = sandbox.window.ZARVO_PRODUCTS;
if (!Array.isArray(products) || !products.length) {
  console.error("No products found in assets/catalog.js");
  process.exit(1);
}

const prices = {};
for (const product of products) {
  const [id, name, , price] = product;
  prices[id] = { n: name, p: price };
}

const output =
  "/* Generated from assets/catalog.js — used to validate order prices server-side. */\n" +
  "export default " +
  JSON.stringify(prices, null, 2) +
  ";\n";

fs.writeFileSync(path.join(root, "api", "prices.js"), output);
console.log(`api/prices.js updated with ${Object.keys(prices).length} products.`);
