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
 * Normalise a thread ID into a clean canonical string.
 * Strips prefixes like 'thread-f:', 'thread-a:', 'thread-', ':', or leading '#'
 * so that Gmail's permId ('thread-f:1788192039') and legacy ID ('1788192039') map to the same key.
 */
function normalizeThreadId(id) {
  if (!id) return "";
  return String(id)
    .replace(/^#/, "")
    .replace(/^thread-[a-z]:/i, "")
    .replace(/^thread-/, "")
    .replace(/^:\w+/, "")
    .trim()
    .toLowerCase();
}

/**
 * Normalise a subject into a stable cache key.
 * Strips Ratio'd badges, bracketed tags ([External]), thread prefixes (Re:, Fwd:),
 * and trailing ellipses (...) so open-message header and inbox list-row derive identical keys.
 */
function normalizeSubjectKey(value) {
  return String(value == null ? "" : value)
    .replace(/\[\s*(?:🔴|🟠|🟡|🟢|risk|susp|promo|safe)[\s\d]*\]/gi, "")
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
      if (!k) continue;
      const rawKey = String(k).trim().toLowerCase();
      if (rawKey) {
        memVerdictCache[rawKey] = entry;
        cache[rawKey] = entry;
      }
      
      const normId = normalizeThreadId(k);
      if (normId && normId !== rawKey) {
        memVerdictCache[normId] = entry;
        cache[normId] = entry;
      }

      const cleanKey = normalizeSubjectKey(k);
      if (cleanKey) {
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
    if (!k) continue;
    const rawKey = String(k).trim().toLowerCase();
    if (rawKey) {
      if (memVerdictCache[rawKey]) return memVerdictCache[rawKey];
      if (cache[rawKey]) return cache[rawKey];
    }
    
    const normId = normalizeThreadId(k);
    if (normId) {
      if (memVerdictCache[normId]) return memVerdictCache[normId];
      if (cache[normId]) return cache[normId];
    }

    const cleanSubj = normalizeSubjectKey(k);
    if (cleanSubj) {
      if (memVerdictCache[cleanSubj]) return memVerdictCache[cleanSubj];
      if (cache[cleanSubj]) return cache[cleanSubj];

      const slice40 = cleanSubj.slice(0, 40);
      if (slice40) {
        if (memVerdictCache[slice40]) return memVerdictCache[slice40];
        if (cache[slice40]) return cache[slice40];
      }

      const slice25 = cleanSubj.slice(0, 25);
      if (slice25) {
        if (memVerdictCache[slice25]) return memVerdictCache[slice25];
        if (cache[slice25]) return cache[slice25];
      }
    }
  }
  return null;
}

function extractCleanRowSubject(row) {
  if (!row) return "";
  const subjectElem = row.querySelector("span.bog, .bog, .y6, span.bqe");
  if (!subjectElem) return "";

  const clone = subjectElem.cloneNode(true);
  clone.querySelectorAll(".ratiod-inbox-pill, [data-verdict]").forEach(p => p.remove());

  let text = clone.innerText || clone.textContent || "";
  text = text.replace(/\[\s*(?:🔴|🟠|🟡|🟢|risk|susp|promo|safe)[\s\d]*\]/gi, "").replace(/^(?:🔴|🟠|🟡|🟢)\s*/g, "").trim();
  return text;
}

function getRowIdentifiers(row) {
  const ids = [];
  const legacyId = row.getAttribute("data-legacy-thread-id");
  if (legacyId) {
    ids.push(legacyId);
    ids.push(normalizeThreadId(legacyId));
  }
  const threadId = row.getAttribute("data-thread-id");
  if (threadId) {
    ids.push(threadId);
    ids.push(normalizeThreadId(threadId));
  }
  const rowId = row.getAttribute("id");
  if (rowId) {
    ids.push(rowId);
    ids.push(normalizeThreadId(rowId));
  }
  const link = row.querySelector("a[href*='#']");
  if (link) {
    const href = link.getAttribute("href") || "";
    const hash = href.includes("#") ? href.split("#")[1] : href;
    if (hash) {
      ids.push(hash);
      const normHash = normalizeThreadId(hash);
      if (normHash) ids.push(normHash);
      const lastPart = hash.split("/").pop();
      if (lastPart && lastPart !== hash) {
        ids.push(lastPart);
        ids.push(normalizeThreadId(lastPart));
      }
    }
  }
  return [...new Set(ids.filter(Boolean))];
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
    // 2. Persist authoritative verdict to cache across all subject & thread identifiers
    const keysToSave = [];
    if (subject) keysToSave.push(subject);
    if (senderAddress) keysToSave.push(`${senderAddress}|${normalizeSubjectKey(subject)}`);

    const threadElem = document.querySelector("[data-thread-perm-id], [data-legacy-thread-id], [data-legacy-message-id]");
    if (threadElem) {
      const permId = threadElem.getAttribute("data-thread-perm-id");
      if (permId) keysToSave.push(permId);
      const legId = threadElem.getAttribute("data-legacy-thread-id");
      if (legId) keysToSave.push(legId);
      const msgId = threadElem.getAttribute("data-legacy-message-id");
      if (msgId) keysToSave.push(msgId);
    }

    if (window.location.hash) {
      const hashKey = window.location.hash.replace(/^#/, "");
      if (hashKey) {
        keysToSave.push(hashKey);
        const lastPart = hashKey.split("/").pop();
        if (lastPart) keysToSave.push(lastPart);
      }
    }

    saveVerdictToCache(keysToSave, data);

    // 3. Immediately synchronize any active row in split view
    const activeRow = document.querySelector("tr.zA.aqw, tr.zA[aria-selected='true'], tr.zA.apv, tr.zA.btb");
    if (activeRow) {
      const activeBadge = activeRow.querySelector(".ratiod-inbox-pill");
      if (activeBadge) {
        updateBadgeElement(activeBadge, data.verdict, data.score, data.flags);
        activeRow.setAttribute("data-ratiod-sig", `authoritative|${data.verdict}${data.score}`);
      }
    }

    // 4. Trigger multi-pass staggered scan to update inbox list view instantly
    triggerStaggeredScan(true);

    // 5. Update local analytics telemetry for extension popup
    recordAnalyticsScan(data, piiRedactedCount);
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
function scanInboxRows(forceUpdate = false) {
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
    const snippetElem = row.querySelector(".y2");

    const sender = senderElem ? (senderElem.getAttribute("email") || senderElem.getAttribute("title") || senderElem.innerText || "") : "";
    const subject = extractCleanRowSubject(row);
    const snippet = snippetElem ? snippetElem.innerText.trim() : "";

    const combinedText = `From: ${sender}\nSubject: ${subject}\n${snippet}`.trim();

    // Check if authoritative deep-analysis result exists in cache!
    // Try thread identifiers first, clean subject, sender|subject tuple, and normalized key.
    const rowIds = getRowIdentifiers(row);
    const cacheKey = normalizeSubjectKey(subject);
    const tupleKey = sender ? `${sender.toLowerCase().trim()}|${cacheKey}` : "";
    const lookupKeys = [...rowIds, subject, tupleKey, cacheKey].filter(Boolean);
    const cachedVerdict = getCachedVerdict(lookupKeys);

    // Fast-path: If row already processed and its text signature & cache state have not changed, skip!
    const rowSignature = `${combinedText}|${cachedVerdict ? cachedVerdict.verdict + cachedVerdict.score : 'none'}`;
    const existingBadge = row.querySelector(".ratiod-inbox-pill");
    if (!forceUpdate && existingBadge && row.getAttribute("data-ratiod-sig") === rowSignature) {
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

      // Threat / Urgency / Security Alert detection in subject or snippet
      const isUrgentOrSuspicious = /(action (needed|required)|immediate attention|update (your )?(payment|billing|card|account)|billing (problem|issue)|overdue|suspended|account (locked|restricted|disabled|hold)|security (alert|warning|notice)|unusual (activity|login|sign-in)|unauthorized access|verify (your )?(account|identity|billing)|password reset|confirm (your )?(account|identity)|2fa|critical security|suspicious activity)/i.test(combinedText);
      if (isUrgentOrSuspicious) {
        if (score < 45) {
          score = 48;
          verdict = "suspicious";
        }
        flags.unshift({
          span: "Urgent Security / Account Demand",
          reason: "Message prompts urgent action regarding account security, billing, or access restriction"
        });
      }

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

    // Mount badge as a sibling BEFORE target so it never enters span.bog.innerText
    if (target.parentNode) {
      target.parentNode.insertBefore(badge, target);
    } else if (target.prepend) {
      target.prepend(badge);
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
    if (window.requestIdleCallback) {
      window.requestIdleCallback(() => {
        executeScanPass(forceUpdate);
      }, { timeout: 250 });
    } else {
      window.requestAnimationFrame(() => {
        executeScanPass(forceUpdate);
      });
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
  const isEmailOpen = !!document.querySelector(
    ".a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, [role='main'] .a3s, .gs .ii"
  );
  if (isEmailOpen) {
    scanAndAnalyzeGmail();
  }
  scanInboxRows(forceUpdate);
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

// Listen for back button / view navigation clicks to force instant multi-pass scan
window.addEventListener("click", (e) => {
  if (e.target && e.target.closest && e.target.closest(".ar6, .T-I-J3, [aria-label*='Back' i], [data-tooltip*='Back' i]")) {
    triggerStaggeredScan(true);
  }
}, { passive: true });

// Low-overhead passive background heartbeat (every 5 seconds, only when tab is active)
setInterval(() => {
  if (!document.hidden) {
    scheduleScan(0);
  }
}, 5000);

// Initial scan
triggerStaggeredScan(true);


