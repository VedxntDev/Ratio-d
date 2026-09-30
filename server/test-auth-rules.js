/**
 * Test Suite: SPF, DKIM, and DMARC Authentication Rules
 *
 * Validates cryptographic/envelope verification logic across the engine.
 * Run directly with `node server/test-auth-rules.js` or via `npm test`.
 */

const assert = require("assert");
const { evaluateRules, evaluateAuthentication, isProtectedBrandDomain } = require("./rules/engine");
const { combineScore } = require("./combine/score");

let passed = 0;
let total = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    passed++;
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log("\n--- Ratio'd SPF / DKIM / DMARC Authentication Rule Tests ---\n");

it("isProtectedBrandDomain correctly identifies official brands", () => {
  assert.strictEqual(isProtectedBrandDomain("paypal.com"), true);
  assert.strictEqual(isProtectedBrandDomain("accounts.google.com"), true);
  assert.strictEqual(isProtectedBrandDomain("mail.chase.com"), true);
  assert.strictEqual(isProtectedBrandDomain("random-blog.org"), false);
});

it("Check B: Flags DKIM alignment mismatch on protected brand sender", () => {
  const text = "From: service@paypal.com\nSubject: Account Notice\n\nYour account statement is ready.";
  const auth = {
    fromDomain: "paypal.com",
    signedBy: "malicious-phish.ru"
  };

  const { ruleScore, flags, isAuthDisqualified, authSummary } = evaluateRules(text, "email", auth);
  assert.strictEqual(isAuthDisqualified, true);
  assert.strictEqual(authSummary.status, "spoof");
  assert(flags.some(f => f.rule === "AUTH_DKIM_ALIGNMENT_MISMATCH"));

  const layaResult = { source: "laya_stub_heuristic", probability: 0.1, label: "safe" };
  const combined = combineScore(ruleScore, layaResult, "email", flags, false, isAuthDisqualified);
  assert.strictEqual(combined.verdict, "high_risk");
  assert(combined.score >= 88);
});

it("Check A: Hard DMARC / DKIM / SPF failure overrides score and verdict", () => {
  const text = "From: alerts@bankofamerica.com\nSubject: Security alert\n\nPlease review your security settings.";
  const auth = {
    fromDomain: "bankofamerica.com",
    dmarc: "fail"
  };

  const { ruleScore, flags, isAuthDisqualified } = evaluateRules(text, "email", auth);
  assert.strictEqual(isAuthDisqualified, true);
  assert(flags.some(f => f.rule === "AUTH_CRYPTO_FAIL"));

  const layaResult = { source: "laya_stub_heuristic", probability: 0.05, label: "safe" };
  const combined = combineScore(ruleScore, layaResult, "email", flags, false, isAuthDisqualified);
  assert.strictEqual(combined.verdict, "high_risk");
  assert(combined.score >= 88);
});

it("Authentic verified sender with aligned DKIM receives legitimate sender status", () => {
  const text = "From: service@paypal.com\nSubject: Receipt for your payment\n\nYou sent a payment of $25.00 to merchant.";
  const auth = {
    fromDomain: "paypal.com",
    signedBy: "paypal.com",
    mailedBy: "paypal.com"
  };

  const { ruleScore, flags, isAuthDisqualified, authSummary } = evaluateRules(text, "email", auth);
  assert.strictEqual(isAuthDisqualified, false);
  assert.strictEqual(authSummary.status, "verified");
  assert.strictEqual(flags.filter(f => f.rule && f.rule.startsWith("AUTH_")).length, 0);

  const layaResult = { source: "laya_stub_heuristic", probability: 0.05, label: "safe" };
  const combined = combineScore(ruleScore, layaResult, "email", flags, false, isAuthDisqualified);
  assert.strictEqual(combined.verdict, "safe");
  assert(combined.score <= 25);
});

it("Check C: SPF envelope mismatch on protected brand", () => {
  const text = "From: alerts@chase.com\nSubject: Your Monthly Statement\n\nYour statement is available online.";
  const auth = {
    fromDomain: "chase.com",
    signedBy: "chase.com",
    mailedBy: "suspicious-relay.biz"
  };

  const { flags } = evaluateRules(text, "email", auth);
  assert(flags.some(f => f.rule === "AUTH_SPF_ENVELOPE_MISMATCH"));
});

it("Check C exemption: Known shared ESP relays (e.g. SendGrid, SES) are not penalized for SPF", () => {
  const text = "From: notify@github.com\nSubject: Daily build report\n\nAll builds succeeded.";
  const auth = {
    fromDomain: "github.com",
    signedBy: "github.com",
    mailedBy: "sendgrid.net"
  };

  const { flags } = evaluateRules(text, "email", auth);
  assert(!flags.some(f => f.rule === "AUTH_SPF_ENVELOPE_MISMATCH"));
});

it("Check D: High-value brand with completely missing authentication signatures", () => {
  const text = "From: security@apple.com\nSubject: Apple ID login\n\nYour Apple ID was used to sign in.";
  const auth = {
    fromDomain: "apple.com"
  };

  const { flags } = evaluateRules(text, "email", auth);
  assert(flags.some(f => f.rule === "AUTH_BRAND_UNAUTHENTICATED"));
});

// Regression: ordinary personal mail from a consumer mailbox is not a spoof.
//
// gmail.com and icloud.com belong to Google and Apple and are therefore in
// OFFICIAL_BRAND_DOMAINS, so isProtectedBrandDomain() returns true for them.
// evaluateAuthentication() used that directly, and every plain email sent from
// a Gmail or Outlook address scored ~41 "suspicious" for having no DKIM
// signature - including an empty one from a friend. gmail.com, outlook.com and
// icloud.com were all affected; the other providers were not, purely because
// they are absent from the brand list, which is why this looked inconsistent.
it("Free webmail never counts as an institutional brand sender", () => {
  for (const domain of ["gmail.com", "outlook.com", "icloud.com", "yahoo.com", "hotmail.com", "live.com"]) {
    const { flags } = evaluateRules(`From: someone@${domain}\nSubject: hi\n\n`, "email", {
      fromDomain: domain
    });
    assert(
      !flags.some(f => f.rule === "AUTH_BRAND_UNAUTHENTICATED"),
      `${domain} must not be treated as an unauthenticated brand sender`
    );
  }
});

// The exact reported message: no content at all, from a personal Gmail address.
it("An empty personal email is safe, not suspicious", () => {
  const { ruleScore, flags } = evaluateRules(
    "From: Utkarsh Upadhyaya <upadhyayautkarsh80@gmail.com>\nSubject: \n\n",
    "email",
    { fromDomain: "gmail.com" }
  );
  assert.strictEqual(flags.length, 0, "no flags expected: " + flags.map(f => f.rule).join(", "));
  assert.ok(ruleScore < 35, `expected a low score, got ${ruleScore}`);
});

// The exemption must not become a free pass for real phishing sent from a
// consumer mailbox. Without a brand claim there is nothing to misattribute, so
// the body-level rules have to carry the detection on their own.
it("Free webmail does not launder a phishing body", () => {
  const { ruleScore } = evaluateRules(
    "From: attacker@gmail.com\nSubject: s\n\nURGENT your account is suspended verify your password http://bit.ly/z",
    "email",
    { fromDomain: "gmail.com" }
  );
  assert.ok(ruleScore >= 35, `phishing body must still score high, got ${ruleScore}`);
});

it("Backward compatibility: Omitting auth object preserves existing scoring and defaults safely", () => {
  const text = "From: friend@example.com\nSubject: Hey\n\nCatch up this weekend?";
  const { ruleScore, flags, isAuthDisqualified, authSummary } = evaluateRules(text, "email", null);
  assert.strictEqual(isAuthDisqualified, false);
  assert.strictEqual(authSummary.status, "unverified");
  assert.strictEqual(flags.length, 0);
  assert.strictEqual(ruleScore, 0);
});

console.log(`\nResults: ${passed}/${total} assertions passed.\n`);
if (passed !== total) {
  process.exit(1);
}
