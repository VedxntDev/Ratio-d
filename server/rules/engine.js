/**
 * Deterministic Channel-Aware Rule Engine for Ratio'd
 * Evaluates message text for scam, phishing, and promotional spam threat vectors.
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
  { regex: /final notice|last warning/i, reason: "Escalating panic phrase" },
  { regex: /deactivation imminent/i, reason: "Urgent account loss threat" }
];

const CREDENTIAL_PAYMENT_PATTERNS = [
  { regex: /enter your (password|pin|social security|ssn|passcode)/i, reason: "Credential harvesting request" },
  { regex: /provide (your )?(otp|one-time password|verification code|security code)/i, reason: "Authentication OTP theft attempt" },
  { regex: /wire transfer|send money|gift card|apple gift card|bitcoin|crypto|usdt/i, reason: "Untraceable payment demand" },
  { regex: /confirm your (card number|cvv|billing info|banking details)/i, reason: "Payment card data request" }
];

const MARKETING_PROMO_PATTERNS = [
  { regex: /unsubscribe/i, reason: "Unsubscribe link (Marketing / Newsletter Blast)" },
  { regex: /noreply@[a-z0-9.-]+\.(news|club|top|xyz|info|promo|tech)/i, reason: "Mass promotional sender domain" },
  { regex: /apply (today|now)|register (now|today)|join [a-z0-9]+ (today|now)/i, reason: "Mass promotional call to action" },
  { regex: /opportunity|hiring now|exclusive invite|limited seats|explore how/i, reason: "Promotional marketing pitch" }
];

const SUSPICIOUS_DOMAINS = [
  { regex: /[a-z0-9-]+\.(xyz|top|tk|club|work|gq|cf|ml|monster|rest|hair|cfd|news)/i, reason: "High-risk or mass-marketing top-level domain (TLD)" },
  { regex: /paypa[1l|i]-?sec/i, reason: "Lookalike domain spoofing PayPal" },
  { regex: /secur1ty|bank-?verify|login-?update|auth-?alert/i, reason: "Lookalike domain imitating security portal" },
  { regex: /app1e|appie|g00gle|micr0soft|amaz0n|netf1ix/i, reason: "Character-substitution brand spoofing" },
  { regex: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, reason: "Raw IP address URL instead of domain" }
];

const LINK_SHORTENERS = [
  { regex: /(bit\.ly|tinyurl\.com|t\.co|is\.gd|rb\.gy|cutt\.ly|tiny\.cc)\/[a-z0-9]+/i, reason: "Shortened link hiding destination" }
];

function evaluateRules(text, channel = "email") {
  const flags = [];
  let rawScore = 0;

  if (!text || typeof text !== "string") {
    return { ruleScore: 0, flags: [] };
  }

  // 1. Urgency Phrasing Checks
  for (const pattern of URGENCY_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({
        span: match[0],
        reason: pattern.reason,
        type: "rule"
      });
      rawScore += 20;
    }
  }

  // 2. Credential & Payment Request Checks
  for (const pattern of CREDENTIAL_PAYMENT_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({
        span: match[0],
        reason: pattern.reason,
        type: "rule"
      });
      rawScore += 25;
    }
  }

  // 3. Marketing & Promotional Spam Checks
  let promoMatches = 0;
  for (const pattern of MARKETING_PROMO_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({
        span: match[0],
        reason: pattern.reason,
        type: "rule"
      });
      promoMatches++;
      rawScore += 12;
    }
  }

  // 4. Domain & URL Integrity Checks
  for (const pattern of SUSPICIOUS_DOMAINS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({
        span: match[0],
        reason: pattern.reason,
        type: "rule"
      });
      rawScore += 25;
    }
  }

  // 5. Shortened / Obfuscated Links
  for (const pattern of LINK_SHORTENERS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({
        span: match[0],
        reason: pattern.reason,
        type: "rule"
      });
      rawScore += 15;
    }
  }

  // Mismatched links check
  const markdownLinkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let mdMatch;
  while ((mdMatch = markdownLinkRegex.exec(text)) !== null) {
    const visibleText = mdMatch[1];
    const actualHref = mdMatch[2];
    if (visibleText.includes("http") || visibleText.includes(".com") || visibleText.includes(".org")) {
      try {
        const visibleHost = new URL(visibleText.startsWith("http") ? visibleText : `https://${visibleText}`).hostname;
        const actualHost = new URL(actualHref).hostname;
        if (visibleHost !== actualHost) {
          flags.push({
            span: mdMatch[0],
            reason: `Link mismatch: claims to go to '${visibleHost}' but points to '${actualHost}'`,
            type: "rule"
          });
          rawScore += 35;
        }
      } catch (e) {}
    }
  }

  const finalRuleScore = Math.min(100, rawScore);
  return {
    ruleScore: finalRuleScore,
    flags
  };
}

module.exports = { evaluateRules };
