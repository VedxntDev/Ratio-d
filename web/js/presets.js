/**
 * Ratio'd Telemetry Presets
 */

window.Presets = {
  phishingEmail: {
    channel: "email",
    title: "Spoofed PayPal Email (Phishing)",
    text: `From: security-alert@paypa1-security.com
Subject: URGENT: Your PayPal Account Has Been Suspended

Dear Customer,

We detected unauthorized login activity on your account. Your account has been temporarily locked to protect your funds.

Click here immediately within 24 hours to restore your account:
https://paypa1-security.com/restore-login

If you fail to verify your password and identity within 24 hours, your account will be permanently deactivated and legal action may be taken.

Sincerely,
PayPal Security Team
Support Phone: +1 (800) 555-0199`
  },

  urgentSms: {
    channel: "sms",
    title: "Urgent SMS Delivery Scam",
    text: `USPS ALERT: Your parcel #892019 could not be delivered due to an invalid address fee of $1.50. Update immediately within 2 hours or your item will be returned to sender: http://bit.ly/usps-track-991`
  },

  legitimateNotice: {
    channel: "email",
    title: "Legitimate Flight Confirmation",
    text: `From: updates@airline-tickets.com
Subject: Your Flight Itinerary Confirmation #AB9201

Thank you for booking with Us. Your flight #UA482 from SFO to JFK is confirmed for October 12, 2026.

You can check in online 24 hours prior to departure on our official mobile app.

Safe travels!`
  }
};
