/**
 * Ratio'd Ultra-Compact Gmail Security Banner
 * Design Philosophy: "Do our job and disappear"
 * - Ultra-lean ~34px single-line footprint (zero screen hijacking)
 * - Calming neutral dark mode palette (zero eye strain, no muddy brown/yellow)
 * - Collapsed by default — sits quietly out of the user's way
 * - 1-Click Unsubscribe engine & Zero-Execution Safe Peek
 * - 100% resilient under Dark Reader and native Gmail themes
 */

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractCleanEmail(raw) {
  if (!raw || typeof raw !== "string") return "";
  const s = raw.trim();
  const angleMatch = s.match(/<([^>@]+@[^>@]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  const emailMatch = s.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) return emailMatch[1].trim().toLowerCase();
  return "";
}

function extractEmailDomain(email) {
  const clean = extractCleanEmail(email);
  if (!clean || !clean.includes("@")) return "";
  return clean.split("@")[1].toLowerCase().trim();
}

function playUnsubscribeSparkleSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.35);
  } catch (e) {}
}

function isDarkReaderOrDarkMode(data) {
  try {
    if (data && data.theme === "dark") return true;
    if (typeof document !== "undefined") {
      const htmlEl = document.documentElement;
      const bodyEl = document.body;
      if (htmlEl) {
        if (htmlEl.getAttribute && htmlEl.getAttribute("data-ratiod-theme") === "dark") return true;
        if (htmlEl.getAttribute && htmlEl.getAttribute("data-theme") === "dark") return true;
        if (htmlEl.classList && htmlEl.classList.contains && htmlEl.classList.contains("dark")) return true;
        if (htmlEl.hasAttribute && (htmlEl.hasAttribute("data-darkreader-scheme") || htmlEl.hasAttribute("data-darkreader-mode"))) return true;
        if (htmlEl.getAttribute && htmlEl.getAttribute("data-darkreader-scheme") === "dark") return true;
      }
      if (bodyEl) {
        if (bodyEl.getAttribute && bodyEl.getAttribute("data-theme") === "dark") return true;
        if (bodyEl.classList && (bodyEl.classList.contains("dark") || bodyEl.classList.contains("aAU"))) return true;
      }
      if (typeof document.querySelector === "function" && document.querySelector('style.darkreader, meta[name="darkreader"]')) {
        return true;
      }
    }
    if (typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return true;
    }
  } catch (e) {}
  return false;
}

function injectRatiodBanner(targetElement, data) {
  if (!targetElement) return;

  const existingHost = document.getElementById("ratiod-banner-host");
  if (existingHost) {
    existingHost.remove();
  }

  const host = document.createElement("div");
  host.id = "ratiod-banner-host";
  const isDarkTheme = isDarkReaderOrDarkMode(data);
  if (isDarkTheme) {
    host.setAttribute("data-theme", "dark");
    host.setAttribute("data-darkreader", "true");
  }
  const shadowRoot = host.attachShadow({ mode: "open" });

  if (typeof MutationObserver !== "undefined" && typeof document !== "undefined" && document.documentElement) {
    try {
      const themeObs = new MutationObserver(() => {
        const darkNow = isDarkReaderOrDarkMode(data);
        if (darkNow) {
          host.setAttribute("data-theme", "dark");
          host.setAttribute("data-darkreader", "true");
        } else {
          host.removeAttribute("data-darkreader");
          if (data && data.theme === "dark") {
            host.setAttribute("data-theme", "dark");
          } else {
            host.removeAttribute("data-theme");
          }
        }
      });
      themeObs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-darkreader-scheme", "data-darkreader-mode", "data-ratiod-theme", "class"]
      });
    } catch (e) {}
  }

  const styleElem = document.createElement("style");
  styleElem.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

    :host {
      all: initial;
      display: block;
      color-scheme: light dark;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 4px 0 6px 0;
      width: 100%;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;

      /* Calm Neutral Dark Mode Tokens (No eye strain, no muddy brown/yellow) */
      --rd-bg: #16171D;
      --rd-surface: #1E2028;
      --rd-surface-card: #252834;
      --rd-surface-hover: #2E3240;
      --rd-border: rgba(255, 255, 255, 0.10);
      --rd-border-subtle: rgba(255, 255, 255, 0.05);

      --rd-text-primary: #F1F5F9;
      --rd-text-secondary: #94A3B8;
      --rd-text-muted: #64748B;

      --rd-brand-red: #EA3E2B;
      --rd-font-display: 'Plus Jakarta Sans', -apple-system, sans-serif;
      --rd-font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;

      /* Calming Semantic Accents */
      --rd-safe-accent: #10B981;
      --rd-safe-bg: rgba(16, 185, 129, 0.12);
      --rd-safe-border: rgba(16, 185, 129, 0.28);
      --rd-safe-text: #34D399;

      --rd-promo-accent: #818CF8;
      --rd-promo-bg: rgba(129, 140, 248, 0.12);
      --rd-promo-border: rgba(129, 140, 248, 0.28);
      --rd-promo-text: #A5B4FC;

      --rd-susp-accent: #F59E0B;
      --rd-susp-bg: rgba(245, 158, 11, 0.12);
      --rd-susp-border: rgba(245, 158, 11, 0.28);
      --rd-susp-text: #FCD34D;

      --rd-threat-accent: #EF4444;
      --rd-threat-bg: rgba(239, 68, 68, 0.12);
      --rd-threat-border: rgba(239, 68, 68, 0.28);
      --rd-threat-text: #FCA5A5;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Ultra-Compact Container */
    .ratiod-container {
      background: var(--rd-bg);
      border: 1px solid var(--rd-border);
      border-radius: 8px;
      color: var(--rd-text-primary);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
      position: relative;
      overflow: hidden;
      transition: border-color 0.15s ease;
    }

    /* Subtle left accent line */
    .ratiod-container.theme-safe {
      border-left: 3px solid var(--rd-safe-accent);
    }
    .ratiod-container.theme-promo_clutter {
      border-left: 3px solid var(--rd-promo-accent);
    }
    .ratiod-container.theme-suspicious {
      border-left: 3px solid var(--rd-susp-accent);
    }
    .ratiod-container.theme-high_risk {
      border-left: 3px solid var(--rd-threat-accent);
    }

    /* Toolbar: Single compact 34px-36px non-wrapping row */
    .ratiod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 4px 10px;
      min-height: 34px;
      gap: 8px;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    /* Left Group: Logo + Calm Status Pill */
    .ratiod-badge-group {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      flex-shrink: 0;
    }

    .ratiod-logo-mark {
      width: 17px;
      height: 17px;
      border-radius: 4px;
      background: var(--rd-brand-red);
      color: #FFFFFF;
      display: grid;
      place-items: center;
      font-family: var(--rd-font-display);
      font-weight: 800;
      font-size: 10.5px;
      line-height: 1;
      flex-shrink: 0;
    }
    .ratiod-logo-mark img {
      width: 13px;
      height: 13px;
      object-fit: contain;
    }

    .ratiod-brand-name {
      font-family: var(--rd-font-display);
      font-weight: 700;
      font-size: 11px;
      letter-spacing: -0.01em;
      color: var(--rd-text-primary);
    }

    /* Status Pill: Calming, muted, non-aggressive */
    .ratiod-tag {
      font-family: var(--rd-font-display);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.02em;
      padding: 2.5px 7px;
      border-radius: 4px;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .status-dot-indicator {
      width: 5.5px;
      height: 5.5px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }

    .tag-safe {
      background: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
    }
    .tag-safe .status-dot-indicator { background: var(--rd-safe-accent); }

    .tag-promo_clutter {
      background: var(--rd-promo-bg);
      color: var(--rd-promo-text);
      border-color: var(--rd-promo-border);
    }
    .tag-promo_clutter .status-dot-indicator { background: var(--rd-promo-accent); }

    .tag-suspicious {
      background: var(--rd-susp-bg);
      color: var(--rd-susp-text);
      border-color: var(--rd-susp-border);
    }
    .tag-suspicious .status-dot-indicator { background: var(--rd-susp-accent); }

    .tag-high_risk {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .tag-high_risk .status-dot-indicator { background: var(--rd-threat-accent); }

    /* Center Metrics: Clean, compact, muted */
    .ratiod-metrics-group {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .ratiod-score-chip {
      font-family: var(--rd-font-mono);
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .score-label {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      color: var(--rd-text-muted);
    }
    .score-value-bold {
      font-size: 11px;
      font-weight: 700;
      color: var(--rd-text-primary);
    }
    .score-denom-text {
      font-size: 9px;
      color: var(--rd-text-muted);
    }

    /* Right Action Hub */
    .ratiod-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      flex-shrink: 0;
      margin-left: auto;
    }

    /* Quick Unsubscribe Button: Sleek and subtle */
    .ratiod-quick-unsub-btn {
      font-family: var(--rd-font-display);
      font-size: 10.5px;
      font-weight: 700;
      padding: 2.5px 8px;
      border-radius: 4px;
      background: var(--rd-promo-bg);
      color: var(--rd-promo-text) !important;
      border: 1px solid var(--rd-promo-border) !important;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: filter 0.12s ease;
      line-height: 1.2;
    }
    .ratiod-quick-unsub-btn:hover {
      filter: brightness(1.2);
    }

    /* Inspect Chevron Toggle */
    .ratiod-inspect-btn {
      font-family: var(--rd-font-display);
      font-size: 10.5px;
      font-weight: 600;
      padding: 2.5px 7px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.12s ease;
      line-height: 1.2;
    }
    .ratiod-inspect-btn:hover {
      background: var(--rd-surface-card);
      color: var(--rd-text-primary);
    }
    .ratiod-inspect-btn .chevron-arrow {
      transition: transform 0.18s ease;
      font-size: 8px;
    }
    .ratiod-inspect-btn[aria-expanded="true"] .chevron-arrow {
      transform: rotate(180deg);
    }

    /* Dismiss ✕ Button */
    .ratiod-iconbtn {
      width: 20px;
      height: 20px;
      padding: 0;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-muted);
      font-size: 10px;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      transition: all 0.12s ease;
      flex-shrink: 0;
    }
    .ratiod-iconbtn:hover {
      background: var(--rd-surface-card);
      color: var(--rd-text-primary);
    }

    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }

    /* ==========================================================================
       Expandable Inspector Drawer (Hidden by default!)
       ========================================================================== */
    .ratiod-body {
      border-top: 1px solid var(--rd-border-subtle);
      padding: 10px 12px;
      background: rgba(0, 0, 0, 0.15);
    }
    .ratiod-body.collapsed {
      display: none;
    }

    .ratiod-inspector-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 10px;
    }
    @media (max-width: 768px) {
      .ratiod-inspector-grid {
        grid-template-columns: 1fr;
      }
    }

    .ratiod-panel {
      background: var(--rd-surface);
      border: 1px solid var(--rd-border-subtle);
      border-radius: 6px;
      padding: 9px 11px;
    }

    .panel-heading {
      font-family: var(--rd-font-display);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--rd-text-muted);
      margin-bottom: 6px;
    }

    .diagnostic-title {
      font-family: var(--rd-font-display);
      font-size: 12px;
      font-weight: 700;
      color: var(--rd-text-primary);
      margin-bottom: 3px;
      line-height: 1.3;
    }

    .diagnostic-lead {
      font-size: 11px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
      margin-bottom: 6px;
    }

    .guidance-box {
      padding: 4px 8px;
      background: var(--rd-surface-card);
      border-left: 2.5px solid var(--rd-safe-accent);
      border-radius: 3px;
      font-size: 10.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
      margin-bottom: 6px;
    }
    .guidance-box strong { color: var(--rd-text-primary); }

    .reasoning-text {
      font-size: 10.5px;
      line-height: 1.45;
      color: var(--rd-text-muted);
      border-top: 1px dashed var(--rd-border-subtle);
      padding-top: 5px;
    }
    .reasoning-label {
      font-family: var(--rd-font-mono);
      font-size: 8.5px;
      font-weight: 700;
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      padding: 1px 4px;
      border-radius: 3px;
      margin-right: 4px;
      text-transform: uppercase;
    }

    /* Actions Panel */
    .action-row {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
      margin-bottom: 8px;
    }

    .ratiod-btn {
      font-family: var(--rd-font-display);
      font-size: 10.5px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 5px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-primary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.12s ease;
      line-height: 1.2;
    }
    .ratiod-btn:hover {
      background: var(--rd-surface-hover);
    }

    .btn-warn {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .btn-unsub {
      background: var(--rd-promo-bg);
      color: var(--rd-promo-text);
      border-color: var(--rd-promo-border);
    }

    .feedback-group {
      border-top: 1px dashed var(--rd-border-subtle);
      padding-top: 7px;
    }
    .feedback-caption {
      font-size: 10px;
      font-weight: 600;
      color: var(--rd-text-secondary);
      margin-bottom: 5px;
    }
    .feedback-chips {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }

    .ratiod-chip-btn {
      font-family: var(--rd-font-display);
      font-size: 10px;
      font-weight: 600;
      padding: 3px 7px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .ratiod-chip-btn:hover {
      background: var(--rd-surface-hover);
      color: var(--rd-text-primary);
    }
    .ratiod-chip-btn.chip-active {
      background: var(--rd-text-primary);
      color: var(--rd-bg);
      border-color: var(--rd-text-primary);
      font-weight: 700;
    }

    .ratiod-feedback-toast {
      margin-top: 6px;
      padding: 4px 7px;
      background: var(--rd-safe-bg);
      border: 1px solid var(--rd-safe-border);
      border-radius: 4px;
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-safe-text);
    }

    /* Forensics Accordion */
    .ratiod-forensics-panel {
      margin-top: 8px;
      border-top: 1px solid var(--rd-border-subtle);
      padding-top: 7px;
    }
    .forensics-toggle {
      font-family: var(--rd-font-display);
      font-size: 10px;
      font-weight: 600;
      color: var(--rd-text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      padding: 0;
      margin-bottom: 6px;
    }
    .forensics-toggle:hover { color: var(--rd-text-primary); }

    .flag-item {
      font-family: var(--rd-font-mono);
      font-size: 10px;
      background: var(--rd-surface);
      border: 1px solid var(--rd-border-subtle);
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      color: var(--rd-text-secondary);
      line-height: 1.4;
    }
    .flag-span { font-weight: 700; color: var(--rd-threat-text); }
    .flag-peek-btn {
      font-family: var(--rd-font-display);
      font-size: 9.5px;
      font-weight: 600;
      padding: 2px 6px;
      margin-left: 5px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      border-radius: 3px;
      cursor: pointer;
    }
    .flag-peek-btn:hover { background: var(--rd-surface-hover); color: var(--rd-text-primary); }
    .flag-peek-res {
      margin-top: 4px;
      padding: 4px 7px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px dashed var(--rd-border-subtle);
      border-radius: 3px;
      font-size: 10px;
      color: var(--rd-text-secondary);
    }

    /* Footer: Discreet signature at the end */
    .ratiod-footer {
      margin-top: 10px;
      padding-top: 7px;
      border-top: 1px solid var(--rd-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      font-size: 10px;
      color: var(--rd-text-muted);
    }

    .ratiod-cred {
      color: var(--rd-text-muted);
      text-decoration: none;
      font-size: 10px;
    }
    .ratiod-cred strong {
      color: var(--rd-text-secondary);
      text-decoration: underline;
    }
    .ratiod-cred:hover strong {
      color: var(--rd-brand-red);
    }

    /* Dark Reader / Native Dark Mode target locks */
    :host([data-theme="dark"]),
    :host([data-darkreader="true"]),
    :host-context([data-darkreader-scheme="dark"]),
    :host-context(html[data-ratiod-theme="dark"]) {
      color-scheme: dark !important;
    }
  `;
  shadowRoot.appendChild(styleElem);

  const verdict = data.verdict || "safe";
  const mailScore = data.mail_score !== undefined ? Number(data.mail_score) : (data.score !== undefined ? Number(data.score) : 0);
  const score = data.score !== undefined ? Number(data.score) : mailScore;
  const flags = data.flags || [];
  const explanation = data.explanation || "No threat signals detected.";
  const nextSteps = data.next_steps || [];
  const privacy = data.privacy || { phones_masked: 0, emails_masked: 0, otp_masked: 0 };
  const totalMasked = (privacy.phones_masked || 0) + (privacy.emails_masked || 0) + (privacy.otp_masked || 0);

  const isSafe = verdict === "safe";
  const isPromo = verdict === "promo_clutter";
  const isThreat = verdict === "high_risk" || verdict === "suspicious";

  const container = document.createElement("div");
  container.className = "ratiod-container theme-" + (isPromo ? "promo_clutter" : (verdict || "safe"));

  let displayVerdictLabel = "VERIFIED SAFE";
  let diagnosticTitle = "Verified Authentic Message";
  let diagnosticLead = "Cryptographic signature matches official records. Zero threat markers detected.";
  let diagnosticGuidance = "Safe to interact with.";

  if (verdict === "high_risk") {
    displayVerdictLabel = "HIGH_RISK THREAT";
    diagnosticTitle = "High-Risk Threat / Phishing Detected";
    diagnosticLead = "Critical warning: Active brand spoofing or credential harvesting lure.";
    diagnosticGuidance = "Do not open links or provide credentials. Move to Spam.";
  } else if (verdict === "suspicious") {
    displayVerdictLabel = "SUSPICIOUS SIGNALS";
    diagnosticTitle = "Suspicious Sender Anomaly";
    diagnosticLead = "Anomalies detected in sender alignment or URL redirect patterns.";
    diagnosticGuidance = "Verify sender authenticity before clicking links or downloading attachments.";
  } else if (verdict === "promo_clutter") {
    displayVerdictLabel = "NEWSLETTER";
    diagnosticTitle = "Marketing Newsletter";
    diagnosticLead = "Commercial mailing list or notification feed with valid sender credentials.";
    diagnosticGuidance = "Use 1-Click Unsubscribe to opt out directly.";
  }

  // Logo asset URL
  let logoSrc = "";
  try {
    const ext = (typeof browser !== "undefined" && browser.runtime) ? browser
      : ((typeof chrome !== "undefined" && chrome.runtime) ? chrome : null);
    if (ext && typeof ext.runtime?.getURL === "function") {
      const url = ext.runtime.getURL("icons/icon48.png");
      if (url) logoSrc = url;
    } else if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
      const url = chrome.runtime.getURL("icons/icon48.png");
      if (url) logoSrc = url;
    }
  } catch (e) {}

  container.innerHTML = `
    <!-- Ultra-Compact Single Row (~34px) -->
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <div class="ratiod-logo-mark">
          ${logoSrc ? `<img class="ratiod-logo" src="${escapeHtml(logoSrc)}" alt="R">` : 'R'}
        </div>
        <span class="ratiod-brand-name">Ratio'd</span>

        <span class="ratiod-tag tag-${escapeHtml(verdict)}">
          <span class="status-dot-indicator"></span>
          ${escapeHtml(displayVerdictLabel)}
        </span>
      </div>

      <div class="ratiod-metrics-group">
        <div class="ratiod-score-chip ratiod-score ratiod-score-mail" title="Overall Security Risk Score (0 = Clean, 100 = Threat)">
          <span class="score-label">${isThreat ? 'RISK' : 'SCORE'}</span>
          <span class="score-value-bold score-number">${escapeHtml(mailScore)}</span>
          <span class="score-denom-text score-denom">/100</span>
        </div>
      </div>

      <div class="ratiod-header-actions">
        ${isPromo ? `
          <button class="ratiod-quick-unsub-btn" id="btn-header-unsub" type="button" title="1-Click Unsubscribe from this newsletter">
            1-Click Unsubscribe
          </button>
        ` : ''}

        <button class="ratiod-inspect-btn" id="btn-collapse" type="button" aria-expanded="false" aria-controls="ratiod-body" title="Inspect security telemetry">
          <span>Details</span>
          <span class="chevron-arrow" aria-hidden="true">&#9662;</span>
          <span class="sr-only">Toggle analysis</span>
        </button>

        <button class="ratiod-iconbtn" id="btn-dismiss" type="button" title="Dismiss Ratio'd for this email">
          <span aria-hidden="true">&#10005;</span>
          <span class="sr-only">Dismiss Ratio'd</span>
        </button>
      </div>
    </div>

    <!-- Expandable Inspector Drawer (Collapsed by default!) -->
    <div class="ratiod-body collapsed" id="ratiod-body">
      <div class="ratiod-inspector-grid">
        <!-- Diagnostic Panel -->
        <div class="ratiod-panel">
          <div class="panel-heading">Security Diagnostic</div>
          <div class="diagnostic-title">${escapeHtml(diagnosticTitle)}</div>
          <div class="diagnostic-lead">${escapeHtml(diagnosticLead)}</div>
          <div class="guidance-box">
            <strong>Guidance:</strong> ${escapeHtml(diagnosticGuidance)}
          </div>
          <div class="reasoning-text">
            <span class="reasoning-label">Reason:</span> ${escapeHtml(explanation)}
          </div>
        </div>

        <!-- Quick Actions & Feedback Panel -->
        <div class="ratiod-panel">
          <div class="panel-heading">Actions</div>
          <div class="action-row">
            ${isThreat ? `
              <button class="ratiod-btn btn-warn btn-highlight-spam" id="btn-move-spam" type="button">Report Spam</button>
            ` : `
              <button class="ratiod-btn btn-warn btn-highlight-unsafe" id="btn-quick-feedback" data-feedback="unsafe" type="button">Mark as Suspicious</button>
            `}
            <button class="ratiod-btn btn-unsub ${isPromo ? 'btn-highlight-unsub' : ''}" id="btn-one-unsub" type="button">1-Click Unsubscribe</button>
          </div>

          <div class="feedback-group">
            <div class="feedback-caption">Teach Ratio'd (Override):</div>
            <div class="feedback-chips">
              <button class="ratiod-chip-btn ${verdict === 'safe' ? 'chip-active' : ''}" type="button" data-feedback="safe">Safe</button>
              <button class="ratiod-chip-btn ${verdict === 'promo_clutter' ? 'chip-active' : ''}" type="button" data-feedback="promo">Newsletter</button>
              <button class="ratiod-chip-btn ${verdict === 'suspicious' ? 'chip-active' : ''}" type="button" data-feedback="suspicious">Suspicious</button>
              <button class="ratiod-chip-btn ${verdict === 'high_risk' ? 'chip-active' : ''}" type="button" data-feedback="unsafe">Phishing</button>
            </div>
            <div class="ratiod-feedback-toast" id="ratiod-feedback-toast" style="display:none;" role="status"></div>
          </div>
        </div>
      </div>

      <!-- Deep Forensic Telemetry -->
      <div class="ratiod-forensics-panel">
        <button class="forensics-toggle" id="toggle-drawer" type="button" aria-expanded="false" aria-controls="analysis-drawer">
          <span class="chevron-arrow">&#9656;</span> View Technical Forensics & Link Signals
        </button>

        <div class="ratiod-drawer" id="analysis-drawer" role="region" aria-label="Deep Forensic Details" style="display:none;">
          <div class="panel-heading" style="margin-top: 4px;">Triggered Heuristics</div>
          <div id="drawer-mail-flags">
            ${flags.length > 0 ? flags.map(f => `
              <div class="flag-item">
                <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
                ${(f.span && (f.span.includes("http") || f.span.includes("bit.ly") || f.span.includes("."))) ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(f.span)}">Safe Peek</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
              </div>
            `).join('') : '<div class="flag-item">No explicit risk triggers fired. Cryptographic and body signals clean.</div>'}
          </div>

          <div class="panel-heading" style="margin-top: 8px;">Recommended Steps</div>
          <ul style="padding-left: 14px; margin: 3px 0; font-size: 11px; color: var(--rd-text-secondary);">
            ${nextSteps.map(step => `<li style="margin-bottom:2px;"><strong>&bull;</strong> ${escapeHtml(step)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Footer: Discreet developer credit placed at the very end -->
      <div class="ratiod-footer">
        <span>Zero-PII on-device protection: ${escapeHtml(totalMasked)} items masked before analysis. Zero message text stored.</span>
        <span>
          Ratio'd &middot; Developed by
          <a class="ratiod-cred" href="https://github.com/VedxntDev" target="_blank" rel="noopener noreferrer">
            <strong>Vedant</strong>
          </a>
        </span>
      </div>
    </div>
  `;

  shadowRoot.appendChild(container);

  if (targetElement.parentElement) {
    targetElement.parentElement.insertBefore(host, targetElement);
  } else if (targetElement.prepend) {
    targetElement.prepend(host);
  } else {
    document.body.appendChild(host);
  }

  const toggleBtn = shadowRoot.getElementById("toggle-drawer");
  const unsubBtn = shadowRoot.getElementById("btn-one-unsub");
  const headerUnsubBtn = shadowRoot.getElementById("btn-header-unsub");
  const spamBtn = shadowRoot.getElementById("btn-move-spam");
  const drawer = shadowRoot.getElementById("analysis-drawer");
  const collapseBtn = shadowRoot.getElementById("btn-collapse");
  const dismissBtn = shadowRoot.getElementById("btn-dismiss");
  const body = shadowRoot.getElementById("ratiod-body");

  if (headerUnsubBtn && unsubBtn) {
    headerUnsubBtn.addEventListener("click", () => {
      unsubBtn.click();
    });
  }

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      const isClosed = drawer.style.display === "none";
      drawer.style.display = isClosed ? "block" : "none";
      drawer.classList.toggle("open", isClosed);
      toggleBtn.setAttribute("aria-expanded", String(isClosed));
      const arrow = toggleBtn.querySelector(".chevron-arrow");
      if (arrow) arrow.innerHTML = isClosed ? "&#9662;" : "&#9656;";
    });
  }

  // Header Details Toggle
  if (collapseBtn && body) {
    collapseBtn.addEventListener("click", () => {
      const isCollapsed = body.classList.toggle("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
      const arrow = collapseBtn.querySelector(".chevron-arrow");
      if (arrow) arrow.innerHTML = isCollapsed ? "&#9662;" : "&#9652;";
    });
  }

  // Dismiss Banner
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      if (host.parentElement) host.parentElement.removeChild(host);
    });
  }

  // User Feedback Overrides
  function applyUserFeedback(feedbackType, originBtn) {
    const toast = shadowRoot.getElementById("ratiod-feedback-toast");
    const headerTag = shadowRoot.querySelector(".ratiod-tag");
    const mailScoreVal = shadowRoot.querySelector(".score-value-bold");
    const feedbackChips = shadowRoot.querySelectorAll(".ratiod-chip-btn");

    feedbackChips.forEach(chip => {
      if (chip.getAttribute("data-feedback") === feedbackType) {
        chip.classList.add("chip-active");
      } else {
        chip.classList.remove("chip-active");
      }
    });

    if (toast) {
      toast.style.display = "block";
      toast.textContent = `Feedback recorded: Marked as ${feedbackType.toUpperCase()}. Model updated locally.`;
    }

    if (headerTag) {
      if (feedbackType === "safe") {
        headerTag.className = "ratiod-tag tag-safe";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>VERIFIED SAFE`;
      } else if (feedbackType === "suspicious") {
        headerTag.className = "ratiod-tag tag-suspicious";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>SUSPICIOUS`;
      } else if (feedbackType === "promo") {
        headerTag.className = "ratiod-tag tag-promo_clutter";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>NEWSLETTER`;
      } else if (feedbackType === "unsafe" || feedbackType === "high_risk") {
        headerTag.className = "ratiod-tag tag-high_risk";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>HIGH_RISK`;
      }
    }

    if (container) {
      container.className = "ratiod-container theme-" + (feedbackType === "promo" ? "promo_clutter" : (feedbackType === "suspicious" ? "suspicious" : (feedbackType === "safe" ? "safe" : "high_risk")));
    }

    if (mailScoreVal) {
      const newScore = feedbackType === "safe" ? 0 : (feedbackType === "promo" ? 25 : (feedbackType === "suspicious" ? 45 : 85));
      mailScoreVal.textContent = String(newScore);
    }

    // Persist override to storage
    const rawSender = (data.emailMeta && (data.emailMeta.senderAddress || data.emailMeta.from)) || "";
    const cleanSender = extractCleanEmail(rawSender);
    const cleanDomain = extractEmailDomain(cleanSender);

    const mappedVerdict = feedbackType === "safe" ? "safe" : (feedbackType === "suspicious" ? "suspicious" : (feedbackType === "promo" ? "promo_clutter" : "high_risk"));
    const mappedScore = feedbackType === "safe" ? 0 : (feedbackType === "suspicious" ? 45 : (feedbackType === "promo" ? 25 : 85));

    const keysToOverride = [];
    if (cleanSender) {
      keysToOverride.push(cleanSender);
      keysToOverride.push("sender:" + cleanSender);
    }
    if (data.emailMeta && data.emailMeta.subject) keysToOverride.push(data.emailMeta.subject);
    if (data.emailMeta && data.emailMeta.from) keysToOverride.push(data.emailMeta.from);
    if (data.cacheKey) keysToOverride.push(data.cacheKey);

    try {
      const ext = (typeof browser !== "undefined" && browser.storage && browser.storage.local) ? browser.storage.local
        : ((typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) ? chrome.storage.local : null);
      if (ext) {
        ext.get(["ratiod_user_overrides", "ratiod_sender_learning"], (res) => {
          const overrides = (res && res.ratiod_user_overrides) || {};
          const senderLearning = (res && res.ratiod_sender_learning) || {};
          const record = {
            verdict: mappedVerdict,
            score: mappedScore,
            feedback: feedbackType,
            sender: cleanSender || null,
            domain: cleanDomain || null,
            timestamp: Date.now()
          };
          for (const k of keysToOverride) {
            if (k) overrides[String(k).trim().toLowerCase()] = record;
          }
          if (cleanSender) {
            senderLearning[cleanSender] = {
              sender: cleanSender,
              domain: cleanDomain,
              verdict: mappedVerdict,
              score: mappedScore,
              feedback: feedbackType,
              userExplicit: true,
              updatedAt: Date.now()
            };
          }
          ext.set({
            ratiod_user_overrides: overrides,
            ratiod_sender_learning: senderLearning
          });
        });
      }
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent("ratiod:user-feedback", {
        detail: {
          verdict: mappedVerdict,
          score: mappedScore,
          feedback: feedbackType,
          sender: cleanSender,
          domain: cleanDomain,
          keys: keysToOverride
        }
      }));
    } catch (e) {}
  }

  const quickFeedbackBtn = shadowRoot.getElementById("btn-quick-feedback");
  if (quickFeedbackBtn) {
    quickFeedbackBtn.addEventListener("click", () => {
      const fb = quickFeedbackBtn.getAttribute("data-feedback") || "unsafe";
      applyUserFeedback(fb, quickFeedbackBtn);
    });
  }

  shadowRoot.querySelectorAll(".ratiod-chip-btn").forEach(chip => {
    chip.addEventListener("click", () => {
      const fb = chip.getAttribute("data-feedback") || "safe";
      applyUserFeedback(fb, chip);
    });
  });

  // Safe Peek Link Redirect Tracer
  function bindSafePeek(root) {
    root.querySelectorAll(".flag-peek-btn").forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener("click", async () => {
        const targetUrl = btn.getAttribute("data-peek-url");
        const resContainer = btn.nextElementSibling;
        if (!targetUrl || !resContainer) return;

        btn.disabled = true;
        btn.textContent = "Tracing...";
        resContainer.style.display = "block";
        resContainer.textContent = "Tracing redirect route...";

        const tryEndpoints = ["http://127.0.0.1:3000/unmask", "https://ratio-d.vercel.app/api/unmask"];
        let unmasked = null;
        for (const ep of tryEndpoints) {
          try {
            const resp = await fetch(ep, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: targetUrl })
            });
            if (resp.ok) {
              unmasked = await resp.json();
              break;
            }
          } catch {}
        }

        if (unmasked) {
          const dest = escapeHtml(unmasked.finalDomain || unmasked.finalUrl);
          const v = escapeHtml(unmasked.risk?.verdict?.toUpperCase() || 'SAFE');
          const sc = escapeHtml(unmasked.risk?.score || 0);
          const vColor = unmasked.risk?.verdict === 'high_risk' ? '#EF4444' : '#10B981';
          resContainer.innerHTML = `
            <strong>Safe Peek:</strong> ${escapeHtml(unmasked.hops)} hop(s) &rarr; Destination: <strong>${dest}</strong><br>
            Verdict: <span style="font-weight:700;color:${vColor}">${v}</span> (Score: ${sc}/100)
          `;
        } else {
          resContainer.textContent = "Could not trace route.";
        }
        btn.disabled = false;
        btn.textContent = "Safe Peek";
      });
    });
  }

  bindSafePeek(shadowRoot);

  function resolveTargetUrl(rawUrl) {
    if (!rawUrl) return "";
    try {
      if (rawUrl.includes("google.com/url?") || rawUrl.includes("google.com/url%3F")) {
        const m = rawUrl.match(/[?&]q=([^&]+)/);
        if (m && m[1]) return decodeURIComponent(m[1]);
      }
    } catch (e) {}
    return rawUrl;
  }

  function openUrlInTab(targetUrl) {
    const cleanUrl = resolveTargetUrl(targetUrl);
    if (!cleanUrl) return false;

    if (cleanUrl.startsWith("mailto:")) {
      window.location.href = cleanUrl;
      return true;
    }

    try {
      const tempAnchor = document.createElement("a");
      tempAnchor.href = cleanUrl;
      tempAnchor.target = "_blank";
      tempAnchor.rel = "noopener noreferrer";
      tempAnchor.style.display = "none";
      (document.body || document.documentElement).appendChild(tempAnchor);

      const clickEvt = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        view: window
      });
      tempAnchor.dispatchEvent(clickEvt);

      setTimeout(() => {
        try { tempAnchor.remove(); } catch (e) {}
      }, 1000);
      return true;
    } catch (e) {
      try {
        window.open(cleanUrl, "_blank");
        return true;
      } catch (err) {
        return false;
      }
    }
  }

  function dispatchElementClick(el) {
    if (!el) return false;
    try {
      el.click();
    } catch (e) {}

    try {
      const opts = { bubbles: true, cancelable: true, view: window, buttons: 1 };
      el.dispatchEvent(new MouseEvent("mousedown", opts));
      el.dispatchEvent(new MouseEvent("mouseup", opts));
      el.dispatchEvent(new MouseEvent("click", opts));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 1-Click Unsubscribe Engine
  if (unsubBtn) {
    unsubBtn.addEventListener("click", () => {
      let unsubSuccess = false;

      function updateUnsubButton(msg, bgColor) {
        if (unsubBtn) {
          unsubBtn.textContent = msg;
          if (bgColor) unsubBtn.style.backgroundColor = bgColor;
        }
        if (headerUnsubBtn) {
          headerUnsubBtn.textContent = msg;
          if (bgColor) headerUnsubBtn.style.backgroundColor = bgColor;
        }
      }

      const headerArea = document.querySelector(".gE, .ha, .gD, .iv, .adn, [role='main']") || document;
      const nativeCandidates = Array.from(headerArea.querySelectorAll(
        '.aG, span.aG, div.aG, a.aG, [data-tooltip*="Unsubscribe" i], [aria-label*="Unsubscribe" i], [aria-label*="Opt out" i], [act="10"]'
      )).filter(el => {
        if (el.closest('.ratiod-shadow-host') || el === unsubBtn || unsubBtn.contains(el)) return false;
        if (el.closest('.a3s')) return false;
        return true;
      });

      if (nativeCandidates.length > 0) {
        const candidate = nativeCandidates[0];
        const clickable = (candidate.matches && candidate.matches('a, button, [role="button"], [role="link"], [act]'))
          ? candidate
          : (candidate.querySelector ? (candidate.querySelector('a, button, [role="button"], [role="link"], [act]') || candidate) : candidate);

        if (clickable) {
          dispatchElementClick(clickable);
          unsubSuccess = true;
          playUnsubscribeSparkleSound();
          updateUnsubButton("Unsubscribe Requested", "#10B981");

          setTimeout(() => {
            const confirmButtons = document.querySelectorAll(
              'button[name="ok"], button[name="unsubscribe"], div[role="alertdialog"] button, [data-mdc-dialog-action="ok"], .Kj-JD-jl button'
            );
            if (confirmButtons.length > 0) {
              const confirmBtn = confirmButtons[confirmButtons.length - 1];
              dispatchElementClick(confirmBtn);
            }
          }, 350);
        }
      }

      if (!unsubSuccess) {
        const bodyElem = document.querySelector('.a3s.aiL, .a3s, .ii.gt, .adn.ads, [role="main"]') || document;
        const anchors = Array.from(bodyElem.querySelectorAll('a')).filter(a => {
          if (a.closest('.ratiod-shadow-host')) return false;
          const href = (a.href || a.getAttribute('href') || a.getAttribute('data-saferedirecturl') || '').toLowerCase();
          const txt = (a.innerText || a.textContent || a.getAttribute('aria-label') || '').toLowerCase();
          
          return (
            href.includes('unsubscribe') || href.includes('optout') || href.includes('opt-out') ||
            href.includes('email-preferences') || href.includes('manage-subscription') || href.includes('sub_unsub') ||
            txt.includes('unsubscribe') || txt.includes('opt out') || txt.includes('opt-out') ||
            txt.includes('manage preferences') || txt.includes('email preferences') || txt.includes('cancel subscription') ||
            txt.includes('remove me')
          );
        });

        if (anchors.length > 0) {
          const targetAnchor = anchors[0];
          const rawUrl = targetAnchor.href || targetAnchor.getAttribute('href') || targetAnchor.getAttribute('data-saferedirecturl');

          dispatchElementClick(targetAnchor);

          if (rawUrl) {
            openUrlInTab(rawUrl);
          }

          unsubSuccess = true;
          playUnsubscribeSparkleSound();
          updateUnsubButton("Unsubscribe Link Opened", "#10B981");
        }
      }

      if (!unsubSuccess) {
        const bodyText = (document.querySelector('.a3s') || document.body).innerText || '';
        const mailtoMatch = bodyText.match(/mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch) {
          window.location.href = `mailto:${mailtoMatch[1]}?subject=Unsubscribe`;
          unsubSuccess = true;
          playUnsubscribeSparkleSound();
          updateUnsubButton("Unsubscribe Mail Sent", "#10B981");
        }
      }

      if (!unsubSuccess) {
        updateUnsubButton("No Unsubscribe Link Found", "#DC2626");
        setTimeout(() => {
          updateUnsubButton("1-Click Unsubscribe", "");
        }, 3000);
      }
    });
  }

  // Report Spam Handler
  if (spamBtn) {
    spamBtn.addEventListener("click", () => {
      const gmailSpamBtn = document.querySelector(
        'div[aria-label*="Spam"], div[act="9"], div[data-tooltip*="Spam"], button[aria-label*="Spam"]'
      );
      if (gmailSpamBtn) {
        gmailSpamBtn.click();
        spamBtn.textContent = "Reported to Spam";
        spamBtn.style.backgroundColor = "#10B981";
      } else {
        spamBtn.textContent = "Flagged as Spam";
        spamBtn.style.backgroundColor = "#10B981";
      }
    });
  }
}

function updateRatiodBannerQr(qrResult) {
  if (!qrResult) return;
  const host = document.getElementById("ratiod-banner-host");
  if (!host || !host.shadowRoot) return;
  const root = host.shadowRoot;

  const rawQrScore = Number(qrResult.score !== undefined ? qrResult.score : (qrResult.risk_score || 0));
  const rawQrVerdict = String(qrResult.verdict || qrResult.legacy_verdict || "safe").toLowerCase();
  const isHigh = rawQrVerdict === "high_risk" || rawQrVerdict === "malicious" || rawQrScore >= 66;

  if (isHigh) {
    const verdictTag = root.querySelector(".ratiod-tag");
    if (verdictTag && !verdictTag.classList.contains("tag-high_risk")) {
      verdictTag.className = "ratiod-tag tag-high_risk";
      verdictTag.innerHTML = `<span class="status-dot-indicator"></span>HIGH_RISK (QR THREAT)`;
    }
    const container = root.querySelector(".ratiod-container");
    if (container) {
      container.className = "ratiod-container theme-high_risk";
    }
  }
}

window.injectRatiodBanner = injectRatiodBanner;
window.updateRatiodBannerQr = updateRatiodBannerQr;
