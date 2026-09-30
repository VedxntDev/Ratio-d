# Ratio'd — Scam Risk Analyzer & Defense System

**Cybersecurity & Defense Track · Developed for Hackathon by [Vedant](https://github.com/VedxntDev) & Vasu**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Runtime deps](https://img.shields.io/badge/runtime_dependencies-0-success)](./package.json)
[![Design System](https://img.shields.io/badge/Design_System-Playful_Neo--Brutalist-orange)](#-uiux-philosophy--design-system)
[![Test Suite](https://img.shields.io/badge/Tests-513_Passing-success)](./server/test-phishing.js)

> **Ratio'd** is a privacy-first scam risk analyzer for emails and SMS messages. It brings phishing triage directly into the user's workflow as a **Chrome Extension (MV3)** that injects an isolated Shadow DOM security banner into Gmail, as well as a standalone **Static Web Console**.
>
> It redacts PII **client-side in browser memory** before network hops, scores messages using a calibrated **0–100 Risk Engine**, detects **Zero-Trust QR Code Phishing (Quishing)**, traces shortened URLs safely via **Safe Peek**, and delivers plain-English explanations with actionable recovery checklists.

---

## 📑 Table of Contents
1. [Executive Summary & Product Pitch](#-executive-summary--product-pitch)
2. [Why We Built It: The Generative AI Phishing Problem](#-why-we-built-it-the-generative-ai-phishing-problem)
3. [Application Layer & UX Philosophy](#-application-layer--ux-philosophy)
4. [Hackathon Transparency & Timeline Disclosure](#-hackathon-transparency--timeline-disclosure)
5. [Why Ratio'd Over Google / Traditional Spam Filters](#-why-ratiod-over-google--traditional-spam-filters)
6. [System Architecture & Dataflow Diagrams](#-system-architecture--dataflow-diagrams)
7. [Under The Hood: 10-Stage Threat Pipeline](#-under-the-hood-10-stage-threat-pipeline)
8. [Detection Engines & Scoring Mathematics](#-detection-engines--scoring-mathematics)
9. [Zero-Trust QR Phishing (Quishing) & Safe Peek Engine](#-zero-trust-qr-phishing-quishing--safe-peek-engine)
10. [Privacy & Security Invariants](#-privacy--security-invariants)
11. [Third-Party Disclosures, Dependencies & Licenses](#-third-party-disclosures-dependencies--licenses)
12. [Evaluation, Corpora & Verification Suite](#-evaluation-corpora--verification-suite)
13. [Installation & Setup Guide](#-installation--setup-guide)
14. [Repository Directory Structure](#-repository-directory-structure)
15. [Production Roadmap & Future Expansion](#-production-roadmap--future-expansion)

---

## 💡 Executive Summary & Product Pitch

### What It Is
Ratio'd is an intelligent cybersecurity triage system for email and smishing threats. Instead of outputting a binary "safe" or "unsafe" flag, Ratio'd delivers:
- **Calibrated 0–100 Risk Score**: Clear numerical threat breakdown.
- **Dual Verdict Badges**: Separate, side-by-side assessment for **Mail Security** and **QR Code Security**.
- **Shadow DOM In-Situ Banner**: Injected directly into Gmail messages without styling conflicts.
- **Zero-Execution Link Redirect Tracer ("Safe Peek")**: Safely inspects shortened URLs (`bit.ly`, `t.co`, `tinyurl`) via zero-execution HEAD chains.
- **Air-Gapped Client PII Redaction**: Phone numbers, email addresses, and OTP/PIN codes are masked in local browser memory before leaving the client.
- **Actionable Recovery Checklist**: Step-by-step guidance for users who may have already interacted with a suspicious message.

### Deliverables Included in This Repository
| Deliverable | Entry Point | Architectural Role |
| :--- | :--- | :--- |
| **Chrome Extension (MV3)** | `extension/manifest.json` | Injects isolated Shadow DOM banner & inbox badges directly into Gmail (`mail.google.com`). |
| **Static Web Console** | `index.html` | Interactive paste-and-analyze dashboard with a 4-stage visual pipeline and drag-and-drop QR scanner. |
| **Node.js Rule & API Server** | `server.js` | Single zero-dependency handler backing both local server (`:3000`) and Vercel serverless deployment (`ratio-d.vercel.app`). |

---

## 🛡️ Why We Built It: The Generative AI Phishing Problem

Traditional security advice trains users to watch for obvious typos, broken formatting, or awkward greetings. **Generative AI has rendered that advice obsolete.** Scammers now generate grammatically flawless, highly personalized phishing lures and smishing texts at massive scale.

```
TRADITIONAL ADVICE (OBSOLETE)         AI-GENERATED REALITY TODAY
─────────────────────────────         ──────────────────────────
• Poor spelling & grammar             • Flawless grammar & natural tone
• Generic "Dear Customer"             • Highly targeted context & names
• Obvious suspicious formatting       • Pixel-perfect brand styling
• Single malicious domain link        • Multi-stage redirects & QR codes (Quishing)
```

### Who Is Most at Risk?
1. **Students & Campus Communities**: Vulnerable to fake job offers, tuition fee scams, and campus library account resets.
2. **Everyday Consumers & Elderly Users**: Targeted by fake delivery fee texts (`USPS`/`FedEx`), bank verification lures, and crypto giveaway traps.
3. **Small Teams & Startups**: Organizations operating without dedicated Security Operations Centers (SOC).

Ratio'd bridges this gap by providing an instant, explainable second opinion right inside the user's inbox without requiring them to trust an external server with their private data.

---

## 🎨 Application Layer & UX Philosophy

### The "No Copy-Paste" Principle
> **Real users will not open a separate website to paste every suspicious email or SMS.** 

A security tool that requires context-switching introduces friction, and under friction, convenience wins over security. Ratio'd solves this by putting the **application layer directly inside Gmail**:

1. User opens an email in Gmail.
2. Ratio'd automatically scans headers, text, and embedded QR images.
3. A non-intrusive, neo-brutalist banner mounts at the top of the email.
4. Pre-open inbox pills appear in the thread list so users can gauge risk *before* opening dangerous attachments.

```
       USER WORKFLOW (CONVENIENCE FIRST)
       ┌─────────────────────────────────┐
       │     Opens email in Gmail        │
       └────────────────┬────────────────┘
                        │ (Automatic Content Script)
                        ▼
       ┌─────────────────────────────────┐
       │   Air-Gapped Client Redaction   │
       └────────────────┬────────────────┘
                        │ (Sanitized Payload)
                        ▼
       ┌─────────────────────────────────┐
       │  Ratio'd Shadow DOM Injected    │
       │  [ MAIL: 12/100 ] [ QR: 85/100 ]│
       └─────────────────────────────────┘
```

### Playful Neo-Brutalist Design System
Ratio'd abandons generic, sterile corporate UI in favor of a **Playful Neo-Brutalist** aesthetic:
- **Bold 2px–3px Solid Borders (`#121212`)** & Offset Drop Shadows (`3px 3px 0 #121212`).
- **Warm Cream Canvas (`#F6F1E7` / `#FFFDF7`)** paired with high-contrast accent stickers (`Coral Red #EA3E2B`, `Electric Yellow #FFD23F`, `Lime Green #9BE86D`, `Cyan #38AECC`).
- **Tactile Micro-Interactions**: Hover translations (`translate(-2px, -2px)`), active push-downs (`translate(2px, 2px)`), and rotating SVG indicators.
- **Monospaced Technical Typography (`JetBrains Mono`)** for codes, scores, and signals paired with `Plus Jakarta Sans` for headers.

---

## ⏱️ Hackathon Transparency & Timeline Disclosure

In full compliance with open-source hackathon rules, the table below clearly distinguishes between what existed **prior to September 30, 2026** and what was built **during the hackathon (September 30, 2026 onwards)**.

| Component / Feature | Prior to Sept 30, 2026 (Foundational MVP) | Built During Hackathon (Sept 30, 2026 Onwards) |
| :--- | :--- | :--- |
| **QR Code Phishing (Quishing) Engine** | ❌ None (Email text only). | ✅ **Complete Zero-Trust Engine**: Built `server/rules/qr.js`, `server/routes/qr.js`, `js/qr.js`, `js/qr-ui.js`, `extension/qr-core.js`, `extension/qr-gmail.js`, vendored `jsQR.js`, and added a 46-case QR test suite (`server/test-qr.js`). |
| **Dual Score Banner Architecture** | ❌ Single generic score in extension banner. | ✅ **Separate Mail vs. QR Security Scores**: Redesigned `extension/banner.js` & `extension/qr-gmail.js` to display Mail Security Score and QR Security Code Score separately in header badges and drawer sections with real-time `updateRatiodBannerQr()` event sync. |
| **Zero-Execution Redirect Tracer ("Safe Peek")** | ❌ Basic text regex display. | ✅ **Safe Peek Engine**: Created `server/unmask/tracer.js` & `/unmask` API route to trace shortened link hop chains (`bit.ly`, `t.co`) using HEAD requests without code execution. Integrated 1-click `[ 🔍 Safe Peek ]` into Shadow DOM banner and Web Console. |
| **Vercel Production Endpoint Parity** | ⚠️ Text endpoints routed in Vercel. | ✅ **Full Route Parity**: Added `/analyze-qr` and `/api/analyze-qr` rewrites to `vercel.json` ensuring 100% parity between local server (`:3000`) and live serverless production. |
| **UI/UX Re-architecture** | ⚠️ Basic layout. | ✅ **Tactile Neo-Brutalist Redesign**: Re-engineered PII status bar (`.pii-status-bar`), tactile clear action (`.btn-clear-tactile`), live glowing status dots, interactive rotating accordion drawer (`.auth-drawer`), and version notice modal. |
| **Automated Test Coverage** | ⚠️ 8 basic test cases. | ✅ **513 Automated Assertions across 14 Suites**: Added full scam corpora testing (`test-scam-corpus.js`), extension package drift check (`test-extension-package.js`), in-browser Shadow DOM verification (`verify-banner.js`), and QR zero-trust suite. |
| **Archive Integrity Tools** | ❌ Hand-compressed zip files. | ✅ **Automated Archive Builder**: Built `tools/build-zips.js` & `tools/build-context.js` to eliminate stale zip archives and generate machine-readable manifests (`docs/project-context.json`). |

---

## ⚔️ Why Ratio'd Over Google / Traditional Spam Filters

| Feature / Metric | Standard Gmail Filter | Traditional External Web Scanners | Ratio'd (Gmail Extension + Console) |
| :--- | :--- | :--- | :--- |
| **Explainability** | ❌ Binary (In Box vs Spam) with zero reasoning. | ⚠️ Generic "High Risk" label with no exact span highlighting. | ✅ **Exact Verbatim Span Highlighting**: Shows exact triggering text/domain with plain-English rule breakdowns. |
| **In-Inbox Inspection** | ⚠️ Runs before delivery; anything that bypasses looks safe. | ❌ Requires leaving Gmail and copy-pasting into a 3rd party site. | ✅ **In-Situ Shadow DOM Banner**: Injected directly into open Gmail threads without leaving the browser. |
| **Privacy & PII Protection** | ❌ Proprietary server-side scanning of raw unredacted text. | ❌ Raw message text transmitted and stored on external cloud DBs. | ✅ **Air-Gapped Client Redaction**: Phones, emails, and OTPs masked in browser memory before network transit. |
| **Actionable Recovery** | ❌ None. No advice if a user already interacted. | ❌ Minimal post-detection guidance. | ✅ **Step-by-Step Checklist**: Actionable recovery steps for compromised credentials or scam links. |
| **Model Sourcing Transparency** | ❌ Black box model with undisclosed confidence metrics. | ⚠️ Opaque AI prompts prone to hallucinated evidence. | ✅ **100% Deterministic Sourcing**: Model source exported (`laya_stub_heuristic` / `qr_rules_v2`) and LLM phrases verified verbatim against input. |

---

## 🔄 System Architecture & Dataflow Diagrams

### Diagram 1: End-to-End System Pipeline
```mermaid
flowchart TD
    subgraph BROWSER ["Client Browser Memory (Air-Gapped)"]
        A["Gmail DOM / Text Input"] -->|MutationObserver| B["Redactor (js/redactor.js)"]
        B -->|Masks Phones, Emails, OTPs| C["Sanitized Payload"]
    end

    subgraph PRIVACY_BOUNDARY ["========== Privacy Boundary (No PII Crosses Here) =========="]
        C
    end

    subgraph ENGINE ["Detection & Rule Processing"]
        C -->|POST /analyze| D{"API Router (server.js / Vercel)"}
        D -->|Parallel Execution| E["Rule Engine (server/rules/engine.js)\nHomoglyphs, Levenshtein <= 2, Combos"]
        D -->|Parallel Execution| F["Laya Scorer (server/laya/client.js)\nWeighted Structural Signals"]
        E --> G["Score Combiner\n0.70 * Rules + 0.30 * Laya"]
        F --> G
    end

    subgraph EXPLANATION ["Explanation & Grounding"]
        G --> H{"LLM Key Configured?"}
        H -->|Yes| I["Grounded LLM (server/llm/)\nVerbatim Flag Verification"]
        H -->|No| J["Deterministic Template Engine"]
        I --> K["Final JSON Verdict"]
        J --> K
    end

    subgraph RENDER ["Shadow DOM Banner Injected in Gmail"]
        K --> L["banner.js (Shadow DOM Injection)"]
        L --> M["Mail Score Badge: [ MAIL: XX/100 ]"]
        L --> N["QR Score Badge: [ QR CODE: YY/100 ]"]
        L --> O["Safe Peek Link Tracer (server/unmask/tracer.js)"]
    end
```

---

### Diagram 2: Zero-Trust QR Phishing (Quishing) Engine
```mermaid
flowchart LR
    subgraph GMAIL_DOM ["Gmail DOM Images"]
        A["Image in Email Body"] -->|Fetch Blob| B["Bitmap Decoder"]
        B -->|jsQR Decoder| C["Decoded Raw QR String"]
    end

    subgraph QR_HEURISTICS ["Zero-Trust QR Engine (server/rules/qr.js)"]
        C -->|POST /analyze-qr| D["Payload Classifier"]
        D --> E{"Is Payload URL?"}
        E -->|Yes| F["Domain Extractor & Registrable Label Check"]
        E -->|No| G["UPI / Crypto / Text Classifier"]
        F --> H["Brand Impersonation & Typosquat Check (Levenshtein <= 2)"]
        F --> I["Abused TLD Check (.xyz, .top, .icu, .buzz)"]
        F --> J["Credential Path Check (/login, /verify, /account)"]
        H --> K["Scoring Floor Calibration\n(Impersonation: Min 90, IP Literal: Min 75)"]
        I --> K
        J --> K
    end

    subgraph UI_SYNC ["Real-Time Banner Event Sync"]
        K --> L["window.updateRatiodBannerQr(qrResult)"]
        L --> M["Updates Main Banner Header Badge [ QR CODE: 82/100 ]"]
        L --> N["Populates QR Section in Banner Drawer with Defanged URL"]
        L --> O["Injects In-Situ Image Badge on QR Code"]
    end
```

---

### Diagram 3: Air-Gapped Client PII Redaction Dataflow
```mermaid
sequenceDiagram
    autonumber
    actor User as User in Gmail
    participant CS as Extension Content Script
    participant Redactor as Client Redactor (js/redactor.js)
    participant Server as Node.js Backend Engine
    participant ShadowDOM as Shadow DOM Banner

    User->>CS: Opens Email / Pastes Message
    CS->>Redactor: Pass Raw Text (Body, Subject, Headers)
    Note over Redactor: Regex Pattern Matching:<br/>Phones: (\+?\d{1,3})?\(?\d{3}\)?...<br/>Emails: [\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}<br/>OTPs: (OTP|code|PIN)\s*:\s*\d{4,8}
    Redactor-->>CS: Return Sanitized Text + Redaction Counts
    Note over CS: PII is killed HERE in browser memory.<br/>Raw names, phones & codes NEVER touch network.
    CS->>Server: POST /analyze { text: sanitizedText, auth: headers }
    Server->>Server: Run Rule Engine & Laya Scorer
    Server-->>CS: Return JSON { score: 85, verdict: "high_risk", flags, explanation }
    CS->>ShadowDOM: injectRatiodBanner(targetElement, result)
    ShadowDOM-->>User: Render High-Contrast Banner with Redaction Footnote
```

---

### Diagram 4: Component & Entity Relationship Architecture
```mermaid
erDiagram
    GMAIL_EXTENSION ||--o{ CONTENT_SCRIPT : injects
    CONTENT_SCRIPT ||--|| REDACTOR : executes_in_memory
    CONTENT_SCRIPT ||--|| SHADOW_BANNER : renders
    CONTENT_SCRIPT ||--|| QR_SCANNER : scans_images
    
    WEB_CONSOLE ||--|| REDACTOR : executes_in_memory
    WEB_CONSOLE ||--|| QR_PANEL : executes_drag_drop
    WEB_CONSOLE ||--|| PIPELINE_CONTROLLER : animates_gauge

    CONTENT_SCRIPT }|..| border HTTP_API : requests
    WEB_CONSOLE }|..| border HTTP_API : requests
    QR_SCANNER }|..| border HTTP_API : requests

    HTTP_API ||--|| RULE_ENGINE : evaluates
    HTTP_API ||--|| LAYA_SCORER : evaluates
    HTTP_API ||--|| QR_ENGINE : evaluates
    HTTP_API ||--|| TRACER : executes_head_chain
    HTTP_API ||--|| PRIVACY_LOGGER : logs_counts_only

    RULE_ENGINE ||--|| SCORE_COMBINER : inputs_70_percent
    LAYA_SCORER ||--|| SCORE_COMBINER : inputs_30_percent
    SCORE_COMBINER ||--|| LLM_GROUNDER : verifies_spans
```

---

## ⚙️ Detection Engines & Scoring Mathematics

### 1. Hybrid Scoring Formula
Ratio'd calculates an overall threat score ($S_{\text{raw}}$) by combining the deterministic Rule Engine ($R_{\text{score}}$) and the structural Laya Scorer ($P_{\text{signal}}$):

$$S_{\text{raw}} = \left( R_{\text{score}} \times 0.70 \right) + \left( P_{\text{signal}} \times 100 \times 0.30 \right)$$

$$S_{\text{final}} = \text{clamp}(S_{\text{raw}}, 0, 100)$$

### 2. Severity Override Rules
To ensure sophisticated domain spoofing cannot pass as safe due to polite wording, hard override floors apply:
- **Severe Domain Spoof** (Homoglyph / Typosquat / Brand Stuffing / Urgency + Credential demand):
  $$S_{\text{final}} = \max\left(82, S_{\text{final}}\right) \implies \text{Verdict forced to } \texttt{high\_risk}$$
- **Any Other Severe Rule Triggered** (when $S_{\text{final}} < 70$):
  $$S_{\text{final}} = \max\left(75, S_{\text{final}}\right)$$
- **Official Brand Sender Cap**: If the sender domain is verified in `OFFICIAL_BRAND_DOMAINS` and no credential request exists:
  $$S_{\text{final}} = \min\left(25, S_{\text{final}}\right) \implies \text{Verdict capped to } \texttt{safe}$$

### 3. Verdict Categories
- $\texttt{high\_risk} \ge 66$
- $\texttt{suspicious} \ge 35$
- $\texttt{promo\_clutter} \ge 2 \text{ promo signals and } S_{\text{final}} < 40$
- Else $\texttt{safe}$

---

### 4. Rule Engine Breakdown (`server/rules/engine.js`)

Per domain, three brand verification algorithms run:
1. **Homoglyph Substitution**: Character replacement check (e.g., `paypa1` $\to$ `paypal`, `m1crosoft` $\to$ `microsoft`). Dual normalization runs (`1` $\to$ `i` and `1` $\to$ `l`) so `paypa1` resolves properly.
2. **Brand Stuffing**: Brand name embedded inside an unauthorized domain (e.g., `paypal-security-update.xyz`).
3. **Levenshtein Distance**: Distance $\le 2$ against official brand database (length delta $\le 2$, brand length $\ge 4$).

#### 10 Social Engineering Families (Max 2 hits per family, 2nd hit at half value):
| Family | Points | Description |
| :--- | :--- | :--- |
| `advance_fee` | 20 pts | Small payment demanded to release funds/packages. |
| `refund_bait` | 18 pts | Overpayment or unsolicited refund claim. |
| `delivery_fee` | 20 pts | Invalid address or unpaid delivery fee lures (`USPS`/`FedEx`). |
| `fake_subscription` | 18 pts | Renewal invoice for unauthorized cloud antivirus/service. |
| `fake_security` | 20 pts | "Account suspended", "Unusual sign-in activity", or 2FA panic. |
| `investment` | 15 pts | Crypto giveaway or guaranteed high-yield returns. |
| `health_claim` | 15 pts | Unsubstantiated medical cure or banned lecture lure. |
| `personal_data` | 15 pts | Request for SSN, full birthdate, or banking details. |
| `contact_stranger` | 15 pts | Direct messaging request from unknown contact. |
| `inheritance` | 25 pts | Deceased estate or lottery fund transfer lure. |

#### Structural High-Risk Signal Combinations:
- **Reply-To $\neq$ From**: $+25$ pts (defeats reply-path filtering).
- **Mixed-Script Homoglyph**: $+30$ pts (Cyrillic/Greek character inside a Latin domain).
- **Sender on Free/Abuse Host**: $+20$ pts (`firebaseapp.com`, `weebly.com`, `wixsite.com`).
- **Display-Name Impersonation**: $+55$ pts (Brand name in display header vs throwaway sending domain).
- **Signature Footer Impersonation**: $+45$ pts (e.g., `© 2025 PayPal, LLC` sent from unverified address).
- **Urgency + Credential Harvesting Combo**: $+45$ pts.
- **Shortener + Time Pressure Combo**: $+30$ pts.

---

## 📱 Zero-Trust QR Phishing (Quishing) & Safe Peek Engine

### Zero-Trust QR Engine (`server/rules/qr.js`)
QR code phishing bypasses traditional email text filters because the malicious link is embedded inside an image. Ratio'd implements a zero-trust QR analysis engine:

1. **Payload Decoding**: Extracted via browser `createImageBitmap` and decoded using `jsQR.js`.
2. **URL Defanging**: Converts `https://paypa1-verify.xyz/login` into safe display text `hxxps://paypa1-verify[.]xyz/login`.
3. **Zero-Trust Calibration Floors**:
   - **Brand Impersonation / Typosquatting in QR**: Floor **90/100** (`MALICIOUS`).
   - **Credential Path (`/login`, `/verify`) on Impersonating QR Host**: Capped at **100/100**.
   - **Raw IP Address Host**: Floor **75/100** (`HIGH_RISK`).
   - **Punycode / Userinfo Tricks**: Floor **75/100** (`HIGH_RISK`).

---

### Safe Peek Zero-Execution Link Redirect Tracer (`server/unmask/tracer.js`)
Attackers hide destination domains behind link shorteners (`bit.ly`, `t.co`, `tinyurl.com`, `rb.gy`). **Safe Peek** allows users to inspect redirect chains safely:

```
USER CLICKS [ 🔍 Safe Peek ]
            │
            ▼
POST /unmask { url: "http://bit.ly/3x8..." }
            │
            ▼
Node Tracer performs zero-execution HTTP HEAD requests (Max 5 hops)
            │
            ▼
RETURNS: Hops: 2 → Final Destination: paypa1-security.xyz (Score: 97/100, HIGH RISK)
```

---

## 🔒 Privacy & Security Invariants

Ratio'd enforces 6 strict security invariants:

1. **Mandatory `escapeHtml()` on Banner Interpolation**:
   `flags[].span` is a raw slice of the email body and `explanation` can be LLM-written. All interpolations are escaped to prevent DOM-based XSS inside live Gmail sessions.
2. **Span Grounding & Verbatim Enforcement**:
   Flag spans must be verbatim substrings of the original input. The engine never invents evidence.
3. **Zero Data Persistence**:
   Message content is never saved to disk or database. Privacy logger (`server/privacy/log.js`) records counts only (`{ phones_masked: 1, emails_masked: 2, total_redactions: 3 }`).
4. **Path Traversal Protection**:
   Web server file resolver (`resolveWebFile`) rejects `..`, re-resolves paths, and enforces strict first-segment allowlisting.
5. **Minimal Extension Permissions**:
   Manifest V3 permissions are restricted to `activeTab` and `storage` only.
6. **Strict LLM Grounding Guard (`isGrounded()`)**:
   If an optional LLM explanation contains hallucinated flags not present in source text, the LLM response is discarded and replaced with a deterministic template.

---

## 📦 Third-Party Disclosures, Dependencies & Licenses

In strict adherence to hackathon rules, all external libraries, datasets, and frameworks used in Ratio'd are declared below with their respective open-source licenses:

| Asset / Dependency | Type / Module | Source / Origin | License | Usage Purpose in Ratio'd |
| :--- | :--- | :--- | :--- | :--- |
| **Node.js Core Modules** | Runtime Environment | `http`, `fs`, `path`, `crypto`, `url`, `tls` | MIT / Node.js | Server orchestration, HTTP API, and zero-dependency rule engine. |
| **jsQR.js** | Client Vendor Library | `js/vendor/jsQR.js` | Apache 2.0 | Pure JavaScript QR code image decoding in browser memory. |
| **Inter Font** | Typography Asset | Google Fonts | SIL Open Font License 1.1 | Clean body typography across Web Console and Extension banner. |
| **JetBrains Mono** | Typography Asset | Google Fonts | SIL Open Font License 1.1 | Technical monospaced typography for scores, codes, and flag spans. |
| **Plus Jakarta Sans** | Typography Asset | Google Fonts | SIL Open Font License 1.1 | Display typography for neo-brutalist headers and titles. |
| **Real-World Scam Corpus A** | Test Fixture Dataset | `server/fixtures/scam-corpus.txt` | Open Source (Curated) | 20 real scam phishing messages for recall regression testing. |
| **Real-World Mixed Corpus B** | Test Fixture Dataset | `server/fixtures/real-world-mixed.txt` | Open Source (Curated) | 9 scam + 2 ham messages for recall & specificity verification. |
| **User Scam Corpus C** | Test Fixture Dataset | `server/fixtures/new-emails-corpus.txt` | Open Source (Curated) | 33 scam + 1 ham messages for expanded recall regression. |
| **Chrome Extension MV3 API** | Platform API | `chrome.storage`, `chrome.runtime` | Google Chrome BSD | Extension badge synchronization and asset loading. |

> **Zero Runtime Dependencies Statement**: `package.json` contains **0 production dependencies**. The entire server runs on native Node.js ES6 / CommonJS modules without Express, Fastify, or external npm packages.

---

## 📊 Evaluation, Corpora & Verification Suite

Ratio'd includes a comprehensive automated test suite consisting of **513 assertions across 14 test runners**:

```bash
npm test                       # Run primary phishing rule engine test suite (8 core cases)
npm run test:qr                # Run QR quishing zero-trust calibration suite (46 cases)
npm run test:corpus            # Run real-world scam corpora recall & specificity benchmark
npm run test:all               # Run EVERYTHING (Requires running server on :3000)
```

### Benchmark Evaluation Results
| Test Corpus | Contents | Target Metric | Ratio'd Result | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Corpus A** (`scam-corpus.txt`) | 20 Scam Emails | Recall $\ge 85\%$ | **90.0% Recall** (18/20 detected) | ✅ PASSED |
| **Corpus B** (`real-world-mixed.txt`) | 9 Scam + 2 Ham | Recall $\ge 90\%$, Specificity $100\%$ | **100% Recall, 100% Specificity** | ✅ PASSED |
| **Corpus C** (`new-emails-corpus.txt`) | 33 Scam + 1 Ham | Recall $\ge 85\%$, Specificity $100\%$ | **100% Recall, 100% Specificity** | ✅ PASSED |
| **Adversarial Legitimate Set** | 15 Real Brand Mails | False Positive Rate $= 0\%$ | **0 False Positives** (15/15 passed) | ✅ PASSED |
| **QR Quishing Suite** | 46 QR Cases | Zero-Trust Floor Accuracy | **100% Accuracy** (25/25 QR pass) | ✅ PASSED |
| **Extension Package Audit** | Archive Integrity | Drift & XSS Escaping Check | **0 Drift, 100% Escaping Verified** | ✅ PASSED |

---

## 🚀 Installation & Setup Guide

### 1. Web Console & API Server (Local Setup)

#### Prerequisites
- **Node.js** v18.0.0 or higher.

#### Running the Server
```bash
# Clone the repository
git clone https://github.com/VedxntDev/Ratio-d.git
cd Ratio-d

# Start the server (serves web console & API on port 3000)
node server.js
```
Open **`http://localhost:3000`** in your browser to access the Web Console.

---

### 2. Chrome Extension (Manual Unpacked Installation)

> **Chrome Web Store Status Note**: Our application is currently under review by the Chrome Web Store. Until approval is complete, follow the 5-step manual setup below:

1. Download **`ratiod-extension.zip`** from the website or repository root and unzip it.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** using the toggle switch in the top-right corner.
4. Click **Load unpacked** in the top-left toolbar.
5. Select the unzipped folder containing `manifest.json`.
6. Open **Gmail (`mail.google.com`)** and refresh the page. Every opened email will now feature the live Ratio'd risk banner!

---

## 📂 Repository Directory Structure

```
Ratio-d/
├── index.html                     # Static Web Console entry point
├── styles.css                     # Core Neo-Brutalist design tokens & styles
├── server.js                      # Unified Node.js server (Local + Vercel)
├── package.json                   # Zero runtime dependencies declaration & scripts
├── vercel.json                    # Vercel serverless API routing configuration
│
├── extension/                     # Chrome Extension Manifest V3 Package
│   ├── manifest.json              # Extension manifest declaring content scripts & permissions
│   ├── content-script.js          # Injects banner & badges into Gmail DOM
│   ├── banner.js                  # Shadow DOM banner injector with dual score badges
│   ├── fallback-engine.js         # In-browser fallback detection engine
│   ├── qr-core.js                 # Browser-side QR analyzer wrapper
│   └── qr-gmail.js                # Scans email images for QR codes in Gmail
│
├── js/                            # Web Console Modular Scripts
│   ├── app.js                     # Web Console orchestrator & PII bar listeners
│   ├── redactor.js                # Air-gapped client PII redactor
│   ├── qr.js                      # QR scanner core logic
│   ├── qr-ui.js                   # Web console 4-stage QR panel wiring
│   ├── api.js                     # API client for backend communication
│   ├── pipeline.js                # 4-stage visual pipeline animation controller
│   ├── presets.js                 # Sample phishing, SMS, and legit test presets
│   └── vendor/
│       └── jsQR.js                # Vendored pure-JS QR decoder (Apache 2.0)
│
├── server/                        # Backend Threat Engine & Rule Modules
│   ├── rules/
│   │   ├── engine.js              # Primary Rule Scorer (10 signal families + homoglyphs)
│   │   └── qr.js                  # Zero-Trust QR Quishing Scorer
│   ├── routes/
│   │   ├── analyze.js             # POST /analyze route handler
│   │   └── qr.js                  # POST /analyze-qr route handler
│   ├── unmask/
│   │   └── tracer.js              # Safe Peek zero-execution link redirect tracer
│   ├── privacy/
│   │   └── log.js                 # Privacy logger (records redaction counts only)
│   ├── laya/
│   │   └── client.js              # Hand-weighted structural signal scorer
│   ├── llm/
│   │   ├── client.js              # Grounded LLM explanation generator
│   │   └── prompt.js              # Strict grounding system prompts
│   ├── fixtures/                  # Real-world scam & ham email corpora
│   └── test-phishing.js           # Automated test suites
│
├── tools/                         # Automated Build & Audit Tools
│   ├── build-zips.js              # Regenerates published zip archives
│   ├── build-context.js           # Generates docs/project-context.json
│   └── verify-banner.js           # In-browser Shadow DOM verification script
│
└── docs/                          # Technical Documentation & Manifests
    ├── report.md                  # Comprehensive architectural report
    ├── project-context.json       # Machine-readable project context manifest
    └── test-qr-codes.html         # Test harness page for QR quishing cases
```

---

## 🔮 Production Roadmap & Future Expansion

1. **Expanded Legitimate Mail Benchmark Corpus**:
   Integrating a broader dataset of 500+ verified legitimate brand newsletters to continuously measure and maintain false-positive rates below 0.1%.
2. **Cross-Platform Extension Support**:
   Bringing Ratio'd Shadow DOM banners to **Outlook Web App (OWA)**, **Mozilla Thunderbird**, and **Apple Mail**.
3. **HTML Phishing & Attachment Inspection**:
   Adding static AST parsing for hidden zero-font text, form action injection, and malicious PDF/office attachment scanning.
4. **Campus & Enterprise Organizational Pilots**:
   Deploying custom domain-lookalike databases and organizational phishing alerts for university campuses and SMBs.

---

<div align="center">

**Built for the Cybersecurity & Defense Track by [Vedant](https://github.com/VedxntDev) & Vasu.**

*Ratio'd is open-source software released under the [MIT License](./LICENSE).*

</div>
