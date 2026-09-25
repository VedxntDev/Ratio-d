/**
 * Ratio'd — Console Application
 *
 * Wires the UI to the live analysis backend and surfaces exactly what the
 * engine returned (rules fired, model source, latency, privacy counts) so
 * the connection is visible rather than assumed.
 */

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const input        = $("telemetry-input");
  const analyzeBtn   = $("btn-analyze");
  const clearBtn     = $("btn-clear");
  const emailTab     = $("tab-email");
  const smsTab       = $("tab-sms");
  const privacyText  = $("privacy-counts");
  const redactionBox = $("redaction-readout");
  const connPill     = $("conn-pill");
  const connText     = $("conn-text");

  const emptyState   = $("result-empty");
  const resultView   = $("result-view");
  const badge        = $("verdict-badge");
  const explanation  = $("verdict-explanation");
  const flagChips    = $("flag-chips");
  const flagList     = $("flags-list");
  const stepList     = $("steps-list");
  const engineGrid   = $("engine-grid");
  const scoreNum     = $("score-num");
  const gaugeArc     = $("gauge-arc");

  let channel = "email";

  // Circumference of the r=52 circle: 2 * PI * 52
  const CIRC = 2 * Math.PI * 52;

  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function wait(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  /* ---------------- channel ---------------- */
  function setChannel(next) {
    channel = next;
    const isSms = next === "sms";
    emailTab.classList.toggle("is-active", !isSms);
    smsTab.classList.toggle("is-active", isSms);
    emailTab.setAttribute("aria-pressed", String(!isSms));
    smsTab.setAttribute("aria-pressed", String(isSms));
    input.placeholder = isSms
      ? "Paste the SMS body here..."
      : "Paste the full email here - headers, subject and body all help.";
  }
  emailTab.addEventListener("click", () => setChannel("email"));
  smsTab.addEventListener("click", () => setChannel("sms"));

  /* ---------------- live redaction readout ---------------- */
  function updateRedaction(raw) {
    const { stats } = window.Redactor.redact(raw);
    const total = stats.total_masked;

    if (total > 0) {
      redactionBox.classList.add("is-hot");
      privacyText.innerHTML =
        "<strong>" + total + " item(s) masked in your browser:</strong> " +
        stats.phones_masked + " phone &middot; " +
        stats.emails_masked + " email &middot; " +
        stats.otp_masked + " OTP &mdash; only the redacted text is sent.";
    } else {
      redactionBox.classList.remove("is-hot");
      privacyText.textContent =
        "Client-side redaction armed \u2014 no PII leaves your browser unmasked.";
    }
    return stats;
  }
  input.addEventListener("input", () => updateRedaction(input.value));

  /* ---------------- connectivity probe ---------------- */
  async function probeBackend() {
    try {
      const res = await fetch(window.ApiClient.healthEndpoint(), { method: "GET" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      connPill.dataset.state = "online";
      connText.textContent = "Engine online";
      connPill.title = "Backend: " + (data.runtime || "unknown") + " \u00b7 rules: " +
        ((data.engine && data.engine.rules) || "n/a");
    } catch {
      connPill.dataset.state = "offline";
      connText.textContent = "Engine offline";
    }
  }
  probeBackend();

  /* ---------------- presets ---------------- */
  function loadPreset(preset) {
    setChannel(preset.channel);
    input.value = preset.text;
    updateRedaction(input.value);
  }
  $("preset-phishing").addEventListener("click", () => loadPreset(window.Presets.phishingEmail));
  $("preset-sms").addEventListener("click", () => loadPreset(window.Presets.urgentSms));
  $("preset-legit").addEventListener("click", () => loadPreset(window.Presets.legitimateNotice));
  $("hero-sample").addEventListener("click", () => {
    loadPreset(window.Presets.phishingEmail);
    $("console").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* ---------------- reset ---------------- */
  function reset() {
    input.value = "";
    updateRedaction("");
    emptyState.hidden = false;
    resultView.hidden = true;
    badge.className = "verdict-badge verdict-idle";
    badge.textContent = "Awaiting input";
    explanation.textContent = "";
    flagChips.innerHTML = "";
    flagList.innerHTML = "";
    stepList.innerHTML = "";
    engineGrid.innerHTML = "";
    scoreNum.textContent = "0";
    gaugeArc.style.strokeDashoffset = CIRC;
    gaugeArc.style.stroke = "var(--muted-2)";
    window.PipelineController.reset();
  }
  clearBtn.addEventListener("click", reset);

  /* ---------------- render ---------------- */
  function scoreColor(verdict) {
    if (verdict === "high_risk") return "#DC2626";
    if (verdict === "suspicious") return "#B45309";
    if (verdict === "promo_clutter") return "#4F46E5";
    return "#059669";
  }

  function render(result) {
    const score = result.score || 0;
    const verdict = result.verdict || "safe";
    const flags = result.flags || [];
    const steps = result.next_steps || [];
    const engine = result.engine || {};
    const privacy = result.privacy || {};

    emptyState.hidden = true;
    resultView.hidden = false;

    badge.className = "verdict-badge verdict-" + verdict;
    badge.textContent = verdict.replace(/_/g, " ");

    explanation.textContent = result.explanation || "";

    // score ring
    gaugeArc.style.stroke = scoreColor(verdict);
    requestAnimationFrame(function () {
      gaugeArc.style.strokeDashoffset = CIRC * (1 - score / 100);
    });
    scoreNum.textContent = score;

    // quick chips
    flagChips.innerHTML = flags.slice(0, 6).map(function (f) {
      const cls = f.type === "promo" ? "is-warn" : (verdict === "high_risk" ? "is-danger" : "");
      return '<span class="flag-chip ' + cls + '">' + escapeHtml(f.span) + "</span>";
    }).join("");

    // full flag detail
    flagList.innerHTML = flags.length
      ? flags.map(function (f) {
          const cls = f.type === "promo" ? "is-promo" : "is-danger";
          return '<li class="' + cls + '"><span class="flag-dot"></span>' +
            '<span class="flag-body"><span class="flag-span">' + escapeHtml(f.span) + "</span>" +
            '<span class="flag-reason">' + escapeHtml(f.reason) + "</span></span></li>";
        }).join("")
      : '<li><span class="flag-dot"></span><span class="flag-body">' +
        '<span class="flag-reason">No rules fired. Nothing matched a known threat pattern.</span>' +
        "</span></li>";

    // next steps
    stepList.innerHTML = steps.map(function (s) {
      return "<li><span>" + escapeHtml(s) + "</span></li>";
    }).join("");

    // engine trace — proof of what actually answered
    const isFallback = result.source === "browser_fallback";
    const rows = [
      ["Rule engine", engine.rules || "n/a", "is-good"],
      ["Rules fired", String(engine.rule_flags != null ? engine.rule_flags : flags.length), ""],
      ["Model source", engine.model_source || result.source || "n/a",
        engine.model_source === "laya_stub_heuristic" ? "is-warn" : ""],
      ["Model probability", engine.model_probability != null
        ? Number(engine.model_probability).toFixed(2) : "n/a", ""],
      ["Backend latency", engine.latency_ms != null ? engine.latency_ms + " ms" : "n/a", ""],
      ["Answered by", isFallback ? "browser fallback" : "analysis backend",
        isFallback ? "is-warn" : "is-good"],
      ["PII masked (server)", (privacy.phones_masked || 0) + " phone / " +
        (privacy.emails_masked || 0) + " email / " + (privacy.otp_masked || 0) + " OTP", ""],
      ["Explanation mode", engine.explain || "grounded-in-flags", "is-good"],
      ["Explanation by", engine.explain_source === "llm"
        ? "LLM (" + (engine.explain_model || "unknown") + ")"
        : "deterministic engine", engine.explain_source === "llm" ? "is-warn" : "is-good"]
    ];
    engineGrid.innerHTML = rows.map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd class="' + r[2] + '">' + escapeHtml(r[1]) + "</dd></div>";
    }).join("");
  }

  /* ---------------- run ---------------- */
  let running = false;
  async function run() {
    if (running) return;
    const raw = input.value.trim();
    if (!raw) {
      input.focus();
      input.placeholder = "Paste a message first \u2014 or try a sample above.";
      return;
    }

    running = true;
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyzing\u2026";

    const { redactedText } = window.Redactor.redact(raw);
    const started = performance.now();

    window.PipelineController.setStage(0);
    await wait(180);
    window.PipelineController.setStage(1);

    try {
      const result = await window.ApiClient.analyze(redactedText, channel);
      window.PipelineController.setStage(2);
      await wait(160);
      window.PipelineController.setStage(3);
      await wait(180);
      render(result);
      probeBackend();
    } catch (err) {
      explanation.textContent = "Analysis failed: " + err.message;
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyze message";
      running = false;
      connPill.title = "Last analysis round trip: " +
        Math.round(performance.now() - started) + " ms";
    }
  }

  analyzeBtn.addEventListener("click", run);
  input.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      run();
    }
  });

  setChannel("email");
  updateRedaction("");
  window.PipelineController.reset();
});
