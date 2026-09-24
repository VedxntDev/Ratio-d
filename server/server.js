/**
 * Ratio'd Security Backend Server
 * Express-compatible & zero-dependency HTTP server meeting Part A.3 & A.5 API Contract.
 */
const http = require("http");
const url = require("url");
const { handleAnalyze } = require("./routes/analyze");

const PORT = process.env.PORT || 3000;

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

  if (req.method === "POST" && pathname === "/analyze") {
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

  // Fallback 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Endpoint not found" }));
});

server.listen(PORT, () => {
  console.log(`[RATIO'D ENGINE] Express-compatible Security Service listening on http://localhost:${PORT}`);
});
