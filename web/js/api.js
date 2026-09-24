/**
 * Ratio'd API Client (Matches Part A.5 Contract)
 */

window.ApiClient = {
  async analyze(text, channel = "email") {
    try {
      const response = await fetch("http://127.0.0.1:3000/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          channel
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (err) {
      console.warn("[API CLIENT] Backend server unreachable. Executing client-side fallback engine:", err.message);
      return this.clientSideFallback(text, channel);
    }
  },

  clientSideFallback(text, channel) {
    const flags = [];
    let score = 15;

    const lower = text.toLowerCase();

    if (lower.includes("urgent") || lower.includes("within 24 hours") || lower.includes("immediately")) {
      flags.push({ span: "urgent / time-limit", reason: "Time pressure indicator", type: "rule" });
      score += 35;
    }

    if (lower.includes("paypa1") || lower.includes("secur1ty") || lower.includes("bit.ly")) {
      flags.push({ span: "spoofed link/domain", reason: "Lookalike or obfuscated link", type: "rule" });
      score += 40;
    }

    if (lower.includes("password") || lower.includes("otp") || lower.includes("suspended")) {
      flags.push({ span: "credential request", reason: "Harvesting attempt signal", type: "rule" });
      score += 25;
    }

    const finalScore = Math.min(100, score);
    let verdict = "safe";
    if (finalScore >= 66) verdict = "high_risk";
    else if (finalScore >= 26) verdict = "suspicious";

    const phonesMatch = text.match(/\[PHONE_REDACTED\]/g);
    const emailsMatch = text.match(/\[EMAIL_REDACTED\]/g);
    const otpMatch = text.match(/\[OTP_REDACTED\]/g);

    return {
      score: finalScore,
      verdict,
      flags,
      explanation: `Analysis completed via browser engine. Found ${flags.length} potential threat indicators.`,
      next_steps: [
        "Do not click links or provide credentials.",
        "Verify sender details independently."
      ],
      privacy: {
        phones_masked: phonesMatch ? phonesMatch.length : 0,
        emails_masked: emailsMatch ? emailsMatch.length : 0,
        otp_masked: otpMatch ? otpMatch.length : 0
      }
    };
  }
};
