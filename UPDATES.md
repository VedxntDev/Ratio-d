# Ratio'd — Hackathon Evaluation & Development Timeline
**Cybersecurity & Defense Track · Developed by [Vedant](https://github.com/VedxntDev)**

This document provides a transparent, auditable timeline separating work completed for **Round 1 (Before September 29, 2026)** from work completed for **Round 2 / Post-Shortlist (On & After September 29, 2026)**.

---

## 📊 Summary Matrix: Before vs. After September 29

| Dimension | Before September 29, 2026 (Round 1 Submission) | On & After September 29, 2026 (Round 2 / Shortlist Expansion) |
|---|---|---|
| **Primary Distribution** | Manual unpack developer mode (`chrome://extensions/`) | **Live Google Chrome Web Store Production Listing** (ID: `bmabonmnpikocpaaigiedckcccpmiepa`) |
| **Extension Permissions** | Declared `activeTab` & `storage` permissions | **Zero declared permissions** (Purged to solve Purple Potassium; narrowest host access only) |
| **Privacy Compliance** | Local privacy architecture & in-memory redaction | Dedicated public **Privacy Policy** (`privacy.html`) deployed to production for Web Store compliance |
| **Store Assets** | Initial mockup assets | Production-certified **1280×800 UI screenshot** in Gmail & 1:1 brand marks |
| **Site Action Points** | Mascot cursor-tracking button & zip download link | Responsive **Chrome Web Store FAB** + unified store badge navigation & install card |
| **UI Test Coverage** | 12 core static UI assertions | **Expanded static assertions**: Web Store link verification, safe `rel`/`target`, decorative badge a11y |
| **Package Verification** | Manual zip archive building | Hardened zero-drift archive builders (`tools/build-zips.js`) with isolated git configs |

---

## 🗓️ Phase 1: Built Before September 29, 2026 (Initial Hackathon Prototype)

The core MVP and foundational security architecture were developed and validated before September 29, 2026:

### 1. Core Threat Detection Engine (`server/rules/engine.js`)
- **Deterministic Rule Architecture**: Engineered a zero-dependency, deterministic heuristic engine.
- **Brand Protection (28 Brands)**: Covered high-target organizations (Microsoft, PayPal, Google, Apple, Amazon, Netflix, banking institutions).
- **Dual-Pass Homoglyph Normalization**:
  - `1 -> i` (`normalizeForBrandCheck`) for Microsoft / Citibank typo lookalikes.
  - `1 -> l` (`normalizeAltForBrandCheck`) for PayPal (`paypa1`) typo lookalikes.
  - Full character substitution map (`0 -> o`, `rn -> m`, `vv -> w`, `5 -> s`, `@/4 -> a`, `3 -> e`).
- **Levenshtein Distance & Brand-Stuffing**:
  - Distance $\le 2$ edit-distance check combined with length-differential guard ($\le 2$).
  - Subdomain & hyphen brand-stuffing traps (`microsoft-support.com`).
- **Social Engineering Threat Taxonomy (10 Families)**:
  - Urgency triggers, credential harvesting prompts, advance-fee compensation scams, fake refunds, small delivery fees (smishing), fake subscription renewals, mandatory-2FA scares, investment/crypto solicitations, personal identity document requests, and stranger outreach.
- **Combination Scoring Boosters**:
  - Urgency + Credential demand on non-official domains (`+45`).
  - URL shorteners + pressure (`+30`).
  - Sender domain vs. link domain mismatch (`+30`).
- **Bulk Marketing Spam Detection (`promo_clutter`)**:
  - Distinguishes marketing/newsletters from attacks based on opt-out signals and promotional patterns rather than demoting threats.

### 2. Privacy-First Client-Side Redaction (`js/redactor.js`, `extension/content-script.js`)
- **Browser-Memory PII Masking**: In-memory regex tokenization replaces phone numbers (`[PHONE_REDACTED]`), email addresses (`[EMAIL_REDACTED]`), and OTP tokens (`[OTP_REDACTED]`) before network payload dispatch.
- **Zero-Persistence Logging (`server/privacy/log.js`)**: Server derives redaction telemetry solely from masked text; zero message text is stored or logged.

### 3. Structural Signal Scorer & Combiner (`server/laya/client.js`, `server/combine/score.js`)
- High-precision structural signals (punycode lookalikes, bare IP literal URLs, data URIs, base64 blobs, wire/crypto demands, link farms).
- Weighted scoring ($0.70 \times \text{Rules} + 0.30 \times \text{Laya}$) with severe domain spoof override enforcing minimum score 82 and `high_risk` verdict.

### 4. Zero-Dependency Universal Server (`server.js`, `api/index.js`)
- Pure Node.js `http.createServer` implementation with 0 npm runtime dependencies.
- Universal handler exported for both local execution (`port 3000`) and Vercel Serverless environment.

### 5. Playful Neo-Brutalist Web Console (`index.html`, `styles.css`, `js/`)
- Warm canvas (`#F6F1E7`), 3px solid ink borders, 6px hard offset drop-shadows.
- 4-stage GSAP animated pipeline (Observe $\to$ Detect $\to$ Explain $\to$ Respond).
- Interactive 10-stage architecture step-through flowchart (`js/architecture.js`).
- Interactive mascot with measured eye-tracking spring physics (`js/mascot-eyes.js`).
- WebGPU hero canvas effect (`js/shape-waves.js`).

### 6. Chrome Extension Prototype (Manifest V3)
- Shadow DOM banner injection (`extension/banner.js`) with complete HTML escaping (`escapeHtml()`) protecting against DOM-based XSS.
- Multi-strategy unsubscribe helper (Gmail header action + DOM body link parsing) with Web Audio chime and canvas glitter.
- Autonomous offline fallback engine (`extension/fallback-engine.js`).

### 7. Dual Real-World Scam Corpora & Automated Testing
- Benchmarked against external scam dataset (`scam-corpus.txt` with 20 scams, `real-world-mixed.txt` with 9 scams + 2 ham).
- Verified 85% recall on 20 scams; 100% recall on 9 scams; 0 false positives across 15 adversarial legitimate emails.
- 12 automated test suites with over 400 assertions.

---

## 🚀 Phase 2: Built On & After September 29, 2026 (Round 2 / Shortlist Expansion)

Following shortlist notification for the next round, engineering focused on production hardening, Chrome Web Store certification, policy compliance, and auditability:

### 1. Live Google Chrome Web Store Production Launch
- **Official Listing Integration**:
  - Published to the Google Chrome Web Store (Item ID: `bmabonmnpikocpaaigiedckcccpmiepa`).
  - Transformed the installation UX from developer-mode sideloading to a 1-click Web Store installation.
- **Web Console Store Integration**:
  - Added official Chrome Web Store badge branding across the global header navigation, hero CTA group, interactive install card, and site footer.
  - Re-architected `#install` section: primary Web Store install action with secondary 5-step developer manual ZIP workflow retained for offline/developer evaluation.

### 2. Chrome Web Store Policy Compliance & Security Audit
- **Purple Potassium Violation Resolution**:
  - Conducted full permission audit of `extension/manifest.json`.
  - Completely excised `activeTab` and `storage` permissions, ensuring adherence to the Principle of Least Privilege and Chrome Web Store's narrowest permissions mandate.
  - Verified extension operates solely on narrow `host_permissions` (`mail.google.com/*`, local engine, and production API).
- **Purple Nickel Violation Resolution**:
  - Created standalone `privacy.html` at repository root with complete telemetry disclosure, hosting boundaries, and zero-storage guarantees.
  - Deployed publicly to `https://ratio-d.vercel.app/privacy.html` and linked directly in the Web Store privacy declaration.
- **Red Potassium Violation Resolution**:
  - Produced and validated compliant 1280×800 in-situ screenshots displaying the live Gmail Shadow DOM warning banner.

### 3. Floating Action Button (FAB) Architecture Refactor
- Replaced the duplicate mascot floating button with a responsive, high-converting Chrome Web Store installation button (`.btn-store`, `.mascot-fab`).
- Decoupled floating button logic from mascot eye-tracking, preserving the interactive cursor-following mascot on the hero card while providing an accessible, persistent extension install CTA.

### 4. Static UI & Accessibility Test Suite Expansion (`server/test-ui-static.js`)
- Added new test assertions verifying Chrome Web Store URLs, active listing ID, secure opener attributes (`target="_blank" rel="noopener noreferrer"`), and accessible decorative badge semantics (`alt=""`, `aria-hidden="true"`).
- Updated external host allowlist to permit `chromewebstore.google.com` while maintaining strict enforcement against unapproved third-party scripts or CDNs.

### 5. Build Pipeline Hardening & Zero-Drift Package Generation
- Hardened `tools/build-zips.js` with isolated git environments (`GIT_CONFIG_GLOBAL=/dev/null`) to guarantee reproducible, zero-drift archive creation (`ratiod-extension.zip` and `ratiod-full-project.zip`).
- Ensured byte-parity between live source files and distributed packages.

### 6. Documentation & Evaluator Auditing
- Added comprehensive milestone timeline section to `README.md` and created this dedicated `UPDATES.md` audit document.
- Maintained synchronization with `docs/project-context.json` and `docs/report.md`.

---

## 🔍 Verification & Evidence

To independently verify the test suite and all assertions:

```bash
# Run phishing regression test suite
npm test

# Run static UI and store listing assertions
node server/test-ui-static.js

# Run extension packaging and security assertions
npm run test:ext

# Rebuild deterministic production archives
node tools/build-zips.js
```
