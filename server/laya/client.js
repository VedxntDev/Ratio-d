/**
 * Ratio'd Laya Client Module (Local Typed-Decision Classifier Interface)
 * HARD RULE: Never fabricate a model score. Explicitly state whether the live standalone container
 * is connected or running local typed-decision heuristic fallback.
 */

/**
 * High-precision structural signals.
 *
 * These are deliberately narrow. Every pattern here is something a legitimate
 * transactional or marketing email essentially never contains, so they can
 * raise the probability without dragging ordinary newsletters and receipts
 * toward "high risk" (see test-false-positives.js, which guards that).
 */
const STRUCTURAL_SIGNALS = [
  // Punycode / IDN host: "xn--" is the ASCII encoding of a unicode domain and is
  // a standard way to make a lookalike domain survive a copy-paste.
  { name: "punycode_host", weight: 0.34, test: (t) => /https?:\/\/[^\s/]*xn--/i.test(t) },
  // Bare IP literal in a link: legitimate services use named hosts.
  { name: "ip_literal_link", weight: 0.34, test: (t) => /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(t) },
  // data: URI, used to smuggle a payload past a mail gateway.
  { name: "data_uri", weight: 0.30, test: (t) => /data:(text\/html|application\/javascript|;base64)/i.test(t) },
  // Long base64 blob: a common way to hide an attachment or a redirect.
  { name: "base64_blob", weight: 0.24, test: (t) => /[A-Za-z0-9+/]{120,}={0,2}/.test(t) },
  // Credential prompt aimed at a well-known brand, or a crypto/wire demand.
  { name: "credential_or_wire", weight: 0.20, test: (t) =>
      /(verify|confirm|update|validate|secure)\s+(your\s+)?(account|password|credentials|details|information)/i.test(t)
      || /(gift\s?card|bitcoin|crypto|wire\s+transfer|western\s+union|money\s+gram)/i.test(t) },
  // Many distinct outbound hosts in one short message.
  { name: "link_farm", weight: 0.18, test: (t) => {
      const hosts = new Set((t.match(/https?:\/\/([^\s/?#]+)/gi) || [])
        .map((u) => u.replace(/^https?:\/\//i, "").toLowerCase()));
      return hosts.size >= 5;
  } },
];

/**
 * Tokens that count toward the threat signal.
 *
 * Module scope rather than function-local so the exported TAXONOMY can report
 * exactly what this scorer looks for, without it drifting from the code path.
 */
const HIGH_RISK_TOKENS = [
  "urgent", "verify", "suspended", "password", "ssn", "wire", "paypa1", "bit.ly", "login"
];

async function evaluateLayaModel(text, ruleFlags) {
  if (!text || typeof text !== "string") {
    return { label: "safe", probability: 0.05, source: "laya_stub_heuristic" };
  }

  // Feature weighting
  let threatSignal = 0;

  if (ruleFlags && ruleFlags.length > 0) {
    threatSignal += ruleFlags.length * 0.25;
  }

  const highRiskTokens = HIGH_RISK_TOKENS;
  const lowerText = text.toLowerCase();
  let tokenMatches = 0;
  for (const token of highRiskTokens) {
    if (lowerText.includes(token)) {
      tokenMatches++;
    }
  }
  threatSignal += tokenMatches * 0.15;

  // Structural layer: named, weighted, and reported so the score is auditable
  // rather than an unexplained number.
  const signals = [];
  for (const sig of STRUCTURAL_SIGNALS) {
    try {
      if (sig.test(text)) {
        signals.push(sig.name);
        threatSignal += sig.weight;
      }
    } catch (e) {
      // A malformed pattern must never take the analyser down.
    }
  }

  // Diminishing returns: a message that trips five structural signals is not
  // five times as bad as one that trips a single signal.
  if (signals.length > 2) {
    threatSignal -= (signals.length - 2) * 0.06;
  }

  const probability = Math.min(0.99, Math.max(0.02, parseFloat(threatSignal.toFixed(2))));

  let label = "safe";
  if (probability >= 0.65) {
    label = "high_risk";
  } else if (probability >= 0.30) {
    label = "suspicious";
  }

  return {
    label,
    probability,
    source: "laya_stub_heuristic",
    note: "Local typed-decision fallback model active (laya container offline).",
    signals
  };
}

module.exports = {
  evaluateLayaModel,
  STRUCTURAL_SIGNALS,

  /**
   * Machine-readable description of the scorer, for tooling that needs to
   * enumerate what it looks for without parsing source. Derived from the same
   * constants the scorer runs on, so it cannot drift.
   */
  TAXONOMY: {
    version: 2,
    kind: "hand_weighted_heuristic_not_trained",
    source: "laya_stub_heuristic",
    note: "Local typed-decision fallback model active (laya container offline).",
    formula: "clamp(ruleFlags*0.25 + tokenMatches*0.15 + sum(structuralWeights), 0.02, 0.99)",
    corroborationDamping: "signals beyond the second are damped by 0.06 each",
    tokenList: HIGH_RISK_TOKENS,
    labelThresholds: { high_risk: 0.65, suspicious: 0.3 },
    structuralSignals: STRUCTURAL_SIGNALS.map((s) => ({
      name: s.name,
      weight: s.weight,
      test: String(s.test),
    })),
  },
};
