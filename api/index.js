/**
 * Vercel Serverless Function Entry Point for Ratio'd Security Backend.
 * Shares the exact same analysis pipeline as the local Node server
 * (server/routes/analyze.js) so production and localhost behave identically.
 */
const { handleAnalyze } = require("../server/routes/analyze");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // Path may arrive with or without the /api prefix depending on the rewrite.
  const pathname = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";

  if (req.method === "GET" && (pathname === "/health" || pathname === "/api" || pathname === "/api/index")) {
    return res.status(200).json({
      status: "online",
      system: "Ratio'd Scam Risk Analyzer Engine",
      runtime: "vercel-serverless",
      engine: {
        rules: "deterministic-homoglyph-levenshtein",
        model: "laya_stub_heuristic",
        explain: "grounded-in-flags"
      },
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "POST" && (pathname === "/analyze" || pathname === "/api/analyze" || pathname === "/api")) {
    try {
      const payload = typeof req.body === "object" && req.body !== null
        ? req.body
        : JSON.parse(req.body || "{}");
      const responseData = await handleAnalyze(payload);
      return res.status(200).json(responseData);
    } catch (err) {
      console.error("[VERCEL API ERROR]", err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "Endpoint not found" });
};
