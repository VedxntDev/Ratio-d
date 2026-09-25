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

- **Canvas & Card**: `#F6F1E7` (Warm paper canvas with dot grid), `#FFFFFF` (Surface Card), `#121212` (Ink Border & Text)
- **Primary Accent**: `#EA3E2B` (Orange-Red)
- **Sticker Accents**: `#FFD23F` (Yellow), `#5DBBFF` (Blue), `#FF8FB1` (Pink), `#9BE86D` (Green)
- **Status Badges**: `#8A8B5C` (Muted Olive · Safe), `#E8720C` (Amber · Suspicious), `#EA3E2B` (Red · High Risk)
- **Typography**: `Plus Jakarta Sans` (Display/Headings), `Instrument Serif` (Italic Accent Words), `Inter` (Body), `JetBrains Mono` (System Telemetry & Brackets)
- **Tactile UI System**: `3px` solid ink borders, `6px 6px 0 #121212` hard physical shadows with press interaction (`translate(2px, 2px)`).

---

## 📁 Repository Structure

```
.
├── index.html                     # Web console (single source of truth)
├── styles.css                     # Playful Neo-Brutalist stylesheet
├── js/                            # Redactor, presets, API client, GSAP pipeline
├── assets/                        # Hero mascot artwork
├── extension/                     # Gmail Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content-script.js          # Gmail DOM scanner & client-side redactor
│   ├── banner.js                  # Isolated Shadow DOM banner injector
│   ├── background.js              # Service worker proxy
│   └── icons/                     # Modern 16px, 48px, 128px, 512px icons
├── server/                        # Backend security API
│   ├── server.js                  # HTTP service on port 3000 (also serves the console)
│   ├── routes/analyze.js          # POST /analyze route handler
│   ├── rules/engine.js            # Deterministic threat rules (homoglyph, Levenshtein, shorteners)
│   ├── laya/client.js             # Model classifier fallback
│   ├── llm/explain.js             # Grounded explanation generator
│   ├── combine/score.js           # Score + verdict + next-steps builder
│   ├── privacy/log.js             # Zero-persistence privacy telemetry
│   └── test-phishing.js           # Regression suite (5 cases)
├── api/index.js                   # Vercel serverless entry (shares the same pipeline)
├── vercel.json                    # Routing: /analyze, /health -> api/index.js
└── docs/                          # Project report & audit documentation
```

> **Note:** The frontend is served from the repository root by both the local
> server and Vercel. There is intentionally only **one** copy — earlier
> duplicated copies under `web/` caused localhost and production to drift apart.

---

## 🛠️ Getting Started

### 1. Start the Service (API + Web Console)
```bash
npm start
```
*or:* `node server/server.js`

This single process serves **both** the API and the web console:
- Console: **http://localhost:3000**
- API: `POST http://localhost:3000/analyze`, `GET http://localhost:3000/health`

### 2. (Optional) Serve the console on a separate port
```bash
python3 -m http.server 8999
```
*Run from the repository root, then open http://localhost:8999. The console will
still reach the analysis API on port 3000.*

### 3. Run the Phishing Regression Suite
```bash
node server/test-phishing.js
```
*Expected: `Summary: 5/5 Tests Passed`.*

### 4. Load Chrome Extension in Gmail
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open [Gmail](https://mail.google.com) and click any email to view the live security banner!

---

## 📜 License & Acknowledgments

Built for Cybersecurity & Defense Track by Team Skill Issue. MIT License.
