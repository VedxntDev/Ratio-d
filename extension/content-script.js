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

// Observe Gmail DOM mutation
const observer = new MutationObserver(() => {
  scanAndAnalyzeGmail();
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Periodic check every 1 second
setInterval(scanAndAnalyzeGmail, 1000);
