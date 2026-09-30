"use strict";
const { analyzeQr, registrable } = require("../rules/qr");
const { URL_SYSTEM_PROMPT, buildUrlMessage } = require("../llm/prompt");

const LLM_KEY = process.env.RATIOD_LLM_API_KEY || "";

/**
 * Normalise the verdict vocabulary.
 *
 * The deterministic analyser emits MALICIOUS / HIGH_RISK / SUSPICIOUS / SAFE.
 * Older clients (js/qr-ui.js, the extension panel) were written against
 * high_risk / suspicious / safe, so `verdict` stays on the strict vocabulary and
 * `legacy_verdict` carries the old one. Nothing is silently renamed.
 */
function toLegacy(v) {
  return v === "MALICIOUS" || v === "HIGH_RISK" ? "high_risk"
    : v === "SUSPICIOUS" ? "suspicious" : "safe";
}

/**
 * Attach the fields the hardened prompt's output schema requires, so the
 * deterministic path satisfies the same contract an LLM response would.
 *
 * `is_official_domain` is null when the payload is not a URL at all, rather
 * than false - "we could not tell" is not the same claim as "not official".
 */
function decorate(result, payload) {
  let registeredDomain = null, isOfficial = null, brand = "None";
  try {
    const m = String(payload).match(/^https?:\/\/([^/?#]+)/i);
    if (m) {
      const host = m[1].toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
      registeredDomain = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host : registrable(host);
      const impersonation = (result.flags || []).some(f => /^Brand Impersonation$|^Deceptive Subdomain$|^Typosquatting$/.test(f.category || ""));
      isOfficial = impersonation ? false
        : (result.flags || []).length === 0 ? true : null;
      const brandFlag = (result.flags || []).find(f => /'([^']+)'/.test(f.reason) && /Impersonat|impersonat|Homoglyph|Typosquat|appears in the/.test(f.reason));
      if (brandFlag) brand = (brandFlag.reason.match(/'([^']+)'/) || [])[1] || "None";
    }
  } catch (e) { /* payload shape is validated upstream */ }

  const categories = [...new Set((result.flags || []).map(f => f.category).filter(Boolean))];
  return {
    ...result,
    risk_score: result.score,
    verdict: result.verdict,
    legacy_verdict: result.legacy_verdict || toLegacy(result.verdict),
    target_brand_detected: brand,
    registered_domain: registeredDomain,
    is_official_domain: isOfficial,
    threat_categories: categories.length ? categories : ["None"],
    red_flags: (result.flags || []).map(f => f.reason),
    analysis_summary: (result.flags || []).length
      ? `${result.verdict} (${result.score}/100): ${(result.flags || []).map(f => f.reason).join("; ")}. The destination was not fetched.`
      : "No red flags from static analysis. The destination was not fetched, so this is not a guarantee.",
    llm: {
      enabled: Boolean(LLM_KEY),
      source: "deterministic",
      prompt: "URL_SYSTEM_PROMPT",
      message: buildUrlMessage(String(payload).slice(0, 300), result)
    }
  };
}

/* Returns {status, json}. */
function handleQr(body) {
  const p = body && typeof body.payload === "string" ? body.payload : "";
  if (!p || p.length > 4096) return { status: 400, json: { error: "payload required (1-4096 chars)" } };
  return { status: 200, json: decorate(analyzeQr(p), p) };
}
module.exports = { handleQr, decorate, toLegacy };
