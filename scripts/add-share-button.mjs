import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = "products";
const button = `      <button class="btn btn-share" type="button" data-share aria-label="Share this product">
        <svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.3 10.8 7.4-4.3M8.3 13.2l7.4 4.3"/></svg>
        <span data-share-label>Share product</span>
      </button>
`;
const scriptTag = `<script src="/assets/share.js" defer></script>\n`;

let touched = 0;
for (const slug of readdirSync(dir)) {
  const file = join(dir, slug, "index.html");
  let html;
  try {
    html = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  if (html.includes("data-share")) continue;

  const wa = /^.*class="btn btn-wa".*$\n/m;
  if (!wa.test(html)) {
    console.log("no wa link:", file);
    continue;
  }
  html = html.replace(wa, (line) => line + button);
  html = html.replace("</body>", scriptTag + "</body>");
  writeFileSync(file, html);
  touched++;
}
console.log("updated pages:", touched);
