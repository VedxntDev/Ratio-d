/**
 * Ratio'd Privacy Telemetry Logger
 * HARD PRIVACY RULE: Never persist raw message content or actual PII values.
 * Only aggregate metadata and redaction counts are logged.
 */

function logPrivacyTelemetry(channel, privacyStats) {
  const timestamp = new Date().toISOString();
  const summary = {
    timestamp,
    channel,
    phones_masked: privacyStats?.phones_masked || 0,
    emails_masked: privacyStats?.emails_masked || 0,
    otp_masked: privacyStats?.otp_masked || 0,
    total_redactions: (privacyStats?.phones_masked || 0) + 
                      (privacyStats?.emails_masked || 0) + 
                      (privacyStats?.otp_masked || 0)
  };

  console.log(`[PRIVACY LOG] Telemetry captured at ${timestamp}:`, JSON.stringify(summary));
  return summary;
}

module.exports = { logPrivacyTelemetry };
