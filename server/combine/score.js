/**
 * Ratio'd Score Combiner & Response Builder
 * Merges rule score and model probability into final score 0-100 and verdict label.
 */

function combineScore(ruleScore, layaModel, channel = "email", flags = []) {
  const layaScore = Math.round((layaModel?.probability || 0) * 100);

  // Weighted score calculation (65% rule engine, 35% model)
  let rawFinalScore = Math.round((ruleScore * 0.65) + (layaScore * 0.35));

  // Boost score if severe triggers like domain lookalikes or credential harvesting are present
  const hasSevereRule = flags.some(f => 
    f.reason.includes("Lookalike domain") || 
    f.reason.includes("Credential harvesting") || 
    f.reason.includes("Link mismatch")
  );

  if (hasSevereRule && rawFinalScore < 70) {
    rawFinalScore = Math.max(75, rawFinalScore);
  }

  const score = Math.min(100, Math.max(0, rawFinalScore));

  let verdict = "safe";
  if (score >= 66) {
    verdict = "high_risk";
  } else if (score >= 26) {
    verdict = "suspicious";
  }

  // Build context-aware next_steps checklist
  const next_steps = [];

  if (verdict === "high_risk") {
    next_steps.push("Do NOT click any links, open attachments, or reply to this message.");
    if (flags.some(f => f.reason.includes("domain") || f.reason.includes("Link mismatch"))) {
      next_steps.push("Report this domain/sender to your security team or official service provider.");
    }
    if (flags.some(f => f.reason.includes("Credential") || f.reason.includes("password") || f.reason.includes("OTP"))) {
      next_steps.push("If you already entered passwords or OTPs, immediately change credentials on the official site.");
    }
    next_steps.push("Block sender address and flag as phishing in your mail client.");
  } else if (verdict === "suspicious") {
    next_steps.push("Verify sender identity via an official separate channel (e.g., call official customer support).");
    next_steps.push("Hover over links to check real destination URLs before clicking.");
    next_steps.push("Do not provide personal details, passwords, or payment info.");
  } else {
    next_steps.push("Message appears legitimate based on standard rules.");
    next_steps.push("Maintain standard cybersecurity awareness.");
  }

  return {
    score,
    verdict,
    next_steps
  };
}

module.exports = { combineScore };
