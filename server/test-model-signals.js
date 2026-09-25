/**
 * Model-layer checks: the structural signals must fire on real attack shapes
 * and must NOT fire on the benign traffic guarded by test-false-positives.js.
 * The model is the second opinion (30% of the score), so a signal that is too
 * eager silently poisons every verdict downstream of it.
 */
const { evaluateLayaModel } = require("./laya/client");

const ATTACKS = [
  ["punycode lookalike host", "Confirm your account at https://xn--pypal-4ve.com/secure", ["punycode_host"]],
  ["bare IP link", "Urgent! Update your password at http://192.168.44.12/login", ["ip_literal_link"]],
  ["data: URI payload", "Open this to restore access: data:text/html;base64,PHNjcmlwdD4", ["data_uri"]],
  ["crypto demand", "Send a gift card code to claim your refund today", ["credential_or_wire"]],
];

const BENIGN = [
  ["plain newsletter", "This week in tech: five links worth reading. From hello@substack.com"],
  ["order receipt", "From: orders@shopify.com\nYour order #1234 has shipped and arrives Friday. https://shopify.com/orders"],
  ["2FA code", "From: no-reply@github.com\nYour verification code is 123456. Do not share it."],
  ["netflix receipt", "From: info@netflix.com\nYour receipt is ready. Manage your plan at https://netflix.com/account"],
];

(async () => {
  let bad = 0;
  for (const [name, text, expected] of ATTACKS) {
    const r = await evaluateLayaModel(text, []);
    const hit = expected.every((s) => r.signals.includes(s));
    if (!hit) bad++;
    console.log(`${hit ? "PASS" : "FAIL"}  signal fires: ${name.padEnd(24)} -> [${r.signals.join(", ")}] p=${r.probability}`);
  }

  // Benign mail must not trip the high-precision structural layer at all. The
  // low-urgency token layer may still fire; only the structural layer is pinned.
  for (const [name, text] of BENIGN) {
    const r = await evaluateLayaModel(text, []);
    const clean = r.signals.length === 0;
    if (!clean) bad++;
    console.log(`${clean ? "PASS" : "FAIL"}  no false signal: ${name.padEnd(26)} -> [${r.signals.join(", ")}] p=${r.probability}`);
  }

  // Diminishing returns: the Nth structural signal must add LESS than its
  // nominal weight, otherwise a message with many signals would out-score a
  // message that is genuinely more dangerous.
  // Three signals vs the same three plus a fourth (a 120+ char base64 blob).
  const three = await evaluateLayaModel(
    "https://xn--a.com https://1.2.3.4 data:text/html;base64,QUJD", []
  );
  const four = await evaluateLayaModel(
    "https://xn--a.com https://1.2.3.4 data:text/html;base64,QUJD " + "QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNkZWZnaGlqa2xtbm9wcXJz".repeat(3),
    []
  );
  const BASE64_WEIGHT = 0.24;
  const marginal = four.probability - three.probability;
  const damped = three.signals.length === 3 && four.signals.length === 4 && marginal < BASE64_WEIGHT;
  if (!damped) bad++;
  console.log(`${damped ? "PASS" : "FAIL"}  marginal signal gain is sublinear  -> +${marginal.toFixed(2)} for a ${BASE64_WEIGHT} signal`);

  // Probability must never leave the documented 0.02-0.99 range, even on a
  // maximally hostile input.
  const hostile = await evaluateLayaModel(
    "urgent verify password suspended https://xn--a.com https://8.8.8.8 data:text/html;base64,AAAA https://bit.ly/x",
    [{ span: "a", reason: "b" }, { span: "c", reason: "d" }, { span: "e", reason: "f" }]
  );
  const inRange = hostile.probability > 0.02 && hostile.probability <= 0.99;
  if (!inRange) bad++;
  console.log(`${inRange ? "PASS" : "FAIL"}  probability saturates below 1.0  -> ${hostile.probability}`);

  // Non-string / empty input must not throw (the API validates, the model must too).
  const empty = await evaluateLayaModel("", []);
  const safe = empty.label === "safe" && empty.probability <= 0.05;
  if (!safe) bad++;
  console.log(`${safe ? "PASS" : "FAIL"}  empty input handled safely  -> ${empty.label} p=${empty.probability}`);

  console.log(bad === 0 ? "\nMODEL SIGNALS BEHAVING" : `\n${bad} MODEL PROBLEM(S)`);
  process.exit(bad === 0 ? 0 : 1);
})();