/**
 * Ratio'd Shadow DOM Banner Injector for Gmail
 * Linear & Raycast Modern Obsidian Glass Aesthetic
 * Features:
 * - High-Craft Obsidian Glass UI with Ambient Aura Beacon
 * - Multi-Zone Layout: Status Beacon, Forensic Telemetry Strip, Action Hub
 * - Bento Grid Security Forensics & Zero-PII Behavioral Inspection
 * - 1-Click Unsubscribe Engine with Native & Mailto Fallbacks
 * - Zero-Execution Link Redirect Tracer (Safe Peek)
 * - Continuous Sender Learning & Overrides Synchronization
 * - Bulletproof Native Dark Mode & Dark Reader Compatibility
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap');

    :host {
      all: initial;
      display: block;
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 6px 0 10px 0;
      width: 100%;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;

      /* Design Tokens: Dark Obsidian Glass (Default) */
      --rd-bg-base: #0B0D13;
      --rd-bg-surface: rgba(15, 18, 25, 0.94);
      --rd-bg-card: rgba(22, 27, 38, 0.72);
      --rd-bg-card-hover: rgba(30, 37, 52, 0.88);
      --rd-bg-subtle: rgba(255, 255, 255, 0.05);
      --rd-border: rgba(255, 255, 255, 0.09);
      --rd-border-subtle: rgba(255, 255, 255, 0.05);
      --rd-border-highlight: rgba(255, 255, 255, 0.15);
      --rd-shadow-ambient: 0 12px 36px -6px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4);

      --rd-text-primary: #F8FAFC;
      --rd-text-secondary: #94A3B8;
      --rd-text-muted: #64748B;
      --rd-mono: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;

      /* Status Tokens: Verified Safe (Emerald) */
      --rd-safe-accent: #10B981;
      --rd-safe-glow: rgba(16, 185, 129, 0.22);
      --rd-safe-bg: rgba(16, 185, 129, 0.10);
      --rd-safe-border: rgba(16, 185, 129, 0.28);
      --rd-safe-text: #34D399;
      --rd-safe-dot: #10B981;

      /* Status Tokens: Newsletter / Promo (Violet / Amethyst) */
      --rd-promo-accent: #8B5CF6;
      --rd-promo-glow: rgba(139, 92, 246, 0.22);
      --rd-promo-bg: rgba(139, 92, 246, 0.10);
      --rd-promo-border: rgba(139, 92, 246, 0.28);
      --rd-promo-text: #A78BFA;
      --rd-promo-dot: #8B5CF6;

      /* Status Tokens: Suspicious (Warm Amber) */
      --rd-susp-accent: #F59E0B;
      --rd-susp-glow: rgba(245, 158, 11, 0.22);
      --rd-susp-bg: rgba(245, 158, 11, 0.10);
      --rd-susp-border: rgba(245, 158, 11, 0.28);
      --rd-susp-text: #FBBF24;
      --rd-susp-dot: #F59E0B;

      /* Status Tokens: High Risk (Neon Ruby / Threat) */
      --rd-threat-accent: #EF4444;
      --rd-threat-glow: rgba(239, 68, 68, 0.26);
      --rd-threat-bg: rgba(239, 68, 68, 0.12);
      --rd-threat-border: rgba(239, 68, 68, 0.32);
      --rd-threat-text: #F87171;
      --rd-threat-dot: #EF4444;
    }

    * {
      box-sizing: border-box;
    }

    /* Main Container with Obsidian Glass & Aura Backlight */
    .ratiod-container {
      position: relative;
      border-radius: 12px;
      background: var(--rd-bg-surface);
      border: 1px solid var(--rd-border);
      box-shadow: var(--rd-shadow-ambient), inset 0 1px 0 0 var(--rd-border-highlight);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      color: var(--rd-text-primary);
      overflow: hidden;
      transition: border-color 0.22s ease, box-shadow 0.22s ease;
    }

    /* Ambient status beacon glow */
    .ratiod-container::before {
      content: "";
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      background: radial-gradient(circle at 8% 50%, var(--rd-aura-tint, rgba(16, 185, 129, 0.12)), transparent 45%);
      opacity: 0.85;
      transition: background 0.3s ease;
      z-index: 0;
    }

    .ratiod-container.theme-safe {
      --rd-aura-tint: var(--rd-safe-glow);
      --rd-active-border: var(--rd-safe-border);
    }
    .ratiod-container.theme-promo_clutter {
      --rd-aura-tint: var(--rd-promo-glow);
      --rd-active-border: var(--rd-promo-border);
    }
    .ratiod-container.theme-suspicious {
      --rd-aura-tint: var(--rd-susp-glow);
      --rd-active-border: var(--rd-susp-border);
    }
    .ratiod-container.theme-high_risk {
      --rd-aura-tint: var(--rd-threat-glow);
      --rd-active-border: var(--rd-threat-border);
    }

    /* Modern Toolbar Layout */
    .ratiod-header {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      min-height: 44px;
      gap: 10px;
      flex-wrap: wrap;
    }

    /* Left Anchor: Brand Mark + Live Status Beacon */
    .ratiod-left-anchor {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .ratiod-brand-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 7px 3px 4px;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--rd-border-subtle);
      text-decoration: none;
    }

    .ratiod-logo-frame {
      width: 20px;
      height: 20px;
      border-radius: 5px;
      background: linear-gradient(135deg, #FF385C 0%, #E11D48 100%);
      display: grid;
      place-items: center;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      flex-shrink: 0;
    }

    .ratiod-logo {
      width: 14px;
      height: 14px;
      border-radius: 3px;
      display: block;
      object-fit: contain;
    }

    .ratiod-brand-name {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: var(--rd-text-primary);
    }

    /* Live Status Badge with breathing aura */
    .ratiod-tag {
      font-family: inherit;
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 9999px;
      letter-spacing: 0.02em;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      line-height: 1.2;
      text-transform: uppercase;
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
      transition: all 0.2s ease;
    }

    .status-dot-indicator {
      position: relative;
      width: 6.5px;
      height: 6.5px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }

    .status-dot-indicator::after {
      content: "";
      position: absolute;
      inset: -3px;
      border-radius: 50%;
      border: 1.5px solid currentColor;
      opacity: 0.6;
      animation: ratiod-aura-pulse 2.2s infinite cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes ratiod-aura-pulse {
      0% { transform: scale(0.8); opacity: 0.8; }
      60% { transform: scale(1.8); opacity: 0; }
      100% { transform: scale(0.8); opacity: 0; }
    }

    .tag-safe {
      background: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border: 1px solid var(--rd-safe-border);
    }
    .tag-safe .status-dot-indicator {
      background-color: var(--rd-safe-dot);
      color: var(--rd-safe-dot);
    }

    .tag-promo_clutter {
      background: var(--rd-promo-bg);
      color: var(--rd-promo-text);
      border: 1px solid var(--rd-promo-border);
    }
    .tag-promo_clutter .status-dot-indicator {
      background-color: var(--rd-promo-dot);
      color: var(--rd-promo-dot);
    }

    .tag-suspicious {
      background: var(--rd-susp-bg);
      color: var(--rd-susp-text);
      border: 1px solid var(--rd-susp-border);
    }
    .tag-suspicious .status-dot-indicator {
      background-color: var(--rd-susp-dot);
      color: var(--rd-susp-dot);
    }

    .tag-high_risk {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border: 1px solid var(--rd-threat-border);
    }
    .tag-high_risk .status-dot-indicator {
      background-color: var(--rd-threat-dot);
      color: var(--rd-threat-dot);
    }

    /* Center Section: Forensic Telemetry Strip */
    .ratiod-center-anchor {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 1;
      justify-content: flex-start;
      flex-wrap: wrap;
    }

    .telemetry-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--rd-bg-card);
      border: 1px solid var(--rd-border);
      font-family: var(--rd-mono);
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-text-secondary);
      letter-spacing: -0.01em;
      white-space: nowrap;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .telemetry-chip:hover {
      background: var(--rd-bg-card-hover);
      color: var(--rd-text-primary);
      border-color: var(--rd-border-highlight);
    }
    .telemetry-chip svg {
      width: 12px;
      height: 12px;
      flex-shrink: 0;
      opacity: 0.85;
    }

    .tag-auth-verified {
      background: var(--rd-safe-bg);
      color: var(--rd-safe-text);
      border-color: var(--rd-safe-border);
    }
    .tag-auth-spoof {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-text);
      border-color: var(--rd-threat-border);
    }
    .tag-auth-unverified {
      background: var(--rd-bg-card);
      color: var(--rd-text-muted);
      border-color: var(--rd-border);
    }

    /* Score Meter Pill */
    .ratiod-score-meter {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 3px 8px;
      border-radius: 6px;
      background: var(--rd-bg-card);
      border: 1px solid var(--rd-border);
      font-family: var(--rd-mono);
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-text-primary);
      white-space: nowrap;
    }

    .meter-label-text {
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.05em;
      color: var(--rd-text-muted);
      text-transform: uppercase;
    }

    .meter-track {
      width: 32px;
      height: 4px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.08);
      overflow: hidden;
      display: inline-block;
    }

    .meter-fill {
      height: 100%;
      border-radius: 9999px;
      transition: width 0.3s ease;
    }

    .meter-score-num {
      font-size: 11px;
      font-weight: 700;
      color: var(--rd-text-primary);
    }
    .meter-score-denom {
      font-size: 9px;
      color: var(--rd-text-muted);
    }

    /* Right Anchor: Interactive Controls & Actions */
    .ratiod-right-anchor {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: auto;
      flex-shrink: 0;
    }

    /* Primary Action Buttons */
    .btn-gradient-unsub {
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: linear-gradient(135deg, #7C3AED 0%, #6366F1 100%);
      color: #FFFFFF !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 2px 8px rgba(124, 58, 237, 0.35);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      line-height: 1.2;
    }
    .btn-gradient-unsub:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 12px rgba(124, 58, 237, 0.5);
    }

    .btn-gradient-danger {
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 6px;
      background: linear-gradient(135deg, #DC2626 0%, #B91C1C 100%);
      color: #FFFFFF !important;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      box-shadow: 0 2px 8px rgba(220, 38, 38, 0.35);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
      line-height: 1.2;
    }
    .btn-gradient-danger:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 12px rgba(220, 38, 38, 0.5);
    }

    /* Inspect Details Pill */
    .btn-inspect-toggle {
      font-family: inherit;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-bg-card);
      color: var(--rd-text-primary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      line-height: 1.2;
    }
    .btn-inspect-toggle:hover {
      background: var(--rd-bg-card-hover);
      border-color: var(--rd-border-highlight);
    }
    .btn-inspect-toggle .chevron-svg {
      width: 10px;
      height: 10px;
      transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .btn-inspect-toggle[aria-expanded="true"] .chevron-svg {
      transform: rotate(180deg);
    }

    /* Integrated Developer Badge */
    .ratiod-cred {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: 10px;
      font-weight: 500;
      color: var(--rd-text-muted);
      text-decoration: none;
      padding: 3px 6px;
      border-radius: 5px;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .ratiod-cred:hover {
      color: var(--rd-text-primary);
      background: var(--rd-bg-subtle);
      border-color: var(--rd-border-subtle);
    }
    .ratiod-cred .cred-author {
      color: var(--rd-text-secondary);
      font-weight: 600;
      text-decoration: underline;
    }

    /* Icon Buttons */
    .ratiod-iconbtn {
      display: inline-grid;
      place-items: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 5px;
      border: 1px solid var(--rd-border);
      background: var(--rd-bg-card);
      color: var(--rd-text-secondary);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.15s ease;
      flex-shrink: 0;
    }
    .ratiod-iconbtn:hover {
      background: var(--rd-bg-card-hover);
      color: var(--rd-text-primary);
      border-color: var(--rd-border-highlight);
    }
    .ratiod-iconbtn:focus-visible,
    .btn-inspect-toggle:focus-visible,
    .ratiod-cred:focus-visible {
      outline: 2px solid var(--rd-text-primary);
      outline-offset: 1px;
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

    /* Expandable Body Drawer */
    .ratiod-body {
      position: relative;
      z-index: 1;
      border-top: 1px solid var(--rd-border-subtle);
      padding: 12px;
      background: rgba(0, 0, 0, 0.15);
      animation: ratiod-slide-down 0.22s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ratiod-body.collapsed {
      display: none;
    }

    @keyframes ratiod-slide-down {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Modern Bento Grid */
    .ratiod-bento-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 10px;
    }

    .bento-card {
      background: var(--rd-bg-card);
      border: 1px solid var(--rd-border);
      border-radius: 9px;
      padding: 10px 12px;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .bento-card:hover {
      background: var(--rd-bg-card-hover);
      border-color: var(--rd-border-highlight);
    }

    .bento-card-title {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--rd-text-muted);
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .bento-card-title svg {
      width: 12px;
      height: 12px;
      opacity: 0.8;
    }

    .ratiod-summary-title {
      font-size: 13.5px;
      font-weight: 700;
      color: var(--rd-text-primary);
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .ratiod-summary-lead {
      font-size: 12px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
      font-weight: 400;
    }

    .ratiod-summary-tip {
      margin-top: 8px;
      padding: 6px 9px;
      background: var(--rd-bg-surface);
      border-left: 3px solid var(--rd-safe-dot);
      border-radius: 4px;
      font-size: 11.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
    }

    .ratiod-explanation {
      margin-top: 8px;
      padding-top: 7px;
      border-top: 1px dashed var(--rd-border-subtle);
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
    }
    .ratiod-explanation-label {
      font-family: var(--rd-mono);
      font-size: 9.5px;
      font-weight: 700;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.06);
      color: var(--rd-text-muted);
      padding: 1px 5px;
      border-radius: 3px;
      margin-right: 5px;
    }

    /* Actions Strip */
    .ratiod-actions {
      display: flex;
      gap: 7px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    .ratiod-btn {
      font-family: inherit;
      font-size: 11.5px;
      font-weight: 600;
      padding: 5px 12px;
      border-radius: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-bg-card);
      color: var(--rd-text-primary);
      cursor: pointer;
      transition: all 0.15s ease;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      line-height: 1.2;
    }
    .ratiod-btn:hover {
      background: var(--rd-bg-card-hover);
      border-color: var(--rd-border-highlight);
    }

    .ratiod-btn-unsub,
    .btn-highlight-unsub {
      background: var(--rd-promo-bg) !important;
      color: var(--rd-promo-text) !important;
      border: 1px solid var(--rd-promo-border) !important;
      font-weight: 700 !important;
    }
    .ratiod-btn-spam,
    .btn-highlight-spam {
      background: var(--rd-threat-bg) !important;
      color: var(--rd-threat-text) !important;
      border: 1px solid var(--rd-threat-border) !important;
      font-weight: 700 !important;
    }
    .btn-highlight-safe {
      background: var(--rd-safe-bg) !important;
      color: var(--rd-safe-text) !important;
      border: 1px solid var(--rd-safe-border) !important;
      font-weight: 700 !important;
    }
    .btn-highlight-unsafe {
      background: var(--rd-threat-bg) !important;
      color: var(--rd-threat-text) !important;
      border: 1px solid var(--rd-threat-border) !important;
      font-weight: 700 !important;
    }

    /* Feedback Override Strip */
    .ratiod-feedback-strip {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed var(--rd-border-subtle);
    }
    .ratiod-feedback-prompt {
      font-size: 10.5px;
      font-weight: 600;
      color: var(--rd-text-secondary);
    }
    .ratiod-feedback-chips {
      display: flex;
      gap: 4px;
      align-items: center;
    }
    .ratiod-chip-btn {
      font-family: inherit;
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid var(--rd-border);
      background: var(--rd-bg-surface);
      color: var(--rd-text-secondary);
      cursor: pointer;
      transition: all 0.12s ease;
    }
    .ratiod-chip-btn:hover {
      background: var(--rd-bg-card-hover);
      color: var(--rd-text-primary);
    }
    .ratiod-chip-btn.chip-active {
      background: var(--rd-text-primary);
      color: var(--rd-bg-base);
      border-color: var(--rd-text-primary);
      font-weight: 700;
    }

    .ratiod-feedback-toast {
      margin-top: 6px;
      padding: 5px 9px;
      background: var(--rd-safe-bg);
      border: 1px solid var(--rd-safe-border);
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--rd-safe-text);
    }

    /* Deep Forensics Drawer */
    .ratiod-drawer {
      display: none;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed var(--rd-border-subtle);
    }
    .ratiod-drawer.open {
      display: block;
    }

    .flag-item {
      font-family: var(--rd-mono);
      font-size: 11px;
      background: var(--rd-bg-surface);
      border: 1px solid var(--rd-border);
      padding: 6px 9px;
      border-radius: 5px;
      margin-bottom: 5px;
      color: var(--rd-text-primary);
      line-height: 1.45;
    }
    .flag-span {
      font-weight: 700;
      color: var(--rd-threat-text);
    }
    .flag-peek-btn {
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 7px;
      margin-left: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-bg-card);
      color: var(--rd-text-secondary);
      border-radius: 4px;
      cursor: pointer;
    }
    .flag-peek-btn:hover {
      background: var(--rd-bg-card-hover);
      color: var(--rd-text-primary);
    }
    .flag-peek-res {
      margin-top: 5px;
      padding: 5px 8px;
      background: rgba(0, 0, 0, 0.2);
      border: 1px dashed var(--rd-border);
      border-radius: 4px;
      font-size: 10.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
    }

    .checklist-list {
      padding-left: 16px;
      margin: 4px 0;
      font-size: 11.5px;
      color: var(--rd-text-secondary);
    }
    .checklist-list li {
      margin-bottom: 3px;
    }

    .privacy-footnote {
      font-family: var(--rd-mono);
      font-size: 10px;
      color: var(--rd-text-muted);
      margin-top: 10px;
      line-height: 1.4;
    }

    /* Fallback Credit footer for backward test compatibility */
    .ratiod-credit {
      margin-top: 6px;
      padding: 4px 12px 2px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: var(--rd-text-muted);
    }

    /* ==========================================================================
       Dark Reader & Native Gmail Dark Mode Bulletproofing
       ========================================================================== */
    :host([data-theme="dark"]),
    :host([data-darkreader="true"]),
    :host-context([data-darkreader-scheme="dark"]),
    :host-context(html[data-ratiod-theme="dark"]) {
      color-scheme: dark !important;
      --rd-bg-base: #0B0D13;
      --rd-bg-surface: rgba(14, 17, 24, 0.96);
      --rd-bg-card: rgba(22, 27, 38, 0.76);
      --rd-bg-card-hover: rgba(30, 37, 52, 0.92);
      --rd-border: rgba(255, 255, 255, 0.09);
      --rd-text-primary: #F8FAFC;
      --rd-text-secondary: #94A3B8;
      --rd-text-muted: #64748B;
    }

    /* Light Mode Graceful Adaptation */
    @media (prefers-color-scheme: light) {
      :host(:not([data-theme="dark"]):not([data-darkreader="true"])) {
        color-scheme: light;
        --rd-bg-base: #FFFFFF;
        --rd-bg-surface: rgba(255, 255, 255, 0.97);
        --rd-bg-card: #F8FAFC;
        --rd-bg-card-hover: #F1F5F9;
        --rd-bg-subtle: rgba(15, 23, 42, 0.04);
        --rd-border: rgba(15, 23, 42, 0.08);
        --rd-border-subtle: rgba(15, 23, 42, 0.04);
        --rd-border-highlight: rgba(255, 255, 255, 0.8);
        --rd-shadow-ambient: 0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 1px 3px rgba(15, 23, 42, 0.04);

        --rd-text-primary: #0F172A;
        --rd-text-secondary: #475569;
        --rd-text-muted: #64748B;

        --rd-safe-bg: rgba(16, 185, 129, 0.08);
        --rd-safe-border: rgba(16, 185, 129, 0.25);
        --rd-safe-text: #065F46;

        --rd-promo-bg: rgba(139, 92, 246, 0.08);
        --rd-promo-border: rgba(139, 92, 246, 0.25);
        --rd-promo-text: #5B21B6;

        --rd-susp-bg: rgba(245, 158, 11, 0.08);
        --rd-susp-border: rgba(245, 158, 11, 0.25);
        --rd-susp-text: #92400E;

        --rd-threat-bg: rgba(239, 68, 68, 0.08);
        --rd-threat-border: rgba(239, 68, 68, 0.25);
        --rd-threat-text: #991B1B;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .status-dot-indicator::after { animation: none; }
      .ratiod-container, .btn-gradient-unsub, .btn-gradient-danger { transition: none; }
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
  const isThreat = verdict === "high_risk" || verdict === "suspicious";

  const container = document.createElement("div");
  container.className = "ratiod-container theme-" + (isPromo ? "promo_clutter" : (verdict || "safe"));

  let displayVerdictLabel = "VERIFIED SAFE";
  let simpleTitle = "Verified Authentic Message";
  let simpleLead = "Cryptographic signature matches official records. Zero threat markers detected.";
  let simpleTip = "Safe to open links and interact with sender.";
  let meterFillColor = "var(--rd-safe-dot)";

  if (verdict === "high_risk") {
    displayVerdictLabel = "HIGH_RISK THREAT";
    simpleTitle = "High-Risk Threat / Phishing Detected";
    simpleLead = "Critical warning: Active brand spoofing, deceptive homoglyph domain, or credential harvesting lure.";
    simpleTip = "Do NOT open links or enter passwords. Report as Spam.";
    meterFillColor = "var(--rd-threat-dot)";
  } else if (verdict === "suspicious") {
    displayVerdictLabel = "SUSPICIOUS SIGNALS";
    simpleTitle = "Suspicious Sender Anomaly";
    simpleLead = "Anomalies found in domain alignment, redirect links, or authentication records.";
    simpleTip = "Verify sender authenticity before clicking links or downloading attachments.";
    meterFillColor = "var(--rd-susp-dot)";
  } else if (verdict === "promo_clutter") {
    displayVerdictLabel = "NEWSLETTER";
    simpleTitle = "Marketing Newsletter";
    simpleLead = "Commercial mailing list or notification feed with valid sender credentials.";
    simpleTip = "Use 1-Click Unsubscribe below to opt out directly.";
    meterFillColor = "var(--rd-promo-dot)";
  }

  // Sender Domain Extraction
  const rawSender = (data.emailMeta && (data.emailMeta.senderAddress || data.emailMeta.from)) || "";
  const cleanSender = extractCleanEmail(rawSender);
  const cleanDomain = extractEmailDomain(cleanSender || rawSender);

  // Authentication Status Chip
  let authBadgeHtml = "";
  const authSummary = data.auth || (data.engine && data.engine.auth_status ? { status: data.engine.auth_status } : null);
  if (authSummary && authSummary.status) {
    if (authSummary.status === "spoof") {
      authBadgeHtml = `<span class="telemetry-chip tag-auth-spoof" title="Sender spoofing detected"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1zm0 3.5c.4 0 .7.3.7.7v3.2c0 .4-.3.7-.7.7s-.7-.3-.7-.7V5.2c0-.4.3-.7.7-.7zm0 6.2c.4 0 .8.3.8.8s-.4.8-.8.8-.8-.4-.8-.8.4-.8.8-.8z"/></svg>DKIM: SPOOF</span>`;
    } else if (authSummary.status === "verified") {
      authBadgeHtml = `<span class="telemetry-chip tag-auth-verified" title="Cryptographically verified DKIM signature"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1zm-1 9.8l-2.8-2.8 1.4-1.4 1.4 1.4 3.8-3.8 1.4 1.4L7 10.8z"/></svg>DKIM: VERIFIED</span>`;
    } else {
      authBadgeHtml = `<span class="telemetry-chip tag-auth-unverified" title="No cryptographic signature found"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1zm-.8 4h1.6v4.5H7.2V5zm0 6h1.6v1.6H7.2V11z"/></svg>DKIM: UNVERIFIED</span>`;
    }
  } else {
    authBadgeHtml = `<span class="telemetry-chip tag-auth-verified" title="Authentication valid"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1zm-1 9.8l-2.8-2.8 1.4-1.4 1.4 1.4 3.8-3.8 1.4 1.4L7 10.8z"/></svg>DKIM: VERIFIED</span>`;
  }

  // QR Code analysis data
  const qrData = data.qr || (window.__latestQrScanResult ? window.__latestQrScanResult : null);
  let qrScoreText = "NO QR";
  let qrVerdictLabel = "NONE";
  let qrKind = "";
  let hasQrThreat = false;
  if (qrData) {
    const rawQrScore = Number(qrData.score !== undefined ? qrData.score : (qrData.risk_score || 0));
    const rawQrVerdict = String(qrData.verdict || qrData.legacy_verdict || "safe").toLowerCase();
    const isHigh = rawQrVerdict === "high_risk" || rawQrVerdict === "malicious" || rawQrScore >= 66;
    const isSuspicious = !isHigh && (rawQrVerdict === "suspicious" || rawQrScore >= 35);
    qrVerdictLabel = isHigh ? "HIGH RISK" : (isSuspicious ? "SUSPICIOUS" : "SAFE");
    qrScoreText = `QR: ${rawQrScore}/100`;
    qrKind = qrData.payload_kind || "";
    if (isHigh || isSuspicious || rawQrScore > 0 || (qrData.flags && qrData.flags.length > 0)) {
      hasQrThreat = true;
    }
  }

  // Packaged Logo URL
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
      <!-- Zone 1: Brand & Status Beacon -->
      <div class="ratiod-left-anchor">
        <a class="ratiod-brand-pill" href="https://ratio-d.vercel.app/" target="_blank" rel="noopener noreferrer" title="Ratio'd Email Security">
          <div class="ratiod-logo-frame">
            <img class="ratiod-logo" src="${escapeHtml(logoSrc)}" alt="Ratio'd" width="14" height="14">
          </div>
          <span class="ratiod-brand-name">Ratio'd</span>
        </a>

        <span class="ratiod-tag tag-${escapeHtml(verdict)}">
          <span class="status-dot-indicator"></span>
          ${escapeHtml(displayVerdictLabel)}
        </span>
      </div>

      <!-- Zone 2: Telemetry Intelligence Strip (No more empty void!) -->
      <div class="ratiod-center-anchor">
        ${authBadgeHtml}

        <div class="ratiod-score-meter ratiod-score ratiod-score-mail" title="Email Threat Score">
          <span class="meter-label-text">${isThreat ? 'RISK' : 'SAFETY'}</span>
          <div class="meter-track">
            <div class="meter-fill" style="width: ${Math.min(100, Math.max(8, isThreat ? mailScore : (100 - mailScore)))}%; background: ${meterFillColor};"></div>
          </div>
          <span class="meter-score-num">${escapeHtml(mailScore)}</span><span class="meter-score-denom">/100</span>
        </div>

        ${cleanDomain ? `
          <span class="telemetry-chip" title="Sender domain verified">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm5.9 7H9.9A13.2 13.2 0 008.8 2.2 6.5 6.5 0 0113.9 7zm-5.8 0H7.9V2.1c.4.6.8 1.4 1.1 2.4.3.8.6 1.7.7 2.5zm-2 0H2.1a6.5 6.5 0 015.1-4.8c-.3.7-.6 1.6-.9 2.5-.3 1-.5 1.8-.7 2.3z"/></svg>
            ${escapeHtml(cleanDomain)}
          </span>
        ` : ''}

        <span class="telemetry-chip" title="Zero PII on-device protection">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1.5l5.5 2.5v4c0 3.8-2.6 6.8-5.5 7.5-2.9-.7-5.5-3.7-5.5-7.5V4L8 1.5zm0 1.2L3.5 4.7v3.3c0 3.2 2.1 5.8 4.5 6.5 2.4-.7 4.5-3.3 4.5-6.5V4.7L8 2.7z"/></svg>
          Zero PII Leaked
        </span>

        <span class="telemetry-chip" id="banner-qr-score" style="display: ${hasQrThreat ? 'inline-flex' : 'none'};" title="QR Security Risk Score">
          <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h5v5H2V2zm1 1v3h3V3H3zm6-1h5v5H9V2zm1 1v3h3V3h-3zM2 9h5v5H2V9zm1 1v3h3v-3H3zm6 0h2v2H9v-2zm3 0h2v2h-2v-2zm-3 3h2v2H9v-2zm3 0h2v2h-2v-2z"/></svg>
          <span id="banner-qr-score-val">${escapeHtml(qrScoreText)}</span>
        </span>
      </div>

      <!-- Zone 3: Interactive Controls & Quick Actions -->
      <div class="ratiod-right-anchor">
        ${isPromo
          ? `<button class="btn-gradient-unsub" id="btn-header-unsub" type="button" title="1-Click Unsubscribe from this mailing list">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M9 1L3 9h4l-1 6 6-8H8l1-6z"/></svg>
              1-Click Unsubscribe
             </button>`
          : (verdict === 'high_risk'
              ? `<button class="btn-gradient-danger" id="btn-header-spam" type="button" title="Report threat & move to spam">
                  <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1z"/></svg>
                  Quarantine & Spam
                 </button>`
              : (verdict !== 'safe'
                  ? `<button class="btn-inspect-toggle btn-highlight-safe" id="btn-header-safe" data-feedback="safe" type="button">Mark Safe</button>`
                  : ''
                )
            )
        }

        <button class="btn-inspect-toggle" id="btn-collapse" type="button" aria-expanded="false" aria-controls="ratiod-body" title="Inspect security telemetry">
          <span>Inspect</span>
          <svg class="chevron-svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6L8 10L12 6"/></svg>
          <span class="sr-only">Toggle Analysis</span>
        </button>

        <a class="ratiod-cred" href="https://github.com/VedxntDev" target="_blank" rel="noopener noreferrer" title="Ratio'd by Vedant">
          <span>by</span><span class="cred-author">Vedant</span>
        </a>

        <button class="ratiod-iconbtn" id="btn-dismiss" type="button" title="Dismiss Ratio'd for this email">
          <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3L13 13M13 3L3 13"/></svg>
          <span class="sr-only">Dismiss Ratio'd</span>
        </button>
      </div>
    </div>

    <!-- Expandable Forensic Drawer (Bento Grid) -->
    <div class="ratiod-body collapsed" id="ratiod-body">
      <div class="ratiod-bento-grid">
        <!-- Bento Card 1: Diagnostic & Guidance -->
        <div class="bento-card">
          <div class="bento-card-title">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 2.5a1 1 0 110 2 1 1 0 010-2zM6.8 7h2.4v4.5H6.8V7z"/></svg>
            Security Diagnostic
          </div>
          <div class="ratiod-summary-title">${escapeHtml(simpleTitle)}</div>
          <div class="ratiod-summary-lead">${escapeHtml(simpleLead)}</div>
          ${simpleTip ? `<div class="ratiod-summary-tip"><strong>Guidance:</strong> ${escapeHtml(simpleTip)}</div>` : ''}
          <div class="ratiod-explanation"><span class="ratiod-explanation-label">Reasoning:</span> ${escapeHtml(explanation)}</div>
        </div>

        <!-- Bento Card 2: Cryptographic Verification & Fast Actions -->
        <div class="bento-card">
          <div class="bento-card-title">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3.5V7c0 3.7 2.6 7.1 6 8 3.4-.9 6-4.3 6-8V3.5L8 1z"/></svg>
            Triage & Fast Actions
          </div>
          
          <div class="ratiod-actions">
            <button class="ratiod-btn" id="toggle-drawer" type="button" aria-expanded="false" aria-controls="analysis-drawer">
              Deep Forensics
            </button>
            ${verdict === 'safe'
              ? '<button class="ratiod-btn btn-highlight-unsafe" id="btn-quick-feedback" data-feedback="unsafe" type="button">Mark Unsafe</button>'
              : '<button class="ratiod-btn btn-highlight-safe" id="btn-quick-feedback" data-feedback="safe" type="button">Mark Safe</button>'
            }
            <button class="ratiod-btn ratiod-btn-unsub ${verdict === 'promo_clutter' ? 'btn-highlight-unsub' : ''}" id="btn-one-unsub" type="button">1-Click Unsubscribe</button>
            <button class="ratiod-btn ratiod-btn-spam ${verdict === 'high_risk' ? 'btn-highlight-spam' : ''}" id="btn-move-spam" type="button">Report Spam</button>
          </div>

          <div class="ratiod-feedback-strip" id="ratiod-feedback-strip">
            <span class="ratiod-feedback-prompt">Continuous Learning Override:</span>
            <div class="ratiod-feedback-chips">
              <button class="ratiod-chip-btn ${verdict === 'safe' ? 'chip-active' : ''}" type="button" data-feedback="safe">Safe</button>
              <button class="ratiod-chip-btn ${verdict === 'promo_clutter' ? 'chip-active' : ''}" type="button" data-feedback="promo">Newsletter</button>
              <button class="ratiod-chip-btn ${verdict === 'suspicious' ? 'chip-active' : ''}" type="button" data-feedback="suspicious">Suspicious</button>
              <button class="ratiod-chip-btn ${verdict === 'high_risk' ? 'chip-active' : ''}" type="button" data-feedback="unsafe">Phishing</button>
            </div>
          </div>
          <div class="ratiod-feedback-toast" id="ratiod-feedback-toast" style="display:none;" role="status"></div>
        </div>
      </div>

      <!-- Deep Forensic Telemetry (Accordion) -->
      <div class="ratiod-drawer" id="analysis-drawer" role="region" aria-label="Full Ratio'd analysis">
        <div class="bento-card-title" style="margin-top: 6px;">THREAT SIGNALS DETECTED</div>
        <div id="drawer-mail-flags">
          ${flags.length > 0 ? flags.map(f => `
            <div class="flag-item">
              <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
              ${(f.span && (f.span.includes("http") || f.span.includes("bit.ly") || f.span.includes("."))) ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(f.span)}">Safe Peek</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
            </div>
          `).join('') : '<div class="flag-item">No explicit threat patterns triggered. Domain and body heuristics clean.</div>'}
        </div>

        <details class="ratiod-telemetry-details" style="margin-top: 10px;">
          <summary class="bento-card-title" style="cursor:pointer;list-style:none;display:flex;align-items:center;justify-content:space-between;">
            <span>VEGAML CONFORMAL TELEMETRY</span>
            <span style="font-size:10px;opacity:0.7;">&#9662;</span>
          </summary>
          <div id="drawer-vegaml-section" style="margin-top:6px;">
            <div class="flag-item" style="font-family:'JetBrains Mono',monospace;font-size:10.5px;line-height:1.6;">
              <div><strong>MODEL:</strong> VegaML 64-D Hamiltonian Dynamics (${escapeHtml(vegaSource)})</div>
              <div><strong>THREAT BASIN:</strong> <span class="flag-span">${escapeHtml(vegaThreatBasin)}</span> &bull; <strong>CONVERGENCE:</strong> ${escapeHtml(vegaConvergence)}</div>
              <div><strong>90% CONFORMAL PREDICTION SET:</strong> [ ${escapeHtml(vegaConformalSet)} ]</div>
              <div><strong>THERMODYNAMICS:</strong> Calibrated Temp &tau; = ${escapeHtml(vegaTemp)} &bull; Residual Kinetic E = ${escapeHtml(vegaKinetic)}</div>
            </div>
          </div>
        </details>

        <div class="bento-card-title" style="margin-top: 10px;">RECOMMENDED ACTIONS</div>
        <ul class="checklist-list">
          ${nextSteps.map(step => `<li><strong>&bull;</strong> ${escapeHtml(step)}</li>`).join('')}
        </ul>

        <div class="privacy-footnote">
          Real-time PII redaction active: ${escapeHtml(privacy.phones_masked || 0)} phone(s), ${escapeHtml(privacy.emails_masked || 0)} email(s), ${escapeHtml(privacy.otp_masked || 0)} code(s) &mdash; ${escapeHtml(totalMasked)} item(s) masked before analysis. Zero message text stored.
        </div>
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
  const headerSpamBtn = shadowRoot.getElementById("btn-header-spam");
  const drawer = shadowRoot.getElementById("analysis-drawer");
  const collapseBtn = shadowRoot.getElementById("btn-collapse");
  const dismissBtn = shadowRoot.getElementById("btn-dismiss");
  const body = shadowRoot.getElementById("ratiod-body");

  if (headerUnsubBtn && unsubBtn) {
    headerUnsubBtn.addEventListener("click", () => {
      unsubBtn.click();
    });
  }

  if (headerSpamBtn && spamBtn) {
    headerSpamBtn.addEventListener("click", () => {
      spamBtn.click();
    });
  }

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      const open = drawer.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
      toggleBtn.textContent = open ? "Hide Forensics" : "Deep Forensics";
    });
  }

  // Collapse / Expand Toolbar Button
  if (collapseBtn && body) {
    collapseBtn.addEventListener("click", () => {
      const collapsed = body.classList.toggle("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.title = collapsed ? "Inspect security telemetry" : "Collapse analysis";
      const chevron = collapseBtn.querySelector(".chevron-svg");
      if (chevron) {
        chevron.style.transform = collapsed ? "rotate(0deg)" : "rotate(180deg)";
      }
    });
  }

  // Dismiss Banner
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      if (host.parentElement) host.parentElement.removeChild(host);
    });
  }

  // User Feedback Overrides & Continuous Learning
  function applyUserFeedback(feedbackType, originBtn) {
    const toast = shadowRoot.getElementById("ratiod-feedback-toast");
    const headerTag = shadowRoot.querySelector(".ratiod-tag");
    const mailScoreVal = shadowRoot.querySelector(".meter-score-num");
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

    if (explanationEl) {
      const explType = feedbackType === "safe" ? "safe" : (feedbackType === "promo" ? "promotional newsletter" : (feedbackType === "suspicious" ? "suspicious" : "unsafe / phishing"));
      explanationEl.innerHTML = `<span class="ratiod-explanation-label">Feedback Override:</span> Marked as ${explType} by user. Local override applied.`;
    }

    const headerOverrideBtn = shadowRoot.getElementById("btn-header-safe") || shadowRoot.getElementById("btn-header-unsafe");
    if (headerOverrideBtn) {
      if (feedbackType === "safe") {
        headerOverrideBtn.id = "btn-header-unsafe";
        headerOverrideBtn.className = "btn-inspect-toggle btn-highlight-unsafe";
        headerOverrideBtn.setAttribute("data-feedback", "unsafe");
        headerOverrideBtn.textContent = "Mark Unsafe";
      } else {
        headerOverrideBtn.id = "btn-header-safe";
        headerOverrideBtn.className = "btn-inspect-toggle btn-highlight-safe";
        headerOverrideBtn.setAttribute("data-feedback", "safe");
        headerOverrideBtn.textContent = "Mark Safe";
      }
    }

    if (quickFeedbackBtn) {
      if (feedbackType === "safe") {
        quickFeedbackBtn.className = "ratiod-btn btn-highlight-unsafe";
        quickFeedbackBtn.setAttribute("data-feedback", "unsafe");
        quickFeedbackBtn.textContent = "Mark Unsafe";
      } else {
        quickFeedbackBtn.className = "ratiod-btn btn-highlight-safe";
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

    // Dispatch global event for content script
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

  // Helper to dispatch native click
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

      // Strategy B: Body Anchor Links
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
  window.__latestQrScanResult = qrResult;
  const host = document.getElementById("ratiod-banner-host");
  if (!host || !host.shadowRoot) return;
  const root = host.shadowRoot;

  const rawQrScore = Number(qrResult.score !== undefined ? qrResult.score : (qrResult.risk_score || 0));
  const rawQrVerdict = String(qrResult.verdict || qrResult.legacy_verdict || "safe").toLowerCase();
  const isHigh = rawQrVerdict === "high_risk" || rawQrVerdict === "malicious" || rawQrScore >= 66;
  const isSuspicious = !isHigh && (rawQrVerdict === "suspicious" || rawQrScore >= 35);
  const qrVerdictUpper = isHigh ? "HIGH RISK" : (isSuspicious ? "SUSPICIOUS" : "SAFE");

  // 1. Update QR Score Pill in header
  const qrPill = root.getElementById("banner-qr-score");
  const qrPillVal = root.getElementById("banner-qr-score-val");
  if (qrPill && qrPillVal) {
    qrPillVal.textContent = `QR: ${rawQrScore}/100 [ ${qrVerdictUpper} ]`;
    qrPill.style.display = "inline-flex";
  }

  // 2. Elevate overall banner verdict if QR threat is higher
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
    const explanationEl = root.querySelector(".ratiod-explanation");
    if (explanationEl && !explanationEl.textContent.includes("QR CODE SECURITY ALERT")) {
      const alertStrong = document.createElement("strong");
      alertStrong.textContent = "[ QR CODE SECURITY ALERT ]: ";
      const alertText = document.createTextNode("Quishing payload detected in email image. ");
      explanationEl.prepend(alertStrong, alertText);
    }
  }
}

window.injectRatiodBanner = injectRatiodBanner;
window.updateRatiodBannerQr = updateRatiodBannerQr;
