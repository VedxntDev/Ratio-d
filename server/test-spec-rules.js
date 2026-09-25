/**
 * Tests for the rules added from the detection spec (Part 1.3 / 1.4) and for
 * the LLM anti-hallucination gate (Part 2).
 */
const { evaluateRules, normalizeForBrandCheck, levenshteinDistance } = require("./rules/engine");
const { isGrounded, isLlmEnabled, SYSTEM_PROMPT } = require("./llm/explain");
const { generateDeterministicExplanation } = require("./llm/explain");

let failures = 0;
function assert(cond, label) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
}
const hasFlag = (flags, needle) =>
  flags.some((f) => f.reason.toLowerCase().includes(needle.toLowerCase()));

/* ---- Part 1.1 homoglyph normalization table ---- */
assert(normalizeForBrandCheck("m1crosoft") === "microsoft", "1 -> i   (m1crosoft -> microsoft)");
assert(normalizeForBrandCheck("g00gle") === "google", "0 -> o   (g00gle -> google)");
assert(normalizeForBrandCheck("rnicrosoft") === "microsoft", "rn -> m  (rnicrosoft -> microsoft)");
assert(normalizeForBrandCheck("micr0soft") === "microsoft", "0 -> o   (micr0soft -> microsoft)");
assert(normalizeForBrandCheck("faceb00k") === "facebook", "0 -> o   (faceb00k -> facebook)");
assert(normalizeForBrandCheck("@pple-support.com") === "apple-support.com", "@ -> a  (@pple -> apple)");

/* ---- Part 1.1 Levenshtein ---- */
assert(levenshteinDistance("microsft", "microsoft") === 1, "levenshtein: microsft -> microsoft = 1");
assert(levenshteinDistance("micosoft", "microsoft") === 1, "levenshtein: micosoft -> microsoft = 1");
assert(levenshteinDistance("microsoft", "microsoft") === 0, "levenshtein: identical = 0");

/* ---- Homoglyph OR Levenshtein must catch the canonical spec cases ---- */
{
  const r = evaluateRules("From: security@m1crosoft-support.com", "email");
  assert(hasFlag(r.flags, "Homoglyph") || hasFlag(r.flags, "Typosquatting"),
    "spec case: m1crosoft-support.com is caught");
}
/* paypa1 normalizes to "paypai", so it is caught by edit distance, not substitution */
{
  const r = evaluateRules("From: security@paypa1-security.com", "email");
  assert(r.flags.length > 0, "spec case: paypa1-security.com is caught (edit distance)");
}

/* ---- Part 1.2 brand stuffing ---- */
{
  const r = evaluateRules("Visit https://microsoft-support.com/verify now", "email");
  assert(hasFlag(r.flags, "brand impersonation") || hasFlag(r.flags, "Homoglyph"),
    "brand stuffing: microsoft-support.com is flagged");
}

/* ---- Part 1.3 sender / link domain mismatch ---- */
{
  const r = evaluateRules(
    "From: billing@secure-accounts-alerts.com\n" +
    "Subject: Your invoice is ready\n" +
    "Review and pay: https://payment-gateway-collect.net/invoice/9921",
    "email"
  );
  assert(hasFlag(r.flags, "Sender/link mismatch"),
    "sender/link mismatch: alerts.com -> payment-gateway-collect.net is flagged");
}

/* ---- Mismatch must NOT fire on legitimate cross-domain mail ---- */
{
  const r = evaluateRules(
    "From: notifications@github.com\n" +
    "Your deployment is ready: https://vercel.com/vedxntdev/ratio-d",
    "email"
  );
  assert(!hasFlag(r.flags, "Sender/link mismatch"),
    "no false positive: official github.com linking to vercel.com is allowed");
}

/* ---- Short brand regression: "x" must not match every domain ---- */
{
  const r = evaluateRules("Deals at https://shop.example.com this weekend", "email");
  assert(!hasFlag(r.flags, "brand impersonation"),
    'regression: "example.com" is NOT brand impersonation (the "x" brand bug)');
}

/* ---- Urgency + credential combo (matches on the flag SPAN) ---- */
{
  const r = evaluateRules(
    "URGENT: verify your password within 24 hours or your account will be suspended",
    "email"
  );
  assert(
    r.flags.some((f) => f.span === "Urgency + Credential Harvesting Combo"),
    "urgency + credential combo fires"
  );
}
{
  const r = evaluateRules("will be suspended unless you confirm your identity", "email");
  assert(r.flags.length > 0, "spec keywords 'will be suspended' + 'confirm your identity' are matched");
}

/* ---- Part 2 anti-hallucination gate ---- */
const sample = "Your PayPal account is suspended. Verify your password at http://paypa1-security.com";
assert(isGrounded("Verify your password", sample), "grounding accepts a real phrase");
assert(!isGrounded("wire transfer to the Bahamas account", sample),
  "grounding REJECTS an invented phrase");
assert(!isGrounded("ab", sample), "grounding rejects trivially short fragments");

/* ---- Deterministic explanation is grounded in real flags ---- */
{
  const flags = [{ span: "paypa1-security.com", reason: "Homoglyph/Typosquat domain", type: "rule" }];
  const text = generateDeterministicExplanation("high_risk", flags, "email");
  assert(text.includes("paypa1-security.com") && text.includes("Homoglyph"),
    "deterministic explanation quotes only the flags that fired");
}

/* ---- LLM is opt-in ---- */
assert(isLlmEnabled() === false, "LLM disabled by default (no RATIOD_LLM_API_KEY set)");
assert(SYSTEM_PROMPT.includes("Output ONLY valid JSON"), "system prompt is wired and complete");

console.log(failures === 0 ? "\nALL SPEC RULE TESTS PASSED" : `\n${failures} TEST(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
