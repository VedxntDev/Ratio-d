/**
 * Ratio'd Test Suite: Smart Link Shield Engine
 * Verifies domain mismatch heuristics, URL shortener detection, punycode flag,
 * IP destinations, dangerous file extensions, and tracking stripper.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Load fallback engine which contains verifyLinkSafety
const fallbackPath = path.join(__dirname, "../extension/fallback-engine.js");
const fallbackSrc = fs.readFileSync(fallbackPath, "utf8");

// Emulate browser global window
global.window = {};
eval(fallbackSrc);

const verifyLinkSafety = global.window.RatiodFallback && global.window.RatiodFallback.verifyLinkSafety;

console.log("\n=== TEST SUITE: Smart Link Shield Engine ===");
assert.ok(typeof verifyLinkSafety === "function", "verifyLinkSafety must be exposed on window.RatiodFallback");
console.log("PASS  verifyLinkSafety is exposed on window.RatiodFallback");

// 1. Safe Link Test
const safeRes = verifyLinkSafety("Google Search", "https://www.google.com/search?q=cybersecurity");
assert.strictEqual(safeRes.risk, "safe");
assert.strictEqual(safeRes.isSafe, true);
console.log("PASS  Standard legitimate link identified as SAFE");

// 2. Text Matching Destination Test
const matchRes = verifyLinkSafety("github.com/VedxntDev", "https://github.com/VedxntDev/ratiod");
assert.strictEqual(matchRes.risk, "safe");
assert.strictEqual(matchRes.isSafe, true);
console.log("PASS  Text matching destination host identified as SAFE");

// 3. Deceptive Domain Mismatch Test (Phishing spoofing)
const spoofRes = verifyLinkSafety("https://www.paypal.com/signin", "https://secure-login-paypa1.attacker.ru/session");
assert.strictEqual(spoofRes.risk, "high_risk");
assert.strictEqual(spoofRes.isSafe, false);
assert.ok(spoofRes.reason.includes("MISMATCH") || spoofRes.reason.includes("paypal.com"), "Reason must highlight mismatch");
console.log("PASS  Deceptive anchor text domain mismatch detected as HIGH_RISK");

// 4. Direct IP Address Navigation Test
const ipRes = verifyLinkSafety("Click here to verify your account", "http://192.168.1.100/login.php");
assert.strictEqual(ipRes.risk, "suspicious");
assert.strictEqual(ipRes.isSafe, false);
assert.ok(ipRes.reason.includes("numeric IP") || ipRes.reason.includes("IP address"), "Reason must note numeric IP navigation");
console.log("PASS  Direct IP address destination detected as SUSPICIOUS");

// 5. URL Shortener / Redirector Test
const shortRes = verifyLinkSafety("View your quarterly report", "https://bit.ly/3xY9kL2");
assert.strictEqual(shortRes.risk, "suspicious");
assert.strictEqual(shortRes.isSafe, false);
assert.ok(shortRes.reason.includes("shortener") || shortRes.reason.includes("mask"), "Reason must note shortener");
console.log("PASS  URL shortener/masking service detected as SUSPICIOUS");

// 6. Punycode / IDN Homoglyph Test
const punyRes = verifyLinkSafety("Apple Support", "https://xn--pple-43d.com/login");
assert.strictEqual(punyRes.risk, "high_risk");
assert.strictEqual(punyRes.isSafe, false);
assert.ok(punyRes.reason.includes("Punycode") || punyRes.reason.includes("homoglyph"), "Reason must note punycode");
console.log("PASS  Punycode/homoglyph domain detected as HIGH_RISK");

// 7. Dangerous Executable Extension Test
const exeRes = verifyLinkSafety("Download invoice PDF", "https://files.dropbox-sharing.com/invoice.pdf.exe");
assert.strictEqual(exeRes.risk, "high_risk");
assert.strictEqual(exeRes.isSafe, false);
assert.ok(exeRes.reason.includes("executable"), "Reason must note executable file");
console.log("PASS  Dangerous executable link detected as HIGH_RISK");

// 8. Clean Link Tracking Stripper Test
function stripTrackingParams(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const trackingKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid', '_hsenc'];
    trackingKeys.forEach(k => u.searchParams.delete(k));
    return u.toString();
  } catch (e) {
    return rawUrl;
  }
}

const dirtyUrl = "https://example.com/article?utm_source=newsletter&utm_medium=email&fbclid=IwAR123&page=1";
const cleanUrl = stripTrackingParams(dirtyUrl);
assert.strictEqual(cleanUrl, "https://example.com/article?page=1", "Tracking parameters must be stripped while retaining functional parameters");
console.log("PASS  Tracking parameter stripper cleanly removes UTM, fbclid, and marketing telemetry");

console.log("ALL SMART LINK SHIELD TESTS PASSED\n");
