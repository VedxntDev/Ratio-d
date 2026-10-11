const http = require("http");
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const { handleFeedback, FEEDBACK_FILE } = require("./routes/feedback");
const { evaluateRules } = require("./rules/engine");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

// Clean up any test feedback file
try {
  if (fs.existsSync(FEEDBACK_FILE)) {
    fs.unlinkSync(FEEDBACK_FILE);
  }
} catch (e) {}

// Test 1: Direct Handler Invocation with Valid Safe Feedback
(async function runTests() {
  console.log("=== Testing Ratio'd Feedback System ===");

  // 1. Submit valid safe feedback
  await new Promise((resolve) => {
    const mockReq = new (require("stream").Readable)();
    mockReq._read = () => {};
    mockReq.push(JSON.stringify({
      feedback: "safe",
      originalVerdict: "suspicious",
      originalScore: 37,
      sender: "store+86944219456@t.shopifyemail.com",
      subject: "View order",
      flags: ["Claim released only by emailing back a stranger"]
    }));
    mockReq.push(null);

    let statusCode = 0;
    let resData = "";
    const mockRes = {
      writeHead(status, headers) { statusCode = status; },
      end(data) {
        resData = data;
        check("valid safe feedback returns 200", statusCode === 200);
        const parsed = JSON.parse(resData);
        check("feedback response contains success: true", parsed.success === true);
        check("feedback response echoes feedback type", parsed.feedback === "safe");
        check("feedback file exists", fs.existsSync(FEEDBACK_FILE));
        const line = fs.readFileSync(FEEDBACK_FILE, "utf8").trim();
        const record = JSON.parse(line);
        check("persisted record contains correct sender", record.sender === "store+86944219456@t.shopifyemail.com");
        check("persisted record contains correct subject", record.subject === "View order");
        resolve();
      }
    };
    handleFeedback(mockReq, mockRes);
  });

  // 2. Submit valid unsafe feedback
  await new Promise((resolve) => {
    const mockReq = new (require("stream").Readable)();
    mockReq._read = () => {};
    mockReq.push(JSON.stringify({
      feedback: "unsafe",
      originalVerdict: "safe",
      originalScore: 5,
      sender: "attacker@spoofed.com",
      subject: "Click this link"
    }));
    mockReq.push(null);

    let statusCode = 0;
    let resData = "";
    const mockRes = {
      writeHead(status) { statusCode = status; },
      end(data) {
        resData = data;
        check("valid unsafe feedback returns 200", statusCode === 200);
        const parsed = JSON.parse(resData);
        check("feedback response echoes unsafe", parsed.feedback === "unsafe");
        resolve();
      }
    };
    handleFeedback(mockReq, mockRes);
  });

  // 3. Reject invalid feedback type
  await new Promise((resolve) => {
    const mockReq = new (require("stream").Readable)();
    mockReq._read = () => {};
    mockReq.push(JSON.stringify({
      feedback: "random_invalid_type"
    }));
    mockReq.push(null);

    let statusCode = 0;
    let resData = "";
    const mockRes = {
      writeHead(status) { statusCode = status; },
      end(data) {
        resData = data;
        check("invalid feedback type returns 400", statusCode === 400);
        const parsed = JSON.parse(resData);
        check("response includes error explanation", !!parsed.error);
        resolve();
      }
    };
    handleFeedback(mockReq, mockRes);
  });

  // 4. Reject malformed JSON
  await new Promise((resolve) => {
    const mockReq = new (require("stream").Readable)();
    mockReq._read = () => {};
    mockReq.push("{ malformed json");
    mockReq.push(null);

    let statusCode = 0;
    const mockRes = {
      writeHead(status) { statusCode = status; },
      end(data) {
        check("malformed json returns 400", statusCode === 400);
        resolve();
      }
    };
    handleFeedback(mockReq, mockRes);
  });

  // 5. Test Shopify / Uff Co Order Confirmation False Positive Fix
  const uffEmail = [
    "From: Uff Co <store+86944219456@t.shopifyemail.com>",
    "Subject: View order",
    "",
    "Thank you for your order!",
    "Order #86944219456",
    "Your order is confirmed. If you have any questions, reply to this email or visit our store.",
    "View your order: https://uffco.com/order/86944219456"
  ].join("\n");

  const evaluated = evaluateRules(uffEmail, "email");
  check("Shopify order confirmation produces score <= 12", evaluated.ruleScore <= 12, "Score: " + evaluated.ruleScore);
  check("Shopify order confirmation produces zero phishing flags", evaluated.flags.length === 0, "Flags: " + JSON.stringify(evaluated.flags));

  // 6. Test genuine advance fee reply pattern triggers
  const scamEmail = [
    "From: stranger@unknown.com",
    "Subject: Urgent action",
    "",
    "Please reply back to this email with your full name to proceed."
  ].join("\n");

  const scamEval = evaluateRules(scamEmail, "email");
  check("Genuine advance fee with reply demand triggers threat flag", scamEval.flags.some(f => f.reason.includes("Claim released only by emailing back a stranger")), "Flags: " + scamEval.flags.map(f => f.reason).join("; "));
  check("Genuine advance fee scores non-zero", scamEval.ruleScore >= 20, "Score: " + scamEval.ruleScore);

  console.log(failures === 0 ? "\nALL FEEDBACK TESTS PASSED" : `\n${failures} FEEDBACK TEST(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
})();
