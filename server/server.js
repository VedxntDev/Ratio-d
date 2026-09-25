/**
 * Ratio'd Security Backend Server
 * Express-compatible & zero-dependency HTTP server meeting Part A.3 & A.5 API Contract.
 * Includes universal static asset serving for Vercel Serverless Functions.
 */
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");
const { handleAnalyze } = require("./routes/analyze");

const PORT = process.env.PORT || 3000;

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function resolveFile(relativePath) {
  const candidates = [
    path.join(__dirname, relativePath),
    path.join(__dirname, "..", relativePath),
    path.join(__dirname, "web", relativePath),
    path.join(__dirname, "../web", relativePath)
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. Health Endpoint
  if (req.method === "GET" && pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "online",
      system: "Ratio'd Scam Risk Analyzer Engine",
      framework: "Node.js Express-compatible HTTP Server",
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 2. Threat Analysis Endpoint
  if (req.method === "POST" && (pathname === "/analyze" || pathname === "/api/analyze")) {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        const responseData = await handleAnalyze(payload);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responseData));
      } catch (err) {
        console.error("[SERVER ERROR] Analysis pipeline error:", err.message);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Static File Routes
  if (req.method === "GET") {
    if (pathname === "/" || pathname === "/index.html") {
      const file = resolveFile("index.html") || resolveFile("web/index.html");
      if (file) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(file));
        return;
      }
    }

    if (pathname === "/privacy" || pathname === "/privacy.html") {
      const file = resolveFile("privacy.html") || resolveFile("web/privacy.html");
      if (file) {
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(fs.readFileSync(file));
        return;
      }
    }

    if (pathname === "/styles.css" || pathname.endsWith(".css")) {
      const file = resolveFile("styles.css") || resolveFile("web/styles.css");
      if (file) {
        res.writeHead(200, { "Content-Type": "text/css; charset=utf-8" });
        res.end(fs.readFileSync(file));
        return;
      }
    }

    if (pathname.includes("ratiod-extension.zip")) {
      const file = resolveFile("ratiod-extension.zip") || resolveFile("web/ratiod-extension.zip");
      if (file) {
        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="ratiod-extension.zip"'
        });
        res.end(fs.readFileSync(file));
        return;
      }
    }

    if (pathname.startsWith("/js/")) {
      const relPath = pathname.substring(1);
      const file = resolveFile(relPath) || resolveFile(`web/${relPath}`);
      if (file) {
        res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
        res.end(fs.readFileSync(file));
        return;
      }
    }
  }

  // Fallback 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`[RATIO'D ENGINE] Express-compatible Security Service listening on http://localhost:${PORT}`);
});
