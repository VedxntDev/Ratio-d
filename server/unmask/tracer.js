/**
 * Safe Peek: Zero-Execution HTTP Redirect Tracer & Link Unmasker
 * 
 * Safely inspects shortened URLs and link redirect chains using HEAD requests.
 * Zero JavaScript execution, zero body downloads, with built-in SSRF protection
 * and recursion limits.
 */
const http = require("http");
const https = require("https");
const { URL } = require("url");
const { evaluateRules } = require("../rules/engine");

const MAX_HOPS = 5;
const TIMEOUT_MS = 3500;

function isPrivateHost(hostname) {
  if (!hostname) return true;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1" || lower.endsWith(".local") || lower.endsWith(".internal")) {
    return true;
  }
  const parts = lower.split(".").map(Number);
  if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true; // AWS metadata / link-local
    if (parts[0] === 127 || parts[0] === 0) return true;
  }
  return false;
}

function fetchHop(targetUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return reject(new Error("Invalid URL format"));
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return reject(new Error("Unsupported protocol: only HTTP and HTTPS are permitted"));
    }

    if (isPrivateHost(parsed.hostname)) {
      return reject(new Error("Forbidden host: access to private/internal networks is blocked"));
    }

    const client = parsed.protocol === "https:" ? https : http;
    const req = client.request(
      parsed,
      {
        method: "HEAD",
        headers: {
          "User-Agent": "RatiodSafePeek/1.0 (Cybersecurity Link Analyzer; +https://ratio-d.vercel.app)",
          "Accept": "*/*"
        },
        timeout: TIMEOUT_MS
      },
      (res) => {
        const status = res.statusCode || 0;
        let location = res.headers.location || null;
        if (location) {
          try {
            // Handle relative redirect locations
            location = new URL(location, targetUrl).toString();
          } catch {
            // Keep raw location if URL parse fails
          }
        }
        res.resume(); // Discard any incoming bytes
        resolve({
          url: targetUrl,
          status,
          redirectsTo: location,
          server: res.headers.server || null,
          contentType: res.headers["content-type"] || null
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error(`Connection timed out after ${TIMEOUT_MS}ms`));
    });

    req.on("error", (err) => {
      reject(err);
    });

    req.end();
  });
}

/**
 * Traces URL redirect chain and evaluates destination threat risk.
 * @param {string} initialUrl
 */
async function traceRedirects(initialUrl) {
  if (!initialUrl || typeof initialUrl !== "string") {
    throw new Error("Missing or invalid target URL");
  }

  let currentUrl = initialUrl.trim();
  const schemeMatch = currentUrl.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      throw new Error(`Unsupported protocol '${scheme}': only HTTP and HTTPS are permitted`);
    }
  } else {
    currentUrl = "https://" + currentUrl;
  }

  const chain = [];
  const visited = new Set();
  let hops = 0;

  while (hops < MAX_HOPS) {
    if (visited.has(currentUrl)) {
      chain.push({
        url: currentUrl,
        status: 508,
        error: "Circular redirect loop detected"
      });
      break;
    }

    visited.add(currentUrl);
    hops++;

    try {
      const hop = await fetchHop(currentUrl);
      chain.push(hop);

      // Check if redirect response (301, 302, 303, 307, 308)
      if (hop.status >= 300 && hop.status < 400 && hop.redirectsTo) {
        currentUrl = hop.redirectsTo;
      } else {
        // Destination reached
        break;
      }
    } catch (err) {
      chain.push({
        url: currentUrl,
        status: 0,
        error: err.message
      });
      break;
    }
  }

  const finalHop = chain[chain.length - 1];
  const finalUrl = finalHop ? (finalHop.redirectsTo || finalHop.url) : initialUrl;

  let finalDomain = "";
  try {
    finalDomain = new URL(finalUrl).hostname;
  } catch {
    finalDomain = finalUrl;
  }

  // Run the final destination through our threat engine
  const analysisContext = `URL Target: ${finalUrl} (Domain: ${finalDomain})`;
  const { ruleScore, flags } = evaluateRules(analysisContext, "email");

  return {
    originalUrl: initialUrl,
    finalUrl,
    finalDomain,
    hops: chain.length,
    isRedirected: chain.length > 1,
    chain,
    risk: {
      score: ruleScore,
      verdict: ruleScore >= 66 ? "high_risk" : ruleScore >= 35 ? "suspicious" : "safe",
      flags
    },
    unmaskedAt: new Date().toISOString()
  };
}

module.exports = {
  traceRedirects,
  isPrivateHost
};
