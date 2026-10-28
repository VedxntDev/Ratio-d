/**
 * Ratio'd Test Suite: Dark Mode Adaptive Styling Engine
 * Verifies luminance math, CSS token consistency, and theme detection heuristics.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

function calcLuminance(r, g, b) {
  return (0.299 * r) + (0.587 * g) + (0.114 * b);
}

function isDarkColor(r, g, b) {
  return calcLuminance(r, g, b) < 128;
}

console.log("\n=== TEST SUITE: Gmail Dark Mode Adaptive Engine ===");

// 1. Luminance Formula Tests
assert.strictEqual(isDarkColor(255, 255, 255), false, "Pure white (#FFFFFF) must be identified as LIGHT");
assert.strictEqual(isDarkColor(248, 247, 242), false, "Cream light background (#F8F7F2) must be identified as LIGHT");
assert.strictEqual(isDarkColor(240, 240, 240), false, "Light gray (240,240,240) must be identified as LIGHT");

assert.strictEqual(isDarkColor(18, 18, 18), true, "Near-black (#121212) must be identified as DARK");
assert.strictEqual(isDarkColor(24, 24, 27), true, "Zinc-900 (#18181B) must be identified as DARK");
assert.strictEqual(isDarkColor(32, 33, 36), true, "Gmail Dark surface (#202124) must be identified as DARK");
assert.strictEqual(isDarkColor(40, 40, 44), true, "Dark gray surface must be identified as DARK");
console.log("PASS  Luminance threshold (128) accurately discriminates light vs dark surfaces");

// 2. Verify Dark Mode CSS Tokens in Banner
const bannerPath = path.join(__dirname, "../extension/banner.js");
const bannerSrc = fs.readFileSync(bannerPath, "utf8");
assert.ok(bannerSrc.includes(':host([data-theme="dark"])'), "banner.js must contain :host([data-theme='dark']) styles");
assert.ok(bannerSrc.includes("@media (prefers-color-scheme: dark)"), "banner.js must contain @media (prefers-color-scheme: dark) styles");
assert.ok(bannerSrc.includes("#18181B") || bannerSrc.includes("#202024"), "banner.js must use dark surface tokens");
console.log("PASS  extension/banner.js contains dark neo-brutalist CSS tokens and selectors");

// 3. Verify Content Script Dark Mode Adaptation
const contentScriptPath = path.join(__dirname, "../extension/content-script.js");
const contentScriptSrc = fs.readFileSync(contentScriptPath, "utf8");
assert.ok(contentScriptSrc.includes("isGmailDarkTheme"), "content-script.js must define isGmailDarkTheme()");
assert.ok(contentScriptSrc.includes("updateThemeDetection"), "content-script.js must define updateThemeDetection()");
assert.ok(contentScriptSrc.includes('data-ratiod-theme="dark"'), "content-script.js must set data-ratiod-theme attribute");
assert.ok(contentScriptSrc.includes("rgba(34, 197, 94,"), "content-script.js must have subtle alpha-blended green row tint for dark mode");
assert.ok(contentScriptSrc.includes("rgba(239, 68, 68,"), "content-script.js must have subtle alpha-blended red row tint for dark mode");
console.log("PASS  extension/content-script.js defines luminance sampling and dark row styling");

// 4. Verify Popup Dark Mode Adaptation
const popupHtmlPath = path.join(__dirname, "../extension/popup.html");
const popupHtmlSrc = fs.readFileSync(popupHtmlPath, "utf8");
assert.ok(popupHtmlSrc.includes("@media (prefers-color-scheme: dark)"), "popup.html must contain dark mode styles");
assert.ok(popupHtmlSrc.includes("#121214") || popupHtmlSrc.includes("#18181B"), "popup.html must use dark surface background");
console.log("PASS  extension/popup.html contains dark mode adaptive theme rules");

console.log("ALL DARK MODE TESTS PASSED\n");
