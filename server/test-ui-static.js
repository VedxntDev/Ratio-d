/** Static sanity checks for the console markup and stylesheet. */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const appJs = fs.readFileSync(path.join(ROOT, "js", "app.js"), "utf8");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

const count = (s, re) => (s.match(re) || []).length;

const divOpen = count(html, /<div[\s>]/g);
const divClose = count(html, /<\/div>/g);
check("div tags balanced", divOpen === divClose, `${divOpen} open / ${divClose} close`);

const secOpen = count(html, /<section[\s>]/g);
const secClose = count(html, /<\/section>/g);
check("section tags balanced", secOpen === secClose, `${secOpen} open / ${secClose} close`);

check("doctype present", /^\s*<!doctype html>/i.test(html));
check("lang attribute set", /<html lang="en">/.test(html));
check("viewport meta present", /name="viewport"/.test(html));
check("title present", /<title>[^<]+<\/title>/.test(html));
check("no external animation CDN", !/gsap/i.test(html), "GSAP removed - zero external JS deps");
check("single local stylesheet", count(html, /<link[^>]+href="styles\.css"/g) === 1, "styles.css linked once");

// Every id app.js reaches for must exist in the markup.
// app.js resolves ids through a $() helper, so match those call sites.
const ids = [...appJs.matchAll(/\$\("([^"]+)"\)/g)].map((m) => m[1]);
const missing = ids.filter((id) => !html.includes(`id="${id}"`));
check(
  `all ${ids.length} app.js element ids present in markup`,
  ids.length > 0 && missing.length === 0,
  missing.length ? "MISSING: " + missing.join(", ") : `${ids.length} ids verified`
);

// Every CSS class used in markup should be defined somewhere in the sheet.
const used = new Set();
for (const m of html.matchAll(/class="([^"]+)"/g)) {
  m[1].split(/\s+/).filter(Boolean).forEach((c) => used.add(c));
}
const undefinedClasses = [...used].filter((c) => !css.includes("." + c));
check("all markup classes styled", undefinedClasses.length === 0, undefinedClasses.join(", ") || "none missing");

// Brace balance in CSS
const openBraces = count(css, /\{/g);
const closeBraces = count(css, /\}/g);
check("css braces balanced", openBraces === closeBraces, `${openBraces} open / ${closeBraces} close`);

check("reduced-motion honoured", /prefers-reduced-motion/.test(css));
check("focus-visible styles present", /:focus-visible/.test(css));
check("skip link present", /skip-link/.test(html));
check("responsive breakpoints", /@media \(max-width: 720px\)/.test(css));

console.log(failures === 0 ? "\nALL STATIC CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
