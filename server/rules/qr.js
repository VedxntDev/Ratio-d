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
  flipkart: ["flipkart.com"], usps: ["usps.com"]
};
const ALL_OFFICIAL = new Set(Object.values(BRANDS).flat());
const SHORTENERS = new Set(["bit.ly", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "rb.gy", "ow.ly", "shorturl.at", "t.ly", "buff.ly", "qrco.de", "qr.link", "l.ead.me", "tiny.cc", "rebrand.ly"]);
const RISKY_TLDS = new Set(["xyz", "top", "icu", "buzz", "cam", "page", "click", "live", "shop", "support", "rest", "cfd", "sbs", "work", "zip", "mov", "monster", "cyou", "gq", "tk", "ml", "cf"]);
const FREE_HOSTS = ["firebaseapp.com", "web.app", "pages.dev", "workers.dev", "github.io", "weebly.com", "wixsite.com", "notion.site", "blogspot.com", "netlify.app", "vercel.app", "glitch.me", "000webhostapp.com", "forms.gle", "sites.google.com"];
const SLD = new Set(["co.uk", "org.uk", "ac.uk", "gov.uk", "co.in", "org.in", "net.in", "gov.in", "ac.in", "nic.in", "com.au", "com.br", "co.jp", "co.za", "com.sg", "com.cn"]);
const EMAIL_RE = /\[EMAIL_REDACTED\]|%5BEMAIL_REDACTED|[\w.+-]+(?:@|%40)[\w-]+\.[\w.-]+/i;
const PATH_KW = /(login|log-in|signin|sign-in|verify|secure|account|password|otp|kyc|wallet|billing|invoice|payment|update|confirm|unlock|suspend|refund)/i;
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

function analyzeUrl(raw, add) {
  let u;
  try { u = new URL(raw); } catch (e) { add(raw.slice(0, 80), "Unparseable URL", 15); return; }
  const scheme = u.protocol.slice(0, -1);
  if (["javascript", "data", "vbscript", "file", "intent"].includes(scheme)) { add(scheme + ":", "Dangerous URI scheme in QR", 70, true); return; }
  if (scheme === "http") add("http://", "Unencrypted http link", 10);
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  const reg = registrable(host), regLabel = reg.split(".")[0], tld = host.split(".").pop();

  if (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith("[")) add(host, "Raw IP address as host", 35, true);
  if (host.split(".").some(l => l.startsWith("xn--"))) add(host, "Punycode (IDN) host: possible lookalike", 30, true);
  if (u.username || u.password) add(u.username + "@", "Userinfo '@' trick: real host is " + host, 30, true);
  if (u.port) add(":" + u.port, "Non-standard port", 10);
  if (SHORTENERS.has(reg)) add(reg, "URL shortener / QR redirector: destination hidden", 25);
  if (RISKY_TLDS.has(tld)) add("." + tld, "Frequently abused TLD", 20);
  if (FREE_HOSTS.some(h => host === h || host.endsWith("." + h))) add(host, "Free/anonymous hosting", 15);
  if (host.split(".").length - reg.split(".").length >= 3) add(host, "Deep subdomain chain", 10);
  if ((reg.match(/-/g) || []).length >= 2) add(reg, "Multiple hyphens in domain", 10);
  if (raw.length > 150) add("length " + raw.length, "Very long URL", 8);
  if ((raw.match(/%[0-9a-f]{2}/gi) || []).length >= 8) add("%xx", "Heavy percent-encoding", 8);

  if (!ALL_OFFICIAL.has(reg)) {
    const tokens = host.split(/[.\-]/).filter(Boolean);
    for (const brand of Object.keys(BRANDS)) {
      if (brand.length < 4) continue;
      if (tokens.some(t => t === brand || (brand.length >= 6 && t.startsWith(brand) && t.length <= brand.length + 8))) {
        add(host, "Brand '" + brand + "' in hostname but domain is not official", 40, true); break;
      }
      if (tokens.some(t => variants(t).some(v => v !== t && v === brand))) {
        add(host, "Homoglyph impersonation of '" + brand + "'", 40, true); break;
      }
      if (regLabel.length >= 5 && brand.length >= 5 && regLabel !== brand && lev(regLabel, brand) <= (brand.length < 8 ? 1 : 2)) {
        add(reg, "Typosquat of '" + brand + "'", 40, true); break;
      }
    }
  }
  for (const [k, v] of u.searchParams) if (REDIRECT_KEYS.test(k) && /^(https?:)?\/\//i.test(v)) { add(k + "=", "Open-redirect style parameter", 20); break; }
  if (PATH_KW.test(u.pathname)) add(u.pathname.slice(0, 40), "Credential/payment keyword in path", 12);
  let emailHit = EMAIL_RE.test(u.search + u.hash);
  if (!emailHit) for (const [, v] of u.searchParams) {
    if (v.length >= 12 && /^[A-Za-z0-9+/=_-]+$/.test(v)) { try { if (EMAIL_RE.test(atob(v.replace(/-/g, "+").replace(/_/g, "/")))) { emailHit = true; break; } } catch (e) { /* not base64 */ } }
  }
  if (emailHit) add("email in URL", "Recipient email pre-filled (targeted quishing)", 15);
}

function analyzeQr(raw) {
  const payload = String(raw == null ? "" : raw);
  const flags = []; let score = 0, severe = false;
  const add = (span, reason, points, sev) => { flags.push({ span: String(span), reason, points }); score += points; if (sev) severe = true; };
  const c = classify(payload);

  if (c.kind === "url" || c.kind === "text_with_url") {
    if (c.noScheme) add("no scheme", "QR has no scheme; the phone will guess", 5);
    analyzeUrl(c.url, add);
  } else if (c.kind === "upi") {
    add("upi://pay", "Payment request QR: scanning only ever PAYS, never receives", 15);
    let q; try { q = new URL(payload).searchParams; } catch (e) { q = new URLSearchParams(); }
    if (q.get("am")) add("am=" + q.get("am"), "Pre-filled amount", 15);
    if (/refund|cashback|reward|prize|lottery|claim|kyc/i.test((q.get("tn") || "") + (q.get("pn") || ""))) add("tn/pn", "Refund/reward wording on a PAY request: classic collect scam", 40, true);
  } else if (c.kind === "crypto") add("crypto:", "Crypto payment request", 40);
  else if (c.kind === "phone") { add("tel/sms", "QR triggers a call or SMS", 20); const m = payload.match(/https?:\/\/[^\s]+/i); if (m) analyzeUrl(m[0], add); }
  else if (c.kind === "wifi") { if (/T:(nopass|WEP)/i.test(payload)) add("WIFI", "Open/WEP network", 20); }
  else if (c.kind === "mail") add("mailto", "QR composes an email", 5);

  score = Math.min(100, score);
  if (severe) score = Math.max(score, 82);
  const verdict = score >= 66 ? "high_risk" : score >= 35 ? "suspicious" : "safe";
  const NEXT = {
    high_risk: ["Do not open the link or approve any payment.", "Do not sign in or enter codes.", "Report the sender/poster; verify via the organisation's official app or site typed by hand."],
    suspicious: ["Do not scan-and-sign-in. Type the organisation's address manually instead.", "If this was on paper or a poster, check it is not a sticker over another code."],
    safe: ["No red flags from static checks. This is not a guarantee: the destination was not fetched."]
  };
  return {
    payload_kind: c.kind, score, verdict, flags, next_steps: NEXT[verdict],
    defanged: defang(payload),
    engine: { source: "qr_rules_v1", note: "deterministic heuristics; destination not fetched or followed" }
  };
}
module.exports = { analyzeQr, classify, registrable, defang };
