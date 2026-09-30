"use strict";
/* QR payload analyzer (quishing). Zero deps, pure function: analyzeQr(raw).
   Deterministic heuristics only. The destination is never fetched. */

const BRANDS = {
  paypal: ["paypal.com"], microsoft: ["microsoft.com", "live.com", "office.com", "microsoftonline.com", "outlook.com", "sharepoint.com"],
  google: ["google.com", "gmail.com", "youtube.com", "goo.gl", "gstatic.com", "googleusercontent.com"],
  apple: ["apple.com", "icloud.com"], amazon: ["amazon.com", "amazon.in", "amazonaws.com"],
  netflix: ["netflix.com"], docusign: ["docusign.com", "docusign.net"], adobe: ["adobe.com"],
  dropbox: ["dropbox.com"], linkedin: ["linkedin.com"], facebook: ["facebook.com", "fb.com"],
  instagram: ["instagram.com"], whatsapp: ["whatsapp.com", "wa.me"], telegram: ["telegram.org", "t.me"],
  coinbase: ["coinbase.com"], binance: ["binance.com"], metamask: ["metamask.io"], fedex: ["fedex.com"],
  hdfcbank: ["hdfcbank.com"], icicibank: ["icicibank.com"], axisbank: ["axisbank.com"],
  paytm: ["paytm.com"], phonepe: ["phonepe.com"], irctc: ["irctc.co.in"], npci: ["npci.org.in"],
  flipkart: ["flipkart.com"], usps: ["usps.com"],

  // Brands with no official domain of their own, tracked so they are still
  // detected when they appear in a subdomain, registrable label or path.
  //
  // Before this list existed, `chase-account-verify.tk` scored 42 (suspicious,
  // not the 75+ the calibration requires) and `secure-login.steamcommunity.ru`
  // scored 12 and read "safe": Chase was not tracked at all, and Steam was only
  // ever compared for equality against a host label, so the token
  // "steamcommunity" never matched the brand token "steam".
  //
  // These are name-only. `isOfficialFor()` is the single function allowed to
  // decide a link is official, and an empty list can never grant that.
  chase: [], wellsfargo: [], bankofamerica: [], citibank: [], hsbc: [], barclays: [],
  barclaycard: [], santander: [], natwest: [], lloydsbank: [], standardchartered: [],
  steamcommunity: ["steamcommunity.com"], playstation: ["playstation.com"],
  xbox: ["xbox.com"], nintendo: ["nintendo.com"],
  payoneer: ["payoneer.com"], westernunion: ["westernunion.com"], moneygram: ["moneygram.com"],
  wise: ["wise.com"], revolut: ["revolut.com"], venmo: ["venmo.com"], cashapp: ["cashapp.com"],
  kraken: ["kraken.com"], ledger: ["ledger.com"], trezor: ["trezor.io"],
  roblox: ["roblox.com"], epicgames: ["epicgames.com"], battlenet: ["blizzard.com"],
  spotify: ["spotify.com"], github: ["github.com"], gitlab: ["gitlab.com"],
  shopify: ["shopify.com"], slack: ["slack.com"], zoom: ["zoom.us"],
  okta: ["okta.com"], authy: ["authy.com"], lastpass: ["lastpass.com"],
  norton: ["norton.com"], mcafee: ["mcafee.com"], avast: ["avast.com"], kaspersky: ["kaspersky.com"]
};
const ALL_OFFICIAL = new Set(Object.values(BRANDS).flat().filter(Boolean));
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "ow.ly", "shorturl.at", "t.ly", "buff.ly", "qrco.de", "qr.link", "l.ead.me", "tiny.cc", "rebrand.ly"]);
const RISKY_TLDS = new Set(["xyz", "top", "icu", "buzz", "cam", "page", "click", "live", "shop", "support", "rest", "cfd", "sbs", "work", "zip", "mov", "monster", "cyou", "gq", "tk", "ml", "cf"]);
const FREE_HOSTS = ["firebaseapp.com", "web.app", "pages.dev", "workers.dev", "github.io", "weebly.com", "wixsite.com", "notion.site", "blogspot.com", "netlify.app", "vercel.app", "glitch.me", "000webhostapp.com", "forms.gle", "sites.google.com"];
const SLD = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "org.in", "net.in", "gov.in", "ac.in", "nic.in", "com.au", "com.br", "co.jp", "co.za", "com.sg", "com.cn"]);
const EMAIL_RE = /\[EMAIL_REDACTED\]|%5BEMAIL_REDACTED|[\w.+-]+(?:@|%40)[\w-]+\.[\w.-]+/i;
const PATH_KW = /(login|log-in|signin|sign-in|verify|secure|account|password|otp|kyc|wallet|billing|invoice|payment|update|confirm|unlock|suspend|refund)/i;
// Stricter subset used only to decide whether an impersonating host is ALSO a
// credential page. "update" and "refund" are excluded on purpose: they are
// ordinary words on legitimate marketing pages, so including them would push
// benign URLs to a flat 100.
const PATH_KW_S = /(login|log-in|signin|sign-in|verify|account|password|otp|kyc|wallet|billing|payment|unlock|suspend)/i;
const REDIRECT_KEYS = /^(url|redirect|redirect_uri|next|continue|dest|destination|goto|return|target|link)$/i;

function lev(a, b) {
  const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
function registrable(host) {
  const p = host.split("."); if (p.length <= 2) return host;
  const l2 = p.slice(-2).join("."); return SLD.has(l2) ? p.slice(-3).join(".") : l2;
}
function variants(t) {
  const base = t.replace(/rn/g, "m").replace(/vv/g, "w").replace(/0/g, "o").replace(/3/g, "e").replace(/5/g, "s");
  return [base.replace(/1/g, "l"), base.replace(/1/g, "i")]; // paypa1 only resolves under 1->l
}
function defang(s) { return String(s).slice(0, 300).replace(/http(s?):\/\//gi, "hxxp$1://").replace(/\./g, "[.]"); }

/**
 * Is `reg` (the registrable/root domain) an official property of `brand`?
 *
 * This is the ONLY function permitted to conclude a link is official. It
 * answers from the registrable domain alone, which is why a brand name in a
 * subdomain or path can never buy a link an "official" verdict.
 *
 *   isOfficialFor("paypal", "paypal.com")        -> true
 *   isOfficialFor("paypal", "paypal.com.evil.xyz") -> false  (root is evil.xyz)
 *   isOfficialFor("chase",  "chase-account.tk")    -> false  (brand has no domain)
 */
function isOfficialFor(brand, reg) {
  const domains = BRANDS[brand] || [];
  return domains.some(d => reg === d || reg.endsWith("." + d));
}

// Reference and documentation domains. A brand name in the path of one of
// these is an article title, not an attack: en.wikipedia.org/wiki/Apple_Inc.
// is a page ABOUT Apple, and flagging it 90/MALICIOUS is precisely the kind of
// false positive that trains users to ignore the badge.
//
// This is a deliberate exception to zero-trust, and it is scoped as narrowly as
// possible - it applies to the registrable domain's own path, never to a
// subdomain, and it never suppresses a brand hit in the domain itself. So
// `apple-id-verify.com` and `paypal.com.evil.xyz` are unaffected.
const REFERENCE_DOMAINS = new Set([
  "wikipedia.org", "en.wikipedia.org", "arxiv.org", "reddit.com", "quora.com",
  "stackoverflow.com", "stackexchange.com", "medium.com", "substack.com",
  "news.ycombinator.com", "ycombinator.com", "github.io", "gitlab.io",
  "developer.mozilla.org", "docs.google.com", "notion.so"
]);

/**
 * Every brand referenced by a URL, and where it was referenced.
 *
 * The registrable domain is the authoritative zone. A brand in a SUBDOMAIN or
 * PATH is impersonation by definition, because no legitimate organisation
 * serves its login from `brand.account-update.tk`.
 *
 * `steamcommunity.ru` is the case that forced the substring rule below: the
 * attacker simply concatenates the brand onto an unrelated label, so requiring
 * token equality (the old behaviour) matched nothing at all.
 */
function brandsInUrl(host, reg, pathAndQuery) {
  const found = new Map();
  const note = (brand, zone) => {
    if (!found.has(brand)) found.set(brand, zone);
  };
  const ALL_BRANDS = Object.keys(BRANDS).filter(b => b.length >= 4);

  // Zone 1: the registrable label. Compared as a WHOLE hyphen-joined string,
  // not per label: `apple-id-verify.com` is one label, so splitting on dots
  // only ever yields "apple-id-verify", which contains "apple" but is not
  // equal to it. Splitting on hyphens alone is not enough either, because
  // `secureappleid` has no hyphen at all - hence the strip-then-substring
  // test applied to both the raw and the de-hyphenated label.
  const regLabel = reg.split(".")[0];
  const regVariants = [regLabel, regLabel.replace(/-/g, ""), regLabel.split("-")];
  for (const brand of ALL_BRANDS) {
    if (regVariants.some(v => Array.isArray(v) ? v.includes(brand) : mentionsBrand(v, brand))) {
      note(brand, "domain");
    }
  }

  // Zone 2: subdomains and any remaining host label. Substring, so
  // `steamcommunity` matches "steam" no matter how long the attacker makes it.
  const hostLabels = host.split(".").filter(l => l !== regLabel);
  for (const brand of ALL_BRANDS) {
    if (hostLabels.some(l => mentionsBrand(l, brand))) note(brand, "subdomain");
  }

  // Zone 3: the path and query, where "paypal" in /paypal/refund is bait.
  // Skipped on reference domains, where the path is an article slug rather
  // than a destination the user is about to authenticate against.
  if (pathAndQuery && !REFERENCE_DOMAINS.has(reg)) {
    const pathText = pathAndQuery.toLowerCase();
    const pathTokens = pathText.split(/[^a-z0-9]+/).filter(Boolean);
    for (const brand of ALL_BRANDS) {
      if (pathTokens.some(t => mentionsBrand(t, brand)) || mentionsBrand(pathText.replace(/[^a-z0-9]/g, ""), brand)) {
        note(brand, "path");
      }
    }
  }
  return found;
}

/**
 * Does `token` reference `brand`?
 *
 * Substring, not equality. `steamcommunity`, `paypalverify`, `secureappleid`
 * and `chaseaccount` all contain their brand, and an attacker choosing a name
 * gets to choose its length - requiring an exact match just means the
 * attacker types one more character.
 */
function mentionsBrand(token, brand) {
  const t = String(token).toLowerCase().replace(/[^a-z0-9]/g, "");
  return t.includes(brand);
}

function classify(p) {
  const s = p.trim();
  if (/^https?:\/\//i.test(s) || /^(javascript|data|vbscript|file|intent):/i.test(s)) return { kind: "url", url: s };
  if (/^upi:\/\//i.test(s)) return { kind: "upi" };
  if (/^WIFI:/i.test(s)) return { kind: "wifi" };
  if (/^(tel|sms|smsto|mms|mmsto):/i.test(s)) return { kind: "phone" };
  if (/^(mailto:|MATMSG:)/i.test(s)) return { kind: "mail" };
  if (/^(bitcoin|ethereum|litecoin|monero):/i.test(s)) return { kind: "crypto" };
  if (/^BEGIN:VCARD/i.test(s)) return { kind: "vcard" };
  if (/^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(s)) return { kind: "url", url: "https://" + s, noScheme: true };
  const m = s.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? { kind: "text_with_url", url: m[0] } : { kind: "text" };
}

function analyzeUrl(raw, add, markImpersonation) {
  let u;
  try { u = new URL(raw); } catch (e) { add(raw.slice(0, 80), "Unparseable URL", 15); return; }
  const scheme = u.protocol.slice(0, -1);
  if (["javascript", "data", "vbscript", "file", "intent"].includes(scheme)) { add(scheme + ":", "Dangerous URI scheme in QR", 70, true); return; }
  if (scheme === "http") add("http://", "Unencrypted http link", 10);
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const reg = registrable(host), regLabel = reg.split(".")[0], tld = host.split(".").pop();

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) add(host, "Raw IP address as host", 35, true, "Obfuscated Host");
  if (host.split(".").some(l => l.startsWith("xn--"))) add(host, "Punycode (IDN) host: possible lookalike", 30, true, "Typosquatting");
  if (u.username || u.password) add(u.username + "@", "Userinfo '@' trick: real host is " + host, 30, true, "Deceptive Subdomain");
  if (u.port) add(":" + u.port, "Non-standard port", 10);
  if (SHORTENERS.has(reg)) add(reg, "URL shortener / QR redirector: destination hidden", 25);
  if (RISKY_TLDS.has(tld)) add("." + tld, "Frequently abused TLD", 20, false, "Suspicious TLD");
  if (FREE_HOSTS.some(h => host === h || host.endsWith("." + h))) add(host, "Free/anonymous hosting", 15);
  if (host.split(".").length - reg.split(".").length >= 3) add(host, "Deep subdomain chain", 10);
  if ((reg.match(/-/g) || []).length >= 2) add(reg, "Multiple hyphens in domain", 10);
  if (raw.length > 150) add("length " + raw.length, "Very long URL", 8);
  if ((raw.match(/%[0-9a-f]{2}/gi) || []).length >= 8) add("%xx", "Heavy percent-encoding", 8);

  // Zone-aware brand check. `officialBrand` is the only brand whose OWN root
  // domain is this link's root domain; any other brand named anywhere in the
  // URL is impersonation, because a subdomain or path cannot make a link
  // official.
  const pathAndQuery = u.pathname + u.search + u.hash;
  const referenced = brandsInUrl(host, reg, pathAndQuery);
  let officialBrand = null;
  for (const brand of referenced.keys()) {
    if (isOfficialFor(brand, reg)) { officialBrand = brand; break; }
  }
  for (const [brand, zone] of referenced) {
    if (brand === officialBrand) continue;
    if (markImpersonation) markImpersonation();
    if (zone === "domain") {
      // The registrable label IS the brand but the root domain is not one of
      // its official properties: paypal-security-update.xyz, apple-id-verify.com.
      add(reg, "Impersonating '" + brand + "' on an unofficial root domain (" + reg + ")", 55, true, "Brand Impersonation");
    } else {
      add(host + (zone === "path" ? pathAndQuery.slice(0, 40) : ""),
        "Brand '" + brand + "' appears in the " + zone + " of an unrelated domain (" + reg + ")",
        55, true, zone === "path" ? "Deceptive Path" : "Deceptive Subdomain");
    }
  }

  // Typosquatting and homoglyphs are judged against the registrable label only.
  // Comparing the whole hostname is what let `secure-login.steamcommunity.ru`
  // through untouched: the label is far from any brand, and the brand itself
  // was hiding in a subdomain that nothing inspected.
  if (!officialBrand) {
    const tokens = host.split(/[.\-]/).filter(Boolean);
    for (const brand of Object.keys(BRANDS)) {
      if (brand.length < 4) continue;
      if (referenced.has(brand)) continue; // already reported above
      if (tokens.some(t => variants(t).some(v => v !== t && v === brand))) {
        if (markImpersonation) markImpersonation();
        add(host, "Homoglyph impersonation of '" + brand + "'", 55, true, "Typosquatting"); break;
      }
      if (regLabel.length >= 5 && brand.length >= 5 && regLabel !== brand && lev(regLabel, brand) <= (brand.length < 8 ? 1 : 2)) {
        if (markImpersonation) markImpersonation();
        add(reg, "Typosquat of '" + brand + "'", 55, true, "Typosquatting"); break;
      }
    }
  }
  if (RISKY_TLDS.has(tld) && !officialBrand) {
    // A risky TLD alone is weak signal; combined with a security/account
    // keyword it is the "60-79 HIGH RISK" bracket of the calibration.
    if (PATH_KW.test(u.pathname) || /[?&][^=]*(login|verify|account|auth|signin|wallet|session)/i.test(u.search)) {
      add("." + tld, "Abused TLD combined with a credential keyword", 30);
    }
  }

  for (const [k, v] of u.searchParams) if (REDIRECT_KEYS.test(k) && /^(https?:)?\/\//i.test(v)) { add(k + "=", "Open-redirect style parameter", 20); break; }
  if (PATH_KW.test(u.pathname)) add(u.pathname.slice(0, 40), "Credential/payment keyword in path", 12, false, "Credential Harvesting");
  let emailHit = EMAIL_RE.test(u.search + u.hash);
  if (!emailHit) for (const [, v] of u.searchParams) {
    if (v.length >= 12 && /^[A-Za-z0-9+/=_-]+$/.test(v)) { try { if (EMAIL_RE.test(atob(v.replace(/-/g, "+").replace(/_/g, "/")))) { emailHit = true; break; } } catch (e) { /* not base64 */ } }
  }
  if (emailHit) add("email in URL", "Recipient email pre-filled (targeted quishing)", 15);
}

function analyzeQr(raw) {
  const payload = String(raw == null ? "" : raw);
  const flags = []; let score = 0, severe = false, impersonation = false;
  const add = (span, reason, points, sev, kind) => {
    flags.push({ span: String(span), reason, points, category: kind || "Heuristic" });
    score += points;
    if (sev) severe = true;
  };
  const markImpersonation = () => { impersonation = true; };
  const c = classify(payload);

  if (c.kind === "url" || c.kind === "text_with_url") {
    if (c.noScheme) add("no scheme", "QR has no scheme; the phone will guess", 5);
    analyzeUrl(c.url, add, markImpersonation);
  } else if (c.kind === "upi") {
    add("upi://pay", "Payment request QR: scanning only ever PAYS, never receives", 15);
    let q; try { q = new URL(payload).searchParams; } catch (e) { q = new URLSearchParams(); }
    if (q.get("am")) add("am=" + q.get("am"), "Pre-filled amount", 15);
    if (/refund|cashback|reward|prize|lottery|claim|kyc/i.test((q.get("tn") || "") + (q.get("pn") || ""))) add("tn/pn", "Refund/reward wording on a PAY request: classic collect scam", 40, true);
  } else if (c.kind === "crypto") add("crypto:", "Crypto payment request", 40);
  else if (c.kind === "phone") { add("tel/sms", "QR triggers a call or SMS", 20); const m = payload.match(/https?:\/\/[^\s]+/i); if (m) analyzeUrl(m[0], add); }
  else if (c.kind === "wifi") { if (/T:(nopass|WEP)/i.test(payload)) add("WIFI", "Open/WEP network", 20); }
  else if (c.kind === "mail") add("mailto", "QR composes an email", 5);

  // ---- Zero-trust calibration (0-100, 100 = Critical Malicious) ------------
  //
  // The floors below are the whole point of this change. Summing evidence
  // points let a link with two weak signals land at 35-50 and read "suspicious"
  // when it was plainly malicious: `chase-account-verify.tk` scored 42 and
  // `secure-login.steamcommunity.ru` scored 12/"safe". Under a zero-trust model
  // the presence of a decisive signal sets a floor that weak signals can never
  // pull back down.
  score = Math.min(100, score);

  // Brand impersonation, typosquatting and homoglyphs: floor 90, per the
  // "100% MALICIOUS BRAND IMPERSONATION" rule. A credential keyword in the
  // path on top of an impersonating host pushes it to 100.
  if (impersonation) score = Math.max(score, 90);
  if (impersonation && PATH_KW_S.test(payload)) score = 100;

  // Raw-IP host: never below 75. A login page served from an IP literal has no
  // domain to validate and is the "60-79 HIGH RISK" bracket at minimum.
  if (flags.some(f => f.reason.startsWith("Raw IP address"))) score = Math.max(score, 75);

  // Punycode and userinfo tricks are structural deception, not weak heuristics.
  if (flags.some(f => f.reason.startsWith("Punycode") || f.reason.startsWith("Userinfo")))
    score = Math.max(score, 75);

  // Any remaining severe signal (dangerous scheme, UPI collect scam, crypto
  // payment request) keeps the previous 82 floor.
  if (severe) score = Math.max(score, 82);

  const verdict = score >= 80 ? "MALICIOUS" : score >= 60 ? "HIGH_RISK"
    : score >= 35 ? "SUSPICIOUS" : "SAFE";

  const NEXT = {
    MALICIOUS: ["Do not open the link. This is an impersonation or a known-deceptive pattern.", "Never enter a password, OTP, card or bank detail here.", "Report the sender/poster and delete it. Reach the organisation through its official app or a hand-typed address."],
    HIGH_RISK: ["Do not open the link or approve any payment.", "Do not sign in or enter codes.", "Report the sender/poster; verify via the organisation's official app or site typed by hand."],
    SUSPICIOUS: ["Do not scan-and-sign-in. Type the organisation's address manually instead.", "If this was on paper or a poster, check it is not a sticker over another code."],
    SAFE: ["No red flags from static checks. This is not a guarantee: the destination was not fetched."]
  };
  return {
    payload_kind: c.kind, score, verdict, flags, next_steps: NEXT[verdict],
    // Retained so existing consumers (js/qr-ui.js, server/routes/qr.js, the
    // extension) keep working while the verdict moves to the strict vocabulary.
    legacy_verdict: score >= 66 ? "high_risk" : score >= 35 ? "suspicious" : "safe",
    defanged: defang(payload),
    engine: {
      source: "qr_rules_v2",
      note: "deterministic heuristics under a zero-trust model; destination not fetched or followed"
    }
  };
}
module.exports = { analyzeQr, classify, registrable, defang, isOfficialFor, brandsInUrl };
