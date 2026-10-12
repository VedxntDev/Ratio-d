const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.jsonl");
const LEARNED_SENDERS_FILE = path.join(DATA_DIR, "learned_senders.json");

/**
 * In-memory learning store for fast query and continuous Bayesian / heuristic updates.
 */
let learnedStore = {
  senders: {},
  domains: {},
  lastSync: Date.now()
};

/**
 * Extract clean canonical email address from arbitrary sender strings.
 */
function extractCleanEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  const angleMatch = s.match(/<([^>@]+@[^>@]+)>/);
  if (angleMatch) {
    return angleMatch[1].trim().toLowerCase();
  }
  const emailMatch = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) {
    return emailMatch[1].trim().toLowerCase();
  }
  return "";
}

/**
 * Extract domain from clean email address.
 */
function extractEmailDomain(email) {
  const clean = extractCleanEmail(email);
  if (!clean || !clean.includes("@")) return "";
  return clean.split("@")[1].toLowerCase().trim();
}

/**
 * Load learned weights from disk on startup.
 */
function loadLearnedStore() {
  try {
    if (fs.existsSync(LEARNED_SENDERS_FILE)) {
      const raw = fs.readFileSync(LEARNED_SENDERS_FILE, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        learnedStore.senders = parsed.senders || {};
        learnedStore.domains = parsed.domains || {};
        learnedStore.lastSync = parsed.lastSync || Date.now();
      }
    }
  } catch (err) {
    console.warn("[RATIO'D FEEDBACK] Could not load learned_senders.json:", err.message);
  }

  // Ensure balbharat.org is always pre-seeded as verified safe domain
  if (!learnedStore.domains["balbharat.org"]) {
    learnedStore.domains["balbharat.org"] = {
      domain: "balbharat.org",
      safeCount: 500,
      promoCount: 0,
      suspiciousCount: 0,
      unsafeCount: 0,
      totalCount: 500,
      trustScore: 1.0,
      updatedAt: new Date().toISOString()
    };
  }
}

/**
 * Persist learned weights to disk.
 */
function saveLearnedStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    learnedStore.lastSync = Date.now();
    fs.writeFileSync(LEARNED_SENDERS_FILE, JSON.stringify(learnedStore, null, 2), "utf8");
  } catch (err) {
    // Read-only serverless environment safe
  }
}

// Initial load
loadLearnedStore();

/**
 * Query continuous learned sender state.
 */
function getLearnedSender(senderAddress) {
  const clean = extractCleanEmail(senderAddress);
  if (!clean) return null;
  return learnedStore.senders[clean] || null;
}

/**
 * Query continuous learned domain state.
 */
function getLearnedDomain(domain) {
  if (!domain || typeof domain !== "string") return null;
  const d = domain.toLowerCase().trim();
  return learnedStore.domains[d] || null;
}

/**
 * Update continuous learning model given a new user feedback observation.
 */
function recordContinuousLearning(senderRaw, feedbackType, originalVerdict, originalScore) {
  const cleanEmail = extractCleanEmail(senderRaw);
  if (!cleanEmail) return null;

  const domain = extractEmailDomain(cleanEmail);
  const now = new Date().toISOString();

  // Initialize or fetch sender profile
  if (!learnedStore.senders[cleanEmail]) {
    learnedStore.senders[cleanEmail] = {
      sender: cleanEmail,
      domain: domain,
      lastVerdict: feedbackType === "safe" ? "safe" : (feedbackType === "promo" ? "promo_clutter" : (feedbackType === "suspicious" ? "suspicious" : "high_risk")),
      lastFeedback: feedbackType,
      safeCount: 0,
      promoCount: 0,
      suspiciousCount: 0,
      unsafeCount: 0,
      totalCount: 0,
      trustScore: 0.5,
      updatedAt: now
    };
  }

  const s = learnedStore.senders[cleanEmail];
  s.totalCount = (s.totalCount || 0) + 1;
  if (feedbackType === "safe") s.safeCount = (s.safeCount || 0) + 1;
  else if (feedbackType === "promo") s.promoCount = (s.promoCount || 0) + 1;
  else if (feedbackType === "suspicious") s.suspiciousCount = (s.suspiciousCount || 0) + 1;
  else if (feedbackType === "unsafe" || feedbackType === "phishing") s.unsafeCount = (s.unsafeCount || 0) + 1;

  s.lastFeedback = feedbackType;
  s.lastVerdict = feedbackType === "safe"
    ? "safe"
    : (feedbackType === "promo"
      ? "promo_clutter"
      : (feedbackType === "suspicious" ? "suspicious" : "high_risk"));
  s.updatedAt = now;

  // Bayesian trust score update
  const total = s.totalCount;
  s.trustScore = Math.max(0, Math.min(1, (s.safeCount * 1.0 + s.promoCount * 0.7 - s.suspiciousCount * 0.5 - s.unsafeCount * 1.0) / total));

  // Domain-level aggregation
  if (domain) {
    if (!learnedStore.domains[domain]) {
      learnedStore.domains[domain] = {
        domain: domain,
        safeCount: 0,
        promoCount: 0,
        suspiciousCount: 0,
        unsafeCount: 0,
        totalCount: 0,
        trustScore: 0.5,
        updatedAt: now
      };
    }
    const d = learnedStore.domains[domain];
    d.totalCount = (d.totalCount || 0) + 1;
    if (feedbackType === "safe") d.safeCount = (d.safeCount || 0) + 1;
    else if (feedbackType === "promo") d.promoCount = (d.promoCount || 0) + 1;
    else if (feedbackType === "suspicious") d.suspiciousCount = (d.suspiciousCount || 0) + 1;
    else if (feedbackType === "unsafe" || feedbackType === "phishing") d.unsafeCount = (d.unsafeCount || 0) + 1;
    d.updatedAt = now;
    d.trustScore = Math.max(0, Math.min(1, (d.safeCount * 1.0 + d.promoCount * 0.7 - d.suspiciousCount * 0.5 - d.unsafeCount * 1.0) / d.totalCount));
  }

  saveLearnedStore();
  return s;
}

/**
 * Handle user feedback submitted directly from the extension banner or console.
 */
function handleFeedback(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const feedbackType = String(payload.feedback || payload.type || "").toLowerCase().trim();

      if (!feedbackType || !["safe", "unsafe", "promo", "phishing", "suspicious"].includes(feedbackType)) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({
          error: "Invalid feedback type. Expected: 'safe', 'unsafe', 'promo', 'suspicious', or 'phishing'."
        }));
      }

      const senderRaw = typeof payload.sender === "string" ? payload.sender.slice(0, 150) : null;
      const cleanSender = extractCleanEmail(senderRaw);

      const record = {
        id: "fb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        feedback: feedbackType,
        originalVerdict: payload.originalVerdict || null,
        originalScore: payload.originalScore !== undefined ? payload.originalScore : null,
        sender: senderRaw,
        cleanSender: cleanSender || null,
        domain: cleanSender ? extractEmailDomain(cleanSender) : null,
        subject: typeof payload.subject === "string" ? payload.subject.slice(0, 200) : null,
        flags: Array.isArray(payload.flags) ? payload.flags.slice(0, 20) : [],
        note: typeof payload.note === "string" ? payload.note.slice(0, 500) : null,
        timestamp: new Date().toISOString()
      };

      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(record) + "\n", "utf8");
      } catch (fileErr) {
        console.warn("[RATIO'D FEEDBACK] Could not persist feedback record to disk:", fileErr.message);
      }

      // Update continuous learning model weights
      const learnedResult = recordContinuousLearning(senderRaw, feedbackType, record.originalVerdict, record.originalScore);

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        success: true,
        message: "Thank you! Your feedback has been recorded and the continuous model has learned from it.",
        id: record.id,
        feedback: record.feedback,
        learnedSender: learnedResult ? {
          sender: learnedResult.sender,
          verdict: learnedResult.lastVerdict,
          trustScore: learnedResult.trustScore
        } : null
      }));
    } catch (err) {
      console.error("[RATIO'D FEEDBACK] Error parsing feedback payload:", err);
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Invalid JSON payload" }));
    }
  });
}

/**
 * Handle GET /feedback/learned endpoint to sync continuous learning weights to extensions.
 */
function handleGetLearnedSenders(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "public, max-age=15"
  });
  return res.end(JSON.stringify({
    success: true,
    lastSync: learnedStore.lastSync,
    senders: learnedStore.senders,
    domains: learnedStore.domains
  }));
}

module.exports = {
  handleFeedback,
  handleGetLearnedSenders,
  getLearnedSender,
  getLearnedDomain,
  extractCleanEmail,
  extractEmailDomain,
  recordContinuousLearning,
  FEEDBACK_FILE,
  LEARNED_SENDERS_FILE
};
