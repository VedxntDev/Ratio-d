/**
 * Ratio'd Test Suite — Phishing Regression & Sanity Verification
 * Tests 5 Core Scenarios:
 * 1. Microsoft typosquat email (m1crosoft-support.com) -> Expected: HIGH RISK
 * 2. Real GitHub/Vercel notification -> Expected: SAFE
 * 3. Generic 50% off sale marketing email -> Expected: PROMO CLUTTER or SAFE
 * 4. USPS package delivery reschedule with shortened link -> Expected: HIGH RISK
 * 5. Legitimate password-reset email from official domain -> Expected: SAFE
 */

const { evaluateRules } = require("./rules/engine");
const { combineScore } = require("./combine/score");

const TEST_CASES = [
  {
    name: "1. Microsoft Typosquat Phishing (Regression Case)",
    text: `From: security@m1crosoft-support.com
Subject: Action Required: Microsoft 365 Password Expiration
Body: Your password will expire today. Verify your credentials immediately at https://login.m1crosoft-support.com/auth to maintain account access.`,
    expectedVerdict: "high_risk",
    minScore: 80
  },
  {
    name: "2. Real Vercel / GitHub Notification",
    text: `From: notifications@github.com
Subject: [GitHub] Successful deployment for Ratio-d
Body: Your deployment for Ratio-d (main branch) completed successfully on Vercel. View deployment status at https://github.com/VedxntDev/Ratio-d.`,
    expectedVerdict: "safe",
    maxScore: 30
  },
  {
    name: "3. Generic 50% Off Marketing Email",
    text: `From: promo@store.com
Subject: Weekend Sale - 50% Off All Items!
Body: Join our VIP club today and get 50% off your next purchase. Unsubscribe at any time: https://store.com/unsubscribe`,
    expectedVerdict: "promo_clutter",
    maxScore: 60
  },
  {
    name: "4. USPS Fake Package Shortened Link Scam",
    text: `From: alert@delivery-notice.top
Subject: USPS ALERT: Package Delivery Failed
Body: Your parcel #892019 could not be delivered due to an invalid address fee of $1.50. Action required: update within 2 hours or your item will be returned to sender: http://bit.ly/usps-track-991`,
    expectedVerdict: "high_risk",
    minScore: 75
  },
  {
    name: "5. Legitimate Password Reset Email from Official Domain",
    text: `From: noreply@github.com
Subject: [GitHub] Please reset your password
Body: We received a request to reset your GitHub password. Click here to reset: https://github.com/password_reset. If you did not request this, ignore this email.`,
    expectedVerdict: "safe",
    maxScore: 35
  }
];

function runTests() {
  console.log("=================================================");
  console.log("    RATIO'D PHISHING RULE ENGINE TEST SUITE    ");
  console.log("=================================================\n");

  let passed = 0;

  for (const tc of TEST_CASES) {
    const { ruleScore, flags, isPromoClutter } = evaluateRules(tc.text, "email");
    const layaMock = { probability: ruleScore >= 70 ? 0.9 : 0.1 };
    // Forward isPromoClutter exactly as the API route does, so this exercises
    // the real code path rather than the fallback.
    const { score, verdict, next_steps } = combineScore(ruleScore, layaMock, "email", flags, isPromoClutter);

    let isSuccess = false;
    if (tc.expectedVerdict === "high_risk") {
      isSuccess = (verdict === "high_risk" && score >= tc.minScore);
    } else if (tc.expectedVerdict === "safe") {
      isSuccess = (verdict === "safe" && score <= tc.maxScore);
    } else if (tc.expectedVerdict === "promo_clutter") {
      isSuccess = (verdict === "promo_clutter" || verdict === "safe");
    }

    if (isSuccess) passed++;

    console.log(`[TEST] ${tc.name}`);
    console.log(`  - Verdict: ${verdict.toUpperCase()} (Score: ${score}/100) [Expected: ${tc.expectedVerdict.toUpperCase()}]`);
    console.log(`  - Flags Triggered (${flags.length}):`);
    flags.forEach(f => console.log(`      • [${f.type}] ${f.span} -> ${f.reason}`));
    console.log(`  - Result: ${isSuccess ? "✅ PASSED" : "❌ FAILED"}\n`);
  }

  console.log(`Summary: ${passed}/${TEST_CASES.length} Tests Passed.\n`);
}

runTests();
