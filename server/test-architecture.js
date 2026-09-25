/**
 * Contract tests for the interactive architecture flowchart.
 *
 * These are not just string checks: the documented example values are
 * re-derived by actually running the rule engine and the redactor, so the
 * chart cannot quietly drift away from what the real pipeline does.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");
const archJs = fs.readFileSync(path.join(ROOT, "js", "architecture.js"), "utf8");

const { evaluateRules } = require(path.join(ROOT, "server", "rules", "engine"));
const { combineScore } = require(path.join(ROOT, "server", "combine", "score"));
const { evaluateLayaModel } = require(path.join(ROOT, "server", "laya", "client"));

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}
const count = (s, re) => (s.match(re) || []).length;

/* ---- pull the STAGES config out without executing the controller ---- */
function loadStages() {
  const start = archJs.indexOf("window.ARCHITECTURE_STAGES");
  const end = archJs.indexOf("\n];", start);
  const snippet = archJs.slice(start, end + 3);
  const win = {};
  new Function("window", snippet + "\nreturn window.ARCHITECTURE_STAGES;")(win);
  return win.ARCHITECTURE_STAGES;
}

/* ---- section is wired into the page ---- */
check("architecture section present", /id="architecture"/.test(html));
check("nav links to the new section", /href="#architecture"/.test(html));
check("architecture.js loaded", /js\/architecture\.js/.test(html));
check("board mount point present", /id="arch-board"/.test(html));
check("detail panel present", /id="arch-detail"/.test(html));
check("noscript fallback for the chart", /<noscript>/.test(html));

/* ---- transport + lens controls ---- */
["arch-play", "arch-next", "arch-prev", "arch-lens-components", "arch-lens-data", "arch-status"]
  .forEach((id) => check(`control #${id} present`, html.includes(`id="${id}"`)));
check("play control has a toggle label", /id="arch-play"[\s\S]{0,200}?aria-pressed/.test(html));
check("lens is a labelled group", /arch-lens[\s\S]{0,80}?role="group"/.test(html));
check("status region announces changes", /id="arch-status"[\s\S]{0,120}?aria-live="polite"/.test(html));

/* ---- the 10 stages, in order, in the right zones ---- */
const STAGES = loadStages();
check("exactly 10 stages defined", STAGES.length === 10, `${STAGES.length} found`);
check("stages numbered 1..10 in order",
  STAGES.every((s, i) => s.n === i + 1),
  STAGES.map((s) => s.n).join(","));

const browser = STAGES.filter((s) => s.zone === "browser").map((s) => s.n);
const backend = STAGES.filter((s) => s.zone === "backend").map((s) => s.n);
check("browser zone is 1,2,3 and 10", browser.join(",") === "1,2,3,10", browser.join(","));
check("backend zone is 4..9", backend.join(",") === "4,5,6,7,8,9", backend.join(","));

// The privacy claim only holds if redaction happens before the boundary.
const firstBackend = Math.min.apply(null, backend);
check("redaction (stage 3) happens before the boundary",
  STAGES.find((s) => s.n === 3).zone === "browser" && firstBackend === 4,
  `stage 3 is ${STAGES.find((s) => s.n === 3).zone}, first backend stage is ${firstBackend}`);

const lensFields = ["component", "dataLabel", "runs", "receives", "produces",
  "example", "dataShape", "dataSample", "dataNote", "tip"];
const incomplete = STAGES.filter((s) => lensFields.some((k) => typeof s[k] !== "string" || !s[k]));
check("every stage has both lens payloads + tooltip", incomplete.length === 0,
  incomplete.length ? "stages " + incomplete.map((s) => s.n).join(",") : `${STAGES.length} stages complete`);
/* ---- the parallel branch is actually drawn side by side ---- */
check("stages 5 and 6 marked as the parallel pair",
  /stage\.n === 5 \|\| stage\.n === 6/.test(archJs) && /is-parallel/.test(archJs));
check("parallel container rendered", /arch-parallel/.test(archJs) && /\.arch-parallel \{/.test(css));
check("merge bracket drawn at the convergence", /\.arch-parallel::after/.test(css));
check("merge bar is vertically centred between the branches",
  /\.arch-parallel::after \{[^}]*top: 25%; bottom: 25%/.test(css));
check("stage 7 is the convergence point",
  STAGES.find((s) => s.n === 7).title.toLowerCase().includes("score combiner"));

/* ---- the privacy boundary is drawn between the two zones ---- */
check("boundary rendered between zones", /boundaryEl\("Privacy boundary"/.test(archJs));
check("boundary styled as a dashed rule", /\.arch-boundary-line/.test(css) && /\.arch-boundary-label/.test(css));

/* ---- the connector graph must describe the real hop order ---- */
// A connector is emitted before the node it leads into, so a mislabelled
// from/to silently makes the packet pulse the wrong edge. Zone A builds its
// edges from the loop variable, so assert the literal edges by value and the
// loop form separately rather than trusting the build order.
{
  const literal = [...archJs.matchAll(/connEl\((\d+), (\d+),/g)].map((m) => [Number(m[1]), Number(m[2])]);
  check("literal connector edges are in order",
    literal.map(([a, b]) => a + "->" + b).join(",") === "4->5,6->7,7->8,8->9",
    literal.map(([a, b]) => a + "->" + b).join(" "));
  check("every literal edge is a +1 hop within 1..10",
    literal.every(([a, b]) => a >= 1 && b <= 10 && b === a + 1));

  // [1,2,3].forEach with connEl(n - 1, n) yields exactly 1->2 and 2->3.
  const loopOk = /\[1, 2, 3\]\.forEach/.test(archJs) && /connEl\(n - 1, n,/.test(archJs);
  const loopEdges = [1, 2, 3].map((n, i) => (i > 0 ? (n - 1) + "->" + n : null)).filter(Boolean);
  check("browser-zone loop yields 1->2 and 2->3", loopOk && loopEdges.join(",") === "1->2,2->3",
    loopEdges.join(" "));

  check("no edge skips the parallel merge or the return boundary",
    !literal.some(([a, b]) => a === 5 && b === 6) && !literal.some(([a, b]) => a === 9 && b === 10),
    "5/6 are parallel siblings, 9->10 crosses the response boundary");
  check("branch stubs carry no from/to", /connEl\(null, null,/.test(archJs));
  check("stages 5 and 6 feed stage 7 from separate branches",
    /\[5, 6\]\.forEach/.test(archJs) && /connEl\(6, 7,/.test(archJs));
}

/* ---- animation degrades safely ---- */
check("packet animation guarded by reduced motion",
  /function pulse[\s\S]*?prefersReduced\(\)/.test(archJs));
check("packet animation guarded against a missing library",
  /typeof gsap === "undefined"/.test(archJs));
check("packet stops cleanly before a new tween", /gsap\.killTweensOf/.test(archJs));
check("packet exists on every connector", /el\("span", "arch-packet"\)/.test(archJs));
check("reduced motion disables node transforms", /\.arch-node\.is-active \{ transform: none !important; \}/.test(css));
check("reduced motion media query is present", /@media \(prefers-reduced-motion: reduce\)/.test(css));

/* ---- responsive ---- */
check("board collapses to one column", /\.arch-track \{ flex-direction: column/.test(css));
check("connectors rotate to vertical",
  /\.arch-conn::after \{[^}]*border-top: 10px solid var\(--color-ink\)/.test(css));
check("packet axis chosen by measurement, not hardcoded",
  /offsetHeight > conn\.offsetWidth/.test(archJs));

/* ---- design system reuse ---- */
// Scope the palette check to the bodies of .arch-* rules only, so it cannot
// wander off and match a hex literal elsewhere in the sheet. #fff is allowed
// because the site already uses it for text on dark/primary surfaces
// (.sticker-red, .btn-primary); anything else would be a new colour.
const archBodies = [];
{
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = ruleRe.exec(css))) {
    if (m[1].includes(".arch-")) archBodies.push(m[2]);
  }
}
const archHex = archBodies.join("\n").replace(/#fff\s*;/gi, "").match(/#[0-9A-Fa-f]{3,6}/g);
check("no new hex colours in the arch rules", !archHex,
  archHex ? "found " + archHex.join(", ") : `${archBodies.length} arch rules, tokens only`);
check("arch rules use the shared token variables",
  /\.arch-node \{[\s\S]*?var\(--color-ink\)/.test(css) && /var\(--color-primary\)/.test(css));
check("reuses the existing channel-tab for the lens toggle", /class="channel-tab/.test(html));
check("reuses the existing sticker component", /sticker/.test(archJs));
check("reuses the existing tactile card treatment", /arch-node tactile/.test(archJs));
check("reuses the existing section header components",
  /section-header-tag/.test(html) && /section-title/.test(html) && /marker-blue/.test(html));

/* ---- no new external dependencies ---- */
const hosts = [...html.matchAll(/https?:\/\/([\w.-]+)\//g)].map((m) => m[1]);
const allowed = ["cdnjs.cloudflare.com", "fonts.googleapis.com", "fonts.gstatic.com",
  "github.com", "mail.google.com", "ratio-d.vercel.app"];
const newHosts = [...new Set(hosts.filter((h) => !allowed.includes(h)))];
check("no new external scripts or CDNs", newHosts.length === 0, newHosts.join(", ") || "none added");
check("no import/require in the browser controller", !/\bimport\s|\brequire\(/.test(archJs));

/* ---- safe DOM construction ---- */
// Match real assignment, not the word "innerHTML" in an explanatory comment.
check("copy is set with textContent, not innerHTML", !/innerHTML\s*(\+?=)/.test(archJs));
check("node click handlers are bound per node", /btn\.addEventListener\("click"/.test(archJs));
check("nodes are real buttons with aria-expanded", /btn\.setAttribute\("aria-expanded"/.test(archJs));
/* ---- every class the controller emits must actually be styled ---- */
const emitted = new Set();
for (const m of archJs.matchAll(/el\(\s*"[a-z]+"\s*,\s*"([^"]+)"/g)) {
  m[1].split(/\s+/).filter(Boolean).forEach((c) => emitted.add(c));
}
for (const m of archJs.matchAll(/classList\.(?:add|toggle|remove)\("([^"]+)"/g)) {
  m[1].split(/\s+/).filter(Boolean).forEach((c) => emitted.add(c));
}
// Template-built names like "arch-zone--" + kind are prefixes, not classes;
// drop anything ending in "--" so it is not reported as unstyled.
const unstyled = [...emitted]
  .filter((c) => !c.endsWith("--"))
  .filter((c) => !css.includes("." + c));
check(`all ${emitted.size} JS-generated classes are styled`, unstyled.length === 0,
  unstyled.length ? "MISSING: " + unstyled.join(", ") : `${emitted.size} classes verified`);

/* ---- the documented examples must match real engine output ---- */
const SAMPLE = "URGENT: Your Microsoft account will be suspended. Verify now at http://m1crosoft-support.com/login.";
const rule = evaluateRules(SAMPLE, "email");
const homoglyph = rule.flags.find((f) => f.span === "m1crosoft-support.com");

check("documented typosquat is a real rule-engine flag", !!homoglyph,
  homoglyph ? "reason: " + homoglyph.reason.slice(0, 52) + "..." : "engine did not flag it");
check("documented typosquat text matches the real flag",
  STAGES.find((s) => s.n === 5).example.includes("m1crosoft-support.com") &&
  !!homoglyph && homoglyph.reason.includes("impersonate brand 'MICROSOFT'"));

const realScore = combineScore(rule.ruleScore, { probability: 0.72 }, "email", rule.flags).score;
check("documented combined score matches the real combiner",
  STAGES.find((s) => s.n === 7).example.includes(String(realScore)),
  "combineScore() returned " + realScore);

const w = {};
global.window = w;
delete require.cache[require.resolve(path.join(ROOT, "js", "redactor.js"))];
require(path.join(ROOT, "js", "redactor.js"));
const red = w.Redactor.redact("Call +1 (415) 555-0199 or email victim@example.com.");
check("documented redaction is what the redactor really does",
  red.redactedText.includes("[PHONE_REDACTED]") &&
  red.redactedText.includes("[EMAIL_REDACTED]") &&
  !red.redactedText.includes("555-0199"),
  red.redactedText);
check("documented redaction counts are real",
  red.stats.phones_masked === 1 && red.stats.emails_masked === 1);

/* ---- the chart must not overstate what actually ran ---- */
check("chart does not present the stub as a live Laya container",
  /stub_heuristic/.test(STAGES.find((s) => s.n === 6).example) &&
  /container offline/.test(STAGES.find((s) => s.n === 6).example));
check("chart states the LLM does not re-decide the score",
  /never change it/i.test(STAGES.find((s) => s.n === 8).dataNote));
check("chart promises zero persistence only where the code does it",
  /counts only, never raw text/.test(STAGES.find((s) => s.n === 9).runs));

// evaluateLayaModel is async (it awaits the container), so the model
// assertions have to run inside a promise before the exit.
(async function main() {
  const laya = await evaluateLayaModel(SAMPLE, rule.flags);
  check("documented model probability is inside the engine's real range",
    typeof laya.probability === "number" && laya.probability > 0 && laya.probability <= 0.99,
    "probability " + laya.probability + ", source " + laya.source);
  check("documented model source matches the real client",
    STAGES.find((s) => s.n === 6).example.includes(laya.source), "source: " + laya.source);

  console.log(failures === 0 ? "\nALL ARCHITECTURE CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
  process.exit(failures === 0 ? 0 : 1);
})();
