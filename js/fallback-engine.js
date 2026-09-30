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
      /rewards?\s+will\s+expire|claim\s+your\s+reward/i,
      /storage\s+(?:has\s+reached|reached)\s+critical\s+limit|storage\s+sync\s+(?:has\s+been\s+)?paused|storage\s+limit\s+(?:exceeded|reached)|cloud\s+files\s+will\s+be\s+removed|without\s+cloud\s+space|cloud\s+has\s+been\s+disabled/i ] },
    { name: "fake_security", points: 20, patterns: [
      /2fa\s+(will\s+be\s+|is\s+now\s+)?mandatory|enable\s+2fa\s+now/i,
      /mandatory\s+for\s+all\s+\w+\s+accounts|two-factor\s+authentication/i,
      /protect\s+your\s+wallet|transaction\s+was\s+declined/i,
      /cloud\s+antivirus\s+expired|threat\s+to\s+your\s+device|compromise\s+your\s+sim\s+card|renew\s+your\s+shield|unprotected\s+against\s+cyber\s+attacks|subscription\s+(?:termination\s+notice|will\s+be\s+closed|has\s+closed)/i ] },
    { name: "investment", points: 15, patterns: [
      /\$[A-Z]{2,6}\s+token|airdrop/i,
      /approved\s+and\s+disbursed\s+within\s+\d+\s+hours?/i,
      /loan\s+solutions|private\s+loan\s+investment|investment\s+opportunit/i ] },
    { name: "health_claim", points: 20, patterns: [
      /self-?healing\s+protocol|vision\s+restoration\s+protocol/i,
      /nearly\s+blind\s+to\s+perfect\s+20\/20/i,
      /before\s+the\s+video\s+is\s+taken\s+down|watch\s+the\s+(?:free\s+|unedited\s+|full\s+|banned\s+|silhouette\s+)?(?:presentation|video|seminar|report)/i,
      // Direct-response health-device advertorials: a specific therapeutic
      // outcome for a consumer product, sold on discount + money-back trial.
      /reduce\s+spinal\s+pressure|support\s+disc\s+rehydration|create\s+space\s+between\s+vertebrae/i,
      /for\s+people\s+dealing\s+with\s+(?:recurring\s+)?(?:back\s+(?:pain|discomfort)|sciatica|joint\s+pain)/i,
      /insulin\s+vampire|parasit\w+\s+infection|causing\s+type\s+2\s+diabetes|ancient\s+.*ritual|flushes?\s+it\s+out\s+of\s+the\s+pancreas/i,
      /vicks\s+vapo\s*rub|vapo\s*rub\s+trick|vick\s+trick|shrink\s+(?:your\s+|inflamed\s+|enlarged\s+)?prostate|waking\s+up\s+\d+(?:-\d+)?\s+times\s+a\s+night\s+to\s+pee/i,
      /steelpower|rock\s+hard\s+stamina|male\s+vitality|men['’]?s\s+health\s+(?:alert|intelligence)/i,
      /tomato\s+skin\s+(?:morning\s+)?protocol|tomato\s+skin\s+trick|stop\s+taking\s+flomax|flowstrong|firehose\s+stream|prostate\s+swelling/i,
      /rekindle\s+your\s+spark|instant\s+readiness|no\s+last-minute\s+pills|natural\s+mix\s+works|erection\s+solution/i,
      /horsewood|increases?\s+your\s+penis|[\d.]+\s*inch\s+gains?|doctor\s+exposes\s+the\s+trick/i,
      /silhouette\s+video|endopump|stiff\s+as\s+steel|stiffens?\s+your\s+johnson|chicken-choking|restores\s+the\s+natural\s+blood\s+flow|jackhammer\s+her/i,
      /prostavive|dissolves?\s+prostate\s+clog|spring\s+water\s+juice|pee\s+(?:hard\s+against\s+the\s+bowl|like\s+a\s+water\s+cannon|like\s+a\s+river)/i,
      /diabetic\s+parasite|glycolean|why\s+your\s+doctor\s+hasn['’]?t\s+told\s+you|pharmaceutical\s+industry\s+is\s+furious|get\s+this\s+segment\s+scrubbed/i,
      /barbara\s+o['’]?neill|banned\s+(?:lecture|seminar|video)|leaked\s+(?:lecture|broadcast|seminar)|regenerates?\s+dead\s+nerves|calm\s+(?:the\s+)?burning\s+and\s+tingling|neuropathic\s+pain/i ] },
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
  var URGENCY = /expires?\s+today|action\s+required|within\s+(?:the\s+next\s+)?\d+\s*(hours?|mins?|days?)|account\s+(suspended|locked|terminated|restricted)|unusual\s+(activity|login|transaction)|will\s+be\s+(suspended|locked|disabled)|final\s+notice|last\s+warning|expire\s+in\s+\d+\s*h|failure\s+to\s+renew|photos\s+(?:and\s+videos\s+)?will\s+be\s+(?:deleted|removed)|data\s+is\s+scheduled\s+for\s+deletion|permanently\s+(?:purged|removed)/i;
  var SHORTENER = /https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|t\.ly|lnkd\.in)\b/i;
  var NON_LATIN = /[Α-Ωα-ωЀ-ӿ]/;

  /**
   * Bulk-marketing / cold-blast markers.
   *
   * Mirrors the server's PROMOTIONAL_CLUTTER_PATTERNS additions. Without these
   * the extension reported genuine conference and training blasts as "safe"
   * whenever the server was unreachable, telling the user that a message it
   * had no model for was fine. These describe the opt-out MECHANISM - a keyword
   * reply rather than a real unsubscribe link - not the topic, because the
   * topic is not what separates cold marketing from opted-in mail.
   */
  var PROMO = [
    /unsubscribe/i,
    /%\s+off|discount|exclusive\s+invite|limited\s+seats|explore\s+how/i,
    /put\s+(?:the\s+word\s+)?["“']?[\s-]*(?:remove|remove-me|unsubscribe|stop|opt[\s-]?out)["”']?\s+(?:on|in|to)\s+the\s+subject/i,
    /reply\s+with\s+["“'][^"”]{1,40}["”]\s+on\s+the\s+(?:email\s+)?subject/i,
    /if\s+you\s+(?:prefer|wish)\s+not\s+to\s+receive\s+(?:any\s+)?(?:further|more|future)\s+emails?/i,
    /feel\s+free\s+to\s+request\s+(?:a\s+|our\s+)?brochures?\b/i
  ];

  /*
   * Mirrors the server's QUARANTINE_NOTICE_PATTERNS.
   *
   * Gmail copies its own spam explanation ("You have blocked <address>", "Why is
   * this message in spam?") into the analysed text, but no offline pattern
   * matched it. With the server unreachable, a message the mailbox had already
   * filtered scored 0/safe - the worst possible failure, because it is the
   * user's own spam folder telling them the mail is fine.
   *
   * Floored into the unwanted band, never high_risk: a blocked sender is a user
   * preference, not proof of phishing.
   */
  var QUARANTINE = [
    { re: /you have blocked\s+[^\s@]+@[^\s<>()]+/i, escalate: false },
    { re: /why is this message in spam\?/i, escalate: false },
    { re: /this message (?:was )?(?:may look )?like spam|looks like (?:unwanted|bulk)/i, escalate: false },
    { re: /suspected (?:phishing|spam)|not opened by (?:any|everyone)|recipients haven't opened/i, escalate: true }
  ];

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

  var BRANDS = [
    "microsoft.com", "office.com", "google.com", "apple.com", "amazon.com", "paypal.com",
    "netflix.com", "bankofamerica.com", "chase.com", "wellsfargo.com", "stripe.com",
    "github.com", "linkedin.com", "usps.com", "fedex.com", "ups.com", "dhl.com",
    "singtel.com", "grab.com", "metamask.io", "iras.gov.sg", "visa.com", "mastercard.com"
  ];

  function isProtectedBrand(domain) {
    if (!domain) return false;
    var d = domain.toLowerCase().replace(/^www\./, "");
    for (var i = 0; i < BRANDS.length; i++) {
      var b = BRANDS[i];
      if (d === b || d.endsWith("." + b)) return true;
    }
    return false;
  }

  /**
   * @param {string} text  Already client-redacted message text.
   * @param {string} [channel] "email" | "sms"
   * @param {object} [auth] Authentication headers { fromDomain, mailedBy, signedBy, dmarc, spf, dkim }
   * @returns {object} the same response shape the server returns.
   */
  function analyze(text, channel, auth) {
    if (typeof channel === "object" && !auth) {
      auth = channel;
      channel = "email";
    }
    channel = channel || "email";

    var t = String(text || "");
    var flags = [];
    var score = 0;

    // Mailbox-provider quarantine notice. Collected first so the flag is
    // available to every later decision, including the "clean sender" clamp.
    var isQuarantined = false;
    var quarantineEscalated = false;
    for (var q = 0; q < QUARANTINE.length; q++) {
      var qm = t.match(QUARANTINE[q].re);
      if (!qm) continue;
      flags.push({
        span: qm[0],
        reason: QUARANTINE[q].escalate
          ? "Mailbox provider flagged this message as suspected phishing"
          : "Sender is on the recipient's blocked-senders list, so Gmail routed this to Spam",
        type: "quarantine"
      });
      isQuarantined = true;
      if (QUARANTINE[q].escalate) quarantineEscalated = true;
    }

    var from = domainsOf(t, "from");
    var replyTo = domainsOf(t, "reply-to");
    var fromDomain = (auth && auth.fromDomain) ? auth.fromDomain.toLowerCase().replace(/^www\./, "") : (from[0] || "");

    var isAuthDisqualified = false;
    if (auth && typeof auth === "object") {
      var signedBy = auth.signedBy ? auth.signedBy.toLowerCase().replace(/^www\./, "") : null;
      var mailedBy = auth.mailedBy ? auth.mailedBy.toLowerCase().replace(/^www\./, "") : null;
      var dmarc = auth.dmarc ? auth.dmarc.toLowerCase() : null;
      var spf = auth.spf ? auth.spf.toLowerCase() : null;
      var dkim = auth.dkim ? auth.dkim.toLowerCase() : null;

      if (dmarc === "fail" || dkim === "fail" || spf === "fail") {
        flags.push({
          span: fromDomain || "Authentication Check",
          reason: "Cryptographic sender authentication failed (DMARC/DKIM/SPF violation).",
          type: "rule",
          rule: "AUTH_CRYPTO_FAIL"
        });
        score += 85;
        isAuthDisqualified = true;
      }

      var isBrand = isProtectedBrand(fromDomain);
      if (isBrand && signedBy) {
        var isDkimAligned = signedBy === fromDomain || signedBy.endsWith("." + fromDomain);
        if (!isDkimAligned) {
          flags.push({
            span: fromDomain,
            reason: "Sender claims '" + fromDomain + "', but message was digitally signed by unrelated domain '" + signedBy + "'.",
            type: "rule",
            rule: "AUTH_DKIM_ALIGNMENT_MISMATCH"
          });
          score += 80;
          isAuthDisqualified = true;
        }
      }

      if (isBrand && mailedBy) {
        var isSpfAligned = mailedBy === fromDomain || mailedBy.endsWith("." + fromDomain) || /(amazonses\.com|sendgrid\.net|mailgun\.(org|net)|mandrillapp\.com|sparkpostmail\.com)$/i.test(mailedBy);
        if (!isSpfAligned) {
          flags.push({
            span: fromDomain,
            reason: "Mail envelope ('" + mailedBy + "') does not align with sender domain '" + fromDomain + "'.",
            type: "rule",
            rule: "AUTH_SPF_ENVELOPE_MISMATCH"
          });
          score += 50;
        }
      }

      if (isBrand && !signedBy && !mailedBy && !dmarc && !dkim && !spf) {
        flags.push({
          span: fromDomain,
          reason: "Email claims to be from institutional brand '" + fromDomain + "' but carries no cryptographic signature.",
          type: "rule",
          rule: "AUTH_BRAND_UNAUTHENTICATED"
        });
        score += 40;
      }
    }

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

    // A consumer mailbox is never an official sender.
    var fromIsFree = from.some(function (d) { return FREE_MAIL.test(d); });
    if (!fromIsFree && from.length && !flags.length && !isAuthDisqualified && !isQuarantined) score = Math.min(score, 12);

    // Bulk marketing check
    var promoCount = 0;
    for (var p = 0; p < PROMO.length; p++) {
      if (t.match(PROMO[p])) promoCount++;
    }
    // A quarantine notice is the mailbox's verdict, not a scam pattern, so it
    // must not count as threat evidence and block the promo classification.
    var hasThreatEvidence = flags.some(function (f) { return f.type !== "quarantine"; });
    var isPromo = promoCount >= 2 && !hasThreatEvidence;
    if (isPromo) score = Math.max(45, score + promoCount * 12);

    // Floored above the "clean sender" clamp so a quarantined message can never
    // be reported as legitimate, and never forced to high_risk on its own.
    if (isQuarantined) {
      score = Math.max(score, quarantineEscalated ? 70 : 45);
    }

    if (isAuthDisqualified) {
      score = Math.max(88, score);
    }

    score = Math.max(0, Math.min(100, score));

    var verdict = "safe";
    if (isAuthDisqualified || score >= 66) verdict = "high_risk";
    else if (isQuarantined && score < 66) verdict = "suspicious";
    else if (isPromo && score < 66) verdict = "promo_clutter";
    else if (score >= 35) verdict = "suspicious";

    var steps;
    if (isAuthDisqualified) {
      steps = [
        "Do NOT click links or reply. This email was cryptographically proven to be sent by an unauthorized party.",
        "Report the sender as phishing and block the domain.",
        "Verify the account directly at the official brand URL, typed by hand."
      ];
    } else if (verdict === "high_risk") {
      steps = [
        "Do NOT click any links, open attachments, or enter passwords on this email.",
        "Report the sender as phishing and block the domain.",
        "Verify the account directly at the official brand URL, typed by hand."
      ];
    } else if (verdict === "promo_clutter") {
      steps = [
        "Post-task promotional marketing clutter detected.",
        "Unsubscribe or mute the sender if you did not ask for this.",
        "No credentials or payment are needed - do not reply with personal details."
      ];
    } else if (verdict === "suspicious" && isQuarantined) {
      steps = [
        "Your mailbox already routed this to Spam; the sender is blocked or filtered.",
        "Treat it as unwanted mail - do not treat it as legitimate.",
        "No credentials or payment are needed. Delete it or unsubscribe."
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
      auth: {
        status: isAuthDisqualified ? "spoof" : (auth && auth.signedBy && (auth.signedBy === fromDomain || auth.signedBy.endsWith("." + fromDomain)) ? "verified" : "unverified"),
        fromDomain: fromDomain || null,
        signedBy: (auth && auth.signedBy) || null,
        mailedBy: (auth && auth.mailedBy) || null
      },
      explanation: isQuarantined && verdict !== "high_risk"
        ? "QUARANTINED BY YOUR MAIL PROVIDER: your mailbox routed this to Spam and told you why (blocked sender or spam filter). That is a filter decision, not confirmed phishing, but the message is unwanted - do not treat it as legitimate. This is a reduced offline check, not a full analysis."
        : verdict === "safe"
        ? "Offline analysis found no strong scam indicators. This is a reduced check, not a full analysis."
        : verdict === "promo_clutter"
        ? "BULK MARKETING: offline analysis matched bulk-marketing patterns with no scam indicators. This is a reduced check, not a full analysis."
        : isAuthDisqualified
        ? "HIGH RISK: Cryptographic sender authentication failed or indicates brand spoofing."
        : "Offline analysis flagged " + flags.length + " indicator(s) while the main engine was unreachable.",
      next_steps: steps,
      privacy: {
        phones_masked: (t.match(/\[PHONE_REDACTED\]/g) || []).length,
        emails_masked: (t.match(/\[EMAIL_REDACTED\]/g) || []).length,
        otp_masked: (t.match(/\[OTP_REDACTED\]/g) || []).length
      },
      engine: {
        rules: "offline-fallback-subset",
        auth_status: isAuthDisqualified ? "spoof" : (auth && auth.signedBy ? "verified" : "unverified"),
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
