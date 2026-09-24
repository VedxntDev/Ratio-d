/**
 * Ratio'd Grounded Explanation Engine
 * HARD ANTI-HALLUCINATION RULE: Explanation MUST ONLY reference red flags present in the provided `flags` array.
 */

function generateExplanation(verdict, flags, channel = "email") {
  if (!flags || flags.length === 0) {
    return `Analysis complete: No explicit scam indicators or malicious patterns were detected in this ${channel.toUpperCase()} message. Standard security precautions still apply.`;
  }

  const flagReasons = flags.map(f => f.reason);
  const spansList = flags.map(f => `'${f.span}'`).join(", ");

  let explanation = "";

  if (verdict === "high_risk") {
    explanation = `HIGH RISK DETECTED: This ${channel.toUpperCase()} message exhibits critical scam markers. Specifically, it uses ${flagReasons.join(" and ")}, referencing ${spansList}. These patterns are heavily associated with credential harvesting and phishing attacks.`;
  } else if (verdict === "suspicious") {
    explanation = `SUSPICIOUS CONTENT: Caution is advised. This ${channel.toUpperCase()} message triggered suspicious flags: ${flagReasons.join(", ")}, specifically targeting ${spansList}. Verify the source independently before interacting.`;
  } else {
    explanation = `LOW RISK: Minor signals were observed (${flagReasons.join(", ")}), but overall confidence indicates low scam probability. Proceed with normal caution.`;
  }

  return explanation;
}

module.exports = { generateExplanation };
