/**
 * Vercel Serverless Function Entry Point for Ratio'd Security Backend
 */
const { handleAnalyze } = require("../server/routes/analyze");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method === "GET" && (req.url === "/api/health" || req.url === "/health")) {
    return res.status(200).json({
      status: "online",
      system: "Ratio'd Scam Risk Analyzer Engine",
      framework: "Vercel Serverless Function Engine",
      timestamp: new Date().toISOString()
    });
  }

  if (req.method === "POST") {
    try {
      const payload = typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
      const responseData = await handleAnalyze(payload);
      return res.status(200).json(responseData);
    } catch (err) {
      console.error("[VERCEL API ERROR]", err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "Endpoint not found" });
};
