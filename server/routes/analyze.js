/**
 * Ratio'd API Route: POST /analyze
 * Exact Part A.5 API Contract: Accepts { text, channel }
 */
const { evaluateRules } = require("../rules/engine");
const { evaluateLayaModel } = require("../laya/client");
const { generateExplanation } = require("../llm/explain");
const { combineScore } = require("../combine/score");
const { logPrivacyTelemetry } = require("../privacy/log");

function computePrivacyStatsFromText(text) {
  const phonesMatch = text.match(/\[PHONE_REDACTED\]|(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}/g);
  const emailsMatch = text.match(/\[EMAIL_REDACTED\]|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  const otpMatch = text.match(/\[OTP_REDACTED\]|\b(OTP|code|passcode|PIN)\b/gi);

  return {
    phones_masked: phonesMatch ? phonesMatch.length : 0,
    emails_masked: emailsMatch ? emailsMatch.length : 0,
    otp_masked: otpMatch ? otpMatch.length : 0
  };
}

async function handleAnalyze(reqBody) {
  const { text, channel = "email" } = reqBody;

  if (!text || typeof text !== "string") {
    throw new Error("Missing or invalid 'text' field in request body.");
  }

  const validChannel = (channel === "sms" || channel === "email") ? channel : "email";

  // 1. Compute privacy redaction counts on backend from incoming client-redacted telemetry
  const privacyStats = computePrivacyStatsFromText(text);

  // 2. Evaluate Rule Engine
  const { ruleScore, flags } = evaluateRules(text, validChannel);

  // 3. Evaluate Laya Model (Stating transparently whether heuristic fallback or container)
  const layaResult = await evaluateLayaModel(text, flags);

  // 4. Combine Scores & Build Next Steps
  const { score, verdict, next_steps } = combineScore(ruleScore, layaResult, validChannel, flags);

  // 5. Generate Grounded Explanation (Grounded ONLY in flags)
  const explanation = generateExplanation(verdict, flags, validChannel);

  // 6. Log Privacy Telemetry (Zero raw text persistence)
  logPrivacyTelemetry(validChannel, privacyStats);

  // 7. Return Exact Contract (Part A.5)
  return {
    score,
    verdict,
    flags,
    explanation,
    next_steps,
    privacy: privacyStats
  };
}

module.exports = { handleAnalyze };
