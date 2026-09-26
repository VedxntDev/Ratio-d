#!/usr/bin/env node
/**
 * Behavioural + static tests for js/mascot-eyes.js.
 *
 * The module is a browser IIFE, so it is executed inside a `vm` context with a
 * stubbed DOM. That catches what a source-grep cannot: the tracking maths, the
 * pupil clamp, the spring actually converging, and - the failure that
 * motivated the nested eye groups - a blink transform silently replacing the
 * group's own positioning transform.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "js", "mascot-eyes.js"), "utf8");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ---- minimal DOM stub ----------------------------------------------------
class El {
  constructor(tag) {
    this.tagName = tag;
    this.attrs = {};
    this.children = [];
    this.style = {};
  }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  hasAttribute(k) { return k in this.attrs; }
  appendChild(c) { this.children.push(c); return c; }
  insertBefore(c) { this.children.unshift(c); return c; }
  get firstChild() { return this.children[0] || null; }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const want = sel.replace(/^\./, "");
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if ((c.attrs.class || "").split(/\s+/).includes(want)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  // The face is a 120x120 viewBox rendered into a 120px box.
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120 };
  }
}

/** Boot the module against a stub DOM. */
function boot({ reduceMotion = false, hover = true } = {}) {
  const root = new El("a");
  const timers = { intervals: [], timeouts: [] };
  const raf = [];
  let now = 0;

  const win = {
    _l: {},
    matchMedia(q) {
      if (q.includes("prefers-reduced-motion")) return { matches: reduceMotion };
      if (q.includes("hover")) return { matches: hover };
      return { matches: false };
    },
    addEventListener(type, fn) { (this._l[type] = this._l[type] || []).push(fn); },
    requestAnimationFrame(fn) { raf.push(fn); return raf.length; },
    setInterval(fn, ms) { timers.intervals.push({ fn, ms }); return timers.intervals.length; },
    setTimeout(fn, ms) { timers.timeouts.push({ fn, ms }); return timers.timeouts.length; },
  };

  const doc = {
    querySelector: (sel) => (sel === "[data-mascot-eyes]" ? root : null),
    createElementNS: (_ns, tag) => new El(tag),
  };
  win.document = doc;

  const ctx = vm.createContext({
    window: win, document: doc,
    requestAnimationFrame: win.requestAnimationFrame,
    setInterval: win.setInterval, setTimeout: win.setTimeout,
  });
  vm.runInContext(SRC, ctx, { filename: "mascot-eyes.js" });

  // Drive the rAF loop deterministically instead of waiting on real frames.
  const tick = (frames = 1, dtMs = 16.7) => {
    for (let i = 0; i < frames; i++) {
      const batch = raf.splice(0, raf.length);
      now += dtMs;
      for (const fn of batch) fn(now);
    }
  };
  const move = (x, y) => (win._l.mousemove || []).forEach((f) => f({ clientX: x, clientY: y }));
  // Count how many frames the loop actually ran, to prove it parks.
  const framesRun = () => raf.length;

  return { root, win, tick, timers, move, framesRun };
}


console.log("── static wiring ──");
check("mascot-eyes.js loaded", /js\/mascot-eyes\.js/.test(html));
check("mascot button in markup", /class="mascot-fab"[^>]*data-mascot-eyes/.test(html));
check("mascot button links to the install section", /<a href="#install" class="mascot-fab"/.test(html));
check("mascot button has an accessible name", /mascot-fab-label">[\s\S]{0,80}?Get the extension/.test(html));
check("face slot is decorative", /mascot-fab-face" aria-hidden="true"/.test(html));
check("mascot-fab styled", /\.mascot-fab \{/.test(css));
check("mascot parts styled", [".mascot-shield", ".mascot-sclera", ".mascot-pupil", ".mascot-brow", ".mascot-smirk", ".mascot-glass"].every((s) => css.includes(s)));
check("mascot pinned bottom-LEFT so it clears .dl-fab",
  /\.mascot-fab \{[^}]*position: fixed;[^}]*left: 22px;[^}]*bottom: 22px/.test(css) &&
  !/\.mascot-fab \{[^}]*right: 22px/.test(css));
check("mobile override keeps the mascot on the left",
  /@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*left: 16px/.test(css) &&
  !/@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*right: 16px/.test(css));
check("reduced-motion honoured", /prefers-reduced-motion/.test(SRC));
check("no innerHTML in the mascot module", !/innerHTML/.test(SRC));
// Comments legitimately name the Framer packages; the code must not use them.
// Trailing `//` comments are stripped too, and a `//` preceded by `:` (as in
// the SVG namespace URL) is left alone.
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
check("no react / framer-motion / require in the code",
  !/from\s+["']react/.test(code) && !/\bframer-motion\b/.test(code) &&
  !/\brequire\(/.test(code) && !/framerusercontent/.test(code));
check("no third-party network fetch", !/https?:\/\/(?!www\.w3\.org)/.test(code));

console.log("\n── face construction ──");
{
  const { root } = boot();
  check("state is live", root.getAttribute("data-mascot-state") === "live");
  check("svg uses the 120 viewBox", root.querySelector(".mascot-face").getAttribute("viewBox") === "0 0 120 120");
  check("svg is hidden from assistive tech", root.querySelector(".mascot-face").getAttribute("aria-hidden") === "true");
  check("two eyes built", root.querySelectorAll(".mascot-eye").length === 2);
  check("each eye positions via its own inner group", root.querySelectorAll(".mascot-eye-placed").length === 2);
  const t = root.querySelectorAll(".mascot-eye-placed").map((g) => g.getAttribute("transform"));
  check("eyes are symmetric about the centre",
    t[0] === "translate(42.5 52)" && t[1] === "translate(77.5 52)", t.join(" | "));
  check("two pupils and two catchlights",
    root.querySelectorAll(".mascot-pupil").length === 2 && root.querySelectorAll(".mascot-glint").length === 2);
  check("mascot character parts present",
    [".mascot-shield", ".mascot-shield-shade", ".mascot-brow", ".mascot-smirk", ".mascot-glass", ".mascot-lens", ".mascot-handle"]
      .every((s) => root.querySelector(s)));
  check("the angry brows come in a pair", root.querySelectorAll(".mascot-brow").length === 2);
}

console.log("\n── tracking maths ──");
{
  const { root } = boot();
  const m = root.mascotEyes;
  check("test hook exposed", !!m && typeof m.aim === "function");

  // maxDistance must be the original's formula, verbatim.
  const expected = (m.config.eyeSize - m.config.pupilSize) / 2 * (m.config.range / 100);
  check("maxDistance matches (eyeSize - pupilSize) / 2 * range",
    near(m.maxDistance, expected), String(m.maxDistance));

  const [L, R] = m.eyes;

  // Pointer dead-centre on an eye => that eye does not move.
  const centre = m.aim(L, L.cx, L.cy);
  check("pointer on the eye centre yields no offset", near(centre.x, 0) && near(centre.y, 0));

  // Direction is preserved: right of the eye => +x, below => +y.
  const right = m.aim(L, L.cx + 1000, L.cy);
  const down = m.aim(L, L.cx, L.cy + 1000);
  check("aims right when the pointer is right", near(right.x, m.maxDistance) && near(right.y, 0), JSON.stringify(right));
  check("aims down when the pointer is below", near(down.y, m.maxDistance) && near(down.x, 0), JSON.stringify(down));

  // The clamp: however far away the cursor is, the pupil stays put.
  const far = m.aim(L, 100000, -100000);
  check("pupil is clamped to maxDistance", near(Math.hypot(far.x, far.y), m.maxDistance, 1e-9), `|offset| = ${Math.hypot(far.x, far.y)}`);
  // The pointer is far right and far up, so the pupil must end up right and up.
  check("clamped offset still points at the cursor", far.x > 0 && far.y < 0, JSON.stringify(far));

  // Inside the range the offset is exact - no clamping applied.
  const inside = m.aim(L, L.cx + 3, L.cy + 4);
  check("unclamped offset is exact (3-4-5 vector)", near(Math.hypot(inside.x, inside.y), 5, 1e-9));

  // Per-eye parallax. Each eye aims from its OWN centre, so for one pointer the
  // two pupils must pull in DIFFERENT directions. The probe is offset up and to
  // the left of the left eye by a distance smaller than maxDistance: the left
  // eye then resolves exactly (unclamped) while the right eye has to clamp.
  // A shared-centre implementation would return the same vector twice.
  const probeX = L.cx - m.maxDistance * 0.5;
  const probeY = L.cy - m.maxDistance * 0.5;
  const a = m.aim(L, probeX, probeY);
  const b = m.aim(R, probeX, probeY);
  check("eyes track from their own centres (parallax)", a.x < 0 && b.x < 0 && !near(a.x, b.x, 1e-9),
    `L.x=${a.x.toFixed(3)} R.x=${b.x.toFixed(3)}`);
  check("the near eye is unclamped at the probe point",
    Math.hypot(a.x, a.y) < m.maxDistance, `L=${Math.hypot(a.x, a.y).toFixed(2)} max=${m.maxDistance}`);
  check("the two eyes resolve to different offsets (not a shared centre)",
    Math.abs(Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y)) > 0.5,
    `L=${Math.hypot(a.x, a.y).toFixed(2)} R=${Math.hypot(b.x, b.y).toFixed(2)}`);
  check("both eyes stay clamped when the pointer is far",
    (() => {
      const p = m.aim(R, 100000, -100000);
      return Math.hypot(p.x, p.y) <= m.maxDistance + 1e-9;
    })());
  // A shared-centre implementation would return the SAME vector for both eyes.
  // Aim each eye at the other's centre: only a per-eye origin can produce the
  // mirrored, opposite-signed result asserted above.
  const swapL = m.aim(L, R.cx, R.cy);
  const swapR = m.aim(R, L.cx, L.cy);
  check("each eye aims at the pointer from its own origin (mirrored)",
    swapL.x > 0 && swapR.x < 0 && near(swapL.x, -swapR.x, 1e-9),
    `L->R: ${swapL.x.toFixed(2)}  R->L: ${swapR.x.toFixed(2)}`);
}

console.log("\n── spring ──");
{
  const { root } = boot();
  const m = root.mascotEyes;
  const e = m.eyes[0];
  e.tx = m.maxDistance; e.ty = 0;
  m.step(e, 1 / 60);
  check("spring starts moving toward the target", e.x > 0 && e.vx > 0, `x=${e.x.toFixed(3)}`);
  check("spring does not teleport on the first frame", e.x < m.maxDistance, `x=${e.x.toFixed(3)}`);

  for (let i = 0; i < 600; i++) m.step(e, 1 / 60);
  check("spring converges on the target", near(e.x, m.maxDistance, 0.01), `x=${e.x.toFixed(4)}`);

  // framer-motion's spring (stiffness 150, damping 20) is underdamped, so a
  // fast flick carries slightly PAST the target before settling. A plain CSS
  // ease cannot reproduce that, which is why this is integrated by hand.
  const o = { x: 0, y: 0, vx: 0, vy: 0, tx: m.maxDistance, ty: 0 };
  let peak = 0;
  for (let i = 0; i < 120; i++) { m.step(o, 1 / 240); peak = Math.max(peak, o.x); }
  check("spring overshoots slightly (underdamped, like framer-motion)",
    peak > m.maxDistance && peak < m.maxDistance * 1.35,
    `peak=${peak.toFixed(3)} target=${m.maxDistance.toFixed(3)}`);
  check("no cross-axis drift on a horizontal target", Math.abs(o.y) < 1e-9);
  // A dropped frame must not blow the integrator up.
  check("the spring is stable at a long frame time", (() => {
    const s = { x: 0, y: 0, vx: 0, vy: 0, tx: m.maxDistance, ty: 0 };
    for (let i = 0; i < 400; i++) m.step(s, 0.064);
    return Number.isFinite(s.x) && Math.abs(s.x - m.maxDistance) < 0.05;
  })());
}

console.log("\n── loop behaviour ──");
{
  const { root, tick, move, framesRun } = boot();
  const m = root.mascotEyes;
  move(120, 52);                       // far right => both pupils clamp to the edge
  check("mousemove queues a rAF frame", framesRun() === 1, `${framesRun()} queued`);
  tick(1);
  check("pupil transform is written after a frame", /translate\(/.test(m.eyes[0].pupil.getAttribute("transform")));

  let guard = 0;
  while (guard++ < 3000 && !m.eyes.every((e) => m.settled(e))) tick(1);
  check("eyes settle", m.eyes.every((e) => m.settled(e)), `after ${guard} frames`);
  // A settled spring must stop re-queueing frames, or the tab burns a core
  // forever on a page where the pointer has not moved.
  tick(1);
  check("rAF parks once settled (no idle battery drain)", framesRun() === 0, `${framesRun()} still queued`);

  // Moving again must wake the loop back up.
  move(10, 10);
  check("a new mousemove wakes the loop", framesRun() === 1);
}

console.log("\n── blink ──");
{
  const { root, timers } = boot();
  const m = root.mascotEyes;
  check("blinking enabled by default", m.config.blinking === true);
  check("blink timer registered", timers.intervals.length === 1, `interval=${timers.intervals[0] && timers.intervals[0].ms}ms`);

  const g = m.eyes[0].g;
  const before = timers.timeouts.length;
  check("blink targets the OUTER eye group", g.getAttribute("class") === "mascot-eye");

  timers.intervals[0].fn();
  check("blink squashes the eye", g.style.transform === "scaleY(0.3)", g.style.transform);
  // The regression this nesting exists to prevent: a CSS transform on the same
  // group that carries the positioning attribute would wipe the position out.
  check("blink does not clobber the eye's position transform",
    root.querySelector(".mascot-eye-placed").getAttribute("transform") === "translate(42.5 52)");
  check("one restore timeout queued per eye", timers.timeouts.length - before === 2);

  // The blink closes both eyes, so both restore timers have to be drained -
  // running only the last one would leave the first eye squinted shut.
  for (let i = before; i < timers.timeouts.length; i++) timers.timeouts[i].fn();
  check("eye opens again after the blink duration", g.style.transform === "scaleY(1)", g.style.transform);
  check("both eyes reopened", m.eyes.every((e) => e.g.style.transform === "scaleY(1)"));
  check("position transform survived the full blink cycle",
    root.querySelector(".mascot-eye-placed").getAttribute("transform") === "translate(42.5 52)");
}

console.log("\n── graceful degradation ──");
{
  const reduced = boot({ reduceMotion: true });
  check("reduced motion still draws the mascot", !!reduced.root.querySelector(".mascot-face"));
  check("reduced motion marked static", reduced.root.getAttribute("data-mascot-state") === "static");
  check("reduced motion starts no blink timer", reduced.timers.intervals.length === 0);
  check("reduced motion exposes no tracking hook", !reduced.root.mascotEyes);
  check("reduced motion starts no rAF", reduced.framesRun() === 0);

  const touch = boot({ hover: false });
  check("touch device still draws the mascot", !!touch.root.querySelector(".mascot-face"));
  check("touch device marked static", touch.root.getAttribute("data-mascot-state") === "static");
  check("touch device registers no blink", touch.timers.intervals.length === 0);

  // matchMedia missing entirely (very old browser) must not throw.
  let threw = false;
  try {
    const r = new El("a");
    const d = { querySelector: (s) => (s === "[data-mascot-eyes]" ? r : null), createElementNS: (_n, t) => new El(t) };
    const w = { document: d, addEventListener() {}, setInterval() { return 0; }, setTimeout() { return 0; }, requestAnimationFrame() { return 0; } };
    vm.runInContext(SRC, vm.createContext({
      window: w, document: d, setInterval: w.setInterval,
      setTimeout: w.setTimeout, requestAnimationFrame: w.requestAnimationFrame,
    }), { filename: "mascot-eyes.js" });
  } catch (e) { threw = true; }
  check("survives a missing matchMedia", !threw);
}

console.log(failures === 0 ? "\nALL MASCOT CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
