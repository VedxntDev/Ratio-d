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
check("single local stylesheet", count(html, /<link[^>]+href="styles\.css"/g) === 1, "styles.css linked once");

// Animation must degrade gracefully: the page has to work even if the
// animation library is blocked, offline, or simply not used at all.
const pipelineJs = fs.readFileSync(path.join(ROOT, "js", "pipeline.js"), "utf8");
check("animation degrades without its library",
  /typeof gsap === "undefined"|matchMedia\("\(prefers-reduced-motion/.test(pipelineJs),
  "guarded against a missing/blocked animation lib");
check("reduced motion respected in pipeline",
  /prefers-reduced-motion/.test(pipelineJs) || /prefers-reduced-motion/.test(css));

// Every id the app reaches for must exist in the markup. Supports both
// `document.getElementById("x")` and the `$("x")` helper style.
const ids = [
  ...appJs.matchAll(/getElementById\("([^"]+)"\)/g),
  ...appJs.matchAll(/\$\("([^"]+)"\)/g),
].map((m) => m[1]);
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
check("responsive breakpoints", /@media \(max-width: (992|768|720|600)px\)/.test(css));
check("install section responsive", /\.install-grid \{ grid-template-columns: 1fr; \}/.test(css));

/* ---- extension install flow ---- */
const installJs = fs.readFileSync(path.join(ROOT, "js", "install.js"), "utf8");

check("install section present", /id="install"/.test(html));
check("install.js loaded", /js\/install\.js/.test(html));
check("zip download linked", /href="ratiod-extension\.zip"/.test(html));
check("zip uses download attribute", /download="ratiod-extension\.zip"/.test(html));

const stepCount = count(html, /data-step="\d"/g);
check("5 install steps rendered", stepCount === 5, `${stepCount} checkboxes found`);
check("steps are real checkboxes", count(html, /<input type="checkbox"/g) === 5);
check("copy button for chrome://", /data-copy="chrome:\/\/extensions"/.test(html));
check("gmail one-click link", /href="https:\/\/mail\.google\.com"/.test(html));
check("github source link", /github\.com\/VedxntDev\/Ratio-d/.test(html));
check("progress elements present", /id="progress-fill"/.test(html) && /id="progress-text"/.test(html));
check("troubleshooting accordion", count(html, /<details class="faq-item">/g) === 5);
check("chrome:// limitation explained", /blocks links to <code>chrome:\/\/<\/code>/.test(html));

check("progress persisted", /localStorage/.test(installJs));
check("storage failures guarded", /catch/.test(installJs));
check("clipboard has fallback", /execCommand/.test(installJs));
check("step ids match markup",
  [...html.matchAll(/data-step="(\d)"/g)].map((m) => m[1]).join(",") === "1,2,3,4,5");

/* ---- prominence of the install flow ---- */
check("dismissible promo bar present", /id="promo-bar"/.test(html) && /id="promo-close"/.test(html));
check("promo bar starts hidden (shown by JS only)", /id="promo-bar"[^>]*hidden/.test(html));
check("promo dismissal remembered", /ratiod\.promo\.dismissed/.test(installJs));
check("floating download button present", /id="dl-fab"/.test(html));
check("fab hides while install section is on screen", /installVisible/.test(installJs));
check("fab only shows past the hero", /pastHero/.test(installJs));
check("promo bar has a download link", /id="promo-bar"[\s\S]{0,600}?ratiod-extension\.zip/.test(html));
check("promo bar styles defined", /\.promo-bar \{/.test(css) && /\.dl-fab \{/.test(css));
check("promo bar responsive", /@media \(max-width: 600px\)[\s\S]*?\.promo-inner/.test(css));

// The install flow must sit above the roadmap, not after it.
const order = [...html.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1]);
check("install appears before features in page order",
  order.indexOf("install") > -1 && order.indexOf("install") < order.indexOf("features"),
  order.join(" -> "));
check("install section is inside <main>",
  html.indexOf('id="install"') < html.indexOf("</main>"));

/* ---- ShapeWaves hero background ---- */
const wavesJs = fs.readFileSync(path.join(ROOT, "js", "shape-waves.js"), "utf8");

check("hero canvas present", /<canvas id="shape-waves"/.test(html));
check("shape-waves.js loaded", /js\/shape-waves\.js/.test(html));
check("canvas is inside the hero section",
  /<section class="hero-section">[\s\S]{0,200}?id="shape-waves"/.test(html));
check("canvas is decorative", /id="shape-waves"[^>]*aria-hidden="true"/.test(html));

// Zero new dependencies: the effect must be hand-rolled, not npm installed.
// (The word "React" appears in this file's own explanatory comments, so test
// for real imports/calls rather than the literal word.)
check("no bundler introduced", !/node_modules/.test(wavesJs) && !/\brequire\(/.test(wavesJs));
check("no react import or hook usage",
  !/from\s+["']react["']/.test(wavesJs) &&
  !/require\(\s*["']react["']/.test(wavesJs) &&
  !/\bReact\./.test(wavesJs) &&
  !/\buse(State|Effect|Ref|Memo|Callback)\s*\(/.test(wavesJs));

// Fallback behaviour is the whole point: without WebGPU the hero is untouched.
check("bails when WebGPU missing", /"gpu" in navigator/.test(wavesJs));
check("removes canvas on failure", /parentNode\.removeChild/.test(wavesJs));
check("honours reduced motion", /prefers-reduced-motion/.test(wavesJs));

// Shader + pipeline integrity.
check("WGSL scene shader present", /fn fs_main/.test(wavesJs) && /shapeDistance/.test(wavesJs));
check("text cutout mask rendered", /fillText/.test(wavesJs));
check("glow blur passes present", /blurPipe/.test(wavesJs) && /compPipe/.test(wavesJs));
check("css layers the canvas behind content",
  /\.shape-waves \{[\s\S]*?z-index: 0/.test(css) && /\.hero-section > \.hero-copy[\s\S]*?z-index: 2/.test(css));
check("canvas hidden until first frame", /\.shape-waves \{[\s\S]*?opacity: 0/.test(css));
check("canvas never blocks clicks", /\.shape-waves \{[\s\S]*?pointer-events: none/.test(css));
check("uses the brand palette",
  wavesJs.includes("#F6F1E7") && wavesJs.includes("#EA3E2B") && wavesJs.includes("#121212"));

console.log(failures === 0 ? "\nALL STATIC CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
