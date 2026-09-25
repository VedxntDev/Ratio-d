# Ratio'd — Scam Risk Analyzer (Web Console)

Ratio'd is a privacy-first, client-side web application designed to analyze raw emails, SMS messages, and security telemetry for scam risks.

## Features

- **Playful Neo-Brutalist Utility UI**: High contrast, tactile push interaction system (`2px` solid ink borders, `4px 4px 0px #121212` hard shadows), bracketed micro-metadata tags.
- **Client-Side PII Redaction**: Phone numbers, email addresses, and OTP sequences are masked in browser memory before any data processing.
- **Live 4-Stage Pipeline**: Visualized Observe → Detect → Explain → Respond workflow driven by GSAP animations.
- **Risk Score Gauge**: Spring-animated circular score dial (0–100) with Safe, Suspicious, and High Risk verdict badges.
- **Annotated Threat Inspector**: Formatted message telemetry with highlighted threat spans and hover tooltips.
- **Actionable Recovery Checklist**: Context-aware remediation steps generated directly from backend rule analysis.

## Setup & Running Locally

1. Start the backend service:
   ```bash
   cd server
   node server.js
   ```
   *The server runs on http://localhost:3000.*

2. Serve the web application:
   ```bash
   cd web
   python3 -m http.server 8080
   ```
   Open `http://localhost:8080` in your web browser.
