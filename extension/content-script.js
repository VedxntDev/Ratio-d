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
  const otpRegex = /\b(OTP|code|passcode|PIN)\b(?:\s+(?:is|was|:|-))?\s*:?\s*(\d{4,8})\b/gi;
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

// Shared verdict cache to eliminate any mismatch between open-email banner and inbox badge
const VERDICT_CACHE_KEY = "ratiod_verdict_cache_v3";
const memVerdictCache = {};

/**
 * Normalise a subject into a stable cache key.
 *
 * This function is the entire reason the badge and the banner used to disagree.
 * The banner saves its verdict under the OPEN-MESSAGE header subject
 * (`h2.hP`) while the inbox row looks it up under the LIST-ROW subject
 * (`span.bog`). Gmail truncates those two to different lengths and appends an
 * ellipsis, so the keys never matched, `cachedVerdict` was always null, and
 * every Spam row fell through to a hardcoded badge - showing a red RISK pill
 * beside a green SAFE banner for the same message.
 *
 * Gmail's own ellipsis is stripped and the remainder is truncated to a fixed
 * width, so both sides derive the same key from the same visible prefix.
 *
 * The width is 40 rather than "as much as possible" on purpose. Gmail truncates
 * the row subject at roughly 50-70 visible characters depending on viewport, so
 * a longer key would stop being a shared prefix on a narrow window and the keys
 * would diverge again. 40 sits comfortably inside that range while staying long
 * enough to keep unrelated subjects apart.
 */
function normalizeSubjectKey(value) {
  return String(value == null ? "" : value)
    .replace(/[\u2026\u0085]/g, "...")   // … -> ...
    .replace(/\.{2,}\s*$/g, "")          // trailing ellipsis
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 40);
}

function getVerdictCache() {
  try {
    const raw = sessionStorage.getItem(VERDICT_CACHE_KEY);
    return raw ? Object.assign({}, memVerdictCache, JSON.parse(raw)) : Object.assign({}, memVerdictCache);
  } catch (e) {
    return Object.assign({}, memVerdictCache);
  }
}

function saveVerdictToCache(key, data) {
  if (!key || !data) return;
  try {
    const cleanKey = normalizeSubjectKey(key);
    if (!cleanKey) return;
    const entry = {
      verdict: data.verdict,
      score: data.score !== undefined ? data.score : 0,
      flags: (data.flags || []).slice()
    };
    memVerdictCache[cleanKey] = entry;

    const cache = getVerdictCache();
    cache[cleanKey] = entry;
    // Cap cache to 250 items
    const keys = Object.keys(cache);
    if (keys.length > 250) {
      delete cache[keys[0]];
    }
    sessionStorage.setItem(VERDICT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

function getCachedVerdict(key) {
  if (!key) return null;
  const cleanKey = normalizeSubjectKey(key);
  if (!cleanKey) return null;
  if (memVerdictCache[cleanKey]) return memVerdictCache[cleanKey];
  const cache = getVerdictCache();
  return cache[cleanKey] || null;
}

function updateBadgeElement(badge, verdict, score, flags) {
  badge.setAttribute("data-verdict", verdict);
  badge.setAttribute("data-score", String(score));
  badge.setAttribute("role", "status");
  badge.setAttribute("aria-label", `Ratio'd Risk: ${score}/100 (${verdict})`);

  let labelText = "";
  let bgColor = "#9BE86D"; // Website Neo-Brutalist Green
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
  const flagSummary = (flags || []).map(f => '• ' + f.span + ': ' + f.reason).join('\n');
  badge.title = `Ratio'd Risk: ${score}/100 (${verdict})\n${flagSummary || 'Clean preview'}`;

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
}

function extractGmailAuthDetails(messageContainer) {
  let fromDomain = null;
  let mailedBy = null;
  let signedBy = null;

  try {
    const senderElem = document.querySelector(".gE.iv.gt span[email], .gD[email], .go");
    const senderEmail = senderElem ? (senderElem.getAttribute("email") || senderElem.innerText.trim()) : "";
    if (senderEmail && senderEmail.includes("@")) {
      fromDomain = senderEmail.split("@").pop().replace(/[>\]\s]/g, "").toLowerCase().trim();
    }

    const mailedByElem = document.querySelector(".amG, [aria-label*='mailed-by' i], [data-tooltip*='mailed-by' i]");
    if (mailedByElem) {
      mailedBy = (mailedByElem.innerText || mailedByElem.getAttribute("aria-label") || "").trim().toLowerCase();
    }

    const signedByElem = document.querySelector(".amq, [aria-label*='signed-by' i], [data-tooltip*='signed-by' i]");
    if (signedByElem) {
      signedBy = (signedByElem.innerText || signedByElem.getAttribute("aria-label") || "").trim().toLowerCase();
    }

    // Fallback: search across table rows in header details card if open
    if (!mailedBy || !signedBy) {
      const detailRows = document.querySelectorAll(".ajy tr, .g3 tr, table.cf tr");
      detailRows.forEach(row => {
        const text = (row.innerText || "").toLowerCase();
        if (!mailedBy && text.includes("mailed-by:")) {
          const m = text.match(/mailed-by:\s*([a-zA-Z0-9.-]+)/i);
          if (m) mailedBy = m[1].toLowerCase().trim();
        }
        if (!signedBy && text.includes("signed-by:")) {
          const m = text.match(/signed-by:\s*([a-zA-Z0-9.-]+)/i);
          if (m) signedBy = m[1].toLowerCase().trim();
        }
      });
    }

    if (mailedBy) mailedBy = mailedBy.replace(/^mailed-by:\s*/i, "").replace(/[<>]/g, "").trim();
    if (signedBy) signedBy = signedBy.replace(/^signed-by:\s*/i, "").replace(/[<>]/g, "").trim();
  } catch (e) {}

  return {
    fromDomain: fromDomain || null,
    mailedBy: mailedBy || null,
    signedBy: signedBy || null
  };
}

function fetchWithTimeout(url, options, timeoutMs = 600) {
  if (typeof AbortController === "undefined") {
    return fetch(url, options);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function extractGmailSender(container) {
  let senderAddress = "";
  let senderName = "";

  const root = container ? (container.closest(".gs, .adn, [role='main']") || document) : document;

  // Primary selector: span.gD contains the display name and 'email' attribute
  const gdElem = root.querySelector("span.gD, .gE.iv.gt span[email], span[email]");
  if (gdElem) {
    senderAddress = gdElem.getAttribute("email") || "";
    senderName = (gdElem.innerText || gdElem.textContent || "").trim();
  }

  // Fallback for address: span.go or hovercard
  if (!senderAddress) {
    const fallbackElem = root.querySelector("span.go, span[data-hovercard-id], .go");
    if (fallbackElem) {
      senderAddress = fallbackElem.getAttribute("email") ||
                      fallbackElem.getAttribute("data-hovercard-id") ||
                      (fallbackElem.innerText || fallbackElem.textContent || "").replace(/[<>]/g, "").trim();
    }
  }

  if (senderAddress && senderAddress.includes("<")) {
    const m = senderAddress.match(/<([^>]+)>/);
    if (m) senderAddress = m[1].trim();
  }

  if (!senderName || senderName === senderAddress) {
    const nameElem = root.querySelector("span.gD, .zF, .qu");
    if (nameElem) {
      const candidate = (nameElem.getAttribute("name") || nameElem.innerText || nameElem.textContent || "").trim();
      if (candidate && candidate !== senderAddress) {
        senderName = candidate;
      }
    }
  }

  return {
    senderAddress: senderAddress.trim(),
    senderName: senderName.trim()
  };
}

function scanAndAnalyzeGmail() {
  const emailBodyElem = document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  
  if (!emailBodyElem) return;

  const rawBodyText = emailBodyElem.innerText || "";
  if (rawBodyText.length < 5) return;

  // Extract Subject and Sender from open email header
  const subjectElem = document.querySelector("h2.hP, .ha h2");
  const subject = subjectElem ? subjectElem.innerText.trim() : "";

  const senderInfo = extractGmailSender(emailBodyElem);
  const senderAddress = senderInfo.senderAddress;
  const senderName = senderInfo.senderName;
  const senderHeader = senderName
    ? (senderAddress ? `${senderName} <${senderAddress}>` : senderName)
    : senderAddress;

  // Check if Gmail placed this in Spam or shows a quarantine warning
  const spamBanner = document.querySelector(".mE, .b8, div[role='alert'], .a2k");
  const isSpamLocation = (window.location.hash && window.location.hash.toLowerCase().includes("spam")) ||
                         (document.title && document.title.toLowerCase().includes("spam"));
  const spamWarning = spamBanner ? spamBanner.innerText.trim() : (isSpamLocation ? "Quarantined in Gmail Spam Folder" : "");

  let fullTextToAnalyze = "";
  if (spamWarning) fullTextToAnalyze += `Security Warning: ${spamWarning}\n`;
  if (senderHeader) fullTextToAnalyze += `From: ${senderHeader}\n`;
  if (subject) fullTextToAnalyze += `Subject: ${subject}\n\n`;
  fullTextToAnalyze += rawBodyText;

  const currentHash = fullTextToAnalyze.substring(0, 100) + fullTextToAnalyze.length;
  if (lastAnalyzedHash === currentHash) return;

  lastAnalyzedHash = currentHash;

  const onAnalysisComplete = (data) => {
    // 1. Inject in-email banner
    if (window.injectRatiodBanner) {
      window.injectRatiodBanner(emailBodyElem, data);
    }
    // 2. Persist authoritative verdict to cache (keyed by Subject and URL Thread)
    if (subject) {
      saveVerdictToCache(subject, data);
    }
    const currentHashKey = window.location.hash.replace(/^#/, "");
    if (currentHashKey) {
      saveVerdictToCache(currentHashKey, data);
    }
    // 3. Immediately refresh visible inbox badges to eliminate any mismatch
    scanInboxRows();
  };

  // 1. Client-Side Local PII Redaction
  const redactedText = redactPiiLocally(fullTextToAnalyze);

  // 2. Extract Header Authentication Details (SPF/DKIM/From)
  const authDetails = extractGmailAuthDetails(emailBodyElem);
  const authPayload = {
    fromDomain: authDetails.fromDomain || null,
    mailedBy: authDetails.mailedBy || null,
    signedBy: authDetails.signedBy || null
  };

  const payload = {
    text: redactedText,
    channel: "email",
    auth: authPayload,
    senderAddress: senderAddress || "",
    senderName: senderName || ""
  };

  // 3. Fast direct fetch to local security backend (http://127.0.0.1:3000/analyze) with 600ms timeout
  fetchWithTimeout("http://127.0.0.1:3000/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }, 600)
    .then(res => {
      if (!res.ok) throw new Error("Local HTTP " + res.status);
      return res.json();
    })
    .then(data => onAnalysisComplete(data))
    .catch(() => {
      // Fallback 1: Try Vercel deployed backend endpoint (1500ms timeout)
      fetchWithTimeout("https://ratio-d.vercel.app/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }, 1500)
        .then(res => {
          if (!res.ok) throw new Error("Vercel HTTP " + res.status);
          return res.json();
        })
        .then(data => onAnalysisComplete(data))
        .catch(() => {
          // Fallback 2: Client-side local fallback engine (instant 0ms)
          const fb = window.RatiodFallback ? window.RatiodFallback.analyze(redactedText, "email", authPayload) : {
            score: 12, verdict: "safe", flags: [], explanation: "Analyzed with offline heuristic.", next_steps: []
          };
          onAnalysisComplete(fb);
        });
    });
}

/**
 * Proactive Pre-Open Gmail Inbox Badging
 * Inspects all inbox rows, checks cache for authoritative deep analysis,
 * executes intelligent heuristics, and updates or injects badges seamlessly.
 */
function scanInboxRows() {
  if (!window.RatiodFallback) return;

  const rows = document.querySelectorAll("tr.zA");
  if (!rows || rows.length === 0) return;

  const isSpamView = (window.location.hash && window.location.hash.toLowerCase().includes("spam")) ||
                     (document.title && document.title.toLowerCase().includes("spam")) ||
                     !!document.querySelector('div[data-tooltip="Spam"][aria-selected="true"], a[href*="#spam"][aria-current="page"]');

  const isPromotionsView = !!document.querySelector('[role="tab"][aria-selected="true"][aria-label*="Promotion"], [role="tab"][aria-selected="true"][data-tooltip*="Promotion"]') ||
                           (window.location.hash && window.location.hash.includes("category/promotions"));

  rows.forEach((row) => {
    const senderElem = row.querySelector(".yX, .bqe, .zF, span[email], td.yX");
    const subjectElem = row.querySelector("span.bog, .bog, .y6, span.bqe");
    const snippetElem = row.querySelector(".y2");

    const sender = senderElem ? (senderElem.getAttribute("email") || senderElem.getAttribute("title") || senderElem.innerText || "") : "";
    const subject = subjectElem ? subjectElem.innerText.trim() : "";
    const snippet = snippetElem ? snippetElem.innerText.trim() : "";

    const combinedText = `From: ${sender}\nSubject: ${subject}\n${snippet}`.trim();

    // Check if authoritative deep-analysis result exists in cache for this subject!
    // Must go through normalizeSubjectKey: the banner saved this under the
    // open-message header subject, which Gmail truncates differently.
    const cacheKey = normalizeSubjectKey(subject);
    const cachedVerdict = cacheKey ? getCachedVerdict(subject) : null;

    // Fast-path: If row already processed and its text signature & cache state have not changed, skip!
    const rowSignature = `${combinedText}|${cachedVerdict ? cachedVerdict.verdict + cachedVerdict.score : 'none'}`;
    const existingBadge = row.querySelector(".ratiod-inbox-pill");
    if (existingBadge && row.getAttribute("data-ratiod-sig") === rowSignature) {
      return;
    }

    let verdict = "safe";
    let score = 0;
    let flags = [];

    if (cachedVerdict) {
      // 100% PARITY WITH BANNER: Authoritative result from in-depth open-email analysis
      verdict = cachedVerdict.verdict;
      score = cachedVerdict.score;
      flags = cachedVerdict.flags || [];
    } else if (isSpamView) {
      // Gmail quarantined this message. Previously this branch hardcoded
      // `score = 78; verdict = "high_risk"` and rendered a red "RISK 78" pill -
      // a fabricated measurement, identical on every row, which contradicted
      // the banner reading the same message.
      //
      // It is now honest about its provenance: the number is the real score
      // from analysing the row, and the badge says Gmail filtered it rather
      // than claiming phishing.
      const redactedSpamRow = redactPiiLocally(combinedText || "Email Message");
      const spamResult = window.RatiodFallback.analyze(redactedSpamRow);

      verdict = spamResult.verdict;
      score = spamResult.score;
      flags = (spamResult.flags || []).slice();

      // Being in Spam is evidence the mailbox distrusted the message, so the
      // row is floored out of "safe" - but it is a filter decision, not proof
      // of phishing, so it never escalates to high_risk on its own.
      if (verdict === "safe" || verdict === "promo_clutter") {
        verdict = "suspicious";
      }
      score = Math.max(score, 45);

      flags.unshift({
        span: "Quarantined in Spam",
        reason: "Gmail routed this message to the Spam folder before Ratio'd analysed it",
        type: "quarantine"
      });
    } else {
      // Run heuristic analysis on preview snippet
      const redacted = redactPiiLocally(combinedText || "Email Message");
      const result = window.RatiodFallback.analyze(redacted);
      verdict = result.verdict;
      score = result.score;
      flags = (result.flags || []).slice();

      // Detect urgent action / payment update bait in subject or snippet
      const isBillingUrgency = /(action (needed|required)|immediate attention|update (your )?(payment|billing|card|account)|billing (problem|issue)|overdue|suspended)/i.test(combinedText);
      if (isBillingUrgency) {
        if (score < 45) {
          score = 48;
          verdict = "suspicious";
        }
        flags.unshift({
          span: "Urgent Payment / Billing Demand",
          reason: "Message prompts immediate action regarding account billing or payment method"
        });
      }

      // Promotions / Marketing awareness
      const promoKeywords = /\b(unsubscribe|%\s*off|discount|sale\b|exclusive\s+offer|deals?|coupon|promo|limited\s+time|webinar|announcing|newsletter|special\s+offer|rewards?\s*(points|expire)|free\s+gift|clearance)\b/i;
      if (verdict === "safe" && (isPromotionsView || promoKeywords.test(combinedText))) {
        verdict = "promo_clutter";
        score = Math.max(score, 25);
      }
    }

    row.setAttribute("data-ratiod-sig", rowSignature);

    // Check if row already has a badge mounted
    if (existingBadge) {
      // Synchronize in place if deep analysis or cache updated verdict/score!
      const curVerdict = existingBadge.getAttribute("data-verdict");
      const curScore = existingBadge.getAttribute("data-score");
      if (curVerdict !== verdict || curScore !== String(score)) {
        updateBadgeElement(existingBadge, verdict, score, flags);
      }
      return;
    }

    // Target container: find the best insertion anchor across all Gmail DOM variations
    const target = row.querySelector("span.bog") ||
                   row.querySelector(".bog") ||
                   row.querySelector(".y6") ||
                   row.querySelector("span.bqe") ||
                   row.querySelector("td.xY") ||
                   row.querySelector("td.a4W") ||
                   row.querySelector("td");
    if (!target) return;

    const badge = document.createElement("span");
    badge.className = "ratiod-inbox-pill";
    updateBadgeElement(badge, verdict, score, flags);

    if (target.prepend) {
      target.prepend(badge);
    } else if (target.parentNode) {
      target.parentNode.insertBefore(badge, target);
    }
  });
}

// ---------------------------------------------------------------------------
// High-Performance Debounced Scheduler
// Replaces aggressive unthrottled MutationObserver execution with
// requestIdleCallback / requestAnimationFrame debouncing to guarantee 0 FPS lag.
// ---------------------------------------------------------------------------

let debounceTimer = null;

function scheduleScan(delay = 140) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        executeScanPass();
      }, { timeout: 250 });
    } else {
      window.requestAnimationFrame(() => {
        executeScanPass();
      });
    }
  }, delay);
}

function executeScanPass() {
  if (document.hidden) return;
  const isEmailOpen = !!document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  if (isEmailOpen) {
    scanAndAnalyzeGmail();
  }
  scanInboxRows();
}

// Observe Gmail DOM mutation with smart debounce to prevent UI thread lock
const observer = new MutationObserver((mutations) => {
  let hasRelevantMutations = false;
  for (let i = 0; i < mutations.length; i++) {
    const target = mutations[i].target;
    if (target && target.nodeType === 1) {
      // Ignore mutations within Ratio'd's own banner Shadow DOM or pills to avoid mutation feedback loops
      if (target.classList && (target.classList.contains("ratiod-shadow-host") || target.classList.contains("ratiod-inbox-pill"))) {
        continue;
      }
      hasRelevantMutations = true;
      break;
    }
  }
  if (hasRelevantMutations) {
    scheduleScan(150);
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

// React instantly to Gmail SPA view transitions without continuous polling
window.addEventListener("hashchange", () => scheduleScan(30), { passive: true });
window.addEventListener("popstate", () => scheduleScan(30), { passive: true });

// Low-overhead passive background heartbeat (every 5 seconds, only when tab is active)
setInterval(() => {
  if (!document.hidden) {
    scheduleScan(0);
  }
}, 5000);

// Initial scan
scheduleScan(100);

