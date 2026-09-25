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

// The repository ROOT is the single source of truth for all frontend assets.
// Historically the frontend was duplicated across web/ and server/web/, which
// caused localhost and the Vercel deployment to drift apart. There is now
// exactly one copy, served from here and by Vercel from the same paths.
const WEB_ROOT = path.join(__dirname, "..");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".zip": "application/zip"
};

// Only these top-level entries may ever be served. Anything else (server/,
// api/, .git, dotfiles) stays private.
const ALLOWED_ENTRIES = new Set([
  "index.html",
  "privacy.html",
  "styles.css",
  "robots.txt",
  "ratiod-extension.zip",
  "ratiod-full-project.zip",
  "js",
  "assets"
]);

/**
 * Resolve a URL pathname to a file inside WEB_ROOT, or null if it is not
 * publicly servable. Rejects traversal attempts and private directories.
 */
function resolveWebFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relative = decoded.replace(/^\/+/, "");
  if (!relative) return null;

  // Normalise and verify containment.
  const resolved = path.resolve(WEB_ROOT, relative);
  if (resolved !== WEB_ROOT && !resolved.startsWith(WEB_ROOT + path.sep)) {
    return null;
  }
  if (relative.split("/").includes("..")) return null;

  // Allowlist check on the first path segment.
  const topLevel = relative.split("/")[0];
  if (!ALLOWED_ENTRIES.has(topLevel)) return null;

  if (!fs.existsSync(resolved)) return null;

  const stat = fs.statSync(resolved);
  if (stat.isDirectory()) {
    const indexFile = path.join(resolved, "index.html");
    return fs.existsSync(indexFile) ? indexFile : null;
  }
  return stat.isFile() ? resolved : null;
}

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  // 1. Health Endpoint
  if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({
      status: "online",
      system: "Ratio'd Scam Risk Analyzer Engine",
      runtime: "node-http-server",
      engine: {
        rules: "deterministic-homoglyph-levenshtein",
        model: "laya_stub_heuristic",
        explain: "grounded-in-flags"
      },
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

  // 3. Static Assets — all served from the repository root (single source of truth)
  if (req.method === "GET" || req.method === "HEAD") {
    // Friendly extensionless routes
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/privacy") pathname = "/privacy.html";
    if (pathname === "/analyze" || pathname === "/api/analyze") pathname = "/index.html";

    const file = resolveWebFile(pathname);
    if (file) {
      const ext = path.extname(file).toLowerCase();
      const headers = { "Content-Type": contentTypeFor(file) };

      // Downloads should save rather than render
      if (ext === ".zip") {
        headers["Content-Disposition"] = `attachment; filename="${path.basename(file)}"`;
      }
      if (/\.(png|jpe?g|svg|webp|ico)$/i.test(file)) {
        headers["Cache-Control"] = "public, max-age=3600";
      }

      res.writeHead(200, headers);
      if (req.method === "HEAD") return res.end();
      return res.end(fs.readFileSync(file));
    }
  }

  // Fallback 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`[RATIO'D ENGINE] Security Service listening on http://localhost:${PORT}`);
  console.log(`[RATIO'D ENGINE] Serving web console from ${WEB_ROOT}`);
});
