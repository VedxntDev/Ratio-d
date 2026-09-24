# Ratio'd — Scam Risk Analyzer & Defense System
**Cybersecurity & Defense Track · Team Skill Issue**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Design System](https://img.shields.io/badge/Design_System-Playful_Neo--Brutalist-orange)](#design-system)

**Ratio'd** is a privacy-first cybersecurity tool that analyzes emails, SMS messages, and security telemetry for scam risks. Built using the **Playful Neo-Brutalist Utility** design system, it delivers instant client-side PII redaction, a live 4-stage GSAP pipeline, an elastic spring-animated risk gauge (0–100), an annotated threat inspector, and grounded recovery checklists.

---

## 🚀 Key Features

- **🔒 Client-Side PII Redaction**: Phone numbers, email addresses, and OTP passcodes are stripped locally in browser memory before any data dispatch.
- **⚡ Hybrid Threat Engine**: Channel-aware rules detecting domain lookalikes (`paypa1.com`, `.xyz`), link text vs href mismatches, urgency coercion ("account suspended within 24 hours"), and credential requests.
- **🛡️ Manifest V3 Gmail Extension**: Injects an isolated Shadow DOM security banner (`[ RATIO'D · HIGH_RISK ]`) directly into open Gmail emails without CSS leakage.
- **📊 4-Stage GSAP Pipeline**: Live Observe → Detect → Explain → Respond visualization with elastic spring score reveals.
- **🚫 One-Click Move to Spam**: Direct integration allowing users to flag marketing newsletters and phishing blasts.

---

## 🎨 Design System & Tokens (Playful Neo-Brutalist Utility)

- **Canvas & Card**: `#F8F7F2` (Warm Canvas), `#FFFFFF` (Surface Card), `#121212` (Ink Border & Text)
- **Primary Accent**: `#EA3E2B` (Orange-Red)
- **Secondary Status Badge**: `#8A8B5C` (Muted Olive)
- **Typography**: `Plus Jakarta Sans` (Display/Headings), `Instrument Serif` (Italic Accent Words), `Inter` (Body), `JetBrains Mono` (System Telemetry & Brackets)
- **Tactile UI System**: `2px` solid ink borders, `4px 4px 0px #121212` hard physical shadows with press interaction (`translate(2px, 2px)`).

---

## 📁 Repository Structure

```
.
├── web/                          # SMS/paste web app console (HTML/CSS/JS + GSAP)
│   ├── index.html
│   ├── styles.css                # Playful Neo-Brutalist stylesheet
│   └── js/                       # Redactor, presets, API client, GSAP pipeline
├── extension/                    # Gmail Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content-script.js         # Gmail DOM scanner & client-side redactor
│   ├── banner.js                 # Isolated Shadow DOM banner injector
│   ├── background.js             # Service worker proxy
│   └── icons/                    # Modern 16px, 48px, 128px, 512px icons
├── server/                       # Backend Express-compatible security API
│   ├── server.js                 # HTTP service on port 3000
│   ├── routes/analyze.js         # POST /analyze route handler
│   ├── rules/engine.js           # Deterministic threat & promo rules
│   └── laya/client.js            # Model classifier fallback
└── docs/                         # Project report & audit documentation
```

---

## 🛠️ Getting Started

### 1. Start the Security Backend Service
```bash
cd server
node server.js
```
*Runs locally on http://localhost:3000.*

### 2. Run the Web Application Console
```bash
cd web
python3 -m http.server 8999
```
*Open http://localhost:8999 in your browser.*

### 3. Load Chrome Extension in Gmail
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open [Gmail](https://mail.google.com) and click any email to view the live security banner!

---

## 📜 License & Acknowledgments

Built for Cybersecurity & Defense Track by Team Skill Issue. MIT License.
