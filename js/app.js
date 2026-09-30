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

  function parseRawHeaders(raw) {
    if (!raw || typeof raw !== "string") return {};
    const auth = {};
    const fromMatch = raw.match(/^From:\s*.*?@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/mi) || raw.match(/header\.from=([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (fromMatch) auth.fromDomain = fromMatch[1].toLowerCase();

    const dkimMatch = raw.match(/\bd=([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) || raw.match(/header\.d=([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (dkimMatch) auth.signedBy = dkimMatch[1].toLowerCase();

    const spfMatch = raw.match(/smtp\.mailfrom=([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i) || raw.match(/mailed-by[:\s]+([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
    if (spfMatch) auth.mailedBy = spfMatch[1].toLowerCase();

    const dmarcMatch = raw.match(/\bdmarc=([a-zA-Z]+)/i);
    if (dmarcMatch) auth.dmarc = dmarcMatch[1].toLowerCase();

    return auth;
  }

  // 5. Main Analysis Pipeline Execution
  async function runAnalysisPipeline() {
    const rawText = textarea.value.trim();
    if (!rawText) {
      alert("Please paste a message or select a sample preset first.");
      return;
    }

    // Extract auth parameters if provided
    const authFromDomain = document.getElementById("auth-from-domain")?.value?.trim();
    const authMailedBy = document.getElementById("auth-mailed-by")?.value?.trim();
    const authSignedBy = document.getElementById("auth-signed-by")?.value?.trim();
    const authRawHeaders = document.getElementById("auth-raw-headers")?.value?.trim();

    let authPayload = null;
    if (authRawHeaders) {
      const parsed = parseRawHeaders(authRawHeaders);
      authPayload = { ...parsed };
    }
    if (authFromDomain) authPayload = { ...(authPayload || {}), fromDomain: authFromDomain };
    if (authMailedBy) authPayload = { ...(authPayload || {}), mailedBy: authMailedBy };
    if (authSignedBy) authPayload = { ...(authPayload || {}), signedBy: authSignedBy };

    // Ensure latest redaction pass
    const { redactedText, stats } = window.Redactor.redact(rawText);

    // Stage 1: Observe (0.2s)
    window.PipelineController.animatePipeline(0);

    setTimeout(async () => {
      // Stage 2: Detect (0.4s)
      window.PipelineController.animatePipeline(1);

      // Call API
      const result = await window.ApiClient.analyze(redactedText, currentChannel, stats, authPayload);

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

    // Auth Status Badge
    const authStatus = result.engine?.auth_status || result.auth?.status;
    const authBadgeElem = document.getElementById("auth-status-badge");
    if (authBadgeElem) {
      if (authStatus === "spoof") {
        authBadgeElem.style.display = "inline-block";
        authBadgeElem.className = "auth-badge auth-badge-spoof";
        authBadgeElem.textContent = "[ ⚠️ SPOOF: DKIM MISMATCH ]";
      } else if (authStatus === "verified") {
        authBadgeElem.style.display = "inline-block";
        authBadgeElem.className = "auth-badge auth-badge-verified";
        authBadgeElem.textContent = "[ 🔒 AUTH: VERIFIED ]";
      } else if (authStatus === "unverified" && result.auth) {
        authBadgeElem.style.display = "inline-block";
        authBadgeElem.className = "auth-badge auth-badge-unverified";
        authBadgeElem.textContent = "[ AUTH: UNVERIFIED ]";
      } else {
        authBadgeElem.style.display = "none";
      }
    }

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

  // 8. Safe Peek Link Tracer Handler
  const safePeekUrlInput = document.getElementById("safe-peek-url");
  const safePeekBtn = document.getElementById("btn-safe-peek");
  const safePeekOutput = document.getElementById("safe-peek-output");

  safePeekBtn?.addEventListener("click", async () => {
    const rawUrl = safePeekUrlInput?.value?.trim();
    if (!rawUrl) return;

    safePeekBtn.disabled = true;
    safePeekBtn.textContent = "Tracing...";
    safePeekOutput.style.display = "block";
    safePeekOutput.innerHTML = "<em>Initiating zero-execution HEAD redirect inspection...</em>";

    try {
      const res = await window.ApiClient.unmask(rawUrl);
      let hopsHtml = `<div style="margin-bottom:8px;font-weight:800;">[ TRACE RESULTS: ${res.hops} HOP(S) ]</div>`;

      (res.chain || []).forEach((hop) => {
        const statusClass = hop.status >= 300 && hop.status < 400 ? "#E8720C" : hop.status === 200 ? "#8A8B5C" : "#EA3E2B";
        hopsHtml += `
          <div class="safe-peek-hop">
            <span class="safe-peek-status" style="color:${statusClass};">[${hop.status || "ERR"}]</span>
            <span>${hop.url}</span>
            ${hop.redirectsTo ? ` &rarr; <span class="safe-peek-dest">${hop.redirectsTo}</span>` : ""}
            ${hop.error ? ` <span style="color:#EA3E2B;">(${hop.error})</span>` : ""}
          </div>
        `;
      });

      const riskColor = res.risk?.verdict === "high_risk" ? "#EA3E2B" : res.risk?.verdict === "suspicious" ? "#E8720C" : "#8A8B5C";
      hopsHtml += `
        <div class="safe-peek-risk" style="color:${riskColor};">
          FINAL DESTINATION: ${res.finalDomain || res.finalUrl} &mdash; [ ${res.risk?.verdict?.toUpperCase() || 'SAFE'} (SCORE ${res.risk?.score || 0}/100) ]
        </div>
      `;

      if (res.risk?.flags && res.risk.flags.length > 0) {
        hopsHtml += `<div style="margin-top:6px;font-size:0.75rem;color:var(--color-ink);">` +
          res.risk.flags.map(f => `&bull; ${f.span}: ${f.reason}`).join("<br>") +
          `</div>`;
      }

      safePeekOutput.innerHTML = hopsHtml;
    } catch (err) {
      safePeekOutput.innerHTML = `<span style="color:#EA3E2B;font-weight:700;">Trace Failed:</span> ${err.message}`;
    } finally {
      safePeekBtn.disabled = false;
      safePeekBtn.textContent = "Trace link";
    }
  });
});
