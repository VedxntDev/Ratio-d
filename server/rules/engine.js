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
  "kraken"
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
  dhl: ["dhl.com"]
};

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
  { regex: /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/i, reason: "Raw IP address URL instead of domain" },
  {
    // URL shorteners hide the real destination, a staple of smishing /
    // delivery-fraud lures. Detected generically so new services are covered too.
    regex: /https?:\/\/(?:www\.)?(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|t\.ly|lnkd\.in|db\.tt|qr\.ae|v\.gd|s\.id|lnk\.to)\b|\b(?:bit\.ly|tinyurl\.com|rebrand\.ly|cutt\.ly|shorturl\.at|tiny\.cc|lnk\.to)\//i,
    reason: "URL shortener conceals the true destination domain"
  }
];

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
        isLegitimateOfficialSender = true;
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
