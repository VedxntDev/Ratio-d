const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OUT_FILE = path.join(ROOT, "server", "static-cache.js");

const FILES_TO_CACHE = [
  "index.html",
  "privacy.html",
  "styles.css",
  "favicon.ico",
  "ratiod-extension.zip",
  "ratiod-full-project.zip",
  "js/api.js",
  "js/app.js",
  "js/architecture.js",
  "js/fallback-engine.js",
  "js/install.js",
  "js/mascot-eyes.js",
  "js/pipeline.js",
  "js/presets.js",
  "js/qr-ui.js",
  "js/qr.js",
  "js/redactor.js",
  "js/shape-waves.js",
  "js/vendor/jsQR.js",
  "assets/apple-touch-icon.png",
  "assets/chrome-webstore-badge.svg",
  "assets/favicon-16x16.png",
  "assets/favicon-32x32.png",
  "assets/favicon.ico",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/logo.svg",
  "assets/mascot.jpg"
];

const cache = {};

for (const rel of FILES_TO_CACHE) {
  const fullPath = path.join(ROOT, rel);
  if (fs.existsSync(fullPath)) {
    const isBinary = /\.(png|jpe?g|ico|zip)$/i.test(rel);
    const content = fs.readFileSync(fullPath);
    cache["/" + rel] = {
      isBinary,
      data: isBinary ? content.toString("base64") : content.toString("utf8")
    };
  }
}

// Map root index as well
if (cache["/index.html"]) {
  cache["/"] = cache["/index.html"];
  cache["/api"] = cache["/index.html"];
}
if (cache["/privacy.html"]) {
  cache["/privacy"] = cache["/privacy.html"];
}

const fileContent = `/**
 * Pre-compiled static assets cache for zero-latency in-memory fallback on Vercel.
 * Generated automatically by tools/build-static-cache.js
 */
const CACHE = ${JSON.stringify(cache)};

function getCachedFile(pathname) {
  const entry = CACHE[pathname];
  if (!entry) return null;
  if (entry.isBinary) {
    return Buffer.from(entry.data, "base64");
  }
  return Buffer.from(entry.data, "utf8");
}

module.exports = {
  getCachedFile,
  hasCachedFile: (pathname) => Boolean(CACHE[pathname])
};
`;

fs.writeFileSync(OUT_FILE, fileContent, "utf8");
console.log("Successfully generated server/static-cache.js with", Object.keys(cache).length, "cached routes.");
