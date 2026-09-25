/**
 * Ratio'd Score Combiner & Response Builder
 * Enforces rule-engine domain spoofing / brand impersonation disqualification (min score 80, verdict high_risk).
 */

function combineScore(ruleScore, layaModel, channel = "email", flags = []) {
  const layaScore = Math.round((layaModel?.probability || 0) * 100);

  let rawFinalScore = Math.round((ruleScore * 0.70) + (layaScore * 0.30));

  const hasSevereDomainSpoof = flags.some(f =>
    f.reason.toLowerCase().includes("homoglyph") ||
    f.reason.toLowerCase().includes("typosquat") ||
    f.reason.toLowerCase().includes("brand impersonation") ||
    f.reason.toLowerCase().includes("urgency + credential")
  );

  const hasSevereRule = hasSevereDomainSpoof || flags.some(f =>
    f.reason.includes("Credential harvesting") ||
    f.reason.includes("Link mismatch") ||
    f.reason.includes("suspicious domain")
  );

  const hasPromoClutter = flags.some(f => f.type === "promo" || f.reason.includes("Promotional") || f.reason.includes("Unsubscribe"));

  // Domain spoofing or brand impersonation alone is disqualifying (minimum score 80, high_risk)
  if (hasSevereDomainSpoof) {
    rawFinalScore = Math.max(82, rawFinalScore);
  } else if (hasSevereRule && rawFinalScore < 70) {
    rawFinalScore = Math.max(75, rawFinalScore);
  }

  const score = Math.min(100, Math.max(0, rawFinalScore));

  let verdict = "safe";
  if (hasSevereDomainSpoof || score >= 66) {
    verdict = "high_risk";
  } else if (hasPromoClutter) {
    verdict = "promo_clutter";
  } else if (score >= 35) {
    verdict = "suspicious";
  } else {
    verdict = "safe";
  }

  const next_steps = [];

  if (verdict === "high_risk") {
    next_steps.push("Do NOT click any links, open attachments, or enter passwords on this email.");
    next_steps.push("Report sender address as phishing and block domain immediately.");
    next_steps.push("Verify account status directly at official brand URL in a new browser window.");
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
