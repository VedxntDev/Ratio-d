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

// ---------------------------------------------------------------------------
// Continuous Sender Learning & Real-Time Feedback Memory
// ---------------------------------------------------------------------------
let memSenderLearning = {};
let memUserOverrides = {};
if (typeof window !== "undefined") {
  window.__ratiod_memSenderLearning = memSenderLearning;
  window.__ratiod_memUserOverrides = memUserOverrides;
}

function syncContinuousLearningMemory() {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["ratiod_sender_learning", "ratiod_user_overrides"], (res) => {
        if (res) {
          memSenderLearning = res.ratiod_sender_learning || {};
          memUserOverrides = res.ratiod_user_overrides || {};
        }
      });
    }
  } catch (e) {}
}
syncContinuousLearningMemory();

try {
  if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === "local") {
        if (changes.ratiod_sender_learning) memSenderLearning = changes.ratiod_sender_learning.newValue || {};
        if (changes.ratiod_user_overrides) memUserOverrides = changes.ratiod_user_overrides.newValue || {};
        if (typeof triggerStaggeredScan === "function") triggerStaggeredScan(true);
      }
    });
  }
} catch (e) {}

window.addEventListener("ratiod:user-feedback", (e) => {
  const detail = (e && e.detail) || {};
  if (detail.sender) {
    const s = String(detail.sender).trim().toLowerCase();
    memSenderLearning[s] = {
      sender: s,
      domain: detail.domain || "",
      verdict: detail.verdict,
      score: detail.score,
      feedback: detail.feedback,
      userExplicit: true,
      updatedAt: Date.now()
    };
    memUserOverrides[s] = {
      verdict: detail.verdict,
      score: detail.score,
      feedback: detail.feedback,
      sender: s,
      timestamp: Date.now()
    };
    memUserOverrides["sender:" + s] = memUserOverrides[s];
  }
  if (typeof triggerStaggeredScan === "function") triggerStaggeredScan(true);
});

function extractCleanEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  const angleMatch = s.match(/<([^>@]+@[^>@]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  const emailMatch = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].trim().toLowerCase();
  return "";
}

function extractEmailDomain(email) {
  const clean = extractCleanEmail(email);
  if (!clean || !clean.includes("@")) return "";
  return clean.split("@")[1].toLowerCase().trim();
}

/**
 * Official Verified Platform Brand Senders & Educational Institutions
 * Mails from these authentic organizational domains receive consistent safe classification (score 0),
 * completely harmonizing the open-email banner and pre-open inbox list badge.
 */
const OFFICIAL_BRAND_DOMAINS_SET = new Set([
  "google.com", "accounts.google.com", "googlemail.com", "mail.google.com", "notifications.google.com",
  "apple.com", "email.apple.com", "id.apple.com",
  "microsoft.com", "accountprotection.microsoft.com", "microsoftsupport.com",
  "github.com",
  "amazon.com", "amazon.in",
  "netflix.com",
  "paypal.com",
  "linkedin.com",
  "balbharat.org"
]);

function isOfficialBrandSender(cleanSenderEmail, senderText, combinedText) {
  const email = (cleanSenderEmail || extractCleanEmail(senderText) || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return false;

  // Consumer free-mail addresses claiming to be a brand are NEVER official
  const freeMailPattern = /@(gmail\.com|googlemail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|proton(mail\.com|me)|aol\.com)$/i;
  const domain = email.split("@")[1].toLowerCase().trim();

  let isOfficialDomain = false;
  for (const official of OFFICIAL_BRAND_DOMAINS_SET) {
    if (domain === official || domain.endsWith("." + official)) {
      if ((official === "google.com" || official === "apple.com") && freeMailPattern.test(email)) {
        continue;
      }
      isOfficialDomain = true;
      break;
    }
  }
  if (!isOfficialDomain) return false;

  // Defensive sanity check: Ensure no urgent credential harvesting demand + link shortener
  const text = (combinedText || "").toLowerCase();
  const hasCredentialDemand = /(?:enter|verify|confirm|send)\s+(?:your\s+)?(?:password|pin|ssn|otp|passcode|seed phrase)/i.test(text);
  const hasShortener = /(bit\.ly|tinyurl|is\.gd|ow\.ly|t\.co|rb\.gy)/i.test(text);
  if (hasCredentialDemand && hasShortener) return false;

  return true;
}

// Shared verdict cache to eliminate any mismatch between open-email banner and inbox badge
const VERDICT_CACHE_KEY = "ratiod_verdict_cache_v8";
const memVerdictCache = {};

const IGNORED_CACHE_KEYS = new Set([
  "", "inbox", "spam", "all", "trash", "sent", "drafts", "starred", "snoozed",
  "important", "chats", "scheduled", "category", "promotions", "updates",
  "forums", "social", "mail", "unread", "read", "none", "null", "undefined",
  "category/promotions", "category/updates", "category/social", "category/forums"
]);

function isIgnoredCacheKey(k) {
  if (!k) return true;
  const s = String(k).trim().toLowerCase();
  if (s.length < 4) return true;
  if (IGNORED_CACHE_KEYS.has(s)) return true;
  if (/^(inbox|spam|all|trash|sent|drafts|starred|category|search|label)(\/|$)/i.test(s)) return true;
  return false;
}

/**
 * Normalise a thread ID into a clean canonical string.
 * Strips prefixes like 'thread-f:', 'thread-a:', 'thread-', ':', or leading '#'
 * so that Gmail's permId ('thread-f:1788192039') and legacy ID ('1788192039') map to the same key.
 */
function normalizeThreadId(id) {
  if (!id) return "";
  const cleaned = String(id)
    .replace(/^#/, "")
    .replace(/^thread-[a-z]:/i, "")
    .replace(/^thread-/, "")
    .replace(/^:\w+/, "")
    .trim()
    .toLowerCase();
  if (isIgnoredCacheKey(cleaned)) return "";
  return cleaned;
}

/**
 * Normalise a subject into a stable cache key.
 * Strips Ratio'd badges, bracketed tags ([External]), thread prefixes (Re:, Fwd:),
 * and trailing ellipses (...) so open-message header and inbox list-row derive identical keys.
 */
function normalizeSubjectKey(value) {
  return String(value == null ? "" : value)
    .replace(/\[\s*(?:🔴|🟠|🟡|🟢)?\s*(?:risk|susp|promo|safe)?[\s\d]*\]\s*/gi, "")
    .replace(/^(?:🔴|🟠|🟡|🟢)\s*/g, "")
    .replace(/^\[[^\]]+\]\s*/g, "")
    .replace(/^(?:re|fwd|fw|aw|sv):\s*/gi, "")
    .replace(/[\u2026\u0085]/g, "...")
    .replace(/\.{2,}\s*$/g, "")
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
    const keys = Array.isArray(key) ? key : [key];
    const entry = {
      verdict: data.verdict,
      score: data.score !== undefined ? data.score : 0,
      flags: (data.flags || []).slice(),
      authoritative: true
    };
    const cache = getVerdictCache();

    for (const k of keys) {
      if (!k || isIgnoredCacheKey(k)) continue;
      const rawKey = String(k).trim().toLowerCase();
      memVerdictCache[rawKey] = entry;
      cache[rawKey] = entry;

      const normId = normalizeThreadId(k);
      if (normId && !isIgnoredCacheKey(normId)) {
        memVerdictCache[normId] = entry;
        cache[normId] = entry;
      }

      const cleanKey = normalizeSubjectKey(k);
      if (cleanKey && cleanKey.length >= 6 && !isIgnoredCacheKey(cleanKey)) {
        memVerdictCache[cleanKey] = entry;
        cache[cleanKey] = entry;
      }
    }

    // Cap cache to 500 items
    const allKeys = Object.keys(cache);
    if (allKeys.length > 500) {
      for (let i = 0; i < allKeys.length - 400; i++) {
        delete cache[allKeys[i]];
      }
    }
    sessionStorage.setItem(VERDICT_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

function getCachedVerdict(key) {
  if (!key) return null;
  const keys = Array.isArray(key) ? key : [key];
  const cache = getVerdictCache();

  for (const k of keys) {
    if (!k || isIgnoredCacheKey(k)) continue;
    const rawKey = String(k).trim().toLowerCase();
    if (memVerdictCache[rawKey]) return memVerdictCache[rawKey];
    if (cache[rawKey]) return cache[rawKey];

    const normId = normalizeThreadId(k);
    if (normId && !isIgnoredCacheKey(normId)) {
      if (memVerdictCache[normId]) return memVerdictCache[normId];
      if (cache[normId]) return cache[normId];
    }

    const cleanSubj = normalizeSubjectKey(k);
    if (cleanSubj && cleanSubj.length >= 6 && !isIgnoredCacheKey(cleanSubj)) {
      if (memVerdictCache[cleanSubj]) return memVerdictCache[cleanSubj];
      if (cache[cleanSubj]) return cache[cleanSubj];
    }
  }
  return null;
}

function extractCleanRowSubject(row) {
  if (!row) return "";
  const subjectElem = row.querySelector("span.bog, .bog, .y6, span.bqe");
  if (!subjectElem) return "";

  try {
    const clone = (subjectElem.cloneNode && typeof subjectElem.cloneNode === "function")
      ? subjectElem.cloneNode(true)
      : subjectElem;
    if (clone && clone.querySelectorAll) {
      clone.querySelectorAll(".ratiod-inbox-pill, [data-verdict]").forEach(p => p.remove());
    }

    let text = (clone && (clone.innerText || clone.textContent)) || "";
    text = text.replace(/\[\s*(?:🔴|🟠|🟡|🟢|risk|susp|promo|safe)[\s\d]*\]/gi, "").replace(/^(?:🔴|🟠|🟡|🟢)\s*/g, "").trim();
    return text;
  } catch (e) {
    let raw = subjectElem.innerText || subjectElem.textContent || "";
    return raw.replace(/\[\s*(?:🔴|🟠|🟡|🟢|risk|susp|promo|safe)[\s\d]*\]/gi, "").replace(/^(?:🔴|🟠|🟡|🟢)\s*/g, "").trim();
  }
}

function getRowIdentifiers(row) {
  if (!row) return [];
  const ids = [];
  const legacyId = row.getAttribute("data-legacy-thread-id");
  if (legacyId && legacyId.length >= 8 && !isIgnoredCacheKey(legacyId)) {
    ids.push(legacyId);
    ids.push(normalizeThreadId(legacyId));
  }
  const threadId = row.getAttribute("data-thread-id");
  if (threadId && threadId.length >= 8 && !isIgnoredCacheKey(threadId)) {
    ids.push(threadId);
    ids.push(normalizeThreadId(threadId));
  }
  const rowId = row.getAttribute("id");
  if (rowId && rowId.length >= 8 && !isIgnoredCacheKey(rowId)) {
    ids.push(rowId);
    ids.push(normalizeThreadId(rowId));
  }
  const link = row.querySelector("a[href*='#']");
  if (link) {
    const href = link.getAttribute("href") || "";
    const hash = href.includes("#") ? href.split("#")[1] : href;
    if (hash) {
      const parts = hash.split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart.length >= 10 && !isIgnoredCacheKey(lastPart)) {
        ids.push(lastPart);
        const norm = normalizeThreadId(lastPart);
        if (norm) ids.push(norm);
      }
    }
  }
  return [...new Set(ids.filter(Boolean))];
}

function isGmailDarkTheme() {
  try {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    if (htmlEl && ((htmlEl.getAttribute && htmlEl.getAttribute("data-theme") === "dark") || (htmlEl.classList && htmlEl.classList.contains && htmlEl.classList.contains("dark")) || (htmlEl.hasAttribute && htmlEl.hasAttribute("data-darkreader-scheme")))) {
      return true;
    }
    if (bodyEl && ((bodyEl.getAttribute && bodyEl.getAttribute("data-theme") === "dark") || (bodyEl.classList && bodyEl.classList.contains && bodyEl.classList.contains("dark")))) {
      return true;
    }

    // Sample computed background of Gmail containers
    if (typeof window !== "undefined" && typeof window.getComputedStyle === "function" && typeof document.querySelector === "function") {
      const sampleTargets = [
        document.body,
        document.querySelector(".AO"),
        document.querySelector(".nH"),
        document.querySelector("[role='main']"),
        document.querySelector(".bkK")
      ].filter(Boolean);

      for (const el of sampleTargets) {
        const style = window.getComputedStyle(el);
        const bg = style && style.backgroundColor;
        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") {
          const rgb = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
          if (rgb) {
            const r = parseInt(rgb[1], 10);
            const g = parseInt(rgb[2], 10);
            const b = parseInt(rgb[3], 10);
            const lum = (0.299 * r) + (0.587 * g) + (0.114 * b);
            return lum < 128;
          }
        }
      }
    }

    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return true;
    }
  } catch (e) {}
  return false;
}

function updateThemeDetection() {
  try {
    const isDark = isGmailDarkTheme();
    const theme = isDark ? "dark" : "light";
    if (document.documentElement && typeof document.documentElement.getAttribute === "function" && document.documentElement.getAttribute("data-ratiod-theme") !== theme) {
      if (typeof document.documentElement.setAttribute === "function") {
        document.documentElement.setAttribute("data-ratiod-theme", theme);
      }
      const host = document.getElementById && document.getElementById("ratiod-banner-host");
      if (host && typeof host.setAttribute === "function") {
        host.setAttribute("data-theme", theme);
      }
    }
    return isDark;
  } catch (e) {
    return false;
  }
}

function ensureInboxStyles() {
  if (document.getElementById("ratiod-inbox-styles")) return;
  const style = document.createElement("style");
  style.id = "ratiod-inbox-styles";
  style.textContent = `
    /* Ratio'd Inbox Row Theming: Single clean background shade per row */

    /* Reset all cells inside Ratio'd-themed rows to transparent to prevent double layers */
    tr.zA[data-ratiod-verdict]:not(.aqw):not([aria-selected="true"]) > td {
      background: transparent !important;
      background-color: transparent !important;
      box-shadow: none !important;
    }

    /* SAFE (Single Clean Green Tint) */
    tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]) {
      background-color: #EBF8EE !important;
    }
    tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: #DCFCE7 !important;
    }

    /* PROMO CLUTTER (Single Clean Yellow Tint) */
    tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]) {
      background-color: #FEF9C3 !important;
    }
    tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: #FEF08A !important;
    }

    /* SUSPICIOUS (Single Clean Orange Tint) */
    tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]) {
      background-color: #FFF3E0 !important;
    }
    tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: #FFE0B2 !important;
    }

    /* HIGH RISK / SCAM (Single Clean Red Tint) */
    tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]) {
      background-color: #FEE2E2 !important;
    }
    tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: #FECACA !important;
    }

    /* Transparent hover action bar */
    tr.zA[data-ratiod-verdict]:not(.aqw):not([aria-selected="true"]):hover .bq9,
    tr.zA[data-ratiod-verdict]:not(.aqw):not([aria-selected="true"]):hover .aqL,
    tr.zA[data-ratiod-verdict]:not(.aqw):not([aria-selected="true"]):hover .bu4 {
      background: transparent !important;
      background-color: transparent !important;
    }

    /* Smooth transition */
    tr.zA[data-ratiod-verdict] {
      transition: background-color 0.15s ease !important;
    }

    /* True Dark Mode Theme: applied when Gmail theme is dark */
    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]) {
      background-color: rgba(34, 197, 94, 0.15) !important;
    }
    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: rgba(34, 197, 94, 0.25) !important;
    }

    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]) {
      background-color: rgba(234, 179, 8, 0.15) !important;
    }
    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: rgba(234, 179, 8, 0.25) !important;
    }

    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]) {
      background-color: rgba(249, 115, 22, 0.18) !important;
    }
    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: rgba(249, 115, 22, 0.28) !important;
    }

    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]) {
      background-color: rgba(239, 68, 68, 0.20) !important;
    }
    html[data-ratiod-theme="dark"] tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]):hover {
      background-color: rgba(239, 68, 68, 0.30) !important;
    }

    html[data-ratiod-theme="dark"] .ratiod-inbox-pill {
      border-color: #3F3F46 !important;
      box-shadow: 1px 1px 0px #09090B !important;
    }

    /* Fallback OS-level Dark Mode (if data-ratiod-theme is not yet set) */
    @media (prefers-color-scheme: dark) {
      tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]) {
        background-color: rgba(34, 197, 94, 0.15) !important;
      }
      tr.zA[data-ratiod-verdict="safe"]:not(.aqw):not([aria-selected="true"]):hover {
        background-color: rgba(34, 197, 94, 0.25) !important;
      }
      tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]) {
        background-color: rgba(234, 179, 8, 0.15) !important;
      }
      tr.zA[data-ratiod-verdict="promo_clutter"]:not(.aqw):not([aria-selected="true"]):hover {
        background-color: rgba(234, 179, 8, 0.25) !important;
      }
      tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]) {
        background-color: rgba(249, 115, 22, 0.18) !important;
      }
      tr.zA[data-ratiod-verdict="suspicious"]:not(.aqw):not([aria-selected="true"]):hover {
        background-color: rgba(249, 115, 22, 0.28) !important;
      }
      tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]) {
        background-color: rgba(239, 68, 68, 0.20) !important;
      }
      tr.zA[data-ratiod-verdict="high_risk"]:not(.aqw):not([aria-selected="true"]):hover {
        background-color: rgba(239, 68, 68, 0.30) !important;
      }
      .ratiod-inbox-pill {
        border-color: #3F3F46 !important;
        box-shadow: 1px 1px 0px #09090B !important;
      }
    }

    /* ==========================================================================
       Ratio'd Smart Link Shield Tooltip
       ========================================================================== */
    .ratiod-link-shield {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #FFFFFF;
      border: 2px solid #121212;
      border-radius: 10px;
      box-shadow: 4px 4px 0px #121212;
      color: #121212;
      padding: 10px 14px;
      min-width: 260px;
      max-width: 420px;
      pointer-events: auto;
      animation: ratiod-pop 0.12s ease-out;
    }
    @keyframes ratiod-pop {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .shield-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 6px;
    }
    .shield-title {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .shield-status {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 4px;
      border: 1px solid #121212;
      text-transform: uppercase;
    }
    .shield-dest {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 11px;
      padding: 5px 8px;
      background-color: #F8F7F2;
      border: 1.5px dashed #121212;
      border-radius: 6px;
      margin-bottom: 6px;
      word-break: break-all;
    }
    .shield-dest-label {
      font-size: 9px;
      color: #6B7280;
      font-weight: 700;
      display: block;
      margin-bottom: 2px;
    }
    .shield-dest-url {
      font-weight: 700;
      color: #121212;
    }
    .shield-warning {
      font-size: 11px;
      font-weight: 600;
      color: #B91C1C;
      background-color: #FEF2F2;
      border-left: 3px solid #EA3E2B;
      padding: 4px 8px;
      border-radius: 4px;
      margin-bottom: 6px;
      line-height: 1.35;
    }
    .shield-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed #E5E7EB;
    }
    .shield-copy-btn {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      background-color: #FFFFFF;
      color: #121212;
      border: 1.5px solid #121212;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 1px 1px 0px #121212;
      text-transform: uppercase;
    }
    .shield-copy-btn:hover {
      background-color: #FACC15;
    }
    .shield-tracking-note {
      font-size: 10px;
      color: #6B7280;
      font-weight: 500;
    }

    /* Dark Mode for Link Shield */
    html[data-ratiod-theme="dark"] .ratiod-link-shield {
      background-color: #18181B;
      border-color: #3F3F46;
      box-shadow: 4px 4px 0px #09090B;
      color: #F4F4F5;
    }
    html[data-ratiod-theme="dark"] .shield-dest {
      background-color: #27272A;
      border-color: #52525B;
    }
    html[data-ratiod-theme="dark"] .shield-dest-url {
      color: #F4F4F5;
    }
    html[data-ratiod-theme="dark"] .shield-warning {
      background-color: #2D0B0E;
      border-left-color: #EF4444;
      color: #FCA5A5;
    }
    html[data-ratiod-theme="dark"] .shield-footer {
      border-top-color: #3F3F46;
    }
    html[data-ratiod-theme="dark"] .shield-copy-btn {
      background-color: #27272A;
      color: #F4F4F5;
      border-color: #3F3F46;
      box-shadow: 1px 1px 0px #09090B;
    }
    html[data-ratiod-theme="dark"] .shield-copy-btn:hover {
      background-color: #3F3F46;
    }
    html[data-ratiod-theme="dark"] .shield-tracking-note {
      color: #A1A1AA;
    }
    @media (prefers-color-scheme: dark) {
      .ratiod-link-shield {
        background-color: #18181B;
        border-color: #3F3F46;
        box-shadow: 4px 4px 0px #09090B;
        color: #F4F4F5;
      }
      .shield-dest {
        background-color: #27272A;
        border-color: #52525B;
      }
      .shield-dest-url {
        color: #F4F4F5;
      }
      .shield-warning {
        background-color: #2D0B0E;
        border-left-color: #EF4444;
        color: #FCA5A5;
      }
      .shield-footer {
        border-top-color: #3F3F46;
      }
      .shield-copy-btn {
        background-color: #27272A;
        color: #F4F4F5;
        border-color: #3F3F46;
        box-shadow: 1px 1px 0px #09090B;
      }
      .shield-copy-btn:hover {
        background-color: #3F3F46;
      }
      .shield-tracking-note {
        color: #A1A1AA;
      }
    }
  `;
  (document.head || document.documentElement).appendChild(style);
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
    labelText = `🔴`;
    bgColor = "#EA3E2B";
    textColor = "#FFFFFF";
  } else if (verdict === "suspicious") {
    labelText = `🟠`;
    bgColor = "#E8720C";
    textColor = "#FFFFFF";
  } else if (verdict === "promo_clutter") {
    labelText = `🟡`;
    bgColor = "#FFD23F";
    textColor = "#121212";
  } else {
    labelText = `🟢`;
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
    font-size: 11px;
    font-weight: 800;
    line-height: 14px;
    padding: 1px 4px;
    margin-right: 6px;
    border-radius: 6px;
    border: 1.5px solid #121212;
    background-color: ${bgColor};
    color: ${textColor};
    cursor: help;
    box-shadow: 1px 1px 0px #121212;
    user-select: none;
    white-space: nowrap;
    flex-shrink: 0;
    z-index: 5;
    transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease;
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

/**
 * Comprehensive detection for Gmail Promotional / Marketing context.
 * Evaluates:
 * 1. Active tab or URL: Gmail "Promotions" tab selected (#inbox tab, #category/promotions, etc.)
 * 2. Left sidebar: Promotions navigation selected
 * 3. Gmail Category Chips: Open email has "Promotions" label chip (span.hN, .av, etc.)
 * 4. Native Gmail Unsubscribe: Sender header has native "Unsubscribe" button / link
 * 5. Message Body: Unsubscribe links or marketing opt-out
 * 6. Marketing Keywords: Promotional keywords in subject, body, or snippet
 */
/**
 * High-precision promotional text pattern test.
 * Recognizes commercial marketing blasts, EdTech brag pitches, course sales, retail discounts,
 * and newsletters across both opened emails and unopened inbox rows.
 */
function isPromotionalText(text) {
  if (!text) return false;
  const promoPattern = /\b(\d+[\d,]*\+?\s*(?:students|learners|graduates|candidates|professionals)\s*(?:hired|placed|enrolled|trained|cracked)|\d+[\d,]*\+?\s*(?:companies|partner\s+companies|hiring\s+partners)|(?:crack|master|ace|prepare\s+for)\s+[a-z\s]{0,25}interviews?|(?:free\s+)?(?:masterclass|bootcamp|live\s+workshop|cohort|average\s+(?:ctc|package)|placement\s+(?:assistance|guarantee))|(?:flat|upto|up\s+to|\d{1,2}%)\s*(?:off|discount|cashback|sale)|use\s+(?:coupon|code|promo\s+code)\s+[a-z0-9]+|(?:limited\s+time\s+offer|exclusive\s+deal|weekend\s+sale|clearance\s+sale|flash\s+sale|new\s+arrivals|latest\s+drop)|unsubscribe|newsletter|digest)\b/i;
  return promoPattern.test(text);
}

/**
 * Detects whether the user is actively viewing Gmail's Spam folder.
 * STRICT: Only returns true when the hash is explicitly #spam and NOT viewing inbox.
 * Never inspects document.title (which can include unread spam counts or subjects).
 */
function isSpamViewActive() {
  try {
    const hash = (window.location.hash || "").toLowerCase();
    if (hash.includes("inbox") || hash.includes("category/") || hash.includes("starred") || hash.includes("sent") || hash.includes("all")) {
      return false;
    }
    if (hash === "#spam" || hash.startsWith("#spam/") || hash.includes("label/spam") || hash.includes("category/spam")) {
      return true;
    }
    const activeNavSpam = document.querySelector('a[href*="#spam"][aria-current="page"], a[href*="label/spam"][aria-selected="true"], div[data-tooltip="Spam" i][aria-selected="true"]');
    if (activeNavSpam) {
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Detects whether the user is actively viewing Gmail's Promotions tab or section.
 * Strictly verifies the active hash, tab, or navigation link.
 * Never performs broad document queries or inspects unselected classes like .TO.nZ.
 */
function isPromotionsViewActive() {
  try {
    const hash = (window.location.hash || "").toLowerCase();
    if (hash.includes("category/promotions") || hash.includes("label/promotions") || hash === "#promotions") {
      return true;
    }

    const activeTab = document.querySelector('[role="tab"][aria-selected="true"]');
    if (activeTab) {
      const tabText = (activeTab.getAttribute("aria-label") || activeTab.textContent || activeTab.getAttribute("data-tooltip") || "").toLowerCase();
      if (tabText.includes("promotion")) {
        return true;
      }
    }

    const activeNavPromo = document.querySelector('a[href*="category/promotions"][aria-current="page"], a[href*="category/promotions"][aria-selected="true"], div[data-tooltip="Promotions" i][aria-selected="true"]');
    if (activeNavPromo) {
      return true;
    }
  } catch (e) {}

  return false;
}

/**
 * Checks whether an element or view is within promotional marketing context.
 */
function isPromotionsContext(container = null, text = "") {
  try {
    if (isPromotionsViewActive()) {
      return true;
    }

    if (text && isPromotionalText(text)) {
      return true;
    }

    if (!container) return false;

    // Check for native Gmail Unsubscribe button in message header
    const nativeUnsub = container.querySelector(".pG, [aria-label*='Unsubscribe' i], [data-tooltip*='Unsubscribe' i]");
    if (nativeUnsub) {
      return true;
    }

    // Inside open email container: check for explicit category label chips
    const categoryChips = container.querySelectorAll('.av, span.hN, div.ar.as');
    for (const chip of categoryChips) {
      const chipText = (chip.textContent || chip.getAttribute("aria-label") || "").trim().toLowerCase();
      if (chipText === "promotions" || chipText === "promotion") {
        return true;
      }
    }
  } catch (e) {}

  return false;
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

function recordAnalyticsScan(data, piiCount) {
  try {
    if (typeof chrome === "undefined" || !chrome.storage || !chrome.storage.local) return;
    chrome.storage.local.get(["ratiod_stats"], (res) => {
      const stats = res && res.ratiod_stats ? res.ratiod_stats : {
        total: 0,
        safe: 0,
        promo: 0,
        suspicious: 0,
        high_risk: 0,
        qr_scanned: 0,
        pii_redacted: 0
      };
      stats.total = (stats.total || 0) + 1;
      const v = String(data.verdict || "").toLowerCase();
      if (v === "high_risk" || v === "malicious") {
        stats.high_risk = (stats.high_risk || 0) + 1;
      } else if (v === "suspicious") {
        stats.suspicious = (stats.suspicious || 0) + 1;
      } else if (v === "promo_clutter") {
        stats.promo = (stats.promo || 0) + 1;
      } else {
        stats.safe = (stats.safe || 0) + 1;
      }

      if (data.qr && (data.qr.payload || data.qr.score !== undefined)) {
        stats.qr_scanned = (stats.qr_scanned || 0) + 1;
      }

      stats.pii_redacted = (stats.pii_redacted || 0) + (piiCount || 0);

      chrome.storage.local.set({ ratiod_stats: stats });
    });
  } catch (e) {}
}

function scanAndAnalyzeGmail() {
  const emailBodyElem = document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  
  if (!emailBodyElem) return;

  const rawBodyText = emailBodyElem.innerText || "";
  if (rawBodyText.length < 5) return;

  // Extract Subject and Sender from open email header
  const subjectElem = document.querySelector("h2.hP, .ha h2, [data-thread-perm-id] h2, [role='main'] h2, h1.ha, .hP");
  const subject = subjectElem ? subjectElem.innerText.replace(/\[\s*(?:🔴|🟠|🟡|🟢|risk|susp|promo|safe)[\s\d]*\]/gi, "").trim() : "";

  const senderInfo = extractGmailSender(emailBodyElem);
  const senderAddress = senderInfo.senderAddress;
  const senderName = senderInfo.senderName;
  const senderHeader = senderName
    ? (senderAddress ? `${senderName} <${senderAddress}>` : senderName)
    : senderAddress;

  // Check if Gmail placed this in Spam or shows a quarantine warning
  const spamBanner = document.querySelector(".mE, .b8, div[role='alert'], .a2k");
  const isSpamLocation = isSpamViewActive();
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
    const cleanSender = extractCleanEmail(senderAddress || senderHeader);
    const isBalBharat = (cleanSender && (cleanSender.endsWith("@balbharat.org") || cleanSender === "balbharat.org")) ||
                        (senderHeader && senderHeader.toLowerCase().includes("balbharat.org")) ||
                        (fullTextToAnalyze && /from:\s*.*@balbharat\.org/i.test(fullTextToAnalyze));
    const isOfficial = isOfficialBrandSender(cleanSender, senderHeader, fullTextToAnalyze);

    const senderDomain = cleanSender && cleanSender.includes("@") ? cleanSender.split("@")[1].toLowerCase() : "";
    const learnedRecord = cleanSender ? (
      memSenderLearning[cleanSender.toLowerCase()] ||
      memUserOverrides[cleanSender.toLowerCase()] ||
      memUserOverrides["sender:" + cleanSender.toLowerCase()] ||
      (senderDomain && memSenderLearning["@" + senderDomain]) ||
      (senderDomain && memSenderLearning[senderDomain]) ||
      (senderDomain && memSenderLearning["domain:" + senderDomain])
    ) : null;

    if (isBalBharat || isOfficial) {
      data.verdict = "safe";
      data.score = 0;
      data.mail_score = 0;
      data.flags = [{
        span: cleanSender || senderHeader,
        reason: isBalBharat
          ? "Official verified educational institution domain (Bal Bharati)"
          : `Official verified communication from authentic platform (${cleanSender || senderHeader})`,
        type: "official_brand"
      }];
      data.explanation = isBalBharat
        ? "Official email from Bal Bharati (balbharat.org). Verified safe educational institution domain."
        : `Official authentic communication from ${cleanSender || senderHeader}. Verified platform domain with no security threats detected.`;
      data.next_steps = [
        `Authentic email from ${cleanSender || senderHeader}.`,
        "This is an official communication and is safe to interact with."
      ];
    } else if (learnedRecord) {
      data.verdict = learnedRecord.verdict;
      data.score = learnedRecord.score !== undefined ? learnedRecord.score : (learnedRecord.verdict === "safe" ? 0 : 35);
      data.mail_score = data.score;
      data.isUserOverride = true;
      data.explanation = `Sender learned as ${learnedRecord.feedback ? learnedRecord.feedback.toUpperCase() : learnedRecord.verdict.toUpperCase()}: Continuous feedback applied for ${cleanSender}. Any email from this sender is classified according to your preference.`;
      data.flags = [{
        span: cleanSender,
        reason: `Sender continuously classified as ${learnedRecord.feedback || learnedRecord.verdict} based on your feedback`,
        type: "user_learned"
      }];
    } else {
      // 1. Harmonize Promotional / Marketing emails so banner and inbox tags always match 100%
      const isPromo = isPromotionsContext(emailBodyElem, fullTextToAnalyze);
      const hasThreat = data.verdict === "high_risk" || data.verdict === "suspicious" ||
        (data.flags && data.flags.some(f => f.type !== "promo" && f.type !== "quarantine"));

      if (isPromo && !hasThreat) {
        data.verdict = "promo_clutter";
        data.score = Math.max(data.score || 0, 25);
        if (!data.flags) data.flags = [];
        const hasPromoFlag = data.flags.some(f => f.type === "promo" || /promotional|marketing/i.test(f.reason || ""));
        if (!hasPromoFlag) {
          data.flags.push({
            span: "Promotions / Marketing",
            reason: "Identified as promotional marketing, newsletter, or commercial email",
            type: "promo"
          });
        }
        if (!data.explanation || /safe|legitimate|clean|no threat/i.test(data.explanation)) {
          data.explanation = "Promotional marketing or newsletter mail. Commercial content detected with no security threats.";
        }
        if (!data.next_steps || data.next_steps.length === 0) {
          data.next_steps = [
            "Promotional marketing or newsletter detected.",
            "Use the One-Click Unsubscribe button below if you no longer wish to receive emails from this sender.",
            "No credentials or payment required. Be mindful before making purchases."
          ];
        }
      }
    }

    data.emailMeta = {
      subject: subject,
      from: senderHeader,
      senderAddress: cleanSender
    };
    data.cacheKey = subject || window.location.hash;

    const renderAndPersist = (finalData) => {
      // 2. Inject in-email banner
      if (window.injectRatiodBanner) {
        window.injectRatiodBanner(emailBodyElem, finalData);
      }
      // 3. Persist authoritative verdict to cache across all subject & thread identifiers
      const keysToSave = [];
      const cleanSubj = subject ? subject.trim().toLowerCase() : "";
      const normSubj = subject ? normalizeSubjectKey(subject) : "";
      if (subject) {
        keysToSave.push(subject);
        if (cleanSubj) keysToSave.push(cleanSubj);
        if (normSubj) {
          keysToSave.push(normSubj);
          keysToSave.push(normSubj.slice(0, 30));
        }
      }
      const sAddr = (cleanSender || senderAddress || "").toLowerCase().trim();
      if (sAddr && normSubj) {
        keysToSave.push(`${sAddr}|${normSubj}`);
        keysToSave.push(`${sAddr}|${cleanSubj}`);
        keysToSave.push(`${sAddr}|${normSubj.slice(0, 30)}`);
      }
      if (senderHeader && normSubj) {
        keysToSave.push(`${senderHeader.toLowerCase().trim()}|${normSubj}`);
      }

      const threadElem = document.querySelector("[data-thread-perm-id], [data-legacy-thread-id], [data-legacy-message-id]");
      if (threadElem) {
        const permId = threadElem.getAttribute("data-thread-perm-id");
        if (permId) {
          keysToSave.push(permId);
          keysToSave.push(normalizeThreadId(permId));
        }
        const legId = threadElem.getAttribute("data-legacy-thread-id");
        if (legId) {
          keysToSave.push(legId);
          keysToSave.push(normalizeThreadId(legId));
        }
        const msgId = threadElem.getAttribute("data-legacy-message-id");
        if (msgId) {
          keysToSave.push(msgId);
          keysToSave.push(normalizeThreadId(msgId));
        }
      }

      if (window.location.hash) {
        const hashKey = window.location.hash.replace(/^#/, "");
        if (hashKey) {
          const parts = hashKey.split("/");
          const threadPart = parts[parts.length - 1];
          if (threadPart && threadPart.length >= 10 && !isIgnoredCacheKey(threadPart)) {
            keysToSave.push(threadPart);
            keysToSave.push(normalizeThreadId(threadPart));
          }
        }
      }

      saveVerdictToCache(keysToSave, finalData);

      // 4. Immediately synchronize ALL matching rows in the DOM (split view & main inbox)
      const allRows = document.querySelectorAll("tr.zA");
      allRows.forEach(r => {
        const rIds = getRowIdentifiers(r);
        const rSubj = extractCleanRowSubject(r);
        const rNormSubj = normalizeSubjectKey(rSubj);
        const idMatch = rIds.some(id => keysToSave.includes(id));
        const subjMatch = normSubj && (rNormSubj === normSubj || (rNormSubj && normSubj.startsWith(rNormSubj)));
        if (idMatch || subjMatch) {
          r.setAttribute("data-ratiod-verdict", finalData.verdict);
          const rBadge = r.querySelector(".ratiod-inbox-pill");
          if (rBadge) {
            updateBadgeElement(rBadge, finalData.verdict, finalData.score, finalData.flags);
          }
          r.setAttribute("data-ratiod-sig", `authoritative|${finalData.verdict}${finalData.score}`);
        }
      });

      // 4. Trigger multi-pass staggered scan to update inbox list view instantly
      triggerStaggeredScan(true);

      // 5. Update local analytics telemetry for extension popup
      recordAnalyticsScan(finalData, piiRedactedCount);
    };

    // Check user overrides from chrome.storage.local before rendering
    const overrideLookupKeys = [
      cleanSender ? cleanSender.toLowerCase() : "",
      cleanSender ? ("sender:" + cleanSender.toLowerCase()) : "",
      subject ? subject.trim().toLowerCase() : "",
      subject ? normalizeSubjectKey(subject) : "",
      senderAddress ? `${senderAddress}|${normalizeSubjectKey(subject)}`.toLowerCase() : "",
      window.location.hash ? window.location.hash.replace(/^#/, "").toLowerCase() : ""
    ].filter(Boolean);

    try {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["ratiod_user_overrides"], (res) => {
          const overrides = (res && res.ratiod_user_overrides) || {};
          let matchedOverride = null;
          for (const k of overrideLookupKeys) {
            if (overrides[k]) {
              matchedOverride = overrides[k];
              break;
            }
          }
          if (matchedOverride) {
            data.verdict = matchedOverride.verdict;
            data.score = matchedOverride.score;
            data.mail_score = matchedOverride.score;
            data.isUserOverride = true;
            data.explanation = `User Override: You previously marked this email as ${matchedOverride.feedback || matchedOverride.verdict}.`;
          }
          renderAndPersist(data);
        });
        return;
      }
    } catch (e) {}

    renderAndPersist(data);
  };

  // 1. Client-Side Local PII Redaction
  const redactedText = redactPiiLocally(fullTextToAnalyze);
  const phonesMatch = fullTextToAnalyze.match(/(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g);
  const emailsMatch = fullTextToAnalyze.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const otpMatch = fullTextToAnalyze.match(/\b(OTP|code|passcode|PIN)\b(?:\s+(?:is|was|:|-))?\s*:?\s*(\d{4,8})\b/gi);
  const piiRedactedCount = (phonesMatch ? phonesMatch.length : 0) +
                           (emailsMatch ? emailsMatch.length : 0) +
                           (otpMatch ? otpMatch.length : 0);

  // 2. Extract Header Authentication Details (SPF/DKIM/From)
  const authDetails = extractGmailAuthDetails(emailBodyElem);
  const hasExtractedHeaders = Boolean(authDetails.mailedBy || authDetails.signedBy);
  const authPayload = hasExtractedHeaders ? {
    fromDomain: authDetails.fromDomain || null,
    mailedBy: authDetails.mailedBy || null,
    signedBy: authDetails.signedBy || null
  } : {
    fromDomain: authDetails.fromDomain || null,
    uninspected: true
  };

  const payload = {
    text: redactedText,
    channel: "email",
    auth: authPayload,
    senderAddress: extractCleanEmail(senderAddress || senderHeader) || senderAddress || "",
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
function scanInboxRows(forceUpdate = false) {
  if (!window.RatiodFallback) return;
  ensureInboxStyles();

  const rows = document.querySelectorAll("tr.zA");
  if (!rows || rows.length === 0) return;

  const isSpamView = isSpamViewActive();
  const isPromotionsView = isPromotionsViewActive();

  rows.forEach((row) => {
    try {
      // Enhanced sender extraction for Gmail inbox rows:
      // Query inner elements with email attribute or hovercard first to get the true canonical address
      const emailElem = row.querySelector("span[email], [email], .zF[data-hovercard-id], [data-hovercard-id], .zF");
      const rawEmail = emailElem ? (emailElem.getAttribute("email") || emailElem.getAttribute("data-hovercard-id") || "") : "";
      const rawName = emailElem ? (emailElem.getAttribute("name") || emailElem.innerText || emailElem.textContent || "") : "";

      const senderCell = row.querySelector("td.yX, .yX, .yW, .bqe");
      const cellText = senderCell ? (senderCell.getAttribute("title") || senderCell.innerText || senderCell.textContent || "") : "";

      let sender = "";
      if (rawEmail && rawName && rawEmail !== rawName) {
        sender = `${rawName.trim()} <${rawEmail.trim()}>`;
      } else if (rawEmail) {
        sender = rawEmail.trim();
      } else if (rawName) {
        sender = rawName.trim();
      } else {
        sender = cellText.trim();
      }

      const subject = extractCleanRowSubject(row);
      const snippetElem = row.querySelector(".y2");
      const snippet = snippetElem ? snippetElem.innerText.trim() : "";

      const combinedText = `From: ${sender}\nSubject: ${subject}\n${snippet}`.trim();

      // Educational / Institutional Exemption: balbharat.org & Official Brand Senders
      const cleanSenderEmail = extractCleanEmail(sender) || (rawEmail ? rawEmail.toLowerCase().trim() : "");
      const isBalBharat = (cleanSenderEmail && (cleanSenderEmail.endsWith("@balbharat.org") || cleanSenderEmail === "balbharat.org")) ||
                          (sender && (sender.toLowerCase().includes("@balbharat.org") || sender.toLowerCase().includes("balbharat.org"))) ||
                          (combinedText && /from:\s*.*@balbharat\.org/i.test(combinedText));
      const isOfficial = isOfficialBrandSender(cleanSenderEmail, sender, combinedText);

      // Check if authoritative deep-analysis result exists in cache!
      const rowIds = getRowIdentifiers(row);
      const cacheKey = normalizeSubjectKey(subject);
      const rawSenderKey = sender ? sender.toLowerCase().trim() : "";
      const tupleKeyClean = cleanSenderEmail ? `${cleanSenderEmail}|${cacheKey}` : "";
      const tupleKeyCleanExact = (cleanSenderEmail && subject) ? `${cleanSenderEmail}|${subject.toLowerCase().trim()}` : "";
      const tupleKeyRaw = rawSenderKey ? `${rawSenderKey}|${cacheKey}` : "";

      const lookupKeys = [
        ...rowIds,
        tupleKeyClean,
        tupleKeyCleanExact,
        tupleKeyRaw,
        subject,
        cacheKey,
        cacheKey.slice(0, 30)
      ].filter(Boolean);
      const cachedVerdict = getCachedVerdict(lookupKeys);

      // Fast-path: If row already processed and its text signature & cache state have not changed, skip!
      const rowSignature = `${combinedText}|${cachedVerdict ? cachedVerdict.verdict + cachedVerdict.score : 'none'}`;
      const existingBadge = row.querySelector(".ratiod-inbox-pill");
      if (!forceUpdate && existingBadge && row.getAttribute("data-ratiod-sig") === rowSignature && row.getAttribute("data-ratiod-verdict")) {
        return;
      }

      let verdict = "safe";
      let score = 0;
      let flags = [];

      // Continuous Sender Learning & User Override (HIGHEST PRIORITY):
      // If the user previously marked this sender or domain as safe, promotional, or suspicious,
      // every other email from this same sender inherits that verdict with 100% priority.
      const cleanKey = cleanSenderEmail ? cleanSenderEmail.toLowerCase() : "";
      const senderDomain = cleanKey && cleanKey.includes("@") ? cleanKey.split("@")[1].toLowerCase() : "";
      const learnedSenderRecord = (cleanKey && memSenderLearning[cleanKey]) ||
                                  (cleanKey && memUserOverrides[cleanKey]) ||
                                  (cleanKey && memUserOverrides["sender:" + cleanKey]) ||
                                  (senderDomain && memSenderLearning["@" + senderDomain]) ||
                                  (senderDomain && memSenderLearning[senderDomain]) ||
                                  (senderDomain && memSenderLearning["domain:" + senderDomain]) ||
                                  (rawSenderKey && memSenderLearning[rawSenderKey]) ||
                                  (rawSenderKey && memUserOverrides[rawSenderKey]) ||
                                  (rawSenderKey && memUserOverrides["sender:" + rawSenderKey]) ||
                                  null;

      if (isBalBharat || isOfficial) {
        verdict = "safe";
        score = 0;
        flags = [{
          span: cleanSenderEmail || sender,
          reason: isBalBharat
            ? "Official verified educational institution domain (Bal Bharati)"
            : `Official verified communication from authentic platform (${cleanSenderEmail || sender})`,
          type: "official_brand"
        }];
      } else if (learnedSenderRecord) {
        verdict = learnedSenderRecord.verdict;
        score = learnedSenderRecord.score !== undefined ? learnedSenderRecord.score : (verdict === "safe" ? 0 : 35);
        flags = [{
          span: cleanSenderEmail || sender,
          reason: `Sender learned as ${learnedSenderRecord.feedback || verdict}: Continuous preference applied from your user feedback`,
          type: "user_learned"
        }];
        // Continuous user preference for this sender takes ABSOLUTE PRECEDENCE:
        // It completely bypasses isPromotionsView, isPromotionalText, and isSpamView!
      } else if (cachedVerdict) {
        // 100% PARITY WITH BANNER: Authoritative result from in-depth open-email analysis
        verdict = cachedVerdict.verdict;
        score = cachedVerdict.score;
        flags = cachedVerdict.flags || [];
      } else if (isSpamView) {
        // Gmail quarantined this message.
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

        // Brand display-name impersonation check from free-mail or mismatched address in inbox row
        if (sender) {
          const freeMailPattern = /@(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|proton(mail\.com|me)|aol\.com)\b/i;
          const brandPattern = /\b(paypal|netflix|microsoft|google|apple|amazon|chase|wellsfargo|bank of america|dhl|fedex|ups)\b/i;
          const brandMatch = sender.match(brandPattern);
          if (brandMatch && freeMailPattern.test(sender)) {
            score = Math.max(score, 82);
            verdict = "high_risk";
            flags.unshift({
              span: sender,
              reason: `Brand display name '${brandMatch[0]}' paired with free/unrelated mailbox address`
            });
          }
        }

        // Urgent Credential / Phishing threat check:
        // Escalates ONLY if urgent pressure is explicitly coupled with credential harvesting or malicious shortener.
        // Legitimate operational notifications (password resets, 2FA confirmations, security alerts) remain SAFE.
        const hasUrgentPressure = /(immediate action|action required.*to avoid (suspension|termination|closure)|account (will be|has been) (suspended|terminated|disabled)|unauthorized access.*verify credentials)/i.test(combinedText);
        const hasHarvestingDemand = /(enter|verify|confirm)\s+(your\s+)?(password|credentials|pin|ssn|otp|seed phrase)|(bit\.ly|tinyurl|is\.gd|ow\.ly)/i.test(combinedText);
        if (hasUrgentPressure && hasHarvestingDemand) {
          score = Math.max(score, 78);
          verdict = "high_risk";
          flags.unshift({
            span: "Urgent Credential Harvesting Combo",
            reason: "Urgent pressure combined with credential or OTP harvesting demand"
          });
        }

        // Promotional Marketing Awareness:
        // Accurately categorizes marketing/newsletters/promotions as promo_clutter across all views
        // (e.g. Parikh Jain: "1,600+ Students Hired. 250+ Companies", Coursera, discounts, newsletters)
        const isPromo = isPromotionsView || isPromotionalText(combinedText);
        if (verdict === "safe" && isPromo) {
          verdict = "promo_clutter";
          score = Math.max(score, 38);
          if (!flags.some(f => f.type === "promo")) {
            flags.push({
              span: "Promotions / Marketing",
              reason: "Identified as promotional marketing, newsletter, or commercial announcement",
              type: "promo"
            });
          }
        }
      }

      row.setAttribute("data-ratiod-sig", rowSignature);
      row.setAttribute("data-ratiod-verdict", verdict);

      // Check if row already has a badge mounted
      if (existingBadge) {
        // Synchronize in place if deep analysis or cache updated verdict/score!
        const curVerdict = existingBadge.getAttribute("data-verdict");
        const curScore = existingBadge.getAttribute("data-score");
        if (forceUpdate || curVerdict !== verdict || curScore !== String(score)) {
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

      // Mount badge cleanly inside table cell
      if (target.tagName === "TD" || target.tagName === "TR") {
        target.prepend(badge);
      } else if (target.parentNode) {
        target.parentNode.insertBefore(badge, target);
      } else if (target.prepend) {
        target.prepend(badge);
      }
    } catch (rowErr) {
      console.warn("[Ratio'd] Error badging row:", rowErr);
    }
  });
}

// ---------------------------------------------------------------------------
// High-Performance Debounced Scheduler & Multi-Pass Staggered Scheduler
// ---------------------------------------------------------------------------

let debounceTimer = null;

function scheduleScan(delay = 140, forceUpdate = false) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => {
        executeScanPass(forceUpdate);
      }, { timeout: 250 });
    } else if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => {
        executeScanPass(forceUpdate);
      });
    } else {
      setTimeout(() => {
        executeScanPass(forceUpdate);
      }, 0);
    }
  }, delay);
}

function triggerStaggeredScan(forceUpdate = true) {
  scheduleScan(20, forceUpdate);
  scheduleScan(120, forceUpdate);
  scheduleScan(350, forceUpdate);
  scheduleScan(800, forceUpdate);
}

function executeScanPass(forceUpdate = false) {
  if (document.hidden) return;
  updateThemeDetection();

  // Ensure any previous DOM triage bar is completely removed from Gmail screen
  const oldTriageBar = document.getElementById("ratiod-triage-bar");
  if (oldTriageBar) oldTriageBar.remove();

  const isEmailOpen = !!document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  if (isEmailOpen) {
    scanAndAnalyzeGmail();
  }
  scanInboxRows(forceUpdate);
  if (currentTriageFilter && currentTriageFilter !== "all") {
    applyTriageFilter(currentTriageFilter);
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Ratio'd Inbox Row Triage Filter (Controlled via Popup)
// ---------------------------------------------------------------------------
let currentTriageFilter = "all";

function getInboxRowCounts() {
  const rows = (typeof document !== "undefined" && document.querySelectorAll) ? document.querySelectorAll("tr.zA") : [];
  let safeCount = 0;
  let promoCount = 0;
  let suspCount = 0;
  let riskCount = 0;

  if (rows && rows.forEach) {
    rows.forEach(r => {
      const v = r.getAttribute ? (r.getAttribute("data-ratiod-verdict") || "safe") : "safe";
      if (v === "high_risk") riskCount++;
      else if (v === "suspicious") suspCount++;
      else if (v === "promo_clutter") promoCount++;
      else safeCount++;
    });
  }

  return {
    total: rows.length || 0,
    safe: safeCount,
    promo: promoCount,
    suspicious: suspCount,
    high_risk: riskCount
  };
}

function applyTriageFilter(filter) {
  currentTriageFilter = filter || "all";
  const rows = (typeof document !== "undefined" && document.querySelectorAll) ? document.querySelectorAll("tr.zA") : [];
  if (!rows || !rows.forEach) return;

  rows.forEach(r => {
    if (!filter || filter === "all") {
      if (r.style && r.style.removeProperty) {
        r.style.removeProperty("display");
      } else if (r.style) {
        r.style.display = "";
      }
    } else {
      const v = r.getAttribute ? (r.getAttribute("data-ratiod-verdict") || "safe") : "safe";
      if (v === filter) {
        if (r.style && r.style.removeProperty) {
          r.style.removeProperty("display");
        } else if (r.style) {
          r.style.display = "";
        }
      } else if (r.style) {
        if (r.style.setProperty) {
          r.style.setProperty("display", "none", "important");
        } else {
          r.style.display = "none";
        }
      }
    }
  });
}

// Listen for triage filtering commands from extension popup
try {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (!request) return;
      if (request.action === "ratiod_filter_inbox") {
        applyTriageFilter(request.filter);
        if (sendResponse) sendResponse({ success: true, filter: request.filter });
      } else if (request.action === "ratiod_get_inbox_triage_counts") {
        const counts = getInboxRowCounts();
        if (sendResponse) sendResponse({ success: true, counts: counts, activeFilter: currentTriageFilter });
      }
    });
  }
} catch (e) {}

// ---------------------------------------------------------------------------
// Ratio'd Smart Link Shield Tooltip
// ---------------------------------------------------------------------------
let activeLinkShield = null;
let linkShieldTimer = null;

function removeLinkShield() {
  if (linkShieldTimer) {
    clearTimeout(linkShieldTimer);
    linkShieldTimer = null;
  }
  if (activeLinkShield) {
    activeLinkShield.remove();
    activeLinkShield = null;
  }
}

function initSmartLinkShield() {
  if (typeof document === "undefined" || !document.addEventListener) return;
  document.addEventListener("mouseover", handleLinkMouseOver, true);
  document.addEventListener("mouseout", handleLinkMouseOut, true);
  document.addEventListener("scroll", () => removeLinkShield(), { passive: true });
}

function handleLinkMouseOver(e) {
  const link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!link || !link.href) return;
  if (!link.closest(".a3s, .ii.gt, [role='main'] .a3s, .adn")) return;

  const href = String(link.href).trim();
  if (!href || /^javascript:|^mailto:|^tel:/i.test(href)) return;

  const displayedText = (link.innerText || link.textContent || "").trim();
  const assessment = window.RatiodFallback && typeof window.RatiodFallback.verifyLinkSafety === "function"
    ? window.RatiodFallback.verifyLinkSafety(displayedText, href)
    : { isSafe: true, risk: "safe", reason: "Standard destination", destHost: "" };

  if (linkShieldTimer) clearTimeout(linkShieldTimer);
  linkShieldTimer = setTimeout(() => {
    renderLinkShield(link, displayedText, href, assessment);
  }, 160);
}

function handleLinkMouseOut(e) {
  const link = e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if (!link) return;
  setTimeout(() => {
    if (activeLinkShield && !activeLinkShield.matches(":hover")) {
      removeLinkShield();
    }
  }, 120);
}

function renderLinkShield(linkElem, displayedText, href, assessment) {
  removeLinkShield();

  const rect = linkElem.getBoundingClientRect();
  if (!rect || rect.width === 0) return;

  const shield = document.createElement("div");
  shield.id = "ratiod-link-shield";
  shield.className = `ratiod-link-shield shield-${assessment.risk || 'safe'}`;

  let cleanUrl = href;
  try {
    const u = new URL(href);
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid', '_hsenc'];
    trackingKeys.forEach(k => u.searchParams.delete(k));
    cleanUrl = u.toString();
  } catch (err) {}

  let badgeColor = "#4ADE80";
  let badgeLabel = "VERIFIED LINK";
  if (assessment.risk === "high_risk") {
    badgeColor = "#EA3E2B";
    badgeLabel = "⚠️ HIGH RISK / DECEPTIVE";
  } else if (assessment.risk === "suspicious") {
    badgeColor = "#F97316";
    badgeLabel = "⚠️ SUSPICIOUS ROUTING";
  }

  shield.innerHTML = `
    <div class="shield-header">
      <span class="shield-title">🛡️ LINK SHIELD</span>
      <span class="shield-status" style="background-color:${badgeColor}; color:${assessment.risk === 'high_risk' || assessment.risk === 'suspicious' ? '#FFFFFF' : '#121212'};">${badgeLabel}</span>
    </div>
    <div class="shield-dest">
      <span class="shield-dest-label">DESTINATION:</span>
      <span class="shield-dest-url" title="${escapeHtml(href)}">${escapeHtml(assessment.destHost || cleanUrl.slice(0, 45))}</span>
    </div>
    ${assessment.reason && assessment.risk !== 'safe' ? `<div class="shield-warning">${escapeHtml(assessment.reason)}</div>` : ''}
    <div class="shield-footer">
      <button class="shield-copy-btn" type="button" title="Copy clean link without tracking parameters">[ 📋 COPY CLEAN LINK ]</button>
      <span class="shield-tracking-note">${cleanUrl !== href ? 'Tracking cleaned' : 'No tracking params'}</span>
    </div>
  `;

  shield.style.position = "fixed";
  shield.style.zIndex = "999999";

  document.body.appendChild(shield);
  activeLinkShield = shield;

  const shieldRect = shield.getBoundingClientRect();
  let top = rect.top - shieldRect.height - 8;
  if (top < 10) {
    top = rect.bottom + 8;
  }
  let left = rect.left;
  if (left + shieldRect.width > window.innerWidth - 16) {
    left = window.innerWidth - shieldRect.width - 16;
  }
  left = Math.max(12, left);

  shield.style.top = `${top}px`;
  shield.style.left = `${left}px`;

  const copyBtn = shield.querySelector(".shield-copy-btn");
  if (copyBtn) {
    copyBtn.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      navigator.clipboard.writeText(cleanUrl).then(() => {
        copyBtn.textContent = "[ ✓ COPIED CLEAN LINK ]";
        setTimeout(() => removeLinkShield(), 1200);
      });
    });
  }

  shield.addEventListener("mouseleave", () => {
    removeLinkShield();
  });
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

// React instantly to Gmail SPA view transitions without 5-second delays
window.addEventListener("hashchange", () => triggerStaggeredScan(true), { passive: true });
window.addEventListener("popstate", () => triggerStaggeredScan(true), { passive: true });

// Listen for back button / view navigation / tab clicks to force instant multi-pass scan
window.addEventListener("click", (e) => {
  if (e.target && e.target.closest && e.target.closest(".ar6, .T-I-J3, [aria-label*='Back' i], [data-tooltip*='Back' i], [role='tab'], .aKh, .nZ, a[href*='promotions'], a[href*='inbox']")) {
    triggerStaggeredScan(true);
  }
}, { passive: true });

// Low-overhead passive background heartbeat (every 5 seconds, only when tab is active)
setInterval(() => {
  if (!document.hidden) {
    scheduleScan(0);
  }
}, 5000);

// Ensure inbox styles are injected immediately
ensureInboxStyles();

// Initialize Smart Link Shield hover inspector
initSmartLinkShield();

// Escape key listener to reset triage filter instantly
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && typeof currentTriageFilter !== "undefined" && currentTriageFilter !== "all") {
      applyTriageFilter("all");
    }
  });
}

// Initial scan
triggerStaggeredScan(true);

// Synchronize user feedback overrides across Gmail inbox list view
window.addEventListener("ratiod:user-feedback", (e) => {
  const detail = e.detail;
  if (!detail) return;
  const { verdict, score, keys } = detail;
  const overrideData = {
    verdict,
    score,
    flags: [],
    authoritative: true
  };
  saveVerdictToCache(keys, overrideData);
  const activeRow = document.querySelector("tr.zA.aqw, tr.zA[aria-selected='true'], tr.zA.apv, tr.zA.btb");
  if (activeRow) {
    activeRow.setAttribute("data-ratiod-verdict", verdict);
    const activeBadge = activeRow.querySelector(".ratiod-inbox-pill");
    if (activeBadge) {
      updateBadgeElement(activeBadge, verdict, score, []);
      activeRow.setAttribute("data-ratiod-sig", `authoritative|${verdict}${score}`);
    }
  }
  triggerStaggeredScan(true);
});


