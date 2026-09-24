/**
 * Ratio'd Client-Side PII Redactor
 * Redacts PII locally in the browser before payload transmission.
 */

window.Redactor = {
  redact(text) {
    if (!text || typeof text !== "string") {
      return {
        redactedText: "",
        stats: { phones_masked: 0, emails_masked: 0, otp_masked: 0, total_masked: 0 }
      };
    }

    let phonesCount = 0;
    let emailsCount = 0;
    let otpCount = 0;

    // 1. Phone number masking
    const phoneRegex = /(\+?\d{1,3}[\s-]?)?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}\b/g;
    let redacted = text.replace(phoneRegex, (match) => {
      phonesCount++;
      return "[PHONE_REDACTED]";
    });

    // 2. Email address masking
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    redacted = redacted.replace(emailRegex, (match) => {
      emailsCount++;
      return "[EMAIL_REDACTED]";
    });

    // 3. OTP / verification code masking
    const otpRegex = /\b(OTP|code|passcode|PIN)?\s?:?\s?(\d{4,8})\b/gi;
    redacted = redacted.replace(otpRegex, (match, prefix, digits) => {
      otpCount++;
      return (prefix ? prefix + " " : "") + "[OTP_REDACTED]";
    });

    const totalMasked = phonesCount + emailsCount + otpCount;

    return {
      redactedText: redacted,
      stats: {
        phones_masked: phonesCount,
        emails_masked: emailsCount,
        otp_masked: otpCount,
        total_masked: totalMasked
      }
    };
  }
};
