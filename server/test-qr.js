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
let fails = 0;
for (const p of BAD) { const r = analyzeQr(p); if (r.verdict === "safe") { fails++; console.error("MISSED", p, r.score); } }
for (const p of GOOD) { const r = analyzeQr(p); if (r.verdict !== "safe") { fails++; console.error("FALSE POSITIVE", p, r.score, r.flags.map(f => f.reason)); } }
for (const p of [...BAD, ...GOOD]) { const d = analyzeQr(p).defanged; if (/https?:\/\//i.test(d)) { fails++; console.error("NOT DEFANGED", d); } }
const a = path.join(__dirname, "../js/qr.js"), b = path.join(__dirname, "../extension/qr-core.js");
if (fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a, "utf8") !== fs.readFileSync(b, "utf8")) { fails++; console.error("extension/qr-core.js drifted from js/qr.js (run tools/sync-qr.sh)"); }
console.log(fails ? "QR TESTS FAILED: " + fails : "QR tests passed (" + (BAD.length + GOOD.length) + " cases)");
process.exit(fails ? 1 : 0);
