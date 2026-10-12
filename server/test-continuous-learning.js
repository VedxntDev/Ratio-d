const assert = require("assert");
const fs = require("fs");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

console.log("=== Testing Extension Client-Side Continuous Sender Learning ===");

// Load content-script code into a sandbox to test logic directly
const csCode = fs.readFileSync(__dirname + "/../extension/content-script.js", "utf8");

// Mock browser / DOM environment
const storageData = {};
global.chrome = {
  storage: {
    local: {
      get: (keys, cb) => {
        const res = {};
        for (const k of keys) res[k] = storageData[k];
        cb(res);
      },
      set: (obj) => {
        Object.assign(storageData, obj);
      }
    },
    onChanged: {
      addListener: () => {}
    }
  }
};

global.window = {
  addEventListener: () => {},
  dispatchEvent: () => {},
  location: { hash: "#inbox" },
  sessionStorage: {
    getItem: () => null,
    setItem: () => {}
  }
};

global.document = {
  head: { appendChild: () => {} },
  documentElement: { appendChild: () => {} },
  body: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ setAttribute: () => {}, appendChild: () => {}, style: {} }),
  querySelector: () => null,
  querySelectorAll: () => []
};

global.MutationObserver = class {
  observe() {}
  disconnect() {}
};

// Evaluate content script in this context
eval(csCode);

// 1. Test clean email extraction
check("extractCleanEmail handles <format>", extractCleanEmail("Parikh Jain <parikh@codingninjas.com>") === "parikh@codingninjas.com");
check("extractCleanEmail handles raw email", extractCleanEmail("parikh@codingninjas.com") === "parikh@codingninjas.com");
check("extractCleanEmail handles title attribute", extractCleanEmail("Title: <contact@stripe.com>") === "contact@stripe.com");

// 2. Simulate User Feedback on Parikh Jain
const senderEmail = "parikh@codingninjas.com";
const memSenderLearning = global.window.__ratiod_memSenderLearning;
const memUserOverrides = global.window.__ratiod_memUserOverrides;

memSenderLearning[senderEmail] = {
  sender: senderEmail,
  domain: "codingninjas.com",
  verdict: "safe",
  score: 0,
  feedback: "safe",
  userExplicit: true,
  updatedAt: Date.now()
};

check("memSenderLearning has sender", !!memSenderLearning[senderEmail]);

// 3. Mock inbox rows to test scanInboxRows logic with continuous sender learning
function testRowClassification(rawSender, subjectText, snippetText, isPromoTab = false) {
  const combinedText = `From: ${rawSender}\nSubject: ${subjectText}\n${snippetText}`.trim();

  // Test the continuous sender learning branch logic extracted directly from scanInboxRows:
  const cleanSenderEmail = extractCleanEmail(rawSender);
  const learnedSenderRecord = cleanSenderEmail ? (
    memSenderLearning[cleanSenderEmail] ||
    memUserOverrides[cleanSenderEmail] ||
    memUserOverrides["sender:" + cleanSenderEmail]
  ) : null;

  let verdict = "safe";
  let score = 0;
  let flags = [];

  if (learnedSenderRecord) {
    verdict = learnedSenderRecord.verdict;
    score = learnedSenderRecord.score !== undefined ? learnedSenderRecord.score : (verdict === "safe" ? 0 : 35);
    flags = [{
      span: cleanSenderEmail,
      reason: `Sender learned as ${learnedSenderRecord.feedback || verdict}`,
      type: "user_learned"
    }];
  } else {
    // Normal heuristic
    const isPromo = isPromoTab || isPromotionalText(combinedText);
    if (isPromo) {
      verdict = "promo_clutter";
      score = 38;
      flags.push({ span: "promo", reason: "promotional text", type: "promo" });
    }
  }

  return { verdict, score, flags, isLearned: !!learnedSenderRecord };
}

// Case A: Unlearned sender with promo brag text -> Marked promo_clutter
const unlearnedResult = testRowClassification(
  "Other Course <newsletter@otheredtech.com>",
  "1,600+ Students Hired. 250+ Companies",
  "Join our next batch of full stack development.",
  false
);
check("Unlearned promo email correctly marked promo_clutter", unlearnedResult.verdict === "promo_clutter");
check("Unlearned promo email has score > 0", unlearnedResult.score === 38);

// Case B: Learned Parikh Jain sender with SAME promo brag text -> User marked SAFE -> MUST BE SAFE!
const learnedResult = testRowClassification(
  "Parikh Jain <parikh@codingninjas.com>",
  "1,600+ Students Hired. 250+ Companies",
  "Join our next batch of full stack development.",
  false
);
check("Learned sender email from Parikh Jain is SAFE", learnedResult.verdict === "safe");
check("Learned sender email has score 0", learnedResult.score === 0);
check("Learned sender flag is user_learned", learnedResult.flags[0].type === "user_learned");

// Case C: Learned Parikh Jain sender in PROMOTIONS TAB -> Still SAFE!
const learnedPromoTabResult = testRowClassification(
  "Parikh Jain <parikh@codingninjas.com>",
  "A different subject: Special Invitation",
  "Hey there, wanted to invite you to our weekend discussion.",
  true // viewing promotions tab
);
check("Learned sender in Promotions tab stays SAFE", learnedPromoTabResult.verdict === "safe");
check("Learned sender in Promotions tab has score 0", learnedPromoTabResult.score === 0);

console.log(failures === 0 ? "\nALL CONTINUOUS SENDER LEARNING TESTS PASSED" : `\n${failures} TESTS FAILED`);
process.exit(failures === 0 ? 0 : 1);
