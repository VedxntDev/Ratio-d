/**
 * UI <-> backend contract test.
 * Verifies every field the new console reads is actually present in the
 * live API responses, so the UI can never silently render an empty panel.
 */
const assert = require("assert");

const BASE = process.env.BASE || "http://127.0.0.1:3000";

async function main() {
  // 1. Health payload (drives the header connectivity pill)
  const hRes = await fetch(`${BASE}/health`);
  assert(hRes.ok, `health returned HTTP ${hRes.status}`);
  const h = await hRes.json();
  assert(h.runtime, "health.runtime missing");
  assert(h.engine && h.engine.rules, "health.engine.rules missing");
  console.log(`health  OK  -> ${h.runtime} | ${h.engine.rules}`);

  // 2. Analyze payload (drives every result panel)
  const payload = {
    text:
      "From: security-alert@paypa1-security.com\n" +
      "Subject: URGENT: Your PayPal Account Has Been Suspended\n" +
      "Verify your password within 24 hours: https://paypa1-security.com/restore-login\n" +
      "Call +1 800 555 0199. OTP 483920",
    channel: "email",
  };

  const aRes = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  assert(aRes.ok, `analyze returned HTTP ${aRes.status}`);
  const r = await aRes.json();

  ["score", "verdict", "flags", "explanation", "next_steps", "privacy", "engine"].forEach((k) => {
    assert(k in r, `MISSING top-level field: ${k}`);
  });

  assert(typeof r.score === "number" && r.score >= 0 && r.score <= 100, "score out of range");
  assert(["safe", "suspicious", "high_risk", "promo_clutter"].includes(r.verdict), "unknown verdict");
  assert(Array.isArray(r.flags), "flags not an array");
  assert(
    r.flags.every((f) => typeof f.span === "string" && typeof f.reason === "string"),
    "flag objects need span + reason"
  );
  assert(Array.isArray(r.next_steps) && r.next_steps.length > 0, "next_steps empty");
  assert(typeof r.explanation === "string" && r.explanation.length > 0, "explanation empty");

  ["rules", "rule_flags", "model_source", "model_label", "model_probability", "explain", "latency_ms"]
    .forEach((k) => assert(k in r.engine, `MISSING engine.${k}`));

  ["phones_masked", "emails_masked", "otp_masked"].forEach((k) => {
    assert(k in r.privacy, `MISSING privacy.${k}`);
  });

  console.log(
    `analyze OK  -> ${r.score}/${r.verdict} | flags ${r.flags.length} | ` +
    `model ${r.engine.model_source} | ${r.engine.latency_ms}ms`
  );
  console.log(`privacy    -> ${JSON.stringify(r.privacy)}`);

  // 3. The console must actually flag this payload
  assert(r.verdict === "high_risk", `expected high_risk, got ${r.verdict}`);

  // 4. Benign message must stay safe (false-positive guard)
  const bRes = await fetch(`${BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: "Hey team, standup moved to 10am tomorrow. See you there.",
      channel: "email",
    }),
  });
  const b = await bRes.json();
  assert(b.verdict === "safe", `benign message misclassified as ${b.verdict}`);
  console.log(`benign   OK  -> ${b.score}/${b.verdict} (no false positive)`);

  console.log("\nALL UI <-> BACKEND CONTRACTS SATISFIED");
}

main().catch((err) => {
  console.error("CONTRACT TEST FAILED:", err.message);
  process.exit(1);
});
