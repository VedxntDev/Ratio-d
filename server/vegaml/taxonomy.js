/**
 * Ratio'd VegaML Email Threat Taxonomy & Feature Projections
 * Defines typed decision questions, answer criteria, and projections from
 * email observation features into Hamiltonian latent physical initial conditions.
 */

const { DIM } = require("./physics");

/**
 * High-precision structural threat signals.
 * Each pattern represents concrete adversarial indicators that legitimate mail avoids.
 */
const STRUCTURAL_SIGNALS = [
  {
    name: "punycode_host",
    weight: 0.34,
    test: (t) => /https?:\/\/[^\s/]*xn--/i.test(t),
    category: "impersonation_spoof",
    reason: "Punycode/IDN homoglyph lookalike domain"
  },
  {
    name: "ip_literal_link",
    weight: 0.34,
    test: (t) => /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(t),
    category: "credential_phish",
    reason: "Direct IP address URL bypassing domain reputation"
  },
  {
    name: "data_uri",
    weight: 0.30,
    test: (t) => /data:(text\/html|application\/javascript|;base64)/i.test(t),
    category: "credential_phish",
    reason: "Embedded data: URI payload avoiding link inspection"
  },
  {
    name: "base64_blob",
    weight: 0.24,
    test: (t) => /[A-Za-z0-9+/]{120,}={0,2}/.test(t),
    category: "credential_phish",
    reason: "Obfuscated high-entropy base64 data stream"
  },
  {
    name: "credential_or_wire",
    weight: 0.20,
    test: (t) =>
      /(verify|confirm|update|validate|secure)\s+(your\s+)?(account|password|credentials|details|information)/i.test(t) ||
      /(gift\s?card|bitcoin|crypto|wire\s+transfer|western\s+union|money\s+gram)/i.test(t),
    category: "financial_fraud",
    reason: "Credential harvesting demand or unrecoverable payment request"
  },
  {
    name: "link_farm",
    weight: 0.18,
    test: (t) => {
      const hosts = new Set((t.match(/https?:\/\/([^\s/?#]+)/gi) || []).map((u) => u.replace(/^https?:\/\//i, "").toLowerCase()));
      return hosts.size >= 5;
    },
    category: "credential_phish",
    reason: "High-density link farm with disparate outbound host targets"
  },
  {
    name: "free_abuse_hosting",
    weight: 0.26,
    test: (t) => /unicornplatform\.page|firebaseapp\.com|amazonaws\.com\/cld|\.xrea\.com|fanlink\.to|kazmatix\.com|pages\.dev|web\.app/i.test(t),
    category: "credential_phish",
    reason: "Free ephemeral cloud hosting masking deceptive lure"
  },
  {
    name: "reply_to_mismatch",
    weight: 0.30,
    test: (t) => {
      const fromMatch = t.match(/^From:[ \t]*.*?@([a-zA-Z0-9.-]+)/im);
      const replyMatch = t.match(/^Reply-To:[ \t]*.*?@([a-zA-Z0-9.-]+)/im);
      if (fromMatch && replyMatch) {
        return fromMatch[1].toLowerCase() !== replyMatch[1].toLowerCase();
      }
      return false;
    },
    category: "impersonation_spoof",
    reason: "Discrepancy between sender display domain and reply-to destination"
  },
  {
    name: "delivery_fee_bait",
    weight: 0.28,
    test: (t) => /(delivery\s+failed|package\s+(held|on\s+hold)|shipping\s+fee|customs\s+(duty|charge)|reschedule\s+delivery)/i.test(t),
    category: "delivery_fraud",
    reason: "Package delivery fee or courier hold pretext"
  },
  {
    name: "fake_invoice_scare",
    weight: 0.26,
    test: (t) => /(invoice\s+#?\d+|order\s+confirmed|auto-renewal|charged\s+\$\d+|subscription\s+(ends|renewal)|refund\s+processing)/i.test(t),
    category: "billing_bait",
    reason: "Bogus order confirmation, invoice, or auto-renewal scare"
  },
  {
    name: "edtech_marketing_pitch",
    weight: 0.16,
    test: (t) => /\b(?:\d+[\d,]*\+?\s*(?:students|learners|graduates|candidates)\s*(?:hired|placed)|\d+[\d,]*\+?\s*(?:companies|hiring\s+partners)|(?:crack|master|ace|prepare\s+for)\s+(?:[a-z\s]{0,25})interviews?|masterclass|bootcamp)\b/i.test(t),
    category: "promo_clutter",
    reason: "EdTech placement record brag or career interview prep pitch"
  },
  {
    name: "retail_promo_offer",
    weight: 0.16,
    test: (t) => /\b(?:\d+%\s*(?:off|discount)|coupon\s+code|[A-Z0-9]{4,10}\s+at\s+checkout|strategy\s+for\s+(?:a\s+)?wardrobe|wardrobe\s+strategy|explore\s+collection|shop\s+now|clearance\s+sale)\b/i.test(t),
    category: "promo_clutter",
    reason: "Retail discount sale promotion, coupon code, or wardrobe merchandising"
  },
  {
    name: "content_digest_newsletter",
    weight: 0.12,
    test: (t) => /\b(?:daily|weekly|monthly)\s+(?:global\s+)?market\s+(?:commentary|overview|recap|insights)|vested\s+shorts|tldr\s+tech|morning\s+brew|stories\s+for\s+[a-z]+:.*?recommended\s+reads\b/is.test(t),
    category: "promo_clutter",
    reason: "Commercial market commentary or newsletter digest"
  }
];

/**
 * Standard VegaML typed questions for Email Threat Assessment
 */
const VEGA_QUESTIONS = {
  threat_category: {
    type: "choice",
    instructions: "Which category best classifies this message?",
    criteria: {
      safe: "legitimate personal, transactional, or operational correspondence",
      promo_clutter: "commercial marketing, newsletters, coupons, or sales campaigns",
      credential_phish: "attempts to capture passwords, MFA codes, or login credentials",
      financial_fraud: "unsolicited money transfers, gift cards, crypto, lottery, or fee fraud",
      impersonation_spoof: "impersonates a trusted brand, executive, or institutional domain",
      delivery_fraud: "courier, parcel hold, or fake postal delivery fee notice",
      billing_bait: "unsolicited invoices, fake charges, or subscription renewal alerts"
    }
  },
  is_threat: {
    type: "boolean",
    instructions: "Does this email pose a fraudulent, deceptive, or security threat to the recipient?",
    criteria: {
      true: "contains deceptive phishing, scam, extortion, or credential harvesting indicators",
      false: "authentic, safe, benign transactional, or routine correspondence"
    }
  },
  urgency_level: {
    type: "choice",
    instructions: "What degree of psychological urgency or time coercion does this message exert?",
    criteria: {
      none: "no artificial deadline or coercion",
      moderate: "standard business timeframe or conversational notice",
      high: "urgent action demanded within hours or threatened penalty",
      critical: "immediate ultimatum, account suspension, or loss of access threatened"
    }
  }
};

/**
 * Map text and extracted structural signals into initial Hamiltonian particle position z0,
 * momentum p0, and potential well depth adjustments.
 */
function projectObservationToPhysics(text, ruleFlags = [], triggeredSignals = [], centres = null) {
  const z0 = new Float64Array(DIM);
  const p0 = new Float64Array(DIM);

  if (!text || typeof text !== "string") {
    return { z0, p0, threatMass: 0, threatWeights: { safe: 2.0 }, signalNames: [] };
  }

  const lower = text.toLowerCase();
  let threatMass = 0;

  const threatWeights = {
    safe: 1.2,
    promo_clutter: 0.1,
    credential_phish: 0.05,
    financial_fraud: 0.05,
    impersonation_spoof: 0.05,
    delivery_fraud: 0.05,
    billing_bait: 0.05
  };

  // 1. Accumulate weight from triggered structural signals
  for (const sig of triggeredSignals) {
    threatMass += sig.weight;
    if (threatWeights[sig.category] !== undefined) {
      threatWeights[sig.category] += sig.weight * 3.0;
    }
  }

  // 2. Accumulate weight from deterministic rule flags
  if (ruleFlags && ruleFlags.length > 0) {
    threatMass += ruleFlags.length * 0.22;
    for (const flag of ruleFlags) {
      const r = (flag.reason || "").toLowerCase();
      if (r.includes("homoglyph") || r.includes("typosquat") || r.includes("impersonation")) {
        threatWeights.impersonation_spoof += 1.2;
      }
      if (r.includes("credential") || r.includes("login") || r.includes("otp") || r.includes("password")) {
        threatWeights.credential_phish += 1.2;
      }
      if (r.includes("promo") || flag.type === "promo" || r.includes("unsubscribe")) {
        threatWeights.promo_clutter += 1.0;
      }
      if (r.includes("delivery") || r.includes("package") || r.includes("customs")) {
        threatWeights.delivery_fraud += 1.0;
      }
    }
  }

  // 3. Keyword density impulse
  const highRiskTokens = ["urgent", "verify", "suspended", "password", "ssn", "wire", "login", "bit.ly", "action required"];
  let matchedTokens = 0;
  for (const tok of highRiskTokens) {
    if (lower.includes(tok)) matchedTokens++;
  }
  threatMass += matchedTokens * 0.14;

  if (threatMass > 0.3) {
    threatWeights.safe = Math.max(0.02, 1.2 - threatMass * 1.5);
  } else {
    const isPromoSignal = triggeredSignals.some(s => s.category === "promo_clutter");
    const isPromoText = /\b(?:unsubscribe|newsletter|digest|coupon|discount|students hired|companies|wardrobe|market commentary)\b/i.test(lower);
    if (isPromoSignal || isPromoText) {
      threatWeights.promo_clutter += 2.0;
      threatWeights.safe = Math.max(0.05, 1.2 - 0.7);
    }
  }

  // Sublinear damping for excessive signals
  if (triggeredSignals.length > 2) {
    threatMass -= (triggeredSignals.length - 2) * 0.06;
  }

  // 4. Project z0 directly toward the weighted candidate centres
  if (centres && centres.length > 0) {
    const options = Object.keys(threatWeights);
    let totalW = 0;
    for (let k = 0; k < options.length && k < centres.length; k++) {
      const w = Math.max(0.01, threatWeights[options[k]] || 0.01);
      totalW += w;
      for (let d = 0; d < DIM; d++) {
        z0[d] += w * centres[k][d];
      }
    }
    if (totalW > 0) {
      for (let d = 0; d < DIM; d++) {
        z0[d] /= totalW;
      }
    }
  }

  // Small momentum perturbation
  for (let d = 0; d < DIM; d++) {
    p0[d] = 0.05 * Math.sin((d + 1) * (matchedTokens + 1));
  }

  return {
    z0,
    p0,
    threatMass: Math.max(0, parseFloat(threatMass.toFixed(3))),
    threatWeights
  };
}

module.exports = {
  STRUCTURAL_SIGNALS,
  VEGA_QUESTIONS,
  projectObservationToPhysics
};
