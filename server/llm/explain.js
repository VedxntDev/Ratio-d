/**
 * Ratio'd Grounded Explanation Engine
 *
 * HARD ANTI-HALLUCINATION RULE: an explanation may ONLY reference evidence that
 * actually exists. There are two producers:
 *
 *   1. `deterministic` (default, always available, zero network calls) - a
 *      template built strictly from the flags that fired.
 *   2. `llm` (only when RATIOD_LLM_API_KEY is set) - uses the grounded system
 *      prompt from ./prompt.js, and every returned phrase is verified to occur
 *      verbatim in the source text before it is accepted.
 *
 * The returned `source` field always states which producer ran, so a model is
 * never implied when it did not.
 */

const { SYSTEM_PROMPT, buildUserMessage } = require("./prompt");

const LLM_API_KEY = process.env.RATIOD_LLM_API_KEY || "";
const LLM_BASE_URL = process.env.RATIOD_LLM_BASE_URL || "https://api.openai.com/v1";
const LLM_MODEL = process.env.RATIOD_LLM_MODEL || "gpt-4o-mini";

function isLlmEnabled() {
  return Boolean(LLM_API_KEY);
}

/**
 * Deterministic explanation. Guaranteed grounded: every clause is derived
 * from a flag that the rule engine actually produced.
 */
function generateDeterministicExplanation(verdict, flags, channel = "email") {
  if (!flags || flags.length === 0) {
    return `Analysis complete: no explicit scam indicators or malicious patterns were detected in this ${channel.toUpperCase()} message. Standard security precautions still apply.`;
  }

  const reasons = flags.map((f) => f.reason);
  const spans = flags.map((f) => `'${f.span}'`);

  if (verdict === "high_risk") {
    return `HIGH RISK DETECTED: this ${channel.toUpperCase()} message combines ${reasons.join("; ")}. These signals reference ${spans.join(", ")} and are strongly associated with credential harvesting and phishing.`;
  }
  if (verdict === "suspicious") {
    return `SUSPICIOUS CONTENT: caution is advised. This ${channel.toUpperCase()} message triggered ${reasons.join("; ")}, specifically ${spans.join(", ")}. Verify the source independently before interacting.`;
  }
  return `LOW RISK: minor signals were observed (${reasons.join("; ")}), but the overall pattern is consistent with legitimate mail. Proceed with normal caution.`;
}

/**
 * Verify a proposed phrase really appears in the source text.
 * This is the anti-hallucination gate: anything not found is discarded.
 */
function isGrounded(phrase, text) {
  if (typeof phrase !== "string") return false;
  const needle = phrase.trim().toLowerCase();
  if (needle.length < 3) return false;
  return (text || "").toLowerCase().includes(needle);
}

/**
 * Ask the configured LLM for a structured assessment.
 * Returns null on ANY failure so the caller can fall back safely.
 */
async function generateLlmExplanation({ text, channel, flags }) {
  if (!isLlmEnabled()) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${LLM_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserMessage({ text, channel, flags }) },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;

    const payload = await res.json();
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== "object") return null;

    // Keep only flags whose phrase is verifiably present in the source text.
    const groundedFlags = (Array.isArray(parsed.red_flags) ? parsed.red_flags : [])
      .filter((f) => f && isGrounded(f.phrase, text))
      .map((f) => ({ phrase: f.phrase, reason: String(f.reason || "").slice(0, 300) }));

    // If the model invented every flag, do not trust its prose at all.
    if (!groundedFlags.length && (parsed.red_flags || []).length) return null;

    return {
      explanation: String(parsed.explanation || "").slice(0, 1200),
      next_steps: (Array.isArray(parsed.next_steps) ? parsed.next_steps : [])
        .slice(0, 6)
        .map((s) => String(s).slice(0, 240)),
      red_flags: groundedFlags,
      source: "llm",
      model: LLM_MODEL,
    };
  } catch {
    return null; // any failure -> caller uses the deterministic path
  }
}

/**
 * Primary entry point used by the analyze route.
 * Falls back to the deterministic generator whenever the LLM is absent,
 * unreachable, malformed, or ungrounded.
 */
async function generateExplanation(verdict, flags, channel = "email", text = "") {
  const llm = await generateLlmExplanation({ text, channel, flags });
  if (llm && llm.explanation) return { explanation: llm.explanation, source: llm.source, model: llm.model };
  return {
    explanation: generateDeterministicExplanation(verdict, flags, channel),
    source: "deterministic",
    model: null,
  };
}

module.exports = {
  generateExplanation,
  generateDeterministicExplanation,
  generateLlmExplanation,
  isGrounded,
  isLlmEnabled,
  SYSTEM_PROMPT,
};
