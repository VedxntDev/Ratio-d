/**
 * Ratio'd Shadow DOM Banner Injector for Gmail
 * Features:
 * - Isolated Shadow DOM Neo-Brutalist Banner
 * - One-Click Unsubscribe Engine
 * - Web Audio API Synthesized Sparkle Chime Sound Effect
 * - Glitter & Confetti Canvas Burst Particle System
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
    .tag-promo_clutter { background-color: #FFD23F; color: #121212; }
    .tag-suspicious { background-color: #E8720C; color: #FFFFFF; }
    .tag-safe { background-color: #9BE86D; color: #121212; }
    .tag-auth-spoof { background-color: #EA3E2B; color: #FFFFFF; }
    .tag-auth-verified { background-color: #9BE86D; color: #121212; }
    .tag-auth-unverified { background-color: #EFE9DC; color: #4A4741; }

    /* Brand mark, matching the site logo (neo-brutalist R badge). */
    .ratiod-logo {
      border-radius: 6px;
      border: 1.5px solid #121212;
      box-shadow: 2px 2px 0 #121212;
      flex: 0 0 auto;
      display: block;
    }

    /* Visually hidden text for screen readers on icon-only buttons. */
    .sr-only {
      position: absolute;
      width: 1px; height: 1px;
      padding: 0; margin: -1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
      white-space: nowrap;
      border: 0;
    }

    .ratiod-header-actions { display: flex; align-items: center; gap: 6px; }

    .ratiod-iconbtn {
      display: inline-grid;
      place-items: center;
      width: 26px; height: 26px;
      padding: 0;
      border-radius: 6px;
      border: 1.5px solid #121212;
      background-color: #FFFFFF;
      color: #121212;
      font-size: 13px;
      line-height: 1;
      cursor: pointer;
    }
    .ratiod-iconbtn:hover { background-color: #EFE9DC; }
    .ratiod-iconbtn:focus-visible,
    .ratiod-btn:focus-visible,
    .ratiod-cred:focus-visible {
      outline: 3px solid #EA3E2B;
      outline-offset: 2px;
    }

    /* Collapsed state: keep the score visible, hide the advice + actions. */
    .ratiod-body.collapsed { display: none; }

    /* Author credit, mirroring the site footer. */
    .ratiod-credit {
      margin-top: 12px;
      padding-top: 10px;
      border-top: 1px dashed #121212;
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      color: #4A4741;
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .ratiod-cred { color: #121212; font-weight: 700; text-decoration: underline; }
    .ratiod-cred:hover { color: #EA3E2B; }

    /* Respect the OS "reduce motion" setting: no confetti, no sound surprises. */
    @media (prefers-reduced-motion: reduce) {
      .ratiod-container, .ratiod-btn { transition: none; }
    }

    .ratiod-score {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      font-weight: 700;
      background-color: #FFFFFF;
      border: 1.5px solid #121212;
      padding: 4px 8px;
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      box-shadow: 2px 2px 0 #121212;
    }

    .ratiod-score-mail {
      background-color: #FFFFFF;
      color: #121212;
    }

    .ratiod-score-qr {
      background-color: #FFFFFF;
      color: #121212;
      transition: background-color 0.2s ease, color 0.2s ease;
    }

    .ratiod-score-qr.qr-high_risk, .ratiod-score-qr.qr-malicious {
      background-color: #EA3E2B;
      color: #FFFFFF;
    }

    .ratiod-score-qr.qr-suspicious {
      background-color: #FFD23F;
      color: #121212;
    }

    .ratiod-score-qr.qr-safe {
      background-color: #9BE86D;
      color: #121212;
    }

    .ratiod-score-qr.qr-none {
      background-color: #EFE9DC;
      color: #4A4741;
    }

    .score-type-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 1px 4px;
      margin-right: 6px;
      border-radius: 3px;
      border: 1px solid #121212;
      background: #EFE9DC;
      color: #121212;
      text-transform: uppercase;
      vertical-align: middle;
    }

    .ratiod-score-qr.qr-high_risk .score-type-badge,
    .ratiod-score-qr.qr-malicious .score-type-badge {
      background: #FFFFFF;
      color: #EA3E2B;
      border-color: #121212;
    }

    .drawer-sub-heading {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 700;
      color: #4A4741;
      margin: 4px 0 8px 0;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .qr-banner-card {
      background: #FFFFFF;
      border: 1.5px solid #121212;
      border-radius: 8px;
      padding: 10px 12px;
      margin: 6px 0 10px 0;
      box-shadow: 2px 2px 0 #121212;
    }

    .qr-banner-card.card-high_risk, .qr-banner-card.card-malicious {
      border-left: 6px solid #EA3E2B;
    }
    .qr-banner-card.card-suspicious {
      border-left: 6px solid #E8720C;
    }
    .qr-banner-card.card-safe {
      border-left: 6px solid #9BE86D;
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
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 800;
      color: #121212;
      text-transform: uppercase;
      margin-top: 6px;
    }

    .qr-banner-code {
      display: block;
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      word-break: break-all;
      background: #F8F7F2;
      border: 1.5px dashed #121212;
      padding: 6px 10px;
      border-radius: 6px;
      margin: 6px 0;
      color: #121212;
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
    .flag-peek-btn {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      margin-left: 8px;
      border: 1.5px solid #121212;
      background: #FFFFFF;
      color: #121212;
      border-radius: 4px;
      cursor: pointer;
      box-shadow: 1px 1px 0 #121212;
      text-transform: uppercase;
    }
    .flag-peek-btn:hover { background: #FFD23F; }
    .flag-peek-res {
      margin-top: 6px;
      padding: 6px 8px;
      background: #F8F7F2;
      border: 1px dashed #121212;
      border-radius: 4px;
      font-size: 11px;
      line-height: 1.4;
    }

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
  const mailScore = data.mail_score !== undefined ? data.mail_score : (data.score !== undefined ? data.score : 0);
  const score = data.score !== undefined ? data.score : mailScore;
  const flags = data.flags || [];
  const explanation = data.explanation || "No threat signals detected.";
  const nextSteps = data.next_steps || [];
  const privacy = data.privacy || { phones_masked: 0, emails_masked: 0, otp_masked: 0 };
  const totalMasked = (privacy.phones_masked || 0) + (privacy.emails_masked || 0) + (privacy.otp_masked || 0);

  const displayVerdictLabel = verdict === "promo_clutter" ? "PROMO CLUTTER" : verdict.toUpperCase();

  const qrData = data.qr || (window.__latestQrScanResult ? window.__latestQrScanResult : null);
  let qrScoreText = "NO QR DETECTED";
  let qrChipClass = "qr-none";
  let qrVerdictLabel = "NONE";
  let qrFlags = [];
  let qrPayload = "";
  let qrDefanged = "";
  let qrKind = "";

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
  }

  let authBadgeHtml = "";
  const authSummary = data.auth || (data.engine && data.engine.auth_status ? { status: data.engine.auth_status } : null);
  if (authSummary && authSummary.status) {
    if (authSummary.status === "spoof") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-spoof">[ ⚠️ SPOOF: DKIM MISMATCH ]</span>`;
    } else if (authSummary.status === "verified") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-verified">[ 🔒 AUTH: VERIFIED ]</span>`;
    } else if (authSummary.status === "unverified") {
      authBadgeHtml = `<span class="ratiod-tag tag-auth-unverified">[ AUTH: UNVERIFIED ]</span>`;
    }
  }

  let logoSrc = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='10' fill='%23EA3E2B'/%3E%3Ctext x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23FFFFFF' font-size='28' font-weight='800' font-family='sans-serif'%3ER%3C/text%3E%3C/svg%3E";
  try {
    if (typeof chrome !== "undefined" && chrome.runtime && typeof chrome.runtime.getURL === "function") {
      const url = chrome.runtime.getURL("icons/icon48.png");
      if (url) logoSrc = url;
    }
  } catch (e) {}

  container.innerHTML = `
    <div class="ratiod-header">
      <div class="ratiod-badge-group">
        <img class="ratiod-logo" src="${escapeHtml(logoSrc)}" alt="" width="28" height="28">
        <span class="ratiod-tag tag-${escapeHtml(verdict)}">[ ${escapeHtml(displayVerdictLabel)} ]</span>
        ${authBadgeHtml}
        <span class="ratiod-score ratiod-score-mail" title="Mail Security Risk Score"><span class="score-type-badge">MAIL</span>${escapeHtml(mailScore)}/100</span>
        <span class="ratiod-score ratiod-score-qr ${escapeHtml(qrChipClass)}" id="banner-qr-score" title="QR Security Code Risk Score"><span class="score-type-badge">QR CODE</span><span id="banner-qr-score-val">${escapeHtml(qrScoreText)}</span></span>
      </div>
      <div class="ratiod-header-actions">
        <button class="ratiod-iconbtn" id="btn-collapse" type="button" aria-expanded="true" aria-controls="ratiod-body" title="Collapse">
          <span aria-hidden="true">&#9662;</span><span class="sr-only">Collapse analysis</span>
        </button>
        <button class="ratiod-iconbtn" id="btn-dismiss" type="button" title="Dismiss Ratio'd for this email">
          <span aria-hidden="true">&#10005;</span><span class="sr-only">Dismiss Ratio'd</span>
        </button>
      </div>
    </div>

    <div class="ratiod-body" id="ratiod-body">
      <div class="ratiod-explanation">${escapeHtml(explanation)}</div>
      <div class="ratiod-actions">
        <button class="ratiod-btn ratiod-btn-primary" id="toggle-drawer" type="button" aria-expanded="false" aria-controls="analysis-drawer">[ SEE DETAILS ]</button>
        <button class="ratiod-btn ratiod-btn-unsub" id="btn-one-unsub" type="button">[ &#10024; UNSUBSCRIBE ]</button>
        <button class="ratiod-btn ratiod-btn-spam" id="btn-move-spam" type="button">[ &#128683; REPORT SPAM ]</button>
      </div>

      <div class="ratiod-drawer" id="analysis-drawer" role="region" aria-label="Full Ratio'd analysis">
        <div class="drawer-section-title">[ ✉️ MAIL SECURITY ANALYSIS ]</div>
        <div class="drawer-sub-heading">Mail Risk Score: ${escapeHtml(mailScore)}/100 &bull; Status: ${escapeHtml(displayVerdictLabel)}</div>
        <div id="drawer-mail-flags">
          ${flags.length > 0 ? flags.map(f => `
            <div class="flag-item">
              <span class="flag-span">${escapeHtml(f.span)}</span> &mdash; ${escapeHtml(f.reason)}
              ${(f.span && (f.span.includes("http") || f.span.includes("bit.ly") || f.span.includes("."))) ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(f.span)}">[ &#128269; Safe Peek ]</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
            </div>
          `).join('') : '<div class="flag-item">No explicit email threat rules triggered.</div>'}
        </div>

        <div class="drawer-section-title" style="margin-top: 14px;">[ 📱 QR SECURITY CODE ANALYSIS ]</div>
        <div id="drawer-qr-section">
          ${qrData ? `
            <div class="qr-banner-card card-${escapeHtml(qrChipClass.replace('qr-', ''))}">
              <div class="qr-banner-card-header">
                <div><strong>QR CODE VERDICT:</strong> <span class="ratiod-tag tag-${escapeHtml(qrChipClass.replace('qr-', ''))}">[ ${escapeHtml(qrVerdictLabel)} ]</span></div>
                <span class="ratiod-score">QR RISK SCORE: ${escapeHtml(qrData.score !== undefined ? qrData.score : 0)}/100</span>
              </div>
              <div class="qr-banner-payload-label">DECODED QR PAYLOAD ${qrKind ? `(${escapeHtml(qrKind)})` : ''}:</div>
              <code class="qr-banner-code">${escapeHtml(qrDefanged || qrPayload)}</code>
              ${qrPayload ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(qrPayload)}">[ &#128269; Safe Peek QR Link ]</button><div class="flag-peek-res" style="display:none;"></div>` : ''}
              <div style="font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:700;margin-top:8px;">DETECTED QR CODE SIGNALS:</div>
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

        <div class="drawer-section-title" style="margin-top: 14px;">[ RECOMMENDED ACTION CHECKLIST ]</div>
        <ul class="checklist-list">
          ${nextSteps.map(step => `<li><strong>&bull;</strong> ${escapeHtml(step)}</li>`).join('')}
        </ul>

        <div class="privacy-footnote">
          &#10003; Real-time PII redaction active: ${escapeHtml(privacy.phones_masked || 0)} phone(s), ${escapeHtml(privacy.emails_masked || 0)} email(s), ${escapeHtml(privacy.otp_masked || 0)} code(s) &mdash; ${escapeHtml(totalMasked)} item(s) masked before analysis. Zero message text stored.
        </div>
      </div>
    </div>

    <div class="ratiod-credit">
      <span>Ratio'd &middot; developed by
        <a class="ratiod-cred" href="https://github.com/VedxntDev" target="_blank" rel="noopener noreferrer">Vedant</a>
      </span>
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
  const collapseBtn = shadowRoot.getElementById("btn-collapse");
  const dismissBtn = shadowRoot.getElementById("btn-dismiss");
  const body = shadowRoot.getElementById("ratiod-body");

  if (toggleBtn && drawer) {
    toggleBtn.addEventListener("click", () => {
      const open = drawer.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
      toggleBtn.textContent = open ? "[ HIDE DETAILS ]" : "[ SEE DETAILS ]";
    });
  }

  // Collapse: keep the score badge on screen, hide the advice and actions.
  if (collapseBtn && body) {
    collapseBtn.addEventListener("click", () => {
      const collapsed = body.classList.toggle("collapsed");
      collapseBtn.setAttribute("aria-expanded", String(!collapsed));
      collapseBtn.title = collapsed ? "Expand" : "Collapse";
      collapseBtn.querySelector("[aria-hidden]").innerHTML = collapsed ? "&#9652;" : "&#9662;";
    });
  }

  // Dismiss: the user is not going to read this banner for this message, and a
  // banner they cannot get rid of trains people to ignore every banner.
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      if (host.parentElement) host.parentElement.removeChild(host);
    });
  }

  function bindSafePeek(root) {
    root.querySelectorAll(".flag-peek-btn").forEach((btn) => {
      if (btn.__bound) return;
      btn.__bound = true;
      btn.addEventListener("click", async () => {
        const targetUrl = btn.getAttribute("data-peek-url");
        const resContainer = btn.nextElementSibling;
        if (!targetUrl || !resContainer) return;

        btn.disabled = true;
        btn.textContent = "[ Tracing... ]";
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
          const vColor = unmasked.risk?.verdict === 'high_risk' ? '#EA3E2B' : '#8A8B5C';
          resContainer.innerHTML = `
            <strong>Safe Peek:</strong> ${escapeHtml(unmasked.hops)} hop(s) &rarr; Destination: <strong>${dest}</strong><br>
            Risk Verdict: <span style="font-weight:800;color:${vColor}">${v}</span> (Score: ${sc}/100)
          `;
        } else {
          resContainer.textContent = "Could not trace route (offline or unresolvable).";
        }
        btn.disabled = false;
        btn.textContent = "[ 🔍 Safe Peek ]";
      });
    });
  }

  // Safe Peek Zero-Execution Link Redirect Tracer
  bindSafePeek(shadowRoot);

  // Robust One-Click Unsubscribe Click Handler + Glitter Burst + Sparkle Chime Sound
  if (unsubBtn) {
    unsubBtn.addEventListener("click", () => {
      // 1. Play Web Audio API Sparkle Chime Sound Effect & Glitter Burst
      if (!prefersReducedMotion()) {
        playUnsubscribeSparkleSound();
        launchGlitterBurst(shadowRoot, unsubBtn);
      }

      // 2. Multi-Strategy Unsubscribe Handler
      let unsubSuccess = false;

      // Strategy A: Gmail Native Header Unsubscribe Action
      // Find native header controls outside the email body (.a3s) and outside Ratio'd banner
      const headerArea = document.querySelector(".gE, .ha, .gD, .iv, .adn, [role='main']") || document;
      const nativeCandidates = Array.from(headerArea.querySelectorAll(
        '.aG, span.aG, div.aG, [data-tooltip*="Unsubscribe" i], [aria-label*="Unsubscribe" i], [aria-label*="Opt out" i], [act="10"]'
      )).filter(el => {
        if (el.closest('.ratiod-shadow-host') || el === unsubBtn || unsubBtn.contains(el)) return false;
        if (el.closest('.a3s')) return false;
        return true;
      });

      if (nativeCandidates.length > 0) {
        try {
          nativeCandidates[0].click();
          unsubSuccess = true;
          unsubBtn.textContent = "[ ✨ UNSUBSCRIBED & CLEANED! ]";
          unsubBtn.style.backgroundColor = "#8A8B5C";

          // Auto-confirm Gmail's native popup dialog if it opens
          setTimeout(() => {
            const dialogConfirmBtn = document.querySelector(
              'div[role="dialog"] button[name="ok"], div[role="dialog"] button[aria-label*="Unsubscribe" i], div[role="dialog"] .T-I-ATL, div[role="dialog"] button:not([aria-label*="Cancel" i])'
            );
            if (dialogConfirmBtn) {
              try { dialogConfirmBtn.click(); } catch(e){}
            }
          }, 350);
        } catch (e) {
          console.log("[NATIVE UNSUB ERROR]", e);
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

          try {
            targetAnchor.click();
          } catch (e) {}

          if (rawUrl && (rawUrl.startsWith('http://') || rawUrl.startsWith('https://'))) {
            try {
              window.open(rawUrl, '_blank');
            } catch (e) {
              const a = document.createElement('a');
              a.href = rawUrl;
              a.target = '_blank';
              a.rel = 'noopener noreferrer';
              a.click();
            }
          } else if (rawUrl && rawUrl.startsWith('mailto:')) {
            window.location.href = rawUrl;
          }

          unsubSuccess = true;
          unsubBtn.textContent = "[ ✨ UNSUB LINK OPENED! ]";
          unsubBtn.style.backgroundColor = "#8A8B5C";
        }
      }

      // Strategy C: Mailto Fallback
      if (!unsubSuccess) {
        const bodyText = (document.querySelector('.a3s') || document.body).innerText || '';
        const mailtoMatch = bodyText.match(/mailto:\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
        if (mailtoMatch) {
          window.location.href = `mailto:${mailtoMatch[1]}?subject=Unsubscribe`;
          unsubSuccess = true;
          unsubBtn.textContent = "[ ✨ UNSUB MAILTO SENT ]";
          unsubBtn.style.backgroundColor = "#8A8B5C";
        }
      }

      if (!unsubSuccess) {
        unsubBtn.textContent = "[ ⚠️ NO UNSUB LINK FOUND ]";
        unsubBtn.style.backgroundColor = "#EA3E2B";
        setTimeout(() => {
          unsubBtn.textContent = "[ ✨ UNSUBSCRIBE ]";
          unsubBtn.style.backgroundColor = "#E8720C";
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
        spamBtn.textContent = "[ 🚫 SENT TO SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
      } else {
        spamBtn.textContent = "[ 🚫 FLAGGED AS SPAM ]";
        spamBtn.style.backgroundColor = "#8A8B5C";
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
      verdictTag.textContent = "[ HIGH RISK (QR PHISH) ]";
    }
    const explanationEl = root.querySelector(".ratiod-explanation");
    if (explanationEl && !explanationEl.textContent.includes("QR CODE SECURITY ALERT")) {
      explanationEl.innerHTML = `<strong>[ ⚠️ QR CODE SECURITY ALERT ]:</strong> Quishing payload detected in email image. ${explanationEl.innerHTML}`;
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

    const peekBtnHtml = payload ? `<button type="button" class="flag-peek-btn" data-peek-url="${escapeHtml(payload)}">[ &#128269; Safe Peek QR Link ]</button><div class="flag-peek-res" style="display:none;"></div>` : '';

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
        btn.textContent = "[ Tracing... ]";
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
          const vColor = unmasked.risk?.verdict === 'high_risk' ? '#EA3E2B' : '#8A8B5C';
          resContainer.innerHTML = `
            <strong>Safe Peek:</strong> ${escapeHtml(unmasked.hops)} hop(s) &rarr; Destination: <strong>${dest}</strong><br>
            Risk Verdict: <span style="font-weight:800;color:${vColor}">${v}</span> (Score: ${sc}/100)
          `;
        } else {
          resContainer.textContent = "Could not trace route (offline or unresolvable).";
        }
        btn.disabled = false;
        btn.textContent = "[ 🔍 Safe Peek ]";
      });
    });
  }
}

window.injectRatiodBanner = injectRatiodBanner;
window.updateRatiodBannerQr = updateRatiodBannerQr;
