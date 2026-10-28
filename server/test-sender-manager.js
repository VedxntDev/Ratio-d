/**
 * Ratio'd Test Suite: Senders & Whitelist Manager
 * Tests rule CRUD, normalization, storage persistence, and verdict formatting.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

// Mock Chrome Storage
const mockStorage = {
  local: {
    data: {},
    get: function(keys, cb) {
      const res = {};
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const k of keyList) {
        if (this.data[k] !== undefined) res[k] = JSON.parse(JSON.stringify(this.data[k]));
      }
      cb(res);
    },
    set: function(items, cb) {
      for (const [k, v] of Object.entries(items)) {
        this.data[k] = JSON.parse(JSON.stringify(v));
      }
      if (cb) cb();
    }
  }
};

global.chrome = { storage: mockStorage };

const popupModule = require("../extension/popup.js");

console.log("\n=== TEST SUITE: Senders & Whitelist Manager ===");

// 1. Test formatVerdictLabel
assert.deepStrictEqual(popupModule.formatVerdictLabel("safe"), { label: "SAFE", cls: "badge-safe" });
assert.deepStrictEqual(popupModule.formatVerdictLabel("promo_clutter"), { label: "PROMO", cls: "badge-promo" });
assert.deepStrictEqual(popupModule.formatVerdictLabel("suspicious"), { label: "CAUTION", cls: "badge-suspicious" });
assert.deepStrictEqual(popupModule.formatVerdictLabel("high_risk"), { label: "SCAM", cls: "badge-high_risk" });
console.log("PASS  Verdict labels and CSS badge classes format correctly");

// 2. Test Add Sender Rule (Direct Email)
popupModule.addSenderRule("alerts@github.com", "safe");
assert.ok(mockStorage.local.data.ratiod_sender_learning["alerts@github.com"], "Rule must be saved in ratiod_sender_learning");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["alerts@github.com"].verdict, "safe");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["alerts@github.com"].score, 0);
assert.ok(mockStorage.local.data.ratiod_user_overrides["alerts@github.com"], "Override must be saved in ratiod_user_overrides");
console.log("PASS  Direct sender email added and indexed in both storage stores");

// 3. Test Add Domain Whitelist Rule (Auto-prepends @ for domain)
popupModule.addSenderRule("balbharat.org", "safe");
assert.ok(mockStorage.local.data.ratiod_sender_learning["@balbharat.org"], "Domain rule must be normalized with @ prefix");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["@balbharat.org"].domain, "balbharat.org");
console.log("PASS  Domain without @ is automatically normalized to @domain.org");

// 4. Test Add Promotional and Suspicious Rules
popupModule.addSenderRule("deals@store.com", "promo_clutter");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["deals@store.com"].verdict, "promo_clutter");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["deals@store.com"].score, 25);

popupModule.addSenderRule("verify@phish-bank.com", "high_risk");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["verify@phish-bank.com"].verdict, "high_risk");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["verify@phish-bank.com"].score, 88);
console.log("PASS  Multi-category sender classifications (promo, high_risk) stored with accurate scores");

// 5. Test Delete Sender Rule
popupModule.deleteSenderRule("alerts@github.com");
assert.strictEqual(mockStorage.local.data.ratiod_sender_learning["alerts@github.com"], undefined);
assert.strictEqual(mockStorage.local.data.ratiod_user_overrides["alerts@github.com"], undefined);
assert.strictEqual(mockStorage.local.data.ratiod_user_overrides["sender:alerts@github.com"], undefined);
console.log("PASS  Delete rule cleanly removes sender from learning and override stores");

// 6. Test Clear All Rules
popupModule.clearAllSenderRules();
assert.deepStrictEqual(mockStorage.local.data.ratiod_sender_learning, {});
assert.deepStrictEqual(mockStorage.local.data.ratiod_user_overrides, {});
console.log("PASS  Clear all rules wipes continuous learning and override dictionaries");

console.log("ALL SENDER MANAGER TESTS PASSED\n");
