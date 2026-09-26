# AGENTS.md — Project Context for Ratio'd

Dense, factual context for tooling, agents and code extraction. No marketing.
For the narrative version see [README.md](README.md); for the measured audit see
[docs/report.md](docs/report.md). A machine-readable manifest is generated at
[docs/project-context.json](docs/project-context.json) — **build it, don't edit
it**: `node tools/build-context.js`.

---

## 1. What this is

Privacy-first phishing/smishing triage. Three deliverables in one repo:

| Deliverable | Entry | Notes |
| --- | --- | --- |
| Chrome extension (MV3) | `extension/manifest.json` | Injects a Shadow DOM banner into Gmail |
| Static web console | `index.html` | Paste-and-analyse, animated 4-stage pipeline |
| Node server | `server.js` | One handler, used by localhost **and** Vercel |

**Zero runtime dependencies. No build step. No database. No framework.**

### Read this before describing the system

> **There is no trained ML model.** `server/laya/client.js` is a hand-weighted
> scorer. It hardcodes `source: "laya_stub_heuristic"` and that string is
> returned to the client on every response, precisely so a heuristic score is
> never presented as a model verdict. Calling this "AI-powered detection" is
> overselling it.

The LLM in `server/llm/` is **explanation-only**: off unless
`RATIOD_LLM_API_KEY` is set, structurally unable to change a score or verdict,
and every phrase it returns is verified verbatim against the source text.

---

## 2. Commands

```bash
node server.js                 # start (serves API + console on :3000)
npm test                       # phishing regression suite
npm run test:corpus            # real-corpus recall/specificity/grounding (no server needed)
npm run test:all               # EVERYTHING  (REQUIRES a running server — see below)
node tools/build-context.js    # regenerate docs/project-context.json
node tools/build-zips.js       # regenerate both published archives
```

> ⚠️ **`test:all` requires `node server.js` to be running.** `test-ui-contract.js`
> makes real HTTP calls to `http://127.0.0.1:3000`. Without a server the other
> suites still pass but that one fails with `CONTRACT TEST FAILED: fetch failed`
> and the run exits `1`. Override the target with `BASE=http://host:port`.

Current state: **410 assertions passing, 0 failures.**

---

## 3. Data flow — the one thing to get right

PII is redacted **in the page, before the network hop**. Everything downstream
only ever sees masked text.

```
BROWSER                              SERVER
───────                              ──────
0 trigger   MutationObserver + 1s poll
1 redact    phones/emails/OTPs  ─────▶ PII dies here
   ═════════════ never crosses this line ═════════════
2 transport POST /analyze  ────────▶  3 route    validate, count redactions
   :3000 → Vercel → offline          4 rules    homoglyph/Levenshtein/combos
                                       5 signals  weighted structural signals
                                       6 combine  0.70·rules + 0.30·signals
                                       7 explain  template, or grounded LLM
                                       8 log      counts only, never text
                                       9 render ◀─ Shadow DOM banner
```

Transport fallbacks mean the extension still works with no server at all, and
the console falls back to a browser-only engine. The privacy guarantee is
**"no PII is transmitted"**, *not* "nothing is transmitted".

---

## 4. Detection model

### 4.1 Scoring

```
raw   = ruleScore × 0.70 + signalProbability × 100 × 0.30
score = clamp(raw, 0, 100)
```

| Condition | Effect |
| --- | --- |
| Severe domain spoof (homoglyph / typosquat / impersonation / urgency+credential) | `max(82, …)`, verdict forced `high_risk` |
| Any other severe rule, score < 70 | `max(75, …)` |
| Official brand sender, no credential request | score **capped at 25** |

`high_risk` ≥ 66 · `suspicious` ≥ 35 · `promo_clutter` (≥2 promo signals, score
< 40) · else `safe`.

### 4.2 The rule engine is the real detector — `server/rules/engine.js`

Per domain, three brand checks: **homoglyph substitution**, **brand stuffing**,
**Levenshtein ≤ 2** (with length delta ≤ 2 and brand length ≥ 4). Two
normalisers run — `1→i` and `1→l` — because `paypa1` only resolves to `paypal`
under the second.

Ten social-engineering families, each contributing **at most twice** (second
match at half value):

| Family | Pts | Family | Pts |
| --- | --- | --- | --- |
| `advance_fee` | 20 | `investment` | 15 |
| `refund_bait` | 18 | `health_claim` | 15 |
| `delivery_fee` | 20 | `personal_data` | 15 (no corroboration bonus) |
| `fake_subscription` | 18 | `contact_stranger` | 15 |
| `fake_security` | 20 | `inheritance` | 25 |

Structural checks that are **brand-independent** — prefer adding these:

- **Reply-To ≠ From** `+25` — defeats reply-path filtering
- **Mixed-script homoglyph** `+30` — a Cyrillic/Greek char inside a Latin word
- **Sender on free/abuse hosting** `+20` — checked against *From*, not body links
- **Display-name impersonation** `+55` — brand name vs sending domain
- **Signature-footer impersonation** `+45` — `© 2025 PayPal, LLC` from a throwaway
- **Large amount quoted unsolicited** `+15`

Combinations are the real signal, since neither half is conclusive alone:
urgency+credential `+45` · money-bait + action-request `+45` · advance-fee shape
`+40` · advance-fee + six-figure amount `+25` · shortener+pressure `+30` ·
sender/link mismatch `+30`.

### 4.3 The free-mail exemption — a bug worth remembering

`gmail.com` genuinely appears in `OFFICIAL_BRAND_DOMAINS.google`. Without the
exemption in `isFreeMailDomain()`, **every scam sent from a personal mailbox was
treated as an official sender** — score capped at 25 and every disqualifier
skipped. The check appears in **three** places in the engine; all three must
stay guarded.

---

## 5. API contract

`POST /analyze` (also `/api/analyze`, `/api`) · `GET /health`

Request: `{ text: string, channel: "email" | "sms" }` — `text` is **already
client-redacted**.

Response: `{ score, verdict, flags, explanation, next_steps, privacy, engine }`

- `verdict` ∈ `safe` · `suspicious` · `high_risk` · `promo_clutter`
- `flags[]` = `{ span, reason, type }` — **`span` must be a verbatim substring of
  the input.** Enforced by `test-scam-corpus.js`.
- `engine.model_source` is always `laya_stub_heuristic`
- `engine.explain_source` is `deterministic` unless an LLM key is configured

---

## 6. Evaluation

`server/test-scam-corpus.js` runs two real-world corpora and asserts recall
floors, specificity, flag grounding, and zero false positives on a 15-case
adversarial legitimate set.

| Corpus | Contents | Result |
| --- | --- | --- |
| A `server/fixtures/scam-corpus.txt` | 20 scam, **no ham** | recall 17/20 (85%) |
| B `server/fixtures/real-world-mixed.txt` | 9 scam + 2 ham | recall 9/9, specificity 2/2 |
| Combined | | TP 26, FN 3, TN 2, FP 0 |

> **Two ham messages cannot support a precision or false-positive rate.** These
> are regression guards, not accuracy estimates. Corpus A is single-class, so it
> cannot constrain specificity at all.

Adding a rule without adding a test is a defect. Declared residual misses live
in `KNOWN_MISSES` with reasons, so the floor cannot be raised by quietly
deleting hard cases.

---

## 7. Security invariants — do not break these

1. **`escapeHtml()` on every banner interpolation.** `flags[].span` is a raw
   slice of the email body and `explanation` can be LLM-written. Without
   escaping, a hostile email executes in the user's live Gmail session.
2. **Flag spans stay verbatim.** Never synthesise evidence.
3. **No raw message text is ever persisted.** `privacy/log.js` logs counts only.
4. **Path traversal** — `resolveWebFile()` rejects `..`, re-resolves, and
   allowlists the first path segment.
5. **Extension permissions** are `activeTab` + `storage` only.
6. **`isGrounded()`** discards an entire LLM response if the model invented
   every flag.

---

## 8. Conventions

- Server: CommonJS + JSDoc. Browser: plain `window` globals, no modules.
- Comments explain **why**, and record the false positive that motivated a guard.
- Both `.zip` archives are generated — never hand-edited. The archive test
  drift-checks only `manifest.json` and `banner.js`, so **rebuild after editing
  anything that ships**.
- Anything in the taxonomy must be reflected in the `TAXONOMY` export, which is
  derived from the same constants the engine runs on.

---

## 9. Known limitations

See `known_limitations` in `docs/project-context.json` for the canonical list.
The ones that bite first:

1. No trained model; every weight is hand-chosen.
2. No precision measurement — only 2 ham messages exist.
3. OTP redaction over-masks (the keyword group is optional, so any standalone
   4–8 digit number is replaced).
4. Body text only — sender, subject, headers, SPF/DKIM and link `href`s are
   never inspected, though `rules/engine.js` is written to expect a `From:` line.
5. Gmail private selectors break silently on a Google redesign.
6. No attachment scanning, no HTML-phishing analysis.
7. `extension/background.js` is dead code.
