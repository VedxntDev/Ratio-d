/**
 * ShapeWaves — vanilla WebGPU port
 * ─────────────────────────────────────────────────────────────────────────────
 * A dependency-free port of the React Bits <ShapeWaves /> effect.
 *
 * Why a port instead of the npm package:
 *   - vgpu ships raw unbundled ESM and vite/webpack loaders, so the real
 *     component cannot run without adding a bundler and a build step.
 *   - This project is deliberately zero-dependency with no build, served as
 *     static files. Adding React + a 10-package dep tree to animate one
 *     background is not a trade worth making.
 *   - The visual is the same: same WGSL scene/blur/composite shaders, same
 *     ripple simulation, same glow pass. The library's text-cutout mask is
 *     deliberately NOT ported - a lettered hole in the hero background read as
 *     an artefact and competed with the real copy sitting on top of it. The
 *     marks are drawn in the site's own ink + sticker accents instead, with a
 *     transparent void so the page's real paper and halftone show through.
 *
 * Degrades to nothing at all when WebGPU is unavailable (notably Firefox),
 * leaving the hero's flat paper canvas exactly as it is today.
 */

(function () {
  "use strict";

  if (!("gpu" in navigator)) return; // no WebGPU: stay silent, page is unchanged

  const INTRO_BAND = 0.2;
  const INTRO_WARP = 0.3;
  const INTRO_JITTER = 0.16;
  const INTRO_END = 1 + INTRO_WARP + INTRO_JITTER + INTRO_BAND;
  const MAX_DPR = 2;
  const NOISE_CELLS = 32;
  const TIME_RATE = 0.1;
  const SIM_STEP = 1 / 60;
  const WAVE_SPEED = 0.42;
  const WAVE_FRICTION = 0.94;
  const WAVE_DECAY = 0.972;
  const SETTLED = 0.01;

  const NOISE_WGSL = `
fn mod289v3(x: vec3f) -> vec3f { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn mod289v4(x: vec4f) -> vec4f { return x - floor(x * (1.0 / 289.0)) * 289.0; }
fn permute(x: vec4f) -> vec4f { return mod289v4(((x * 34.0) + 10.0) * x); }
fn taylorInvSqrt(r: vec4f) -> vec4f { return 1.79284291400159 - 0.85373472095314 * r; }
fn fadeCurve(t: vec3f) -> vec3f { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }

fn cnoise(P: vec3f) -> f32 {
  var Pi0 = floor(P);
  var Pi1 = Pi0 + vec3f(1.0);
  Pi0 = mod289v3(Pi0);
  Pi1 = mod289v3(Pi1);
  let Pf0 = fract(P);
  let Pf1 = Pf0 - vec3f(1.0);
  let ix = vec4f(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  let iy = vec4f(Pi0.yy, Pi1.yy);
  let iz0 = Pi0.zzzz;
  let iz1 = Pi1.zzzz;

  let ixy = permute(permute(ix) + iy);
  let ixy0 = permute(ixy + iz0);
  let ixy1 = permute(ixy + iz1);

  var gx0 = ixy0 * (1.0 / 7.0);
  var gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  let gz0 = vec4f(0.5) - abs(gx0) - abs(gy0);
  let sz0 = step(gz0, vec4f(0.0));
  gx0 -= sz0 * (step(vec4f(0.0), gx0) - 0.5);
  gy0 -= sz0 * (step(vec4f(0.0), gy0) - 0.5);

  var gx1 = ixy1 * (1.0 / 7.0);
  var gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  let gz1 = vec4f(0.5) - abs(gx1) - abs(gy1);
  let sz1 = step(gz1, vec4f(0.0));
  gx1 -= sz1 * (step(vec4f(0.0), gx1) - 0.5);
  gy1 -= sz1 * (step(vec4f(0.0), gy1) - 0.5);

  var g000 = vec3f(gx0.x, gy0.x, gz0.x);
  var g100 = vec3f(gx0.y, gy0.y, gz0.y);
  var g010 = vec3f(gx0.z, gy0.z, gz0.z);
  var g110 = vec3f(gx0.w, gy0.w, gz0.w);
  var g001 = vec3f(gx1.x, gy1.x, gz1.x);
  var g101 = vec3f(gx1.y, gy1.y, gz1.y);
  var g011 = vec3f(gx1.z, gy1.z, gz1.z);
  var g111 = vec3f(gx1.w, gy1.w, gz1.w);

  let norm0 = taylorInvSqrt(vec4f(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x;
  g010 *= norm0.y;
  g100 *= norm0.z;
  g110 *= norm0.w;
  let norm1 = taylorInvSqrt(vec4f(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x;
  g011 *= norm1.y;
  g101 *= norm1.z;
  g111 *= norm1.w;

  let n000 = dot(g000, Pf0);
  let n100 = dot(g100, vec3f(Pf1.x, Pf0.yz));
  let n010 = dot(g010, vec3f(Pf0.x, Pf1.y, Pf0.z));
  let n110 = dot(g110, vec3f(Pf1.xy, Pf0.z));
  let n001 = dot(g001, vec3f(Pf0.xy, Pf1.z));
  let n101 = dot(g101, vec3f(Pf1.x, Pf0.y, Pf1.z));
  let n011 = dot(g011, vec3f(Pf0.x, Pf1.yz));
  let n111 = dot(g111, Pf1);

  let f = fadeCurve(Pf0);
  let nz = mix(vec4f(n000, n100, n010, n110), vec4f(n001, n101, n011, n111), f.z);
  let ny = mix(nz.xy, nz.zw, f.y);
  return 2.2 * mix(ny.x, ny.y, f.x);
}

fn fbm(p: vec3f) -> f32 {
  var total = 0.0;
  var amplitude = 1.0;
  var weight = 0.0;
  var frequency = 1.0;
  for (var i = 0; i < 2; i++) {
    total += amplitude * cnoise(p * frequency);
    weight += amplitude;
    amplitude *= 0.5;
    frequency *= 2.0;
  }
  return total / weight;
}
`;

  const FULLSCREEN_VS = `
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
}
@vertex fn vs_main(@builtin(vertex_index) vi: u32) -> VSOut {
  var pts = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  let xy = pts[vi];
  var out: VSOut;
  out.pos = vec4f(xy, 0.0, 1.0);
  out.uv = vec2f((xy.x + 1.0) * 0.5, 1.0 - (xy.y + 1.0) * 0.5);
  return out;
}
`;

  const SCENE_FS = NOISE_WGSL + `
struct Params {
  resolution: vec4f,
  placement: vec4f,
  grid: vec4f,
  field: vec4f,
  motion: vec4f,
  color: vec4f,
  hover: vec4f,
  accentA: vec4f,
  accentB: vec4f,
}
@group(0) @binding(0) var<uniform> params: Params;
@group(0) @binding(1) var<storage, read> charges: array<f32>;

const SEED = vec2f(12.9898, 78.233);

fn sdIsoscelesTriangle(point: vec2f, q: vec2f) -> f32 {
  let p = vec2f(abs(point.x), point.y);
  let a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  let b = p - q * vec2f(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  let s = -sign(q.y);
  let d = min(vec2f(dot(a, a), s * (p.x * q.y - p.y * q.x)), vec2f(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

fn shapeDistance(p: vec2f, shape: i32, c: f32) -> f32 {
  if (shape == 0) { return max(abs(p.x), abs(p.y)) - c; }
  if (shape == 1) { return length(p) - c; }
  return sdIsoscelesTriangle(vec2f(p.x, p.y + c), vec2f(c, 2.0 * c));
}

fn hash21(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let resolution = params.resolution.xy;
  let cellPx = params.grid.x;
  let dotSize = params.grid.y;
  let mode = i32(params.grid.z + 0.5);
  let cols = i32(params.grid.w + 0.5);
  let origin = params.placement.xy;
  let rows = i32(params.placement.z + 0.5);

  // The void is fully transparent and nothing is drawn outside the grid, so
  // the page's own paper + dot-grid shows through. The canvas deliberately
  // does NOT paint an opaque backdrop: stacking a second grid on top of this
  // one is what produced the moire interference over the hero copy.
  let pixel = uv * resolution;
  let cell = floor((pixel - origin) / cellPx);
  if (cell.y < 0.0 || i32(cell.y) >= rows || cell.x < 0.0 || i32(cell.x) >= cols) {
    return vec4f(0.0);
  }
  let center = origin + (cell + 0.5) * cellPx;
  let local = (pixel - center) / (cellPx * 0.5);
  let cellUv = center / resolution;

  var level = 1.0;
  let fade = params.motion.w;
  if (fade > 0.0) {
    let q = abs(uv * 2.0 - 1.0);
    let radius = pow(pow(q.x, 2.5) + pow(q.y, 2.5), 1.0 / 2.5) / pow(2.0, 1.0 / 2.5);
    level = 1.0 - smoothstep(max(0.0, 1.0 - fade * 2.2), 1.0, radius);
  }
  let noise = fbm(vec3f((center + params.motion.xy) / params.field.x + SEED, params.field.w));
  let tone = clamp((noise * 0.5 + 0.5 - params.field.y) * params.field.z + 0.5, 0.0, 1.0);
  let band = i32(min(tone, 0.999999) * 3.0);

  var charge = 0.0;
  let index = i32(cell.y) * cols + i32(cell.x);
  if (index >= 0 && index < i32(arrayLength(&charges))) { charge = charges[index]; }
  let stepped = (band + i32(clamp(charge, 0.0, 0.999) * 3.0)) % 3;

  var shape = 2 - stepped;
  var size = dotSize;
  if (mode != 0) {
    shape = mode - 1;
    size = dotSize * mix(0.45, 1.0, f32(stepped) / 2.0);
  }
  let introProgress = params.placement.w;
  var front = 0.0;
  if (introProgress < ` + INTRO_END.toFixed(2) + `) {
    let radial = length((center - resolution * 0.5) / (resolution * 0.5)) * 0.70710678;
    let warp = cnoise(vec3f(cellUv * vec2f(3.2, 2.4) + SEED, 4.7)) * ` + INTRO_WARP.toFixed(2) + `;
    let jitter = hash21(cell) * ` + INTRO_JITTER.toFixed(2) + `;
    let spread = radial + warp + jitter + ` + INTRO_WARP.toFixed(2) + `;
    let bandW = ` + INTRO_BAND.toFixed(2) + ` * (0.6 + 0.8 * hash21(cell + vec2f(17.0, 9.0)));
    let t = clamp((introProgress - spread) / bandW, 0.0, 1.0);
    if (t <= 0.0) {
      return vec4f(0.0);
    }
    let back = t - 1.0;
    size = max(size * (1.0 + 2.70158 * back * back * back + 1.70158 * back * back), 0.02);
    front = 1.0 - smoothstep(0.0, 1.0, abs(introProgress - spread) / bandW);
  }
  let aa = 2.0 / cellPx;
  let coverage = smoothstep(aa, -aa, shapeDistance(local, shape, size));

  // Ink plus the site's two sticker accents, one per noise band, so the field
  // reads as a halftone print in the brand palette instead of a grey smear.
  // band 0 -> ink triangles, 1 -> yellow circles, 2 -> blue squares.
  var base = params.color.rgb;
  if (band == 1) { base = params.accentA.rgb; }
  if (band == 2) { base = params.accentB.rgb; }
  let tint = mix(base, params.hover.rgb, max(smoothstep(0.15, 0.85, charge), front * 0.35));

  // Premultiplied output so the layer composites transparently over the page.
  // params.hover.w is the global ink opacity: this is the main lever that keeps
  // the hero copy readable, since the marks sit directly behind the text.
  let alpha = clamp(coverage * level * params.hover.w, 0.0, 1.0);
  return vec4f(tint * alpha, alpha);
}
`;

  const BLUR_FS = `
struct Blur { direction: vec4f }
@group(0) @binding(0) var<uniform> blur: Blur;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var sourceSampler: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let sigma = blur.direction.z;
  let radius = i32(ceil(3.0 * sigma));
  var sum = vec4f(0.0);
  var weight = 0.0;
  for (var i = -radius; i <= radius; i++) {
    let offset = f32(i);
    let w = exp(-(offset * offset) / (2.0 * sigma * sigma));
    // The source is premultiplied, so blurring all four channels together is
    // correct and keeps the halo's alpha in step with its colour. The previous
    // version returned a hard a = 1 here, which made the glow layer opaque
    // across the whole hero regardless of how faint the marks were.
    sum += textureSampleLevel(sourceTexture, sourceSampler, uv + offset * blur.direction.xy, 0.0) * w;
    weight += w;
  }
  return sum / weight;
}
`;

  const COMPOSITE_FS = `
struct Composite { strength: vec4f }
@group(0) @binding(0) var<uniform> composite: Composite;
@group(0) @binding(1) var sceneTexture: texture_2d<f32>;
@group(0) @binding(2) var glowTexture: texture_2d<f32>;
@group(0) @binding(3) var linearSampler: sampler;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let scene = textureSampleLevel(sceneTexture, linearSampler, uv, 0.0);
  let halo = textureSampleLevel(glowTexture, linearSampler, uv, 0.0);
  let s = composite.strength.x;
  // scene is the crisp mark, halo is that same mark blurred wide. Adding the
  // two gives a soft bloom while leaving the page fully visible in the gaps.
  return vec4f(scene.rgb + halo.rgb * s, clamp(scene.a + halo.a * s * 0.6, 0.0, 1.0));
}
`;

  // ── Brand-matched configuration ────────────────────────────────────────────
  // Tuned for legibility first: the marks sit directly behind the hero copy,
  // so the field is deliberately airy, faint and colourful rather than a dense
  // monochrome wall. `ink` (global opacity) is the main contrast lever, and the
  // CSS `opacity` on the ready state trims the whole layer again.
  const CFG = {
    // There is intentionally no text cutout: a lettered hole in the background
    // reads as an artefact and competes with the real hero copy. The mask
    // texture, its bindings and the fillText path are all gone - see SCENE_FS.
    shapes: "mixed",
    cellSize: 20,
    dotSize: 0.5,
    // Ink + the site's two sticker accents. The noise band picks between them:
    // ink triangles, yellow circles, blue squares.
    color: "#121212",
    accentA: "#FFD23F",
    accentB: "#5DBBFF",
    hoverColor: "#EA3E2B",
    // Global mark opacity (uniform: hover.w). Kept low so the muted subtitle
    // stays readable on top of the field.
    ink: 0.85,
    speed: 0.55,
    scale: 1,
    contrast: 1.05,
    brightness: 0.36,
    flow: 0,
    fade: 0.5,
    splashRadius: 46,
    splashStrength: 0.3,
    glow: 0.18,
    introDuration: 1.8
  };
  const SHAPE_MODES = { mixed: 0, squares: 1, circles: 2, triangles: 3 };

  function parseColor(value, fallback) {
    const src = typeof value === "string" ? value.trim() : "";
    const m = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(src) || /^#?([\da-f]{6})$/i.exec(fallback);
    let hex = m[1];
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
    return [0, 2, 4].map((o) => parseInt(hex.slice(o, o + 2), 16) / 255);
  }

  const canvas = document.getElementById("shape-waves");
  if (!canvas) return;

  // Honour the OS setting: if reduced motion is requested we never start,
  // leaving the hero as a flat paper canvas.
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduceMotion.matches) return;

  const ctx = canvas.getContext("webgpu");
  if (!ctx) return fail();

  let device = null;
  let disposed = false;
  let ready = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let dpr = 1;
  let W = 1;
  let H = 1;
  let cols = 1;
  let rows = 1;
  let cellPx = CFG.cellSize;
  let originY = 0;
  let charges = new Float32Array(1);
  let heights = new Float32Array(1);
  let prevHeights = new Float32Array(1);
  let chargesActive = false;
  let backlog = 0;
  let introStart = 0;
  let introProgress = INTRO_END;
  let visible = true;
  let bounds = null;

  // 9 x vec4f
  const paramsData = new Float32Array(36);

  function fail(err) {
    // Leave the hero exactly as it is today: flat paper canvas, no effect.
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    console.info(
      "[ShapeWaves] WebGPU unavailable - hero left unchanged.",
      err && err.message ? "(" + err.message + ")" : ""
    );
  }

  async function init() {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "low-power" });
    if (!adapter) return fail();
    device = await adapter.requestDevice();
    device.lost.then(() => fail());

    const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: "premultiplied" });

    const paramsBuf = device.createBuffer({
      size: paramsData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const blurXBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const blurYBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const compBuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(compBuf, 0, new Float32Array([CFG.glow * 2, 0, 0, 0]));

    const sampler = device.createSampler({
      magFilter: "linear", minFilter: "linear",
      addressModeU: "clamp-to-edge", addressModeV: "clamp-to-edge"
    });

    let chargeBuf = device.createBuffer({ size: 4, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(chargeBuf, 0, charges);

    const mkTex = (w, h) => device.createTexture({
      size: [Math.max(1, w), Math.max(1, h)],
      format: "rgba8unorm",
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
    });
    let sceneTex, glowA, glowB;

    const mkPipe = (fs, fmt) => device.createRenderPipeline({
      layout: "auto",
      vertex: { module: device.createShaderModule({ code: FULLSCREEN_VS }), entryPoint: "vs_main" },
      fragment: { module: device.createShaderModule({ code: fs }), entryPoint: "fs_main", targets: [{ format: fmt }] },
      primitive: { topology: "triangle-list" }
    });
    const scenePipe = mkPipe(SCENE_FS, "rgba8unorm");
    const blurPipe = mkPipe(BLUR_FS, "rgba8unorm");
    const compPipe = mkPipe(COMPOSITE_FS, format);

    const sceneBG = () => device.createBindGroup({
      layout: scenePipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: paramsBuf } },
        { binding: 1, resource: { buffer: chargeBuf } }
      ]
    });
    const blurBG = (buf, tex) => device.createBindGroup({
      layout: blurPipe.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: buf } },
        { binding: 1, resource: tex.createView() },
        { binding: 2, resource: sampler }
      ]
    });

    // Rebuilt on resize (texture views change).
    const bg = { scene: null, blurX: null, blurY: null, comp: null };

    function sizeTargets() {
      if (sceneTex) sceneTex.destroy();
      if (glowA) glowA.destroy();
      if (glowB) glowB.destroy();
      sceneTex = mkTex(W, H);
      const hw = Math.max(1, Math.ceil(W / 2));
      const hh = Math.max(1, Math.ceil(H / 2));
      glowA = mkTex(hw, hh);
      glowB = mkTex(hw, hh);
      device.queue.writeBuffer(blurXBuf, 0, new Float32Array([1 / hw, 0, 4, 0]));
      device.queue.writeBuffer(blurYBuf, 0, new Float32Array([0, 1 / hh, 4, 0]));
      bg.blurX = blurBG(blurXBuf, sceneTex);
      bg.blurY = blurBG(blurYBuf, glowA);
      bg.comp = device.createBindGroup({
        layout: compPipe.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: compBuf } },
          { binding: 1, resource: sceneTex.createView() },
          { binding: 2, resource: glowB.createView() },
          { binding: 3, resource: sampler }
        ]
      });
    }

    function configureGrid() {
      const nextCols = Math.max(1, Math.round(W / (CFG.cellSize * dpr)));
      cellPx = W / nextCols;
      const nextRows = Math.max(1, Math.floor(H / cellPx));
      originY = (H - nextRows * cellPx) / 2;
      if (nextCols === cols && nextRows === rows && charges.length === cols * rows) return;
      cols = nextCols;
      rows = nextRows;
      charges = new Float32Array(cols * rows);
      heights = new Float32Array(cols * rows);
      prevHeights = new Float32Array(cols * rows);
      chargesActive = false;
      const nb = device.createBuffer({
        size: charges.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
      });
      device.queue.writeBuffer(nb, 0, charges);
      chargeBuf.destroy();
      chargeBuf = nb;
      bg.scene = sceneBG();
    }

    function stepRipples() {
      let peak = 0;
      for (let r = 0; r < rows; r++) {
        const base = r * cols;
        const up = (r === 0 ? 0 : r - 1) * cols;
        const dn = (r === rows - 1 ? r : r + 1) * cols;
        for (let c = 0; c < cols; c++) {
          const i = base + c;
          const l = base + (c === 0 ? 0 : c - 1);
          const rt = base + (c === cols - 1 ? c : c + 1);
          const h = heights[i];
          const lap = heights[l] + heights[rt] + heights[up + c] + heights[dn + c] - 4 * h;
          const vel = (h - prevHeights[i]) * WAVE_FRICTION;
          const nxt = (h + vel + WAVE_SPEED * lap) * WAVE_DECAY;
          prevHeights[i] = nxt;
          const ch = Math.min(1, Math.max(0, nxt));
          charges[i] = ch;
          if (ch > peak) peak = ch;
        }
      }
      const s = heights;
      heights = prevHeights;
      prevHeights = s;
      return peak;
    }

    function updateCharges(dt) {
      if (!chargesActive) return false;
      backlog = Math.min(backlog + dt, SIM_STEP * 4);
      let peak = 1;
      while (backlog >= SIM_STEP) {
        backlog -= SIM_STEP;
        peak = stepRipples();
      }
      if (peak < SETTLED) {
        heights.fill(0);
        prevHeights.fill(0);
        charges.fill(0);
        chargesActive = false;
      }
      device.queue.writeBuffer(chargeBuf, 0, charges);
      return chargesActive;
    }

    function splash(cx, cy, strength) {
      const sigma = Math.max(0.5, ((CFG.splashRadius * dpr) / cellPx) * 0.5);
      const reach = Math.ceil(sigma * 2.5);
      const cc = (cx * dpr) / cellPx - 0.5;
      const cr = (cy * dpr - originY) / cellPx - 0.5;
      for (let r = Math.max(0, Math.floor(cr - reach)); r <= Math.min(rows - 1, Math.ceil(cr + reach)); r++) {
        const dy = r - cr;
        for (let c = Math.max(0, Math.floor(cc - reach)); c <= Math.min(cols - 1, Math.ceil(cc + reach)); c++) {
          const dx = c - cc;
          const i = r * cols + c;
          heights[i] = Math.min(1.2, heights[i] + strength * Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma)));
        }
      }
      chargesActive = true;
    }

    const pointer = { x: 0, y: 0, t: 0, inside: false };

    function wake() {
      if (disposed || raf) return;
      raf = requestAnimationFrame(loop);
    }

    function onMove(e) {
      if (!bounds) bounds = canvas.getBoundingClientRect();
      const now = performance.now();
      const x = e.clientX - bounds.left;
      const y = e.clientY - bounds.top;
      if (x < 0 || y < 0 || x > bounds.width || y > bounds.height) {
        pointer.inside = false;
        return;
      }
      const dt = pointer.inside ? Math.max(8, now - pointer.t) : 16;
      const moved = pointer.inside ? Math.hypot(x - pointer.x, y - pointer.y) : 0;
      const spd = (moved / dt) * 1000;
      splash(x, y, Math.min(1, 0.22 + spd * 0.0006) * CFG.splashStrength);
      pointer.x = x;
      pointer.y = y;
      pointer.t = now;
      pointer.inside = true;
      wake();
    }
    const onScroll = () => { bounds = null; };
    const onWake = () => wake();

    function resize() {
      bounds = null;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (w === W && h === H) return;
      W = w;
      H = h;
      canvas.width = W;
      canvas.height = H;
      sizeTargets();
      paramsData[0] = W;
      paramsData[1] = H;
      paramsData[2] = 1 / W;
      paramsData[3] = 1 / H;
      configureGrid();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver(
      (es) => { visible = es.some((e) => e.isIntersecting); if (visible) wake(); },
      { threshold: 0 }
    );
    io.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("scroll", onScroll, { capture: true, passive: true });
    document.addEventListener("visibilitychange", onWake);

    function cleanup() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", onScroll, { capture: true });
      document.removeEventListener("visibilitychange", onWake);
    }
    window.addEventListener("pagehide", cleanup, { once: true });

    resize();
    configureGrid();
    // configureGrid() only rebuilds the scene bind group when the grid size
    // changes, so bind it explicitly for the first frame.
    bg.scene = sceneBG();
    introStart = performance.now();
    introProgress = 0;
    loop(performance.now());

    function loop(now) {
      if (disposed) return;
      raf = 0;
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const animating = visible && !document.hidden && CFG.speed > 0;
      if (animating) time += dt * TIME_RATE * CFG.speed;
      const hovering = visible && !document.hidden && updateCharges(dt);
      const introPlaying = introProgress < INTRO_END;
      if (introPlaying) {
        introProgress = Math.min(INTRO_END, ((now - introStart) / 1000 / CFG.introDuration) * INTRO_END);
      }

      // placement / grid / field / motion / color / hover / accentA / accentB
      paramsData.set([0, originY, rows, introProgress], 4);
      paramsData.set([cellPx, CFG.dotSize, SHAPE_MODES[CFG.shapes], cols], 8);
      paramsData.set([NOISE_CELLS * cellPx, 0.5 - (CFG.brightness - 0.5) * 0.4, 2.8 * CFG.contrast, time], 12);
      paramsData.set([0, 0, 0, CFG.fade], 16);
      paramsData.set([...parseColor(CFG.color, "#121212"), 1], 20);
      // hover.w carries the global ink opacity consumed by the scene shader.
      paramsData.set([...parseColor(CFG.hoverColor, "#EA3E2B"), CFG.ink], 24);
      paramsData.set([...parseColor(CFG.accentA, "#FFD23F"), 1], 28);
      paramsData.set([...parseColor(CFG.accentB, "#5DBBFF"), 1], 32);
      device.queue.writeBuffer(paramsBuf, 0, paramsData);

      const glowOn = CFG.glow > 0;
      const enc = device.createCommandEncoder();

      // Passes execute in encoding order, so the glow chain that produces
      // sceneTex / glowB MUST be encoded before the pass that samples them.
      if (glowOn) {
        // 1. scene -> sceneTex
        const p1 = enc.beginRenderPass({
          colorAttachments: [{ view: sceneTex.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 0 } }]
        });
        p1.setPipeline(scenePipe);
        p1.setBindGroup(0, bg.scene);
        p1.draw(3);
        p1.end();

        // 2. sceneTex -> glowA (horizontal blur)
        const p2 = enc.beginRenderPass({
          colorAttachments: [{ view: glowA.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 0 } }]
        });
        p2.setPipeline(blurPipe);
        p2.setBindGroup(0, bg.blurX);
        p2.draw(3);
        p2.end();

        // 3. glowA -> glowB (vertical blur)
        const p3 = enc.beginRenderPass({
          colorAttachments: [{ view: glowB.createView(), loadOp: "clear", storeOp: "store", clearValue: { r: 0, g: 0, b: 0, a: 0 } }]
        });
        p3.setPipeline(blurPipe);
        p3.setBindGroup(0, bg.blurY);
        p3.draw(3);
        p3.end();
      }

      // 4. final pass to the canvas
      const out = enc.beginRenderPass({
        colorAttachments: [{
          view: ctx.getCurrentTexture().createView(),
          loadOp: "clear", storeOp: "store",
          clearValue: { r: 0, g: 0, b: 0, a: 0 }
        }]
      });
      if (glowOn) {
        out.setPipeline(compPipe);
        out.setBindGroup(0, bg.comp);
      } else {
        out.setPipeline(scenePipe);
        out.setBindGroup(0, bg.scene);
      }
      out.draw(3);
      out.end();

      device.queue.submit([enc.finish()]);

      if (!ready) {
        ready = true;
        canvas.dataset.ready = "true";
      }
      if (animating || hovering || introPlaying) raf = requestAnimationFrame(loop);
      else last = 0;
    }
  }

  init().catch((err) => fail(err));

})();
