/**
 * Regression: promo-clutter must mean "bulk marketing", not "flagged".
 *
 * combineScore used to derive it from "any single promo flag", and because
 * "unsubscribe" matches a promo pattern, ordinary newsletters were labelled
 * PROMO CLUTTER at a score of 8/100 - a warning-coloured badge contradicting
 * the same banner's "LOW RISK / consistent with legitimate mail" text.
 */
const { handleAnalyze } = require("./routes/analyze");

const CASES = [
  // [name, text, expected verdict]
  ["one unsubscribe line is not clutter",
    "From: no-reply@github.com\nWelcome aboard. Unsubscribe here.", "safe"],
  ["an ordinary newsletter is not clutter",
    "From: hello@substack.com\nThis week in tech: five links. Unsubscribe anytime.", "safe"],
  ["a real marketing blast is clutter",
    "From: promo@store.com\nWeekend Sale - 50% Off All Items! Join our VIP club today and get 50% off your next purchase. Unsubscribe at any time.", "promo_clutter"],
  ["a phishing lure is never demoted to clutter",
    "From: security-alert@paypa1-security.com\nURGENT: Your account has been suspended. Verify your password now: http://bit.ly/x", "high_risk"],
];

(async () => {
  let bad = 0;
  for (const [name, text, expected] of CASES) {
    const r = await handleAnalyze({ text, channel: "email" });
    const ok = r.verdict === expected;
    if (!ok) bad++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(38)} ${String(r.score).padStart(3)}/${r.verdict}` +
      (ok ? "" : `  expected ${expected}`));
  }

  // A low score must never be paired with the clutter badge: that combination
  // is what made the original UI self-contradictory.
  const news = await handleAnalyze({
    text: "From: hello@substack.com\nThis week in tech: five links. Unsubscribe anytime.",
    channel: "email"
  });
  const coherent = !(news.score < 35 && news.verdict === "promo_clutter");
  if (!coherent) bad++;
  console.log(`${coherent ? "PASS" : "FAIL"}  low score is never shown with the clutter badge`);

  // The same class of contradiction, one layer up: the banner TEXT. Bulk
  // marketing used to fall through to the "LOW RISK ... consistent with
  // legitimate mail" explanation while the verdict said promo_clutter and the
  // next step offered an unsubscribe button. A user reading only the sentence
  // would be told unsolicited mail is legitimate.
  const blast = await handleAnalyze({
    text:
      'From: Justin <justin@eggmoo.com>\nSubject: Workshop\n' +
      'Reply with "PDF-Discipline" on the email subject.\n' +
      'If you prefer not to receive any further emails, kindly reply and put "remove-me" on the subject.',
    channel: "email"
  });
  const textOk =
    blast.verdict === "promo_clutter" &&
    /BULK MARKETING/i.test(blast.explanation) &&
    !/consistent with legitimate mail/i.test(blast.explanation);
  if (!textOk) bad++;
  console.log(
    `${textOk ? "PASS" : "FAIL"}  clutter text never calls spam legitimate  -> ${String(blast.score)}/${blast.verdict}`
  );

  // The phishing lure must still be high_risk even though it also carries
  // marketing language, i.e. the "no threat evidence" guard really is a guard.
  const lure = await handleAnalyze({
    text:
      "From: promo@store.com\nSubject: 60% OFF - act now\n" +
      "URGENT: your account is suspended. Unsubscribe here. Discount applies. " +
      "Verify your password at http://bit.ly/x",
    channel: "email"
  });
  const lureOk = lure.verdict === "high_risk";
  if (!lureOk) bad++;
  console.log(
    `${lureOk ? "PASS" : "FAIL"}  a phishing lure is never demoted to clutter  -> ${String(lure.score)}/${lure.verdict}`
  );

  console.log(bad === 0
    ? "\nPROMO CLUTTER MEANS BULK MAKING, NOT A THREAT FLAG"
    : `\n${bad} PROMO-CLUTTER PROBLEM(S)`);
  process.exit(bad === 0 ? 0 : 1);
})();