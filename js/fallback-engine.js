/**
 * Offline fallback analyser for the Gmail extension.
 *
 * The extension is a thin client: it POSTs redacted text to the server and
 * renders whatever comes back. This file is the LAST-RESORT path, used only
 * when both the local server and the Vercel deployment are unreachable.
 *
 * It previously checked seven hardcoded keywords and returned a binary 75 or 12,
 * which meant that whenever the server was down the extension could not see any
 * of the fraud families the engine now detects - an inheritance lure, a
 * Firebase-hosted bank lookalike, a Reply-To redirect, a mixed-script homoglyph
 * or a delivery-fee scam all read as "safe".
 *
 * So this implements the same signal families as the server, in a compact form
 * safe to ship in a content script: no imports, one global, no network.
 *
 * The console has an equivalent copy at js/fallback-engine.js. They must be two
 * files because a Chrome extension can only ship files inside extension/, and
 * the deployed site cannot serve /extension/* (vercel.json 404s it).
 * server/test-fallback-parity.js asserts the two stay behaviourally identical.
 */
(function (global) {
  "use strict";

  var FAMILIES = [
    { name: "advance_fee", points: 20, patterns: [
      /you\s+have\s+been\s+selected\s+to\s+receive/i,
      /lucky\s+(winner|beneficiar)/i,
      /your\s+email\s+address\s+was\s+found\s+in\s+the\s+list/i,
      /\$\s?[\d,.]+\s*(million|m)\b|western\s+union|wire\s+transfer|money\s?gram/i,
      /activat\w*\s+fee|charitable\s+donation\s+of\s+\$|lottery\s+winnings?|grant\s+sum\s+of/i,
      /get\s+\d{1,3}\s*%\s+for\s+your\s+(cooperation|partnership)/i ] },
    { name: "refund_bait", points: 18, patterns: [
      /\brefund\s+(bill|amount|of|has\s+been)\b/i,
      /overpayment|paid\s+twice|submit\s+your\s+refund|claim\s+your\s+refund/i,
      /will\s+be\s+credited\s+within\s+\d+/i ] },
    { name: "delivery_fee", points: 20, patterns: [
      /non-?payment\s+of\s+[\d.,]+|pay\s+the\s+new\s+shipping\s+cost/i,
      /unable\s+to\s+deliver|were\s+unable\s+to\s+deliver/i,
      /delivery\s+failed\s+on|still\s+on\s+hold|on\s+hold\s+in\s+our\s+post/i ] },
    { name: "fake_subscription", points: 18, patterns: [
      /storage\s+is\s+full|upgrade\s+(your\s+)?storage|not\s+backing\s+up/i,
      /your\s+subscription\s+(ends|is\s+about\s+to\s+expire)/i,
      /rewards?\s+will\s+expire|claim\s+your\s+reward/i ] },
    { name: "fake_security", points: 20, patterns: [
      /2fa\s+(will\s+be\s+|is\s+now\s+)?mandatory|enable\s+2fa\s+now/i,
      /mandatory\s+for\s+all\s+\w+\s+accounts|two-factor\s+authentication/i,
      /protect\s+your\s+wallet|transaction\s+was\s+declined/i ] },
    { name: "investment", points: 15, patterns: [
      /\$[A-Z]{2,6}\s+token|airdrop/i,
      /approved\s+and\s+disbursed\s+within\s+\d+\s+hours?/i,
      /loan\s+solutions|private\s+loan\s+investment|investment\s+opportunit/i ] },
    { name: "health_claim", points: 15, patterns: [
      /self-?healing\s+protocol|vision\s+restoration\s+protocol/i,
      /nearly\s+blind\s+to\s+perfect\s+20\/20/i,
      /before\s+the\s+video\s+is\s+taken\s+down/i ] },
    { name: "personal_data", points: 15, patterns: [
      /copy\s+of\s+your\s+identification|have\s+your\s+id\s+ready/i,
      /your\s+full\s+names?\s*[:\n]|your\s+country\s*[:\n]/i,
      /cell\/telephone\s+numbers?|home\s+or\s+office\s+address/i ] },
    { name: "contact_stranger", points: 15, patterns: [
      /contact\s+(me|us|him|her|them)\s+urgently|contact\s+\w+\s+urgently/i,
      /partnership\s+agreement|for\s+your\s+claim\s+and\s+more/i,
      /respond\s+(back\s+)?to\s+this\s+email|reply\s+(back\s+)?to\s+this\s+email/i ] },
    { name: "inheritance", points: 25, patterns: [
      /shared\s+your\s+surname|no\s+known\s+heirs?\b/i,
      /passed\s+away\s+(recently|abroad)?|stage\s+\d\s+cancer/i,
      /widow\s+(with|of)\b|my\s+days\s+are\s+numbered/i,
      /legal\s+representative\s+of\s+the\s+late|law\s+chambers/i,
      /utili[sz]e\s+the\s+proceeds\s+realized|entrust\s+the\s+money\s+in\s+your\s+care/i ] }
  ];

  var ABUSED_HOST = /(^|\.)(firebaseapp\.com|pages\.dev|web\.app|netlify\.app|vercel\.app|glitch\.me|repl\.co)$/i;
  var FREE_MAIL = /(^|\.)(gmail\.com|outlook\.com|hotmail\.com|yahoo\.com|icloud\.com|proton(mail\.com|me)|aol\.com)$/i;
  var RISKY_TLD = /https?:\/\/[\w.-]*\.(xyz|top|tk|club|work|gq|cf|ml|page|icu|buzz|cam|lol|online|site|space|link|click|fun|trade|quest|cyou|sbs)\b/i;
  var SIX_FIGURE = /[$€£]\s?\d{2,3}(?:,\d{3})+(?:\.\d{2})?|\b\d{2,3}(?:,\d{3})+\s*(?:usd|eur|gbp|sgd|rm)\b/i;
  var CREDENTIAL = /verify\s+your\s+(credentials|password|identity|account)|enter\s+your\s+(password|pin|ssn)|provide\s+(your\s+)?otp|\(login|auth|signin|password-reset\)\s*link/i;
  var URGENCY = /expires?\s+today|action\s+required|within\s+\d+\s*(hours?|mins?|days?)|account\s+(suspended|locked|terminated|restricted)|unusual\s+(activity|login|transaction)|will\s+be\s+(suspended|locked|disabled)|final\s+notice|last\s+warning|expire\s+in\s+\d+\s*h/i;
  var SHORTENER = /https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|t\.ly|lnkd\.in)\b/i;
  var NON_LATIN = /[Α-Ωα-ωЀ-ӿ]/;

  function domainsOf(text, header) {
    var re = new RegExp("^\\s*" + header + "\\s*:\\s*.*?@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})", "gim");
    var out = [];
    var m;
    while ((m = re.exec(text)) !== null) {
      var d = m[1].toLowerCase().replace(/^www\./, "");
      if (out.indexOf(d) === -1) out.push(d);
    }
    return out;
  }

  /** A Latin word carrying one or two Cyrillic/Greek characters. */
  function mixedScript(text) {
    var re = /[A-Za-zΑ-Ωα-ωЀ-ӿ][A-Za-z0-9Α-Ωα-ωЀ-ӿ'.-]*/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      var t = m[0];
      if (!NON_LATIN.test(t)) continue;
      var latin = (t.match(/[A-Za-z]/g) || []).length;
      if (latin >= t.length * 0.5) return t;
    }
    return null;
  }

  /**
   * @param {string} text  Already client-redacted message text.
   * @returns {object} the same response shape the server returns.
   */
  function analyze(text) {
    var t = String(text || "");
    var flags = [];
    var score = 0;

    var fired = {};
    FAMILIES.forEach(function (fam) {
      if (fired[fam.name]) return;
      var hits = 0;
      for (var i = 0; i < fam.patterns.length; i++) {
        var m = t.match(fam.patterns[i]);
        if (!m) continue;
        fired[fam.name] = true;
        flags.push({
          span: m[0].replace(/\s+/g, " ").trim().slice(0, 80),
          reason: "Offline signal: " + fam.name.replace(/_/g, " "),
          type: "rule"
        });
        score += fam.points;
        hits++;
        if (hits >= 2) break;
        score += Math.round(fam.points * 0.5);
      }
    });

    // Structural signals that depend on no brand list.
    var from = domainsOf(t, "from");
    var replyTo = domainsOf(t, "reply-to");
    if (replyTo.length && from.length) {
      var redirect = replyTo.filter(function (rt) {
        return !from.some(function (fd) { return rt === fd || rt.indexOf("." + fd) === 0; });
      })[0];
      if (redirect) {
        flags.push({
          span: redirect,
          reason: "Reply-To redirect: replies are routed to " + redirect,
          type: "rule"
        });
        score += 25;
      }
    }

    var homoglyph = mixedScript(t);
    if (homoglyph) {
      flags.push({
        span: homoglyph,
        reason: "Mixed-script homoglyph: the word contains non-Latin characters",
        type: "rule"
      });
      score += 30;
    }

    var abused = from.filter(function (d) { return ABUSED_HOST.test(d); })[0];
    if (abused) {
      flags.push({
        span: abused,
        reason: "Sender domain is free anonymous hosting, commonly used to serve brand lookalikes",
        type: "rule"
      });
      score += 20;
    }

    if (RISKY_TLD.test(t)) {
      flags.push({ span: t.match(RISKY_TLD)[0], reason: "Link to a heavily-abused cheap top-level domain", type: "rule" });
      score += 20;
    }
    if (SHORTENER.test(t)) {
      flags.push({ span: t.match(SHORTENER)[0], reason: "URL shortener conceals the true destination domain", type: "rule" });
      score += 35;
    }

    var hasMoney = fired.advance_fee || fired.refund_bait || fired.investment || fired.delivery_fee;
    var hasAsk = fired.personal_data || fired.contact_stranger || fired.fake_security || fired.fake_subscription;

    if (hasMoney && hasAsk) {
      flags.push({
        span: "Money bait + unsolicited action request",
        reason: "High-risk combination: an unexpected financial claim is paired with a request for personal data, payment, or an off-channel reply",
        type: "rule"
      });
      score += 45;
    }
    if (fired.advance_fee && SIX_FIGURE.test(t)) {
      flags.push({
        span: "Unsolicited payout claim with a specific large amount",
        reason: "High-risk combination: an unsolicited prize, grant or compensation claim quotes a specific six-figure or larger sum",
        type: "rule"
      });
      score += 25;
    }

    var hasUrgency = URGENCY.test(t);
    var hasCred = CREDENTIAL.test(t);
    if (hasUrgency) score += 25;
    if (hasCred) {
      score += 30;
      flags.push({ span: "credential request", reason: "Credential or OTP request", type: "rule" });
    }
    if (hasUrgency && hasCred) {
      flags.push({
        span: "Urgency + Credential Harvesting Combo",
        reason: "High-risk combination: Urgency pressure combined with credential login request",
        type: "rule"
      });
      score += 45;
    }

    // A consumer mailbox is never an official sender. gmail.com belongs to
    // Google, but a message sent from a personal mailbox is not from Google -
    // treating it as one caps the score and hides the evidence.
    var fromIsFree = from.some(function (d) { return FREE_MAIL.test(d); });
    if (!fromIsFree && from.length && !flags.length) score = Math.min(score, 12);

    score = Math.max(0, Math.min(100, score));

    var verdict = "safe";
    if (score >= 66) verdict = "high_risk";
    else if (score >= 35) verdict = "suspicious";

    var steps;
    if (verdict === "high_risk") {
      steps = [
        "Do NOT click any links, open attachments, or enter passwords on this email.",
        "Report the sender as phishing and block the domain.",
        "Verify the account directly at the official brand URL, typed by hand."
      ];
    } else if (verdict === "suspicious") {
      steps = [
        "Do not enter credentials or pay any fee from this message.",
        "Verify the sender through an official channel before acting."
      ];
    } else {
      steps = ["No strong scam indicators found, but stay alert for requests for money or credentials."];
    }

    return {
      score: score,
      verdict: verdict,
      flags: flags,
      explanation: verdict === "safe"
        ? "Offline analysis found no strong scam indicators. This is a reduced check, not a full analysis."
        : "Offline analysis flagged " + flags.length + " indicator(s) while the main engine was unreachable.",
      next_steps: steps,
      privacy: {
        phones_masked: (t.match(/\[PHONE_REDACTED\]/g) || []).length,
        emails_masked: (t.match(/\[EMAIL_REDACTED\]/g) || []).length,
        otp_masked: (t.match(/\[OTP_REDACTED\]/g) || []).length
      },
      engine: {
        rules: "offline-fallback-subset",
        model_source: "offline_fallback_heuristic",
        explain_source: "offline_fallback",
        degraded: true,
        note: "The main engine was unreachable. These signals are a subset and are less thorough."
      }
    };
  }

  global.RatiodFallback = { analyze: analyze, FAMILIES: FAMILIES.map(function (f) { return f.name; }) };

  if (typeof module !== "undefined" && module.exports) module.exports = global.RatiodFallback;
})(typeof window !== "undefined" ? window : globalThis);
