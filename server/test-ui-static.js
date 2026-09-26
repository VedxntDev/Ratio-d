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
// The floating entry point to #install is the mascot button. It replaced the
// old plain .dl-fab, so these checks now pin the mascot rather than a button
// that no longer exists - and assert the old one really is gone, which is what
// stops a duplicate "Get extension" control creeping back in.
check("mascot floating button present", /id="mascot-fab"/.test(html));
// Comments still name the old button to explain what replaced it, so the check
// targets real code - markup, CSS rules and the JS lookup - not the word.
check("old duplicate download fab removed",
  !/id="dl-fab"/.test(html) && !/class="[^"]*\bdl-fab\b/.test(html) &&
  !/^\s*\.dl-fab[\s,{]/m.test(css) &&
  !/getElementById\("dl-fab"\)/.test(installJs));
check("exactly one floating control links to #install",
  (html.match(/<a href="#install"[^>]*class="[^"]*fab/g) || []).length === 1);
// The fab is a permanent bottom-right control, so it must NOT be gated on
// scroll position any more (that used to hide it past the hero / on #install).
check("fab is always visible (no scroll gating)", !/pastHero|installVisible/.test(installJs));
check("fab is pinned bottom-right in CSS",
  /\.mascot-fab \{[^}]*position: fixed;[^}]*right: 22px;[^}]*bottom: 22px/.test(css) &&
  !/\.mascot-fab \{[^}]*left: 22px/.test(css));
// The narrow-screen override must move to `right` too, or the base `right`
// plus a mobile `left` would stretch the button across the viewport.
check("mobile fab override also uses right",
  /@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*right: 16px/.test(css) &&
  !/@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*left: 16px/.test(css));
// The control is CSS-visible from first paint: its base rule must not hide it
// behind opacity/visibility, or the only entry point to #install would vanish
// whenever JS is blocked or slow.
const mascotFabRule = (css.match(/\.mascot-fab \{[^}]*\}/) || [""])[0];
check("fab visible state is the CSS default (works without JS)",
  /position:\s*fixed/.test(mascotFabRule) &&
  !/opacity:\s*0/.test(mascotFabRule) &&
  !/visibility:\s*hidden/.test(mascotFabRule),
  mascotFabRule.slice(0, 56).replace(/\s+/g, " ") + "...");
check("promo bar has a download link", /id="promo-bar"[\s\S]{0,600}?ratiod-extension\.zip/.test(html));
check("promo bar styles defined", /\.promo-bar \{/.test(css) && /\.mascot-fab \{/.test(css));
check("promo bar responsive", /@media \(max-width: 600px\)[\s\S]*?\.promo-inner/.test(css));

/* ---- author credit ---- */
// The hero sticker and the footer must credit Vedant and link to the GitHub
// profile, replacing the old "Team Skill Issue" / design-system bylines.
const CREDIT = "https://github.com/VedxntDev";
const esc = CREDIT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
check("hero sticker credits Vedant and links out",
  new RegExp(`<a class="sticker[^"]*" href="${esc}"[^>]*>DEVELOPED BY VEDANT</a>`).test(html));
check("footer credits Vedant with a GitHub link",
  new RegExp(`footer-credit" href="${esc}"`).test(html));
check("old team / design-system bylines are gone from the page",
  !/Team Skill Issue|TEAM SKILL ISSUE|Playful Neo-Brutalist Utility Design System/.test(html));
// "Scam Risk Analyzer" survives only in <title> (SEO); it must be gone from
// the visible hero kicker and the footer byline. Strip the head first so the
// <title> itself can't satisfy (or trip) the check.
const bodyMarkup = html.replace(/<head[\s\S]*?<\/head>/i, "");
check("scam-risk byline removed from hero kicker and footer",
  !/SCAM RISK ANALYZER/i.test(bodyMarkup) && !/Scam Risk Analyzer/.test(bodyMarkup));
check("credit links open safely in a new tab",
  (html.match(new RegExp(`href="${esc}[^"]*"[^>]*>`, "g")) || [])
    .every((tag) => /rel="noopener noreferrer"/.test(tag) && /target="_blank"/.test(tag)));
// A sticker used as an <a> inherits the UA underline, which breaks the pill.
check("stickers used as links drop the underline",
  /a\.sticker \{[^}]*text-decoration: none/.test(css));

/* ---- brand logo / favicon ---- */
// Without these the tab shows a generic globe and /favicon.ico 404s, which was
// a real, previously-unfixed gap on this site.
const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] || "";
check("page declares a favicon", /<link rel="icon"/.test(head));
check("page declares an SVG + ICO favicon",
  /rel="icon" href="assets\/favicon\.ico"/.test(head) &&
  /type="image\/svg\+xml" href="assets\/favicon\.svg"/.test(head));
check("page declares an apple-touch-icon", /rel="apple-touch-icon"/.test(head));
check("privacy page declares a favicon too",
  /<link rel="icon"/.test(fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8")));

["assets/favicon.ico", "assets/favicon.svg", "assets/apple-touch-icon.png",
 "assets/favicon-16x16.png", "assets/favicon-32x32.png", "assets/logo.svg"]
  .forEach((f) => check(`${f} exists and is not empty`,
    fs.existsSync(path.join(ROOT, f)) && fs.statSync(path.join(ROOT, f)).size > 100));
// A real .ico starts with the ICONDIR magic: reserved=0 (uint16), type=1
// (uint16). A renamed PNG does not. Checked as uint16s, not raw bytes, because
// the magic is 00 00 01 00 - reading it byte-by-byte in the wrong order looks
// like 00 01 00 01 and never matches.
const ico = fs.readFileSync(path.join(ROOT, "assets/favicon.ico"));
check("favicon.ico is a real ICONDIR, not a renamed PNG",
  ico.readUInt16LE(0) === 0 && ico.readUInt16LE(2) === 1);
check("favicon.ico packs more than one size",
  ico.readUInt16LE(4) >= 2, `${ico.readUInt16LE(4)} entries`);
["assets/favicon-16x16.png", "assets/apple-touch-icon.png", "assets/logo.svg"]
  .forEach((f) => {
    const b = fs.readFileSync(path.join(ROOT, f));
    check(`${f} is a real image`, b.length > 100 &&
      (b.subarray(1, 4).toString() === "PNG" || /<svg/.test(b.subarray(0, 200).toString())));
  });

// The install flow must sit above the roadmap, not after it.
const order = [...html.matchAll(/<section id="([a-z]+)"/g)].map((m) => m[1]);
check("install appears before features in page order",
  order.indexOf("install") > -1 && order.indexOf("install") < order.indexOf("features"),
  order.join(" -> "));
check("install section is inside <main>",
  html.indexOf('id="install"') < html.indexOf("</main>"));

/* ---- primary navigation ---- */
// Nav order is a product decision, so pin it: Analyze -> Get Extension ->
// Architecture -> How it works -> Features -> Roadmap -> Privacy Policy.
const navBlock = (html.match(/<nav aria-label="Primary">[\s\S]*?<\/nav>/) || [""])[0];
const navOrder = [...navBlock.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)]
  .map((m) => m[2].trim());
check("primary nav has the expected links in order",
  navOrder.join("|") ===
    "Analyze|Get Extension|Architecture|How it works|Features|Roadmap|Privacy Policy",
  navOrder.join(" -> "));

// Scrolling down must reveal the sections in the same order the nav lists
// them, so the first thing below the hero is the analyzer and the second is
// the extension pitch. Derive the expectation from the nav rather than
// hard-coding it twice, so the two can never drift apart silently.
const NAV_TO_SECTION = {
  Analyze: "console",
  "Get Extension": "install",
  Architecture: "architecture",
  "How it works": "pipeline",
  Features: "features",
  Roadmap: "tiers",
};
const derivedOrder = navOrder.filter((l) => NAV_TO_SECTION[l]).map((l) => NAV_TO_SECTION[l]);
check("scroll order matches nav order",
  derivedOrder.join(",") === order.join(","),
  `page: ${order.join(" -> ")} | from nav: ${derivedOrder.join(" -> ")}`);
check("analyzer is the first section after the hero",
  order[0] === "console" && html.indexOf('class="hero-section"') < html.indexOf('id="console"'),
  order.join(" -> "));
check("extension install directly follows the analyzer",
  order[1] === "install", order.join(" -> "));
check("privacy policy is linked from the nav", /href="privacy\.html"/.test(navBlock));
check("privacy page exists and has real policy copy",
  fs.existsSync(path.join(ROOT, "privacy.html")) &&
  /Privacy Policy/.test(fs.readFileSync(path.join(ROOT, "privacy.html"), "utf8")));

// Email/SMS must not be in the header any more, but the control itself must
// survive inside the console - setChannel() in app.js drives it.
const headerBlock = (html.match(/<header class="header">[\s\S]*?<\/header>/) || [""])[0];
check("no email/SMS channel tabs in the header", !/id="tab-email"|id="tab-sms"/.test(headerBlock));
check("channel selector survives in the telemetry pane",
  /class="channel-row"[\s\S]{0,300}?id="tab-email"/.test(html) &&
  /class="channel-row"[\s\S]{0,300}?id="tab-sms"/.test(html));
// A missing selector must not throw: setChannel() runs on every preset load.
check("setChannel tolerates absent channel buttons",
  /channelSMSBtn\?\.classList\.toggle/.test(appJs) &&
  /channelEmailBtn\?\.classList\.toggle/.test(appJs) &&
  !/channel(SMS|Email)Btn\.classList/.test(appJs));

/* ---- ShapeWaves hero background ---- */
const wavesJs = fs.readFileSync(path.join(ROOT, "js", "shape-waves.js"), "utf8");
// Prose-only copy of the module: the assertions below are about code, and the
// file's comments legitimately name the things that were removed (e.g.
// "the fillText path are all gone"). Strip them so a comment cannot satisfy or
// break a structural check.
const wavesCode = wavesJs
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");

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
check("glow blur passes present", /blurPipe/.test(wavesJs) && /compPipe/.test(wavesJs));
check("css layers the canvas behind content",
  /\.shape-waves \{[\s\S]*?z-index: 0/.test(css) && /\.hero-section > \.hero-copy[\s\S]*?z-index: 2/.test(css));
check("canvas hidden until first frame", /\.shape-waves \{[\s\S]*?opacity: 0/.test(css));
check("canvas never blocks clicks", /\.shape-waves \{[\s\S]*?pointer-events: none/.test(css));

// The effect must stay out of the way of the hero copy. Two independent
// guards: a global ink opacity in the shader and a faint layer opacity in CSS.
// If either is loosened, the muted subtitle becomes unreadable over the marks.
const readyOpacity = (css.match(/\.shape-waves\[data-ready='true'\]\s*\{\s*opacity:\s*([\d.]+)/) || [])[1];
check("ready layer opacity is faint enough to read text over",
  readyOpacity !== undefined && parseFloat(readyOpacity) <= 0.45,
  "opacity " + readyOpacity);
check("shader applies a global ink opacity",
  /ink:\s*[\d.]+/.test(wavesJs) && /params\.hover\.w/.test(wavesJs));
check("readability scrim sits between the canvas and the copy",
  /\.hero-section::before\s*\{[\s\S]*?z-index: 1/.test(css) &&
  /\.hero-section::before\s*\{[\s\S]*?linear-gradient/.test(css));

// The canvas must be transparent so the page's real paper + halftone shows
// through. An opaque backdrop forces a second grid to be stacked on top, which
// moires against the shape grid and is what made the copy unreadable.
const wavesRule = (css.match(/\.shape-waves \{[\s\S]*?\}/) || [""])[0];
check("canvas paints no opaque backdrop", !/background\s*:/.test(wavesRule), wavesRule);
check("no duplicate dot-grid overlay on the hero", !/\.hero-section::after/.test(css));

// No lettering is baked into the background: a text cutout reads as an
// artefact and fights the real hero copy. The feature is removed outright, so
// assert the machinery is gone rather than merely switched off in config.
check("no text cutout in the effect",
  !/fillText/.test(wavesCode) &&
  !/drawMask/.test(wavesCode) &&
  !/maskTexture/.test(wavesCode) &&
  !/\btext:\s*"/.test(wavesCode) &&
  !/measureText/.test(wavesCode));

// Palette must match the site's own tokens: ink, the two sticker accents and
// the primary red used for pointer ripples. Paper now lives only in CSS.
check("uses the brand palette",
  wavesJs.includes("#121212") && wavesJs.includes("#FFD23F") &&
  wavesJs.includes("#5DBBFF") && wavesJs.includes("#EA3E2B"));
check("brand accents are wired to the shader",
  /params\.accentA/.test(wavesJs) && /params\.accentB/.test(wavesJs) &&
  /parseColor\(CFG\.accentA/.test(wavesJs) && /parseColor\(CFG\.accentB/.test(wavesJs));

// Premultiplied alpha throughout, or the transparent void composites wrong.
check("scene shader emits premultiplied alpha",
  /return vec4f\(tint \* alpha, alpha\)/.test(wavesJs));
check("blur pass carries alpha", /sum \/ weight/.test(wavesJs) && !/vec4f\(sum \/ weight, 1\.0\)/.test(wavesJs));

console.log(failures === 0 ? "\nALL STATIC CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
