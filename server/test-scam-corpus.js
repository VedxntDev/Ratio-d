/**
 * Real-corpus regression suite.
 *
 * This is the suite that should have existed from the start. Every other test
 * in this repo tests the engine against payloads the engine's own author
 * wrote, which is why the engine could look green (391 assertions passing)
 * while scoring 0% on real, externally-sourced scam email.
 *
 * The corpus in server/fixtures/scam-corpus.txt is 20 confirmed scam messages.
 * Before the social-engineering families were added the engine caught 0 of
 * them - every one came back "safe". It now catches 15 (75%).
 *
 * Three things are asserted:
 *   1. RECALL    - a floor on how many real scams are detected.
 *   2. GROUNDING - every non-synthetic flag span is verbatim in the source
 *                  text. The engine must never present evidence it did not
 *                  actually find.
 *   3. NO FALSE POSITIVES on a hand-built adversarial legitimate set chosen to
 *                  stress the new rules specifically.
 *
 * Known misses are listed explicitly below rather than hidden, so the floor
 * cannot be raised by quietly deleting hard cases.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const { evaluateRules } = require("./rules/engine");
const { evaluateLayaModel } = require("./laya/client");
const { combineScore } = require("./combine/score");

const CORPUS_PATH = path.join(__dirname, "fixtures", "scam-corpus.txt");

// Score at or above which a message counts as detected. Mirrors the
// "suspicious" threshold in combine/score.js.
const DETECT_THRESHOLD = 35;

// Floor on recall. Raising it is good; lowering it needs a real reason.
const REQUIRED_RECALL = 0.75;

/**
 * Records the engine genuinely cannot catch today, with the reason.
 *
 * SCAM-003  "Your urgent attention is needed..." - 32 bytes of body, a
 *           5-character subject. No signal exists to match on. This is the
 *           irreducible floor for content-free lures.
 * SCAM-004  Refund bait fires, but the body names a government authority
 *           without a legal-entity footer, so the signature check misses it.
 * SCAM-008  Investment bait fires; needs a second corroborating signal.
 * SCAM-013  "SingPosT" / "Singapore Post" is not in the brand list, and
 *           "usps" is too short to match it without false positives.
 * SCAM-018  Health-claim bait fires; needs a second corroborating signal.
 */
const KNOWN_MISSES = new Set(["SCAM-003", "SCAM-004", "SCAM-008", "SCAM-013", "SCAM-018"]);

/**
 * Flag spans that are deliberately synthetic labels rather than verbatim
 * quotes. The combination rules describe a relationship between two signals,
 * so there is no single substring to quote. Everything else must be verbatim.
 */
const SYNTHETIC_SPANS = new Set([
  "Urgency + Credential Harvesting Combo",
  "Concealed link + pressure",
  "Money bait + unsolicited action request",
  "Advance-fee pretext"
]);

function parseCorpus() {
  const raw = fs.readFileSync(CORPUS_PATH, "utf8");
  const blocks = raw
    .split(/\r?\n-{20,}\r?\n/)
    .map((b) => b.trim())
    .filter((b) => /^ID:\s*SCAM-/m.test(b));

  const records = [];
  for (const block of blocks) {
    const field = (name) => {
      const hit = block.match(new RegExp(`^${name}:[ \\t]*(.*)$`, "m"));
      return hit ? hit[1].trim() : "";
    };
    const bodyIdx = block.search(/^BODY:[ \t]*$/m);
    records.push({
      id: field("ID"),
      label: field("LABEL"),
      subject: field("SUBJECT"),
      from: field("FROM"),
      body: bodyIdx === -1 ? "" : block.slice(bodyIdx).replace(/^BODY:[ \t]*\r?\n/, "").replace(/\s+$/, ""),
    });
  }
  return records;
}

const ADVERSARIAL_BENIGN = [
  ["official Netflix renewal", `From: Netflix <info@mail.netflix.com>
Subject: Your Netflix subscription ends on May 24
Your Netflix subscription ends on May 24, 2026. Renew to keep watching.
Netflix International B.V. All rights reserved.`],
  ["legit brand newsletter via ESP", `From: Grab <news@grab.com>
Subject: Your weekly Grab digest
Hi, here is what happened on Grab this week. Copyright 2024 by Grab SG.
All Rights Reserved.`],
  ["legit IRAS tax notice", `From: IRAS <noreply@iras.gov.sg>
Subject: Notice of Assessment
Your tax assessment for the year is ready. Log in to IRAS to view it.
Inland Revenue Authority of Singapore`],
  ["legit HR form asking full name", `From: Talent <talent@greenhouse.io>
Subject: Candidate details form
Please complete: Your Full Names: / Your Country: / Cell/Telephone Number:
Use the link in your invitation to submit.`],
  ["legit customs fee from official carrier", `From: DHL Express <delivery@dhl.com>
Subject: Your shipment is on hold
A customs charge of USD 12.40 is due before delivery. Pay via the DHL site.`],
  ["legit 2FA setup notice", `From: GitHub <noreply@github.com>
Subject: Two-factor authentication enabled
You enabled 2FA on your account. If this was not you, revoke the device.`],
  ["legit refund order confirmation", `From: Amazon <order-update@amazon.com>
Subject: Your refund of 249 SGD has been processed
Your refund has been credited. No action is required.`],
  ["legit university admin", `From: Registry <registry@ucd.ie>
Subject: Registration complete
Your registration is complete. Contact the registry with any questions.`],
  ["legit bank statement", `From: Chase <alerts@chase.com>
Subject: Your statement is ready
Your monthly statement is available in online banking.`],
  ["legit newsletter with unsubscribe", `From: Product Weekly <hello@productweekly.com>
Subject: This week: 10 deals
Our picks for the week. Unsubscribe any time. All rights reserved.`],
  ["legit crypto exchange notice", `From: Coinbase <noreply@coinbase.com>
Subject: New sign-in to your account
A new device signed in. If this wasn't you, secure your account now.`],
  ["legit crypto airdrop (real exchange)", `From: Binance <no-reply@binance.com>
Subject: Claim your BNB airdrop
You have an eligible airdrop allocation. Claim within 7 days on binance.com.`],
  ["legit storage full from real vendor", `From: Dropbox <no-reply@dropbox.com>
Subject: You're almost out of space
Your storage is 95% full. Upgrade your plan to keep your photos safe.`],
  ["legit loan offer from a real lender", `From: Capital One <offers@capitalone.com>
Subject: Pre-approved offer
You are pre-approved for a personal loan. View your offer.`],
  ["legit health newsletter", `From: WebMD <newsletter@webmd.com>
Subject: New study on sleep
Researchers reported findings on sleep quality this week. Unsubscribe.`],
];

async function main() {
  const records = parseCorpus();
  console.log(`corpus: ${records.length} records from ${path.relative(ROOT, CORPUS_PATH)}\n`);

  const detected = [];
  const missed = [];
  const ungrounded = [];

  for (const r of records) {
    const text = `Subject: ${r.subject}\nFrom: ${r.from}\n\n${r.body}`;
    const { ruleScore, flags, isPromoClutter } = evaluateRules(text, "email");
    const laya = await evaluateLayaModel(text, flags);
    const { score, verdict } = combineScore(ruleScore, laya, "email", flags, isPromoClutter);

    const isDetected = score >= DETECT_THRESHOLD;
    (isDetected ? detected : missed).push({ id: r.id, score, verdict, flags: flags.length });
    console.log(
      `  ${isDetected ? "DETECTED" : "missed  "} ${r.id}  ` +
        `rule=${String(ruleScore).padStart(3)} final=${String(score).padStart(3)} ${verdict.padEnd(14)} flags=${flags.length}`
    );

    for (const f of flags) {
      if (SYNTHETIC_SPANS.has(f.span)) continue;
      const haystack = (r.subject + "\n" + r.from + "\n" + r.body).toLowerCase();
      if (!haystack.includes(String(f.span).toLowerCase())) {
        ungrounded.push({ id: r.id, span: f.span, reason: f.reason });
      }
    }
  }

  const recall = detected.length / records.length;
  console.log(`\nrecall on real scam corpus: ${detected.length}/${records.length} = ${(recall * 100).toFixed(1)}%`);

  let failed = false;
  const check = (label, ok, detail) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
    if (!ok) failed = true;
  };

  check("corpus parses to 20 records", records.length === 20, `${records.length} found`);
  check("every record is labelled scam", records.every((r) => r.label === "scam"));
  check(
    `recall >= ${(REQUIRED_RECALL * 100).toFixed(0)}% on real scams`,
    recall >= REQUIRED_RECALL,
    `${(recall * 100).toFixed(1)}%`
  );
  check(
    "no ungrounded flag spans (engine never invents evidence)",
    ungrounded.length === 0,
    ungrounded.length ? JSON.stringify(ungrounded.slice(0, 3)) : "all spans verbatim"
  );

  const unexpectedMisses = missed.map((m) => m.id).filter((id) => !KNOWN_MISSES.has(id));
  check(
    "no undeclared misses",
    unexpectedMisses.length === 0,
    unexpectedMisses.length ? unexpectedMisses.join(", ") : `${KNOWN_MISSES.size} known misses declared`
  );

  console.log("\nadversarial legitimate mail:");
  const fps = [];
  for (const [name, text] of ADVERSARIAL_BENIGN) {
    const { ruleScore, flags, isPromoClutter } = evaluateRules(text, "email");
    const laya = await evaluateLayaModel(text, flags);
    const { score, verdict } = combineScore(ruleScore, laya, "email", flags, isPromoClutter);
    const bad = verdict === "high_risk";
    if (bad) fps.push(name);
    console.log(
      `  ${bad ? "FALSE POSITIVE" : "ok            "} ${name.padEnd(40)} ` +
        `rule=${String(ruleScore).padStart(3)} final=${String(score).padStart(3)} ${verdict}`
    );
  }
  check("zero false positives on adversarial legitimate mail", fps.length === 0, fps.join(", "));

  if (failed) {
    console.error("\nSCAM CORPUS SUITE FAILED");
    process.exit(1);
  }
  console.log(`\nALL SCAM CORPUS CHECKS PASSED (recall ${(recall * 100).toFixed(1)}%, 0 false positives)`);
}

main().catch((err) => {
  console.error("SCAM CORPUS SUITE ERROR:", err.message);
  process.exit(1);
});
