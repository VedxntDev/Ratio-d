/**
 * Ratio'd Shadow DOM Banner Injector for Gmail
 */

function injectRatiodBanner(targetElement, data) {
  if (!targetElement) return;

  // Remove existing banner if present
  const existingHost = document.getElementById("ratiod-banner-host");
  if (existingHost) {
    existingHost.remove();
  }

  // Create Shadow Host
  const host = document.createElement("div");
  host.id = "ratiod-banner-host";
  const shadowRoot = host.attachShadow({ mode: "open" });

  // Inlined isolated stylesheet inside Shadow DOM
  const styleElem = document.createElement("style");
  styleElem.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&family=Plus+Jakarta+Sans:wght@700;800&display=swap');

    :host {
      all: initial;
      display: block;
      font-family: 'Inter', sans-serif;
      margin: 16px 0;
      width: 100%;
    }

    * {
      box-sizing: border-box;
    }

    .ratiod-container {
      background-color: #F8F7F2;
      border: 2px solid #121212;
      border-radius: 12px;
      box-shadow: 4px 4px 0px #121212;
      color: #121212;
      padding: 16px 20px;
      position: relative;
      transition: transform 0.12s ease, box-shadow 0.12s ease;
    }

    .ratiod-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }

    .ratiod-badge-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .ratiod-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 8px;
      border-radius: 6px;
      border: 1.5px solid #121212;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .tag-high_risk {
      background-color: #EA3E2B;
      color: #FFFFFF;
    }

    .tag-suspicious {
      background-color: #E8720C;
      color: #FFFFFF;
    }

    .tag-safe {
      background-color: #8A8B5C;
      color: #FFFFFF;
    }

    .ratiod-score {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      background-color: #FFFFFF;
      border: 1.5px solid #121212;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .ratiod-body {
      margin-top: 12px;
    }

    .ratiod-explanation {
      font-size: 14px;
      line-height: 1.5;
      color: #121212;
      font-weight: 500;
    }

    .ratiod-actions {
      display: flex;
      gap: 10px;
      margin-top: 14px;
      flex-wrap: wrap;
    }

    .ratiod-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 8px 14px;
      border-radius: 8px;
      border: 2px solid #121212;
      background-color: #FFFFFF;
      color: #121212;
      cursor: pointer;
      box-shadow: 2px 2px 0px #121212;
      transition: transform 0.1s ease, box-shadow 0.1s ease;
      text-transform: uppercase;
    }

    .ratiod-btn:hover {
      transform: translate(1px, 1px);
      box-shadow: 1px 1px 0px #121212;
    }

    .ratiod-btn-primary {
      background-color: #EA3E2B;
      color: #FFFFFF;
    }

    .ratiod-btn-spam {
      background-color: #121212;
      color: #FFFFFF;
    }

    .ratiod-drawer {
      display: none;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 2px dashed #121212;
    }

    .ratiod-drawer.open {
      display: block;
    }

    .drawer-section-title {
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 13px;
      font-weight: 800;
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .flag-item {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      background: #FFFFFF;
      border: 1.5px solid #121212;
      padding: 6px 10px;
      border-radius: 6px;
      margin-bottom: 6px;
    }

    .flag-span {
      font-weight: 700;
      color: #EA3E2B;
      text-decoration: underline;
    }

    .checklist-list {
      padding-left: 18px;
      margin: 6px 0;
      font-size: 13px;
    }

    .checklist-list li {
      margin-bottom: 4px;
    }

    .privacy-footnote {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #8A8B5C;
      margin-top: 10px;
    }
  `;
  shadowRoot.appendChild(styleElem);

  // Build markup
  const container = document.createElement("div");
  container.className = "ratiod-container";

  const verdict = data.verdict || "safe";
  const score = data.score !== undefined ? data.score : 0;
  const flags = data.flags || [];
  const explanation = data.explanation || "No threat signals detected.";
  const nextSteps = data.next_steps || [];
  const privacy = data.privacy || { phones_masked: 0, emails_masked: 0, otp_masked: 0 };

  const totalMasked = (privacy.phones_masked || 0) + (privacy.emails_masked || 0) + (privacy.otp_masked || 0);

  container.innerHTML = `
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <span class="ratiod-tag tag-${verdict}">[ RATIO'D · ${verdict.toUpperCase()} ]</span>
        <span class="ratiod-score">RISK SCORE: ${score}/100</span>
      </div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">
        [ PRIVACY · ${totalMasked} REDACTED · AIR-GAPPED ]
      </div>
    </div>

    <div class="ratiod-body">
      <div class="ratiod-explanation">${explanation}</div>
      <div class="ratiod-actions">
        <button class="ratiod-btn ratiod-btn-primary" id="toggle-drawer">[ SEE THREAT DETAILS ]</button>
        <button class="ratiod-btn" id="toggle-checklist">[ RECOVERY CHECKLIST ]</button>
        <button class="ratiod-btn ratiod-btn-spam" id="btn-move-spam">[ 🚫 MOVE TO SPAM ]</button>
      </div>

      <div class="ratiod-drawer" id="analysis-drawer">
        <div class="drawer-section-title">[ DETECTED THREAT & PROMOTIONAL SPANS ]</div>
        ${flags.length > 0 ? flags.map(f => `
          <div class="flag-item">
            <span class="flag-span">${f.span}</span> — ${f.reason}
          </div>
        `).join('') : '<div class="flag-item">No explicit rule flags triggered.</div>'}

        <div class="drawer-section-title" style="margin-top: 12px;">[ RECOMMENDED ACTION CHECKLIST ]</div>
        <ul class="checklist-list">
          ${nextSteps.map(step => `<li><strong>•</strong> ${step}</li>`).join('')}
        </ul>

        <div class="privacy-footnote">
          ✓ Real-time PII redaction active: ${privacy.phones_masked || 0} phone(s), ${privacy.emails_masked || 0} email(s) masked before analysis. Zero message text stored.
        </div>
      </div>
    </div>
  `;

  shadowRoot.appendChild(container);

  if (targetElement.parentElement) {
    targetElement.parentElement.insertBefore(host, targetElement);
  } else {
    targetElement.prepend(host);
  }

  // Event handlers
  const toggleBtn = shadowRoot.getElementById("toggle-drawer");
  const checklistBtn = shadowRoot.getElementById("toggle-checklist");
  const spamBtn = shadowRoot.getElementById("btn-move-spam");
  const drawer = shadowRoot.getElementById("analysis-drawer");

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      drawer.classList.toggle("open");
    });
  }

  if (checklistBtn && drawer) {
    checklistBtn.addEventListener("click", () => {
      drawer.classList.add("open");
      drawer.scrollIntoView({ behavior: "smooth" });
    });
  }

  if (spamBtn) {
    spamBtn.addEventListener("click", () => {
      // 1. Try clicking Gmail's native Report Spam button in toolbar
      const gmailSpamBtn = document.querySelector(
        'div[aria-label*="Spam"], div[act="9"], div[data-tooltip*="Spam"], button[aria-label*="Spam"]'
      );
      if (gmailSpamBtn) {
        gmailSpamBtn.click();
        spamBtn.textContent = "[ 🚫 SENT TO GMAIL SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
      } else {
        spamBtn.textContent = "[ 🚫 FLAGGED AS SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
        alert("Email flagged as spam. Please click the Report Spam (exclamation mark) icon in Gmail's top toolbar.");
      }
    });
  }
}

window.injectRatiodBanner = injectRatiodBanner;
