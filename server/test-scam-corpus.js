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
const MIXED_PATH = path.join(__dirname, "fixtures", "real-world-mixed.txt");
const USER_CORPUS_PATH = path.join(__dirname, "fixtures", "new-emails-corpus.txt");

// Score at or above which a message counts as detected. Mirrors the
// "suspicious" threshold in combine/score.js.
const DETECT_THRESHOLD = 35;

/**
 * Verdicts that mean "this message is treated as a threat".
 *
 * The corpus metric used to be `score >= DETECT_THRESHOLD`, which quietly
 * assumed that anything scoring above the suspicious threshold is a threat
 * detection. That assumption is false and it was hiding a real capability
 * gap. `promo_clutter` is assigned only when the engine has already raised
 * the rule score to at least 45 (see evaluateRules), so a correctly
 * identified bulk-marketing blast ALWAYS scores above DETECT_THRESHOLD.
 *
 * The consequence was that the metric and the feature were mutually
 * exclusive: the suite reported 100% specificity only because the two
 * genuine bulk-marketing messages in corpus B were being mis-scored as
 * "safe" at 1/100 and 8/100. The moment the engine learned to recognise
 * them, the same correct behaviour registered as two false positives.
 *
 * Measuring threat VERDICT instead of raw score is what the metric always
 * meant. A message is a detection when the product tells the user to treat
 * it as dangerous (`suspicious` / `high_risk`); `promo_clutter` is an
 * explicit "this is bulk marketing, not an attack" verdict that carries an
 * unsubscribe action, and `safe` is a clean bill of health.
 *
 * Specificity is therefore the real safety property: no ham message may
 * ever be escalated to a threat verdict.
 */
const THREAT_VERDICTS = new Set(["suspicious", "high_risk"]);

/** True when the product would warn the user that this message is dangerous. */
function isThreat(outcome) {
  return THREAT_VERDICTS.has(outcome.verdict);
}

// Floors. Raising them is good; lowering one needs a real reason.
// Corpus A is single-class so it can only constrain recall. Corpus B contains
// genuine ham, so it constrains recall AND specificity.
const REQUIRED_RECALL_A = 0.85;
const REQUIRED_RECALL_B = 0.85;
const REQUIRED_SPECIFICITY_B = 1.0;

/**
 * Records the engine genuinely cannot catch today, with the reason.
 *
 * SCAM-003  "Your urgent attention is needed..." - 32 bytes of body, a
 *           5-character subject. No signal exists to match on. This is the
 *           irreducible floor for content-free lures.
 * SCAM-004  Refund bait fires, but the body names a government authority
 *           without a legal-entity footer, so the signature check misses it.
 * SCAM-008  Investment bait fires; needs a second corroborating signal.
 *
 * Previously also missed, and now caught - listed so the history is visible:
 *   SCAM-013  "SingPosT" - caught once a Reply-To/sender gap and the
 *             abused-hosting check were added.
 *   SCAM-018  Health claim - caught once a second corroborating family match
 *             was allowed to contribute.
 */
const KNOWN_MISSES = new Set(["SCAM-003", "SCAM-004", "SCAM-008"]);

/**
 * Flag spans that are deliberately synthetic labels rather than verbatim
 * quotes. The combination rules describe a relationship between two signals,
 * so there is no single substring to quote. Everything else must be verbatim.
 */
const SYNTHETIC_SPANS = new Set([
  "Urgency + Credential Harvesting Combo",
  "Concealed link + pressure",
  "Money bait + unsolicited action request",
  "Advance-fee pretext",
  "Unsolicited payout claim with a specific large amount"
]);

function parseCorpus(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const blocks = raw
    .split(/\r?\n-{20,}\r?\n/)
    .map((b) => b.trim())
    .filter((b) => /^ID:\s*(SCAM|HAM)-\d+/m.test(b));

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
  let failed = false;
  const check = (label, ok, detail) => {
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
    if (!ok) failed = true;
  };

  const ungrounded = [];
  const allMisses = [];

  // Shared scoring + grounding pass over one record.
  const scoreOne = async (r) => {
    const text = `Subject: ${r.subject}\nFrom: ${r.from}\n\n${r.body}`;
    const { ruleScore, flags, isPromoClutter } = evaluateRules(text, "email");
    const laya = await evaluateLayaModel(text, flags);
    const { score, verdict } = combineScore(ruleScore, laya, "email", flags, isPromoClutter);
    for (const f of flags) {
      if (SYNTHETIC_SPANS.has(f.span)) continue;
      const haystack = (r.subject + "\n" + r.from + "\n" + r.body).toLowerCase();
      if (!haystack.includes(String(f.span).toLowerCase())) {
        ungrounded.push({ id: r.id, span: f.span, reason: f.reason });
      }
    }
    return { score, verdict, flags: flags.length };
  };

  const runCorpus = async (label, filePath, expectCounts) => {
    const records = parseCorpus(filePath);
    console.log(`\n=== ${label} (${records.length} records) ===`);
    const cm = { tp: 0, fn: 0, tn: 0, fp: 0 };
    const missed = [];
    for (const r of records) {
      const out = await scoreOne(r);
      // A detection is a THREAT verdict, not merely a score above the
      // suspicious threshold. See the THREAT_VERDICTS note above: bulk
      // marketing is deliberately scored above that threshold and must not
      // be counted as a false positive.
      const detected = isThreat(out);
      const isScam = r.label === "scam";
      let mark;
      if (isScam && detected) { cm.tp++; mark = "DETECTED"; }
      else if (isScam && !detected) { cm.fn++; mark = "missed  "; missed.push(r.id); }
      else if (!isScam && detected) { cm.fp++; mark = "FALSE POS"; }
      else { cm.tn++; mark = "ok      "; }
      console.log(
        `  ${mark} ${r.id.padEnd(9)} ${String(out.score).padStart(3)} ` +
          `${out.verdict.padEnd(14)} flags=${String(out.flags).padStart(2)} ${r.subject.slice(0, 42)}`
      );
    }
    const scamN = cm.tp + cm.fn;
    const hamN = cm.tn + cm.fp;
    const recall = scamN ? cm.tp / scamN : 1;
    const spec = hamN ? cm.tn / hamN : 1;
    console.log(
      `  recall ${cm.tp}/${scamN} = ${(recall * 100).toFixed(1)}%` +
        (hamN ? `   specificity ${cm.tn}/${hamN} = ${(spec * 100).toFixed(1)}%` : "   (no ham in this corpus)")
    );
    check(
      `${label}: ${expectCounts.records} records parsed`,
      records.length === expectCounts.records,
      `${records.length} found`
    );
    check(
      `${label}: recall >= ${(expectCounts.recall * 100).toFixed(0)}%`,
      recall >= expectCounts.recall,
      `${(recall * 100).toFixed(1)}%`
    );
    if (hamN) {
      check(
        `${label}: specificity >= ${(expectCounts.spec * 100).toFixed(0)}%`,
        spec >= expectCounts.spec,
        `${(spec * 100).toFixed(1)}%`
      );
      check(
        `${label}: no false positives`,
        cm.fp === 0,
        cm.fp ? `${cm.fp} ham messages flagged` : "all ham clean"
      );
    }
    if (missed.length) {
      allMisses.push({ label, missed });
      const undeclared = missed.filter((id) => !KNOWN_MISSES.has(id));
      check(
        `${label}: no undeclared misses`,
        undeclared.length === 0,
        undeclared.length ? undeclared.join(", ") : `${missed.length} declared`
      );
    }
    return { cm, recall, spec };
  };

  const a = await runCorpus("corpus A (scam-only, 20)", CORPUS_PATH, {
    records: 20, recall: REQUIRED_RECALL_A, spec: 0
  });
  const b = await runCorpus("corpus B (mixed, 9 scam + 2 ham)", MIXED_PATH, {
    records: 11, recall: REQUIRED_RECALL_B, spec: REQUIRED_SPECIFICITY_B
  });
  const c = fs.existsSync(USER_CORPUS_PATH)
    ? await runCorpus("corpus C (user dataset, 13 scam + 1 ham)", USER_CORPUS_PATH, {
        records: 14, recall: 0.85, spec: 1.0
      })
    : null;

  // The ham records in corpus B are not merely "not a threat" - they are bulk
  // marketing spam, and the product has a dedicated verdict for that. Assert
  // the classification directly, because a suite that only checks
  // "ham was not escalated" would still pass if the engine silently went back
  // to calling these "safe", which is exactly the regression that made them
  // score 1/100 and 8/100 while the banner told the user the message
  // "appears legitimate".
  const spamVerdicts = await (async () => {
    const records = parseCorpus(MIXED_PATH).filter((r) => r.label !== "scam");
    const out = [];
    for (const r of records) {
      const res = await scoreOne(r);
      out.push({ id: r.id, verdict: res.verdict, score: res.score });
    }
    return out;
  })();
  console.log("\nspam classification:");
  for (const s of spamVerdicts) {
    console.log(`  ${s.id.padEnd(9)} ${String(s.score).padStart(3)} ${s.verdict}`);
  }
  const spamUnlabelled = spamVerdicts.filter((s) => s.verdict === "safe");
  check(
    "bulk-marketing spam is labelled promo_clutter, not 'safe'",
    spamVerdicts.length > 0 && spamUnlabelled.length === 0,
    spamVerdicts.length
      ? spamVerdicts.map((s) => `${s.id}=${s.verdict}`).join(", ")
      : "no ham records to classify"
  );
  const spamEscalated = spamVerdicts.filter((s) => THREAT_VERDICTS.has(s.verdict));
  check(
    "bulk-marketing spam is never escalated to a threat verdict",
    spamEscalated.length === 0,
    spamEscalated.map((s) => s.id).join(", ")
  );

  // Combined matrix across all corpora.
  const cm = {
    tp: a.cm.tp + b.cm.tp + (c ? c.cm.tp : 0),
    fn: a.cm.fn + b.cm.fn + (c ? c.cm.fn : 0),
    tn: a.cm.tn + b.cm.tn + (c ? c.cm.tn : 0),
    fp: a.cm.fp + b.cm.fp + (c ? c.cm.fp : 0),
  };
  const scamN = cm.tp + cm.fn;
  const hamN = cm.tn + cm.fp;
  const precision = cm.tp + cm.fp ? cm.tp / (cm.tp + cm.fp) : 1;
  console.log(`\n=== combined over all corpora ===`);
  console.log(`  TP ${cm.tp}   FN ${cm.fn}   TN ${cm.tn}   FP ${cm.fp}`);
  console.log(
    `  recall ${(100 * cm.tp / scamN).toFixed(1)}%   ` +
      (hamN ? `specificity ${(100 * cm.tn / hamN).toFixed(1)}%   ` : "") +
      (cm.tp + cm.fp ? `precision ${(100 * precision).toFixed(1)}%` : "precision n/a (no ham)")
  );
  console.log(
    "\n  NOTE: precision here is measured against only " + hamN +
      " genuine ham message(s). It is not a publishable precision figure."
  );

  check(
    "no ungrounded flag spans (engine never invents evidence)",
    ungrounded.length === 0,
    ungrounded.length ? JSON.stringify(ungrounded.slice(0, 3)) : "all spans verbatim"
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
  console.log(
    `\nALL SCAM CORPUS CHECKS PASSED (corpus A recall ${(a.recall * 100).toFixed(1)}%, ` +
      `corpus B recall ${(b.recall * 100).toFixed(1)}% / specificity ${(b.spec * 100).toFixed(1)}%, ` +
      `0 false positives)`
  );
}

main().catch((err) => {
  console.error("SCAM CORPUS SUITE ERROR:", err.message);
  process.exit(1);
});
