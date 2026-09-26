/**
 * Deterministic Channel-Aware Rule Engine for Ratio'd
 * Implements Homoglyph Normalization, Levenshtein Distance Brand Check,
 * Subdomain Brand-Stuffing Detection, and Urgency + Credential Combo Scoring.
 */

const KNOWN_BRANDS = [
  "microsoft",
  "google",
  "apple",
  "amazon",
  "paypal",
  "netflix",
  "bankofamerica",
  "chase",
  "wellsfargo",
  "stripe",
  "github",
  "linkedin",
  "usps",
  "fedex",
  "dhl",
  "facebook",
  "instagram",
  "twitter",
  "spotify",
  "dropbox",
  "coinbase",
  "binance",
  "kraken",
  // Brands added after running an external scam corpus through the engine. These
  // are impersonation targets seen in the wild that the original list missed
  // entirely - the engine was blind to all of them.
  "singtel",
  "grab",
  "metamask",
  "iras",
  "visa",
  "mastercard",
  "dhl",
  "ups"
];

/**
 * Brands shorter than this are never matched by substring or edit-distance.
 * A 1-3 character brand ("x", "ups", "dhl") matches by accident far too often —
 * e.g. an "x" anywhere in the domain made "example.com" look like brand
 * impersonation. Short brands are dropped rather than risk false positives.
 */
const MIN_BRAND_LEN = 4;
const MATCHABLE_BRANDS = KNOWN_BRANDS.filter((b) => b.length >= MIN_BRAND_LEN);

const OFFICIAL_BRAND_DOMAINS = {
  microsoft: ["microsoft.com", "office.com", "live.com", "outlook.com", "microsoftonline.com", "accountprotection.microsoft.com"],
  google: ["google.com", "gmail.com", "accounts.google.com"],
  apple: ["apple.com", "icloud.com"],
  amazon: ["amazon.com", "aws.amazon.com"],
  paypal: ["paypal.com"],
  netflix: ["netflix.com"],
  bankofamerica: ["bankofamerica.com"],
  chase: ["chase.com"],
  wellsfargo: ["wellsfargo.com"],
  stripe: ["stripe.com"],
  github: ["github.com"],
  linkedin: ["linkedin.com"],
  usps: ["usps.com", "usps.gov"],
  fedex: ["fedex.com"],
  ups: ["ups.com"],
  dhl: ["dhl.com"],
  singtel: ["singtel.com", "singtel.com.sg"],
  grab: ["grab.com", "grab.co.id", "grab.sg"],
  metamask: ["metamask.io", "consensys.io"],
  iras: ["iras.gov.sg"],
  visa: ["visa.com", "visa.co"],
  mastercard: ["mastercard.com", "mastercard.co"]
};

/**
 * Every domain that is the official home of some brand in the list above.
 *
 * Without this, a real domain can be Levenshtein-matched against a *different*
 * brand and reported as a typosquat. Adding "grab" to the brand list made
 * `grab.com` look 2 edits from "iras" - a genuine false positive on a real
 * company. A domain that is officially some brand's own cannot be a typosquat
 * of anyone, so it is exempt from every spoofing check below.
 */
const ALL_OFFICIAL_DOMAINS = new Set(Object.values(OFFICIAL_BRAND_DOMAINS).flat());

/**
 * Free webmail and consumer mail providers.
 *
 * These MUST NOT confer "official sender" status. Several of them appear in
 * OFFICIAL_BRAND_DOMAINS - gmail.com legitimately belongs to Google - and the
 * brand loop sets `isLegitimateOfficialSender` when a domain matches any
 * brand's official list. The consequence was severe and silent: every scam sent
 * from a Gmail address was treated as legitimate, its score was capped at 25,
 * and the severe-domain disqualifiers were skipped entirely.
 *
 * No legitimate brand sends its transactional mail from a consumer mailbox, so
 * exempting these costs nothing and closes a large false-negative channel.
 */
const FREE_MAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "hotmail.co.uk",
  "live.com", "msn.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in", "ymail.com",
  "aol.com", "icloud.com", "me.com", "mac.com", "protonmail.com", "proton.me",
  "gmx.com", "gmx.de", "mail.com", "zoho.com", "yandex.com", "yandex.ru",
  "qq.com", "163.com", "126.com", "naver.com", "hanmail.net", "rediffmail.com"
]);

/** A domain that can never make a message look official. */
function isFreeMailDomain(domain) {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, "");
  if (FREE_MAIL_DOMAINS.has(d)) return true;
  // Any subdomain of a consumer provider counts too.
  for (const free of FREE_MAIL_DOMAINS) {
    if (d.endsWith("." + free)) return true;
  }
  return false;
}

/**
 * Signature-footer markers.
 *
 * A genuine corporate signature names a legal entity and usually carries a
 * copyright line. Pairing one of these with a known brand name, then checking
 * that the sending domain is NOT an official domain for that brand, is a very
 * high-precision impersonation test: legitimate brand mail comes from the
 * brand's own domain.
 */
const SIGNATURE_FOOTER_PATTERNS = [
  /©\s*\d{4}\s*(?:\(c\)\s*)?(?:by\s+)?/i,
  /copyright\s+\d{4}\s*(?:by\s+)?/i,
  /all\s+rights\s+reserved/i,
  /[\w\s.&]{2,40}\b(?:B\.V\.|Pte\.?\s*Ltd\.?|Ltd\.?|Inc\.?|LLC\.?|GmbH|S\.A\.|A\.G\.)/i,
  /\bteam\s+[A-Z][\w]{2,}\b/,
  /\bthis\s+email\s+and\s+accompanying\b/i
];

/**
 * Established, legitimate domains that are NOT in OFFICIAL_BRAND_DOMAINS but are
 * easily mistaken for a brand by edit distance. "shopify.com" sits 2 edits from
 * "spotify.com", so without this it was flagged as a typosquat - a false
 * positive that would have trained users to ignore the banner.
 * Being a real company means the domain is exempt from spoofing checks.
 */
const LEGITIMATE_DOMAINS = new Set([
  "shopify.com", "wix.com", "squarespace.com", "weebly.com", "bigcartel.com",
  "stripe.com", "square.com", "paypal.me", "wise.com", "revolut.com",
  "slack.com", "zoom.us", "webex.com", "teams.microsoft.com",
  "box.com", "dropbox.com", "icloud.com", "onedrive.com", "drive.google.com",
  "mailchimp.com", "hubspot.com", "sendgrid.com", "mailgun.com", "postmark.com",
  "twilio.com", "intercom.com", "zendesk.com", "freshdesk.com",
  "asana.com", "trello.com", "monday.com", "atlassian.com", "confluence.com",
  "figma.com", "canva.com", "adobe.com", "salesforce.com", "oracle.com",
  "ibm.com", "intel.com", "cisco.com", "dell.com", "hp.com", "logitech.com",
  "samsung.com", "sony.com", "nike.com", "adidas.com", "walmart.com",
  "target.com", "bestbuy.com", "costco.com", "etsy.com", "ebay.com",
  "soundcloud.com", "bandcamp.com", "discogs.com", "medium.com", "substack.com",
  "notion.so", "airtable.com", "linear.app", "vercel.app", "netlify.app"
]);

/**
 * Homoglyph / Character-Substitution Normalizer
 */
function normalizeForBrandCheck(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/1/g, "i")
    .replace(/0/g, "o")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/5/g, "s")
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/\$/g, "s");
}

/**
 * Second homoglyph reading. The spec's substitution table lists `1` as standing
 * for "i" OR "l", and single-digit swaps are the most common trick there is.
 * "paypa1" only resolves to "paypal" under this reading - under the `1`->`i`
 * pass it becomes "paypai", which matches nothing.
 */
function normalizeAltForBrandCheck(str) {
  if (!str) return "";
  return str
    .toLowerCase()
    .replace(/1/g, "l")
    .replace(/0/g, "o")
    .replace(/rn/g, "m")
    .replace(/vv/g, "w")
    .replace(/5/g, "s")
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/\$/g, "s");
}

/**
 * Standard Levenshtein Distance Calculator
 */
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => []);

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

const URGENCY_PATTERNS = [
  { regex: /expire(s|d|ing)?\s+today/i, reason: "Urgency trigger ('expires today')" },
  { regex: /action\s+required/i, reason: "Urgency trigger ('action required')" },
  { regex: /within\s+\d+\s*(hours?|mins?|minutes?|days?)/i, reason: "Psychological time limit constraint" },
  { regex: /account\s+(suspended|locked|terminated|restricted|disabled|expired)/i, reason: "Fear trigger: account suspension/lock warning" },
  { regex: /unusual\s+(activity|login|transaction|charge|access)/i, reason: "Fear trigger: unusual security activity alarm" },
  { regex: /click\s+here\s+to\s+(verify|update|confirm|login|restore)/i, reason: "Urgent action demand" },
  { regex: /will\s+be\s+(suspended|locked|disabled|terminated|deactivated|closed|expired)/i, reason: "Threat of account loss ('will be suspended')" },
  { regex: /your\s+(account|payment|parcel|package|order)\s+(has\s+been|was|is)\s+(suspended|locked|cancelled|held|failed)/i, reason: "Claimed account/package hold" },
  { regex: /final\s+notice|last\s+warning/i, reason: "Escalating panic phrase" }
];

const CREDENTIAL_PATTERNS = [
  { regex: /verify\s+your\s+(credentials|account|password|identity|access)/i, reason: "Credential verification demand" },
  { regex: /confirm\s+your\s+(identity|password|account|credentials|details|information)/i, reason: "Identity confirmation demand" },
  { regex: /enter\s+your\s+(password|pin|ssn|passcode|code)/i, reason: "Sensitive credential harvesting request" },
  { regex: /provide\s+(your\s+)?(otp|one-time\s+password|verification\s+code)/i, reason: "Authentication OTP theft attempt" },
  { regex: /(login|auth|signin|password-reset)\s*link/i, reason: "Login credential capture link" }
];

const PROMOTIONAL_CLUTTER_PATTERNS = [
  { regex: /unsubscribe/i, reason: "Post-registration promotional newsletter link" },
  { regex: /noreply@[a-z0-9.-]+\.(news|club|top|xyz|info|promo|tech)/i, reason: "Automated post-registration marketing sender" },
  { regex: /apply\s+(today|now)|register\s+(now|today)|join\s+[a-z0-9]+\s+(today|now)/i, reason: "Marketing call to action" },
  { regex: /exclusive\s+invite|limited\s+seats|explore\s+how|% off|discount/i, reason: "Promotional marketing offer" }
];

const SUSPICIOUS_DOMAINS = [
  { regex: /[a-z0-9-]+\.(xyz|top|tk|club|work|gq|cf|ml|monster|rest|hair|cfd)/i, reason: "High-risk top-level domain (TLD)" },
  // Cheap, heavily-abused TLDs. Added after an external corpus showed the
  // original six-digit list missed every real-world sample. These are not
  // malicious on their own, but a link to one in unsolicited mail is a strong
  // signal on its own.
  { regex: /https?:\/\/[\w.-]*\.(page|icu|buzz|cam|lol|monster|online|site|space|link|click|fun|trade|rest|cfd|fit|quest|cyou|sbs|icu)\b/i, reason: "Link to a heavily-abused cheap top-level domain" },
  { regex: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, reason: "Raw IP address URL instead of domain" },
  {
    // URL shorteners hide the real destination, a staple of smishing /
    // delivery-fraud lures. Detected generically so new services are covered too.
    regex: /https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|t\.ly|lnkd\.in|db\.tt|qr\.ae|v\.gd|s\.id|lnk\.to)\b|\b(?:bit\.ly|tinyurl\.com|rebrand\.ly|cutt\.ly|shorturl\.at|tiny\.cc|lnk\.to)\//i,
    reason: "URL shortener conceals the true destination domain"
  },
  // Firebase Hosting (and similar) is a free, anonymous static host routinely
  // used to serve phishing pages impersonating a named brand. On its own it is
  // not malicious - plenty of legitimate hobby projects live there - so it is
  // weighted lightly and only becomes strong when combined with a brand
  // impersonation or an action request.
  { regex: /https?:\/\/[\w.-]*\.firebaseapp\.com/i, reason: "Free anonymous hosting used to serve a lookalike page" },
  { regex: /https?:\/\/[\w.-]*\.(pages\.dev|web\.app|netlify\.app|vercel\.app)\b/i, reason: "Generic app-hosting domain behind a branded claim" }
];

/**
 * Social-engineering families the original rule set did not cover.
 *
 * These were added after running a real, externally-sourced corpus of 20
 * confirmed scam emails through the engine, which caught 0 of them. The engine
 * was built almost entirely around one family - credential phishing behind a
 * typosquatted brand domain - while the largest real-world category is
 * advance-fee and brand-impersonation fraud, where the payload is a request
 * for money, identity documents, or a phone call rather than a password.
 *
 * Weights are deliberately modest. The lift comes from the COMBINATION rules
 * further down: an unsolicited money claim on its own is a marketing email,
 * and a request for your ID on its own is unusual but not proof. Money bait
 * plus a contact-or-payment instruction is essentially conclusive.
 */
const ADVANCE_FEE_PATTERNS = [
  { regex: /you\s+have\s+been\s+selected\s+to\s+receive/i, reason: "Unsolicited 'you have been selected' prize claim" },
  { regex: /lucky\s+(winner|beneficiar)/i, reason: "Advance-fee lottery: 'lucky winner' framing" },
  { regex: /your\s+email\s+address\s+was\s+found\s+in\s+the\s+list/i, reason: "Advance-fee lottery: claimed address list" },
  { regex: /\$\s?[\d,.]+\s*(million|m)\s*(usd|sgd|eur|gbp)?/i, reason: "Large unsolicited monetary claim" },
  { regex: /western\s+union|wire\s+transfer|money\s+gram|moneygram/i, reason: "Remittance channel named in an unsolicited offer" },
  { regex: /activat\w*\s+fee|account\s+activation\s+fee/i, reason: "Advance-fee pretext: 'activation fee'" },
  { regex: /charitable\s+donation\s+of\s+\$/i, reason: "Unsolicited charitable donation claim" },
  { regex: /compensa\w+\s+(fund|amount)\b/i, reason: "Unsolicited compensation fund claim" },
  { regex: /get\s+\d{1,3}\s*%\s+for\s+your\s+(cooperation|partnership)/i, reason: "Unsolicited revenue-share 'partnership' offer" },
  { regex: /lottery\s+winnings?|grant\s+sum\s+of|grant\s+of\s+[€$£]|compensation\s+payment|irrevocable\s+compensation/i, reason: "Unsolicited grant, lottery or compensation payout claim" },
  { regex: /respond\s+(back\s+)?to\s+this\s+email|reply\s+(back\s+)?to\s+this\s+email\b/i, reason: "Claim released only by emailing back a stranger" },
  { regex: /international\s+certified\s+bank\s+draft|finance\s+house|contact\s+agent\b/i, reason: "Named 'finance house' acting as a payout intermediary" },
  { regex: /(?:currency\s+of\s+)?\d[\d,.]*\s*(?:million|m)\b[^.]{0,40}(?:usd|sgd|eur|gbp|rm)|(?:usd|sgd|eur|gbp|rm)\s?\d[\d,.]*\s*(?:million|m)\b/i, reason: "Multi-million advance-fee amount" }
];

const REFUND_BAIT_PATTERNS = [
  { regex: /\brefund\s+(bill|amount|of|has\s+been)\b/i, reason: "Unsolicited refund claim presented as an action item" },
  { regex: /overpayment|payment\s+was\s+made\s+twice|invoice\s+was\s+paid\s+twice/i, reason: "Fake overpayment / double-charge refund pretext" },
  { regex: /submit\s+your\s+refund|request\s+a\s+refund|claim\s+your\s+refund/i, reason: "Refund claim routed through an email link" },
  { regex: /will\s+be\s+credited\s+within\s+\d+/i, reason: "Promised credit used to legitimise a fake charge" },
  { regex: /complete\s+within\s+\d+\s+days?\s+for\s+prompt\s+processing/i, reason: "Short deadline attached to a refund pretext" }
];

const DELIVERY_FEE_PATTERNS = [
  { regex: /non-?payment\s+of\s+[\d.,]+\s*(sgd|usd|eur|gbp|\$)?/i, reason: "Parcel-release fee demanded for a held shipment" },
  { regex: /pay\s+the\s+new\s+shipping\s+cost|outstanding\s+customs\s+(fee|charge)/i, reason: "Shipping-fee pretext to release a parcel" },
  { regex: /delivery\s+failed\s+on|incorrect\s+address.*(?:pay|shipping)/i, reason: "Failed-delivery pretext paired with a payment link" },
  { regex: /could\s+not\s+be\s+delivered\s+due\s+to\s+an\s+invalid\s+address\s+fee/i, reason: "Small-fee delivery scam (classic smishing)" },
  { regex: /on\s+hold\s+in\s+our\s+post|still\s+on\s+hold/i, reason: "Shipment held pending payment" },
  { regex: /unable\s+to\s+deliver|were\s+unable\s+to\s+deliver|parcel\s+could\s+not\s+be\s+delivered/i, reason: "Failed-delivery notice used to drive a click" },
  { regex: /confirm\s+the\s+next\s+steps\s+to\s+reschedule/i, reason: "Delivery reschedule routed through an email link" }
];

const FAKE_SUBSCRIPTION_PATTERNS = [
  { regex: /storage\s+is\s+full|cloud\s+storage\s+(alert|reminder)/i, reason: "Fake cloud-storage exhaustion scare" },
  { regex: /upgrade\s+(your\s+)?storage|not\s+backing\s+up/i, reason: "Storage upgrade upsell via unsolicited mail" },
  { regex: /subscription\s+renewal\s+has\s+been\s+processed/i, reason: "Auto-renewal notice for a subscription the user may not hold" },
  { regex: /your\s+subscription\s+(ends|is\s+about\s+to\s+expire)/i, reason: "Subscription-expiry renewal lure" },
  { regex: /to\s+cancel\s+auto-?renewal,?\s*contact/i, reason: "Cancellation handled by phone/email rather than an account page" },
  { regex: /rewards?\s+will\s+expire|rewards?\s+expire\s+in\s+\d+|your\s+rewards?\b/i, reason: "Unsolicited 'your rewards expire' bait" },
  { regex: /claim\s+your\s+reward|get\s+\d+\s*(?:sgd|usd|eur|gbp|rm)\s+now/i, reason: "Reward claim pushed from unsolicited mail" }
];

const FAKE_SECURITY_PATTERNS = [
  { regex: /2fa\s+(will\s+be\s+|is\s+now\s+)?mandatory|mandatory\s+for\s+all\s+\w+\s+accounts/i, reason: "Mandatory 2FA enforcement notice" },
  { regex: /enable\s+2fa\s+now|2fa\s+will\s+be\s+enabled/i, reason: "2FA enrolment pushed from an email link" },
  { regex: /protect\s+your\s+wallet|keeping\s+your\s+digital\s+assets\s+safe/i, reason: "Wallet-protection pretext" },
  { regex: /we\s+tried\s+to\s+charge\s+your\s+account\s+but\s+the\s+transaction\s+was\s+declined/i, reason: "Declined-payment bait" }
];

const INVESTMENT_PATTERNS = [
  { regex: /\$\s?[A-Z]{2,6}\s+token|airdrop/i, reason: "Token/airdrop offer" },
  { regex: /launch\w*\s+[\s\S]{0,40}\s+own\s+digital\s+currency/i, reason: "Fabricated token launch attributed to an established brand" },
  { regex: /approved\s+and\s+disbursed\s+within\s+\d+\s+hours?/i, reason: "Instant-approval loan / advance-fee pitch" },
  { regex: /loan\s+solutions|private\s+loan\s+investment/i, reason: "Unsolicited loan/investment solicitation" },
  { regex: /investment\s+opportunit|extraordinary\s+solution/i, reason: "Vague investment promise with no verifiable instrument" }
];

const HEALTH_CLAIM_PATTERNS = [
  { regex: /self-?healing\s+protocol|vision\s+restoration\s+protocol/i, reason: "Unverifiable medical 'protocol' claim" },
  { regex: /from\s+nearly\s+blind\s+to\s+perfect\s+20\/20|clinical\s+trials?,?\s*[\d,]+\+?\s*patients/i, reason: "Implausible medical outcome statistic" },
  { regex: /before\s+the\s+video\s+is\s+taken\s+down|watch\s+the\s+presentation/i, reason: "Artificial urgency to view a claim now" },
  { regex: /researchers\s+uncover|\bprotocol\s+is\s+changing\s+lives\b/i, reason: "Viral-marketing medical claim" }
];

const PERSONAL_DATA_PATTERNS = [
  { regex: /copy\s+of\s+your\s+identification|have\s+your\s+id\s+ready|valid\s+id\s+(card|document)/i, reason: "Requests a copy of identity documents by email" },
  { regex: /your\s+full\s+names?\s*[:\n]/i, reason: "Blank-field form requesting a full legal name" },
  { regex: /cell\/telephone\s+numbers?|home\s+or\s+office\s+address/i, reason: "Blank-field form requesting phone and address" },
  { regex: /your\s+country\s*[:\n]/i, reason: "Blank-field form requesting country of residence" },
  { regex: /re-?confirming\s+your\s+complete\s+information|provide\s+(to\s+them\s+)?the\s+following\s+information/i, reason: "Generic bulk personal-information request" }
];

const CONTACT_STRANGER_PATTERNS = [
  { regex: /contact\s+(me|us|him|her|them|him\/her)\s+urgently|contact\s+\w+\s+urgently/i, reason: "Demands an urgent off-channel reply" },
  { regex: /i\s+want\s+to\s+reach\s+a\s+partnership|partnership\s+agreement/i, reason: "Unsolicited partnership proposal" },
  { regex: /please\s+contact\s+\S+@\S+|contact\s+\S+\s+for\s+more\s+information/i, reason: "Redirects to an unrelated third-party address" },
  { regex: /your\s+urgent\s+attention\s+is\s+needed|for\s+your\s+claim\s+and\s+more/i, reason: "Bare urgency demand with no legitimate context" }
];

/**
 * Inheritance and estate ("next of kin") fraud.
 *
 * A distinct and heavily-used family: the sender claims a mutual ancestor,
 * a deceased relative who shared the recipient's surname, or a dying stranger
 * who needs a trustworthy stranger to hold their estate. The ask is always
 * the same - reply with contact details so a "law firm" or "finance house"
 * can proceed. It appeared twice in an eleven-message real-world sample, and
 * neither message contained a brand name, a money figure, or an action
 * request, so nothing else in the engine could see it.
 */
const INHERITANCE_PATTERNS = [
  { regex: /shared\s+your\s+surname|relative\s+to\s+(you|our\s+family)/i, reason: "Inheritance fraud: claims a shared surname" },
  { regex: /no\s+known\s+heirs?\b|without\s+any\s+known\s+heirs?/i, reason: "Inheritance fraud: claims the deceased has no heirs" },
  { regex: /passed\s+away\s+(recently|abroad)?|recently\s+(passed\s+away|died)/i, reason: "Inheritance fraud: invokes a recent death" },
  { regex: /\bwidow\s+(with|of)\b|stage\s+\d\s+cancer|my\s+days\s+are\s+numbered/i, reason: "Inheritance fraud: sympathy pretext" },
  { regex: /utili[sz]e\s+the\s+proceeds\s+realized|from\s+my\s+estates?\b/i, reason: "Inheritance fraud: offers an estate's proceeds" },
  { regex: /entrust\s+the\s+money\s+in\s+your\s+care|give\s+me\s+your\s+word\s+never\s+to\s+betray/i, reason: "Inheritance fraud: asks for an oath of trust" },
  { regex: /legal\s+representative\s+of\s+the\s+late|law\s+chambers/i, reason: "Inheritance fraud: unverified legal representative" }
];

/**
 * Large monetary amounts written with a currency word or code rather than a
 * bare "$" sign.
 *
 * The advance-fee table's amount pattern requires a literal "$", which misses
 * "EUR 1.5m", "US $ 700,000.00" and "€2.7 million" - the majority of
 * international advance-fee lures. Matching the code or symbol as well as the
 * bare sign closed that gap.
 */
const LARGE_AMOUNT_SOURCE = "(?:[$€£]\\s?\\d[\\d,.]*\\s*(?:million|m\\b|k\\b)|(?:us\\s?[$€£]|eur|usd|sgd|gbp|rm|myr|idr|inr|pkr|zar)\\s?[$€£]?\\s?\\d[\\d,.]*\\s*(?:million|m\\b))";

/**
 * Every new family above, with its weight.
 *
 * Weights are low by design. A single "refund" mention is a legitimate tax
 * notice; a single "urgent" is common. What separates fraud from commerce is
 * co-occurrence, handled by the combination rules in evaluateRules.
 */
const SOCIAL_ENGINEERING_FAMILIES = [
  { name: "advance_fee", points: 20, patterns: ADVANCE_FEE_PATTERNS },
  { name: "refund_bait", points: 18, patterns: REFUND_BAIT_PATTERNS },
  { name: "delivery_fee", points: 20, patterns: DELIVERY_FEE_PATTERNS },
  { name: "fake_subscription", points: 18, patterns: FAKE_SUBSCRIPTION_PATTERNS },
  { name: "fake_security", points: 20, patterns: FAKE_SECURITY_PATTERNS },
  { name: "investment", points: 15, patterns: INVESTMENT_PATTERNS },
  { name: "health_claim", points: 15, patterns: HEALTH_CLAIM_PATTERNS },
  { name: "personal_data", points: 15, patterns: PERSONAL_DATA_PATTERNS, corroboration: false },
  { name: "contact_stranger", points: 15, patterns: CONTACT_STRANGER_PATTERNS },
  { name: "inheritance", points: 25, patterns: INHERITANCE_PATTERNS }
];

/**
 * Any six-figure-or-larger amount with a currency marker.
 *
 * Deliberately broad - a plain "$250,000.00" carries no "million" or "k"
 * suffix, and the earlier suffix-requiring pattern missed the majority of
 * international advance-fee lures. On its own this proves nothing: legitimate
 * invoices quote six-figure amounts all the time. It is only ever used as one
 * half of a combination.
 */
const SIX_FIGURE_AMOUNT_RE =
  /[$€£]\s?\d{2,3}(?:,\d{3})+(?:\.\d{2})?|\b\d{2,3}(?:,\d{3})+\s*(?:usd|eur|gbp|sgd|rm|dollars|euros)\b/i;

/** Large-amount matcher, shared by the money-bait helpers below. */
const LARGE_AMOUNT_RE = new RegExp(LARGE_AMOUNT_SOURCE, "i");

/** Senders whose domain is a free, anonymous or abused host. */
const ABUSED_HOSTING_RE =
  /(^|\.)(firebaseapp\.com|pages\.dev|web\.app|netlify\.app|vercel\.app|blogspot\.[a-z]+|weebly\.com|wixsite\.com|glitch\.me|repl\.co|codesandbox\.io|000webhostapp\.com|duckdns\.org|no-ip\.org|ngrok\.io|trycloudflare\.com)$/i;

/**
 * Pull the display name out of a From/Reply-To header.
 *
 * The display name is the single most useful impersonation signal available:
 * attackers routinely write "MetaMask" or "Singtel" in the human-readable name
 * and send from an unrelated throwaway domain. The existing homoglyph and
 * Levenshtein checks only ever look at the domain, so they cannot see this.
 */
function extractSenderDisplayNames(text) {
  const headerRegex = /^\s*(?:from|sender|reply-to|return-path)\s*:\s*(.*)$/gim;
  const found = new Set();
  let m;
  while ((m = headerRegex.exec(text)) !== null) {
    const raw = m[1].trim();
    const angled = raw.match(/^\s*(?:"([^"]*)"|([^<>]*?))\s*</);
    if (angled) {
      const name = (angled[1] || angled[2] || "").trim();
      if (name) found.add(name);
    }
  }
  return Array.from(found);
}


function extractDomains(text) {
  // Accepts 2-label domains (paypa1-security.com) as well as deeper ones
  // (login.m1crosoft-support.com). The previous pattern required a third
  // label, so plain "brand-typosquat.tld" domains were never inspected.
  const domainRegex = /(?:https?:\/\/)?\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/gi;
  const emailDomainRegex = /@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const domains = new Set();

  let match;
  while ((match = domainRegex.exec(text)) !== null) {
    const domain = match[0].replace(/^https?:\/\//i, "").split("/")[0].toLowerCase();
    domains.add(domain);
  }

  while ((match = emailDomainRegex.exec(text)) !== null) {
    domains.add(match[1].toLowerCase());
  }

  return Array.from(domains);
}

/** Registered domain = last two labels (good enough for .co.uk style TLDs). */
function registeredDomain(domain) {
  const parts = domain.toLowerCase().replace(/^www\./, "").split(".");
  return parts.slice(-2).join(".");
}

/** Domains that appear inside a From:/Reply-To header. */
function extractSenderDomains(text) {
  const headerRegex = /^\s*(?:from|sender|reply-to|return-path)\s*:\s*.*?@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gim;
  const found = new Set();
  let m;
  while ((m = headerRegex.exec(text)) !== null) {
    found.add(m[1].toLowerCase().replace(/^www\./, ""));
  }
  return Array.from(found);
}

/**
 * The From: domain alone, ignoring Reply-To.
 *
 * Kept separate from extractSenderDomains because the two being *different* is
 * itself a strong phishing signal: a message that appears to come from an
 * institution but whose replies are redirected to a free webmail or lookalike
 * domain exists to defeat reply-path filtering on the receiving side.
 */
function extractFromDomains(text) {
  const found = new Set();
  const re = /^\s*from\s*:\s*.*?@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toLowerCase().replace(/^www\./, ""));
  }
  return Array.from(found);
}

/** The Reply-To: domain alone. */
function extractReplyToDomains(text) {
  const found = new Set();
  const re = /^\s*(?:reply-to|return-path)\s*:\s*.*?@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gim;
  let m;
  while ((m = re.exec(text)) !== null) {
    found.add(m[1].toLowerCase().replace(/^www\./, ""));
  }
  return Array.from(found);
}

/**
 * Mixed-script homoglyph detection.
 *
 * A word that is almost entirely Latin but contains one or two Cyrillic or
 * Greek characters - a Cyrillic "о" inside "Yоurs", for example - is
 * invisible to a human reader and is used to defeat string-matching filters
 * and to spoof a bank name in a signature. Legitimate English business mail
 * essentially never mixes scripts mid-word, so this is high precision.
 *
 * Only characters from the Cyrillic and Greek blocks are considered, and only
 * when the surrounding text is otherwise Latin. Names written entirely in one
 * non-Latin script are ignored, since a Russian-language email is not an
 * attack.
 */
const CYRILLIC_OR_GREEK = /[\u0370-\u03FF\u0400-\u04FF]/g;

function findMixedScriptTokens(text) {
  const hits = [];
  // Words of letters, optionally containing internal punctuation.
  const tokenRe = /[A-Za-z\u0370-\u03FF\u0400-\u04FF][A-Za-z0-9\u0370-\u03FF\u0400-\u04FF'.-]*/g;
  let m;
  while ((m = tokenRe.exec(text)) !== null) {
    const token = m[0];
    CYRILLIC_OR_GREEK.lastIndex = 0;
    const nonLatin = token.match(CYRILLIC_OR_GREEK);
    if (!nonLatin) continue;
    const latinCount = (token.match(/[A-Za-z]/g) || []).length;
    // Require the token to be predominantly Latin, so a genuinely Cyrillic
    // word is not reported.
    if (latinCount < token.length * 0.5) continue;
    // A single stray non-Latin character inside an otherwise-Latin word is the
    // exact shape of a homoglyph attack; require at least one, but not all.
    hits.push({ token, nonLatin: nonLatin.slice(0, 3) });
    if (hits.length >= 5) break;
  }
  return hits;
}

/** Domains that appear as clickable link targets in the body. */
function extractLinkDomains(text) {
  const urlRegex = /https?:\/\/([a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+)/gi;
  const found = new Set();
  let m;
  while ((m = urlRegex.exec(text)) !== null) {
    found.add(m[1].toLowerCase().replace(/^www\./, ""));
  }
  return Array.from(found);
}

function evaluateRules(text, channel = "email") {
  const flags = [];
  let rawScore = 0;
  let isPromoClutter = false;
  let isLegitimateOfficialSender = false;

  if (!text || typeof text !== "string") {
    return { ruleScore: 0, flags: [], isPromoClutter: false };
  }

  const extractedDomains = extractDomains(text);

  // 1. Homoglyph, Typosquat & Subdomain Brand-Stuffing Checks
  for (const rawDomain of extractedDomains) {
    const parts = rawDomain.split(".");
    if (parts.length < 2) continue;

    // A domain we know belongs to a real company is never a spoof, however
    // close it sits to a brand name (shopify.com vs spotify.com).
    if (LEGITIMATE_DOMAINS.has(rawDomain)) {
      isLegitimateOfficialSender = true;
      continue;
    }

    // Officially some brand's own domain: never a typosquat of a different one.
    // Free webmail is excluded - gmail.com belongs to Google, but a message
    // sent from a personal mailbox is not an official Google message.
    if (ALL_OFFICIAL_DOMAINS.has(rawDomain) && !isFreeMailDomain(rawDomain)) {
      isLegitimateOfficialSender = true;
      continue;
    }

    const sld = parts[parts.length - 2];
    const fullHost = parts.slice(0, parts.length - 1).join(".");
    const normalizedSld = normalizeForBrandCheck(sld);
    const normalizedFullHost = normalizeForBrandCheck(fullHost);
    // Second reading of the same domain, with `1` standing for "l".
    const normalizedAltSld = normalizeAltForBrandCheck(sld);

    for (const brand of MATCHABLE_BRANDS) {
      const officialDomains = OFFICIAL_BRAND_DOMAINS[brand] || [`${brand}.com`];
      const isOfficial = officialDomains.some(official => rawDomain === official || rawDomain.endsWith(`.${official}`));

      if (isOfficial) {
        // A free mailbox is never an official sender, even when the domain
        // genuinely belongs to the brand (gmail.com is Google's, but a message
        // sent from a personal Gmail is not a message from Google).
        if (!isFreeMailDomain(rawDomain)) isLegitimateOfficialSender = true;
        continue;
      }

      // Check A: Character substitution (Homoglyph, e.g. m1crosoft -> microsoft,
      // paypa1 -> paypal). Either reading of the digit may resolve the brand.
      const hasHomoglyphSubstitution =
        (normalizedSld.includes(brand) || normalizedAltSld.includes(brand)) && !sld.includes(brand);

      // Check B: Subdomain or hyphen brand-stuffing (e.g. microsoft-support.com, login-microsoft.com)
      const hasBrandStuffing = (normalizedFullHost.includes(brand) || sld.includes(brand)) && !isOfficial;

      // Check C: Levenshtein distance check (e.g. microsft, micosoft, appple)
      // The length must also be within +/-2, otherwise unrelated short domains
      // can sit an edit or two away from a brand by coincidence.
      const distance = Math.min(
        levenshteinDistance(normalizedSld, brand),
        levenshteinDistance(normalizedAltSld, brand)
      );
      const lengthDelta = Math.abs(sld.length - brand.length);
      const isCloseTypo = distance > 0 && distance <= 2 && lengthDelta <= 2 && sld.length >= MIN_BRAND_LEN;

      if (hasHomoglyphSubstitution) {
        flags.push({
          span: rawDomain,
          reason: `Homoglyph/Typosquat domain: '${rawDomain}' uses character substitution to impersonate brand '${brand.toUpperCase()}'`,
          type: "rule"
        });
        rawScore += 65;
      } else if (hasBrandStuffing) {
        flags.push({
          span: rawDomain,
          reason: `Brand impersonation/stuffing: '${rawDomain}' uses brand name '${brand.toUpperCase()}' without official ownership`,
          type: "rule"
        });
        rawScore += 60;
      } else if (isCloseTypo) {
        flags.push({
          span: rawDomain,
          reason: `Typosquatting domain: '${rawDomain}' is suspiciously close to brand '${brand.toUpperCase()}'`,
          type: "rule"
        });
        rawScore += 55;
      }
    }
  }

  // 2. Urgency and Credential Patterns
  let hasUrgency = false;
  let hasCredentialRequest = false;

  for (const pattern of URGENCY_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 25;
      hasUrgency = true;
    }
  }

  for (const pattern of CREDENTIAL_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 30;
      hasCredentialRequest = true;
    }
  }

  // 2b. Social-engineering families (advance-fee, refund bait, delivery fee,
  // fake subscription, fake 2FA, investment, health, ID harvest, cold-contact).
  //
  // Each family is capped at one contribution no matter how many of its
  // patterns match. A single advance-fee email usually trips four or five of
  // them ("lucky winner", a million-dollar figure, Western Union, an
  // activation fee); without the cap one message would score like four
  // separate scams.
  const firedFamilies = new Set();
  for (const family of SOCIAL_ENGINEERING_FAMILIES) {
    if (firedFamilies.has(family.name)) continue;
    let hits = 0;
    for (const pattern of family.patterns) {
      const match = text.match(pattern.regex);
      if (!match) continue;
      firedFamilies.add(family.name);
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += family.points;
      hits++;
      // A second corroborating pattern from the same family is real additional
      // evidence, but it is worth less than the first: an advance-fee email
      // matches many of its own patterns, and counting them all would let one
      // family outvote a genuine cross-family combination. Half value, and
      // never more than two contributions per family.
      //
      // Families can opt out. personal_data does, because its patterns are
      // interchangeable spellings of a single request - a legitimate HR form
      // asking for "Your Full Names:", "Your Country:" and "Cell/Telephone
      // Number:" trips three of them and is not three times more suspicious.
      if (hits >= 2 || family.corroboration === false) break;
      rawScore += Math.round(family.points * 0.5);
    }
  }

  const hasMoneyBait = firedFamilies.has("advance_fee") ||
    firedFamilies.has("refund_bait") || firedFamilies.has("investment") ||
    firedFamilies.has("delivery_fee");
  const hasActionRequest = firedFamilies.has("personal_data") ||
    firedFamilies.has("contact_stranger") || firedFamilies.has("fake_security") ||
    firedFamilies.has("fake_subscription");

  // 2b-1. Reply-To points somewhere other than the sending domain.
  //
  // A From: that looks institutional while Reply-To: is a free webmail or
  // lookalike host is a deliberate attempt to defeat reply-path filtering on
  // the receiving organisation. This fires independently of any brand list, so
  // it works for institutions the engine has never heard of.
  const fromDomains = extractFromDomains(text);
  const replyToDomains = extractReplyToDomains(text);
  const replyToRedirect = replyToDomains.find(
    (rt) => !fromDomains.some((fd) => rt === fd || rt.endsWith("." + fd) || fd.endsWith("." + rt))
  );
  if (replyToRedirect) {
    flags.push({
      span: replyToRedirect,
      reason:
        "Reply-To redirect: replies are routed to " + replyToRedirect +
        (fromDomains.length ? " instead of the sending domain " + fromDomains.join(", ") : ""),
      type: "rule"
    });
    rawScore += 25;
  }

  // 2b-2. Mixed-script homoglyphs inside otherwise-Latin words.
  const mixedScript = findMixedScriptTokens(text);
  if (mixedScript.length > 0) {
    flags.push({
      span: mixedScript[0].token,
      reason:
        "Mixed-script homoglyph: '" + mixedScript[0].token +
        "' contains non-Latin characters (U+" +
        mixedScript[0].nonLatin.map((c) => c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")).join(" U+") +
        "), which is invisible to the reader and used to spoof a brand",
      type: "rule"
    });
    rawScore += 30;
  }

  // 2b-3. Sender on free / anonymous hosting.
  //
  // Checked against the From: domain, not only links in the body: a lookalike
  // bank notice is routinely sent straight from Firebase Hosting with no link
  // in the body at all, so the existing body-only rule never sees it.
  const abusedHostSender = fromDomains.find((d) => ABUSED_HOSTING_RE.test(d));
  if (abusedHostSender) {
    flags.push({
      span: abusedHostSender,
      reason: "Sender domain is free anonymous hosting, commonly used to serve brand lookalikes",
      type: "rule"
    });
    rawScore += 20;
  }

  // 2b-4. A large monetary amount with a currency code or symbol.
  if (LARGE_AMOUNT_RE.test(text) && !firedFamilies.has("advance_fee")) {
    const amt = text.match(LARGE_AMOUNT_RE);
    flags.push({
      span: amt[0].trim(),
      reason: "Large monetary amount quoted unsolicited",
      type: "rule"
    });
    rawScore += 15;
  }

  // 2c. Display-name brand impersonation.
  //
  // The checks above only ever look at the sending domain, so a message
  // claiming to be "MetaMask" from an anonymous *.firebaseapp.com host looks
  // like ordinary mail to them. The display name is where attackers are
  // careless, and a mismatch against a known brand is very high precision.
  const displayNames = extractSenderDisplayNames(text);
  const senderDomainsForDisplay = extractSenderDomains(text);
  const claimedBrands = [];
  for (const name of displayNames) {
    const normalizedName = normalizeForBrandCheck(name).replace(/\s+/g, "");
    const altName = normalizeAltForBrandCheck(name).replace(/\s+/g, "");
    for (const brand of MATCHABLE_BRANDS) {
      if (brand.length < 5) continue;
      const hit = normalizedName.includes(brand) || altName.includes(brand) ||
        name.toLowerCase().replace(/\s+/g, "").includes(brand);
      if (!hit) continue;
      // An official brand domain is allowed to use its own name. The
      // `${brand}.com` fallback matters: without it, every brand missing an
      // entry in OFFICIAL_BRAND_DOMAINS (coinbase, dropbox, binance, ...) was
      // treated as impersonating itself, which flagged their own legitimate
      // mail.
      const official = OFFICIAL_BRAND_DOMAINS[brand] || [`${brand}.com`];
      // Free webmail never counts as official: "MetaMask" from a personal
      // Gmail address is impersonation, not a message from MetaMask.
      const senderIsOfficial = senderDomainsForDisplay.some(
        (d) => !isFreeMailDomain(d) && official.some((o) => d === o || d.endsWith("." + o))
      );
      if (!senderIsOfficial) claimedBrands.push({ name, brand, senderDomains: senderDomainsForDisplay });
      break;
    }
  }
  if (claimedBrands.length > 0) {
    for (const claim of claimedBrands) {
      flags.push({
        span: claim.name,
        reason:
          "Brand impersonation: sender is displayed as '" + claim.name +
          "' but the message does not come from an official " +
          claim.brand.toUpperCase() + " domain" +
          (claim.senderDomains.length ? " (actual: " + claim.senderDomains.join(", ") + ")" : ""),
        type: "rule"
      });
      rawScore += 55;
    }
  }

  // 3d. Money-bait + action-request COMBO.
  //
  // This is the single most important new rule. Neither half is conclusive on
  // its own: plenty of legitimate mail mentions a refund or a renewal, and
  // plenty of legitimate mail asks you to contact support. Together they
  // describe the advance-fee shape almost exactly - an unexpected financial
  // claim that can only be released by sending data, money, or a reply to a
  // third party.
  if (hasMoneyBait && hasActionRequest && !isLegitimateOfficialSender) {
    flags.push({
      span: "Money bait + unsolicited action request",
      reason:
        "High-risk combination: an unexpected financial claim is paired with a " +
        "request for personal data, payment, or an off-channel reply",
      type: "rule"
    });
    rawScore += 45;
  }

  // 3e. Advance-fee shape: money promised, but a fee is required up front.
  if (firedFamilies.has("advance_fee") && /activat\w*\s+fee|to\s+(start|proceed|receive)[^.]{0,40}(pay|send|fee)|pay\s+them?\s+the|small\s+(fee|charge)/i.test(text) && !isLegitimateOfficialSender) {
    flags.push({
      span: "Advance-fee pretext",
      reason:
        "Advance-fee fraud signature: a large sum is promised, but a fee must " +
        "be paid before it is released",
      type: "rule"
    });
    rawScore += 40;
  }

  // 2d. Brand claimed in a signature footer, but the sender domain is not
  // official for that brand.
  //
  // "© 2025 PayPal, LLC" in the body of a message sent from an unrelated
  // throwaway domain is a stronger impersonation tell than anything the domain
  // checks can see, because those checks only ever read the domain.
  const hasSignatureFooter = SIGNATURE_FOOTER_PATTERNS.some((re) => re.test(text));
  if (hasSignatureFooter && !isLegitimateOfficialSender) {
    const bodyBrands = MATCHABLE_BRANDS.filter((brand) => {
      if (brand.length < 4) return false;
      const official = OFFICIAL_BRAND_DOMAINS[brand] || [`${brand}.com`];
      const senderIsOfficial = senderDomainsForDisplay.some(
        (d) => !isFreeMailDomain(d) && official.some((o) => d === o || d.endsWith("." + o))
      );
      if (senderIsOfficial) return false;
      return new RegExp("\\b" + brand + "\\b", "i").test(text);
    });
    for (const brand of bodyBrands) {
      const display = new RegExp("(" + brand + "[\\w. ]{0,28})", "i").exec(text);
      flags.push({
        span: display ? display[1].trim() : brand,
        reason:
          "Signature claims " + brand.toUpperCase() +
          " but the message is not sent from an official " + brand + " domain" +
          (senderDomainsForDisplay.length ? " (actual sender: " + senderDomainsForDisplay.join(", ") + ")" : ""),
        type: "rule"
      });
      rawScore += 45;
      break;
    }
  }

  // 3d-1. Advance-fee claim that also quotes a concrete large sum.
  //
  // Neither half is decisive alone: a newsletter can mention a lottery win, and
  // an invoice quotes a six-figure total every day. Together they describe the
  // advance-fee shape - an unsolicited payout claim with a specific amount,
  // delivered to someone who never asked for it.
  if (firedFamilies.has("advance_fee") && SIX_FIGURE_AMOUNT_RE.test(text) && !isLegitimateOfficialSender) {
    flags.push({
      span: "Unsolicited payout claim with a specific large amount",
      reason:
        "High-risk combination: an unsolicited prize, grant or compensation " +
        "claim quotes a specific six-figure or larger sum",
      type: "rule"
    });
    rawScore += 25;
  }

  // 3. Urgency + Credential harvesting COMBO Boost
  if (hasUrgency && hasCredentialRequest && !isLegitimateOfficialSender) {
    flags.push({
      span: "Urgency + Credential Harvesting Combo",
      reason: "High-risk combination: Urgency pressure combined with credential login request",
      type: "rule"
    });
    rawScore += 45;
  }

  // 3b. URL shortener + pressure COMBO (smishing / delivery-fraud signature)
  let hasShortener = false;
  for (const pattern of SUSPICIOUS_DOMAINS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "rule" });
      rawScore += 35;
      if (pattern.reason.indexOf("shortener") !== -1) hasShortener = true;
    }
  }

  if (hasShortener && (hasUrgency || hasCredentialRequest) && !isLegitimateOfficialSender) {
    flags.push({
      span: "Concealed link + pressure",
      reason:
        "High-risk combination: a shortened link hides the true destination while the message applies time pressure",
      type: "rule"
    });
    rawScore += 30;
  }

  // 3c. Sender / link domain mismatch (spec Part 1.3)
  // Only evaluated for senders that are NOT an official brand domain, so that
  // legitimate cross-domain mail (GitHub -> Vercel) is never penalised.
  const senderDomains = extractSenderDomains(text);
  const linkDomains = extractLinkDomains(text);
  if (!isLegitimateOfficialSender && senderDomains.length && linkDomains.length) {
    for (const sender of senderDomains) {
      const senderReg = registeredDomain(sender);
      const offDomainLinks = linkDomains.filter((link) => {
        const linkReg = registeredDomain(link);
        return linkReg !== senderReg && linkReg !== sender && senderReg !== linkReg;
      });
      if (offDomainLinks.length) {
        flags.push({
          span: sender,
          reason:
            "Sender/link mismatch: message is sent from '" + sender +
            "' but links point to " + offDomainLinks.slice(0, 3).join(", "),
          type: "rule"
        });
        rawScore += 30;
        break;
      }
    }
  }

  // 4. Promotional Clutter Check
  let promoCount = 0;
  for (const pattern of PROMOTIONAL_CLUTTER_PATTERNS) {
    const match = text.match(pattern.regex);
    if (match) {
      flags.push({ span: match[0], reason: pattern.reason, type: "promo" });
      promoCount++;
    }
  }

  if (promoCount >= 2 && rawScore < 40) {
    isPromoClutter = true;
    rawScore = Math.max(45, rawScore + promoCount * 12);
  }

  // 5. Official Domain Exemption: If official sender domain with no typosquats, cap false positives
  if (isLegitimateOfficialSender && !hasCredentialRequest) {
    rawScore = Math.min(25, rawScore);
  }

  const finalRuleScore = Math.min(100, rawScore);
  return {
    ruleScore: finalRuleScore,
    flags,
    isPromoClutter
  };
}

module.exports = { evaluateRules, normalizeForBrandCheck, levenshteinDistance };
