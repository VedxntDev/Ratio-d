"use strict";
const { analyzeQr } = require("../rules/qr");
/* Returns {status, json}. Adapt the return shape to whatever routes/analyze.js uses. */
function handleQr(body) {
  const p = body && typeof body.payload === "string" ? body.payload : "";
  if (!p || p.length > 4096) return { status: 400, json: { error: "payload required (1-4096 chars)" } };
  return { status: 200, json: analyzeQr(p) };
}
module.exports = { handleQr };
