/**
 * Ratio'd Test Suite: Quick-Filter Inbox Triage Bar
 * Verifies non-destructive row filtering, badge counter tallying, and filter resets.
 */

const assert = require("assert");

console.log("\n=== TEST SUITE: Quick-Filter Inbox Triage Bar ===");

// 1. Emulate Gmail Inbox Rows
class MockRow {
  constructor(id, verdict) {
    this.id = id;
    this.dataset = { ratiodVerdict: verdict };
    this.style = { display: "" };
  }

  getAttribute(attr) {
    if (attr === "data-ratiod-verdict") return this.dataset.ratiodVerdict;
    return null;
  }
}

const mockRows = [
  new MockRow("row-1", "safe"),
  new MockRow("row-2", "safe"),
  new MockRow("row-3", "safe"),
  new MockRow("row-4", "promo_clutter"),
  new MockRow("row-5", "promo_clutter"),
  new MockRow("row-6", "suspicious"),
  new MockRow("row-7", "high_risk"),
];

// 2. Test Row Tally Counters
function tallyRowVerdicts(rows) {
  let safeCount = 0;
  let promoCount = 0;
  let suspCount = 0;
  let riskCount = 0;

  for (const r of rows) {
    const v = r.getAttribute("data-ratiod-verdict");
    if (v === "safe") safeCount++;
    else if (v === "promo_clutter") promoCount++;
    else if (v === "suspicious") suspCount++;
    else if (v === "high_risk") riskCount++;
  }

  return { safeCount, promoCount, suspCount, riskCount, totalCount: rows.length };
}

const counts = tallyRowVerdicts(mockRows);
assert.strictEqual(counts.totalCount, 7);
assert.strictEqual(counts.safeCount, 3);
assert.strictEqual(counts.promoCount, 2);
assert.strictEqual(counts.suspCount, 1);
assert.strictEqual(counts.riskCount, 1);
console.log("PASS  Inbox row counts correctly tally across all threat tiers (Safe: 3, Promo: 2, Susp: 1, Risk: 1)");

// 3. Test Non-Destructive Filtering Function
function applyTriageFilter(rows, targetFilter) {
  for (const r of rows) {
    const v = r.getAttribute("data-ratiod-verdict");
    if (targetFilter === "all") {
      r.style.display = "";
    } else if (targetFilter === "risk") {
      r.style.display = (v === "high_risk") ? "" : "none";
    } else if (targetFilter === "susp") {
      r.style.display = (v === "suspicious") ? "" : "none";
    } else if (targetFilter === "promo") {
      r.style.display = (v === "promo_clutter") ? "" : "none";
    } else if (targetFilter === "safe") {
      r.style.display = (v === "safe") ? "" : "none";
    }
  }
}

// Filter by RISK
applyTriageFilter(mockRows, "risk");
assert.strictEqual(mockRows.filter(r => r.style.display === "").length, 1);
assert.strictEqual(mockRows.find(r => r.id === "row-7").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-1").style.display, "none");
console.log("PASS  [ 🔴 Risk ] filter isolates high_risk rows non-destructively");

// Filter by PROMO
applyTriageFilter(mockRows, "promo");
assert.strictEqual(mockRows.filter(r => r.style.display === "").length, 2);
assert.strictEqual(mockRows.find(r => r.id === "row-4").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-5").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-7").style.display, "none");
console.log("PASS  [ 🟡 Promo ] filter isolates promotional clutter rows non-destructively");

// Filter by SAFE
applyTriageFilter(mockRows, "safe");
assert.strictEqual(mockRows.filter(r => r.style.display === "").length, 3);
assert.strictEqual(mockRows.find(r => r.id === "row-1").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-2").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-3").style.display, "");
assert.strictEqual(mockRows.find(r => r.id === "row-6").style.display, "none");
console.log("PASS  [ 🟢 Safe ] filter isolates verified clean rows non-destructively");

// Reset to ALL (via All pill click or Escape key)
applyTriageFilter(mockRows, "all");
assert.strictEqual(mockRows.filter(r => r.style.display === "").length, 7);
for (const r of mockRows) {
  assert.strictEqual(r.style.display, "", "Every row must be restored to display ''");
}
console.log("PASS  [ All ] filter / Escape reset restores all rows to active view");

console.log("ALL TRIAGE FILTER TESTS PASSED\n");
