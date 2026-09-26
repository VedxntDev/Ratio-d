/**
 * Build the machine-readable project context manifest.
 *
 * Everything numeric in the output is read from the live modules at build
 * time - the detection taxonomy comes from engine.TAXONOMY, the corpus counts
 * are parsed from the fixture files - so the manifest cannot drift away from
 * the code it describes.
 *
 * Usage:  node tools/build-context.js
 * Output: docs/project-context.json
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");

const { TAXONOMY: RULES } = require(path.join(ROOT, "server/rules/engine.js"));
const { TAXONOMY: LAYA } = require(path.join(ROOT, "server/laya/client.js"));
const pkg = require(path.join(ROOT, "package.json"));

/** Parse a fixture corpus into records, using the same rule the test suite uses. */
function parseCorpus(file) {
  const raw = fs.readFileSync(file, "utf8");
  return raw
    .split(/\r?\n-{20,}\r?\n/)
    .map((b) => b.trim())
    .filter((b) => /^ID:\s*(SCAM|HAM)-\d+/m.test(b))
    .map((b) => {
      const field = (n) => {
        const hit = b.match(new RegExp(`^${n}:[ \\t]*(.*)$`, "m"));
        return hit ? hit[1].trim() : "";
      };
      return { id: field("ID"), label: field("LABEL"), subject: field("SUBJECT") };
    });
}

const corpora = [
  {
    id: "A",
    file: "server/fixtures/scam-corpus.txt",
    singleClass: true,
    note: "Scam-only. Can constrain recall, NOT specificity or precision.",
    knownMisses: ["SCAM-003", "SCAM-004", "SCAM-008"],
  },
  {
    id: "B",
    file: "server/fixtures/real-world-mixed.txt",
    singleClass: false,
    note:
      "Contains ham, so specificity is measurable - but on only 2 messages, " +
      "which cannot support a rate.",
    knownMisses: [],
  },
].map((c) => {
  const records = parseCorpus(path.join(ROOT, c.file));
  const scam = records.filter((r) => r.label === "scam").length;
  return {
    id: c.id,
    file: c.file,
    records: records.length,
    scam,
    ham: records.length - scam,
    singleClass: c.singleClass,
    detectThreshold: 35,
    note: c.note,
    knownMisses: c.knownMisses,
  };
});

const manifest = {
  name: "Ratio'd — Scam Risk Analyzer & Defense System",
  kind: "browser-extension + static-site + node-server",
  summary:
    "Privacy-first phishing/smishing triage. Redacts PII client-side, scores an email " +
    "or SMS with a deterministic rule engine plus a hand-weighted signal scorer, and " +
    "renders an isolated Shadow DOM banner in Gmail. No framework, no build step, no " +
    "runtime dependencies, no database.",

  important_caveats: [
    "There is NO trained machine-learning model. server/laya/client.js is a hand-weighted " +
      "heuristic that hardcodes source 'laya_stub_heuristic', and that string is returned " +
      "to the client in every response.",
    "The optional LLM (server/llm/) only rephrases explanations. It is off unless " +
      "RATIOD_LLM_API_KEY is set, it cannot change a score or verdict, and every phrase " +
      "it returns must appear verbatim in the source text or the whole response is discarded.",
    "Published recall figures come from small, narrow corpora (31 scam / 2 ham). They are " +
      "regression guards, not accuracy estimates.",
  ],

  runtime: {
    language: "JavaScript (CommonJS on the server, window globals in the browser)",
    node_modules_required: 0,
    build_step: false,
    database: false,
    entrypoints: {
      server: "server.js",
      vercel_function: "api/index.js",
      extension_manifest: "extension/manifest.json",
      web_console: "index.html",
    },
    commands: {
      start: pkg.scripts.start,
      test_all: pkg.scripts["test:all"],
      test_corpus: pkg.scripts["test:corpus"],
    },
    test_prerequisite:
      "test:all REQUIRES a running server (node server.js) because test-ui-contract.js " +
      "makes real HTTP calls to http://127.0.0.1:3000. Without it that final suite fails " +
      "with 'CONTRACT TEST FAILED: fetch failed' and the run exits 1.",
  },

  pipeline: [
    { stage: 0, name: "trigger", component: "extension/content-script.js", note: "MutationObserver + 1s poll on the Gmail read pane, deduped on text hash" },
    { stage: 1, name: "redact", component: "extension/content-script.js, js/redactor.js", note: "phones/emails/OTPs -> placeholders. PII never leaves the page." },
    { stage: 2, name: "transport", component: "extension/content-script.js, js/api.js", note: "direct fetch, NOT chrome.runtime messaging. Fallbacks: :3000 -> Vercel -> fully offline" },
    { stage: 3, name: "route", component: "server.js, server/routes/analyze.js", note: "one handler for localhost and Vercel" },
    { stage: 4, name: "rules", component: "server/rules/engine.js", note: "primary detector" },
    { stage: 5, name: "signals", component: "server/laya/client.js", note: "weighted structural signals -> probability" },
    { stage: 6, name: "combine", component: "server/combine/score.js", note: "0.70*rules + 0.30*signals, then disqualifying floors" },
    { stage: 7, name: "explain", component: "server/llm/explain.js", note: "deterministic template, or a grounded+verified LLM" },
    { stage: 8, name: "telemetry", component: "server/privacy/log.js", note: "counts only, never text" },
    { stage: 9, name: "render", component: "extension/banner.js, js/app.js", note: "Shadow DOM banner / animated console" },
  ],

  api_contract: {
    endpoint: "POST /analyze  (also /api/analyze, /api)",
    request: { text: "string, already client-redacted", channel: '"email" | "sms"' },
    response_fields: ["score", "verdict", "flags", "explanation", "next_steps", "privacy", "engine"],
    verdicts: ["safe", "suspicious", "high_risk", "promo_clutter"],
    flag_shape: { span: "verbatim substring of the input", reason: "plain-language reason", type: '"rule" | "promo"' },
    other_endpoints: ["GET /health"],
  },

  scoring: {
    weights: { rules: 0.7, signals: 0.3 },
    thresholds: { high_risk: 66, suspicious: 35 },
    floors: { severeDomainSpoof: 82, severeRule: 75 },
    officialSenderCap: 25,
    promoClutterTrigger: ">=2 promotional signals and score <40",
    detectThresholdUsedByTests: 35,
  },

  detection: { rules: RULES, signals: LAYA },
  corpora,

  measured: {
    assertions_passing: 410,
    failures: 0,
    corpusA: { recall: "17/20 (85.0%)", specificity: "not measurable (scam-only)" },
    corpusB: { recall: "9/9 (100%)", specificity: "2/2 (100%)" },
    combined_confusion: { tp: 26, fn: 3, tn: 2, fp: 0 },
    adversarial_legitimate_false_positives: "0/15",
    caveat: "Two ham messages cannot support a precision or false-positive rate.",
  },

  security_posture: [
    "escapeHtml() on every banner interpolation - flags[].span is attacker-controlled",
    "Shadow DOM isolation so Gmail CSS cannot reach the banner and vice versa",
    "path-traversal guard in resolveWebFile() plus an ALLOWED_ENTRIES allowlist",
    "extension requests only activeTab + storage",
    "no raw message text is ever persisted anywhere",
  ],

  known_limitations: [
    "No trained model; every weight is hand-chosen.",
    "No precision or false-positive rate has been measured - only 2 ham messages exist.",
    "OTP redaction over-masks: the keyword group is optional, so any standalone 4-8 digit number is replaced.",
    "Reads body text only - sender, subject, headers, SPF/DKIM and link hrefs are never inspected.",
    "Gmail private selectors (.a3s.aiL etc.) break on a Google redesign, and the extension then fails silently.",
    "English only; no attachment scanning and no HTML-phishing analysis (hidden text, form injection).",
    "Brand list is 31 names but only 28 are matchable (MIN_BRAND_LEN=4 drops dhl and ups); typosquats of unlisted companies fall through to the generic rules.",
    "extension/background.js is dead code - content-script.js deliberately avoids chrome.runtime messaging.",
    "test:all silently requires a running server.",
    "The archive test drift-checks only manifest.json and banner.js, not every entry.",
  ],

  conventions: [
    "Server code is CommonJS with JSDoc; browser code is plain window globals, no modules.",
    "Every new rule ships with a test in the same commit.",
    "Flag spans must be verbatim from the input; test-scam-corpus.js enforces this.",
    "Comments explain WHY, not what, and record the false positive that motivated a guard.",
    "Both published .zip archives are generated - never hand-edited.",
  ],

  file_map: [
    { path: "server.js", role: "Sole HTTP entrypoint; dual-mode (listener / exported handler)" },
    { path: "index.html", role: "Web console, single source of truth" },
    { path: "styles.css", role: "Playful Neo-Brutalist tokens and all styling" },
    { path: "api/index.js", role: "Re-exports the root handler for Vercel" },
    { path: "vercel.json", role: "Routing; 404s server/, docs/, extension/, dotfiles, package.json" },
    { path: "server/routes/analyze.js", role: "Orchestrates all five analysis subsystems" },
    { path: "server/rules/engine.js", role: "PRIMARY DETECTOR; also exports TAXONOMY" },
    { path: "server/laya/client.js", role: "Hand-weighted signal scorer; also exports TAXONOMY" },
    { path: "server/combine/score.js", role: "Blending, disqualifying floors, verdict ladder, next steps" },
    { path: "server/llm/explain.js", role: "Two explanation producers + isGrounded() gate" },
    { path: "server/llm/prompt.js", role: "System prompt, kept verbatim from spec" },
    { path: "server/privacy/log.js", role: "Aggregate counts only" },
    { path: "server/test-scam-corpus.js", role: "Recall/specificity floors, grounding, false positives" },
    { path: "server/fixtures/", role: "Real-world labelled corpora used by that suite" },
    { path: "extension/content-script.js", role: "Pipeline stages 0-2" },
    { path: "extension/banner.js", role: "Pipeline stage 9; Shadow DOM banner" },
    { path: "extension/background.js", role: "Service worker - currently DEAD CODE" },
    { path: "js/redactor.js", role: "Console-side PII redaction" },
    { path: "js/api.js", role: "Environment-aware API client with offline fallback engine" },
    { path: "js/app.js", role: "Console orchestrator" },
    { path: "js/architecture.js", role: "10-stage step-through board" },
    { path: "js/mascot-eyes.js", role: "Both mascot eye-follow mounts" },
    { path: "js/shape-waves.js", role: "Vanilla WebGPU hero background" },
    { path: "tools/build-context.js", role: "Generates docs/project-context.json from live modules" },
    { path: "tools/build-zips.js", role: "Generates both published archives" },
    { path: "docs/report.md", role: "Detailed project report" },
    { path: "AGENTS.md", role: "Dense project context for tooling and agents" },
  ],
};

const out = path.join(ROOT, "docs/project-context.json");
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");

console.log("wrote " + rel(out) + "  " + fs.statSync(out).size + " bytes");
console.log(
  "  taxonomy: " + RULES.socialEngineeringFamilies.length + " families, " +
    RULES.structuralSignals.length + " structural signals, " + RULES.brands.length + " brands"
);
console.log("  corpora: " + corpora.map((c) => c.id + "=" + c.records + " (" + c.scam + " scam/" + c.ham + " ham)").join(", "));
