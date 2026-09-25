/**
 * Ratio'd Architecture Flowchart
 *
 * A data-driven, step-through view of the full 10-stage detection pipeline.
 * The board is split into a "Runs in your browser" zone and a "Backend /
 * local services" zone so the privacy story is visible at a glance: every
 * piece of PII is redacted in stage 3, before the network hop in stage 4.
 *
 * Follows the conventions already used across this site:
 *   - plain `window` global, no build step, no framework, no new dependency
 *   - GSAP is used only because the page already loads it, and every animation
 *     path degrades to an instant state change when GSAP is missing or the
 *     visitor prefers reduced motion (same guards as js/pipeline.js)
 *
 * All copy lives in the STAGES array below, so the chart can be edited
 * without touching any rendering code. Example values are taken from real
 * runs of server/rules/engine.js and js/redactor.js, not invented.
 */

window.ARCHITECTURE_STAGES = [
  {
    n: 1, zone: "browser", title: "User opens email in Gmail",
    tip: "Trigger event — nothing in Ratio'd has run yet.",
    component: "Gmail read pane",
    dataLabel: "raw message",
    runs: "Gmail itself. The content script is only waiting for a DOM change; no Ratio'd code is involved yet.",
    receives: "An email opened in the Gmail read pane.",
    produces: "A rendered message body element inside the page DOM.",
    example: "innerText.length = 412",
    dataShape: "string — raw, unmasked",
    dataSample: "URGENT: Your Microsoft account will be suspended. Verify now at http://m1crosoft-support.com/login.",
    dataNote: "The only point in the whole pipeline where the full, unmasked message exists. It never leaves the browser."
  },
  {
    n: 2, zone: "browser", title: "Content script activates",
    tip: "Reads sender, subject and body straight from the Gmail DOM.",
    component: "scanAndAnalyzeGmail()",
    dataLabel: "messageText",
    runs: "A MutationObserver plus a 1s poll, a selector for the read-pane body, and a hash guard so the same message is never analysed twice.",
    receives: "The message body element matched by .a3s / .ii.gt and friends.",
    produces: "messageText — the raw inner text of the open email.",
    example: "lastAnalyzedHash = messageText.substring(0, 100) + messageText.length",
    dataShape: "string — raw, unmasked",
    dataSample: "messageText (412 chars, still contains the real phone number and address)",
    dataNote: "Still 100% local. This string exists only inside the page."
  },
  {
    n: 3, zone: "browser", title: "Client-side PII redaction",
    tip: "Phones, emails and OTP-like sequences are masked before anything leaves the browser.",
    component: "redactPiiLocally()",
    dataLabel: "redactedText",
    runs: "Three regex passes in order: phone numbers, email addresses, then OTP / passcode / PIN digit runs.",
    receives: "messageText, the raw string from stage 2.",
    produces: "redactedText plus a count of how many of each kind were masked.",
    example: "+1 (415) 555-0199  ->  [PHONE_REDACTED]\nvictim@example.com  ->  [EMAIL_REDACTED]\ncode 837492          ->  [OTP_REDACTED]\n{ phones_masked: 1, emails_masked: 1, otp_masked: 1 }",
    dataShape: "string — redacted, irreversible",
    dataSample: "URGENT: ... Verify now at http://m1crosoft-support.com/login. Call [PHONE_REDACTED] or email [EMAIL_REDACTED].",
    dataNote: "The real values are never copied anywhere — they are replaced in place and then dropped."
  },
  {
    n: 4, zone: "backend", title: "Redacted text sent to backend",
    tip: "The privacy boundary: only the redacted string crosses the network.",
    component: "POST /analyze",
    dataLabel: "{ text, channel }",
    runs: "A single fetch(). If the local engine is down it retries the deployed endpoint, and finally falls back to an in-page heuristic engine.",
    receives: "The redacted text from stage 3 and the channel the user selected.",
    produces: "One JSON request body. The raw message is not part of it.",
    example: '{ "text": "URGENT: ... Call [PHONE_REDACTED] ...", "channel": "email" }',
    dataShape: "JSON request",
    dataSample: '{ "text": "<redacted string>", "channel": "email" }',
    dataNote: "Fallback chain: 127.0.0.1:3000 -> ratio-d.vercel.app/api/analyze -> in-page heuristic engine."
  },
  {
    n: 5, zone: "backend", title: "Rule engine (deterministic, JS)",
    tip: "Typosquat / homoglyph domains, link mismatches, urgency + credential scoring. Runs in parallel with stage 6.",
    component: "evaluateRules()",
    dataLabel: "{ ruleScore, flags[] }",
    runs: "Homoglyph normalisation, a Levenshtein distance check against a known-brand list, subdomain brand-stuffing, sender/link mismatch, and urgency + credential-request scoring. Fully deterministic — the same input always gives the same score.",
    receives: "The redacted text and the channel.",
    produces: "A rule score out of 100 plus a flags array, where each flag names the exact span that triggered it.",
    example: "ruleScore: 90\nspan: m1crosoft-support.com\nreason: Homoglyph/Typosquat domain: 'm1crosoft-support.com' uses character substitution to impersonate brand 'MICROSOFT'",
    dataShape: "object",
    dataSample: '{ "ruleScore": 90, "flags": [ { "span": "m1crosoft-support.com", "reason": "Homoglyph/Typosquat domain: ...", "type": "rule" } ] }',
    dataNote: "The '1' in m1crosoft is caught by the homoglyph pass — that is a deterministic check, not a model guess."
  },
  {
    n: 6, zone: "backend", title: "Laya (local typed-decision model)",
    tip: "Calibrated risk classification + probability, run locally. Parallel with stage 5.",
    component: "evaluateLayaModel()",
    dataLabel: "{ label, probability }",
    runs: "A local typed-decision classifier. The response always states its own source, so a heuristic fallback is never presented as a real model score.",
    receives: "The redacted text and the rule flags from stage 5.",
    produces: "A probability between 0.02 and 0.99, a label derived from it, and a source string.",
    example: 'probability: 0.72 -> label: "high_risk"   (>= 0.65)\nsource: "laya_stub_heuristic"\nnote: "Local typed-decision fallback model active (laya container offline)."',
    dataShape: "object",
    dataSample: '{ "label": "high_risk", "probability": 0.72, "source": "laya_stub_heuristic" }',
    dataNote: "Nothing leaves the machine, and the honest source string travels all the way to the UI."
  },
  {
    n: 7, zone: "backend", title: "Score combiner",
    tip: "Convergence point: merges the rule engine and Laya into one score and verdict.",
    component: "combineScore()",
    dataLabel: "{ score, verdict }",
    runs: "A weighted blend — 70% rule score, 30% model probability — followed by disqualification floors. Domain spoofing or brand impersonation alone forces a minimum of 82 and a high_risk verdict.",
    receives: "ruleScore from stage 5 and the model result from stage 6.",
    produces: "One clamped 0-100 score, a verdict, and the matching next_steps list.",
    example: "round(90 * 0.70 + 72 * 0.30) = 85\nsevere domain spoof -> floor of 82 applies\nverdict: \"high_risk\"   (score >= 66)",
    dataShape: "object",
    dataSample: '{ "score": 85, "verdict": "high_risk", "next_steps": [ ... ] }',
    dataNote: "Thresholds: >= 66 high_risk, >= 35 suspicious, otherwise safe."
  },
  {
    n: 8, zone: "backend", title: "LLM explanation call",
    tip: "Writes the plain-language red flags. It does not re-decide the score.",
    component: "generateExplanation()",
    dataLabel: "{ explanation, source }",
    runs: "Runs strictly after the verdict, and only phrases that verifiably appear in the source text are kept. Deterministic by default; an LLM is used only when a key is configured, and the source is reported verbatim either way.",
    receives: "The verdict, the flags, the channel and the redacted text.",
    produces: "A grounded explanation string plus a source and model name.",
    example: 'source: "deterministic"   (no key configured)\nsource: "llm"                    (key configured, phrases verified)\n-> "SUSPICIOUS CONTENT: caution is advised. This EMAIL message triggered ..."',
    dataShape: "object",
    dataSample: '{ "explanation": "SUSPICIOUS CONTENT: ...", "source": "deterministic", "model": null }',
    dataNote: "The score is decided in stage 7. This stage can only describe it, never change it."
  },
  {
    n: 9, zone: "backend", title: "Response returned to extension",
    tip: "Verdict, score, highlights, next steps and a privacy summary.",
    component: "Part A.5 contract",
    dataLabel: "JSON response",
    runs: "Aggregates the stage 5-8 outputs and logs privacy telemetry — counts only, never raw text or real PII values.",
    receives: "Everything produced by stages 5 to 8.",
    produces: "The full response contract that the extension and the paste console both render.",
    example: '{ "score": 85, "verdict": "high_risk", "flags": [...],\n  "explanation": "...", "next_steps": [...],\n  "privacy": { "phones_masked": 1, "emails_masked": 1, "otp_masked": 1 },\n  "engine": { "rules": "deterministic-homoglyph-levenshtein" } }',
    dataShape: "JSON response",
    dataSample: '{ "score": 85, "verdict": "high_risk", "flags": [ ... ], "engine": { "model_source": "laya_stub_heuristic" } }',
    dataNote: "The engine block reports what actually ran, including an explicit heuristic-fallback label."
  },
  {
    n: 10, zone: "browser", title: "Banner rendered in Gmail (Shadow DOM)",
    tip: "The only part of the pipeline a user ever actually sees.",
    component: "injectRatiodBanner()",
    dataLabel: "ShadowRoot UI",
    runs: "Attaches an open Shadow DOM host into the message body, then renders the badge, a details drawer and the action buttons.",
    receives: "The JSON response from stage 9.",
    produces: "The risk badge, the flagged-phrase highlights, the next-steps list and one-click actions.",
    example: "[ VERDICT · HIGH_RISK ]   85/100\nm1crosoft-support.com highlighted in the body\n-> Report sender as phishing\n-> Verify at the official brand URL",
    dataShape: "rendered UI",
    dataSample: "badge + score gauge + details drawer + action buttons",
    dataNote: "A Shadow DOM host keeps Gmail's own styles from leaking in and Ratio'd's styles from leaking out."
  }
];
window.ArchitectureController = (function () {
  "use strict";

  const STAGES = window.ARCHITECTURE_STAGES;
  const AUTOPLAY_MS = 1700;

  let activeIndex = 0;      // index into STAGES
  let lens = "components";  // "components" | "data"
  let timer = null;

  function byNumber(n) {
    return STAGES.find((s) => s.n === n) || null;
  }

  function prefersReduced() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---- tiny DOM helpers (textContent only, never innerHTML) ----
  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  // ---- rendering ----
  function nodeEl(stage) {
    const tint = stage.zone === "browser" ? "card-tint-blue" : "card-tint-yellow";
    const btn = el("button", "arch-node tactile " + tint);
    btn.type = "button";
    btn.dataset.stage = String(stage.n);
    btn.dataset.tip = stage.tip;
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "arch-detail");

    btn.appendChild(el("span", "arch-node-num", pad(stage.n)));
    btn.appendChild(el("span", "arch-node-title", stage.title));
    btn.appendChild(el("span", "arch-node-lens",
      lens === "data" ? stage.dataLabel : stage.component));

    // 5 and 6 are a parallel pair - mark them so the fork reads clearly.
    if (stage.n === 5 || stage.n === 6) {
      btn.classList.add("is-parallel");
      btn.appendChild(el("span", "arch-node-tag", "PARALLEL"));
    }

    btn.addEventListener("click", function () { select(stage.n - 1, { pulse: false }); });
    return btn;
  }

  function connEl(from, to, tip) {
    const conn = el("span", "arch-conn");
    if (from) conn.dataset.from = String(from);
    if (to) conn.dataset.to = String(to);
    if (tip) conn.dataset.tip = tip;
    conn.appendChild(el("span", "arch-packet"));
    return conn;
  }

  function zoneEl(kind, title, note) {
    const zone = el("div", "arch-zone arch-zone--" + kind);
    const head = el("div", "arch-zone-head");
    head.appendChild(el("span", "sticker sticker-blue sticker-tilt-left", title));
    head.appendChild(el("span", "arch-zone-note", note));
    zone.appendChild(head);
    return zone;
  }

  function boundaryEl(label, note) {
    const wrap = el("div", "arch-boundary");
    wrap.appendChild(el("span", "arch-boundary-line"));
    const tag = el("span", "arch-boundary-label", label);
    if (note) tag.title = note;
    wrap.appendChild(tag);
    wrap.appendChild(el("span", "arch-boundary-line"));
    return wrap;
  }

  function buildBoard() {
    const board = document.getElementById("arch-board");
    if (!board) return;
    board.textContent = "";

    // Zone A - browser: stages 1-3.
    const zoneA = zoneEl("browser", "Runs in your browser", "Nothing here touches the network.");
    const trackA = el("div", "arch-track");
    [1, 2, 3].forEach(function (n, i) {
      // The connector is emitted BEFORE the node it leads into, so it must
      // describe the previous -> current hop, not current -> next.
      if (i > 0) trackA.appendChild(connEl(n - 1, n, "Passes the redacted string forward."));
      trackA.appendChild(nodeEl(byNumber(n)));
    });
    zoneA.appendChild(trackA);
    board.appendChild(zoneA);

    board.appendChild(boundaryEl("Privacy boundary", "Only redacted text crosses this line."));

    // Zone B - backend: stage 4, the 5/6 parallel fork, then 7, 8, 9.
    const zoneB = zoneEl("backend", "Backend / local services", "Rule engine and model run side by side.");
    const trackB = el("div", "arch-track");
    trackB.appendChild(nodeEl(byNumber(4)));
    trackB.appendChild(connEl(4, 5, "Redacted text only — the raw message stays in the browser."));

    const parallel = el("div", "arch-parallel");
    parallel.setAttribute("role", "group");
    parallel.setAttribute("aria-label", "Parallel branches: rule engine and Laya model");
    parallel.appendChild(el("span", "arch-parallel-tag", "RUNS IN PARALLEL"));
    [5, 6].forEach(function (n) {
      const branch = el("div", "arch-branch");
      branch.appendChild(nodeEl(byNumber(n)));
      branch.appendChild(connEl(null, null, "Both branches converge on the score combiner."));
      parallel.appendChild(branch);
    });
    trackB.appendChild(parallel);

    trackB.appendChild(connEl(6, 7, "Both branches merge into one score."));
    trackB.appendChild(nodeEl(byNumber(7)));
    trackB.appendChild(connEl(7, 8, "The verdict is already decided; this stage only explains it."));
    trackB.appendChild(nodeEl(byNumber(8)));
    trackB.appendChild(connEl(8, 9, "The full response contract travels back."));
    trackB.appendChild(nodeEl(byNumber(9)));

    zoneB.appendChild(trackB);
    board.appendChild(zoneB);

    board.appendChild(boundaryEl("Response returns", "Verdict, score, highlights and next steps."));

    // Zone C - browser: stage 10.
    const zoneC = zoneEl("browser", "Runs in your browser", "The only stage a user actually sees.");
    const trackC = el("div", "arch-track");
    trackC.appendChild(nodeEl(byNumber(10)));
    zoneC.appendChild(trackC);
    board.appendChild(zoneC);
  }
  // ---- node labels follow the active lens ----
  function refreshNodeLabels() {
    document.querySelectorAll("#arch-board .arch-node").forEach(function (btn) {
      const stage = byNumber(parseInt(btn.dataset.stage, 10));
      if (!stage) return;
      btn.querySelector(".arch-node-lens").textContent =
        lens === "data" ? stage.dataLabel : stage.component;
    });
  }

  function field(label, value, mono) {
    const wrap = el("div", "arch-field");
    wrap.appendChild(el("span", "arch-field-label", label));
    wrap.appendChild(el(mono ? "code" : "p", mono ? "arch-example" : "arch-field-text", value));
    return wrap;
  }

  function renderDetail() {
    const panel = document.getElementById("arch-detail");
    if (!panel) return;
    panel.textContent = "";

    const stage = STAGES[activeIndex];
    if (!stage) return;

    const head = el("div", "arch-detail-head");
    head.appendChild(el("span", "sticker sticker-yellow", "Stage " + pad(stage.n)));
    head.appendChild(el("span", "sticker sticker-white",
      stage.zone === "browser" ? "Browser" : "Backend"));
    head.appendChild(el("h3", "arch-detail-title", stage.title));
    panel.appendChild(head);

    const grid = el("div", "arch-detail-grid");
    if (lens === "components") {
      grid.appendChild(field("What runs", stage.runs));
      grid.appendChild(field("What it receives", stage.receives));
      grid.appendChild(field("What it produces", stage.produces));
      grid.appendChild(field("Concrete example", stage.example, true));
    } else {
      grid.appendChild(field("Payload shape", stage.dataShape));
      grid.appendChild(field("Sample value", stage.dataSample, true));
      grid.appendChild(field("Concrete example", stage.example, true));
    }
    panel.appendChild(grid);

    panel.appendChild(el("p", "arch-detail-note",
      lens === "components" ? stage.dataNote : stage.runs));
  }

  function renderStatus() {
    const status = document.getElementById("arch-status");
    if (status) status.textContent = "Stage " + pad(STAGES[activeIndex].n) + " / " + pad(STAGES.length);
  }

  // ---- packet pulse along the connector ----
  function pulse(from, to) {
    if (from == null || to == null) return;
    if (prefersReduced() || typeof gsap === "undefined") return;

    const conn = document.querySelector(
      '#arch-board .arch-conn[data-from="' + from + '"][data-to="' + to + '"]'
    );
    if (!conn) return;

    const packet = conn.querySelector(".arch-packet");
    if (!packet) return;

    // Connectors flip to vertical under 992px, so pick the axis by measurement.
    const vertical = conn.offsetHeight > conn.offsetWidth;
    const start = vertical ? { top: "0%" } : { left: "0%" };
    const end = vertical ? { top: "100%" } : { left: "100%" };

    gsap.killTweensOf(packet);
    gsap.fromTo(packet,
      Object.assign({ opacity: 1 }, start),
      Object.assign({ opacity: 0, duration: 0.55, ease: "power1.inOut" }, end)
    );
  }
  // ---- state ----
  function select(index, options) {
    const opts = options || {};
    const clamped = Math.max(0, Math.min(STAGES.length - 1, index));
    const from = STAGES[activeIndex] ? STAGES[activeIndex].n : null;
    const to = STAGES[clamped].n;
    activeIndex = clamped;

    document.querySelectorAll("#arch-board .arch-node").forEach(function (btn) {
      const n = parseInt(btn.dataset.stage, 10);
      btn.classList.toggle("is-active", n === to);
      btn.classList.toggle("is-done", n < to);
      btn.setAttribute("aria-expanded", n === to ? "true" : "false");
    });

    renderStatus();
    renderDetail();

    if (opts.pulse !== false && from !== to) pulse(from, to);

    // Reaching the end stops autoplay rather than looping silently.
    if (clamped === STAGES.length - 1) pause();
  }

  function next() { select(activeIndex + 1, { pulse: true }); }
  function prev() { select(activeIndex - 1, { pulse: false }); }

  function pause() {
    if (timer) { clearInterval(timer); timer = null; }
    const btn = document.getElementById("arch-play");
    if (btn) { btn.textContent = "▶ Play"; btn.setAttribute("aria-pressed", "false"); }
  }

  function play() {
    if (timer) return;
    // Restart from the top once the run has finished.
    if (activeIndex === STAGES.length - 1) select(0, { pulse: false });
    const btn = document.getElementById("arch-play");
    if (btn) { btn.textContent = "❚❚ Pause"; btn.setAttribute("aria-pressed", "true"); }
    timer = setInterval(next, AUTOPLAY_MS);
  }

  function togglePlay() { if (timer) pause(); else play(); }

  function setLens(nextLens) {
    lens = nextLens;
    ["components", "data"].forEach(function (name) {
      const btn = document.getElementById("arch-lens-" + name);
      if (!btn) return;
      const on = name === lens;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    refreshNodeLabels();
    renderDetail();
  }

  function init() {
    if (!document.getElementById("arch-board")) return;

    buildBoard();

    document.getElementById("arch-play")?.addEventListener("click", togglePlay);
    document.getElementById("arch-next")?.addEventListener("click", function () { pause(); next(); });
    document.getElementById("arch-prev")?.addEventListener("click", function () { pause(); prev(); });
    document.getElementById("arch-lens-components")?.addEventListener("click", function () { setLens("components"); });
    document.getElementById("arch-lens-data")?.addEventListener("click", function () { setLens("data"); });

    // Arrow keys step the chart, but only while focus is inside the section
    // and never while the visitor is typing somewhere else.
    document.getElementById("architecture")?.addEventListener("keydown", function (e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || e.target.isContentEditable) return;
      if (e.key === "ArrowRight") { e.preventDefault(); pause(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); pause(); prev(); }
    });

    setLens("components");
    select(0, { pulse: false });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return { init: init, next: next, prev: prev, play: play, pause: pause, setLens: setLens };
})();
