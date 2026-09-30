/**
 * Ratio'd Gmail Content Script
 * Direct HTTP analysis & client-side engine with zero chrome.runtime calls.
 * IMPOSSIBLE for Chrome to throw 'Extension context invalidated' errors.
 */

function redactPiiLocally(text) {
  if (!text) return "";

  // Phone regex
  const phoneRegex = /(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g;
  let redacted = text.replace(phoneRegex, "[PHONE_REDACTED]");

  // Email regex
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  redacted = redacted.replace(emailRegex, "[EMAIL_REDACTED]");

  // OTP regex
  const otpRegex = /\b(OTP|code|passcode|PIN)?\s?:?\s?(\d{4,8})\b/gi;
  redacted = redacted.replace(otpRegex, (match, prefix, digits) => {
    return (prefix ? prefix + " " : "") + "[OTP_REDACTED]";
  });

  return redacted;
}

let lastAnalyzedHash = null;

function renderFallbackAnalysis(emailBodyElem, redactedText) {
  if (!emailBodyElem) return;

  // The offline engine (fallback-engine.js) implements the same signal
  // families as the server, so a degraded connection still surfaces
  // inheritance lures, hosted lookalikes, Reply-To redirects and
  // mixed-script homoglyphs rather than reading everything as safe.
  if (window.RatiodFallback) {
    const result = window.RatiodFallback.analyze(redactedText);
    if (window.injectRatiodBanner) window.injectRatiodBanner(emailBodyElem, result);
    return;
  }

  // Last-ditch path if even the fallback engine failed to load.
  const phonesMatch = redactedText.match(/\[PHONE_REDACTED\]/g);
  const emailsMatch = redactedText.match(/\[EMAIL_REDACTED\]/g);

  const lower = redactedText.toLowerCase();
  const isSuspicious = lower.includes("urgent") || 
                       lower.includes("suspended") ||
                       lower.includes("verify") ||
                       lower.includes("paypa1") ||
                       lower.includes("bit.ly") ||
                       lower.includes("unsubscribe") ||
                       lower.includes("noreply@");

  const fallbackData = {
    score: isSuspicious ? 75 : 12,
    verdict: isSuspicious ? "high_risk" : "safe",
    flags: isSuspicious ? [
      { span: "promotional / verification signal", reason: "Potential security or marketing pattern", type: "rule" }
    ] : [],
    explanation: isSuspicious 
      ? "HIGH RISK / SPAM DETECTED: This message contains promotional or credential verification signals."
      : "LOW RISK: No explicit threat indicators found.",
    next_steps: [
      "Verify sender address independently.",
      "Never enter passwords or OTPs on unverified links."
    ],
    privacy: {
      phones_masked: phonesMatch ? phonesMatch.length : 0,
      emails_masked: emailsMatch ? emailsMatch.length : 0,
      otp_masked: 0
    }
  };

  if (window.injectRatiodBanner) {
    window.injectRatiodBanner(emailBodyElem, fallbackData);
  }
}

function scanAndAnalyzeGmail() {
  const emailBodyElem = document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  
  if (!emailBodyElem) return;

  const messageText = emailBodyElem.innerText || "";
  if (messageText.length < 5) return;

  const currentHash = messageText.substring(0, 100) + messageText.length;
  if (lastAnalyzedHash === currentHash) return;

  lastAnalyzedHash = currentHash;

  // 1. Client-Side Local PII Redaction
  const redactedText = redactPiiLocally(messageText);

  // 2. Direct fetch to local security backend (http://127.0.0.1:3000/analyze)
  fetch("http://127.0.0.1:3000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: redactedText, channel: "email" })
  })
    .then(res => res.json())
    .then(data => {
      if (window.injectRatiodBanner) {
        window.injectRatiodBanner(emailBodyElem, data);
      }
    })
    .catch(() => {
      // Fallback 1: Try Vercel deployed backend endpoint
      fetch("https://ratio-d.vercel.app/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: redactedText, channel: "email" })
      })
        .then(res => res.json())
        .then(data => {
          if (window.injectRatiodBanner) {
            window.injectRatiodBanner(emailBodyElem, data);
          }
        })
        .catch(() => {
          // Fallback 2: Client-side local fallback engine
          renderFallbackAnalysis(emailBodyElem, redactedText);
        });
    });
}

/**
 * Proactive Pre-Open Gmail Inbox Badging
 * Inspects inbox table rows before the user opens them, runs fast in-memory
 * heuristic inspection, and injects a non-intrusive status pill badge.
 */
function scanInboxRows() {
  if (!window.RatiodFallback) return;

  const rows = document.querySelectorAll(
    "tr.zA:not([data-ratiod-badged]), div[role='row']:not([data-ratiod-badged])"
  );
  if (!rows || rows.length === 0) return;

  rows.forEach((row) => {
    row.setAttribute("data-ratiod-badged", "true");

    const senderElem = row.querySelector(".yX, .bqe, .zF, span[email]");
    const subjectElem = row.querySelector(".y6, .bog, span.bqe");
    const snippetElem = row.querySelector(".y2");

    const sender = senderElem ? (senderElem.getAttribute("email") || senderElem.innerText || "") : "";
    const subject = subjectElem ? subjectElem.innerText : "";
    const snippet = snippetElem ? snippetElem.innerText : "";

    const combinedText = `From: ${sender}\nSubject: ${subject}\n${snippet}`.trim();
    if (combinedText.length < 5) return;

    // Fast in-memory heuristic analysis
    const redacted = redactPiiLocally(combinedText);
    const result = window.RatiodFallback.analyze(redacted);

    // Only inject badge if container exists
    const targetMount = subjectElem || row.querySelector("td.xY, div.xY") || row;
    if (!targetMount) return;

    const badge = document.createElement("span");
    badge.className = "ratiod-inbox-pill";
    badge.setAttribute("data-verdict", result.verdict);
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-label", `Ratio'd Risk: ${result.score}/100 (${result.verdict})`);

    let labelText = "";
    let bgColor = "#8A8B5C"; // safe olive
    let textColor = "#FFFFFF";

    if (result.verdict === "high_risk") {
      labelText = `[ 🔴 RISK ${result.score} ]`;
      bgColor = "#EA3E2B";
    } else if (result.verdict === "suspicious") {
      labelText = `[ 🟠 SUSP ${result.score} ]`;
      bgColor = "#E8720C";
    } else if (result.verdict === "promo_clutter") {
      labelText = `[ 🟡 PROMO ]`;
      bgColor = "#FFD23F";
      textColor = "#121212";
    } else {
      labelText = `[ 🟢 SAFE ]`;
      bgColor = "#8A8B5C";
    }

    badge.innerText = labelText;
    const flagSummary = (result.flags || []).map(f => '• ' + f.span + ': ' + f.reason).join('\n');
    badge.title = `Ratio'd Pre-Open Analysis: ${result.score}/100 (${result.verdict})\n${flagSummary || 'Clean preview'}`;

    badge.style.cssText = `
      display: inline-block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.2;
      padding: 1px 5px;
      margin-right: 6px;
      margin-left: 2px;
      border-radius: 4px;
      border: 1.5px solid #121212;
      background-color: ${bgColor};
      color: ${textColor};
      cursor: help;
      vertical-align: middle;
      box-shadow: 1px 1px 0px #121212;
      user-select: none;
    `;

    if (subjectElem && subjectElem.parentNode) {
      subjectElem.parentNode.insertBefore(badge, subjectElem);
    } else {
      targetMount.prepend(badge);
    }
  });
}

// Observe Gmail DOM mutation for opened messages and inbox lists
const observer = new MutationObserver(() => {
  scanAndAnalyzeGmail();
  scanInboxRows();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Periodic check every 1 second
setInterval(() => {
  scanAndAnalyzeGmail();
  scanInboxRows();
}, 1000);
