# Ratio'd — Scam Risk Analyzer & Defense System
**Cybersecurity & Defense Track · Developed by [Vedant](https://github.com/VedxntDev)**

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

## 🔷 Brand Logo

`assets/logo.svg` is the single source of truth for the mark. Everything else is
generated from it — there are no hand-drawn PNGs to drift out of sync:

```bash
node tools/render-logo.js   # SVG -> favicon-16/32, apple-touch-180, extension 48/128/512
node tools/build-ico.js     # PNGs -> multi-size assets/favicon.ico (16/32/48)
cp assets/favicon.ico favicon.ico
```

The site declares the `.ico`, an SVG icon, PNG fallbacks, an `apple-touch-icon`,
a `mask-icon`, and Open Graph/Twitter cards. `favicon.ico` is also served from
the repository root because browsers probe `/favicon.ico` by default even when a
`<link rel="icon">` is present — without it the tab logs a 404.

The same mark is the Chrome extension icon and appears in the injected Gmail
banner (exposed via `web_accessible_resources`).

---

## 🧩 Chrome Extension

| Area | Detail |
| --- | --- |
| Verdict | Rendered from the API's `verdict` field, not re-derived from the score, so all four verdicts (`safe` / `suspicious` / `high_risk` / `promo_clutter`) label correctly |
| Escaping | `flags[].span` is a verbatim slice of the email body and `explanation` can be LLM-written. Both are passed through `escapeHtml()` before touching `innerHTML`, so a hostile email cannot execute script in the user's Gmail session |
| Controls | **Dismiss** removes the banner, **Collapse** hides the body but keeps the score visible, and the drawer toggle keeps `aria-expanded` in sync |
| Accessibility | Icon-only buttons carry `.sr-only` labels, all buttons are `type="button"`, and `prefers-reduced-motion: reduce` disables the confetti burst and chime |
| Credit | Banner footer links to the author's GitHub, matching the site |

Verify the real banner in a browser (not just by regex):

```bash
node tools/verify-banner.js
```

---

## 🧠 Detection Model

The rule engine contributes 70% of the score and the local Laya model 30%. The
model layers named, weighted **structural signals** on top of its existing token
and flag counts:

| Signal | Weight | Why |
| --- | --- | --- |
| `punycode_host` | 0.34 | `xn--` IDN hosts survive a copy-paste lookalike |
| `ip_literal_link` | 0.34 | Legitimate services use named hosts, not bare IPs |
| `data_uri` | 0.30 | Smuggles a payload past a mail gateway |
| `base64_blob` | 0.24 | Hides an attachment or redirect |
| `credential_or_wire` | 0.20 | Brand credential prompt, or a gift-card/crypto demand |
| `link_farm` | 0.18 | Five or more distinct outbound hosts in one message |

Signals past the second are damped, so a message tripping many of them is not
scored as many times as bad. Every signal name is returned in
`engine.model_signals` so the score is auditable rather than an unexplained
number, and `test-model-signals.js` pins both the attacks each signal must catch
and the benign traffic it must never touch.

---

## 📁 Repository Structure

```
.
├── index.html                     # Web console (single source of truth)
├── styles.css                     # Playful Neo-Brutalist stylesheet
├── js/                            # Redactor, presets, API client, GSAP pipeline
├── assets/                        # Brand logo + favicons + hero mascot artwork
├── favicon.ico                    # Root copy: browsers probe /favicon.ico by default
├── tools/                         # Build-time asset/verification scripts
│   ├── render-logo.js             # assets/logo.svg -> every PNG size (headless Chrome)
│   ├── build-ico.js               # PNGs -> multi-size .ico
│   └── verify-banner.js           # Renders the real extension banner in a browser
├── server.js                      # Universal entrypoint: HTTP server locally,
│                                  # (req,res) handler on Vercel
├── extension/                     # Gmail Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content-script.js          # Gmail DOM scanner & client-side redactor
│   ├── banner.js                  # Isolated Shadow DOM banner injector
│   ├── background.js              # Service worker proxy
│   └── icons/                     # Brand icons: 16px, 48px, 128px, 512px
├── server/                        # Analysis pipeline (shared by both runtimes)
│   ├── routes/analyze.js          # POST /analyze handler
│   ├── rules/engine.js            # Deterministic threat rules (homoglyph, Levenshtein, shorteners)
│   ├── laya/client.js             # Model classifier fallback
│   ├── llm/explain.js             # Grounded explanation generator
│   ├── combine/score.js           # Score + verdict + next-steps builder
│   ├── privacy/log.js             # Zero-persistence privacy telemetry
│   └── test-phishing.js           # Regression suite (5 cases)
├── api/index.js                   # Vercel function -> re-exports the root handler
├── vercel.json                    # Routing + blocks internal paths
└── docs/                          # Project report & audit documentation
```

> **Note:** The frontend is served from the repository root by both the local
> server and Vercel. There is intentionally only **one** copy — earlier
> duplicated copies under `web/` and `server/web/` caused localhost and
> production to drift apart. `server.js` is likewise the single HTTP entrypoint,
> so the two environments cannot diverge in behaviour.

---

## 🛠️ Getting Started

### 1. Start the Service (API + Web Console)
```bash
npm start
```
*or:* `node server.js`

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
npm test
```
*Expected: `Summary: 5/5 Tests Passed`.*

### 4. Deploy to Vercel
The production site is **https://ratio-d.vercel.app**.

The Vercel project must have **Root Directory = (empty / repo root)** and
**Framework = Other**. If Root Directory is left as `server`, Vercel never
sees `index.html` and every asset 404s.

```bash
npm i -g vercel
vercel link --project ratio-d --yes
vercel --prod
```

> `vercel.json` blocks `/server/*`, `/docs/*`, `/extension/*`, dotfiles and
> `package.json` from being served, and routes `/analyze` + `/health` to the
> serverless function in `api/index.js`.

### 5. Load Chrome Extension in Gmail
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open [Gmail](https://mail.google.com) and click any email to view the live security banner!

---

## 📜 License & Acknowledgments

Built for Cybersecurity & Defense Track by [Vedant](https://github.com/VedxntDev). MIT License.
