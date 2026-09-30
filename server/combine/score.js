/**
 * Ratio'd Score Combiner & Response Builder
 * Enforces rule-engine domain spoofing / brand impersonation disqualification (min score 80, verdict high_risk).
 */

function combineScore(ruleScore, layaModel, channel = "email", flags = [], enginePromoClutter = null, isAuthDisqualified = false) {
  const layaScore = Math.round((layaModel?.probability || 0) * 100);

  let rawFinalScore = Math.round((ruleScore * 0.70) + (layaScore * 0.30));

  // Whether this is bulk marketing rather than a threat.
  //
  // The rule engine already makes this call correctly, and it requires TWO OR
  // MORE promotional signals on a low-scoring message. Trust that result.
  //
  // The fallback counts signals rather than testing for any single one, because
  // "unsubscribe" appears in almost every legitimate newsletter: treating one
  // promo flag as sufficient tagged ordinary bulk mail as clutter, so a clearly
  // safe message at 8/100 was still labelled PROMO CLUTTER with a warning
  // colour, directly contradicting its own "LOW RISK / consistent with
  // legitimate mail" explanation.
  const promoFlagCount = flags.filter(f =>
    f.type === "promo" || f.reason.includes("Promotional") || f.reason.includes("Unsubscribe")
  ).length;
  const hasPromoClutter = enginePromoClutter !== null && enginePromoClutter !== undefined
    ? Boolean(enginePromoClutter)
    : promoFlagCount >= 2;

  // The mailbox provider already quarantined this message and is telling the
  // user so on screen. Being routed to Spam is not evidence of phishing, so it
  // is deliberately excluded from the severe/disqualifying tests above - but it
  // must never be blended away to "safe" either.
  //
  // The 0.70/0.30 blend is the reason it needed an explicit floor: a quarantine
  // notice arriving with an otherwise clean body produced ruleScore 45 against
  // a model probability near 0.02, which averages back down into the low 30s
  // and lands as "LOW RISK ... consistent with legitimate mail" while Gmail is
  // showing the user a red Spam warning for the same message.
  const isQuarantined = flags.some(f => f.type === "quarantine");
  if (isQuarantined) {
    rawFinalScore = Math.max(rawFinalScore, 45);
  }

  const hasSevereAuthSpoof = isAuthDisqualified || flags.some(f =>
    f.rule === "AUTH_CRYPTO_FAIL" ||
    f.rule === "AUTH_DKIM_ALIGNMENT_MISMATCH" ||
    (f.reason && (
      f.reason.includes("Cryptographic sender authentication failed") ||
      f.reason.includes("digitally signed by unrelated domain")
    ))
  );

  const hasSevereDomainSpoof = hasSevereAuthSpoof || flags.some(f =>
    f.reason.toLowerCase().includes("homoglyph") ||
    f.reason.toLowerCase().includes("typosquat") ||
    f.reason.toLowerCase().includes("brand impersonation") ||
    f.reason.toLowerCase().includes("urgency + credential")
  );

  const hasSevereRule = hasSevereDomainSpoof || flags.some(f =>
    f.reason.includes("Credential harvesting") ||
    f.reason.includes("Link mismatch") ||
    f.reason.includes("suspicious domain") ||
    f.rule === "AUTH_SPF_ENVELOPE_MISMATCH"
  );

  // Authentication mismatch or domain spoofing alone is disqualifying
  if (hasSevereAuthSpoof) {
    rawFinalScore = Math.max(88, rawFinalScore);
  } else if (hasSevereDomainSpoof) {
    rawFinalScore = Math.max(82, rawFinalScore);
  } else if (hasSevereRule && rawFinalScore < 70) {
    rawFinalScore = Math.max(75, rawFinalScore);
  }

  const score = Math.min(100, Math.max(0, rawFinalScore));

  let verdict = "safe";
  if (hasSevereAuthSpoof || hasSevereDomainSpoof || score >= 66) {
    verdict = "high_risk";
  } else if (hasPromoClutter) {
    verdict = "promo_clutter";
  } else if (score >= 35) {
    verdict = "suspicious";
  } else {
    verdict = "safe";
  }

  const next_steps = [];

  if (hasSevereAuthSpoof) {
    next_steps.push("Do NOT click links or reply. This email was cryptographically proven to be sent by an unauthorized party.");
    next_steps.push("Report sender address as phishing and block domain immediately.");
    next_steps.push("Verify account status directly at official brand URL in a new browser window.");
  } else if (verdict === "high_risk") {
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
