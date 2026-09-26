/**
 * Parity + coverage guard for the offline fallback engines.
 *
 * There are two copies of the offline engine - extension/fallback-engine.js
 * and js/fallback-engine.js - because a Chrome extension can only ship files
 * inside extension/, while the deployed site cannot serve /extension/*
 * (vercel.json 404s that path). Two files are therefore forced by the
 * deployment layout, and the only defence against them diverging is this test.
 *
 * It asserts that the two files are byte-identical, that they behave
 * identically on every real corpus record, and that the offline engine
 * actually detects the scam families the server detects. Before this existed
 * the fallback checked seven keywords and returned a binary 75/12, so an
 * inheritance lure or a Firebase-hosted bank lookalike read as "safe"
 * whenever the server was unreachable.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const EXT = path.join(ROOT, "extension/fallback-engine.js");
const WEB = path.join(ROOT, "js/fallback-engine.js");

let failed = false;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failed = true;
};

check("extension fallback engine exists", fs.existsSync(EXT));
check("js fallback engine exists", fs.existsSync(WEB));
if (!fs.existsSync(EXT) || !fs.existsSync(WEB)) process.exit(1);

const a = fs.readFileSync(EXT, "utf8");
const b = fs.readFileSync(WEB, "utf8");
check(
  "the two copies are byte-identical",
  a === b,
  a === b ? `${a.split("\n").length} lines` : "copy extension/ over js/ and commit"
);

function load(src) {
  const sandbox = { window: {}, module: undefined };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.RatiodFallback;
}

const extEngine = load(a);
check("engine exposes window.RatiodFallback.analyze", !!(extEngine && typeof extEngine.analyze === "function"));
const webEngine = load(b);

// The offline engine must cover every family the server implements.
const engineMod = require(path.join(ROOT, "server/rules/engine.js"));
const TAXONOMY = engineMod.TAXONOMY || (engineMod.default && engineMod.default.TAXONOMY);
const serverFamilies = (TAXONOMY.socialEngineeringFamilies || []).map((f) => f.name).sort();
const offlineFamilies = (extEngine.FAMILIES || []).slice().sort();
const missing = serverFamilies.filter((f) => !offlineFamilies.includes(f));
check(
  "offline engine covers every server social-engineering family",
  missing.length === 0,
  serverFamilies.length ? "missing: " + (missing.join(", ") || "none") : "server exposes no family list"
);

function parseCorpus(file) {
  const raw = fs.readFileSync(file, "utf8");
  return raw
    .split(/\r?\n-{20,}\r?\n/)
    .map((x) => x.trim())
    .filter((x) => /^ID:\s*(SCAM|HAM)-\d+/m.test(x))
    .map((x) => {
      const field = (n) => {
        const hit = x.match(new RegExp(`^${n}:[ \\t]*(.*)$`, "m"));
        return hit ? hit[1].trim() : "";
      };
      const i = x.search(/^BODY:[ \t]*$/m);
      return {
        id: field("ID"),
        label: field("LABEL"),
        text:
          `Subject: ${field("SUBJECT")}\nFrom: ${field("FROM")}\n\n` +
          x.slice(i).replace(/^BODY:[ \t]*\r?\n/, ""),
      };
    });
}

const all = [
  ...parseCorpus(path.join(ROOT, "server/fixtures/scam-corpus.txt")),
  ...parseCorpus(path.join(ROOT, "server/fixtures/real-world-mixed.txt")),
];

let mismatches = 0;
for (const r of all) {
  const one = extEngine.analyze(r.text);
  const two = webEngine.analyze(r.text);
  if (one.verdict !== two.verdict || one.score !== two.score) {
    mismatches++;
    console.log(`   mismatch on ${r.id}: ${one.score}/${one.verdict} vs ${two.score}/${two.verdict}`);
  }
}
check("both copies agree on every real record", mismatches === 0, `${all.length} records`);

// Coverage: the offline engine must not be a keyword subset any more.
const scamRows = all.filter((r) => r.label === "scam");
const detected = scamRows.filter((r) => extEngine.analyze(r.text).score >= 35).length;
check(
  `offline engine detects most real scams (>= ${Math.ceil(scamRows.length * 0.6)}/${scamRows.length})`,
  scamRows.length > 0 && detected >= Math.ceil(scamRows.length * 0.6),
  `${detected}/${scamRows.length} detected offline`
);

const hamFlagged = all.filter(
  (r) => r.label === "legitimate" && extEngine.analyze(r.text).verdict === "high_risk"
);
check("offline engine does not mark the ham high_risk", hamFlagged.length === 0, hamFlagged.map((h) => h.id).join(", "));

// Shape must match the server contract, or the banner cannot render it.
const sample = extEngine.analyze(all[0].text);
check(
  "response shape matches the API contract",
  ["score", "verdict", "flags", "explanation", "next_steps", "privacy", "engine"].every((k) => k in sample),
  Object.keys(sample).join(", ")
);
check("verdict is inside the server vocabulary",
  ["safe", "suspicious", "high_risk", "promo_clutter"].includes(sample.verdict),
  sample.verdict);
check("degraded results are labelled as such", sample.engine.degraded === true);

// The manifest must actually ship the file, or the extension has no engine.
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "extension/manifest.json"), "utf8"));
const shipped = (manifest.content_scripts || []).flatMap((cs) => cs.js || []);
check("manifest content_scripts includes the fallback engine", shipped.includes("fallback-engine.js"), shipped.join(", "));
check("manifest content_scripts load the engine before content-script.js",
  shipped.indexOf("fallback-engine.js") !== -1 &&
  shipped.indexOf("fallback-engine.js") < shipped.indexOf("content-script.js"),
  shipped.join(" -> "));

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
check("the console page loads the fallback engine", html.includes("js/fallback-engine.js"));

if (failed) {
  console.error("\nFALLBACK PARITY SUITE FAILED");
  process.exit(1);
}
console.log(
  `\nALL FALLBACK PARITY CHECKS PASSED (${offlineFamilies.length} families, ` +
    `${detected}/${scamRows.length} real scams detected offline)`
);
