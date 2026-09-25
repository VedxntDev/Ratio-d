/**
 * Vercel Serverless Function for the Ratio'd analysis API.
 *
 * The console is a static site served from the repository root; this
 * function exposes the SAME handler used by the local server (server.js),
 * so production and localhost can never drift apart in behaviour.
 *
 * Reached via the rewrites in vercel.json:
 *   POST /analyze  and  GET /health
 */
const handler = require("../server.js");

module.exports = handler;