/**
 * Test Suite: Gmail Inbox Row Badging & Exception Immunity
 * Verifies that scanInboxRows executes without any ReferenceErrors,
 * extracts canonical sender emails correctly, and injects pills on all rows.
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

console.log("=== Testing Gmail Inbox Row Badging Execution ===");

const code = fs.readFileSync(path.resolve(__dirname, "../extension/content-script.js"), "utf8");

let pillsCreated = [];
let badgesUpdated = [];

function createMockElement(tagName, text = "", attrs = {}) {
  const el = {
    tagName: tagName.toUpperCase(),
    innerText: text,
    textContent: text,
    className: "",
    style: {},
    attributes: { ...attrs },
    getAttribute(k) { return this.attributes[k] || null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    cloneNode() { return createMockElement(tagName, text, { ...this.attributes }); },
    querySelectorAll(sel) { return []; },
    querySelector(sel) { return null; },
    parentNode: {
      insertBefore(newNode, refNode) {
        pillsCreated.push(newNode);
      }
    },
    prepend(newNode) {
      pillsCreated.push(newNode);
    }
  };
  return el;
}

const screenshotEmails = [
  { sender: "Wellfound", email: "jobs@wellfound.com", subj: "New jobs: AI Engineer at meerixa and 8 more jobs", snip: "Hi Vedant! I have found 9 new jobs" },
  { sender: "neftinfo.itps", email: "neft@sbi.co.in", subj: "NEFT Transaction", snip: "Dear Customer, Thank you for banking with State Bank of India. Your account has been credited" },
  { sender: "Google One", email: "googleone-noreply@google.com", subj: "gemini pointers to achieve your personal goals", snip: "your personal trainer, chef, and inte" },
  { sender: "Wellfound", email: "jobs@wellfound.com", subj: "New jobs: SDE Intern - Backend at CloudSEK and 1 more jobs", snip: "Hi Vedant! I have found" },
  { sender: "cbssbi.cas", email: "cbs@sbi.co.in", subj: "E-account statement for your SBI account(s).", snip: "Dear Mr. VEDANT SINGH BAGHEL, Your statement is attached" },
  { sender: "Google One", email: "googleone-noreply@google.com", subj: "Upcoming changes to your Google AI Plus subscription", snip: "Important updates to your membership" },
  { sender: "Notion Team", email: "team@notion.so", subj: "Notion 3.8: Context for your agents", snip: "Connect your AI tools, use Skills, see what chan" },
  { sender: "FlyRank Internship", email: "interns@flyrank.com", subj: "You have successfully unsubscribed from interns.", snip: "You have successfully unsubscribed from" },
  { sender: "Alen Malkoc", email: "alen@malkoc.org", subj: "Hi :)", snip: "Hi everyone, A full update on what has been happening and what we are working" },
  { sender: "SBI", email: "alerts@sbi.co.in", subj: "Make Your SBI Debit Card, Tap & Pay Ready", snip: "Enable your SBI Debit Card for Online/PoS" },
  { sender: "Bal Bharati School", email: "principal@balbharat.org", subj: "Annual Day Invitation & Schedule", snip: "Dear Parents, We are pleased to invite you" },
  { sender: "Google", email: "no-reply@accounts.google.com", subj: "Security alert for vedantsbaghel.2626@gmail.com", snip: "This is a copy of a security alert sent to vedantsbaghel.2626@gmail.com. vedantsbaghel.26@gmail.com is the recovery email for this account. If you don't recognize this account, remove it." }
];

const mockRows = screenshotEmails.map((item, idx) => {
  const row = createMockElement("TR", "", { id: `row-${idx}`, class: "zA yO" });
  const senderSpan = createMockElement("SPAN", item.sender, { email: item.email, name: item.sender });
  const subjectSpan = createMockElement("SPAN", item.subj, { class: "bog" });
  const snippetSpan = createMockElement("SPAN", item.snip, { class: "y2" });

  row.querySelector = (sel) => {
    if (sel.includes("span[email]") || sel.includes("[email]") || sel.includes(".zF")) return senderSpan;
    if (sel.includes("span.bog") || sel.includes(".bog")) return subjectSpan;
    if (sel.includes(".y2")) return snippetSpan;
    if (sel.includes("td.xY")) return createMockElement("TD");
    return null;
  };
  return row;
});

const sandbox = {
  window: {
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
    RatiodFallback: {
      analyze: (text) => ({ score: 0, verdict: "safe", flags: [] })
    }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  document: {
    head: { appendChild: () => {} },
    documentElement: { appendChild: () => {} },
    body: { appendChild: () => {} },
    getElementById: () => null,
    createElement: (tag) => {
      const el = createMockElement(tag, "", {});
      return el;
    },
    querySelectorAll: (sel) => {
      if (sel === "tr.zA") return mockRows;
      return [];
    },
    querySelector: () => null
  },
  navigator: { userAgent: "Chrome" },
  location: { hash: "#inbox", href: "" },
  chrome: {
    storage: {
      local: {
        get: (k, cb) => {
          cb({
            ratiod_sender_learning: {
              "team@notion.so": {
                sender: "team@notion.so",
                verdict: "safe",
                score: 0,
                feedback: "safe"
              }
            }
          });
        },
        set: () => {}
      },
      onChanged: { addListener: () => {} }
    },
    runtime: {}
  },
  sessionStorage: { getItem: () => null, setItem: () => {} },
  localStorage: { getItem: () => null, setItem: () => {} },
  MutationObserver: class { observe() {} disconnect() {} },
  setTimeout: (cb) => cb(),
  clearTimeout: () => {},
  setInterval: () => {},
  clearInterval: () => {},
  requestAnimationFrame: (cb) => cb(),
  requestIdleCallback: (cb) => cb(),
  fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
  console: console
};
sandbox.window.window = sandbox.window;
sandbox.window.document = sandbox.document;
sandbox.window.chrome = sandbox.chrome;
sandbox.window.sessionStorage = sandbox.sessionStorage;
sandbox.window.location = sandbox.location;
sandbox.globalThis = sandbox.window;

const ctx = vm.createContext(sandbox);
vm.runInContext(code, ctx);

// Execute inbox scanning pass
pillsCreated = [];
vm.runInContext("scanInboxRows(true)", ctx);

console.log(`Pills created: ${pillsCreated.length} / ${mockRows.length}`);
assert.strictEqual(pillsCreated.length, mockRows.length, `Expected ${mockRows.length} badges to be created!`);

// Verify Bal Bharati is marked safe with score 0
const balBharatIndex = screenshotEmails.findIndex(e => e.email === "principal@balbharat.org");
const balBharatPill = pillsCreated[balBharatIndex];
assert.strictEqual(balBharatPill.attributes["data-verdict"], "safe");
assert.strictEqual(balBharatPill.attributes["data-score"], "0");
console.log("PASS  Bal Bharati row verified safe (score 0)");

// Verify Google Security Alert is marked safe with score 0 (Official Brand Sender parity)
const googleAlertIndex = screenshotEmails.findIndex(e => e.email === "no-reply@accounts.google.com");
const googleAlertPill = pillsCreated[googleAlertIndex];
assert.strictEqual(googleAlertPill.attributes["data-verdict"], "safe");
assert.strictEqual(googleAlertPill.attributes["data-score"], "0");
console.log("PASS  Google Security Alert row verified safe (score 0, 100% parity with banner)");

// Verify Notion Team (learned sender) inherited safe verdict
const notionRowIndex = screenshotEmails.findIndex(e => e.email === "team@notion.so");
const notionPill = pillsCreated[notionRowIndex];
assert.strictEqual(notionPill.attributes["data-verdict"], "safe");
assert.strictEqual(notionPill.attributes["data-score"], "0");
console.log("PASS  Learned sender (Notion) inherited safe verdict (score 0)");

// Verify all rows have verdict attribute set
mockRows.forEach((r, idx) => {
  const v = r.getAttribute("data-ratiod-verdict");
  assert(v, `Row ${idx} missing data-ratiod-verdict`);
});
console.log("PASS  All rows received data-ratiod-verdict attribute");

console.log("\nALL INBOX BADGING CHECKS PASSED!");
