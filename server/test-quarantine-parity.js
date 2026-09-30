/**
 * Regression: the inbox badge and the open-message banner must agree.
 *
 * Three separate defects shipped together and produced the report this file
 * exists for: a banner reading "SAFE / 16 - consistent with legitimate mail"
 * sitting directly beside a red "RISK 78" badge for the SAME message, on a
 * message Gmail had already put in Spam.
 *
 *   1. extension/content-script.js hardcoded `score = 78; verdict = "high_risk"`
 *      for every row in the Spam view. Nothing was analysed; the number was a
 *      literal, identical on every row.
 *   2. The verdict cache that was meant to give badge/banner parity never hit.
 *      The banner saved under the open-message header subject (`h2.hP`) and the
 *      row looked it up under the list-row subject (`span.bog`); Gmail truncates
 *      those differently, so the keys never collided.
 *   3. The blocked-sender notice the extension copies into the payload
 *      ("Why is this message in spam? You have blocked <address>") matched no
 *      rule in the engine, so the most decisive evidence was discarded, and the
 *      official-brand-domain cap then clamped the score to 25.
 *
 * Nothing asserted any of this, which is why it shipped silently.
 */
const fs = require("fs");
const path = require("path");
const { handleAnalyze } = require("./routes/analyze");

const ROOT = path.resolve(__dirname, "..");
let bad = 0;
const check = (label, ok, detail) => {
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
};

// The real message from the bug report: an official-brand newsletter from a
// sender the user had blocked, so Gmail quarantined it.
const BLOCKED_SENDER_NOTICE =
  "Security Warning: Why is this message in spam? You have blocked english-personalized-digest@quora.com.";
const QUORA_BODY = [
  "From: english-personalized-digest@quora.com",
  "Subject: Railway ka naya farman",
  "",
  "Hi Vedant, here are the top stories from your feed. Railway ne naya rule kiya hai.",
  "Read more: https://www.quora.com/railway-news?utm_source=digest",
  "",
  "Unsubscribe here: https://quora.com/unsubscribe",
  "You received this because you subscribed. Manage preferences: https://quora.com/settings",
].join("\n");

(async () => {
  // --- Defect 3: the mailbox verdict must reach the model -------------------
  const quarantined = await handleAnalyze({
    text: `${BLOCKED_SENDER_NOTICE}\n${QUORA_BODY}`,
    channel: "email",
    auth: { fromDomain: "quora.com", mailedBy: null, signedBy: null }
  });

  check("quarantined message is not reported safe",
    quarantined.verdict !== "safe", `${quarantined.score}/${quarantined.verdict}`);
  check("quarantine notice produces a quarantine flag",
    (quarantined.flags || []).some(f => f.type === "quarantine"),
    (quarantined.flags || []).map(f => f.reason).join(" | "));
  check("explanation never calls quarantined mail legitimate",
    !/consistent with legitimate mail/i.test(quarantined.explanation || ""),
    quarantined.explanation);
  check("explanation states the provider quarantined it",
    /QUARANTINED/i.test(quarantined.explanation || ""));

  // A blocked sender is a user preference, not proof of phishing: it must not be
  // escalated to high_risk, or every blocked sender becomes a false alarm.
  check("blocked sender alone is not high_risk",
    quarantined.verdict !== "high_risk", `${quarantined.score}/${quarantined.verdict}`);

  // The official-domain cap must not win over the quarantine floor.
  check("official-brand cap does not clamp a quarantined message to 25",
    quarantined.score > 25, `${quarantined.score}`);

  // Without the notice, the same body is ordinary mail - this guards that the
  // new rule keys off the provider's verdict and not off newsletter wording.
  const plainNewsletter = await handleAnalyze({
    text: QUORA_BODY,
    channel: "email",
    auth: { fromDomain: "quora.com", mailedBy: null, signedBy: null }
  });
  check("same body without the notice stays safe",
    plainNewsletter.verdict === "safe", `${plainNewsletter.score}/${plainNewsletter.verdict}`);

  // The 0.70/0.30 blend is a third, independent way the quarantine signal could
  // be lost, and the rule-engine floor alone does not defend against it. This
  // asserts the combiner directly, with the model voting "safe" at the lowest
  // probability it can emit, so any dilution of the rule floor into "safe" is
  // caught here rather than in a user's inbox.
  const { combineScore } = require("./combine/score");
  const { evaluateRules } = require("./rules/engine");

  const carrier = evaluateRules(
    `${BLOCKED_SENDER_NOTICE}\nFrom: x@quora.com\nSubject: s\n\nBody.`,
    "email",
    { fromDomain: "quora.com", mailedBy: null, signedBy: null }
  );
  const blended = combineScore(
    carrier.ruleScore,
    { probability: 0.02, label: "safe", source: "test" },
    "email",
    carrier.flags,
    carrier.isPromoClutter,
    carrier.isAuthDisqualified
  );
  check("quarantine survives the 0.70/0.30 blend against a low model score",
    blended.verdict !== "safe", `${blended.score}/${blended.verdict}`);
  check("blended quarantine verdict carries quarantine wording",
    !/consistent with legitimate mail/i.test(blended.next_steps.join(" ") || ""),
    blended.next_steps[0]);

  await checkExtensionSource();
})();

// __PART2__
/**
 * Defects 1 & 2 live in the extension source, so they are asserted statically:
 * the content script cannot be executed outside a Gmail DOM, but the two
 * failure modes are both textual (a fabricated literal, and a cache key that is
 * built differently on the save and lookup paths).
 */
async function checkExtensionSource() {
  const contentScript = fs.readFileSync(path.join(ROOT, "extension/content-script.js"), "utf8");

  // Strip comments so the explanatory comment documenting the removed literal
  // cannot satisfy (or trip) the assertion.
  const live = contentScript.split("\n").filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join("\n");

  check("no hardcoded Spam-folder risk score in live code",
    !/score\s*=\s*78\b/.test(live),
    "a fabricated /100 must never be rendered as a measurement");
  check("badge cache key is normalised before lookup",
    /const cacheKey\s*=\s*normalizeSubjectKey\(/.test(contentScript));
  check("verdict cache is written through the same normaliser",
    /const cleanKey\s*=\s*normalizeSubjectKey\(/.test(contentScript));

  // The normaliser itself, exercised on the exact truncation pair from the
  // report: Gmail cut the row subject and the header subject at different
  // points, which is what made the two cache keys disagree.
  const src = contentScript.match(/function normalizeSubjectKey\(value\)\s*\{[\s\S]*?\n\}/);
  check("normalizeSubjectKey is defined", !!src);
  if (src) {
    const body = src[0]
      .replace(/^function normalizeSubjectKey\(value\)\s*\{/, "")
      .replace(/\}\s*$/, "");
    // eslint-disable-next-line no-new-func
    const normalizeSubjectKey = new Function("value", body);

    const headerSubject = "Railway ka naya farman- ab train ticket hone ke bawajood bhi lagega jumina, jaaniye kya hai ni…";
    const rowSubject = "Railway ka naya farman- ab train ticket hone ke bawajood bhi lagega ju…";
    check("truncated header and row subjects derive the same cache key",
      normalizeSubjectKey(headerSubject) === normalizeSubjectKey(rowSubject),
      JSON.stringify(normalizeSubjectKey(rowSubject)));

    // The key must stay inside Gmail's row-truncation width. If it were as long
    // as the full subject, the two strings would diverge again whenever Gmail
    // truncated the row, and the badge would silently desync once more.
    check("key is shorter than the truncated row subject",
      normalizeSubjectKey(rowSubject).length < rowSubject.replace(/…$/, "").length,
      `key=${normalizeSubjectKey(rowSubject).length} chars`);
    check("cache key is stable for an already-normal subject",
      normalizeSubjectKey("Quarterly Report") === "quarterly report");
    check("an empty subject yields an empty key",
      normalizeSubjectKey("") === "");

    // The key must strip any prepended badge text or email reply/forward prefixes,
    // so an existing badge in the DOM can never cause a cache miss between badge and banner.
    check("badge prefix in row text does not desync key from clean header subject",
      normalizeSubjectKey("[ 🟢 SAFE ] " + headerSubject) === normalizeSubjectKey(headerSubject),
      "badge text stripped");
    check("suspicious badge prefix does not desync key",
      normalizeSubjectKey("[ 🟠 SUSP 48 ] " + rowSubject) === normalizeSubjectKey(headerSubject),
      "suspicious badge stripped");
    check("risk badge prefix does not desync key",
      normalizeSubjectKey("[ 🔴 RISK 82 ] " + rowSubject) === normalizeSubjectKey(headerSubject),
      "risk badge stripped");
    check("Re: and Fwd: prefixes do not desync key",
      normalizeSubjectKey("Re: " + headerSubject) === normalizeSubjectKey(headerSubject),
      "thread prefixes stripped");
  }

  // The badge must be mounted as a sibling before the target, not nested inside span.bog
  check("badge is mounted as a sibling before target rather than polluting inner text",
    /target\.parentNode\.insertBefore\(badge,\s*target\)/.test(contentScript));
  check("clean row subject extraction removes .ratiod-inbox-pill",
    /extractCleanRowSubject/.test(contentScript) && /\.ratiod-inbox-pill/.test(contentScript));

  // The offline engine must agree, or a degraded connection re-creates the bug.
  const offline = fs.readFileSync(path.join(ROOT, "extension/fallback-engine.js"), "utf8");
  check("offline engine handles the quarantine notice",
    /QUARANTINE/.test(offline) && /isQuarantined/.test(offline));

  console.log(
    bad === 0
      ? "\nBADGE AND BANNER MUST AGREE (quarantine is detected, never fabricated)"
      : `\n${bad} BADGE/BANNER PARITY CHECK(S) FAILED`
  );
  process.exit(bad === 0 ? 0 : 1);
}
