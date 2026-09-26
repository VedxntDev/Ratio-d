/**
 * Guard the generated project context manifest.
 *
 * docs/project-context.json is derived from the live modules by
 * tools/build-context.js. Without this check it could quietly go stale the way
 * the published zips did, and a stale context file is worse than none: tooling
 * would confidently report a detection model that no longer exists.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, "docs/project-context.json");
const BUILDER = path.join(ROOT, "tools/build-context.js");
const AGENTS = path.join(ROOT, "AGENTS.md");

let failed = false;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failed = true;
};

check("context manifest exists", fs.existsSync(MANIFEST), MANIFEST);
check("AGENTS.md exists", fs.existsSync(AGENTS));

if (!fs.existsSync(MANIFEST)) process.exit(1);

const before = fs.readFileSync(MANIFEST, "utf8");

// Regenerate and compare. Deterministic: no timestamps, no randomness.
const { execFileSync } = require("child_process");
execFileSync("node", [BUILDER], { cwd: ROOT, stdio: "pipe" });
const after = fs.readFileSync(MANIFEST, "utf8");

check(
  "context manifest is up to date with the code",
  before === after,
  before === after ? "regeneration is byte-identical" : "run: node tools/build-context.js"
);

const m = JSON.parse(after);
check("manifest is valid JSON with a summary", typeof m.summary === "string" && m.summary.length > 40);
check("manifest records the honesty caveat", /NO trained machine-learning model/.test(m.important_caveats.join(" ")));
check("manifest lists the full detection taxonomy", m.detection && m.detection.rules && Array.isArray(m.detection.rules.socialEngineeringFamilies));
check("manifest documents the test prerequisite", /REQUIRES a running server/.test(m.runtime.test_prerequisite));

// Cross-check the taxonomy against the live module, so a rule added without
// updating the taxonomy export is caught.
const live = require(path.join(ROOT, "server/rules/engine.js")).TAXONOMY;
check(
  "manifest family count matches the live engine",
  m.detection.rules.socialEngineeringFamilies.length === live.socialEngineeringFamilies.length,
  `${m.detection.rules.socialEngineeringFamilies.length} vs ${live.socialEngineeringFamilies.length}`
);
check(
  "manifest brand list matches the live engine",
  JSON.stringify(m.detection.rules.brands) === JSON.stringify(live.brands),
  `${m.detection.rules.brands.length} brands`
);
check(
  "manifest corpus counts match the fixtures on disk",
  m.corpora.every((c) => {
    const raw = fs.readFileSync(path.join(ROOT, c.file), "utf8");
    const n = raw.split(/\r?\n-{20,}\r?\n/).filter((b) => /^ID:\s*(SCAM|HAM)-\d+/m.test(b)).length;
    return n === c.records;
  }),
  m.corpora.map((c) => `${c.id}:${c.records}`).join(" ")
);

if (failed) {
  console.error("\nCONTEXT MANIFEST SUITE FAILED");
  process.exit(1);
}
console.log("\nALL CONTEXT MANIFEST CHECKS PASSED");
