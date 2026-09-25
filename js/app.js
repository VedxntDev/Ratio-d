/**
 * Ratio'd Core Web Application Orchestrator
 */

document.addEventListener("DOMContentLoaded", () => {
  const textarea = document.getElementById("telemetry-input");
  const analyzeBtn = document.getElementById("btn-analyze");
  const clearBtn = document.getElementById("btn-clear");
  const channelSMSBtn = document.getElementById("tab-sms");
  const channelEmailBtn = document.getElementById("tab-email");

  const privacyText = document.getElementById("privacy-counts");
  const systemStatusBanner = document.getElementById("status-banner-text");

  const inspectorBox = document.getElementById("threat-inspector");
  const explanationBox = document.getElementById("verdict-explanation");
  const verdictBadge = document.getElementById("verdict-badge");
  const checklistList = document.getElementById("checklist-items");

  let currentChannel = "email";
  let activeRedactedText = "";
  let activePrivacyStats = { phones_masked: 0, emails_masked: 0, otp_masked: 0, total_masked: 0 };

  // 1. Channel Switch Handler
  // The channel selector now lives inside the telemetry pane rather than the
  // site header, so both buttons can legitimately be absent (e.g. a build that
  // drops the console). Every touch below is therefore optional-chained.
  function setChannel(channel) {
    currentChannel = channel;
    const isSms = channel === "sms";
    channelSMSBtn?.classList.toggle("active", isSms);
    channelEmailBtn?.classList.toggle("active", !isSms);
    if (!textarea) return;
    textarea.placeholder = isSms
      ? "Paste raw SMS message text here..."
      : "Paste email header, subject line, and body text here...";
  }

  channelSMSBtn?.addEventListener("click", () => setChannel("sms"));
  channelEmailBtn?.addEventListener("click", () => setChannel("email"));

  // 2. Real-time PII Redaction Input Listener
  textarea?.addEventListener("input", () => {
    const rawText = textarea.value;
    const { redactedText, stats } = window.Redactor.redact(rawText);
    activeRedactedText = redactedText;
    activePrivacyStats = stats;

    if (privacyText) {
      if (stats.total_masked > 0) {
        privacyText.innerHTML = `<strong>&#10003; REAL-TIME PII REDACTION:</strong> ${stats.phones_masked} phone(s), ${stats.emails_masked} email(s), ${stats.otp_masked} OTP code(s) masked.`;
      } else {
        privacyText.textContent = "✓ Real-time PII redaction active: No sensitive phone, email, or OTP patterns found.";
      }
    }

    if (systemStatusBanner && stats.total_masked > 0) {
      systemStatusBanner.textContent = `[ SYSTEM ALERT: ${stats.total_masked} PII ITEM(S) REDACTED IN BROWSER MEMORY ]`;
    }
  });

  // 3. Preset Loaders
  function loadPhishingPreset() {
    setChannel(window.Presets.phishingEmail.channel);
    textarea.value = window.Presets.phishingEmail.text;
    textarea.dispatchEvent(new Event("input"));
  }

  document.getElementById("preset-phishing")?.addEventListener("click", loadPhishingPreset);
  document.getElementById("hero-preset-phishing")?.addEventListener("click", () => {
    loadPhishingPreset();
    document.getElementById("console")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  document.getElementById("preset-sms")?.addEventListener("click", () => {
    setChannel(window.Presets.urgentSms.channel);
    textarea.value = window.Presets.urgentSms.text;
    textarea.dispatchEvent(new Event("input"));
  });

  document.getElementById("preset-legit")?.addEventListener("click", () => {
    setChannel(window.Presets.legitimateNotice.channel);
    textarea.value = window.Presets.legitimateNotice.text;
    textarea.dispatchEvent(new Event("input"));
  });

  clearBtn?.addEventListener("click", () => {
    textarea.value = "";
    textarea.dispatchEvent(new Event("input"));
    inspectorBox.innerHTML = '<span class="placeholder-text">Paste a message and click Analyze to view the threat breakdown.</span>';
    explanationBox.textContent = "Awaiting message payload analysis...";
    verdictBadge.className = "verdict-badge verdict-safe";
    verdictBadge.textContent = "[ VERDICT · READY ]";
    checklistList.innerHTML = '<li><span class="check-bullet">•</span> Awaiting threat analysis report.</li>';
    window.PipelineController.animateGaugeArc(0, "safe");
  });

  // 4. Keyboard Hotkey (Cmd/Ctrl + Enter)
  textarea?.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      runAnalysisPipeline();
    }
  });

  analyzeBtn?.addEventListener("click", runAnalysisPipeline);

  // 5. Main Analysis Pipeline Execution
  async function runAnalysisPipeline() {
    const rawText = textarea.value.trim();
    if (!rawText) {
      alert("Please paste a message or select a sample preset first.");
      return;
    }

    // Ensure latest redaction pass
    const { redactedText, stats } = window.Redactor.redact(rawText);

    // Stage 1: Observe (0.2s)
    window.PipelineController.animatePipeline(0);

    setTimeout(async () => {
      // Stage 2: Detect (0.4s)
      window.PipelineController.animatePipeline(1);

      // Call API
      const result = await window.ApiClient.analyze(redactedText, currentChannel, stats);

      // Stage 3: Explain (0.6s)
      window.PipelineController.animatePipeline(2);
      renderThreatInspector(rawText, result.flags);

      // Stage 4: Respond (0.8s)
      window.PipelineController.animatePipeline(3, () => {
        renderVerdictAndChecklist(result);
      });
    }, 400);
  }

  // 6. Highlighted Threat Inspector Renderer
  function renderThreatInspector(originalText, flags) {
    if (!flags || flags.length === 0) {
      inspectorBox.textContent = originalText;
      return;
    }

    let htmlText = originalText;
    // Highlight matched spans in order of length descending to avoid partial tag replace issues
    const sortedFlags = [...flags].sort((a, b) => b.span.length - a.span.length);

    sortedFlags.forEach((flag) => {
      if (flag.span && flag.span.length > 2) {
        const regex = new RegExp(escapeRegExp(flag.span), "gi");
        htmlText = htmlText.replace(regex, (match) => {
          return `<span class="highlighted-flag" title="${flag.reason}">${match}</span>`;
        });
      }
    });

    inspectorBox.innerHTML = htmlText;
  }

  // Helper escape regex
  function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // 7. Render Verdict, Score Gauge & Checklist
  function renderVerdictAndChecklist(result) {
    const score = result.score || 0;
    const verdict = result.verdict || "safe";
    const explanation = result.explanation || "Analysis complete.";
    const steps = result.next_steps || [];

    // Verdict Badge
    verdictBadge.className = `verdict-badge verdict-${verdict}`;
    verdictBadge.textContent = `[ VERDICT · ${verdict.toUpperCase()} ]`;

    // Explanation Box
    explanationBox.textContent = explanation;

    // Animate Gauge Arc
    window.PipelineController.animateGaugeArc(score, verdict);

    // Checklist
    if (checklistList) {
      checklistList.innerHTML = steps.map(step => `
        <li><span class="check-bullet">&#10003;</span> <span>${step}</span></li>
      `).join('');
    }
  }
});
