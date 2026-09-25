#!/usr/bin/env node
/**
 * Measures the real contrast of the hero copy over the ShapeWaves background.
 *
 * Why this is a test and not a judgement call: the hero copy sits directly on
 * top of the animated mark layer, so "does the text read?" is a compositing
 * question with an exact answer. This reproduces the browser's blend order and
 * computes the WCAG contrast ratio against the worst case - a fully covered ink
 * mark directly behind a glyph stroke.
 *
 * Blend order (from the stacking context in styles.css / the shader):
 *   paper  ->  mark layer (CSS opacity x shader ink, premultiplied)
 *          ->  paper scrim (per-position alpha)
 *          ->  copy
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const wavesJs = fs.readFileSync(path.join(ROOT, "js", "shape-waves.js"), "utf8");
const css = fs.readFileSync(path.join(ROOT, "styles.css"), "utf8");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

// ── Pull the live values out of the source so this cannot silently drift ────
const num = (src, re) => {
  const m = re.exec(src);
  if (!m) throw new Error("could not find " + re + " in source");
  return parseFloat(m[1]);
};

const ink = num(wavesJs, /^\s*ink:\s*([\d.]+)/m);            // CFG.ink
const layerOpacity = num(css, /\.shape-waves\[data-ready='true'\]\s*\{\s*opacity:\s*([\d.]+)/);
const paper = [0xF6, 0xF1, 0xE7];
const inkMark = [0x12, 0x12, 0x12];

// Scrim = a veil of one colour (paper) whose alpha ramps across the hero.
const scrimRule = (css.match(/\.hero-section::before\s*\{([\s\S]*?)\}/) || [, ""])[1];
if (!/linear-gradient/.test(scrimRule)) throw new Error("hero readability scrim is missing");
const stops = [];
// `var(--color-bg)` is opaque paper; rgba() stops carry their own alpha.
for (const m of scrimRule.matchAll(/(var\(--color-bg\)|rgba?\([^)]*\))\s*(\d+(?:\.\d+)?)%/g)) {
  const at = parseFloat(m[2]) / 100;
  const inner = /rgba?\(([^)]*)\)/.exec(m[1]);
  const parts = inner ? inner[1].split(",").map((s) => parseFloat(s)) : null;
  // 3 components means opaque; a 4th is alpha.
  const a = parts && parts.length === 4 ? parts[3] : 1;
  if (!Number.isFinite(at) || !Number.isFinite(a)) {
    throw new Error("could not parse scrim stop: " + m[0]);
  }
  stops.push({ at, a });
}
stops.sort((x, y) => x.at - y.at);
if (stops.length < 2) throw new Error("could not parse the scrim gradient stops");
// A veil that never dips below 1 would mean the scrim is doing nothing.
if (Math.min(...stops.map((s) => s.a)) >= 1) throw new Error("scrim has no transparency to work with");

/** Paper-veil alpha at horizontal position t (0..1), linear between stops. */
function scrimAlphaAt(t) {
  if (t <= stops[0].at) return stops[0].a;
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].at) {
      const span = stops[i].at - stops[i - 1].at;
      const f = span === 0 ? 0 : (t - stops[i - 1].at) / span;
      return stops[i - 1].a + (stops[i].a - stops[i - 1].a) * f;
    }
  }
  return stops[stops.length - 1].a;
}

const over = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i]);
const lum = ([r, g, b]) => {
  const f = (v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// ── Worst case: a fully covered ink mark sits under the glyph ───────────────
const MUTED_TEXT = [0x4A, 0x47, 0x41];   // --color-text-muted (subtitle)
const HEADLINE = [0x12, 0x12, 0x12];     // --color-ink (h1)

const markMix = ink * layerOpacity;              // effective ink coverage
const overMark = over(inkMark, paper, markMix);   // mark layer over the paper
const overScrim = (t) => over(paper, overMark, scrimAlphaAt(t));

// The subtitle is max-width:560px inside a 1200px container with 24px padding,
// so it spans roughly the left half of the hero. Sample across that whole span
// and keep the worst result, rather than trusting one hand-picked position.
const COPY_SPAN = [0, 0.5];
let worst = { ratio: Infinity, t: 0, bg: null };
for (let i = 0; i <= 100; i++) {
  const t = COPY_SPAN[0] + ((COPY_SPAN[1] - COPY_SPAN[0]) * i) / 100;
  const bg = overScrim(t);
  const ratio = contrast(MUTED_TEXT, bg);
  if (ratio < worst.ratio) worst = { ratio, t, bg };
}

console.log("ShapeWaves hero legibility");
console.log(`  CFG.ink ${ink} x CSS opacity ${layerOpacity} = ${markMix.toFixed(3)} effective ink`);
console.log(`  scrim stops: ` + stops.map((s) => `${(s.at * 100).toFixed(0)}%@${s.a}`).join(" "));
console.log(`  worst-case backdrop rgb(${worst.bg.map(Math.round).join(", ")}) at x=${(worst.t * 100).toFixed(0)}%`);
console.log("");

// WCAG AA is 4.5:1 for body text, 3:1 for large text (the h1 is >=24px bold).
check("subtitle clears WCAG AA (4.5:1) over the mark layer",
  worst.ratio >= 4.5, worst.ratio.toFixed(2) + ":1");
check("headline clears WCAG AA large (3:1) over the mark layer",
  contrast(HEADLINE, worst.bg) >= 3, contrast(HEADLINE, worst.bg).toFixed(2) + ":1");

// Guard the two levers independently so a future tweak cannot quietly undo this.
check("mark layer stays faint", markMix <= 0.35, "effective ink " + markMix.toFixed(3));
check("scrim actually veils the copy column", Math.min(...stops.slice(0, 2).map((s) => s.a)) >= 0.5,
  "first stops " + stops.slice(0, 2).map((s) => s.a).join("/"));

// The scrim has to earn its place: removing it must measurably hurt, otherwise
// it is dead weight that only muddies the artwork.
const noScrim = contrast(MUTED_TEXT, overMark);
check("scrim materially improves on no scrim", noScrim < 4.5 && worst.ratio > noScrim + 1,
  `no scrim ${noScrim.toFixed(2)}:1 -> with scrim ${worst.ratio.toFixed(2)}:1`);

console.log(failures === 0 ? "\nHERO LEGIBILITY TEST PASSED" : `\n${failures} LEGIBILITY FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
