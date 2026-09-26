# Ratio'd — Scam Risk Analyzer & Defense System
**Cybersecurity & Defense Track · Developed by [Vedant](https://github.com/VedxntDev)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Chrome_Extension-Manifest_V3-brightgreen)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Runtime deps](https://img.shields.io/badge/runtime_dependencies-0-success)](./package.json)
[![Design System](https://img.shields.io/badge/Design_System-Playful_Neo--Brutalist-orange)](#-design-system--tokens)

**Ratio'd** is a privacy-first scam risk analyzer. It reads an email out of
Gmail — or text you paste into the web console — strips PII in the browser
before anything is transmitted, scores the message for phishing/smishing risk,
and explains its reasoning inside an isolated Shadow DOM banner.

It is a static site, a Chrome extension, and one small Node server.
**No framework, no build step, no runtime dependencies, and no database.**

---

> ### Read this first: there is no trained ML model
>
> The component called **"Laya"** (`server/laya/client.js`) is a hand-weighted
> signal scorer, not a learned classifier. The file hardcodes
> `source: "laya_stub_heuristic"` plus a note saying the container is offline,
> and that string is echoed verbatim into every API response under
> `engine.model_source`. The real detection work is done by the deterministic
> rule engine in `server/rules/engine.js`.
>
> An LLM **is** supported (`server/llm/`) but only for phrasing the
> explanation, only when you supply an API key, and it is structurally
> incapable of changing the score. See
> [What this is not](#-what-this-is-not--honest-limits).

---

## 📑 Contents

| Section | What it covers |
| --- | --- |
| [Mental model](#-the-60-second-mental-model) | One diagram of the whole system |
| [Pipeline](#-the-pipeline-stage-by-stage) | "Email opened" → "banner shown", stage by stage |
| [Code walkthrough](#-code-walkthrough--every-file) | What every single file does and why |
| [Design system](#-design-system--tokens) | Colours, type, tactile UI rules |
| [Brand logo](#-brand-logo) | Single-source icon generation |
| [Mascot eyes](#-mascot-eye-follow-button) | Both mounts, measured overlay geometry |
| [Extension](#-chrome-extension) | Escaping, a11y, dismissal behaviour |
| [Detection model](#-detection-model) | Weights, thresholds, disqualifiers |
| [Structure](#-repository-structure) | Full file map |
| [Getting started](#-getting-started) | Run it, deploy it |
| [Testing](#-testing) | The 12 suites and the one prerequisite |
| [Honest limits](#-what-this-is-not--honest-limits) | What this does not do |

---

## 🚀 Key Features

- **🔒 Client-Side PII Redaction** — phones, emails and OTPs are replaced with
  placeholders in browser memory before any request is made.
- **⚡ Deterministic Threat Engine** — homoglyph normalisation, brand stuffing,
  Levenshtein typosquat detection, urgency coercion, credential requests, URL
  shorteners, and sender-vs-link domain mismatch.
- **🛡️ Manifest V3 Gmail Extension** — injects an isolated Shadow DOM banner
  (`[ HIGH_RISK ]`, `RISK SCORE: 87/100`) directly into open Gmail threads.
- **📊 4-Stage Animated Pipeline** — Observe → Detect → Explain → Respond, with
  an elastic spring score gauge in the web console.
- **🧩 Live Architecture Board** — a step-through diagram of all 10 stages,
  split into a "runs in your browser" zone and a "backend" zone so the privacy
  story is visible at a glance.
- **🚫 One-Click Actions** — unsubscribe and report-spam, both driving Gmail's
  own controls.
- **⚖️ Honest reporting** — every response states which engine actually ran, so
  a heuristic score is never dressed up as a model verdict.

---

## 🧭 The 60-second mental model

```
   ┌──────────── GMAIL (or paste into the web console) ─────────────┐
   │  0. TRIGGER    MutationObserver + 1s poll on the message pane   │
   │  1. REDACT     phones / emails / OTPs -> [PHONE_REDACTED] etc.   │
   │  ═════════ PII dies here, in browser memory ══════════════════  │
   │  2. TRANSPORT  POST /analyze -> local :3000 -> Vercel -> offline  │
   └───────────────────────────┬────────────────────────────────────┘
                               ▼
   ┌──────────── SERVER (one handler, both runtimes) ──────────────┐
   │  3. ROUTE      validate text + channel, count redactions       │
   │  4. RULES      homoglyph · stuffing · Levenshtein<=2 · urgency  │
   │                credentials · shorteners · sender!=link         │
   │  5. LAYA       weighted structural signals -> probability      │
   │  6. COMBINE    0.70*rules + 0.30*laya, then disqualifiers     │
   │  7. EXPLAIN    deterministic template (or a grounded LLM)      │
   │  8. TELEMETRY  counts only, never text                         │
   └───────────────────────────┬────────────────────────────────────┘
                               ▼
   ┌──────────────────── 9. RENDER ─────────────────────────────────┐
   │  Shadow DOM banner: verdict · score · explanation · actions     │
   └─────────────────────────────────────────────────────────────────┘
```

Two zones, one line between them: **PII is redacted at stage 1, before the
network hop at stage 2.** Everything downstream only ever sees masked text.

---

## 🔬 The pipeline, stage by stage

### Stage 0 — Trigger · `extension/content-script.js`

The manifest injects `banner.js` then `content-script.js` into
`https://mail.google.com/*` at `document_idle`. Permissions are only
`activeTab` + `storage`.

Gmail is a single-page app that swaps the message pane without navigating, so
detection is two-pronged — a `MutationObserver` on `document.body` with
`subtree: true`, **and** a 1-second `setInterval` as a backstop.

`scanAndAnalyzeGmail()` then:
1. Grabs the body via Gmail's private class selectors
   (`.a3s.aiL, .a3s, .ii.gt, .adn.ads, [role='main'] .h7, …`).
2. Returns early if `innerText.length < 5`.
3. **Deduplicates** on `text.substring(0,100) + text.length`. Without this,
   every unrelated Gmail DOM mutation would re-POST the same email.

> ⚠️ Those selectors are Gmail's private classes. They break whenever Google
> ships a redesign — this is the most fragile line in the project.

### Stage 1 — Redaction · `content-script.js:7` and `js/redactor.js`

Three regexes replace phone numbers, email addresses and OTPs with
`[PHONE_REDACTED]`, `[EMAIL_REDACTED]`, `[OTP_REDACTED]`.

This is the privacy claim's foundation. Raw PII never leaves the page, and the
backend's `privacy` counters are derived from the *masked* text it receives.

### Stage 2 — Transport · `content-script.js:88`

A plain `fetch` to `http://127.0.0.1:3000/analyze`, deliberately **not** through
`chrome.runtime.sendMessage`. The file header explains why: MV3 service workers
get killed during idle, and a message round-trip produces "Extension context
invalidated" errors. Direct `fetch` makes that failure mode structurally
impossible.

Two fallbacks cascade so the extension still works with no server at all:
1. `https://ratio-d.vercel.app/api/analyze`
2. `renderFallbackAnalysis()` — fully local, returns a hardcoded 75 or 12.

### Stage 3 — Route · `server.js:149` → `server/routes/analyze.js:23`

One `handler` serves both environments: run directly it binds port 3000; when
imported by Vercel's Node runtime it exports `(req, res)`. That is why
localhost and production cannot drift apart.

`handleAnalyze` validates `text`, clamps `channel` to `sms|email`, and derives
the redaction counts.

### Stage 4 — Rule engine · `server/rules/engine.js` ⭐ the real detector

For every domain found, three checks:

| Check | Catches | Example |
| --- | --- | --- |
| **A. Homoglyph substitution** | character swaps | `paypa1` → PayPal |
| **B. Brand stuffing** | brand in subdomain/hyphen | `microsoft-support.com` |
| **C. Levenshtein ≤ 2** + length delta ≤ 2 | typosquats | `microsft`, `appple` |

Check A runs **two** normalisers — `1→i` (`normalizeForBrandCheck`) and
`1→l` (`normalizeAltForBrandCheck`). The second pass exists because `paypa1`
only resolves to `paypal` under `1→l`; under `1→i` it becomes `paypai` and
matches nothing.

Then pattern passes: urgency `+25` each, credential demand `+30` each,
suspicious domains `+35`, plus the three **combination** rules that matter most:

| Combo | Points | Catches |
| --- | --- | --- |
| Urgency + credential, non-official sender | +45 | the classic credential lure |
| URL shortener + pressure | +30 | smishing / delivery fraud |
| Sender domain ≠ link domain | +30 | the link goes somewhere else |

**Two guards keep false positives down:**
- `MIN_BRAND_LEN = 4` — a 1–3 character brand matches by accident, and an `x`
  anywhere once made `example.com` look like impersonation.
- `LEGITIMATE_DOMAINS` — real domains exempt regardless of similarity
  (`shopify.com` sits 2 edits from `spotify.com`).

Official senders with no credential request have their score **capped at 25**.

---

### Stage 5 — Laya · `server/laya/client.js` (the "model")

Additive weighted score. No weights are learned anywhere:

```
threat = ruleFlags × 0.25  +  tokenMatches × 0.15  +  Σ structural weights
```

`STRUCTURAL_SIGNALS` is the high-precision layer — six signals chosen because
legitimate mail essentially never contains them. Every firing signal name is
returned in `engine.model_signals`, so the number is auditable rather than an
unexplained figure. See [Detection model](#-detection-model).

### Stage 6 — Combine · `server/combine/score.js`

```js
raw = ruleScore * 0.70 + layaScore * 0.30
```

Then two **disqualifying overrides** — these are what make the verdict
trustworthy:

- Severe domain spoof (homoglyph / typosquat / brand impersonation /
  urgency+credential) → `max(82, …)` and the verdict is forced to `high_risk`
  regardless of how polite the email reads.
- Any other severe rule with score < 70 → `max(75, …)`.

Verdict ladder: spoofing or ≥66 → `high_risk`; promo clutter → `promo_clutter`;
≥35 → `suspicious`; else `safe`. Each verdict gets its own `next_steps` copy.

### Stage 7 — Explain · `server/llm/explain.js`

Two producers, and the response always states which one ran in
`engine.explain_source`:

- **`deterministic`** (default, zero network) — a template assembled strictly
  from flags that actually fired.
- **`llm`** (only when `RATIOD_LLM_API_KEY` is set) — `temperature: 0`, JSON
  mode, 8-second abort timeout.

The anti-hallucination gate is `isGrounded()`: every returned
`red_flags[].phrase` must appear **verbatim in the source text**. Anything not
found is discarded — and if the model invented *every* flag, the entire response
is thrown away and it falls back to the deterministic text. Any error, timeout
or non-OK response returns `null`.

### Stage 8 — Telemetry · `server/privacy/log.js`

Logs `phones_masked`, `emails_masked`, `otp_masked` and a total. Never message
content. `console.log` only — there is no database anywhere in this project.

### Stage 9 — Render · `extension/banner.js`

Creates a `<div>`, calls `attachShadow({ mode: "open" })` so Gmail's styles
cannot reach it, injects a scoped stylesheet, and inserts the banner above the
message.

**Every interpolation goes through `escapeHtml()`.** This is the single most
important detail in the file: `flags[].span` is a verbatim slice of the email
body and `explanation` can be LLM-written, so a hostile email containing
markup would otherwise execute JavaScript in the user's live Gmail session.

---

## 🧪 Live evidence

Real responses from `node server.js`, measured against the three presets in
`js/presets.js`:

| Preset | Score | Verdict | Flags | Latency |
| --- | --- | --- | --- | --- |
| `phishingEmail` (PayPal typosquat) | **100** | `high_risk` | 4 | 8 ms |
| `urgentSms` (USPS delivery scam) | **90** | `high_risk` | 3 | 2 ms |
| `legitimateNotice` (flight confirmation) | **1** | `safe` | 0 | 0 ms |

A five-signal phishing sample — `paypa1-verify-account.xyz`, an IP-literal URL,
urgency, a credential demand and a sender/link mismatch — returns `100 /
high_risk` with all ten flags enumerated, for example:

```
[paypa1-verify-account.xyz]  Homoglyph/Typosquat: impersonates 'PAYPAL'
[within 24 hours]            Psychological time limit constraint
[unusual activity]           Fear trigger: unusual security activity alarm
[Click here to verify]       Urgent action demand
[will be suspended]          Threat of account loss
[verify your credentials]    Credential verification demand
[Urgency + Credential Combo] High-risk combination
[.xyz]                       High-risk TLD
[http://198.51.100.7]        Raw IP address URL
[sender/link mismatch]       sent from paypa1-verify-account.xyz, links to 198.51.100.7
```

---
---

## 📊 Measured detection performance

An external corpus of 20 confirmed scam emails (`server/fixtures/scam-corpus.txt`)
is committed and run by `server/test-scam-corpus.js`. It is the only test in
this repo that evaluates the engine against messages its author did not write.

| | Before | After |
| --- | --- | --- |
| **Recall on real scam email** | **0 / 20 (0%)** | **15 / 20 (75%)** |
| Detected as `high_risk` | 0 | 6 |
| Detected as `suspicious` / `promo_clutter` | 2 (as clutter) | 9 |
| False positives (adversarial legitimate mail) | 0 / 15 | 0 / 15 |

> **This was the most important finding in the project.** Every one of those 20
> messages scored `safe` while 391 self-authored assertions passed. The engine
> was built almost entirely around one family — credential phishing behind a
> typosquatted brand domain — while the largest real-world category is
> advance-fee and brand-impersonation fraud, where the payload is a request for
> money, identity documents, or a phone call rather than a password. Coverage of
> the existing pattern families against this corpus: urgency 1/20, credential
> 0/20, risky TLD 0/20.

### What was added, and what it caught

| New signal | Catches | Example |
| --- | --- | --- |
| `advance_fee` | Prize/compensation/investment lures | "lucky winner", "you have been selected", a fee required before release |
| `refund_bait` | Fake overpayment and refund | "your invoice was paid twice", "submit your refund" |
| `delivery_fee` | Parcel-release smishing | "non-payment of 2.99 SGD", "delivery failed" |
| `fake_subscription` | Storage-scare and auto-renewal lures | "storage is full", "subscription renewal has been processed" |
| `fake_security` | Mandatory-2FA wallet lures | "2FA mandatory", "enable 2FA now" |
| `investment` | Loan and token solicitations | "disbursed within 24 hours", "airdrop" |
| `health_claim` | Miracle-cure marketing | "self-healing protocol", "nearly blind to perfect 20/20" |
| `personal_data` | Identity-document harvesting | "a copy of your identification", "Your Full Names:" |
| `contact_stranger` | Cold-contact advance-fee | "contact me urgently for your claim" |
| **Display-name impersonation** | Brand name vs sending domain | "MetaMask" from `*.firebaseapp.com` |
| **Signature impersonation** | Brand footer vs sending domain | "© 2025 PayPal, LLC" from `suiteprimejmt.org` |
| **Abused-TLD links** | Cheap throwaway hosting | `.page`, `.icu`, `.buzz`, `.cam`, … |

Each family contributes **at most once** — a single advance-fee email trips
four or five of its own patterns, and without the cap one message would score
like four separate scams. The real lift comes from combinations: money bait
plus an action request (`+45`) and the advance-fee shape (`+40`).

### Two false positives this work introduced, and their fixes

Both were caught by a purpose-built adversarial legitimate set, not by the
existing 15-message corpus:

1. **Every brand was treated as impersonating itself.** The display-name check
   read `OFFICIAL_BRAND_DOMAINS[brand] || []`, so any brand missing an entry
   (coinbase, dropbox, binance) had an empty official list and its own
   legitimate mail was flagged. Fixed by falling back to `${brand}.com`, the
   same default the domain check already used.
2. **A real company was reported as a typosquat.** Adding `grab` to the brand
   list made `grab.com` two Levenshtein edits from `iras`, so a legitimate
   Grab newsletter was flagged. Fixed with `ALL_OFFICIAL_DOMAINS`: a domain that
   is officially some brand's own can never be a typosquat of another.

### Known misses

Five of the 20 remain undetected, and the suite names them explicitly so the
recall floor cannot be raised by quietly deleting hard cases:

| Record | Why it is missed |
| --- | --- |
| `SCAM-003` | 32 bytes of body, a 5-character subject. Nothing to match on — the irreducible floor |
| `SCAM-004` | Refund bait fires, but the body names a government authority with no legal-entity footer |
| `SCAM-008` | Investment bait fires; needs a second corroborating signal |
| `SCAM-013` | "SingPosT" is not in the brand list; `usps` is too short to match safely |
| `SCAM-018` | Health-claim bait fires; needs a second corroborating signal |

> **A note on what was deliberately *not* added.** Several corpus emails contain
> defanged links (`hxxps://…`, `impolite-milk[.]unicornplatform[.]page`). A rule
> matching the string `hxxp` would score well here and be worthless in
> production, because that defanging was applied by whoever sanitised the
> dataset — the original messages did not look like that. The underlying signal
> was captured honestly instead, by adding the real cheap TLDs the defanged
> hosts use.

### The limitation that matters

**This dataset cannot measure what people care about.** All 20 records are
labelled `scam`; there are not one `legitimate` example. A single-class corpus
cannot produce a false-positive rate, a precision figure, or a
false-negative-versus-false-positive tradeoff. It gives **recall on one narrow
slice of phishing** and nothing else.

The `scam_type` categories in the training prompt (`financial_fraud`,
`fake_delivery`, `health_scam`, …) are **not present in this dataset** — it
carries one `LABEL: scam` per record and no per-type annotation, so the
taxonomy cannot be learned or evaluated from it. The `risk_signals` and
`evidence` fields in that prompt are likewise unsupported: the dataset provides
no per-example reasoning, only the single repeated boilerplate line *"Identify
concrete indicators such as unsolicited financial offers, impersonation,
payment/refund requests…"* across all 20 records, which carries no per-example
signal.

To claim any real accuracy figure, a **balanced corpus** with several hundred
genuine `legitimate` messages is required, drawn from real inboxes.

---

## 💻 Code walkthrough — every file

### Root

| File | Role |
| --- | --- |
| `server.js` | **The only HTTP entrypoint.** Run directly → binds port 3000 serving both API and static site. Imported by Vercel → exports `(req, res)`. This dual shape is deliberate: it is why localhost and production cannot drift. |
| `index.html` | The web console — single source of truth for the page. |
| `styles.css` | Playful Neo-Brutalist design tokens and all styling. |
| `favicon.ico` | Root copy, because browsers probe `/favicon.ico` by default. |
| `package.json` | Scripts only. No `dependencies`, no `devDependencies`. |
| `vercel.json` | Routing; 404s `/server/*`, `/docs/*`, `/extension/*`, dotfiles and `package.json`. |
| `api/index.js` | Three lines: `require("../server.js")` and re-export, so Vercel's function is literally the same handler. |
| `.env.local` | Vercel OIDC token. Gitignored via `.env*`. |

**`server.js` internals worth knowing:**
- `resolveWebFile()` is a path-traversal guard — it rejects `..`, re-resolves
  the path and asserts it is still inside `WEB_ROOT`, then checks the first
  segment against an `ALLOWED_ENTRIES` allowlist. `server/`, `api/`, `docs/`
  and `extension/` are therefore unservable even though they live in the repo.
- The `index.html` fallback is deliberately narrow: only for single-segment
  routes with no dot. Without that, `/.git/config` would be masked as a 200.

### `server/` — the analysis pipeline

| File | Role |
| --- | --- |
| `routes/analyze.js` | The orchestrator. Calls all five subsystems in order and assembles the response contract. Returns the `engine` block, which is what makes the honesty guarantee possible. |
| `rules/engine.js` | ⭐ The actual detector. 423 lines: brand list, two homoglyph normalisers, Levenshtein, domain extraction, and every pattern table. Exports `evaluateRules`, `normalizeForBrandCheck`, `levenshteinDistance` (the extras exist so tests can pin them directly). |
| `laya/client.js` | The weighted signal scorer. Deliberately narrow structural signals with a `try/catch` per signal so a malformed pattern can never take the analyser down. |
| `combine/score.js` | Weighting, the two disqualifying overrides, the verdict ladder, and per-verdict `next_steps` copy. |
| `llm/explain.js` | Two explanation producers plus the `isGrounded()` anti-hallucination gate. |
| `llm/prompt.js` | The system prompt, kept verbatim from the spec so it stays reviewable and diffable. It is only used when an API key exists. |
| `privacy/log.js` | Counts only. `console.log`, no persistence. |

**A detail in `combine/score.js`:** promo-clutter detection prefers the rule
engine's verdict over recomputing it. The engine already requires **two or
more** promotional signals on a low-scoring message. An earlier version
recomputed it locally from "any single promo flag" — but `unsubscribe` appears
in nearly every legitimate newsletter, so a clearly safe message at 8/100 was
labelled `PROMO CLUTTER` with warning colours while its own explanation said
"LOW RISK / consistent with legitimate mail".

---

### `extension/` — the Gmail integration

| File | Role |
| --- | --- |
| `manifest.json` | MV3. Injects `banner.js` + `content-script.js` into `mail.google.com` at `document_idle`. Permissions: `activeTab`, `storage` only. `host_permissions` covers the local engine, localhost, and the Vercel deployment. `web_accessible_resources` exposes the three small icons to the banner. |
| `content-script.js` | Stages 0–2: DOM watcher, client redactor, transport with its fallback chain. |
| `banner.js` | Stage 9: the Shadow DOM banner, its styles, and all the action handlers. |
| `background.js` | A service worker that logs on install and proxies an `ANALYZE_EMAIL` message. |
| `icons/` | 16/48/128/512 px, generated from `assets/logo.svg`. |

> ⚠️ **`background.js` is currently a dead path.** It implements an
> `ANALYZE_EMAIL` message handler, but `content-script.js` never calls it —
> that was a deliberate move away from `chrome.runtime` messaging. It is
> harmless, but it implies an architecture the code intentionally abandoned,
> and it is the first thing to delete if you want the codebase honest about
> how it actually works.

**`banner.js` internals worth knowing:**
- `escapeHtml()` handles `& < > " '`. Used on `span`, `reason`, `explanation`,
  every `next_steps` entry and every privacy count. The comment above it
  explains exactly why: without it, an email containing markup executes in the
  user's Gmail session.
- Collapsing hides the body but **keeps the score visible** — you should still
  be able to see a `HIGH RISK` badge on a collapsed banner.
- Dismiss removes the host node entirely. A banner the user cannot get rid of
  teaches people to ignore banners.
- The unsubscribe handler tries three strategies in order: Gmail's native
  header action, then body anchor links, then reports intent-only. The chime
  and confetti are suppressed under `prefers-reduced-motion`.

### `js/` — the web console

Loaded as plain `<script>` tags, all attaching to `window`. No modules, no
bundler.

| File | Role |
| --- | --- |
| `redactor.js` | `window.Redactor.redact(text)` → `{redactedText, stats}`. The console's copy of stage 1. |
| `presets.js` | The three demo payloads used by the buttons and the tests. |
| `api.js` | `window.ApiClient`. Environment-aware endpoint ordering: localhost tries `:3000` first, production tries same-origin first, and a second candidate is always tried before giving up. Falls back to `clientSideFallback()`, which mirrors the backend's verdict vocabulary so the UI still renders with no network. |
| `app.js` | The orchestrator. Wires the textarea, channel tabs, preset loaders and every result panel. Almost every DOM touch is optional-chained (`?.`) because the channel selector now lives inside the telemetry pane and may legitimately be absent. |
| `pipeline.js` | GSAP stage highlighting and the gauge. Guarded by `typeof gsap === "undefined"` and `prefers-reduced-motion`, so it degrades to instant state changes. |
| `architecture.js` | The 10-stage step-through board. All copy lives in a `STAGES` array so the chart can be edited without touching rendering code, and the example values are taken from real engine runs rather than invented. |
| `install.js` | The extension install checklist. Persists progress to `localStorage` so a user who leaves mid-way returns to their place; every storage and clipboard failure is swallowed. |
| `mascot-eyes.js` | Both mascot mounts. See [below](#-mascot-eye-follow-button). |
| `shape-waves.js` | A vanilla WebGPU port of React Bits' `<ShapeWaves />`, 726 lines of WGSL. Degrades to nothing where WebGPU is unavailable (notably Firefox). |

**Why `js/api.js` does not send its `stats`:** the parameter is accepted for
call-site compatibility, but the comment records the real reason — per the API
contract the backend derives `privacy` from the redacted text itself, so the
client never transmits PII telemetry at all.

---

### `tools/` — build-time scripts

| File | Role |
| --- | --- |
| `render-logo.js` | `assets/logo.svg` → every PNG size, using headless Chrome. |
| `build-ico.js` | PNGs → multi-size `assets/favicon.ico` (16/32/48). |
| `build-zips.js` | Generates both published archives. Never hand-edited. |
| `verify-banner.js` | Renders the **real** extension banner in a browser, not just by regex. |

**The archive rules matter:**
- `ratiod-extension.zip` contains only what `manifest.json` references, with the
  manifest at the **archive root** — Chrome refuses an archive with a wrapper
  folder. It is derived from the manifest, so it cannot drift.
- `ratiod-full-project.zip` contains every git-tracked file minus `.git`,
  `.vercel` and the archives themselves, derived from `git ls-files`.

`server/test-extension-package.js` fails if either archive drifts from source,
so a stale download is a test failure rather than a silent defect. This is not
hypothetical: the full-project archive previously went stale and would have
shipped a `banner.js` **without** the HTML-escaping fix.

> ⚠️ **Scope of that guard, precisely.** The test drift-checks specific files —
> `manifest.json` in the extension zip, and `banner.js` in both — plus each
> archive's *file list*, the manifest-at-root rule, and the exclusion of `.git`,
> `.vercel` and the archives themselves. It does **not** hash every entry.
> Editing, say, `README.md` or `docs/report.md` leaves the published zip
> silently stale until someone runs `build-zips.js`. That happened while writing
> this very README, which is why it is called out here. If you change any file
> that ships, rebuild the archives.

### `server/test-*.js` — the twelve suites

| Suite | Guards |
| --- | --- |
| `test-phishing.js` | End-to-end scoring against the preset payloads. |
| `test-spec-rules.js` | Each individual rule fires on its documented sample. |
| `test-spec-sanity.js` | The rules do not fire where they should not. |
| `test-false-positives.js` | Benign corpora stay `safe`. |
| `test-model-signals.js` | Every structural signal catches its attack **and** never touches benign traffic. |
| `test-promo-verdict.js` | The `promo_clutter` boundary. |
| `test-ui-static.js` | Markup and CSS invariants in the static console. |
| `test-mascot-eyes.js` | Runs `mascot-eyes.js` in a `vm` sandbox and asserts the overlay geometry. |
| `test-extension-package.js` | The zip archives match source. |
| `test-shape-waves.js` | WGSL/JS structure via a `vm` sandbox. |
| `test-hero-legibility.js` | The hero background does not compete with hero copy. |
| `test-architecture.js` | The architecture chart tells the truth — see below. |
| `test-ui-contract.js` | **Integration.** Requires a live server. |

`test-architecture.js` is the one worth singling out. It does not check that the
board *renders*; it checks that the board does not **lie**. It asserts the
documented typosquat is a real engine flag, the documented combined score
matches the real combiner (it actually calls `combineScore()`), the documented
redaction counts are real, the chart does not present the stub as a live Laya
container, it states the LLM does not re-decide the score, and it promises zero
persistence only where the code actually does.

---

## 🎨 Design system & tokens (Playful Neo-Brutalist Utility)

- **Canvas & Card**: `#F6F1E7` (warm paper canvas with dot grid), `#FFFFFF`
  (surface card), `#121212` (ink border & text)
- **Primary Accent**: `#EA3E2B` (orange-red)
- **Sticker Accents**: `#FFD23F`, `#5DBBFF`, `#FF8FB1`, `#9BE86D`
- **Status Badges**: `#8A8B5C` (muted olive · safe), `#E8720C` (amber ·
  suspicious), `#EA3E2B` (red · high risk)
- **Typography**: `Plus Jakarta Sans` (display), `Instrument Serif` (italic
  accent words), `Inter` (body), `JetBrains Mono` (telemetry & brackets)
- **Tactile UI**: `3px` solid ink borders, `6px 6px 0 #121212` hard shadows with
  a press interaction of `translate(2px, 2px)`

Note the two canvases: the site uses `#F6F1E7`, the injected Gmail banner uses
`#F8F7F2` with `4px 4px 0` shadows, because it must sit inside someone else's
page rather than own it.

---

## 🔷 Brand logo

`assets/logo.svg` is the single source of truth for the mark. Everything else
is generated from it — there are no hand-drawn PNGs to drift out of sync:

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
banner via `web_accessible_resources`.

---

## 👁️ Mascot eye-follow button

The floating mascot in the bottom-right is a dependency-free port of Framer's
`<Eye Follow Button />`, restyled as the Ratio'd shield. Its pupils track the
cursor with a spring and blink on a timer. It replaced the plain red "Get
Extension" button that used to sit in the same corner, so there is now exactly
one floating control.

**The same engine also drives the hero mascot.** The hero card's artwork is a
flat JPEG, so `js/mascot-eyes.js` mounts a second instance there
(`data-mascot-eyes="overlay"`) that draws *only* the two eyes over the picture
and leaves the shield, magnifier, gloves and boots exactly as painted. Both
mounts share one `mousemove` listener and one `requestAnimationFrame` loop, so
the second mascot costs no extra listeners.

Because that overlay has to sit on real pixels, its geometry is **measured from
the artwork rather than eyeballed**: the sclera of each eye is flood-filled in
`assets/mascot.jpg` and its edge ray-cast from the eye centre, giving the
ellipse in the image's own 760×760 pixel space. The pupil covers the right of
each eye, so the visible white bounding box on its own under-reports the
horizontal radius — measuring the boundary is what gets it right.

Two details make the overlay invisible rather than merely close:

- An SVG stroke is **centred** on its path, so the ellipse is drawn at
  `sclera + ring/2`, which puts the ink exactly over the band the artwork
  already painted. The white then shows only up to the true sclera edge, so the
  eye neither shrinks nor grows.
- The ring is hand-drawn and varies by several px around each eye, so a small
  slop widens the path **and** the stroke together. That moves only the outer
  edge, burying the wobble; without it a sliver of the original outline shows
  through and the eye reads as faintly ringed twice.

**Why a port, not the component.** The original ships as a compiled Framer
module importing `framer`, `framer-motion` and `react/jsx-runtime` from
`framerusercontent.com`. This site is static files with no build step and no
`node_modules`, so none of those imports can resolve — and loading it would put
a third-party script on a page whose entire pitch is *"zero data stored,
everything local"*. `js/shape-waves.js` is a port for exactly the same reason.

**What was kept,** because it is the actual feel of the component:
- Per-eye tracking from each eye's **own** origin, not a shared centre — this is
  what gives the pair its slight parallax.
- The clamp `maxDistance = (eyeSize - pupilSize) / 2 * (range / 100)`. The pupil
  can never slide out of the sclera, however far away the cursor goes. The hero
  eyes are tall ovals rather than circles, so the clamp is generalised to an
  ellipse (`reachX`/`reachY`); with a round sclera the two are equal and it
  collapses back to the original constant.
- The spring at `stiffness = speed, damping = 20`, integrated by hand rather
  than faked with a CSS transition, so the slight overshoot on a fast flick
  matches framer-motion.
- The blink: `scaleY` on the eyeball down to `0.3` for 200 ms on a timer. The
  hero's eyes deliberately do **not** blink — squashing them would expose the
  painted eye underneath. This is why the blink is gated on non-overlay mounts.
- The bob animation moved from the image to the new wrapper, because the layer
  is a sibling of the image and the two must move together.

**Degradation.** With JS off the button is still a working, labelled link and
the hero simply shows its original artwork. With
`prefers-reduced-motion: reduce`, or on a touch device with no cursor to follow,
the mascot is still drawn but marked `data-mascot-state="static"` and no
animation loop is ever started. The `requestAnimationFrame` loop also parks
itself once the springs settle rather than spinning on a static page.

Run its suite on its own with `npm run test:mascot`.

---

## 🧩 Chrome extension

| Area | Detail |
| --- | --- |
| Verdict | Rendered from the API's `verdict` field, not re-derived from the score, so all four verdicts (`safe` / `suspicious` / `high_risk` / `promo_clutter`) label correctly |
| Escaping | `flags[].span` is a verbatim slice of the email body and `explanation` can be LLM-written. Both pass through `escapeHtml()` before touching `innerHTML`, so a hostile email cannot execute script in the user's Gmail session |
| Controls | **Dismiss** removes the banner, **Collapse** hides the body but keeps the score visible, and the drawer toggle keeps `aria-expanded` in sync |
| Accessibility | Icon-only buttons carry `.sr-only` labels, all buttons are `type="button"`, and `prefers-reduced-motion: reduce` disables the confetti burst and chime |
| Credit | Banner footer links to the author's GitHub, matching the site |

Verify the real banner in a browser, not just by regex:

```bash
node tools/verify-banner.js
```

### Building the downloadable archives

```bash
node tools/build-zips.js
```

---

## 🧠 Detection model

The rule engine contributes **70%** of the score and the Laya scorer **30%**.
Laya layers named, weighted **structural signals** on top of its flag and token
counts:

| Signal | Weight | Why |
| --- | --- | --- |
| `punycode_host` | 0.34 | `xn--` IDN hosts survive a copy-paste lookalike |
| `ip_literal_link` | 0.34 | Legitimate services use named hosts, not bare IPs |
| `data_uri` | 0.30 | Smuggles a payload past a mail gateway |
| `base64_blob` | 0.24 | Hides an attachment or a redirect |
| `credential_or_wire` | 0.20 | Brand credential prompt, or a gift-card/crypto demand |
| `link_farm` | 0.18 | Five or more distinct outbound hosts in one message |

Contributions add up as `ruleFlags × 0.25 + tokenMatches × 0.15 + Σ weights`.
Signals past the second are damped by `0.06` each, so a message tripping many
of them is not scored as many times as bad. The result is clamped to
`[0.02, 0.99]` and labelled `high_risk ≥ 0.65`, `suspicious ≥ 0.30`.

Every signal name is returned in `engine.model_signals` so the score is
auditable rather than an unexplained number, and `test-model-signals.js` pins
both the attacks each signal must catch and the benign traffic it must never
touch.

**Every threshold in one table:**

| Constant | Value | Where |
| --- | --- | --- |
| Rule / model weighting | `0.70` / `0.30` | `combine/score.js` |
| Severe spoof floor | `82` → forces `high_risk` | `combine/score.js` |
| Severe rule floor | `75` | `combine/score.js` |
| `high_risk` threshold | `66` | `combine/score.js` |
| `suspicious` threshold | `35` | `combine/score.js` |
| Official-sender cap | `25` | `rules/engine.js` |
| Promo-clutter trigger | `≥2` promo signals and score `<40` | `rules/engine.js` |
| Levenshtein / length tolerance | `≤2` and `≤2`, brand `≥4` chars | `rules/engine.js` |
| LLM grounding | every phrase verbatim in source | `llm/explain.js` |

---

## 📁 Repository structure

```
.
├── index.html                     # Web console (single source of truth)
├── styles.css                     # Playful Neo-Brutalist stylesheet
├── favicon.ico                    # Root copy: browsers probe /favicon.ico
├── privacy.html                   # Privacy policy page
├── js/                            # Console modules, all plain window globals
│   ├── redactor.js                # Client-side PII redaction
│   ├── presets.js                 # The three demo payloads
│   ├── api.js                     # Environment-aware API client + fallback
│   ├── app.js                     # Console orchestrator
│   ├── pipeline.js                # GSAP stage highlight + score gauge
│   ├── architecture.js            # 10-stage step-through board
│   ├── install.js                 # Extension install checklist
│   ├── mascot-eyes.js             # Both mascot eye-follow mounts
│   └── shape-waves.js             # Vanilla WebGPU hero background
├── assets/                        # logo.svg, favicons, mascot.jpg
├── extension/                     # Gmail Chrome extension (Manifest V3)
│   ├── manifest.json
│   ├── content-script.js          # Stages 0-2: watcher, redactor, transport
│   ├── banner.js                  # Stage 9: Shadow DOM banner injector
│   ├── background.js              # Service worker (currently unused)
│   └── icons/                     # 16 / 48 / 128 / 512
├── server/                        # Analysis pipeline (shared by both runtimes)
│   ├── routes/analyze.js          # POST /analyze orchestrator
│   ├── rules/engine.js            # Deterministic threat rules
│   ├── laya/client.js             # Weighted signal scorer (the "model")
│   ├── combine/score.js           # Score + verdict + next-steps builder
│   ├── llm/explain.js             # Grounded explanation generator
│   ├── llm/prompt.js              # System prompt
│   ├── privacy/log.js             # Zero-persistence telemetry
│   └── test-*.js                  # Twelve suites
├── tools/                         # Build-time scripts
│   ├── render-logo.js             # logo.svg -> every PNG size
│   ├── build-ico.js               # PNGs -> multi-size .ico
│   ├── build-zips.js              # Both published archives
│   └── verify-banner.js           # Renders the real banner in a browser
├── server.js                      # Universal entrypoint
├── api/index.js                   # Re-exports the root handler
├── test-ui-contract.js            # Live API <-> UI contract test
├── vercel.json                    # Routing + blocks internal paths
├── ratiod-extension.zip           # Generated, never hand-edited
├── ratiod-full-project.zip        # Generated, never hand-edited
└── docs/report.md                 # Detailed project report
```

> **Note:** the frontend is served from the repository root by both the local
> server and Vercel. There is intentionally only **one** copy — earlier
> duplicated copies under `web/` and `server/web/` caused localhost and
> production to drift apart. `server.js` is likewise the single HTTP
> entrypoint, so the two environments cannot diverge in behaviour.

---

## 🛠️ Getting started

### 1. Start the service (API + web console)

```bash
npm start          # or: node server.js
```

One process serves both:

- Console: **http://localhost:3000**
- API: `POST http://localhost:3000/analyze`, `GET http://localhost:3000/health`

There are no dependencies to install first.

### 2. (Optional) serve the console on a separate port

```bash
python3 -m http.server 8999
```

Run from the repository root, then open http://localhost:8999. The console will
still reach the analysis API on port 3000 — `js/api.js` tries the local engine
first when it detects a local hostname.

### 3. Run the test suites

```bash
npm test           # just the phishing regression suite
npm run test:all   # everything (see the prerequisite below)
```

### 4. Load the Chrome extension in Gmail

1. Open `chrome://extensions/`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder.
4. Open [Gmail](https://mail.google.com) and click any email.

### 5. Deploy to Vercel

Production is **https://ratio-d.vercel.app**.

The Vercel project must have **Root Directory = (empty / repo root)** and
**Framework = Other**. If Root Directory is left as `server`, Vercel never sees
`index.html` and every asset 404s.

```bash
npm i -g vercel
vercel link --project ratio-d --yes
vercel --prod
```

`vercel.json` blocks `/server/*`, `/docs/*`, `/extension/*`, dotfiles and
`package.json` from being served, and routes `/analyze` and `/health` to the
function in `api/index.js`.

---

## 🧪 Testing

```bash
npm run test:all
```

| Script | Runs |
| --- | --- |
| `test` | `test-phishing.js` |
| `test:ui` | static UI + UI contract + architecture |
| `test:spec` | spec rules + spec sanity |
| `test:fp` | false positives |
| `test:model` | model signals |
| `test:corpus` | real scam corpus: recall floor, flag grounding, false positives |
| `test:promo` | promo verdict |
| `test:mascot` | mascot eyes |
| `test:ext` | extension package |
| `test:fx` | shape waves + hero legibility |
| `test:all` | everything above in order |

> ⚠️ **`test:all` requires a running server.** `test-ui-contract.js` makes real
> HTTP calls to `http://127.0.0.1:3000` to verify the API contract the console
> depends on. With no server running, that final suite fails with
> `CONTRACT TEST FAILED: fetch failed` and the run exits `1` — the other thirteen
> suites still pass. This is a harness prerequisite, not a code defect. Start
> `node server.js` in another terminal first, or point the test elsewhere with
> `BASE=http://host:port npm run test:all`.
>
> Verified result: **397 assertions passing, 0 failures** with the server up.

---

## ⚠️ What this is not — honest limits

Documented deliberately, because a security tool that oversells itself is worse
than no tool.

1. **There is no trained model.** Nothing here was learned or trained; every
   weight is hand-chosen. A typosquat is caught by string normalisation and edit
   distance. Recall of **75%** on the 20-record external corpus is now measured
   and enforced by `test:corpus`, but that corpus contains no `legitimate`
   examples, so **no precision or false-positive rate has been measured**. If
   this is described as "AI-powered detection", that is overselling it.

2. **The OTP redaction regex over-masks.**
   `/\b(OTP|code|passcode|PIN)?\s?:?\s?(\d{4,8})\b/gi` makes the keyword group
   **optional**, so any standalone 4–8 digit number becomes `[OTP_REDACTED]` —
   order numbers, years, prices, account fragments. Harmless for safety, but it
   mangles legitimate mail and inflates the "items masked" count. The fix is to
   require the keyword.

3. **It reads the body only.** `content-script.js` passes `innerText`. Sender,
   subject, headers, SPF/DKIM results and link `href`s are never inspected,
   even though the rules in `rules/engine.js` are written to expect a `From:`
   line. A spoofed display name passing SPF is out of reach.

4. **Gmail's private selectors are fragile.** `.a3s.aiL` and friends break on a
   Google redesign, and the extension then fails *silently* — it simply stops
   reporting — rather than warning the user.

5. **English only, and no attachments.** There is no HTML-phishing detection
   (hidden text, form injection, obfuscated markup) and no attachment scanning.
   Those are the highest-value signals in real phishing and none are
   implemented.

6. **The brand list is 24 hardcoded names.** A typosquat of a company that is
   not on that list is invisible to the homoglyph and Levenshtein checks; it
   can only be caught by the generic pattern rules.

7. **PII is never transmitted, but text can be.** With no local server, the
   extension falls back to `ratio-d.vercel.app`, so redacted message text does
   leave the machine. The privacy guarantee is "no PII leaves", not "nothing
   leaves".

8. **`background.js` is dead code** that implies a messaging architecture the
   content script deliberately abandoned.
9. **The archive-integrity guard is narrower than it appears.**
   `test-extension-package.js` drift-checks `manifest.json` and `banner.js`
   plus the file listings — it does not hash every entry. Editing any other
   shipped file leaves `ratiod-full-project.zip` silently stale while the suite
   still passes. This was observed in practice while updating these documents:
   the published zip carried a stale README and report, and the test was green.

---

## 📜 License & acknowledgments

Built for Cybersecurity & Defense Track by [Vedant](https://github.com/VedxntDev).
MIT License.
