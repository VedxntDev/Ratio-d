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
const installJs = fs.readFileSync(path.join(ROOT, "js", "install.js"), "utf8");

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
  // The face is a 120x120 viewBox rendered into a 120px box; the hero overlay is
  // a 760x760 viewBox over the artwork, so each mount reports its own size.
  getBoundingClientRect() {
    const r = this._rect;
    return r
      ? { left: r.left, top: r.top, width: r.width, height: r.height, right: r.left + r.width, bottom: r.top + r.height }
      : { left: 0, top: 0, width: 120, height: 120, right: 120, bottom: 120 };
  }
}

/**
 * Boot the module against a stub DOM.
 *
 * `roots` is the list of `[data-mascot-eyes]` mounts, so the same harness can
 * drive the floating button on its own or the real page (both mounts at once).
 */
function boot({ reduceMotion = false, hover = true, modes = ["face"] } = {}) {
  const mounts = modes.map((mode) => {
    const el = new El("div");
    el.setAttribute("data-mascot-eyes", mode);
    return el;
  });
  const root = mounts[0];
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
    querySelectorAll: (sel) => (sel === "[data-mascot-eyes]" ? mounts.slice() : []),
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

  return { root, mounts, win, tick, timers, move, framesRun };
}


console.log("── static wiring ──");
check("mascot-eyes.js loaded", /js\/mascot-eyes\.js/.test(html));
check("mascot button in markup", /class="mascot-fab"[^>]*data-mascot-eyes/.test(html));
check("mascot button links to the install section", /<a href="#install" class="mascot-fab"/.test(html));
check("mascot button has an accessible name", /mascot-fab-label">[\s\S]{0,80}?Get the extension/.test(html));
check("face slot is decorative", /mascot-fab-face" aria-hidden="true"/.test(html));
check("mascot-fab styled", /\.mascot-fab \{/.test(css));
check("mascot parts styled", [".mascot-shield", ".mascot-sclera", ".mascot-pupil", ".mascot-brow", ".mascot-smirk", ".mascot-glass"].every((s) => css.includes(s)));
// The mascot is now the site's ONLY floating control, so it owns the
// bottom-right corner outright. Asserting `right` (and not `left`) is what
// stops a second "Get extension" button being re-added to the other corner.
check("mascot pinned bottom-right as the single floating control",
  /\.mascot-fab \{[^}]*position: fixed;[^}]*right: 22px;[^}]*bottom: 22px/.test(css) &&
  !/\.mascot-fab \{[^}]*left: 22px/.test(css));
// Comments still name the old button to explain what replaced it, so the
// removal is asserted against real code - markup, CSS rules and JS lookups -
// rather than against the word appearing anywhere in the files.
check("the old duplicate download fab is gone from markup, CSS and JS",
  !/id="dl-fab"/.test(html) && !/class="[^"]*\bdl-fab\b/.test(html) &&
  !/^\s*\.dl-fab[\s,{]/m.test(css) &&
  !/getElementById\("dl-fab"\)/.test(installJs));
// The narrow-screen override has to move to `right` as well. If it were left
// as `left`, the base `right: 22px` plus a mobile `left: 16px` would stretch
// the button across the whole viewport.
check("mobile override keeps the mascot on the right",
  /@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*right: 16px/.test(css) &&
  !/@media \(max-width: 600px\)[\s\S]*?\.mascot-fab \{[^}]*left: 16px/.test(css));
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

console.log("\n── hero overlay (the hero card's painted eyes) ──");
{
  // The hero artwork is a flat JPEG, so the live eyes are a sibling SVG drawn
  // over it. These checks pin the wiring and the geometry that has to match the
  // artwork, because a silent drift here is invisible in the source and only
  // shows up as a mascot looking slightly cross-eyed.
  check("hero mascot wrapper present", /class="mascot-figure"[^>]*data-mascot-eyes="overlay"/.test(html));
  check("hero artwork still rendered", /<img[^>]*src="assets\/mascot\.jpg"[^>]*class="mascot-img"/.test(html));
  check("overlay layer is styled and positioned",
    /\.mascot-figure \{[^}]*position: relative/.test(css) && /\.mascot-eyes-layer \{[^}]*position: absolute/.test(css));
  // The bob must live on the WRAPPER, not the image: the layer is a sibling of
  // the image, so animating only the image would slide the eyes off the art.
  check("bob animation moved to the wrapper so art and eyes move together",
    /\.mascot-figure \{[^}]*animation: bob/.test(css) &&
    !/\.mascot-img \{[^}]*animation: bob/.test(css));

  const { mounts, timers } = boot({ modes: ["overlay"] });
  const hero = mounts[0];
  // Squashing the overlay's eyes would uncover the painted eye underneath, so
  // the blink is deliberately limited to the button. With an overlay-only page
  // there is nothing to blink and no timer is registered at all.
  check("the hero's eyes do not blink (they overlay painted art)",
    timers.intervals.length === 0, `${timers.intervals.length} intervals`);
  const layer = hero.querySelector(".mascot-eyes-layer");
  check("overlay svg built on the hero mount", !!layer);
  check("overlay uses the artwork's own 760 viewBox", layer && layer.getAttribute("viewBox") === "0 0 760 760");
  check("overlay svg is hidden from assistive tech", layer && layer.getAttribute("aria-hidden") === "true");
  check("overlay draws exactly two eyes", hero.querySelectorAll(".mascot-eye").length === 2);
  check("overlay draws two pupils and two catchlights",
    hero.querySelectorAll(".mascot-pupil").length === 2 && hero.querySelectorAll(".mascot-glint").length === 2);
  // The overlay must NOT redraw the character - only the eyes are covered.
  check("overlay does not redraw the mascot body",
    !hero.querySelector(".mascot-shield") && !hero.querySelector(".mascot-glass") && !hero.querySelector(".mascot-brow"));

  // The painted ring must be fully covered or it shows through as a dark
  // fringe. The stroke is centred on its path, so the path radius has to be
  // the sclera plus HALF the ring for the ink to start exactly at the edge; the
  // slop widens both together, which moves only the OUTER edge.
  const sclera = hero.querySelectorAll(".mascot-sclera");
  const RING = 10, SLOP = 2;
  const stroke = RING + SLOP * 2;
  const offset = RING / 2 + SLOP;
  check("both eyes carry the measured ring width plus slop",
    sclera.length === 2 && sclera.every((e) => String(e.style.strokeWidth) === String(stroke)),
    sclera.map((e) => e.style.strokeWidth).join(" | "));
  const gotRx = sclera.map((e) => +e.getAttribute("rx"));
  const scleraRx = [45, 47];
  check("path radius is offset by half the stroke so the ink starts at the sclera",
    gotRx.every((v, i) => near(v, scleraRx[i] + offset)), gotRx.join(" | "));
  // The invariant that makes the overlay invisible: stroke/2 back off the path
  // must land exactly on the measured sclera, so the white neither shrinks nor
  // grows and the original ring is fully covered.
  check("ink inner edge coincides with the sclera (no fringe, no shrink)",
    gotRx.every((v, i) => near(v - stroke / 2, scleraRx[i])),
    gotRx.map((v) => (v - stroke / 2).toFixed(1)).join(" | "));
  check("the drawn ink reaches past the painted ring",
    gotRx.every((v, i) => v + stroke / 2 > scleraRx[i] + RING),
    gotRx.map((v) => (v + stroke / 2).toFixed(1)).join(" | "));

  const m = hero.mascotEyes;
  check("overlay exposes the tracking hook", !!m && m.eyes.length === 2);
  // Geometry, in the artwork's 760x760 pixel space.
  const [L, R] = m.eyes;
  check("left eye sits at its measured centre", L.cx === 308 && L.cy === 244, `(${L.cx}, ${L.cy})`);
  check("right eye sits at its measured centre", R.cx === 446.5 && R.cy === 249, `(${R.cx}, ${R.cy})`);
  // The painted eyes are tall ovals, so the horizontal reach must be the
  // tighter of the two - a shared circular clamp would push the pupil out
  // through the flat side of the eye.
  check("oval eyes clamp per axis, not on a circle",
    L.reachY > L.reachX && R.reachY > R.reachX,
    `L(${L.reachX.toFixed(1)}, ${L.reachY.toFixed(1)}) R(${R.reachX.toFixed(1)}, ${R.reachY.toFixed(1)})`);

  // The clamp really does contain the pupil: at any angle the offset must stay
  // inside the eye, i.e. ((x/reachX)^2 + (y/reachY)^2) <= 1.
  let worst = 0;
  for (let a = 0; a < 360; a += 5) {
    const p = m.aim(L, L.cx + 100000 * Math.cos(a * Math.PI / 180), L.cy + 100000 * Math.sin(a * Math.PI / 180));
    worst = Math.max(worst, (p.x / L.reachX) ** 2 + (p.y / L.reachY) ** 2);
  }
  check("pupil never escapes the painted eye at any angle", worst <= 1 + 1e-9, `worst=${worst.toFixed(6)}`);

  // Aiming works the same as on the button: dead centre is no movement, and a
  // far pointer clamps to the edge in the right direction.
  check("pointer on the eye centre yields no offset", (() => {
    const c = m.aim(L, L.cx, L.cy);
    return near(c.x, 0) && near(c.y, 0);
  })());
  check("far pointer clamps to the oval edge and points at the cursor", (() => {
    const p = m.aim(L, 1e6, -1e6);
    return p.x > 0 && p.y < 0 && near((p.x / L.reachX) ** 2 + (p.y / L.reachY) ** 2, 1, 1e-9);
  })());
  check("the two hero eyes keep their parallax", (() => {
    const px = L.cx - L.reachX * 0.5, py = L.cy - L.reachY * 0.5;
    const a = m.aim(L, px, py), b = m.aim(R, px, py);
    return a.x < 0 && b.x < 0 && !near(a.x, b.x, 1e-9);
  })());
}

console.log("\n── both mounts on one page ──");
{
  // The real page has the button AND the hero overlay. They must share a single
  // pointer listener and a single rAF loop, and a move must drive both.
  const { mounts, win, tick, framesRun, move, timers } = boot({ modes: ["face", "overlay"] });
  const [btn, hero] = mounts;
  check("both mounts built their own face", !!btn.querySelector(".mascot-face") && !!hero.querySelector(".mascot-eyes-layer"));
  check("both mounts are live", btn.getAttribute("data-mascot-state") === "live" && hero.getAttribute("data-mascot-state") === "live");
  check("only one mousemove listener is registered", (win._l.mousemove || []).length === 1, `${(win._l.mousemove || []).length} listeners`);
  // One shared blink timer, and it must skip the overlay so the painted eye
  // underneath is never uncovered mid-blink.
  check("one shared blink timer covers both mounts", timers.intervals.length === 1, `${timers.intervals.length} timers`);
  timers.intervals[0].fn();
  check("the button's eyes blink", btn.mascotEyes.eyes.every((e) => e.g.style.transform === "scaleY(0.3)"),
    btn.mascotEyes.eyes[0].g.style.transform);
  check("the hero's overlay eyes are NOT squashed",
    hero.mascotEyes.eyes.every((e) => !e.g.style.transform),
    JSON.stringify(hero.mascotEyes.eyes[0].g.style));

  move(400, 300);
  check("one pointer move queues a single shared frame", framesRun() === 1, `${framesRun()} queued`);
  tick(1);
  const be = btn.mascotEyes.eyes[0], he = hero.mascotEyes.eyes[0];
  check("the move drove the button's pupils too", /translate\(/.test(be.pupil.getAttribute("transform")));
  check("the move drove the hero's pupils too", /translate\(/.test(he.pupil.getAttribute("transform")));

  let guard = 0;
  while (guard++ < 4000 && ![...btn.mascotEyes.eyes, ...hero.mascotEyes.eyes].every((e) => btn.mascotEyes.settled(e))) tick(1);
  tick(1);
  check("the shared loop parks once BOTH mascots settle", framesRun() === 0, `${framesRun()} still queued`);
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
    const r = new El("div");
    r.setAttribute("data-mascot-eyes", "face");
    const d = {
      querySelector: (s) => (s === "[data-mascot-eyes]" ? r : null),
      querySelectorAll: (s) => (s === "[data-mascot-eyes]" ? [r] : []),
      createElementNS: (_n, t) => new El(t),
    };
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
