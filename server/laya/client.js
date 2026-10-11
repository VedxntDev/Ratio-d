/**
 * Ratio'd Laya Client Module (Local Typed-Decision Classifier Interface)
 * HARD RULE: Never fabricate a model score. Explicitly state whether the live standalone container
 * is connected or running local typed-decision heuristic fallback.
 */

/**
 * High-precision structural signals.
 *
 * These are deliberately narrow. Every pattern here is something a legitimate
 * transactional or marketing email essentially never contains, so they can
 * raise the probability without dragging ordinary newsletters and receipts
 * toward "high risk" (see test-false-positives.js, which guards that).
 */
const STRUCTURAL_SIGNALS = [
  // Punycode / IDN host: "xn--" is the ASCII encoding of a unicode domain and is
  // a standard way to make a lookalike domain survive a copy-paste.
  { name: "punycode_host", weight: 0.34, test: (t) => /https?:\/\/[^\s/]*xn--/i.test(t) },
  // Bare IP literal in a link: legitimate services use named hosts.
  { name: "ip_literal_link", weight: 0.34, test: (t) => /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(t) },
  // data: URI, used to smuggle a payload past a mail gateway.
  { name: "data_uri", weight: 0.30, test: (t) => /data:(text\/html|application\/javascript|;base64)/i.test(t) },
  // Long base64 blob: a common way to hide an attachment or a redirect.
  { name: "base64_blob", weight: 0.24, test: (t) => /[A-Za-z0-9+/]{120,}={0,2}/.test(t) },
  // Credential prompt aimed at a well-known brand, or a crypto/wire demand.
  { name: "credential_or_wire", weight: 0.20, test: (t) =>
      /(verify|confirm|update|validate|secure)\s+(your\s+)?(account|password|credentials|details|information)/i.test(t)
      || /(gift\s?card|bitcoin|crypto|wire\s+transfer|western\s+union|money\s+gram)/i.test(t) },
  // Many distinct outbound hosts in one short message.
  { name: "link_farm", weight: 0.18, test: (t) => {
      const hosts = new Set((t.match(/https?:\/\/([^\s/?#]+)/gi) || [])
        .map((u) => u.replace(/^https?:\/\//i, "").toLowerCase()));
      return hosts.size >= 5;
  } },
];

/**
 * Tokens that count toward the threat signal.
 *
 * Module scope rather than function-local so the exported TAXONOMY can report
 * exactly what this scorer looks for, without it drifting from the code path.
 */
const HIGH_RISK_TOKENS = [
  "urgent", "verify", "suspended", "password", "ssn", "wire", "paypa1", "bit.ly", "login"
];

const { evaluateVegaModel, TAXONOMY: VEGA_TAXONOMY } = require("../vegaml/client");
const { predictTrainedModel, loadModel } = require("./inference");

async function evaluateLayaModel(text, ruleFlags) {
  return evaluateVegaModel(text, ruleFlags);
}

module.exports = {
  evaluateLayaModel,
  evaluateVegaModel,
  STRUCTURAL_SIGNALS,
  TAXONOMY: VEGA_TAXONOMY,
};
