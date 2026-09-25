/**
 * Ratio'd — Universal Server Entrypoint
 *
 * This single module powers BOTH environments, which is what keeps
 * localhost and https://ratio-d.vercel.app behaving identically:
 *
 *   - Run directly (`npm start` / `node server.js`)  -> starts an HTTP server
 *     on port 3000 serving the console AND the analysis API.
 *   - Imported by Vercel's Node runtime               -> exports the
 *     (req, res) handler; Vercel serves static files from the filesystem
 *     first and falls through to this handler for /analyze and /health.
 *
 * The Vercel project is configured with the "node" framework, so a root
 * server.js is the required entrypoint. Previously the API lived in
 * api/index.js and static assets were never published, which is why the
 * deployed site 404'd for every asset.
 */
const http = require("http");
const url = require("url");
const fs = require("fs");
const path = require("path");

const { handleAnalyze } = require("./server/routes/analyze");

const PORT = process.env.PORT || 3000;
const WEB_ROOT = __dirname;

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

/**
 * The repository ROOT is the single source of truth for all frontend assets.
 * There is intentionally only one copy of the console — earlier duplicated
 * copies under web/ and server/web/ caused localhost and production to drift.
 */
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

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Resolve a URL pathname to a publicly servable file inside WEB_ROOT.
 * Rejects traversal attempts and keeps server/ api/ docs/ extension/ private.
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
  if (relative.split("/").includes("..")) return null;

  const resolved = path.resolve(WEB_ROOT, relative);
  if (resolved !== WEB_ROOT && !resolved.startsWith(WEB_ROOT + path.sep)) {
    return null;
  }

  if (!ALLOWED_ENTRIES.has(relative.split("/")[0])) return null;
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

function healthPayload(runtime) {
  return {
    status: "online",
    system: "Ratio'd Scam Risk Analyzer Engine",
    runtime,
    engine: {
      rules: "deterministic-homoglyph-levenshtein",
      model: "laya_stub_heuristic",
      explain: "grounded-in-flags"
    },
    timestamp: new Date().toISOString()
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

/**
 * Core request handler shared by the standalone server and Vercel.
 */
async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    return res.end();
  }

  const parsedUrl = url.parse(req.url || "/", true);
  let pathname = parsedUrl.pathname || "/";
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");

  // 1. Health endpoint
  if (req.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
    return sendJson(res, 200, healthPayload(process.env.VERCEL ? "vercel-node" : "node-http-server"));
  }

  // 2. Threat analysis endpoint
  if (req.method === "POST" && (pathname === "/analyze" || pathname === "/api/analyze" || pathname === "/api")) {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", async () => {
      try {
        const payload = JSON.parse(body || "{}");
        return sendJson(res, 200, await handleAnalyze(payload));
      } catch (err) {
        console.error("[RATIO'D] Analysis pipeline error:", err.message);
        return sendJson(res, 400, { error: err.message });
      }
    });
    return;
  }

  // 3. Static assets
  if (req.method === "GET" || req.method === "HEAD") {
    if (pathname === "/") pathname = "/index.html";
    if (pathname === "/privacy") pathname = "/privacy.html";

    // The console is a single page driven by hash anchors. Only fall back to
    // index.html for genuine top-level routes; never for dotfiles or paths
    // that look like files, so /.git/config cannot be masked as a 200.
    const segments = pathname.split("/").filter(Boolean);
    const isTopLevelRoute =
      segments.length === 1 && !segments[0].startsWith(".") && !segments[0].includes(".");
    if (!path.extname(pathname) && isTopLevelRoute) pathname = "/index.html";

    const file = resolveWebFile(pathname);
    if (file) {
      const headers = { "Content-Type": contentTypeFor(file) };

      if (path.extname(file).toLowerCase() === ".zip") {
        headers["Content-Disposition"] = `attachment; filename="${path.basename(file)}"`;
      } else if (/\.(png|jpe?g|svg|webp|ico)$/i.test(file)) {
        headers["Cache-Control"] = "public, max-age=3600";
      }

      const data = fs.readFileSync(file);
      headers["Content-Length"] = data.length;
      res.writeHead(200, headers);
      if (req.method === "HEAD") return res.end();
      return res.end(data);
    }
  }

  return sendJson(res, 404, { error: "Endpoint not found" });
}

// When executed directly, start a real HTTP server.
if (require.main === module) {
  http.createServer((req, res) => {
    handler(req, res).catch((err) => {
      console.error("[RATIO'D] Unhandled error:", err);
      if (!res.headersSent) sendJson(res, 500, { error: "Internal server error" });
      else res.end();
    });
  }).listen(PORT, () => {
    console.log(`[RATIO'D ENGINE] listening on http://localhost:${PORT}`);
    console.log(`[RATIO'D ENGINE] serving web console + API from ${WEB_ROOT}`);
  });
} else {
  // Imported by the Vercel Node runtime.
  module.exports = handler;
  module.exports.handleAnalyze = handleAnalyze;
}
