# Ratio'd — Project Report
**Scam Risk Analyzer & Defense System · Developed by [Vedant](https://github.com/VedxntDev)**

*Last verified: 26 September 2026. Every measurement in this report was
produced by running the code in this repository, not estimated. Where a claim
could not be re-verified, it is marked as such rather than carried forward.*

---

## 1. Executive summary

Phishing and smishing (SMS fraud) dominate reported social-engineering
incidents, and consumer tools tend to fall into one of two failure modes:
they upload full message content — including live credentials and personal
numbers — to a cloud service, or they show a generic warning with no
explanation and no recovery steps.

**Ratio'd** is a Chrome extension plus a static site plus one small Node
server that scores an email or SMS for scam risk, redacts personally
identifiable information *in the browser before transmission*, and explains its
reasoning in plain language inside an isolated Shadow DOM banner.

### What this project is, precisely

| It is | It is not |
| --- | --- |
| A deterministic phishing rule engine with measured, tested coverage | A machine-learning system |
| A privacy-preserving analysis pipeline (PII masked client-side) | Air-gapped / fully offline by default |
| An auditable scoring model (every signal name returned) | A validated classifier with published precision/recall |
| A static site with zero runtime dependencies | A full mail-security product |

> **Correction to an earlier version of this report.** Previous revisions
> described the system as *"air-gapped"* and referred to a `web/` directory.
> Both were inaccurate. The extension posts to `http://127.0.0.1:3000/analyze`
> and, when no local server answers, falls back to
> `https://ratio-d.vercel.app/api/analyze` — so redacted message text *can*
> leave the machine. The guarantee is **"PII is never transmitted"**, not
> "nothing is ever transmitted". The `web/` directory no longer exists; the
> console is served from the repository root by both runtimes.

---

## 2. System architecture

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

### Component responsibilities

| # | Component | File | Responsibility |
| --- | --- | --- | --- |
| 0 | Trigger | `extension/content-script.js` | Watch the Gmail read pane; dedupe repeated scans |
| 1 | Redactor | `extension/content-script.js`, `js/redactor.js` | Mask phones, emails, OTPs in browser memory |
| 2 | Transport | `extension/content-script.js`, `js/api.js` | POST masked text; fall back local → cloud → offline |
| 3 | Route | `server.js`, `server/routes/analyze.js` | One handler for localhost and Vercel; validate input |
| 4 | Rule engine | `server/rules/engine.js` | **Primary detector.** Typosquats, homoglyphs, coercion, mismatch |
| 5 | Laya | `server/laya/client.js` | Weighted structural signals → probability |
| 6 | Combiner | `server/combine/score.js` | 70/30 blend, disqualifying floors, verdict, next steps |
| 7 | Explainer | `server/llm/explain.js` | Deterministic template, or a grounded LLM |
| 8 | Telemetry | `server/privacy/log.js` | Aggregate counts only |
| 9 | Renderer | `extension/banner.js`, `js/app.js` | Shadow DOM banner / animated console |

---

## 3. Detection methodology

### 3.1 The rule engine is the real detector

`server/rules/engine.js` (423 lines) is where detection actually happens. For
every domain extracted from the text, it applies three brand checks:

| Check | Technique | Catches | Points |
| --- | --- | --- | --- |
| A | Homoglyph normalisation | `paypa1`, `m1crosoft`, `microsft-paypal` | +65 |
| B | Subdomain / hyphen brand stuffing | `microsoft-support.com`, `login-microsoft.net` | +55 |
| C | Levenshtein distance ≤ 2 with length delta ≤ 2 | `microsft`, `appple`, `micosoft` | +55 |

**The dual normaliser.** Check A runs two passes — `1→i`
(`normalizeForBrandCheck`) and `1→l` (`normalizeAltForBrandCheck`). The second
exists because `paypa1` resolves to `paypal` only under `1→l`; under `1→i`
it becomes `paypai` and matches nothing. This one detail is the difference
between catching and missing the single most common payment-brand lure.

**False-positive controls.** Three mechanisms, each added in response to an
observed false positive:

1. `MIN_BRAND_LEN = 4` — brands of 1–3 characters match by accident. An `x`
   anywhere in a domain made `example.com` look like impersonation.
2. `LEGITIMATE_DOMAINS` — 70 real exempt domains. `shopify.com` sits 2 edits
   from `spotify.com` and was being flagged as a typosquat.
3. Official-sender cap — a verified brand domain with no credential request is
   capped at **25**, regardless of how many weak signals fired.

### 3.2 Pattern and combination rules

| Rule family | Points | Example match |
| --- | --- | --- |
| Urgency / fear triggers | +25 each | `will be suspended`, `unusual activity`, `final notice` |
| Credential demands | +30 each | `verify your credentials`, `provide your OTP` |
| Suspicious domains | +35 | `.xyz`/`.top` TLDs, raw IP URLs, 19 known URL shorteners |
| **Urgency + credential** (combo) | +45 | The classic credential lure |
| **Shortener + pressure** (combo) | +30 | Smishing / delivery-fraud signature |
| **Sender ≠ link domain** (combo) | +30 | Mail from A, links to B |

The three combination rules carry the most weight because phishing is defined
by co-occurrence: urgency alone appears in legitimate mail, and a short link
alone appears in legitimate mail, but urgency plus a credential request from a
non-official sender is nearly conclusive.

### 3.3 The "model" layer

`server/laya/client.js` is a hand-weighted additive scorer:

```
threat = ruleFlags × 0.25  +  tokenMatches × 0.15  +  Σ structural weights
```

Six structural signals, each chosen because legitimate transactional and
marketing mail essentially never contains it:

| Signal | Weight | Rationale |
| --- | --- | --- |
| `punycode_host` | 0.34 | `xn--` IDN hosts survive a copy-paste lookalike |
| `ip_literal_link` | 0.34 | Legitimate services use named hosts |
| `data_uri` | 0.30 | Smuggles a payload past a mail gateway |
| `base64_blob` | 0.24 | Hides an attachment or redirect |
| `credential_or_wire` | 0.20 | Brand credential prompt or crypto/wire demand |
| `link_farm` | 0.18 | ≥5 distinct outbound hosts in one short message |

**Diminishing returns.** Signals past the second are damped by `0.06` each. A
message tripping five signals is not five times as bad as one tripping a
single signal, and without this the weights over-saturate immediately.

**Auditability.** Every fired signal name is returned in
`engine.model_signals`, so the score is always decomposable. Each signal is
individually pinned by `test-model-signals.js` against both an attack corpus
and a benign corpus.

**Honesty guarantee.** The function unconditionally returns
`source: "laya_stub_heuristic"` and a note reading *"Local typed-decision
fallback model active (laya container offline)."* There is no code path that
can report a fabricated model score, and `test-architecture.js` asserts the
public-facing architecture chart does not present the stub as a live container.

### 3.4 Score combination and disqualification

```
raw = ruleScore × 0.70 + layaProbability × 100 × 0.30
```

Two overrides then make the verdict trustworthy:

- **Severe domain spoof** (homoglyph / typosquat / brand impersonation /
  urgency+credential) → `max(82, …)`, verdict forced to `high_risk`. Domain
  spoofing is disqualifying on its own, regardless of tone.
- **Any other severe rule** with score < 70 → `max(75, …)`.

Verdict ladder: spoofing or ≥66 → `high_risk`; promo clutter → `promo_clutter`;
≥35 → `suspicious`; else `safe`.

### 3.5 Grounded explanation

Two producers, and the response always reports which ran
(`engine.explain_source`):

- **`deterministic`** (default, zero network calls) — a template built
  strictly from the flags that actually fired.
- **`llm`** (only when `RATIOD_LLM_API_KEY` is set) — `temperature: 0`, JSON
  mode, 8-second abort.

The anti-hallucination gate, `isGrounded()`, requires every returned
`red_flags[].phrase` to appear **verbatim in the source text**. Ungrounded
phrases are dropped; if the model invented *every* flag, the entire response is
discarded and the deterministic text is used. Any error, timeout or non-OK
response also returns `null`.

The LLM can therefore never change a score or a verdict — it only rephrases
explanations that were already derived from rule output.

---

## 4. Verification audit

All results below were produced by running the code in this repository.

### 4.1 End-to-end scoring (live, `node server.js`)

| # | Input | Score | Verdict | Flags | Latency |
| --- | --- | --- | --- | --- | --- |
| 1 | `phishingEmail` — PayPal typosquat + urgency + credential demand | **100** | `high_risk` | 4 | 8 ms |
| 2 | `urgentSms` — USPS delivery-fee scam via `bit.ly` | **90** | `high_risk` | 3 | 2 ms |
| 3 | `legitimateNotice` — flight confirmation | **1** | `safe` | 0 | 0 ms |

> **Correction to an earlier version of this report.** That revision reported
> scores of `61`, `24` and `1` for these three payloads. Those numbers are
> stale. Re-running the current engine against the unchanged presets in
> `js/presets.js` yields **100 / 90 / 1**. The phishing cases now score far
> higher because the disqualifying floor and the additional combination rules
> were added after those figures were recorded.

### 4.2 Multi-signal phishing sample

Input: a sender at `paypa1-verify-account.xyz` with urgency, a credential
demand, an IP-literal URL, and a sender/link domain mismatch.

```
score: 100 | verdict: high_risk        (latency 5ms)
engine: laya_stub_heuristic, prob 0.99, signals [ip_literal_link, credential_or_wire]

[paypa1-verify-account.xyz]  Homoglyph/Typosquat: impersonates 'PAYPAL'
[within 24 hours]            Psychological time limit constraint
[unusual activity]           Fear trigger: unusual security activity alarm
[Click here to verify]       Urgent action demand
[will be suspended]          Threat of account loss ('will be suspended')
[verify your credentials]    Credential verification demand
[Urgency + Credential Combo] High-risk combination
[paypa1-verify-account.xyz]  High-risk top-level domain (TLD)
[http://198.51.100.7]        Raw IP address URL
[paypa1-verify-account.xyz]  Sender/link mismatch: links point to 198.51.100.7
```

Every flag cites a verbatim span from the message. No flag is invented.

### 4.3 Requirement audit

| # | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Privacy redaction before transmission | ✅ PASS | `redactPiiLocally()` runs in `content-script.js` before `fetch`; no code path sends raw PII. `js/api.js` explicitly does not transmit its `stats`. |
| 2 | Data-driven API output | ✅ PASS | Three payloads return 100 / 90 / 1 with distinct flags, explanations and next steps. |
| 3 | Anti-hallucination grounding | ✅ PASS | `isGrounded()` in `llm/explain.js`; all-invented LLM output is discarded entirely. |
| 4 | Zero persistence of message text | ✅ PASS | `privacy/log.js` logs counts only. No database, no file writes, no analytics in the repo. |
| 5 | Shadow DOM CSS isolation | ✅ PASS | `banner.js` uses `attachShadow({mode:"open"})` with inline styles. Verified in-browser by `tools/verify-banner.js`. |
| 6 | XSS safety in the banner | ✅ PASS | `escapeHtml()` applied to every interpolated value, including attacker-controlled `flags[].span` and LLM-written `explanation`. |
| 7 | Responsive 375–1440 px | ✅ PASS | Fluid `clamp()` typography; grid reflow at 992 px. Pinned by `test-ui-static.js`. |
| 8 | `prefers-reduced-motion` respected | ✅ PASS | GSAP, confetti and the chime all have reduced-motion branches. |
| 9 | Accessible controls | ✅ PASS | `.sr-only` labels on icon buttons, `type="button"`, `aria-expanded` kept in sync on the drawer and collapse toggle. |
| 10 | Archive integrity | ⚠️ PARTIAL | `test-extension-package.js` verifies the extension manifest matches source, `banner.js` matches in both archives, the file listings are correct, and `.git`/`.vercel`/the archives are excluded. It does **not** hash every entry, so any other edited file leaves the zip silently stale. This caught a previously stale archive that lacked the escaping fix, but the gap remains — see §6. |
| 11 | Documentation honesty | ✅ PASS | `test-architecture.js` asserts the chart's typosquat example is a real flag, its score example matches a live `combineScore()` call, it does not present the stub as a live container, and it promises zero persistence only where the code does. |
| 12 | Performance | ✅ PASS | 0–8 ms server latency; client redaction is a few regex passes. |

### 4.4 Test suite status

`npm run test:all` — **391 assertions passing, 0 failures**, comprising twelve
unit/static suites plus one live contract suite.

> ⚠️ **Harness prerequisite.** `test-ui-contract.js` performs real HTTP calls
> to `http://127.0.0.1:3000`, so the full run **requires `node server.js` to be
> running**. Without it, that final suite fails with
> `CONTRACT TEST FAILED: fetch failed` and the process exits `1` while the other
> twelve suites still pass. This was verified in both states. It is a harness
> prerequisite, not a product defect — but it is currently undocumented in
> `package.json`, and a contributor will hit it.

| Suite | Guards |
| --- | --- |
| `test-phishing.js` | End-to-end scoring on preset payloads |
| `test-spec-rules.js` | Each rule fires on its documented sample |
| `test-spec-sanity.js` | Rules do not fire where they should not |
| `test-false-positives.js` | Benign corpora remain `safe` |
| `test-model-signals.js` | Every signal catches its attack, spares benign traffic |
| `test-promo-verdict.js` | The `promo_clutter` boundary |
| `test-ui-static.js` | Console markup and CSS invariants |
| `test-mascot-eyes.js` | Mascot overlay geometry, run in a `vm` sandbox |
| `test-extension-package.js` | Published archives match source |
| `test-shape-waves.js` | WGSL/JS structure |
| `test-hero-legibility.js` | Hero background does not compete with hero copy |
| `test-architecture.js` | The architecture chart does not lie |
| `test-ui-contract.js` | Live API ↔ UI field contract (**needs a server**) |

---

## 5. Security & privacy design

| Control | Implementation | Why it exists |
| --- | --- | --- |
| **Client-side PII masking** | Three regexes in `content-script.js` and `js/redactor.js`, run before any request | Raw PII never reaches the network |
| **No persistence** | `privacy/log.js` writes counts via `console.log`; no DB, no file writes, no analytics | Nothing to breach |
| **Path-traversal guard** | `resolveWebFile()` in `server.js` rejects `..`, re-resolves, and allowlists the first path segment | `server/`, `docs/`, `extension/`, dotfiles and `package.json` are unservable |
| **Route masking** | `vercel.json` returns 404 for the same set | Defence in depth on the deployed host |
| **XSS containment** | `escapeHtml()` on all banner interpolation | An email must never execute script in the user's Gmail session |
| **Style isolation** | Shadow DOM + `all: initial` on `:host` | Gmail's CSS cannot alter the banner; the banner cannot alter Gmail |
| **Least privilege** | Extension requests only `activeTab` + `storage` | No broad host permissions beyond the three declared endpoints |
| **Grounded output** | `isGrounded()` verbatim check on every LLM phrase | A model cannot introduce a claim the source does not support |
| **Transparent provenance** | `engine.*` block on every response | A heuristic score is never presented as a model verdict |

### Data-flow guarantees

1. **PII is masked in the page** before the first `fetch`.
2. **Only masked text** is transmitted, to one of three endpoints
   (`:3000` → Vercel → fully offline fallback).
3. **No message text is stored** at any point, by any component.
4. **Telemetry is aggregate counts only** — how many phones, emails and codes
   were masked, never their values.

The honest boundary: step 2 means redacted message *text* can reach the Vercel
deployment when no local server is running. The guarantee is about PII, not
about total silence.

---

## 6. Known limitations

Stated plainly, because a security tool that oversells itself is worse than no
tool.

1. **No trained model.** Nothing was learned, trained, or evaluated against a
   labelled corpus. Typosquats are caught by string normalisation and edit
   distance. There is no precision/recall figure because no such measurement
   has been performed. Describing this as "AI-powered detection" would be
   overselling it.
2. **The OTP regex over-masks.** `/\b(OTP|code|passcode|PIN)?\s?:?\s?(\d{4,8})\b/gi`
   makes the keyword group optional, so any standalone 4–8 digit number is
   replaced — order numbers, years, prices. Safe, but it mangles legitimate
   mail and inflates the masked-item count. The fix is to require the keyword.
3. **Body text only.** The content script sends `innerText`. Sender, subject,
   headers, SPF/DKIM results and link `href`s are never inspected, even though
   `rules/engine.js` is written to expect a `From:` line. Display-name spoofing
   that passes SPF is out of reach.
4. **Fragile Gmail selectors.** `.a3s.aiL` and friends are Google's private
   classes; they break on a redesign, and the extension then fails *silently*
   rather than warning the user.
5. **No attachment or HTML-phishing analysis.** Hidden text, form injection and
   obfuscated markup are among the highest-value phishing signals, and none are
   implemented. Attachments are not scanned.
6. **English only.** Pattern tables are English-only; no other language is
   covered.
7. **24 hardcoded brands.** A typosquat of a company not on the list is
   invisible to the homoglyph and Levenshtein checks and can only be caught by
   the generic pattern rules.
8. **Dead code.** `extension/background.js` implements an `ANALYZE_EMAIL`
   message handler that `content-script.js` never calls, by deliberate design.
   It implies an architecture the code abandoned.
9. **Undocumented test prerequisite.** `npm run test:all` silently requires a
   running server because of `test-ui-contract.js`.
10. **The archive-integrity guard is narrower than it appears.**
    `test-extension-package.js` drift-checks `manifest.json` and `banner.js`
    plus the file listings — it does not hash every entry. Editing any other
    shipped file (this report, the README, a rule file) leaves
    `ratiod-full-project.zip` silently stale while the suite still passes. This
    was observed in practice while updating these documents: the published zip
    carried a 14 KB stale README and a 3 KB stale report, and the test was
    green throughout.

### Suggested next steps, in priority order

1. Make the archive test compare **every** entry's bytes against its source
   file, or have it build the zips and assert they are reproducible. This is
   the cheapest fix on the list and closes a guard that currently gives false
   confidence.
2. Require the OTP keyword in the redaction regex (correctness, low risk).
3. Have `test:all` start and stop its own server, or document the prerequisite
   in `package.json`.
4. Read the sender and subject from Gmail's header DOM and pass them
   separately, unlocking the sender/link-mismatch rule in practice.
5. Add an HTML-phishing pass over `innerHTML`: hidden inputs, obfuscated
   forms, `display:none` credential prompts.
6. Add a labelled evaluation corpus and publish real precision/recall, so the
   "model" claim can be made honestly.
7. Delete `extension/background.js`, or wire it up and document why it exists.

---

## 7. Conclusion

Ratio'd implements a coherent, tested, dependency-free phishing triage pipeline
with a genuine and verifiable privacy property: personally identifiable
information is masked in the browser and never transmitted. The detection
logic is deterministic, auditable and defensible — every score decomposes into
named signals, and every flag cites a verbatim span from the message.

Its principal weakness is not technical but representational. The architecture
is sound enough to be useful, and the codebase already takes unusual care to
report honestly what is and is not happening (`engine.model_source`,
`engine.explain_source`, the "chart does not lie" test suite). The remaining
work is to close the gap between that internal honesty and how the project is
described externally.
