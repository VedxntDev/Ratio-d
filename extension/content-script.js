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
    "tr.zA:not([data-ratiod-badged])"
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

    // Category & marketing awareness: detect Promotions view or marketing language
    const isPromotionsView = !!document.querySelector('[role="tab"][aria-selected="true"][aria-label*="Promotion"], [role="tab"][aria-selected="true"][data-tooltip*="Promotion"]') ||
                             (window.location.hash && window.location.hash.includes("category/promotions"));
    const promoKeywords = /\b(unsubscribe|%\s*off|discount|sale\b|exclusive\s+offer|deals?|coupon|promo|limited\s+time|webinar|announcing|newsletter|special\s+offer|rewards?\s*(points|expire)|free\s+gift|clearance)\b/i;

    let verdict = result.verdict;
    let score = result.score;
    if (verdict === "safe" && (isPromotionsView || promoKeywords.test(combinedText))) {
      verdict = "promo_clutter";
      score = Math.max(score, 25);
    }

    // Target container: prefer span.bog (inline subject text) so badge sits on the same line
    const subjectWrapper = row.querySelector("span.bog") || row.querySelector(".y6") || row.querySelector("span.bqe") || row.querySelector("td.xY:not(.yX)") || subjectElem;
    if (!subjectWrapper) return;

    const badge = document.createElement("span");
    badge.className = "ratiod-inbox-pill";
    badge.setAttribute("data-verdict", verdict);
    badge.setAttribute("role", "status");
    badge.setAttribute("aria-label", `Ratio'd Risk: ${score}/100 (${verdict})`);

    let labelText = "";
    // Website Neo-Brutalist Palette:
    // Green: #9BE86D, Yellow: #FFD23F, Orange: #E8720C, Red: #EA3E2B, Ink: #121212
    let bgColor = "#9BE86D";
    let textColor = "#121212";

    if (verdict === "high_risk") {
      labelText = `[ 🔴 RISK ${score} ]`;
      bgColor = "#EA3E2B";
      textColor = "#FFFFFF";
    } else if (verdict === "suspicious") {
      labelText = `[ 🟠 SUSP ${score} ]`;
      bgColor = "#E8720C";
      textColor = "#FFFFFF";
    } else if (verdict === "promo_clutter") {
      labelText = `[ 🟡 PROMO ]`;
      bgColor = "#FFD23F";
      textColor = "#121212";
    } else {
      labelText = `[ 🟢 SAFE ]`;
      bgColor = "#9BE86D";
      textColor = "#121212";
    }

    badge.innerText = labelText;
    const flagSummary = (result.flags || []).map(f => '• ' + f.span + ': ' + f.reason).join('\n');
    badge.title = `Ratio'd Pre-Open Analysis: ${score}/100 (${verdict})\n${flagSummary || 'Clean preview'}`;

    badge.style.cssText = `
      display: inline-block;
      vertical-align: middle;
      font-family: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
      font-size: 10px;
      font-weight: 800;
      line-height: 14px;
      letter-spacing: 0.02em;
      padding: 1px 6px;
      margin-right: 6px;
      border-radius: 4px;
      border: 1.5px solid #121212;
      background-color: ${bgColor};
      color: ${textColor};
      cursor: help;
      box-shadow: 1.5px 1.5px 0px #121212;
      user-select: none;
      white-space: nowrap;
      flex-shrink: 0;
      z-index: 5;
    `;

    if (subjectWrapper.prepend) {
      subjectWrapper.prepend(badge);
    } else if (subjectWrapper.parentNode) {
      subjectWrapper.parentNode.insertBefore(badge, subjectWrapper);
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
