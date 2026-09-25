/**
 * Ratio'd API Client (Matches Part A.5 Contract)
 *
 * Request:  POST { text, channel }   <-- text is already client-redacted
 * Response: { score, verdict, flags, explanation, next_steps, privacy }
 *
 * Endpoint strategy is environment-aware so localhost and the Vercel
 * deployment behave identically from the user's point of view:
 *   - localhost  -> talk to the local engine on :3000 first
 *   - production -> talk to the same-origin serverless function first
 * A secondary candidate is always tried before giving up, and a final
 * deterministic browser fallback keeps the console usable if both are down.
 */

const LOCAL_API = "http://127.0.0.1:3000/analyze";
const LOCAL_HEALTH = "http://127.0.0.1:3000/health";
const LOCAL_HOSTS = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"];

window.ApiClient = {
  isLocalEnvironment() {
    return LOCAL_HOSTS.includes(window.location.hostname);
  },

  endpoints() {
    const sameOrigin = "/analyze";
    return this.isLocalEnvironment()
      ? [LOCAL_API, sameOrigin]
      : [sameOrigin, LOCAL_API];
  },

  /** Endpoint used by the header connectivity probe. */
  healthEndpoint() {
    return this.isLocalEnvironment() ? LOCAL_HEALTH : "/health";
  },

  /**
   * @param {string} text      Client-redacted message text.
   * @param {string} channel   "email" | "sms".
   * @param {object} [stats]   Client redaction counts. Accepted for call-site
   *                           compatibility only — per Part A.5 the backend
   *                           derives `privacy` from the redacted text itself,
   *                           so the client never transmits PII telemetry.
   */
  async analyze(text, channel = "email", stats) {
    let lastError = null;

    for (const endpoint of this.endpoints()) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, channel })
        });

        if (!response.ok) {
          throw new Error(`${endpoint} returned HTTP ${response.status}`);
        }

        return await response.json();
      } catch (endpointError) {
        lastError = endpointError;
      }
    }

    console.warn(
      "[API CLIENT] No analysis backend reachable; using browser fallback engine.",
      lastError && lastError.message
    );
    return this.clientSideFallback(text, channel);
  },

  /**
   * Deterministic last-resort engine. Mirrors the backend verdict vocabulary
   * (safe / suspicious / high_risk / promo_clutter) so the UI renders normally
   * with no network. Deliberately conservative and clearly labelled.
   */
  clientSideFallback(text, channel = "email") {
    const flags = [];
    let score = 15;
    const lower = (text || "").toLowerCase();

    if (/urgent|within \d+ hours|immediately|expires today|action required/.test(lower)) {
      flags.push({ span: "urgent / time-limit", reason: "Time pressure indicator", type: "rule" });
      score += 35;
    }

    if (/paypa1|secur1ty|m1crosoft|bit\.ly|bitly|\.top\b|\.xyz\b/.test(lower)) {
      flags.push({ span: "spoofed link/domain", reason: "Lookalike or obfuscated link", type: "rule" });
      score += 40;
    }

    if (/password|\botp\b|suspended|verify your credentials/.test(lower)) {
      flags.push({ span: "credential request", reason: "Harvesting attempt signal", type: "rule" });
      score += 25;
    }

    let promoCount = 0;
    if (/unsubscribe|% off|sale|deal of the day/.test(lower)) {
      promoCount++;
      flags.push({ span: "promotional language", reason: "Marketing email signal", type: "promo" });
    }

    const hasSevere = flags.some(f => f.type === "rule" && f.reason.indexOf("spoofed") !== -1);
    if (hasSevere) score = Math.max(score, 82);

    const finalScore = Math.min(100, score);
    let verdict = "safe";
    if (hasSevere || finalScore >= 66) verdict = "high_risk";
    else if (promoCount >= 2 && finalScore < 40) verdict = "promo_clutter";
    else if (finalScore >= 35) verdict = "suspicious";

    const count = (re) => {
      const m = (text || "").match(re);
      return m ? m.length : 0;
    };

    return {
      score: finalScore,
      verdict,
      flags,
      explanation: "Offline browser analysis of this " + String(channel).toUpperCase() +
        " message surfaced " + flags.length + " indicator(s). Treat with caution and verify independently.",
      next_steps: [
        "Do not click links or provide credentials.",
        "Verify sender details through an official channel."
      ],
      privacy: {
        phones_masked: count(/\[PHONE_REDACTED\]/g),
        emails_masked: count(/\[EMAIL_REDACTED\]/g),
        otp_masked: count(/\[OTP_REDACTED\]/g)
      },
      source: "browser_fallback"
    };
  }
};
