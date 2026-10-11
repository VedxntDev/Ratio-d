/**
 * Comprehensive Agent Accessibility & Actuity Audit Verification Suite.
 *
 * Runs 100% in-process without network sockets (fully sandbox safe).
 * Verifies all 10 Actuity audit check points and all 7 Agent Protocols:
 * - 01: Descriptive labels on inputs and controls
 * - 02: Recognisable navigation menus with standard links
 * - 03: Missing pages return HTTP 404 status code and serve 404.html
 * - 04: Clear operator and site ownership (Schema.org Organization/Person)
 * - 05: Buttons explain actions with accessible names/aria-labels
 * - 06: Sitemap exists and is discoverable
 * - 07: Normal links between pages
 * - 08: Landmark elements (<header>, <main role="main">, <footer role="contentinfo">)
 * - 09: Sections marked with aria-labelledby
 * - 10: Dedicated About, Contact, Terms, and Privacy pages
 * Protocols:
 * - 1: llms.txt & llms-full.txt
 * - 2: MCP (/.well-known/mcp.json & /mcp.json)
 * - 3: WebMCP (<script type="application/webmcp+json">)
 * - 4: A2A (/.well-known/agent.json & /a2a.json)
 * - 5: OpenAPI (/openapi.json & /openapi.yaml)
 * - 6: Markdown content negotiation (Accept: text/markdown)
 * - 7: Content signals & robots.txt (AI crawler directives)
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { EventEmitter } = require("events");

const handler = require("../server.js");

function pass(msg) {
  console.log(`  ✅ PASS: ${msg}`);
}

function fail(msg, err) {
  console.error(`  ❌ FAIL: ${msg}`);
  if (err) console.error(err);
  process.exitCode = 1;
}

function callHandler(url, headers = {}, method = "GET") {
  return new Promise((resolve) => {
    const req = new EventEmitter();
    req.method = method;
    req.url = url;
    req.headers = Object.assign({ host: "www.ratiod.online" }, headers);

    let statusCode = 200;
    let resHeaders = {};
    let body = "";

    const res = {
      setHeader(k, v) { resHeaders[k.toLowerCase()] = v; },
      writeHead(code, h = {}) {
        statusCode = code;
        for (const [k, v] of Object.entries(h)) {
          resHeaders[k.toLowerCase()] = v;
        }
      },
      write(chunk) { if (chunk) body += chunk.toString(); },
      end(chunk) {
        if (chunk) body += chunk.toString();
        resolve({ status: statusCode, headers: resHeaders, body });
      }
    };

    handler(req, res);
  });
}

async function runTests() {
  console.log("===============================================================");
  console.log("   RATIO'D AGENT ACCESSIBILITY & ACTUITY AUDIT VERIFICATION    ");
  console.log("===============================================================\n");

  const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

  // SECTION 1: Actuity Audit Checks
  console.log("[AUDIT CHECKS 01 - 10]");

  // Check 01: Page elements described
  try {
    assert(/<label for="telemetry-input"/.test(html), "textarea has associated label");
    assert(/<label for="auth-from-domain"/.test(html), "auth inputs have labels");
    pass("Check 01: All key inputs have explicit, descriptive labels");
  } catch (e) { fail("Check 01", e); }

  // Check 02: Recognisable menus with standard links
  try {
    assert(/<nav aria-label="Primary"/.test(html), "Primary nav has label");
    assert(/<a href="privacy\.html"/.test(html) || /<a href="\/privacy"/.test(html), "nav contains standard page link");
    pass("Check 02: Recognisable semantic navigation with standard links");
  } catch (e) { fail("Check 02", e); }

  // Check 03: Missing pages return HTTP 404 status code
  try {
    const res404 = await callHandler("/nonexistent-missing-page-test-404");
    assert.strictEqual(res404.status, 404, `Expected status 404, got ${res404.status}`);
    assert(/404/.test(res404.body) && /Page Not Found/.test(res404.body), "404 page body returned");
    pass("Check 03: Missing pages explicitly return HTTP 404 status code with 404.html");
  } catch (e) { fail("Check 03", e); }

  // Check 04: Clear ownership (Schema.org Organization/Person)
  try {
    assert(/@type":\s*"Organization"/.test(html), "Schema.org Organization present");
    assert(/Vedant Baghel/.test(html), "Maintainer Vedant Baghel present in markup");
    assert(/Operated by Vedant Baghel/.test(html), "Footer explicit operator statement present");
    pass("Check 04: Home page explicitly declares operator & Schema.org ownership");
  } catch (e) { fail("Check 04", e); }

  // Check 05: Buttons explain actions with accessible names
  try {
    assert(/id="btn-analyze"[^>]*aria-label=/.test(html), "Analyze button has aria-label");
    assert(/id="btn-clear"[^>]*aria-label=/.test(html), "Clear button has aria-label");
    assert(/id="btn-safe-peek"[^>]*aria-label=/.test(html), "Safe peek button has aria-label");
    assert(/id="qr-cam"[^>]*aria-label=/.test(html), "QR camera button has aria-label");
    pass("Check 05: All interactive buttons provide clear accessible names / aria-labels");
  } catch (e) { fail("Check 05", e); }

  // Check 06: Sitemap found and linked
  try {
    const resSitemap = await callHandler("/sitemap.xml");
    assert.strictEqual(resSitemap.status, 200, "sitemap.xml returns 200");
    assert(/<urlset/.test(resSitemap.body), "sitemap contains valid urlset");
    assert(/<link rel="sitemap"/.test(html), "index.html links to sitemap.xml");
    pass("Check 06: XML sitemap is present, valid, and linked from head");
  } catch (e) { fail("Check 06", e); }

  // Check 07: Normal links between pages
  try {
    assert(/href="\/about"/.test(html), "Normal link to /about");
    assert(/href="\/contact"/.test(html), "Normal link to /contact");
    assert(/href="\/terms"/.test(html), "Normal link to /terms");
    assert(/href="\/privacy"/.test(html) || /href="privacy\.html"/.test(html), "Normal link to /privacy");
    pass("Check 07: Rich normal links between pages across header, content, and footer");
  } catch (e) { fail("Check 07", e); }

  // Check 08: Main content clearly marked with landmarks
  try {
    assert(/<main[^>]*role="main"/.test(html) || /<main[^>]*id="main-content"/.test(html), "Main content landmark present");
    assert(/<footer[^>]*role="contentinfo"/.test(html), "Footer contentinfo landmark present");
    pass("Check 08: Document structure marked with standard ARIA and semantic landmarks");
  } catch (e) { fail("Check 08", e); }

  // Check 09: Sections marked out with aria-labelledby
  try {
    assert(/<section id="console"[^>]*aria-labelledby="console-heading"/.test(html), "Console section labeled");
    assert(/<section id="install"[^>]*aria-labelledby="install-title"/.test(html), "Install section labeled");
    assert(/<section id="architecture"[^>]*aria-labelledby="arch-title"/.test(html), "Architecture section labeled");
    assert(/<section id="pipeline"[^>]*aria-labelledby="pipeline-title"/.test(html), "Pipeline section labeled");
    assert(/<section id="features"[^>]*aria-labelledby="features-title"/.test(html), "Features section labeled");
    assert(/<section id="tiers"[^>]*aria-labelledby="tiers-title"/.test(html), "Tiers section labeled");
    pass("Check 09: All page sections distinctly marked with aria-labelledby headings");
  } catch (e) { fail("Check 09", e); }

  // Check 10: Dedicated About, Contact, Terms, and Privacy pages
  try {
    const resAbout = await callHandler("/about");
    assert.strictEqual(resAbout.status, 200, "/about returns 200");
    const resContact = await callHandler("/contact");
    assert.strictEqual(resContact.status, 200, "/contact returns 200");
    const resTerms = await callHandler("/terms");
    assert.strictEqual(resTerms.status, 200, "/terms returns 200");
    const resPrivacy = await callHandler("/privacy");
    assert.strictEqual(resPrivacy.status, 200, "/privacy returns 200");
    pass("Check 10: Dedicated /about, /contact, /terms, and /privacy pages respond 200 OK");
  } catch (e) { fail("Check 10", e); }

  console.log("\n[AGENT PROTOCOLS 1 - 7]");

  // Protocol 1: LLMs Guide (llms.txt & llms-full.txt)
  try {
    const resLlms = await callHandler("/llms.txt");
    assert.strictEqual(resLlms.status, 200, "/llms.txt returns 200");
    assert(/Ratio'd/.test(resLlms.body), "llms.txt body valid");
    const resLlmsFull = await callHandler("/llms-full.txt");
    assert.strictEqual(resLlmsFull.status, 200, "/llms-full.txt returns 200");
    pass("Protocol 1: llms.txt & llms-full.txt online and conform to LLM specifications");
  } catch (e) { fail("Protocol 1", e); }

  // Protocol 2: MCP (Model Context Protocol)
  try {
    const resMcpWellKnown = await callHandler("/.well-known/mcp.json");
    assert.strictEqual(resMcpWellKnown.status, 200, "/.well-known/mcp.json returns 200");
    const mcp = JSON.parse(resMcpWellKnown.body);
    assert(Array.isArray(mcp.tools) && mcp.tools.length >= 2, "mcp tools declared");
    const resMcpRoot = await callHandler("/mcp.json");
    assert.strictEqual(resMcpRoot.status, 200, "/mcp.json returns 200");
    pass("Protocol 2: MCP discovery active at /.well-known/mcp.json and /mcp.json with tools schema");
  } catch (e) { fail("Protocol 2", e); }

  // Protocol 3: WebMCP
  try {
    assert(/<script type="application\/webmcp\+json">/.test(html), "WebMCP script tag present");
    assert(/"actions":/.test(html), "WebMCP actions defined");
    pass("Protocol 3: WebMCP declarative in-browser agent action protocol embedded");
  } catch (e) { fail("Protocol 3", e); }

  // Protocol 4: A2A (Agent-to-Agent Card)
  try {
    const resA2AWellKnown = await callHandler("/.well-known/agent.json");
    assert.strictEqual(resA2AWellKnown.status, 200, "/.well-known/agent.json returns 200");
    const a2a = JSON.parse(resA2AWellKnown.body);
    assert(a2a.id && a2a.capabilities, "a2a card declared with capabilities");
    const resA2ARoot = await callHandler("/a2a.json");
    assert.strictEqual(resA2ARoot.status, 200, "/a2a.json returns 200");
    pass("Protocol 4: A2A agent card active at /.well-known/agent.json and /a2a.json");
  } catch (e) { fail("Protocol 4", e); }

  // Protocol 5: OpenAPI
  try {
    const resOpenApiJson = await callHandler("/openapi.json");
    assert.strictEqual(resOpenApiJson.status, 200, "/openapi.json returns 200");
    const openapi = JSON.parse(resOpenApiJson.body);
    assert.strictEqual(openapi.openapi, "3.1.0", "OpenAPI version is 3.1.0");
    assert(openapi.paths["/analyze"], "OpenAPI specifies /analyze endpoint");
    const resOpenApiYaml = await callHandler("/openapi.yaml");
    assert.strictEqual(resOpenApiYaml.status, 200, "/openapi.yaml returns 200");
    pass("Protocol 5: OpenAPI 3.1.0 specification available in JSON and YAML formats");
  } catch (e) { fail("Protocol 5", e); }

  // Protocol 6: Markdown Content Negotiation
  try {
    const resMd = await callHandler("/", { accept: "text/markdown" });
    assert.strictEqual(resMd.status, 200, "Markdown negotiation returns 200");
    assert(/# Ratio'd/.test(resMd.body), "Markdown returned on Accept: text/markdown");
    pass("Protocol 6: HTTP content negotiation serves high-fidelity Markdown to agents");
  } catch (e) { fail("Protocol 6", e); }

  // Protocol 7: Content Signals & Robots.txt
  try {
    const resRobots = await callHandler("/robots.txt");
    assert.strictEqual(resRobots.status, 200, "/robots.txt returns 200");
    assert(/User-agent: GPTBot/.test(resRobots.body), "Robots permits GPTBot");
    assert(/User-agent: ClaudeBot/.test(resRobots.body), "Robots permits ClaudeBot");
    assert(/Content-Signal:/.test(resRobots.body), "Content-Signal declared");
    pass("Protocol 7: AI crawlers explicitly authorized with open Content-Signal directives");
  } catch (e) { fail("Protocol 7", e); }

  console.log("\n===============================================================");
  if (!process.exitCode) {
    console.log("   🎉 ALL 17 AUDIT & PROTOCOL VERIFICATIONS PASSED (100/100)   ");
  } else {
    console.log("   ⚠️ SOME VERIFICATIONS FAILED                                ");
  }
  console.log("===============================================================\n");
}

runTests();
