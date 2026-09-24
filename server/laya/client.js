/**
 * Ratio'd Laya Client Module (Local Typed-Decision Classifier Interface)
 * HARD RULE: Never fabricate a model score. Explicitly state whether the live standalone container 
 * is connected or running local typed-decision heuristic fallback.
 */

async function evaluateLayaModel(text, ruleFlags) {
  if (!text || typeof text !== "string") {
    return { label: "safe", probability: 0.05, source: "laya_stub_heuristic" };
  }

  // Feature weighting
  let threatSignal = 0;

  if (ruleFlags && ruleFlags.length > 0) {
    threatSignal += ruleFlags.length * 0.25;
  }

  const highRiskTokens = ["urgent", "verify", "suspended", "password", "ssn", "wire", "paypa1", "bit.ly", "login"];
  const lowerText = text.toLowerCase();
  let tokenMatches = 0;
  for (const token of highRiskTokens) {
    if (lowerText.includes(token)) {
      tokenMatches++;
    }
  }
  threatSignal += tokenMatches * 0.15;

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
    note: "Local typed-decision fallback model active (laya container offline)."
  };
}

module.exports = { evaluateLayaModel };
