/**
 * Ratio'd Score Combiner & Response Builder
 */

function combineScore(ruleScore, layaModel, channel = "email", flags = []) {
  const layaScore = Math.round((layaModel?.probability || 0) * 100);

  let rawFinalScore = Math.round((ruleScore * 0.65) + (layaScore * 0.35));

  const hasSevereRule = flags.some(f => 
    f.reason.includes("Lookalike domain") || 
    f.reason.includes("Credential harvesting") || 
    f.reason.includes("Link mismatch")
  );

  const hasPromoClutter = flags.some(f => f.type === "promo" || f.reason.includes("Promotional") || f.reason.includes("Unsubscribe"));

  if (hasSevereRule && rawFinalScore < 70) {
    rawFinalScore = Math.max(75, rawFinalScore);
  }

  const score = Math.min(100, Math.max(0, rawFinalScore));

  let verdict = "safe";
  if (score >= 66 && hasSevereRule) {
    verdict = "high_risk";
  } else if (hasPromoClutter || score >= 35) {
    verdict = "promo_clutter";
  } else if (score >= 26) {
    verdict = "suspicious";
  }

  const next_steps = [];

  if (verdict === "high_risk") {
    next_steps.push("Do NOT click any links, open attachments, or reply to this message.");
    next_steps.push("Block sender address and flag as phishing in your mail client.");
  } else if (verdict === "promo_clutter") {
    next_steps.push("Post-task promotional marketing clutter detected.");
    next_steps.push("Use One-Click Unsubscribe on the Ratio'd banner to stop future marketing blasts.");
    next_steps.push("Mute or archive sender if task is finished.");
  } else if (verdict === "suspicious") {
    next_steps.push("Verify sender identity via an official separate channel.");
    next_steps.push("Hover over links to check real destination URLs before clicking.");
  } else {
    next_steps.push("Message appears legitimate based on standard rules.");
  }

  return {
    score,
    verdict,
    next_steps
  };
}

module.exports = { combineScore };
