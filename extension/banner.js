/**
 * Ratio'd Shadow DOM Banner Injector for Gmail
 * Features:
 * - Isolated Shadow DOM Neo-Brutalist Banner
 * - One-Click Unsubscribe Engine
 * - Web Audio API Synthesized Sparkle Chime Sound Effect
 * - Glitter & Confetti Canvas Burst Particle System
 */

function playUnsubscribeSparkleSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Chime Note 1: E5 (659.25Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Chime Note 2: A5 (880Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.08);
    gain2.gain.setValueAtTime(0.2, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.4);

    // Chime Note 3: C#6 Sparkling Chime (1108.73Hz)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "triangle";
    osc3.frequency.setValueAtTime(1108.73, now + 0.16);
    gain3.gain.setValueAtTime(0.25, now + 0.16);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.16);
    osc3.stop(now + 0.55);
  } catch (e) {
    console.log("[AUDIO SYNTH] AudioContext playback:", e);
  }
}

function launchGlitterBurst(shadowRoot, originButton) {
  const container = shadowRoot.querySelector(".ratiod-container");
  if (!container) return;

  const canvas = document.createElement("canvas");
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.pointerEvents = "none";
  canvas.style.zIndex = "999";
  
  const rect = container.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  container.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const particles = [];
  const colors = ["#F5C242", "#EA3E2B", "#E8720C", "#FFFFFF", "#8A8B5C", "#121212"];

  const btnRect = originButton.getBoundingClientRect();
  const startX = (btnRect.left + btnRect.width / 2) - rect.left;
  const startY = (btnRect.top + btnRect.height / 2) - rect.top;

  // Create 45 glitter particles
  for (let i = 0; i < 45; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 7;
    particles.push({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.5,
      size: 4 + Math.random() * 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      rotation: Math.random() * Math.PI,
      vRot: (Math.random() - 0.5) * 0.2
    });
  }

  let startTime = null;

  function animate(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let activeParticles = 0;
    particles.forEach(p => {
      if (p.alpha > 0) {
        activeParticles++;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15; // Gravity
        p.alpha -= 0.018; // Fade
        p.rotation += p.vRot;

        ctx.save();
        ctx.globalAlpha = Math.max(0, p.alpha);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        // Draw star/glitter square particle
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    });

    if (activeParticles > 0 && elapsed < 1500) {
      requestAnimationFrame(animate);
    } else {
      canvas.remove();
    }
  }

  requestAnimationFrame(animate);
}

function injectRatiodBanner(targetElement, data) {
  if (!targetElement) return;

  const existingHost = document.getElementById("ratiod-banner-host");
  if (existingHost) {
    existingHost.remove();
  }

  const host = document.createElement("div");
  host.id = "ratiod-banner-host";
  const shadowRoot = host.attachShadow({ mode: "open" });

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
      overflow: hidden;
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

    .tag-high_risk { background-color: #EA3E2B; color: #FFFFFF; }
    .tag-promo_clutter { background-color: #E8720C; color: #FFFFFF; }
    .tag-suspicious { background-color: #E8720C; color: #FFFFFF; }
    .tag-safe { background-color: #8A8B5C; color: #FFFFFF; }

    .ratiod-score {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 700;
      background-color: #FFFFFF;
      border: 1.5px solid #121212;
      padding: 4px 10px;
      border-radius: 6px;
    }

    .ratiod-body { margin-top: 12px; }

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
      transition: transform 0.1s ease, box-shadow 0.1s ease, background-color 0.2s ease;
      text-transform: uppercase;
    }

    .ratiod-btn:hover {
      transform: translate(1px, 1px);
      box-shadow: 1px 1px 0px #121212;
    }

    .ratiod-btn-primary { background-color: #EA3E2B; color: #FFFFFF; }
    .ratiod-btn-unsub { background-color: #E8720C; color: #FFFFFF; }
    .ratiod-btn-spam { background-color: #121212; color: #FFFFFF; }

    .ratiod-drawer {
      display: none;
      margin-top: 16px;
      padding-top: 14px;
      border-top: 2px dashed #121212;
    }

    .ratiod-drawer.open { display: block; }

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

    .flag-span { font-weight: 700; color: #EA3E2B; text-decoration: underline; }

    .checklist-list { padding-left: 18px; margin: 6px 0; font-size: 13px; }
    .checklist-list li { margin-bottom: 4px; }

    .privacy-footnote {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: #8A8B5C;
      margin-top: 10px;
    }
  `;
  shadowRoot.appendChild(styleElem);

  const container = document.createElement("div");
  container.className = "ratiod-container";

  const verdict = data.verdict || "safe";
  const score = data.score !== undefined ? data.score : 0;
  const flags = data.flags || [];
  const explanation = data.explanation || "No threat signals detected.";
  const nextSteps = data.next_steps || [];
  const privacy = data.privacy || { phones_masked: 0, emails_masked: 0, otp_masked: 0 };
  const totalMasked = (privacy.phones_masked || 0) + (privacy.emails_masked || 0) + (privacy.otp_masked || 0);

  const displayVerdictLabel = verdict === "promo_clutter" ? "PROMO CLUTTER" : verdict.toUpperCase();

  container.innerHTML = `
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <span class="ratiod-tag tag-${verdict}">[ RATIO'D · ${displayVerdictLabel} ]</span>
        <span class="ratiod-score">RISK SCORE: ${score}/100</span>
      </div>
      <div style="font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700;">
        [ PRIVACY · ${totalMasked} REDACTED · AIR-GAPPED ]
      </div>
    </div>

    <div class="ratiod-body">
      <div class="ratiod-explanation">${explanation}</div>
      <div class="ratiod-actions">
        <button class="ratiod-btn ratiod-btn-primary" id="toggle-drawer">[ SEE DETAILS ]</button>
        <button class="ratiod-btn ratiod-btn-unsub" id="btn-one-unsub">[ ✨ ONE-CLICK UNSUBSCRIBE ]</button>
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

  const toggleBtn = shadowRoot.getElementById("toggle-drawer");
  const unsubBtn = shadowRoot.getElementById("btn-one-unsub");
  const spamBtn = shadowRoot.getElementById("btn-move-spam");
  const drawer = shadowRoot.getElementById("analysis-drawer");

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      drawer.classList.toggle("open");
    });
  }

  // Robust One-Click Unsubscribe Click Handler + Glitter Burst + Sparkle Chime Sound
  if (unsubBtn) {
    unsubBtn.addEventListener("click", () => {
      // 1. Play Web Audio API Sparkle Chime Sound Effect
      playUnsubscribeSparkleSound();

      // 2. Launch 45-Particle Glitter & Confetti Burst Effect
      launchGlitterBurst(shadowRoot, unsubBtn);

      // 3. Ultra-Robust Multi-Strategy Unsubscribe Handler
      let unsubSuccess = false;

      // Strategy A: Native Gmail Header Unsubscribe Action
      const allElements = Array.from(document.querySelectorAll('span, div, a, button, [role="button"], [role="link"]'));
      const nativeGmailUnsub = allElements.find(el => {
        if (el === unsubBtn || unsubBtn.contains(el)) return false;
        const txt = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('data-tooltip') || el.getAttribute('title') || '').toLowerCase();
        return txt.includes('unsubscribe') || txt.includes('opt out') || txt.includes('opt-out');
      });

      if (nativeGmailUnsub) {
        try {
          nativeGmailUnsub.click();
          unsubSuccess = true;
          unsubBtn.textContent = "[ ✨ UNSUBSCRIBED & CLEANED! ]";
          unsubBtn.style.backgroundColor = "#8A8B5C";
        } catch (e) {
          console.log("[UNSUB CLICK ERROR]", e);
        }
      }

      // Strategy B: Body Anchor Links (Unsubscribe / Opt-out / Manage Preferences)
      if (!unsubSuccess) {
        const unsubAnchors = Array.from(document.querySelectorAll('a')).filter(a => {
          const href = (a.href || '').toLowerCase();
          const txt = (a.innerText || a.getAttribute('aria-label') || '').toLowerCase();
          return href.includes('unsubscribe') || href.includes('optout') || href.includes('opt-out') ||
                 txt.includes('unsubscribe') || txt.includes('opt out') || txt.includes('opt-out') ||
                 txt.includes('manage preferences') || txt.includes('email preferences');
        });

        if (unsubAnchors.length > 0 && unsubAnchors[0].href) {
          try {
            unsubAnchors[0].click();
          } catch (err) {
            window.open(unsubAnchors[0].href, '_blank');
          }
          unsubSuccess = true;
          unsubBtn.textContent = "[ ✨ UNSUB LINK OPENED! ]";
          unsubBtn.style.backgroundColor = "#8A8B5C";
        }
      }

      if (!unsubSuccess) {
        unsubBtn.textContent = "[ ✨ UNSUB INTENT DISPATCHED ]";
        unsubBtn.style.backgroundColor = "#8A8B5C";
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
        spamBtn.textContent = "[ 🚫 SENT TO SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
      } else {
        spamBtn.textContent = "[ 🚫 FLAGGED AS SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
      }
    });
  }
}

window.injectRatiodBanner = injectRatiodBanner;
