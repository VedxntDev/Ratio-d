"use strict";
const fs = require("fs"), path = require("path");
const { analyzeQr } = require("./rules/qr");
const BAD = [
  "http://paypa1-verify-account.xyz/login?email=victim@example.com",
  "http://198.51.100.7/secure/update",
  "https://microsoft-support.top/office365/signin",
  "https://accounts.google.com.security-check.icu/verify",
  "https://login.microsoftonline.com@evil.top/",
  "https://appple.com/id/login",
  "https://xn--pypal-4ve.com/signin",
  "https://bit.ly/3xAbCd?email=a%40b.com",
  "upi://pay?pa=scam@ybl&pn=Refund%20Desk&am=4999&cu=INR&tn=refund",
  "javascript:alert(document.cookie)",
  "https://secure-hdfcbank-kyc.cfd/update?u=%5BEMAIL_REDACTED%5D",
  "https://myproject.web.app/office365/login?redirect=https://evil.top/"
];
const GOOD = [
  "https://www.google.com/", "https://github.com/VedxntDev/Ratio-d", "https://shopify.com",
  "https://www.spotify.com/in-en/", "https://accounts.google.com/signin", "https://pay.google.com",
  "https://www.hdfcbank.com/personal/pay/cards", "https://www.irctc.co.in/nget/train-search",
  "https://example.com/verify?token=abc", "upi://pay?pa=shop@okhdfcbank&pn=Sharma%20Stores&cu=INR",
  "WIFI:T:WPA;S:Home;P:hunter2;;", "Hello, table 12", "https://support.microsoft.com/en-us"
];
// Zero-trust calibration cases.
//
// These are the regressions that motivated the change. `secure-login.steamcommunity.ru`
// scored 12 and read "safe"; `chase-account-verify.tk` scored 42. Both are
// plain phishing, and a user acting on "safe" would have entered credentials.
const MUST_BE_MALICIOUS = [
  // The two named in the fix request.
  "https://paypal-security-update.account-verification.xyz/login",
  // Brand in a subdomain of an unrelated root domain.
  "https://paypal.com.verify-login.xyz/login",
  "https://login.microsoft.com.account-update.tk/signin",
  "https://secure-login.steamcommunity.ru/login",
  // Brand hyphen-joined into an unrelated registrable label.
  "https://apple-id-verify.com/login",
  "https://chase-account-verify.tk/login",
  "https://metamask-wallet-connect.xyz/seed",
  // Homoglyph / typosquat.
  "https://paypa1.com/signin",
  "https://g00gle.com/login",
  "https://arnazon.com/account/verify"
];

// Official and ordinary links. A false positive here is its own failure mode:
// a badge that cries wolf on github.com is a badge users learn to ignore.
const MUST_BE_SAFE = [
  "https://github.com/settings",
  "https://www.paypal.com/signin",
  "https://www.google.com/",
  "https://accounts.google.com/signin",
  "https://steamcommunity.com/market/listings",
  "https://www.microsoft.com/en-us/windows",
  "https://en.wikipedia.org/wiki/Apple_Inc.",
  "https://news.ycombinator.com/"
];

// Structural deception that must clear 75 even with no brand involved.
const MUST_SCORE_75_PLUS = [
  "http://192.168.1.1/login",
  "https://xn--pypal-4ve.com/signin",
  "https://login.microsoftonline.com@evil.top/"
];

let fails = 0;
const check = (ok, label, detail) => { if (!ok) { fails++; console.error("FAIL " + label, detail || ""); } };

for (const p of MUST_BE_MALICIOUS) {
  const r = analyzeQr(p);
  check(r.verdict === "MALICIOUS", "must be MALICIOUS: " + p, r.score + "/" + r.verdict);
  check(r.score >= 90, "must score >= 90: " + p, r.score + "/" + r.verdict);
}
for (const p of MUST_BE_SAFE) {
  const r = analyzeQr(p);
  check(r.verdict === "SAFE", "must be SAFE: " + p, r.score + "/" + r.verdict);
  check(r.score <= 20, "must score <= 20: " + p, r.score + "/" + r.verdict);
}
for (const p of MUST_SCORE_75_PLUS) {
  const r = analyzeQr(p);
  check(r.score >= 75, "must score >= 75: " + p, r.score + "/" + r.verdict);
}

// A brand name in a subdomain must never be treated as the brand's own domain.
const { isOfficialFor } = require("./rules/qr");
check(isOfficialFor("paypal", "paypal.com") === true, "paypal.com is official for paypal");
check(isOfficialFor("paypal", "paypal.com.evil.xyz") === false, "subdomain cannot confer official status");
check(isOfficialFor("paypal", "verify-login.xyz") === false, "unrelated root is not official");
check(isOfficialFor("chase", "chase.com") === false, "brand with no domain list is never official");

// Every verdict must be inside the strict vocabulary.
const VOCAB = ["SAFE", "SUSPICIOUS", "HIGH_RISK", "MALICIOUS"];
for (const p of [...BAD, ...GOOD, ...MUST_BE_MALICIOUS, ...MUST_BE_SAFE]) {
  const r = analyzeQr(p);
  check(VOCAB.includes(r.verdict), "verdict in vocabulary: " + p, r.verdict);
  check(r.score >= 0 && r.score <= 100, "score in range: " + p, String(r.score));
}

for (const p of BAD) { const r = analyzeQr(p); if (r.verdict === "SAFE") { fails++; console.error("MISSED", p, r.score); } }
for (const p of GOOD) { const r = analyzeQr(p); if (r.verdict !== "SAFE") { fails++; console.error("FALSE POSITIVE", p, r.score, r.flags.map(f => f.reason)); } }
for (const p of [...BAD, ...GOOD]) { const d = analyzeQr(p).defanged; if (/https?:\/\//i.test(d)) { fails++; console.error("NOT DEFANGED", d); } }
const a = path.join(__dirname, "../js/qr.js"), b = path.join(__dirname, "../extension/qr-core.js");
if (fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a, "utf8") !== fs.readFileSync(b, "utf8")) { fails++; console.error("extension/qr-core.js drifted from js/qr.js (run tools/sync-qr.sh)"); }
const total = BAD.length + GOOD.length + MUST_BE_MALICIOUS.length + MUST_BE_SAFE.length + MUST_SCORE_75_PLUS.length;
console.log(fails ? "QR TESTS FAILED: " + fails : "QR tests passed (" + total + " cases, zero-trust calibration)");
process.exit(fails ? 1 : 0);
