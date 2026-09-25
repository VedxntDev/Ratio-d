/**
 * Part 3 sanity set from the detection spec — run against the current engine
 * to see which rows already hold and which need work.
 */
const { handleAnalyze } = require("./routes/analyze");

const CASES = [
  {
    name: "1. Microsoft typosquat",
    expect: "high_risk",
    channel: "email",
    text:
      "From: security@m1crosoft-support.com\n" +
      "Subject: Action Required: Microsoft 365 Password Expiration\n" +
      "Link: https://login.m1crosoft-support.com/auth\n" +
      "Your Microsoft 365 password will expire today. Verify your credentials immediately.",
  },
  {
    name: "2. Real Vercel/GitHub notification",
    expect: "safe",
    channel: "email",
    text:
      "From: notifications@github.com\n" +
      "Subject: [Vercel] Deployment ready for ratio-d\n" +
      "Your deployment for ratio-d is ready to review at https://vercel.com/vedxntdev/ratio-d.",
  },
  {
    name: "3. Generic 50% off marketing",
    expect: "safe|suspicious|promo_clutter",
    channel: "email",
    text:
      "From: deals@shop.example.com\n" +
      "Subject: 50% off everything this weekend!\n" +
      "Grab our biggest sale of the season. Unsubscribe any time.",
  },
  {
    name: "4. Delivery scam + shortened link",
    expect: "high_risk",
    channel: "sms",
    text:
      "USPS ALERT: Your parcel #892019 could not be delivered due to an invalid " +
      "address fee of $1.50. Update immediately within 2 hours or your item will be " +
      "returned to sender: http://bit.ly/usps-track-991",
  },
  {
    name: "5. Legitimate password reset (false-positive trap)",
    expect: "safe",
    channel: "email",
    text:
      "From: no-reply@github.com\n" +
      "Subject: Your GitHub password was reset\n" +
      "A password reset was requested for your account. If this was not you, visit " +
      "https://github.com/password_reset or contact support.",
  },
];

(async () => {
  let pass = 0;
  for (const c of CASES) {
    const r = await handleAnalyze({ text: c.text, channel: c.channel });
    const ok = c.expect.split("|").includes(r.verdict);
    if (ok) pass++;
    console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
    console.log(`      expected ${c.expect}  got ${r.score}/${r.verdict}`);
    if (!ok) {
      r.flags.forEach((f) => console.log(`        - [${f.type}] ${f.span} :: ${f.reason}`));
    }
  }
  console.log(`\n${pass}/${CASES.length} rows satisfied`);
})();
