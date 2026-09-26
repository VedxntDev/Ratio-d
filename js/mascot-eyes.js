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
 *
 * Two mounts share this one engine:
 *   - the floating button draws the whole character (mode "face");
 *   - the hero card keeps its painted artwork and covers only its two eyes with
 *     a live SVG layer (mode "overlay"), which is why that geometry is measured
 *     in the source image's own pixels rather than invented.
 */
(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var roots = document.querySelectorAll("[data-mascot-eyes]");
  if (!roots.length) return;

  // matchMedia is absent on very old browsers; the capability check further down
  // treats that as "no preference" rather than throwing on a page that still has
  // to render its mascot.

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

  // The hero card's eyes, in assets/mascot.jpg's own 760x760 pixel space. Each
  // entry is one SCLERA - the white of the painted eye - plus the radius of the
  // black pupil sitting on it. These are measured from the artwork (the sclera
  // flood-filled per eye, then its edge ray-cast from the eye centre), not
  // eyeballed: the pupil covers the right of each eye, so the visible white
  // bounding box on its own under-reports rx.
  //
  // `ring` is the width of the painted outline around each sclera (median 10px
  // across both eyes). An SVG stroke is CENTRED on its path, so buildOverlay
  // draws the ellipse at (rx + ring/2): the ink then covers exactly the band
  // sclera -> sclera+ring that the artwork already painted. That is what stops
  // the original ring from peeking out around the live one as a dark fringe,
  // and it leaves the white fill showing only up to the true sclera edge, so
  // the eye does not shrink either.
  //
  // `slop` is a small extra margin, added to the radius AND the stroke together.
  // Because the stroke grows by the same amount the path moves out, the ink's
  // inner edge stays exactly on the sclera - only its outer edge moves - so the
  // white is unaffected. It exists purely to bury the hand-drawn ring, whose
  // width varies by several px around each eye; without it a sliver of the
  // original outline shows through and the eye reads as slightly ringed twice.
  var HERO_RING = 10;
  var HERO_SLOP = 2;
  var HERO_EYES = {
    viewBox: 760,
    eyes: [
      { cx: 308,   cy: 244, rx: 45,   ry: 55.5, pupil: 20 },
      { cx: 446.5, cy: 249, rx: 47,   ry: 50.5, pupil: 21 },
    ],
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

  // One entry per mount on the page. The pointer listener and the rAF loop are
  // shared across all of them, so two mascots still cost one of each.
  var trackers = [];

  // Small SVG element factory: keeps buildFace() declarative instead of a
  // wall of createElementNS/setAttribute pairs.
  function el(name, attrs) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }

  // An eye is centred on (cx, cy) and its pupil may travel up to reachX/reachY
  // along each axis. A round sclera has reachX === reachY, which is exactly the
  // original's single maxDistance; the hero's oval eyes need both, or the pupil
  // would slide out through the flatter side.
  function makeEye(cx, cy, reachX, reachY) {
    return {
      // Fixed centre of this eye, in its own SVG's coordinate space.
      cx: cx, cy: cy, reachX: reachX, reachY: reachY,
      // Live offset from that centre, plus the spring's velocity and the
      // target the spring is chasing.
      x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0,
      g: null, placed: null, pupil: null, glint: null,
    };
  }

  // One <g class="mascot-eye">, built at the origin of its own coordinate
  // space so the caller can position it by any means it likes.
  //
  // Two nested groups on purpose. The OUTER group owns the blink
  // (style.transform), the INNER owns the pupil offset. A CSS transform would
  // otherwise replace the inner group's transform attribute outright and drop
  // the eye back at the origin every time it blinked.
  //
  // `strokeWidth` is the width of the ink outline around the sclera. It is
  // applied via the style property rather than a presentation attribute,
  // because styles.css sets `stroke-width` on .mascot-sclera and a
  // presentation attribute always loses to a stylesheet declaration. The SVG
  // stroke is centred on the path, so a caller that needs the ink to begin
  // exactly at the sclera edge passes the path radius as
  // (sclera + strokeWidth / 2) - see HERO_RING.
  function buildEye(eye, sclera, pupilRadius, strokeWidth) {
    var blink = el("g", { class: "mascot-eye" });
    var placed = el("g", { class: "mascot-eye-placed" });
    placed.setAttribute("transform", "translate(" + eye.cx + " " + eye.cy + ")");
    // Sclera: a fixed white shape with an ink ring. The FAB's is a circle, the
    // hero's an ellipse, because the painted eyes are tall ovals.
    var shape = el("ellipse", sclera);
    if (strokeWidth) shape.style.strokeWidth = strokeWidth;
    placed.appendChild(shape);
    // Pupil + catchlight: the only parts that move. Neither carries a cx/cy
    // that JS rewrites - the loop only ever writes a `transform` onto them, so
    // the glint can never drift out of the pupil it is a highlight of.
    var pupil = el("circle", { class: "mascot-pupil", r: pupilRadius });
    placed.appendChild(pupil);
    var glint = el("circle", { class: "mascot-glint", r: pupilRadius / 4.5 });
    glint.setAttribute("cx", -1.6);
    glint.setAttribute("cy", -1.8);
    placed.appendChild(glint);
    blink.appendChild(placed);

    eye.g = blink; eye.placed = placed; eye.pupil = pupil; eye.glint = glint;
    return blink;
  }

  // -- The hero card's eyes, laid over the painted ones ---------------------
  // Only the eyes are replaced. The shield, magnifier, gloves and boots stay
  // exactly as the artwork drew them; this layer simply covers the two painted
  // eyes with a live copy of the same shapes.
  function buildOverlay(tracker) {
    var v = HERO_EYES.viewBox;
    var svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + v + " " + v);
    // Without explicit width/height an inline SVG falls back to its default
    // 300x150 and ignores the viewBox aspect, so the eyes render letterboxed.
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.setAttribute("class", "mascot-eyes-layer");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    for (var i = 0; i < HERO_EYES.eyes.length; i++) {
      var s = HERO_EYES.eyes[i];
      // The pupil is a circle, so the travel allowance has to come off BOTH
      // semi-axes to keep it inside the oval.
      var eye = makeEye(
        s.cx, s.cy,
        (s.rx - s.pupil) * (CFG.range / 100),
        (s.ry - s.pupil) * (CFG.range / 100)
      );
      // The path radius is offset by half the stroke so the ink covers exactly
      // the band the artwork painted, hiding the original ring (see HERO_RING).
      // The slop widens both together, so it buries the hand-drawn wobble
      // without moving the white edge.
      var half = HERO_RING / 2 + HERO_SLOP;
      svg.appendChild(buildEye(eye,
        { class: "mascot-sclera", rx: s.rx + half, ry: s.ry + half },
        s.pupil, HERO_RING + HERO_SLOP * 2));
      tracker.eyes.push(eye);
    }

    tracker.svg = svg;
    tracker.mount.appendChild(svg);
  }

  // The face is mounted INSIDE the button's `.mascot-fab-face` slot, which is
  // the fixed 56px circle the stylesheet sizes. Appending to the button itself
  // would let the SVG fall into the flex row and stretch the pill.

  // -- The face -------------------------------------------------------------
  // The Ratio'd shield from the brand art: red body, ink outline, angry brows,
  // a smirk and the magnifying glass. Only the two eyes animate; everything
  // else is static SVG, so the character still reads as the mascot even if
  // the tracking never runs.
  function buildFace(tracker) {
    var svg = document.createElementNS(SVG_NS, "svg");
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

    [-eyeOffset, eyeOffset].forEach(function (offsetX) {
      var cx = 60 + offsetX;
      // A round sclera, so reachX === reachY === the original's maxDistance.
      var eye = makeEye(cx, 52, maxDistance, maxDistance);
      svg.appendChild(buildEye(eye, { class: "mascot-sclera", rx: CFG.eyeSize / 2, ry: CFG.eyeSize / 2 }, CFG.pupilSize / 2));
      tracker.eyes.push(eye);
    });

    // Magnifying glass, tucked over the shield's lower right (static).
    svg.appendChild(el("circle", { class: "mascot-glass", cx: 86, cy: 94, r: 15 }));
    svg.appendChild(el("circle", { class: "mascot-lens", cx: 86, cy: 94, r: 10 }));
    svg.appendChild(el("path", { class: "mascot-handle", d: "M96 104 L108 116" }));

    // Smirk (static).
    svg.appendChild(el("path", { class: "mascot-smirk", d: "M47 84 q11 9 22 -3" }));

    tracker.svg = svg;
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
  var staticMode = mediaMatches("(prefers-reduced-motion: reduce)", false) ||
                   !mediaMatches("(hover: hover)", true);

  // -- Mount every mascot on the page ---------------------------------------
  // The button draws the whole character; the hero card overlays just its eyes
  // on top of the artwork. Both then share one pointer listener and one loop.
  for (var r = 0; r < roots.length; r++) {
    (function (root) {
      var mode = root.getAttribute("data-mascot-eyes") || "face";
      var tracker = { root: root, mode: mode, eyes: [], svg: null, mount: null };

      if (mode === "overlay") {
        // The layer is a child of the .mascot-figure wrapper, so it inherits the
        // card's bob animation and can never drift out of sync with the art.
        tracker.mount = root;
        buildOverlay(tracker);
      } else {
        // The face goes INSIDE the `.mascot-fab-face` slot, the fixed 56px
        // circle the stylesheet sizes. Appending it to the button itself would
        // let the SVG fall into the flex row and stretch the pill.
        tracker.mount = root.querySelector(".mascot-fab-face") || root;
        buildFace(tracker);
        tracker.mount.insertBefore(tracker.svg, tracker.mount.firstChild);
      }

      root.setAttribute("data-mascot-state", staticMode ? "static" : "live");
      trackers.push(tracker);
      root.mascotTracker = tracker;
    })(roots[r]);
  }

  if (staticMode) return;

  // -- Geometry -------------------------------------------------------------
  /**
   * The original's per-eye tracking function: the vector from THIS eye's
   * centre to the pointer, held inside the pupil's allowed area. Everything is
   * in viewBox units, so the result scales with the mascot at any size.
   * Exposed on the test hook so the suite can assert the clamp without a
   * real cursor.
   *
   * The clamp is an ELLIPSE, not a circle: reachX/reachY are the pupil's travel
   * on each axis. For the round FAB eyes the two are equal, so this collapses
   * back to the original's constant maxDistance; the hero's oval eyes need the
   * general form or the pupil would escape through the flatter side.
   */
  function aim(eye, pointerX, pointerY) {
    var dx = pointerX - eye.cx;
    var dy = pointerY - eye.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return { x: 0, y: 0 };
    // How far the pupil may travel along this direction: the point where the
    // ray leaves the allowed ellipse, i.e. 1 / |(ux,uy) normalised by radii|.
    var ux = dx / dist, uy = dy / dist;
    var reach = 1 / Math.sqrt(
      (ux * ux) / (eye.reachX * eye.reachX) + (uy * uy) / (eye.reachY * eye.reachY)
    );
    var d = Math.min(dist, reach);
    return { x: ux * d, y: uy * d };
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
    for (var t = 0; t < trackers.length; t++) {
      var eyes = trackers[t].eyes;
      for (var i = 0; i < eyes.length; i++) {
        step(eyes[i], dt);
        paint(eyes[i]);
        if (!settled(eyes[i])) moving = true;
      }
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
  // Client pixels are mapped into each SVG's own 0..size space so aim() stays
  // in viewBox units no matter how the mascot is sized on screen. The FAB's
  // viewBox is 120 wide, the hero overlay's 760 - hence the per-tracker size.
  function aimTrackerAt(tracker, clientX, clientY) {
    var size = tracker.mode === "overlay" ? HERO_EYES.viewBox : 120;
    var rect = tracker.svg.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    var px = ((clientX - rect.left) / rect.width) * size;
    var py = ((clientY - rect.top) / rect.height) * size;
    for (var i = 0; i < tracker.eyes.length; i++) {
      var target = aim(tracker.eyes[i], px, py);
      tracker.eyes[i].tx = target.x;
      tracker.eyes[i].ty = target.y;
    }
  }

  function onMove(e) {
    for (var t = 0; t < trackers.length; t++) {
      aimTrackerAt(trackers[t], e.clientX, e.clientY);
    }
    wake();
  }

  window.addEventListener("mousemove", onMove, { passive: true });

  // A unit test cannot drive a real cursor, so the entry point the pointer
  // uses is exposed for the suite (and is harmless in production).
  for (var k = 0; k < trackers.length; k++) {
    (function (tracker) {
      tracker.root.mascotEyes = {
        aim: aim,
        step: step,
        paint: paint,
        settled: settled,
        eyes: tracker.eyes,
        config: CFG,
        maxDistance: maxDistance,
        look: function (clientX, clientY) {
          aimTrackerAt(tracker, clientX, clientY);
          wake();
        },
      };
    })(trackers[k]);
  }

  // -- Blink ----------------------------------------------------------------
  // Only the button blinks. The hero's eyes are an OVERLAY on a painted face, so
  // squashing them would uncover the original eye underneath. The timer is not
  // even registered when no mount can blink, rather than firing into an empty
  // loop forever.
  var blinkable = false;
  for (var b = 0; b < trackers.length; b++) {
    if (trackers[b].mode !== "overlay") blinkable = true;
  }
  if (CFG.blinking && blinkable) {
    setInterval(function () {
      for (var t = 0; t < trackers.length; t++) {
        // The hero's eyes are an OVERLAY on a painted face, so squashing them
        // would uncover the original eye underneath. Only the button, which
        // draws the whole character itself, can blink.
        if (trackers[t].mode === "overlay") continue;
        var eyes = trackers[t].eyes;
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
      }
    }, CFG.blinkInterval);
  }
})();

