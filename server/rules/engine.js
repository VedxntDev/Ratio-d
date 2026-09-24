/**
 * Deterministic Channel-Aware Rule Engine for Ratio'd
 * Evaluates messages for Phishing Scams AND Post-Registration Promotional Clutter.
 */

const URGENCY_PATTERNS = [
  { regex: /act now/i, reason: "Urgency phrasing ('act now')" },
  { regex: /click here (immediately|now|within \d+ (hours?|mins?|minutes?))/i, reason: "Time-pressure call to action" },
  { regex: /within \d+ (hours?|mins?|minutes?)/i, reason: "Psychological time constraint" },
  { regex: /account (suspended|locked|terminated|restricted|disabled)/i, reason: "Fear trigger: account suspension warning" },
  { regex: /unauthorized (access|login|transaction|charge|activity)/i, reason: "Fear trigger: unauthorized activity alarm" },
  { regex: /immediate action required/i, reason: "High-urgency action demand" },
  { regex: /verify (immediately|your account|your identity|now)/i, reason: "Urgent credential verification demand" },
  { regex: /legal action|police|warrant|lawsuit/i, reason: "Coercion trigger: legal threat" },
  { regex: /final notice|last warning/i, reason: "Escalating panic phrase" }
];

const CREDENTIAL_PAYMENT_PATTERNS = [
  { regex: /enter your (password|pin|social security|ssn|passcode)/i, reason: "Credential harvesting request" },
  { regex: /provide (your )?(otp|one-time password|verification code|security code)/i, reason: "Authentication OTP theft attempt" },
  { regex: /wire transfer|send money|gift card|apple gift card|bitcoin|crypto|usdt/i, reason: "Untraceable payment demand" }
];

const PROMOTIONAL_CLUTTER_PATTERNS = [
  { regex: /unsubscribe/i, reason: "Post-registration promotional newsletter link" },
  { regex: /noreply@[a-z0-9.-]+\.(news|club|top|xyz|info|promo|tech|com)/i, reason: "Automated post-registration marketing sender" },
  { regex: /apply (today|now)|register (now|today)|join [a-z0-9]+ (today|now)/i, reason: "Post-task marketing call to action" },
  { regex: /opportunity|hiring now|exclusive invite|limited seats|explore how|we found/i, reason: "Post-signup promotional marketing blast" },
  { regex: /upgrade to (pro|premium)|special offer|% off|discount code/i, reason: "Post-registration upsell marketing pitch" }
];

const SUSPICIOUS_DOMAINS = [
  { regex: /[a-z0-9-]+\.(xyz|top|tk|club|work|gq|cf|ml|monster|rest|hair|cfd)/i, reason: "High-risk top-level domain (TLD)" },
  { regex: /paypa[1l|i]-?sec/i, reason: "Lookalike domain spoofing PayPal" },
  { regex: /secur1ty|bank-?verify|login-?update|auth-?alert/i, reason: "Lookalike domain imitating security portal" },
  { regex: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, reason: "Raw IP address URL instead of domain" }
];

function evaluateRules(text, channel = "email") {
  const flags = [];
  let rawScore = 0;
  let isPromoClutter = false;

  if (!text || typeof text !== "string") {
    return { ruleScore: 0, flags: [] };
  }

  // 1. Phishing & Credential Theft Rules
  for (const pattern of URGENCY_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 25;
    }
  }

  for (const pattern of CREDENTIAL_PAYMENT_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 30;
    }
  }

  for (const pattern of SUSPICIOUS_DOMAINS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 35;
    }
  }

  // 2. Post-Registration Promotional Clutter Rules
  let promoCount = 0;
  for (const pattern of PROMOTIONAL_CLUTTER_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "promo" });
      promoCount++;
    }
  }

  if (promoCount >= 2 && rawScore < 40) {
    isPromoClutter = true;
    rawScore = Math.max(45, rawScore + (promoCount * 12));
  }

  const finalRuleScore = Math.min(100, rawScore);
  return {
    ruleScore: finalRuleScore,
    flags,
    isPromoClutter
  };
}

module.exports = { evaluateRules };
