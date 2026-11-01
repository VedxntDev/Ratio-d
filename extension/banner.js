/**
 * Ratio'd Shadow DOM Banner Injector for Gmail
 * Features:
 * - Isolated Shadow DOM Developer-Grade Security Banner
 * - One-Click Unsubscribe Engine
 * - Zero-PII Redacted Telemetry & Continuous Sender Learning
 * - Native Dark Reader & System Dark Mode Compatibility
 */

/** True when the OS requests reduced motion. */
function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (e) {
    return false;
  }
}

/**
 * Escape text before it goes anywhere near innerHTML.
 *
 * The banner runs inside a content script on mail.google.com and interpolates
 * attacker-controlled data: `flags[].span` is a substring of the email body,
 * and `explanation` can be LLM-generated. Without escaping, an email
 * containing markup would execute in the user's Gmail session.
 */
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
  // Purged: professional developer tools do not synthesize toy chimes
}

function launchGlitterBurst() {
  // Purged: professional developer tools do not trigger toy particle confetti
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap');

    :host {
      all: initial;
      display: block;
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 4px 0 8px 0;
      width: 100%;
      --rd-bg: #FFFFFF;
      --rd-surface: #F8FAFC;
      --rd-surface-card: #FFFFFF;
      --rd-surface-subtle: #F1F5F9;
      --rd-border: rgba(15, 23, 42, 0.08);
      --rd-border-subtle: rgba(15, 23, 42, 0.05);
      --rd-text-primary: #0F172A;
      --rd-text-secondary: #475569;
      --rd-text-muted: #64748B;
      --rd-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

      /* Semantic status tokens - Light mode */
      --rd-safe-bg: rgba(16, 185, 129, 0.08);
      --rd-safe-border: rgba(16, 185, 129, 0.25);
      --rd-safe-text: #065F46;
      --rd-safe-dot: #10B981;

      --rd-promo-bg: rgba(99, 102, 241, 0.08);
      --rd-promo-border: rgba(99, 102, 241, 0.25);
      --rd-promo-text: #4338CA;
      --rd-promo-dot: #6366F1;

      --rd-susp-bg: rgba(245, 158, 11, 0.08);
      --rd-susp-border: rgba(245, 158, 11, 0.25);
      --rd-susp-text: #92400E;
      --rd-susp-dot: #F59E0B;

      --rd-threat-bg: rgba(239, 68, 68, 0.08);
      --rd-threat-border: rgba(239, 68, 68, 0.25);
      --rd-threat-text: #991B1B;
      --rd-threat-dot: #EF4444;
    }

    * {
      box-sizing: border-box;
    }

    .ratiod-container {
      background-color: var(--rd-bg);
      border: 1px solid var(--rd-border);
      border-radius: 8px;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
      color: var(--rd-text-primary);
      padding: 8px 12px;
      position: relative;
      overflow: hidden;
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    /* Ambient Micro-Pill for Safe Emails */
    .ratiod-container.ambient-safe-mode {
      padding: 5px 12px;
      border-radius: 6px;
      background-color: var(--rd-bg);
      border: 1px solid var(--rd-border);
      border-left: 3px solid var(--rd-safe-dot);
      box-shadow: 0 1px 2px rgba(16, 185, 129, 0.04);
      margin: 3px 0 6px 0;
    }

    .ratiod-container.ambient-safe-mode.expanded {
      border-radius: 8px;
      padding: 10px 14px;
    }

    /* Compact Sleek Mode for Promotional Newsletters */
    .ratiod-container.compact-promo-mode {
      padding: 5px 12px;
      border-radius: 6px;
      background-color: var(--rd-bg);
      border: 1px solid var(--rd-border);
      border-left: 3px solid var(--rd-promo-dot);
      box-shadow: 0 1px 2px rgba(99, 102, 241, 0.04);
      margin: 3px 0 6px 0;
    }

    /* Themed edge accents */
    .ratiod-container.theme-safe {
      border-left: 3px solid var(--rd-safe-dot);
    }
    .ratiod-container.theme-promo_clutter {
      border-left: 3px solid var(--rd-promo-dot);
    }
    .ratiod-container.theme-suspicious {
      border-left: 3px solid var(--rd-susp-dot);
    }
    .ratiod-container.theme-high_risk {
      border-left: 3px solid var(--rd-threat-dot);
    }

    .ratiod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ratiod-badge-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
    }

    .ratiod-tag {
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid transparent;
      letter-spacing: 0.2px;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      white-space: nowrap;
      line-height: 1.3;
    }

    .status-dot-indicator {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }

    .tag-safe {
      background-color: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
    }
    .tag-safe .status-dot-indicator { background-color: var(--rd-safe-dot); }

    .tag-promo_clutter {
      background-color: var(--rd-promo-bg);
      color: var(--rd-promo-text);
      border-color: var(--rd-promo-border);
    }
    .tag-promo_clutter .status-dot-indicator { background-color: var(--rd-promo-dot); }

    .tag-suspicious {
      background-color: var(--rd-susp-bg);
      color: var(--rd-susp-text);
      border-color: var(--rd-susp-border);
    }
    .tag-suspicious .status-dot-indicator { background-color: var(--rd-susp-dot); }

    .tag-high_risk {
      background-color: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .tag-high_risk .status-dot-indicator { background-color: var(--rd-threat-dot); }

    .tag-auth-spoof {
      background-color: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
      font-family: var(--rd-mono);
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .tag-auth-verified {
      background-color: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
      font-family: var(--rd-mono);
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
    }
    .tag-auth-unverified {
      background-color: var(--rd-surface-subtle);
      color: var(--rd-text-muted);
      border-color: var(--rd-border);
      font-family: var(--rd-mono);
      font-size: 10px;
      font-weight: 600;
      padding: 1px 6px;
      border-radius: 3px;
    }

    .tag-user-safe {
      background-color: var(--rd-safe-bg) !important;
      color: var(--rd-safe-text) !important;
      border-color: var(--rd-safe-border) !important;
    }
    .tag-user-promo {
      background-color: var(--rd-promo-bg) !important;
      color: var(--rd-promo-text) !important;
      border-color: var(--rd-promo-border) !important;
    }
    .tag-user-suspicious {
      background-color: var(--rd-susp-bg) !important;
      color: var(--rd-susp-text) !important;
      border-color: var(--rd-susp-border) !important;
    }
    .tag-user-unsafe {
      background-color: var(--rd-threat-bg) !important;
      color: var(--rd-threat-text) !important;
      border-color: var(--rd-threat-border) !important;
    }

    .ratiod-logo {
      border-radius: 4px;
      flex: 0 0 auto;
      display: block;
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

    .ratiod-header-actions { display: flex; align-items: center; gap: 4px; }

    .ratiod-iconbtn {
      display: inline-grid;
      place-items: center;
      width: 22px; height: 22px;
      padding: 0;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background-color: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      font-size: 11px;
      line-height: 1;
      cursor: pointer;
      transition: background-color 0.12s ease, border-color 0.12s ease;
    }
    .ratiod-iconbtn:hover {
      background-color: var(--rd-surface-subtle);
      color: var(--rd-text-primary);
    }
    .ratiod-iconbtn:focus-visible,
    .ratiod-btn:focus-visible,
    .ratiod-cred:focus-visible {
      outline: 2px solid var(--rd-text-primary);
      outline-offset: 1px;
    }

    .ratiod-body.collapsed { display: none; }

    .ratiod-credit {
      margin-top: 8px;
      padding-top: 6px;
      border-top: 1px solid var(--rd-border-subtle);
      font-size: 10px;
      color: var(--rd-text-muted);
      display: flex;
      align-items: center;
      gap: 5px;
      flex-wrap: wrap;
    }
    .ratiod-cred { color: var(--rd-text-secondary); font-weight: 500; text-decoration: underline; }
    .ratiod-cred:hover { color: var(--rd-text-primary); }

    @media (prefers-reduced-motion: reduce) {
      .ratiod-container, .ratiod-btn { transition: none; }
    }

    .ratiod-score {
      font-family: var(--rd-mono);
      font-size: 11px;
      font-weight: 600;
      background-color: var(--rd-surface-card);
      border: 1px solid var(--rd-border);
      padding: 2px 7px;
      border-radius: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
      color: var(--rd-text-primary);
    }

    .ratiod-score-mail {
      background-color: var(--rd-surface-card);
      color: var(--rd-text-primary);
    }

    .score-type-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.3px;
      color: var(--rd-text-muted);
      text-transform: uppercase;
      vertical-align: middle;
    }

    .score-number {
      font-size: 11.5px;
      font-weight: 700;
      color: var(--rd-text-primary);
    }

    .score-denom {
      font-size: 10px;
      font-weight: 500;
      color: var(--rd-text-muted);
    }

    .score-level-badge {
      font-size: 9px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 3px;
      text-transform: uppercase;
    }
    .level-low { background-color: var(--rd-safe-bg); color: var(--rd-safe-text); }
    .level-promo { background-color: var(--rd-promo-bg); color: var(--rd-promo-text); }
    .level-med { background-color: var(--rd-susp-bg); color: var(--rd-susp-text); }
    .level-high { background-color: var(--rd-threat-bg); color: var(--rd-threat-text); }

    .ratiod-score-qr {
      background-color: var(--rd-surface-card);
      color: var(--rd-text-primary);
    }
    .ratiod-score-qr.qr-high_risk, .ratiod-score-qr.qr-malicious {
      background-color: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .ratiod-score-qr.qr-suspicious {
      background-color: var(--rd-susp-bg);
      color: var(--rd-susp-text);
      border-color: var(--rd-susp-border);
    }
    .ratiod-score-qr.qr-safe {
      background-color: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
    }
    .ratiod-score-qr.qr-none {
      color: var(--rd-text-muted);
    }

    .drawer-sub-heading {
      font-family: var(--rd-mono);
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-text-muted);
      margin: 3px 0 6px 0;
      letter-spacing: 0.3px;
    }

    .qr-banner-card {
      background: var(--rd-surface);
      border: 1px solid var(--rd-border);
      border-radius: 6px;
      padding: 8px 10px;
      margin: 6px 0;
    }
    .qr-banner-card.card-high_risk, .qr-banner-card.card-malicious {
      border-left: 3px solid var(--rd-threat-dot);
    }
    .qr-banner-card.card-suspicious {
      border-left: 3px solid var(--rd-susp-dot);
    }
    .qr-banner-card.card-safe {
      border-left: 3px solid var(--rd-safe-dot);
    }

    .qr-banner-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 6px;
    }

    .qr-banner-payload-label {
      font-family: var(--rd-mono);
      font-size: 10px;
      font-weight: 600;
      color: var(--rd-text-muted);
      text-transform: uppercase;
      margin-top: 4px;
    }

    .qr-banner-code {
      display: block;
      font-family: var(--rd-mono);
      font-size: 11px;
      word-break: break-all;
      background: var(--rd-surface-card);
      border: 1px dashed var(--rd-border);
      padding: 5px 8px;
      border-radius: 4px;
      margin: 4px 0;
      color: var(--rd-text-primary);
    }

    .ratiod-body { margin-top: 8px; }

    .ratiod-summary-card {
      background-color: var(--rd-surface);
      border: 1px solid var(--rd-border);
      border-radius: 6px;
      padding: 10px 12px;
      margin-top: 6px;
    }

    .ratiod-summary-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .ratiod-summary-content {
      flex: 1;
    }

    .ratiod-summary-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--rd-text-primary);
      margin-bottom: 2px;
      line-height: 1.3;
    }

    .ratiod-summary-lead {
      font-size: 12px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
      font-weight: 400;
    }

    .ratiod-summary-tip {
      margin-top: 6px;
      padding: 5px 8px;
      background-color: var(--rd-surface-card);
      border-left: 2.5px solid var(--rd-safe-dot);
      border-radius: 4px;
      font-size: 11.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
    }

    .ratiod-explanation {
      margin-top: 6px;
      padding-top: 5px;
      border-top: 1px dashed var(--rd-border);
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
    }

    .ratiod-explanation-label {
      font-family: var(--rd-mono);
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background-color: var(--rd-surface-subtle);
      color: var(--rd-text-muted);
      padding: 1px 5px;
      border-radius: 3px;
      margin-right: 4px;
    }

    .ratiod-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
      flex-wrap: wrap;
    }

    .ratiod-btn {
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 500;
      padding: 5px 11px;
      border-radius: 6px;
      border: 1px solid var(--rd-border);
      background-color: var(--rd-surface-card);
      color: var(--rd-text-primary);
      cursor: pointer;
      transition: all 0.12s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      line-height: 1.2;
    }

    .ratiod-btn:hover {
      background-color: var(--rd-surface-subtle);
      border-color: var(--rd-border);
    }

    .ratiod-btn-primary {
      background-color: var(--rd-surface-subtle);
      color: var(--rd-text-primary);
    }
    .ratiod-btn-primary:hover {
      filter: brightness(0.97);
    }

    .ratiod-btn-unsub,
    .btn-highlight-unsub {
      background-color: var(--rd-promo-bg) !important;
      color: var(--rd-promo-text) !important;
      border: 1px solid var(--rd-promo-border) !important;
      font-weight: 600 !important;
    }
    .ratiod-btn-unsub:hover,
    .btn-highlight-unsub:hover {
      filter: brightness(0.95);
    }

    .ratiod-btn-spam {
      background-color: transparent;
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .ratiod-btn-spam:hover {
      background-color: var(--rd-threat-bg);
    }
    .btn-highlight-spam {
      background-color: var(--rd-threat-bg) !important;
      color: var(--rd-threat-text) !important;
      border-color: var(--rd-threat-border) !important;
      font-weight: 600 !important;
    }

    .btn-highlight-safe {
      background-color: var(--rd-safe-bg) !important;
      color: var(--rd-safe-text) !important;
      border-color: var(--rd-safe-border) !important;
      font-weight: 600 !important;
    }
    .btn-highlight-unsafe {
      background-color: var(--rd-threat-bg) !important;
      color: var(--rd-threat-text) !important;
      border-color: var(--rd-threat-border) !important;
      font-weight: 600 !important;
    }

    .ratiod-header-action-btn {
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      cursor: pointer;
      transition: all 0.12s ease;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 4px;
      line-height: 1.2;
    }
    .ratiod-header-action-btn.btn-highlight-safe {
      background-color: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
    }
    .ratiod-header-action-btn.btn-highlight-unsafe {
      background-color: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }

    .ratiod-feedback-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px dashed var(--rd-border);
    }

    .ratiod-feedback-prompt {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-text-secondary);
    }

    .ratiod-feedback-label-box {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .ratiod-feedback-sub {
      font-size: 10px;
      color: var(--rd-text-muted);
    }

    .ratiod-feedback-chips {
      display: flex;
      gap: 4px;
      align-items: center;
    }

    .ratiod-chip-btn {
      font-family: inherit;
      font-size: 10.5px;
      font-weight: 500;
      padding: 2px 7px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .ratiod-chip-btn:hover {
      background: var(--rd-surface-subtle);
      color: var(--rd-text-primary);
    }
    .ratiod-chip-btn.chip-active {
      background: var(--rd-text-primary);
      color: var(--rd-bg);
      border-color: var(--rd-text-primary);
      font-weight: 600;
    }

    .ratiod-feedback-toast {
      margin-top: 5px;
      padding: 4px 8px;
      background: var(--rd-safe-bg);
      border: 1px solid var(--rd-safe-border);
      border-radius: 4px;
      font-size: 11px;
      font-weight: 500;
      color: var(--rd-safe-text);
    }

    .ratiod-drawer {
      display: none;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed var(--rd-border);
    }
    .ratiod-drawer.open { display: block; }

    .drawer-section-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      margin-bottom: 5px;
      color: var(--rd-text-secondary);
      letter-spacing: 0.3px;
    }

    .flag-item {
      font-family: var(--rd-mono);
      font-size: 11px;
      background: var(--rd-surface);
      border: 1px solid var(--rd-border);
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      color: var(--rd-text-primary);
      line-height: 1.4;
    }

    .flag-span { font-weight: 700; color: var(--rd-threat-text); }
    .flag-peek-btn {
      font-family: inherit;
      font-size: 10px;
      font-weight: 500;
      padding: 2px 6px;
      margin-left: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      border-radius: 4px;
      cursor: pointer;
    }
    .flag-peek-btn:hover {
      background: var(--rd-surface-subtle);
      color: var(--rd-text-primary);
    }
    .flag-peek-res {
      margin-top: 5px;
      padding: 5px 7px;
      background: var(--rd-surface-subtle);
      border: 1px dashed var(--rd-border);
      border-radius: 4px;
      font-size: 10.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
    }

    .checklist-list { padding-left: 16px; margin: 4px 0; font-size: 12px; color: var(--rd-text-secondary); }
    .checklist-list li { margin-bottom: 3px; }

    .privacy-footnote {
      font-family: var(--rd-mono);
      font-size: 10.5px;
      color: var(--rd-text-muted);
      margin-top: 8px;
      line-height: 1.4;
    }

    /* ==========================================================================
       Native Dark Mode & Dark Reader Target Styling
       Applies when Gmail theme is dark, Dark Reader is active, or OS prefers dark
       ========================================================================== */
    :host([data-theme="dark"]),
    :host([data-darkreader="true"]),
    :host-context([data-darkreader-scheme="dark"]),
    :host-context(html[data-ratiod-theme="dark"]) {
      color-scheme: dark;
      --rd-bg: #111318;
      --rd-surface: #181B22;
      --rd-surface-card: #18181B;
      --rd-surface-subtle: #202024;
      --rd-border: rgba(255, 255, 255, 0.08);
      --rd-border-subtle: rgba(255, 255, 255, 0.04);
      --rd-text-primary: #F1F5F9;
      --rd-text-secondary: #CBD5E1;
      --rd-text-muted: #94A3B8;

      --rd-safe-bg: rgba(16, 185, 129, 0.12);
      --rd-safe-border: rgba(16, 185, 129, 0.3);
      --rd-safe-text: #34D399;
      --rd-safe-dot: #10B981;

      --rd-promo-bg: rgba(99, 102, 241, 0.12);
      --rd-promo-border: rgba(99, 102, 241, 0.3);
      --rd-promo-text: #A5B4FC;
      --rd-promo-dot: #818CF8;

      --rd-susp-bg: rgba(245, 158, 11, 0.12);
      --rd-susp-border: rgba(245, 158, 11, 0.3);
      --rd-susp-text: #FCD34D;
      --rd-susp-dot: #F59E0B;

      --rd-threat-bg: rgba(239, 68, 68, 0.12);
      --rd-threat-border: rgba(239, 68, 68, 0.3);
      --rd-threat-text: #FCA5A5;
      --rd-threat-dot: #EF4444;
    }

    :host([data-theme="dark"]) .ratiod-container,
    :host([data-darkreader="true"]) .ratiod-container {
      background-color: #18181B;
      border-color: rgba(255, 255, 255, 0.08);
      color: #F4F4F5;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
    :host([data-theme="dark"]) .ratiod-summary-card,
    :host([data-darkreader="true"]) .ratiod-summary-card {
      background-color: #202024;
      border-color: rgba(255, 255, 255, 0.08);
      color: #F4F4F5;
    }

    @media (prefers-color-scheme: dark) {
      :host(:not([data-theme="light"])) {
        color-scheme: dark;
        --rd-bg: #111318;
        --rd-surface: #181B22;
        --rd-surface-card: #18181B;
        --rd-surface-subtle: #202024;
        --rd-border: rgba(255, 255, 255, 0.08);
        --rd-border-subtle: rgba(255, 255, 255, 0.04);
        --rd-text-primary: #F1F5F9;
        --rd-text-secondary: #CBD5E1;
        --rd-text-muted: #94A3B8;

        --rd-safe-bg: rgba(16, 185, 129, 0.12);
        --rd-safe-border: rgba(16, 185, 129, 0.3);
        --rd-safe-text: #34D399;
        --rd-safe-dot: #10B981;

        --rd-promo-bg: rgba(99, 102, 241, 0.12);
        --rd-promo-border: rgba(99, 102, 241, 0.3);
        --rd-promo-text: #A5B4FC;
        --rd-promo-dot: #818CF8;

        --rd-susp-bg: rgba(245, 158, 11, 0.12);
        --rd-susp-border: rgba(245, 158, 11, 0.3);
        --rd-susp-text: #FCD34D;
        --rd-susp-dot: #F59E0B;

        --rd-threat-bg: rgba(239, 68, 68, 0.12);
        --rd-threat-border: rgba(239, 68, 68, 0.3);
        --rd-threat-text: #FCA5A5;
        --rd-threat-dot: #EF4444;
      }
      .ratiod-container {
        background-color: #18181B;
        border-color: rgba(255, 255, 255, 0.08);
        color: #F4F4F5;
      }
      .ratiod-summary-card {
        background-color: #202024;
        border-color: rgba(255, 255, 255, 0.08);
        color: #F4F4F5;
      }
    }
  `;
  shadowRoot.appendChild(styleElem);

  const verdict = data.verdict || "safe";
  const mailScore = data.mail_score !== undefined ? data.mail_score : (data.score !== undefined ? data.score : 0);
  const score = data.score !== undefined ? data.score : mailScore;
  const flags = data.flags || [];
  const explanation = data.explanation || "No threat signals detected.";
  const nextSteps = data.next_steps || [];
  const privacy = data.privacy || { phones_masked: 0, emails_masked: 0, otp_masked: 0 };
  const totalMasked = (privacy.phones_masked || 0) + (privacy.emails_masked || 0) + (privacy.otp_masked || 0);

  const engine = data.engine || {};
  const vegaSource = engine.model_source || "edge_physics";
  const vegaThreatBasin = (engine.model_threat_category || verdict || "safe").toUpperCase();
  const vegaConvergence = engine.model_abstain ? "ABSTAIN (Unbound OOD Orbit)" : "CONVERGED (Harmonic Well)";
  const vegaConformalSet = Array.isArray(engine.model_conformal_set) && engine.model_conformal_set.length > 0
    ? engine.model_conformal_set.join(", ")
    : (verdict || "safe");
  const vegaTemp = engine.model_temperature !== undefined ? Number(engine.model_temperature).toFixed(3) : "1.000";
  const vegaKinetic = engine.model_kinetic_energy !== undefined ? Number(engine.model_kinetic_energy).toFixed(4) : "0.0000";

  const isSafe = verdict === "safe";
  const isPromo = verdict === "promo_clutter";

  const container = document.createElement("div");
  container.className = "ratiod-container theme-" + (isPromo ? "promo_clutter" : (verdict || "safe")) +
    (isSafe ? " ambient-safe-mode" : (isPromo ? " compact-promo-mode" : ""));

  let displayVerdictLabel = "Verified Safe";
  let riskLevelKey = "low";
  let riskLevelText = "LOW RISK";
  let simpleTitle = "Verified Authentic Message";
  let simpleLead = "No malicious lures, domain mismatches, or spoofing vectors detected.";
  let simpleTip = "Safe to open links and interact with sender.";

  if (verdict === "high_risk") {
    displayVerdictLabel = "High-Risk Threat";
    riskLevelKey = "high";
    riskLevelText = "HIGH RISK";
    simpleTitle = "High-Risk Phishing / Threat Detected";
    simpleLead = "Critical warning: Active threat vectors, deception techniques, or credential harvesting detected.";
    simpleTip = "Do not open links, download attachments, or disclose credentials. Report as spam.";
  } else if (verdict === "suspicious") {
    displayVerdictLabel = "Suspicious Signals";
    riskLevelKey = "med";
    riskLevelText = "SUSPICIOUS";
    simpleTitle = "Suspicious Signals Detected";
    simpleLead = "Anomalies found in sender domains, URL redirect patterns, or verification records.";
    simpleTip = "Verify sender authenticity before clicking links or submitting credentials.";
  } else if (verdict === "promo_clutter") {
    displayVerdictLabel = "Newsletter";
    riskLevelKey = "promo";
    riskLevelText = "NEWSLETTER";
    simpleTitle = "Marketing Newsletter";
    simpleLead = "Commercial mailing list or notification feed with valid authentication.";
    simpleTip = "Use 1-Click Unsubscribe to opt out directly.";
  }

  const qrData = data.qr || (window.__latestQrScanResult ? window.__latestQrScanResult : null);
  let qrScoreText = "NO QR DETECTED";
  let qrChipClass = "qr-none";
  let qrVerdictLabel = "NONE";
  let qrFlags = [];
  let qrPayload = "";
  let qrDefanged = "";
  let qrKind = "";
  let hasQrThreat = false;

  if (qrData) {
    const rawQrScore = Number(qrData.score !== undefined ? qrData.score : (qrData.risk_score || 0));
    const rawQrVerdict = String(qrData.verdict || qrData.legacy_verdict || "safe").toLowerCase();
    const isHigh = rawQrVerdict === "high_risk" || rawQrVerdict === "malicious" || rawQrScore >= 66;
    const isSuspicious = !isHigh && (rawQrVerdict === "suspicious" || rawQrScore >= 35);
    qrVerdictLabel = isHigh ? "HIGH RISK" : (isSuspicious ? "SUSPICIOUS" : "SAFE");
    qrScoreText = `${rawQrScore}/100 [ ${qrVerdictLabel} ]`;
    qrChipClass = isHigh ? "qr-high_risk" : (isSuspicious ? "qr-suspicious" : "qr-safe");
    qrFlags = qrData.flags || [];
    qrPayload = qrData.payload || "";
    qrDefanged = qrData.defanged || qrPayload;
    qrKind = qrData.payload_kind || "";
    if (isHigh || isSuspicious || rawQrScore > 0 || qrFlags.length > 0) {
      hasQrThreat = true;
    }
  }

  let authBadgeHtml = "";
  const authSummary = data.auth || (data.engine && data.engine.auth_status ? { status: data.engine.auth_status } : null);
  if (authSummary && authSummary.status) {
    if (authSummary.status === "spoof") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-spoof">DKIM: SPOOF DETECTED</span>`;
    } else if (authSummary.status === "verified") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-verified">DKIM: VERIFIED</span>`;
    } else if (authSummary.status === "unverified") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-unverified">DKIM: UNVERIFIED</span>`;
    }
  }

  let logoSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='10' fill='%23EA3E2B'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23FFFFFF' font-size='28' font-weight='800' font-family='sans-serif'%3ER%3C/text%3E%3C/svg%3E";
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
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <img class="ratiod-logo" src="${escapeHtml(logoSrc)}" alt="" width="20" height="20">
        <span class="ratiod-tag tag-${escapeHtml(verdict)}"><span class="status-dot-indicator"></span>${escapeHtml(displayVerdictLabel)}</span>
        ${isPromo
          ? `<button class="ratiod-btn ratiod-btn-unsub btn-highlight-unsub ratiod-header-action-btn" id="btn-header-unsub" type="button" title="1-Click Unsubscribe from this newsletter">1-Click Unsubscribe</button>`
          : (verdict !== 'safe'
              ? `<button class="ratiod-header-action-btn btn-highlight-safe" id="btn-header-safe" data-feedback="safe" type="button" title="One-click: change tag to SAFE and submit feedback">Mark Safe</button>`
              : ''
            )
        }
        ${authBadgeHtml}
        <span class="ratiod-score ratiod-score-mail" title="Mail Security Risk Score"><span class="score-type-badge">Risk</span><span class="score-number">${escapeHtml(mailScore)}</span><span class="score-denom">/100</span></span>
        <span class="ratiod-score ratiod-score-qr ${escapeHtml(qrChipClass)}" id="banner-qr-score" style="display: ${hasQrThreat ? 'inline-flex' : 'none'};" title="QR Security Risk Score"><span class="score-type-badge">QR</span><span id="banner-qr-score-val">${escapeHtml(qrScoreText)}</span></span>
      </div>
      <div class="ratiod-header-actions">
        <button class="ratiod-iconbtn" id="btn-collapse" type="button" aria-expanded="${(isSafe || isPromo) ? 'false' : 'true'}" aria-controls="ratiod-body" title="${(isSafe || isPromo) ? 'Expand analysis' : 'Collapse analysis'}">
          <span aria-hidden="true">${(isSafe || isPromo) ? '&#9662;' : '&#9652;'}</span><span class="sr-only">Collapse analysis</span>
        </button>
        <button class="ratiod-iconbtn" id="btn-dismiss" type="button" title="Dismiss Ratio'd for this email">
          <span aria-hidden="true">&#10005;</span><span class="sr-only">Dismiss Ratio'd</span>
        </button>
      </div>
    </div>

    <div class="ratiod-body ${(isSafe || isPromo) ? 'collapsed' : ''}" id="ratiod-body">
      <div class="ratiod-summary-card">
        <div class="ratiod-summary-header">
          <div class="ratiod-summary-content">
            <div class="ratiod-summary-title">${escapeHtml(simpleTitle)}</div>
            <div class="ratiod-summary-lead">${escapeHtml(simpleLead)}</div>
            ${simpleTip ? `<div class="ratiod-summary-tip"><strong>Recommendation:</strong> ${escapeHtml(simpleTip)}</div>` : ''}
          </div>
        </div>
        <div class="ratiod-explanation"><span class="ratiod-explanation-label">Diagnostic:</span> ${escapeHtml(explanation)}</div>
        <div class="ratiod-feedback-strip" id="ratiod-feedback-strip">
          <div class="ratiod-feedback-label-box">
            <span class="ratiod-feedback-prompt">Continuous Learning:</span>
            <span class="ratiod-feedback-sub">Submit classification override:</span>
          </div>
          <div class="ratiod-feedback-chips">
            <button class="ratiod-chip-btn ${verdict === 'safe' ? 'chip-active' : ''}" type="button" data-feedback="safe" title="Override: Mark as Safe">Safe</button>
            <button class="ratiod-chip-btn ${verdict === 'promo_clutter' ? 'chip-active' : ''}" type="button" data-feedback="promo" title="Override: Mark as Newsletter">Newsletter</button>
            <button class="ratiod-chip-btn ${verdict === 'suspicious' ? 'chip-active' : ''}" type="button" data-feedback="suspicious" title="Override: Mark as Suspicious">Suspicious</button>
            <button class="ratiod-chip-btn ${verdict === 'high_risk' ? 'chip-active' : ''}" type="button" data-feedback="unsafe" title="Override: Mark as Phishing">Phishing</button>
          </div>
        </div>
        <div class="ratiod-feedback-toast" id="ratiod-feedback-toast" style="display:none;" role="status" aria-live="polite"></div>
      </div>

      <div class="ratiod-actions">
        <button class="ratiod-btn ratiod-btn-primary" id="toggle-drawer" type="button" aria-expanded="false" aria-controls="analysis-drawer">Inspection Details</button>
        ${verdict === 'safe'
          ? '<button class="ratiod-btn ratiod-btn-feedback btn-highlight-unsafe" id="btn-quick-feedback" data-feedback="unsafe" type="button" title="Mark this email as unsafe and submit feedback">Mark Unsafe</button>'
          : '<button class="ratiod-btn ratiod-btn-feedback btn-highlight-safe" id="btn-quick-feedback" data-feedback="safe" type="button" title="Mark this email as safe and submit feedback">Mark Safe</button>'
        }
        <button class="ratiod-btn ratiod-btn-unsub ${verdict === 'promo_clutter' ? 'btn-highlight-unsub' : ''}" id="btn-one-unsub" type="button">1-Click Unsubscribe</button>
        <button class="ratiod-btn ratiod-btn-spam ${verdict === 'high_risk' ? 'btn-highlight-spam' : ''}" id="btn-move-spam" type="button">Report Spam</button>
      </div>

      <div class="ratiod-drawer" id="analysis-drawer" role="region" aria-label="Full Ratio'd analysis">
        <div class="drawer-section-title">EMAIL THREAT ANALYSIS</div>
        <div class="drawer-sub-heading">Risk Score: ${escapeHtml(mailScore)}/100 &bull; Status: ${escapeHtml(displayVerdictLabel)}</div>
        <div id="drawer-mail-flags">
          ${flags.length > 0 ? flags.map(f => `
            <div class="flag-item">
              <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
              ${(f.span && (f.span.includes("http") || f.span.includes("bit.ly") || f.span.includes("."))) ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(f.span)}">Safe Peek</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
            </div>
          `).join('') : '<div class="flag-item">No explicit email threat rules triggered.</div>'}
        </div>

        <details class="ratiod-telemetry-details" style="margin-top: 12px;">
          <summary class="drawer-section-title" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;">
            <span>VEGAML CONFORMAL TELEMETRY</span>
            <span style="font-size:10px;font-weight:600;opacity:0.7;">&#9662;</span>
          </summary>
          <div id="drawer-vegaml-section" style="margin-top:6px;">
            <div class="flag-item" style="font-family:'JetBrains Mono',monospace;font-size:11px;line-height:1.6;">
              <div><strong>MODEL:</strong> VegaML 64-D Hamiltonian Dynamics (${escapeHtml(vegaSource)})</div>
              <div><strong>THREAT BASIN:</strong> <span class="flag-span">${escapeHtml(vegaThreatBasin)}</span> &bull; <strong>CONVERGENCE:</strong> ${escapeHtml(vegaConvergence)}</div>
              <div><strong>90% CONFORMAL PREDICTION SET:</strong> [ ${escapeHtml(vegaConformalSet)} ]</div>
              <div><strong>THERMODYNAMICS:</strong> Calibrated Temp &tau; = ${escapeHtml(vegaTemp)} &bull; Residual Kinetic E = ${escapeHtml(vegaKinetic)}</div>
            </div>
          </div>
        </details>

        <div class="drawer-section-title" style="margin-top: 12px;">QR CODE ANALYSIS</div>
        <div id="drawer-qr-section">
          ${qrData ? `
            <div class="qr-banner-card card-${escapeHtml(qrChipClass.replace('qr-', ''))}">
              <div class="qr-banner-card-header">
                <div><strong>QR Code Status:</strong> <span class="ratiod-tag tag-${escapeHtml(qrChipClass.replace('qr-', ''))}">${escapeHtml(qrVerdictLabel)}</span></div>
                <span class="ratiod-score">QR Risk Score: ${escapeHtml(qrData.score !== undefined ? qrData.score : 0)}/100</span>
              </div>
              <div class="qr-banner-payload-label">Decoded QR Payload ${qrKind ? `(${escapeHtml(qrKind)})` : ''}:</div>
              <code class="qr-banner-code">${escapeHtml(qrDefanged || qrPayload)}</code>
              ${qrPayload ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(qrPayload)}">Safe Peek QR Link</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
              <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;margin-top:6px;">Detected QR Code Signals:</div>
              ${qrFlags.length > 0 ? qrFlags.map(f => `
                <div class="flag-item" style="margin-top:4px;">
                  <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
                </div>
              `).join('') : '<div class="flag-item" style="margin-top:4px;">No suspicious QR code patterns detected.</div>'}
            </div>
          ` : `
            <div class="flag-item" id="qr-empty-msg">No QR codes detected in this message. Email images are monitored for embedded QR threats.</div>
          `}
        </div>

        <div class="drawer-section-title" style="margin-top: 12px;">RECOMMENDED ACTIONS</div>
        <ul class="checklist-list">
          ${nextSteps.map(step => `<li><strong>&bull;</strong> ${escapeHtml(step)}</li>`).join('')}
        </ul>

        <div class="privacy-footnote">
          Real-time PII redaction active: ${escapeHtml(privacy.phones_masked || 0)} phone(s), ${escapeHtml(privacy.emails_masked || 0)} email(s), ${escapeHtml(privacy.otp_masked || 0)} code(s) &mdash; ${escapeHtml(totalMasked)} item(s) masked before analysis. Zero message text stored.
        </div>
      </div>
    </div>

    <div class="ratiod-credit">
      <span>Ratio'd &middot; Developed by
        <a class="ratiod-cred" href="https://github.com/VedxntDev" target="_blank" rel="noopener noreferrer">Vedant</a>
      </span>
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
      const open = drawer.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
      toggleBtn.textContent = open ? "Hide Details" : "Inspection Details";
    });
  }

  // Collapse: keep the score badge on screen, hide the advice and actions.
  if (collapseBtn && body) {
    collapseBtn.addEventListener("click", () => {
      const collapsed = body.classList.toggle("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.title = collapsed ? "Expand analysis" : "Collapse analysis";
      collapseBtn.querySelector("[aria-hidden]").innerHTML = collapsed ? "&#9662;" : "&#9652;";
      if (container.classList.contains("ambient-safe-mode")) {
        container.classList.toggle("expanded", !collapsed);
      }
    });
  }

  // Dismiss: allow dismissing the banner for current email.
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      if (host.parentElement) host.parentElement.removeChild(host);
    });
  }

  // User Feedback Overrides & Telemetry
  function applyUserFeedback(feedbackType, originBtn) {
    const toast = shadowRoot.getElementById("ratiod-feedback-toast");
    const headerTag = shadowRoot.querySelector(".ratiod-tag");
    const mailScoreVal = shadowRoot.querySelector(".ratiod-score-mail");
    const explanationEl = shadowRoot.querySelector(".ratiod-explanation");
    const feedbackChips = shadowRoot.querySelectorAll(".ratiod-chip-btn");
    const quickFeedbackBtn = shadowRoot.getElementById("btn-quick-feedback");

    feedbackChips.forEach(chip => {
      if (chip.getAttribute("data-feedback") === feedbackType) {
        chip.classList.add("chip-active");
      } else {
        chip.classList.remove("chip-active");
      }
    });

    if (toast) {
      toast.style.display = "block";
      toast.textContent = `Feedback recorded: Marked as ${feedbackType.toUpperCase()}. Local model updated.`;
    }

    if (headerTag) {
      if (feedbackType === "safe") {
        headerTag.className = "ratiod-tag tag-safe tag-user-safe";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>Override: Safe`;
      } else if (feedbackType === "suspicious") {
        headerTag.className = "ratiod-tag tag-suspicious tag-user-suspicious";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>Override: Suspicious`;
      } else if (feedbackType === "promo") {
        headerTag.className = "ratiod-tag tag-promo_clutter tag-user-promo";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>Override: Newsletter`;
      } else if (feedbackType === "unsafe" || feedbackType === "high_risk") {
        headerTag.className = "ratiod-tag tag-high_risk tag-user-unsafe";
        headerTag.innerHTML = `<span class="status-dot-indicator"></span>Override: Unsafe`;
      }
    }

    if (container) {
      container.className = "ratiod-container theme-" + (feedbackType === "promo" ? "promo_clutter" : (feedbackType === "suspicious" ? "suspicious" : (feedbackType === "safe" ? "safe" : "high_risk")));
    }

    if (mailScoreVal) {
      const newScore = feedbackType === "safe" ? 0 : (feedbackType === "promo" ? 25 : (feedbackType === "suspicious" ? 45 : 85));
      const newLevelKey = feedbackType === "safe" ? "low" : (feedbackType === "promo" ? "promo" : (feedbackType === "suspicious" ? "med" : "high"));
      const newLevelText = feedbackType === "safe" ? "LOW RISK" : (feedbackType === "promo" ? "PROMO / CLUTTER" : (feedbackType === "suspicious" ? "SUSPICIOUS" : "HIGH RISK"));
      mailScoreVal.innerHTML = `<span class="score-type-badge">Risk</span><span class="score-number">${newScore}</span><span class="score-denom">/100</span> <span class="score-level-badge level-${newLevelKey}">${newLevelText}</span>`;
    }

    if (explanationEl) {
      const explType = feedbackType === "safe" ? "safe" : (feedbackType === "promo" ? "promotional newsletter" : (feedbackType === "suspicious" ? "suspicious" : "unsafe / phishing"));
      explanationEl.innerHTML = `<span class="ratiod-explanation-label">Feedback Override:</span> Marked as ${explType} by user. Local override applied.`;
    }

    const headerOverrideBtn = shadowRoot.getElementById("btn-header-safe") || shadowRoot.getElementById("btn-header-unsafe");
    if (headerOverrideBtn) {
      if (feedbackType === "safe") {
        headerOverrideBtn.id = "btn-header-unsafe";
        headerOverrideBtn.className = "ratiod-header-action-btn btn-highlight-unsafe";
        headerOverrideBtn.setAttribute("data-feedback", "unsafe");
        headerOverrideBtn.textContent = "Mark Unsafe";
      } else {
        headerOverrideBtn.id = "btn-header-safe";
        headerOverrideBtn.className = "ratiod-header-action-btn btn-highlight-safe";
        headerOverrideBtn.setAttribute("data-feedback", "safe");
        headerOverrideBtn.textContent = "Mark Safe";
      }
    }

    if (quickFeedbackBtn) {
      if (feedbackType === "safe") {
        quickFeedbackBtn.className = "ratiod-btn ratiod-btn-feedback btn-highlight-unsafe";
        quickFeedbackBtn.setAttribute("data-feedback", "unsafe");
        quickFeedbackBtn.textContent = "Mark Unsafe";
      } else {
        quickFeedbackBtn.className = "ratiod-btn ratiod-btn-feedback btn-highlight-safe";
        quickFeedbackBtn.setAttribute("data-feedback", "safe");
        quickFeedbackBtn.textContent = "Mark Safe";
      }
    }

    // Persist override to chrome.storage.local
    const mappedVerdict = feedbackType === "safe"
      ? "safe"
      : (feedbackType === "suspicious"
        ? "suspicious"
        : (feedbackType === "promo"
          ? "promo_clutter"
          : "high_risk"));
    const mappedScore = feedbackType === "safe"
      ? 0
      : (feedbackType === "suspicious"
        ? 45
        : (feedbackType === "promo"
          ? 25
          : 85));

    const rawSender = (data.emailMeta && (data.emailMeta.senderAddress || data.emailMeta.from)) || "";
    const cleanSender = extractCleanEmail(rawSender);
    const cleanDomain = extractEmailDomain(cleanSender);

    const keysToOverride = [];
    if (cleanSender) {
      keysToOverride.push(cleanSender);
      keysToOverride.push("sender:" + cleanSender);
    }
    if (data.emailMeta && data.emailMeta.subject) keysToOverride.push(data.emailMeta.subject);
    if (data.emailMeta && data.emailMeta.from) keysToOverride.push(data.emailMeta.from);
    if (data.cacheKey) keysToOverride.push(data.cacheKey);
    const hash = window.location.hash ? window.location.hash.replace(/^#/, "") : "";
    if (hash) keysToOverride.push(hash);

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

    // Dispatch global event for content script to synchronize inbox list view pills
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

    // Transmit feedback to backend API
    const feedbackPayload = {
      feedback: feedbackType,
      originalVerdict: verdict,
      originalScore: mailScore,
      sender: (data.emailMeta && data.emailMeta.from) || null,
      subject: (data.emailMeta && data.emailMeta.subject) || null,
      flags: (flags || []).map(f => (f && f.reason) || String(f || "")),
      timestamp: new Date().toISOString()
    };

    const endpoints = ["http://127.0.0.1:3000/feedback", "https://ratio-d.vercel.app/api/feedback", "https://www.ratiod.online/api/feedback"];
    for (const ep of endpoints) {
      try {
        fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(feedbackPayload)
        }).catch(() => {});
      } catch (err) {}
    }
  }

  const headerActionBtn = shadowRoot.getElementById("btn-header-safe") || shadowRoot.getElementById("btn-header-unsafe");
  if (headerActionBtn) {
    headerActionBtn.addEventListener("click", () => {
      const fb = headerActionBtn.getAttribute("data-feedback") || "safe";
      applyUserFeedback(fb, headerActionBtn);
    });
  }

  const quickFeedbackBtn = shadowRoot.getElementById("btn-quick-feedback");
  if (quickFeedbackBtn) {
    quickFeedbackBtn.addEventListener("click", () => {
      const fb = quickFeedbackBtn.getAttribute("data-feedback") || "safe";
      applyUserFeedback(fb, quickFeedbackBtn);
    });
  }

  shadowRoot.querySelectorAll(".ratiod-chip-btn").forEach(chip => {
    chip.addEventListener("click", () => {
      const fb = chip.getAttribute("data-feedback") || "safe";
      applyUserFeedback(fb, chip);
    });
  });

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
            Risk Verdict: <span style="font-weight:700;color:${vColor}">${v}</span> (Score: ${sc}/100)
          `;
        } else {
          resContainer.textContent = "Could not trace route (offline or unresolvable).";
        }
        btn.disabled = false;
        btn.textContent = "Safe Peek";
      });
    });
  }

  // Safe Peek Zero-Execution Link Redirect Tracer
  bindSafePeek(shadowRoot);

  // Helper to decode Google redirect URLs
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

  // Helper to dispatch native MouseEvent click that bypasses Chrome content script popup blocker
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

  // Helper to dispatch DOM click events to an element
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

  // Robust One-Click Unsubscribe Click Handler
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

      // Strategy A: Gmail Native Header Unsubscribe Action
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

      // Strategy B: Body Anchor Links (Unsubscribe / Opt-out / Manage Preferences)
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
          updateUnsubButton("Unsubscribe Link Opened", "#10B981");
        }
      }

      // Strategy C: Mailto Fallback
      if (!unsubSuccess) {
        const bodyText = (document.querySelector('.a3s') || document.body).innerText || '';
        const mailtoMatch = bodyText.match(/mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch) {
          window.location.href = `mailto:${mailtoMatch[1]}?subject=Unsubscribe`;
          unsubSuccess = true;
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
  window.__latestQrScanResult = qrResult;
  const host = document.getElementById("ratiod-banner-host");
  if (!host || !host.shadowRoot) return;
  const root = host.shadowRoot;

  const rawQrScore = Number(qrResult.score !== undefined ? qrResult.score : (qrResult.risk_score || 0));
  const rawQrVerdict = String(qrResult.verdict || qrResult.legacy_verdict || "safe").toLowerCase();
  const isHigh = rawQrVerdict === "high_risk" || rawQrVerdict === "malicious" || rawQrScore >= 66;
  const isSuspicious = !isHigh && (rawQrVerdict === "suspicious" || rawQrScore >= 35);
  const qrVerdictUpper = isHigh ? "HIGH RISK" : (isSuspicious ? "SUSPICIOUS" : "SAFE");
  const qrChipClass = isHigh ? "qr-high_risk" : (isSuspicious ? "qr-suspicious" : "qr-safe");
  const cardBorderClass = isHigh ? "card-high_risk" : (isSuspicious ? "card-suspicious" : "card-safe");

  // 1. Update QR Score Pill in header
  const qrPill = root.getElementById("banner-qr-score");
  const qrPillVal = root.getElementById("banner-qr-score-val");
  if (qrPill && qrPillVal) {
    qrPillVal.textContent = `${rawQrScore}/100 [ ${qrVerdictUpper} ]`;
    qrPill.className = `ratiod-score ratiod-score-qr ${qrChipClass}`;
  }

  // 2. Elevate overall banner verdict if QR threat is higher
  if (isHigh) {
    const verdictTag = root.querySelector(".ratiod-tag");
    if (verdictTag && !verdictTag.classList.contains("tag-high_risk")) {
      verdictTag.className = "ratiod-tag tag-high_risk";
      verdictTag.innerHTML = `<span class="status-dot-indicator"></span>HIGH RISK (QR PHISH)`;
    }
    const container = root.querySelector(".ratiod-container");
    if (container) {
      container.className = "ratiod-container theme-high_risk";
    }
    const explanationEl = root.querySelector(".ratiod-explanation");
    if (explanationEl && !explanationEl.textContent.includes("QR CODE SECURITY ALERT")) {
      const alertStrong = document.createElement("strong");
      alertStrong.textContent = "[ QR CODE SECURITY ALERT ]: ";
      const alertText = document.createTextNode("Quishing payload detected in email image. ");
      explanationEl.prepend(alertStrong, alertText);
    }
  }

  // 3. Update QR section in drawer
  const qrSection = root.getElementById("drawer-qr-section");
  if (qrSection) {
    const defanged = qrResult.defanged || qrResult.payload || "";
    const payload = qrResult.payload || "";
    const kind = qrResult.payload_kind || "";
    const flags = qrResult.flags || [];

    let flagsHtml = '<div class="flag-item" style="margin-top:4px;">No suspicious QR code patterns detected.</div>';
    if (flags.length > 0) {
      flagsHtml = flags.map(f => `
        <div class="flag-item" style="margin-top:4px;">
          <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
        </div>
      `).join('');
    }

    const peekBtnHtml = payload ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(payload)}">Safe Peek QR Link</button><div class="flag-peek-res" style="display:none;"></div>` : '';

    qrSection.innerHTML = `
      <div class="qr-banner-card ${cardBorderClass}">
        <div class="qr-banner-card-header">
          <div><strong>QR CODE VERDICT:</strong> <span class="ratiod-tag tag-${isHigh ? 'high_risk' : (isSuspicious ? 'suspicious' : 'safe')}">[ ${escapeHtml(qrVerdictUpper)} ]</span></div>
          <span class="ratiod-score">QR RISK SCORE: ${escapeHtml(rawQrScore)}/100</span>
        </div>
        <div class="qr-banner-payload-label">DECODED QR PAYLOAD ${kind ? `(${escapeHtml(kind)})` : ''}:</div>
        <code class="qr-banner-code">${escapeHtml(defanged)}</code>
        ${peekBtnHtml}
        <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;margin-top:8px;">DETECTED QR CODE SIGNALS:</div>
        ${flagsHtml}
      </div>
    `;

    // Re-bind Safe Peek on newly added QR peek button
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
            Risk Verdict: <span style="font-weight:700;color:${vColor}">${v}</span> (Score: ${sc}/100)
          `;
        } else {
          resContainer.textContent = "Could not trace route (offline or unresolvable).";
        }
        btn.disabled = false;
        btn.textContent = "Safe Peek";
      });
    });
  }
}

window.injectRatiodBanner = injectRatiodBanner;
window.updateRatiodBannerQr = updateRatiodBannerQr;
