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
   * Deterministic last-resort engine.
   *
   * Delegates to the shared offline engine in js/fallback-engine.js, which
   * implements the same signal families as the server. It is a genuine copy of
   * extension/fallback-engine.js rather than a re-implementation, because a
   * Chrome extension can only ship files inside extension/ while the deployed
   * site cannot serve /extension/* (vercel.json 404s it).
   * server/test-fallback-parity.js keeps the two behaviourally identical.
   */
  clientSideFallback(text, channel = "email") {
    if (window.RatiodFallback) {
      return window.RatiodFallback.analyze(text);
    }

    // If the shared engine failed to load, fall back to a single combined
    // check so the console still renders something rather than throwing.
    const lower = (text || "").toLowerCase();
    const bad = /urgent|paypa1|secur1ty|m1crosoft|bit\.ly|verify your (password|credentials)|suspended/.test(lower);
    return {
      score: bad ? 82 : 8,
      verdict: bad ? "high_risk" : "safe",
      flags: bad ? [{ span: "combined offline indicator", reason: "Several scam indicators matched at once", type: "rule" }] : [],
      explanation: bad
        ? "Offline analysis flagged several scam indicators while the engine was unreachable."
        : "Offline analysis found no strong scam indicators. This is a reduced check, not a full analysis.",
      next_steps: ["Do not click links or provide credentials.", "Verify sender details through an official channel."],
      privacy: { phones_masked: 0, emails_masked: 0, otp_masked: 0 },
      engine: { rules: "offline-fallback-last-ditch", model_source: "offline_fallback_heuristic", degraded: true }
    };
  }
};
