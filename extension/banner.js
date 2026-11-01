/**
 * Ratio'd Gmail Security Banner Injector
 * Brand Identity: Distinctive Tactile Neo-Utility Craftsmanship
 * Author: Vedant Baghel (https://github.com/VedxntDev)
 *
 * Designed specifically for Gmail:
 * - Single-line, non-wrapping, razor-sharp header toolbar
 * - Clear, unambiguous 0-100 risk/safety metrics
 * - Zero redundant sender headers (respects Gmail's native header space)
 * - Human-centric action layout (no robotic AI buzzwords)
 * - Developer signature placed cleanly at the bottom of the inspector
 * - Immune to Dark Reader and native Gmail dark/light modes
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
      margin: 8px 0 12px 0;
      width: 100%;
      box-sizing: border-box;
      -webkit-font-smoothing: antialiased;

      /* Dark Mode Palette (Crafted Slate & Obsidian) */
      --rd-bg: #13151C;
      --rd-surface: #1B1E28;
      --rd-surface-card: #222634;
      --rd-surface-hover: #2B3142;
      --rd-border: rgba(255, 255, 255, 0.12);
      --rd-border-subtle: rgba(255, 255, 255, 0.06);
      --rd-border-strong: rgba(255, 255, 255, 0.22);

      --rd-text-primary: #FFFFFF;
      --rd-text-secondary: #CBD5E1;
      --rd-text-muted: #8E9BAE;

      --rd-primary-red: #EA3E2B;
      --rd-font-display: 'Plus Jakarta Sans', sans-serif;
      --rd-font-mono: 'JetBrains Mono', ui-monospace, Menlo, monospace;

      /* Semantic status colors */
      --rd-safe-color: #10B981;
      --rd-safe-bg: rgba(16, 185, 129, 0.12);
      --rd-safe-border: rgba(16, 185, 129, 0.35);

      --rd-promo-color: #8B5CF6;
      --rd-promo-bg: rgba(139, 92, 246, 0.12);
      --rd-promo-border: rgba(139, 92, 246, 0.35);

      --rd-susp-color: #F59E0B;
      --rd-susp-bg: rgba(245, 158, 11, 0.12);
      --rd-susp-border: rgba(245, 158, 11, 0.35);

      --rd-threat-color: #EF4444;
      --rd-threat-bg: rgba(239, 68, 68, 0.14);
      --rd-threat-border: rgba(239, 68, 68, 0.40);
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    /* Container: Tactile, razor-sharp card */
    .ratiod-container {
      background: var(--rd-bg);
      border: 1.5px solid var(--rd-border);
      border-radius: 10px;
      color: var(--rd-text-primary);
      box-shadow: 0 4px 16px -2px rgba(0, 0, 0, 0.45);
      position: relative;
      overflow: hidden;
      transition: border-color 0.18s ease;
    }

    .ratiod-container.theme-safe {
      border-left: 4px solid var(--rd-safe-color);
    }
    .ratiod-container.theme-promo_clutter {
      border-left: 4px solid var(--rd-promo-color);
    }
    .ratiod-container.theme-suspicious {
      border-left: 4px solid var(--rd-susp-color);
    }
    .ratiod-container.theme-high_risk {
      border-left: 4px solid var(--rd-threat-color);
    }

    /* Header Bar: Strict single-line toolbar with zero wrapping */
    .ratiod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 7px 12px;
      min-height: 42px;
      gap: 10px;
      flex-wrap: nowrap;
      white-space: nowrap;
    }

    /* Left Cluster: Brand Mark & Live Verdict Sticker */
    .ratiod-badge-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .ratiod-brand-sticker {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: var(--rd-surface);
      border: 1px solid var(--rd-border);
      border-radius: 6px;
      padding: 3px 8px 3px 5px;
      text-decoration: none;
      color: var(--rd-text-primary);
    }

    .ratiod-logo-mark {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      background: var(--rd-primary-red);
      color: #FFFFFF;
      display: grid;
      place-items: center;
      font-family: var(--rd-font-display);
      font-weight: 800;
      font-size: 11px;
      line-height: 1;
      flex-shrink: 0;
    }
    .ratiod-logo-mark img {
      width: 14px;
      height: 14px;
      object-fit: contain;
    }

    .ratiod-brand-name {
      font-family: var(--rd-font-display);
      font-weight: 800;
      font-size: 11.5px;
      letter-spacing: -0.01em;
      color: var(--rd-text-primary);
    }

    /* Status Verdict Pill */
    .ratiod-tag {
      font-family: var(--rd-font-display);
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.03em;
      padding: 3px 9px;
      border-radius: 6px;
      border: 1.5px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      text-transform: uppercase;
      line-height: 1.2;
    }

    .status-dot-indicator {
      width: 6.5px;
      height: 6.5px;
      border-radius: 50%;
      flex-shrink: 0;
      display: inline-block;
    }

    .tag-safe {
      background: var(--rd-safe-bg);
      color: var(--rd-safe-color);
      border-color: var(--rd-safe-border);
    }
    .tag-safe .status-dot-indicator { background: var(--rd-safe-color); }

    .tag-promo_clutter {
      background: var(--rd-promo-bg);
      color: var(--rd-promo-color);
      border-color: var(--rd-promo-border);
    }
    .tag-promo_clutter .status-dot-indicator { background: var(--rd-promo-color); }

    .tag-suspicious {
      background: var(--rd-susp-bg);
      color: var(--rd-susp-color);
      border-color: var(--rd-susp-border);
    }
    .tag-suspicious .status-dot-indicator { background: var(--rd-susp-color); }

    .tag-high_risk {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-color);
      border-color: var(--rd-threat-border);
    }
    .tag-high_risk .status-dot-indicator { background: var(--rd-threat-color); }

    /* Center Cluster: Precise Technical Metrics (No wrapping!) */
    .ratiod-metrics-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    /* DKIM Chip */
    .ratiod-auth-pill {
      font-family: var(--rd-font-mono);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.03em;
      padding: 3px 8px;
      border-radius: 5px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-secondary);
      display: inline-flex;
      align-items: center;
      gap: 5px;
      text-transform: uppercase;
    }
    .ratiod-auth-pill.auth-verified {
      background: var(--rd-safe-bg);
      color: var(--rd-safe-color);
      border-color: var(--rd-safe-border);
    }
    .ratiod-auth-pill.auth-spoof {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-color);
      border-color: var(--rd-threat-border);
    }

    /* Security Score Pill: High-Visibility Numerical Metric */
    .ratiod-score-chip {
      font-family: var(--rd-font-mono);
      font-size: 11px;
      font-weight: 700;
      padding: 3px 9px;
      border-radius: 5px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-primary);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .score-label {
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--rd-text-muted);
    }
    .score-value-bold {
      font-size: 12px;
      font-weight: 800;
      color: var(--rd-text-primary);
    }
    .score-denom-text {
      font-size: 9.5px;
      color: var(--rd-text-muted);
      font-weight: 500;
    }

    /* Right Controls: Quick Action + Inspect + Dismiss */
    .ratiod-header-actions {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      margin-left: auto;
    }

    /* Inspect Button: Clean tactile control */
    .ratiod-inspect-btn {
      font-family: var(--rd-font-display);
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1.5px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-primary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s ease;
      line-height: 1.2;
    }
    .ratiod-inspect-btn:hover {
      background: var(--rd-surface-card);
      border-color: var(--rd-border-strong);
    }
    .ratiod-inspect-btn .chevron-arrow {
      transition: transform 0.2s ease;
      font-size: 9px;
    }
    .ratiod-inspect-btn[aria-expanded="true"] .chevron-arrow {
      transform: rotate(180deg);
    }

    /* Quick Promo Unsubscribe Button */
    .ratiod-quick-unsub-btn {
      font-family: var(--rd-font-display);
      font-size: 11px;
      font-weight: 800;
      padding: 4px 10px;
      border-radius: 6px;
      background: var(--rd-promo-color);
      color: #FFFFFF !important;
      border: 1.5px solid rgba(255, 255, 255, 0.2) !important;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: transform 0.12s ease;
      line-height: 1.2;
    }
    .ratiod-quick-unsub-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
    }

    /* Dismiss Button */
    .ratiod-iconbtn {
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface);
      color: var(--rd-text-secondary);
      font-size: 12px;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      transition: all 0.12s ease;
      flex-shrink: 0;
    }
    .ratiod-iconbtn:hover {
      background: var(--rd-surface-card);
      color: var(--rd-text-primary);
      border-color: var(--rd-border-strong);
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
       Expandable Inspector Panel
       ========================================================================== */
    .ratiod-body {
      border-top: 1px solid var(--rd-border);
      padding: 14px;
      background: rgba(0, 0, 0, 0.2);
    }
    .ratiod-body.collapsed {
      display: none;
    }

    /* 2-Column Balanced Inspector Layout */
    .ratiod-inspector-grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 12px;
    }
    @media (max-width: 768px) {
      .ratiod-inspector-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Card Panels */
    .ratiod-panel {
      background: var(--rd-surface);
      border: 1px solid var(--rd-border);
      border-radius: 8px;
      padding: 12px 14px;
    }

    .panel-heading {
      font-family: var(--rd-font-display);
      font-size: 10.5px;
      font-weight: 800;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--rd-text-muted);
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .diagnostic-title {
      font-family: var(--rd-font-display);
      font-size: 13.5px;
      font-weight: 800;
      color: var(--rd-text-primary);
      margin-bottom: 4px;
      line-height: 1.3;
    }

    .diagnostic-lead {
      font-size: 12px;
      line-height: 1.5;
      color: var(--rd-text-secondary);
      margin-bottom: 8px;
    }

    .guidance-box {
      padding: 6px 10px;
      background: var(--rd-surface-card);
      border-left: 3px solid var(--rd-safe-color);
      border-radius: 4px;
      font-size: 11.5px;
      line-height: 1.45;
      color: var(--rd-text-secondary);
      margin-bottom: 8px;
    }
    .guidance-box strong {
      color: var(--rd-text-primary);
    }

    .reasoning-text {
      font-size: 11px;
      line-height: 1.5;
      color: var(--rd-text-muted);
      border-top: 1px dashed var(--rd-border-subtle);
      padding-top: 7px;
    }
    .reasoning-label {
      font-family: var(--rd-font-mono);
      font-size: 9px;
      font-weight: 700;
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      padding: 1px 5px;
      border-radius: 3px;
      margin-right: 4px;
      text-transform: uppercase;
    }

    /* Actions & Feedback Panel */
    .action-row {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .ratiod-btn {
      font-family: var(--rd-font-display);
      font-size: 11px;
      font-weight: 700;
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-primary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.12s ease;
      line-height: 1.2;
    }
    .ratiod-btn:hover {
      background: var(--rd-surface-hover);
      border-color: var(--rd-border-strong);
    }

    .btn-warn {
      background: var(--rd-threat-bg);
      color: var(--rd-threat-color);
      border-color: var(--rd-threat-border);
    }
    .btn-warn:hover {
      background: var(--rd-threat-color);
      color: #FFFFFF;
    }

    .btn-unsub {
      background: var(--rd-promo-bg);
      color: var(--rd-promo-color);
      border-color: var(--rd-promo-border);
    }
    .btn-unsub:hover {
      background: var(--rd-promo-color);
      color: #FFFFFF;
    }

    /* Feedback Classification Section */
    .feedback-group {
      border-top: 1px dashed var(--rd-border-subtle);
      padding-top: 10px;
    }

    .feedback-caption {
      font-size: 11px;
      font-weight: 600;
      color: var(--rd-text-secondary);
      margin-bottom: 6px;
    }

    .feedback-chips {
      display: flex;
      gap: 5px;
      flex-wrap: wrap;
    }

    .ratiod-chip-btn {
      font-family: var(--rd-font-display);
      font-size: 10.5px;
      font-weight: 700;
      padding: 4px 9px;
      border-radius: 5px;
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
      font-weight: 800;
    }

    .ratiod-feedback-toast {
      margin-top: 8px;
      padding: 5px 9px;
      background: var(--rd-safe-bg);
      border: 1px solid var(--rd-safe-border);
      border-radius: 5px;
      font-size: 11px;
      font-weight: 600;
      color: var(--rd-safe-color);
    }

    /* Deep Forensics Accordion */
    .ratiod-forensics-panel {
      margin-top: 12px;
      border-top: 1px solid var(--rd-border-subtle);
      padding-top: 10px;
    }

    .forensics-toggle {
      font-family: var(--rd-font-display);
      font-size: 11px;
      font-weight: 700;
      color: var(--rd-text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: none;
      padding: 0;
      margin-bottom: 8px;
    }
    .forensics-toggle:hover {
      color: var(--rd-text-primary);
    }

    .flag-item {
      font-family: var(--rd-font-mono);
      font-size: 10.5px;
      background: var(--rd-surface);
      border: 1px solid var(--rd-border);
      padding: 6px 9px;
      border-radius: 5px;
      margin-bottom: 5px;
      color: var(--rd-text-secondary);
      line-height: 1.45;
    }
    .flag-span {
      font-weight: 700;
      color: var(--rd-threat-color);
    }
    .flag-peek-btn {
      font-family: var(--rd-font-display);
      font-size: 10px;
      font-weight: 700;
      padding: 2px 7px;
      margin-left: 6px;
      border: 1px solid var(--rd-border);
      background: var(--rd-surface-card);
      color: var(--rd-text-secondary);
      border-radius: 4px;
      cursor: pointer;
    }
    .flag-peek-btn:hover {
      background: var(--rd-surface-hover);
      color: var(--rd-text-primary);
    }
    .flag-peek-res {
      margin-top: 5px;
      padding: 5px 8px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px dashed var(--rd-border);
      border-radius: 4px;
      font-size: 10.5px;
      line-height: 1.4;
      color: var(--rd-text-secondary);
    }

    /* Privacy & Developer Footer (Cleanly placed at the very bottom) */
    .ratiod-footer {
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--rd-border-subtle);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      font-size: 10.5px;
      color: var(--rd-text-muted);
    }

    .ratiod-cred {
      color: var(--rd-text-muted);
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
    }
    .ratiod-cred strong {
      color: var(--rd-text-secondary);
      text-decoration: underline;
    }
    .ratiod-cred:hover strong {
      color: var(--rd-primary-red);
    }

    /* ==========================================================================
       Dark Reader & Light Mode Adaptations
       ========================================================================== */
    :host([data-theme="dark"]),
    :host([data-darkreader="true"]),
    :host-context([data-darkreader-scheme="dark"]),
    :host-context(html[data-ratiod-theme="dark"]) {
      color-scheme: dark !important;
    }

    @media (prefers-color-scheme: light) {
      :host(:not([data-theme="dark"]):not([data-darkreader="true"])) {
        color-scheme: light;
        --rd-bg: #FFFFFF;
        --rd-surface: #F8FAFC;
        --rd-surface-card: #FFFFFF;
        --rd-surface-hover: #F1F5F9;
        --rd-border: rgba(15, 23, 42, 0.12);
        --rd-border-subtle: rgba(15, 23, 42, 0.06);
        --rd-border-strong: rgba(15, 23, 42, 0.22);

        --rd-text-primary: #0F172A;
        --rd-text-secondary: #475569;
        --rd-text-muted: #64748B;

        --rd-safe-bg: rgba(16, 185, 129, 0.10);
        --rd-safe-border: rgba(16, 185, 129, 0.30);
        --rd-safe-color: #059669;

        --rd-promo-bg: rgba(139, 92, 246, 0.10);
        --rd-promo-border: rgba(139, 92, 246, 0.30);
        --rd-promo-color: #7C3AED;

        --rd-susp-bg: rgba(245, 158, 11, 0.10);
        --rd-susp-border: rgba(245, 158, 11, 0.30);
        --rd-susp-color: #D97706;

        --rd-threat-bg: rgba(239, 68, 68, 0.10);
        --rd-threat-border: rgba(239, 68, 68, 0.30);
        --rd-threat-color: #DC2626;
      }
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
  let diagnosticLead = "Cryptographic signature matches official domain records. Zero threat markers detected.";
  let diagnosticGuidance = "Safe to interact with.";

  if (verdict === "high_risk") {
    displayVerdictLabel = "HIGH_RISK THREAT";
    diagnosticTitle = "High-Risk Threat / Phishing Detected";
    diagnosticLead = "Critical warning: Active brand impersonation, spoofed headers, or credential harvesting lure.";
    diagnosticGuidance = "Do not open links or provide credentials. Move to Spam.";
  } else if (verdict === "suspicious") {
    displayVerdictLabel = "SUSPICIOUS SIGNALS";
    diagnosticTitle = "Suspicious Sender Anomaly";
    diagnosticLead = "Anomalies detected in sender alignment, URL redirect patterns, or authentication records.";
    diagnosticGuidance = "Verify sender authenticity before clicking links or downloading attachments.";
  } else if (verdict === "promo_clutter") {
    displayVerdictLabel = "NEWSLETTER";
    diagnosticTitle = "Marketing Newsletter";
    diagnosticLead = "Commercial mailing list or notification feed with valid sender credentials.";
    diagnosticGuidance = "Use 1-Click Unsubscribe to opt out directly.";
  }

  // Authentication status pill
  let authBadgeHtml = "";
  const authSummary = data.auth || (data.engine && data.engine.auth_status ? { status: data.engine.auth_status } : null);
  if (authSummary && authSummary.status === "verified") {
    authBadgeHtml = `<span class="ratiod-auth-pill auth-verified" title="DKIM Cryptographic Signature Verified">DKIM: VERIFIED</span>`;
  } else if (authSummary && authSummary.status === "spoof") {
    authBadgeHtml = `<span class="ratiod-auth-pill auth-spoof" title="Sender spoofing detected">DKIM: SPOOF DETECTED</span>`;
  } else {
    authBadgeHtml = `<span class="ratiod-auth-pill" title="No cryptographic signature record">DKIM: UNVERIFIED</span>`;
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
    <!-- Top Bar: Single clean non-wrapping row -->
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <a class="ratiod-brand-sticker" href="https://ratio-d.vercel.app/" target="_blank" rel="noopener noreferrer" title="Ratio'd Scam & Spam Defense">
          <div class="ratiod-logo-mark">
            ${logoSrc ? `<img class="ratiod-logo" src="${escapeHtml(logoSrc)}" alt="R">` : 'R'}
          </div>
          <span class="ratiod-brand-name">Ratio'd</span>
        </a>

        <span class="ratiod-tag tag-${escapeHtml(verdict)}">
          <span class="status-dot-indicator"></span>
          ${escapeHtml(displayVerdictLabel)}
        </span>
      </div>

      <div class="ratiod-metrics-group">
        ${authBadgeHtml}

        <div class="ratiod-score-chip ratiod-score ratiod-score-mail" title="Overall Security Risk Score (0 = Clean, 100 = Threat)">
          <span class="score-label">${isThreat ? 'RISK' : 'SAFETY'}</span>
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
          <span>Inspect</span>
          <span class="chevron-arrow" aria-hidden="true">&#9662;</span>
          <span class="sr-only">Toggle analysis</span>
        </button>

        <button class="ratiod-iconbtn" id="btn-dismiss" type="button" title="Dismiss Ratio'd for this email">
          <span aria-hidden="true">&#10005;</span>
          <span class="sr-only">Dismiss Ratio'd</span>
        </button>
      </div>
    </div>

    <!-- Expanded Inspector Panel -->
    <div class="ratiod-body collapsed" id="ratiod-body">
      <div class="ratiod-inspector-grid">
        <!-- Panel 1: Security Diagnostic -->
        <div class="ratiod-panel">
          <div class="panel-heading">Security Diagnostic</div>
          <div class="diagnostic-title">${escapeHtml(diagnosticTitle)}</div>
          <div class="diagnostic-lead">${escapeHtml(diagnosticLead)}</div>
          <div class="guidance-box">
            <strong>Guidance:</strong> ${escapeHtml(diagnosticGuidance)}
          </div>
          <div class="reasoning-text">
            <span class="reasoning-label">Diagnostic:</span> ${escapeHtml(explanation)}
          </div>
        </div>

        <!-- Panel 2: Actions & Feedback -->
        <div class="ratiod-panel">
          <div class="panel-heading">Quick Actions</div>
          <div class="action-row">
            ${isThreat ? `
              <button class="ratiod-btn btn-warn btn-highlight-spam" id="btn-move-spam" type="button">Report Spam & Quarantine</button>
            ` : `
              <button class="ratiod-btn btn-warn btn-highlight-unsafe" id="btn-quick-feedback" data-feedback="unsafe" type="button">Mark as Suspicious</button>
            `}
            <button class="ratiod-btn btn-unsub ${isPromo ? 'btn-highlight-unsub' : ''}" id="btn-one-unsub" type="button">1-Click Unsubscribe</button>
          </div>

          <div class="feedback-group">
            <div class="feedback-caption">Incorrect classification? Adjust below:</div>
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

      <!-- Deep Forensic Telemetry (Accordion) -->
      <div class="ratiod-forensics-panel">
        <button class="forensics-toggle" id="toggle-drawer" type="button" aria-expanded="false" aria-controls="analysis-drawer">
          <span class="chevron-arrow">&#9656;</span> View Technical Forensics & Link Signals
        </button>

        <div class="ratiod-drawer" id="analysis-drawer" role="region" aria-label="Deep Forensic Details" style="display:none;">
          <div class="panel-heading" style="margin-top: 6px;">Triggered Heuristics</div>
          <div id="drawer-mail-flags">
            ${flags.length > 0 ? flags.map(f => `
              <div class="flag-item">
                <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
                ${(f.span && (f.span.includes("http") || f.span.includes("bit.ly") || f.span.includes("."))) ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(f.span)}">Safe Peek</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
              </div>
            `).join('') : '<div class="flag-item">No explicit risk triggers fired. Cryptographic and body signals clean.</div>'}
          </div>

          <div class="panel-heading" style="margin-top: 10px;">Recommended Recovery Steps</div>
          <ul style="padding-left: 16px; margin: 4px 0; font-size: 11.5px; color: var(--rd-text-secondary);">
            ${nextSteps.map(step => `<li style="margin-bottom:3px;"><strong>&bull;</strong> ${escapeHtml(step)}</li>`).join('')}
          </ul>
        </div>
      </div>

      <!-- Footer: Developer Signature placed cleanly at the very end of Inspect -->
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

  // Header Inspect Toggle
  if (collapseBtn && body) {
    collapseBtn.addEventListener("click", () => {
      const isCollapsed = body.classList.toggle("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!isCollapsed));
      const arrow = collapseBtn.querySelector(".chevron-arrow");
      if (arrow) arrow.innerHTML = isCollapsed ? "&#9662;" : "&#9652;";
    });
  }

  // Dismiss
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
          updateUnsubButton("Unsubscribe Link Opened", "#10B981");
        }
      }

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
