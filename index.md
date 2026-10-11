# Ratio'd — Scam Risk Analyzer Engine

> Deterministic, homoglyph-aware, and Hamiltonian-physics-guided scam, phishing, promotion, and malicious URL detection engine.

Operated by: **Vedant Baghel**  
Website: [https://www.ratiod.online](https://www.ratiod.online)  
Email: [vedantsbaghel.2626@gmail.com](mailto:vedantsbaghel.2626@gmail.com)  
License: MIT  

---

## Capabilities & Architecture
- **Multi-Layered Detection Engine**: Combines deterministic rules, zero-width / Cyrillic homoglyph neutralization, Levenshtein brand distance scoring, and VegaML Hamiltonian dynamics.
- **Accurate Category Segregation**: Differentiates between:
  - `SAFE`: Legitimate transactional, newsletter, or routine correspondence.
  - `PROMO`: Legitimate marketing, webinar invites, course sales, promotional blasts.
  - `SUSPICIOUS`: High urgency, unverified senders, suspicious wording.
  - `MALICIOUS`: Active phishing, credential harvesting, brand impersonation, crypto wallet drains.
- **Safe Peek Unmasker**: Traces redirected HTTP chains safely without executing malicious browser payloads.
- **QR Code Payload Scanner**: Decodes embedded URLs in QR codes and analyzes destination domains.

---

## Agent Protocols & Machine Endpoints
- **LLM Context Guide**: [`/llms.txt`](https://www.ratiod.online/llms.txt)
- **Technical Reference**: [`/llms-full.txt`](https://www.ratiod.online/llms-full.txt)
- **OpenAPI 3.1.0 Specification**: [`/openapi.json`](https://www.ratiod.online/openapi.json)
- **Model Context Protocol (MCP)**: [`/.well-known/mcp.json`](https://www.ratiod.online/.well-known/mcp.json)
- **Agent-to-Agent Card (A2A)**: [`/.well-known/agent.json`](https://www.ratiod.online/.well-known/agent.json)
- **Sitemap**: [`/sitemap.xml`](https://www.ratiod.online/sitemap.xml)
- **Robots / Crawlers**: [`/robots.txt`](https://www.ratiod.online/robots.txt)

---

## API Endpoints

### 1. Analyze Content
`POST https://www.ratiod.online/analyze`
```json
{
  "text": "Your account has been suspended. Verify immediately at http://paypaI.com-update.xyz",
  "emailMeta": {
    "from": "alert@paypaI.com-update.xyz",
    "subject": "Urgent Action Required"
  }
}
```

Response:
```json
{
  "verdict": "MALICIOUS",
  "score": 96.4,
  "confidence": 98.0,
  "emailCategory": "PHISHING",
  "flags": ["BRAND_SPOOF_PAYPAL", "HOMOGLYPH_CYRILLIC", "HIGH_URGENCY_THREAT"]
}
```

### 2. Trace Redirects (Safe Peek)
`POST https://www.ratiod.online/unmask`
```json
{
  "url": "https://bit.ly/example-short-link"
}
```

### 3. Service Health
`GET https://www.ratiod.online/health`

---

## Navigation Links
- [About Ratio'd](https://www.ratiod.online/about)
- [Privacy Policy](https://www.ratiod.online/privacy)
- [Terms of Service](https://www.ratiod.online/terms)
- [Contact & Support](https://www.ratiod.online/contact)
