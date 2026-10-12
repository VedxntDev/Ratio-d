/**
 * Ratio'd API Route: POST /analyze
 * Exact Part A.5 API Contract: Accepts { text, channel }
 */
const { evaluateRules } = require("../rules/engine");
const { evaluateLayaModel } = require("../laya/client");
const { generateExplanation } = require("../llm/explain");
const { combineScore } = require("../combine/score");
const { logPrivacyTelemetry } = require("../privacy/log");
const { getLearnedSender } = require("./feedback");

function computePrivacyStatsFromText(text) {
  const phonesMatch = text.match(/\[PHONE_REDACTED\]|(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g);
  const emailsMatch = text.match(/\[EMAIL_REDACTED\]|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const otpMatch = text.match(/\[OTP_REDACTED\]|\b(OTP|code|passcode|PIN)\b(?:\s+(?:is|was|:|-))?\s*:?\s*(\d{4,8})\b/gi);

  return {
    phones_masked: phonesMatch ? phonesMatch.length : 0,
    emails_masked: emailsMatch ? emailsMatch.length : 0,
    otp_masked: otpMatch ? otpMatch.length : 0
  };
}

async function handleAnalyze(reqBody) {
  const startedAt = Date.now();
  const { text, channel = "email", auth: rawAuth, senderAddress, senderName } = reqBody;

  if (!text || typeof text !== "string") {
    throw new Error("Missing or invalid 'text' field in request body.");
  }

  const validChannel = (channel === "sms" || channel === "email") ? channel : "email";

  const cleanSenderAddress = (typeof senderAddress === "string") ? senderAddress.trim() : "";
  const cleanSenderName = (typeof senderName === "string") ? senderName.trim() : "";
  const senderInfo = (cleanSenderAddress || cleanSenderName)
    ? { senderAddress: cleanSenderAddress, senderName: cleanSenderName }
    : null;

  // Sanitize authentication payload if present
  let auth = null;
  if (rawAuth && typeof rawAuth === "object") {
    const sanitizeStr = (s) => {
      if (!s || typeof s !== "string") return null;
      const clean = s.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      return clean.length > 0 ? clean : null;
    };
    const fromDomain = sanitizeStr(rawAuth.fromDomain);
    const mailedBy = sanitizeStr(rawAuth.mailedBy);
    const signedBy = sanitizeStr(rawAuth.signedBy);
    const dmarc = sanitizeStr(rawAuth.dmarc);
    const spf = sanitizeStr(rawAuth.spf);
    const dkim = sanitizeStr(rawAuth.dkim);

    if (fromDomain || mailedBy || signedBy || dmarc || spf || dkim) {
      auth = { fromDomain, mailedBy, signedBy, dmarc, spf, dkim };
    }
  }

  // 1. Compute privacy redaction counts on backend from incoming client-redacted telemetry
  const privacyStats = computePrivacyStatsFromText(text);

  // 2. Evaluate Rule Engine
  const { ruleScore, flags, isPromoClutter, isAuthDisqualified, authSummary } = evaluateRules(text, validChannel, auth, senderInfo);

  // 3. Evaluate Laya Model (Stating transparently whether heuristic fallback or container)
  const layaResult = await evaluateLayaModel(text, flags);

  // 4. Combine Scores & Build Next Steps
  const { score, verdict, next_steps } = combineScore(ruleScore, layaResult, validChannel, flags, isPromoClutter, isAuthDisqualified);

  // 4b. Continuous Learned Sender Preferences & Online Learning Arbitration
  let finalScore = score;
  let finalVerdict = verdict;
  let learnedExplanation = null;

  const canonicalSender = cleanSenderAddress || (senderInfo ? senderInfo.senderAddress : "");
  const learnedSender = canonicalSender ? getLearnedSender(canonicalSender) : null;

  if (learnedSender && !isAuthDisqualified) {
    if (learnedSender.lastFeedback === "safe" || learnedSender.trustScore >= 0.8) {
      finalVerdict = "safe";
      finalScore = 0;
      learnedExplanation = `Sender learned as SAFE: Continuous feedback recorded for ${learnedSender.sender}. Verified safe per user preference.`;
    } else if (learnedSender.lastFeedback === "promo") {
      finalVerdict = "promo_clutter";
      finalScore = 25;
      learnedExplanation = `Sender learned as PROMOTIONAL: Commercial marketing/newsletter per continuous learning for ${learnedSender.sender}.`;
    } else if (learnedSender.lastFeedback === "unsafe" || learnedSender.lastFeedback === "phishing") {
      finalVerdict = "high_risk";
      finalScore = 85;
      learnedExplanation = `Sender learned as UNSAFE: Previously flagged as phishing/threat for ${learnedSender.sender}.`;
    }
  }

  // 5. Generate Grounded Explanation.
  const { explanation, source: explainSource, model: explainModel } =
    await generateExplanation(finalVerdict, flags, validChannel, text);

  // 6. Log Privacy Telemetry (Zero raw text persistence)
  logPrivacyTelemetry(validChannel, privacyStats);

  return {
    score: finalScore,
    verdict: finalVerdict,
    flags,
    explanation: learnedExplanation || explanation,
    next_steps,
    privacy: privacyStats,
    auth: authSummary || null,
    engine: {
      rules: "deterministic-homoglyph-levenshtein",
      rule_flags: flags.length,
      auth_status: authSummary ? authSummary.status : "unverified",
      model_name: "vegaml",
      model_source: layaResult.source,
      model_label: layaResult.label,
      model_probability: layaResult.probability,
      model_threat_category: layaResult.threat_category || "safe",
      model_conformal_set: layaResult.conformal_set || [layaResult.label || "safe"],
      model_abstain: Boolean(layaResult.abstain),
      model_kinetic_energy: layaResult.kinetic_energy || 0.0,
      model_temperature: layaResult.temperature || 1.0,
      model_signals: layaResult.signals || [],
      model_note: layaResult.note,
      explain: "grounded-in-flags",
      explain_source: explainSource,
      explain_model: explainModel,
      latency_ms: Date.now() - startedAt
    }
  };
}

module.exports = { handleAnalyze };
