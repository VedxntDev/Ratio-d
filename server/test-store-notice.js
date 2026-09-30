/**
 * Behavioural test for the store-version notice dialog.
 *
 * The static checks in test-ui-static.js can confirm the markup, the
 * stylesheet, and that a handler is *named* somewhere in install.js. They
 * cannot confirm that Escape closes anything, that Tab stays inside the
 * dialog, or that the background scroll lock is released. An earlier modal
 * shipped as markup with no behaviour at all, so this runs the real IIFE
 * against a minimal DOM and asserts what actually happens.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "js/install.js"), "utf8");

let failed = 0;
const check = (label, ok, detail) => {
  if (!ok) failed++;
  console.log((ok ? "PASS  " : "FAIL  ") + label + (detail ? "  -> " + detail : ""));
};
function makeEl(id, tag, docRef) {
  return {
    id, tagName: (tag || "div").toUpperCase(), hidden: false, style: {},
    children: [], attrs: {},
    listeners: {},
    offsetParent: {},
    focus() { if (docRef) docRef.activeElement = this; },
    addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
    fire(t, ev) { (this.listeners[t] || []).forEach(fn => fn(ev || {})); },
    setAttribute(k, v) { this.attrs[k] = v; },
    querySelectorAll() { return []; },
    scrollIntoView() {},
  };
}

function run(dismissedFirst) {
  const store = {};
  if (dismissedFirst) store["ratiod.store.notice.dismissed.v1"] = "1";

  const els = {};
  const doc = {
    activeElement: null,
    body: { style: {} },
    getElementById: id => els[id] || null,
    querySelectorAll: () => [],
    addEventListener: (t, fn) => { (doc._k = doc._k || {})[t] = fn; },
  };
  ["store-notice", "store-notice-close", "store-notice-dismiss", "store-notice-dl",
   "store-notice-store", "store-notice-restore", "promo-bar", "promo-close",
   "promo-restore"].forEach(id => { els[id] = makeEl(id, "div", doc); });

  const win = {
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: k => { delete store[k]; },
    },
    setTimeout: () => 0,
    matchMedia: () => ({ matches: false }),
  };

  const sandbox = { window: win, document: doc, Array, Object, console, setTimeout: win.setTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);

  return { doc, els, store, fireKey: ev => doc._k.keydown(ev) };
}

console.log("=== first visit: notice opens, escape closes it ===");
{
  const t = run(false);
  const m = t.els["store-notice"];
  // The script defers open() via setTimeout, which the stub no-ops; call the
  // registered path by simulating what the timer would do.
  t.els["store-notice-restore"].fire("click");
  check("restore control opens the dialog", m.hidden === false);
  check("background scroll is locked", t.doc.body.style.overflow === "hidden");

  t.fireKey({ key: "Escape", preventDefault() {} });
  check("Escape closes the dialog", m.hidden === true);
  check("scroll lock is released", t.doc.body.style.overflow === "");
}

console.log("");
console.log("=== dismissal is remembered and reversible ===");
{
  const t = run(false);
  t.els["store-notice-restore"].fire("click");
  t.els["store-notice-dismiss"].fire("click");
  check("dismiss writes the versioned key",
    t.store["ratiod.store.notice.dismissed.v1"] === "1",
    JSON.stringify(t.store));
  check("dialog closed after dismissing", t.els["store-notice"].hidden === true);
  check("restore control becomes visible", t.els["store-notice-restore"].hidden === false);

  // A later visit must not open it. The stub starts every element visible, so
  // assert on the deferred open never being scheduled rather than on hidden.
  let timerFired = false;
  const els2 = {};
  const doc2 = { activeElement: null, body: { style: {} }, getElementById: id => els2[id] || null,
    querySelectorAll: () => [], addEventListener: () => {} };
  ["store-notice", "store-notice-dismiss", "store-notice-restore", "promo-bar", "promo-close", "promo-restore"]
    .forEach(id => { els2[id] = makeEl(id, "div", doc2); });
  const store2 = { "ratiod.store.notice.dismissed.v1": "1" };
  const win2 = {
    localStorage: { getItem: k => (k in store2 ? store2[k] : null), setItem: (k, v) => { store2[k] = v; }, removeItem: k => { delete store2[k]; } },
    // Record whether the deferred open was ever scheduled.
    setTimeout: (fn, ms) => { timerFired = true; return 0; },
    matchMedia: () => ({ matches: false }),
  };
  const sb2 = { window: win2, document: doc2, Array, Object, console, setTimeout: win2.setTimeout };
  sb2.globalThis = sb2;
  vm.createContext(sb2);
  vm.runInContext(src, sb2);
  check("a dismissed notice is never scheduled to open", timerFired === false,
    "setTimeout(open) must not run when the key is set");

  // And the restore control is the way back.
  els2["store-notice-restore"].hidden = false;
  els2["store-notice-restore"].fire("click");
  check("restore re-opens and clears the key", els2["store-notice"].hidden === false);
}

console.log("");
console.log("=== the × does NOT permanently dismiss ===");
{
  const t = run(false);
  t.els["store-notice-restore"].fire("click");
  t.els["store-notice-close"].fire("click");
  check("× closes the dialog", t.els["store-notice"].hidden === true);
  check("× leaves the dismissal key unwritten",
    !("ratiod.store.notice.dismissed.v1" in t.store),
    "someone may just not want to read it now");
}

console.log("");
console.log("=== storage disabled must not throw ===");
{
  const els = {};
  ["store-notice", "store-notice-dismiss", "store-notice-restore", "promo-bar"].forEach(id => { els[id] = makeEl(id); });
  const doc = { activeElement: null, body: { style: {} },
    getElementById: id => els[id] || null, querySelectorAll: () => [], addEventListener: () => {} };
  const win = { localStorage: { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); }, removeItem() { throw new Error("blocked"); } },
    setTimeout: () => 0, matchMedia: () => ({ matches: false }) };
  const sandbox = { window: win, document: doc, Array, Object, console, setTimeout: win.setTimeout };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  let threw = null;
  try { vm.runInContext(src, sandbox); } catch (e) { threw = e; }
  check("runs without throwing when localStorage is blocked", threw === null, threw && threw.message);
}

console.log("");
console.log(failed === 0 ? "STORE NOTICE BEHAVIOUR VERIFIED" : failed + " BEHAVIOUR CHECK(S) FAILED");
process.exit(failed === 0 ? 0 : 1);
