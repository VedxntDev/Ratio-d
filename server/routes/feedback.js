const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../data");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.jsonl");

/**
 * Handle user feedback submitted directly from the extension banner or console.
 */
function handleFeedback(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk.toString();
  });

  req.on("end", () => {
    try {
      const payload = JSON.parse(body || "{}");
      const feedbackType = String(payload.feedback || payload.type || "").toLowerCase().trim();

      if (!feedbackType || !["safe", "unsafe", "promo", "phishing", "suspicious"].includes(feedbackType)) {
        res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({
          error: "Invalid feedback type. Expected: 'safe', 'unsafe', 'promo', or 'phishing'."
        }));
      }

      const record = {
        id: "fb-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
        feedback: feedbackType,
        originalVerdict: payload.originalVerdict || null,
        originalScore: payload.originalScore !== undefined ? payload.originalScore : null,
        sender: typeof payload.sender === "string" ? payload.sender.slice(0, 150) : null,
        subject: typeof payload.subject === "string" ? payload.subject.slice(0, 200) : null,
        flags: Array.isArray(payload.flags) ? payload.flags.slice(0, 20) : [],
        note: typeof payload.note === "string" ? payload.note.slice(0, 500) : null,
        timestamp: new Date().toISOString()
      };

      try {
        if (!fs.existsSync(DATA_DIR)) {
          fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        fs.appendFileSync(FEEDBACK_FILE, JSON.stringify(record) + "\n", "utf8");
      } catch (fileErr) {
        console.warn("[RATIO'D FEEDBACK] Could not persist to disk (e.g. read-only serverless environment):", fileErr.message);
      }

      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({
        success: true,
        message: "Thank you! Your feedback has been recorded and will help improve Ratio'd detection.",
        id: record.id,
        feedback: record.feedback
      }));
    } catch (err) {
      console.error("[RATIO'D FEEDBACK] Error parsing feedback payload:", err);
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Invalid JSON payload" }));
    }
  });
}

module.exports = {
  handleFeedback,
  FEEDBACK_FILE
};
