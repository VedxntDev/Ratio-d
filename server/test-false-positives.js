/**
 * False-positive sweep: a broad set of realistic legitimate messages that must
 * NOT be flagged as high risk. Guards the aggressive domain-extraction change.
 */
const { handleAnalyze } = require("./routes/analyze");

const BENIGN = [
  ["standup note", "Hey team, standup moved to 10am. See you there."],
  ["github digest", "From: notifications@github.com\nYour weekly GitHub digest is ready at https://github.com/notifications"],
  ["vercel deploy", "From: notifications@vercel.com\nDeployment for ratio-d is ready: https://vercel.com/vedxntdev/ratio-d/deployments"],
  ["google meet invite", "From: calendar-notification@google.com\nYou are invited to Design Sync at 3pm. Join: https://meet.google.com/abc-defg-hij"],
  ["aws billing", "From: no-reply@aws.amazon.com\nYour AWS invoice for October is available in the console."],
  ["linkedin", "From: notifications@linkedin.com\nYou appeared in 4 searches this week. See your profile views."],
  ["netflix receipt", "From: info@netflix.com\nYour receipt for this month is ready. Manage your plan at https://netflix.com/account"],
  ["office 365 legit", "From: no-reply@microsoftonline.com\nYour Microsoft 365 subscription renews next month."],
  ["newsletter", "From: hello@substack.com\nThis week in tech: five links worth reading."],
  ["recruiter", "Hi there,\nWe saw your profile and would love to chat about a role. Let us find a time.\nBest, Sam"],
  ["order confirm", "From: orders@shopify.com\nYour order #1234 has shipped and arrives Friday."],
  ["bank statement", "From: statements@chase.com\nYour monthly statement is ready to view in online banking."],
  ["delivery legit", "From: no-reply@amazon.com\nYour package is out for delivery today."],
  ["plain promo", "From: deals@retailer.com\n50% off all summer styles this weekend only. Unsubscribe anytime."],
  ["two-factor code", "From: no-reply@github.com\nYour verification code is 123456. Do not share it with anyone."],
];

(async () => {
  let bad = 0;
  for (const [name, text] of BENIGN) {
    const r = await handleAnalyze({ text, channel: "email" });
    const ok = r.verdict !== "high_risk";
    if (!ok) bad++;
    console.log(
      `${ok ? "PASS" : "FAIL"}  ${name.padEnd(20)} ${String(r.score).padStart(3)}/${r.verdict}` +
      (ok ? "" : `  flags: ${r.flags.map((f) => f.reason).join(" | ")}`)
    );
  }
  console.log(bad === 0
    ? `\nNO FALSE POSITIVES across ${BENIGN.length} legitimate messages`
    : `\n${bad} FALSE POSITIVE(S) DETECTED`);
  process.exit(bad === 0 ? 0 : 1);
})();
