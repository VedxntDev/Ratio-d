/**
 * MascotEyes — a dependency-free port of the Framer <Eye Follow Button />
 * component, restyled as the Ratio'd mascot.
 * ---------------------------------------------------------------------------
 * The original (framer.com/m/Eye-Follow-Button) is a Framer + framer-motion
 * component: <FollowEyes> tracks the cursor with a spring and renders a row of
 * cartoon eyes, and the button wraps it with a label.
 *
 * Why a port instead of the real component:
 *   - it ships as a compiled Framer module importing "framer", "framer-motion"
 *     and "react/jsx-runtime" from framerusercontent.com. This site is static
 *     files with no build step and no node_modules, so none of those resolve.
 *     The hero background (js/shape-waves.js) is a port for the same reason.
 *   - loading it would also mean a third-party script on a page whose entire
 *     pitch is "zero data stored, everything local".
 *
 * What was kept, because it is the actual feel of the thing:
 *   - per-eye tracking: each eye aims at the cursor from its OWN origin, not
 *     from the shared centre, which is what gives the pair its parallax.
 *   - the clamp: maxDistance = (eyeSize - pupilSize) / 2 * (range / 100).
 *     The pupil can never slide out of the sclera, however far the cursor is.
 *   - spring motion at stiffness = speed, damping = 20 (framer-motion's
 *     numbers), integrated below rather than faked with a CSS transition, so
 *     the overshoot on a fast flick matches.
 *   - blinking: scaleY on the eyeball down to 0.3 for 200ms on a timer.
 *
 * Degrades to a static, correctly-drawn mascot with JS off, with reduced
 * motion on, or on a touch device that has no cursor to follow.
 */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var root = document.querySelector("[data-mascot-eyes]");
  if (!root) return;

  // -- Tunables, mirroring the original's property controls -----------------
  var CFG = {
    eyeSize: 26,      // eyeball diameter, in viewBox units
    pupilSize: 11,    // pupil diameter, in viewBox units
    // Edge-to-edge gap between the eyes, exactly like the original's
    // eyeSpacing (its container width is `eyeSize * 2 + eyeSpacing`).
    eyeGap: 9,
    speed: 150,       // spring stiffness
    range: 88,        // % of the free space the pupil may use
    blinking: true,
    blinkInterval: 3400,
    blinkDuration: 200,
  };

  // Centre-to-centre distance between the two eyes. Treating the gap as the
  // offset instead of adding half a diameter to it makes the sclerae overlap
  // into a single blob, so this is derived rather than eyeballed.
  var eyeOffset = CFG.eyeSize / 2 + CFG.eyeGap / 2;

  // The clamp is the original's formula, verbatim: maxDistance is the radius
  // of the circle the pupil centre may travel on, so the pupil edge grazes the
  // sclera edge and never escapes it.
  var maxDistance = (CFG.eyeSize - CFG.pupilSize) / 2 * (CFG.range / 100);

  var DAMPING = 20;   // framer-motion's damping value in the original
  var svg = null;
  var eyes = [];

  // Small SVG element factory: keeps buildFace() declarative instead of a
  // wall of createElementNS/setAttribute pairs.
  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // The face is mounted INSIDE the button's `.mascot-fab-face` slot, which is
  // the fixed 56px circle the stylesheet sizes. Appending to the button itself
  // would let the SVG fall into the flex row and stretch the pill.
  var mount = root.querySelector(".mascot-fab-face") || root;

  // -- The face -------------------------------------------------------------
  // The Ratio'd shield from the brand art: red body, ink outline, angry brows,
  // a smirk and the magnifying glass. Only the two eyes animate; everything
  // else is static SVG, so the character still reads as the mascot even if
  // the tracking never runs.
  function buildFace() {
    svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 120 120");
    // Without explicit width/height an inline SVG falls back to its default
    // 300x150 and ignores the viewBox aspect, so the face renders letterboxed.
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "mascot-face");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    // Shield body (static).
    svg.appendChild(el("path", {
      class: "mascot-shield",
      d: "M60 6 L106 24 V58 c0 26 -20 44 -46 56 C34 102 14 84 14 58 V24 Z",
    }));
    // A darker facet down the right half, for the same depth as the brand mark.
    svg.appendChild(el("path", {
      class: "mascot-shield-shade",
      d: "M60 6 L106 24 V58 c0 26 -20 44 -46 56 Z",
    }));

    // Angry brows: the character's defining expression (static). Angled so the
    // inner ends sit lower than the outer ones - the scowl in the brand art.
    svg.appendChild(el("path", { class: "mascot-brow", d: "M30 33 L54 40" }));
    svg.appendChild(el("path", { class: "mascot-brow", d: "M90 33 L66 40" }));

    eyes = [];
    [-eyeOffset, eyeOffset].forEach(function (offsetX) {
      var cx = 60 + offsetX;
      // Two nested groups on purpose. The OUTER group owns the blink
      // (style.transform), the INNER owns the pupil offset. A CSS transform
      // would otherwise replace the inner group's transform attribute outright
      // and drop the eye back at the origin every time it blinked.
      var blink = el("g", { class: "mascot-eye" });
      var placed = el("g", { class: "mascot-eye-placed" });
      placed.setAttribute("transform", "translate(" + cx + " 52)");
      // Sclera: a fixed white disc with an ink ring.
      placed.appendChild(el("circle", { class: "mascot-sclera", r: CFG.eyeSize / 2 }));
      // Pupil + catchlight: the only parts that move.
      var pupil = el("circle", { class: "mascot-pupil", r: CFG.pupilSize / 2 });
      placed.appendChild(pupil);
      var glint = el("circle", { class: "mascot-glint", r: CFG.pupilSize / 4.5 });
      glint.setAttribute("cx", -1.6);
      glint.setAttribute("cy", -1.8);
      placed.appendChild(glint);
      blink.appendChild(placed);
      svg.appendChild(blink);

      eyes.push({
        g: blink,
        pupil: pupil,
        glint: glint,
        // Eye centre in viewBox units: this eye's own tracking origin.
        cx: cx,
        cy: 52,
        // Spring state.
        x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      });
    });

    // Magnifying glass, tucked over the shield's lower right (static).
    svg.appendChild(el("circle", { class: "mascot-glass", cx: 86, cy: 94, r: 15 }));
    svg.appendChild(el("circle", { class: "mascot-lens", cx: 86, cy: 94, r: 10 }));
    svg.appendChild(el("path", { class: "mascot-handle", d: "M96 104 L108 116" }));

    // Smirk (static).
    svg.appendChild(el("path", { class: "mascot-smirk", d: "M47 84 q11 9 22 -3" }));

    mount.insertBefore(svg, mount.firstChild);
  }



  // -- Motion + pointer capability guards -----------------------------------
  function mediaMatches(query, fallback) {
    try {
      return !!(window.matchMedia && window.matchMedia(query).matches);
    } catch (e) {
      return fallback;
    }
  }

  // Reduced motion means the spring animation is precisely what the user asked
  // us not to do, and a touch device has no cursor to follow. In both cases
  // the mascot is still drawn — it just never moves.
  if (mediaMatches("(prefers-reduced-motion: reduce)", false) ||
      !mediaMatches("(hover: hover)", true)) {
    buildFace();
    root.setAttribute("data-mascot-state", "static");
    return;
  }

  buildFace();
  root.setAttribute("data-mascot-state", "live");

  // -- Geometry -------------------------------------------------------------
  /**
   * The original's per-eye tracking function: the vector from THIS eye's
   * centre to the pointer, held on a circle of radius maxDistance. Everything
   * is in viewBox units, so the result scales with the mascot at any size.
   * Exposed on root.mascotEyes so the suite can assert the clamp without a
   * real cursor.
   */
  function aim(eye, pointerX, pointerY) {
    var dx = pointerX - eye.cx;
    var dy = pointerY - eye.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: 0, y: 0 };
    var d = Math.min(dist, maxDistance);
    var angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * d, y: Math.sin(angle) * d };
  }

  // -- Spring ---------------------------------------------------------------
  // framer-motion's spring (stiffness = CFG.speed, damping = 20, mass 1),
  // integrated semi-implicitly at a fixed 120Hz sub-step so the feel does not
  // change with the display's refresh rate.
  function step(eye, dt) {
    var steps = Math.max(1, Math.ceil(dt * 120));
    var h = dt / steps;
    for (var i = 0; i < steps; i++) {
      eye.vx += (-CFG.speed * (eye.x - eye.tx) - DAMPING * eye.vx) * h;
      eye.vy += (-CFG.speed * (eye.y - eye.ty) - DAMPING * eye.vy) * h;
      eye.x += eye.vx * h;
      eye.y += eye.vy * h;
    }
  }

  function settled(eye) {
    return Math.abs(eye.x - eye.tx) < 0.01 &&
           Math.abs(eye.y - eye.ty) < 0.01 &&
           Math.abs(eye.vx) < 0.01 &&
           Math.abs(eye.vy) < 0.01;
  }

  function paint(eye) {
    var t = "translate(" + eye.x.toFixed(3) + " " + eye.y.toFixed(3) + ")";
    eye.pupil.setAttribute("transform", t);
    eye.glint.setAttribute("transform", t);
  }

  var last = 0;
  var rafId = 0;

  function frame(now) {
    rafId = 0;
    var dt = last ? Math.min((now - last) / 1000, 0.064) : 1 / 60;
    last = now;

    var moving = false;
    for (var i = 0; i < eyes.length; i++) {
      step(eyes[i], dt);
      paint(eyes[i]);
      if (!settled(eyes[i])) moving = true;
    }

    // Park the loop once every eye has settled. A rAF that spins forever on a
    // page where nothing is moving is a real battery cost, and these do settle.
    if (moving) rafId = requestAnimationFrame(frame);
    else last = 0;
  }

  // Restart the loop only when it is parked, so a burst of mousemove events
  // cannot stack up duplicate rAF callbacks.
  function wake() {
    if (!rafId) rafId = requestAnimationFrame(frame);
  }

  // -- Tracking -------------------------------------------------------------
  // Client pixels are mapped into the SVG's own 0-120 space so aim() stays in
  // viewBox units no matter how the mascot is sized on screen.
  function onMove(e) {
    var rect = svg.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    var px = ((e.clientX - rect.left) / rect.width) * 120;
    var py = ((e.clientY - rect.top) / rect.height) * 120;
    for (var i = 0; i < eyes.length; i++) {
      var target = aim(eyes[i], px, py);
      eyes[i].tx = target.x;
      eyes[i].ty = target.y;
    }
    wake();
  }

  window.addEventListener("mousemove", onMove, { passive: true });

  // A unit test cannot drive a real cursor, so the entry point the pointer
  // uses is exposed for the suite (and is harmless in production).
  root.mascotEyes = {
    aim: aim,
    step: step,
    paint: paint,
    settled: settled,
    eyes: eyes,
    config: CFG,
    maxDistance: maxDistance,
    look: function (clientX, clientY) { onMove({ clientX: clientX, clientY: clientY }); },
  };

  // -- Blink ----------------------------------------------------------------
  if (CFG.blinking) {
    setInterval(function () {
      for (var i = 0; i < eyes.length; i++) {
        var node = eyes[i].g;
        // scaleY on the whole eye group squashes sclera + pupil together,
        // which is the original's blink (it animates the eyeball, not just the
        // pupil) and reads correctly at this size.
        node.style.transform = "scaleY(0.3)";
        (function (n) {
          setTimeout(function () { n.style.transform = "scaleY(1)"; }, CFG.blinkDuration);
        })(node);
      }
    }, CFG.blinkInterval);
  }
})();

