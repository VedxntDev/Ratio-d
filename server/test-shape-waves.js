/**
 * Headless smoke test for js/shape-waves.js.
 *
 * The module is a browser IIFE, so it is executed inside a `vm` context with
 * a stubbed DOM + WebGPU device. This is the only way to catch runtime faults
 * (ReferenceErrors, bad ordering, unhandled throws) without a GPU browser.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SRC = fs.readFileSync(path.join(__dirname, "..", "js", "shape-waves.js"), "utf8");

let failures = 0;
function check(label, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
}

function makeEnv({ webgpu }) {
  const calls = { draws: 0, submits: 0, passes: [], textures: 0, destroyed: 0, params: null };

  const device = {
    queue: {
      // Capture the scene params upload (9 x vec4f = 36 floats) so the tests can
      // assert the legibility + palette contract against the bytes the GPU
      // actually receives, not just against the source text.
      writeBuffer(buf, offset, data) {
        if (data instanceof Float32Array && data.length === 36) {
          calls.params = Array.from(data);
        }
      },
      copyExternalImageToTexture() {},
      submit(list) {
        calls.submits += list.length;
      }
    },
    lost: new Promise(() => {}),
    createBuffer: () => ({ destroy() {} }),
    createTexture: () => {
      calls.textures++;
      return { createView: () => ({}), destroy() { calls.destroyed++; } };
    },
    createSampler: () => ({}),
    createShaderModule: () => ({}),
    createRenderPipeline: () => ({ getBindGroupLayout: () => ({}) }),
    createBindGroup: () => ({}),
    createCommandEncoder: () => ({
      beginRenderPass(desc) {
        calls.passes.push(calls.nextPassIsCanvas ? "canvas" : "offscreen");
        calls.nextPassIsCanvas = false;
        return {
          setPipeline() {},
          setBindGroup() {},
          draw() { calls.draws++; },
          end() {}
        };
      },
      finish: () => ({ _encoded: true })
    })
  };

  // A GPUCanvasContext stand-in: configure() + getCurrentTexture() are the
  // only members the component touches. getCurrentTexture() flags the next
  // render pass as the final canvas pass so ordering can be asserted.
  const webgpuCtx = {
    configure() {},
    unconfigure() {},
    getCurrentTexture: () => {
      calls.nextPassIsCanvas = true;
      return { createView: () => ({}) };
    }
  };

  const canvas = {
    id: "shape-waves",
    clientWidth: 1200,
    clientHeight: 600,
    width: 0,
    height: 0,
    dataset: {},
    parentNode: { removeChild() { canvas.removed = true; } },
    getContext: (kind) => (kind === "webgpu" ? (webgpu ? webgpuCtx : null) : {}),
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1200, height: 600 })
  };
  const logs = [];
  const sandbox = {
    console: {
      info(...a) { logs.push(["info", a.join(" ")]); },
      warn(...a) { logs.push(["warn", a.join(" ")]); },
      error(...a) { logs.push(["error", a.join(" ")]); }
    },
    navigator: {
      gpu: webgpu
        ? {
            requestAdapter: async () => ({ requestDevice: async () => device }),
            getPreferredCanvasFormat: () => "bgra8unorm"
          }
        : undefined
    },
    document: {
      getElementById: (id) => (id === "shape-waves" ? canvas : null),
      // No 2d canvas is ever created any more: the text-cutout mask is gone, so
      // the effect needs nothing from the 2d context.
      createElement: () => { throw new Error("no 2d canvas should be created"); },
      addEventListener() {},
      removeEventListener() {},
      hidden: false
    },
    window: {
      devicePixelRatio: 2,
      matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
      addEventListener() {},
      removeEventListener() {}
    },
    requestAnimationFrame: () => 1,   // one frame only, avoids an infinite loop
    cancelAnimationFrame() {},
    ResizeObserver: class { observe() {} disconnect() {} },
    IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} },
    performance: { now: () => 0 },
    GPUBufferUsage: { UNIFORM: 1, COPY_DST: 2, STORAGE: 4 },
    GPUTextureUsage: { TEXTURE_BINDING: 1, COPY_DST: 2, RENDER_ATTACHMENT: 4 },
    Float32Array,
    Math,
    Set
  };
  sandbox.globalThis = sandbox;

  return { sandbox, calls, canvas, logs };
}

function run(env) {
  vm.createContext(env.sandbox);
  vm.runInContext(SRC, env.sandbox, { filename: "shape-waves.js" });
  // let the async init settle
  return new Promise((r) => setImmediate(r));
}

(async () => {
  // 1. No WebGPU at all (Firefox) - must bail cleanly, hero untouched
  {
    const env = makeEnv({ webgpu: false });
    let threw = null;
    try { await run(env); } catch (e) { threw = e; }
    check("no WebGPU: does not throw", !threw, threw ? threw.message : "clean bail");
    check("no WebGPU: canvas removed (flat paper fallback)", env.canvas.removed === true);
    check("no WebGPU: no frames rendered", env.calls.draws === 0);
  }

  // 2. WebGPU present - must initialise and render
  {
    const env = makeEnv({ webgpu: true });
    let threw = null;
    try { await run(env); } catch (e) { threw = e; }
    check("WebGPU: does not throw", !threw, threw ? threw.message : "no runtime error");
    if (env.calls.passes.length === 0) {
      console.log("      canvas removed (init failed):", env.canvas.removed === true);
      env.logs.forEach(([lvl, m]) => console.log(`      console.${lvl}: ${m}`));
    }
    check("WebGPU: device acquired + passes encoded", env.calls.passes.length >= 4,
      env.calls.passes.join(" -> "));
    check("WebGPU: submitted work", env.calls.submits >= 1, `${env.calls.submits} submits`);
    check("WebGPU: drew geometry", env.calls.draws >= 4, `${env.calls.draws} draw calls`);
    check("WebGPU: marked ready", env.canvas.dataset.ready === "true");

    // Ordering matters: the glow chain writes sceneTex/glowB, and the final
    // canvas pass samples them. Encoding the canvas pass first would composite
    // uninitialised textures. This is the exact bug that was fixed.
    const seq = env.calls.passes;
    check("glow chain encoded before the canvas pass",
      seq.indexOf("canvas") === seq.length - 1 && seq.slice(0, -1).every((p) => p === "offscreen"),
      seq.join(" -> "));
    check("exactly one canvas pass per frame",
      seq.filter((p) => p === "canvas").length === 1,
      `${seq.filter((p) => p === "canvas").length} canvas pass(es)`);

    // Uniform contents: verify the legibility + palette contract against the
    // bytes actually uploaded to the GPU. Regressing `ink` upward or restoring
    // the mask flag is what previously made the hero copy unreadable.
    const p = env.calls.params;
    check("scene params uploaded", p !== null && p.length === 36, p ? p.length + " floats" : "none");
    if (p) {
      const near = (a, b) => Math.abs(a - b) < 0.005;
      const at = (o) => [p[o], p[o + 1], p[o + 2]];
      const ink = p[24 + 3];  // hover.w, the global mark opacity
      const yellow = at(28);  // accentA
      const blue = at(32);    // accentB
      const red = at(24);     // hover tint
      const inkHex = at(20);  // color

      // motion.z used to gate the text-cutout mask sample.
      check("text-cutout mask flag is off", p[16 + 2] === 0, "motion.z = " + p[16 + 2]);
      check("global ink opacity is set and stays low", ink > 0 && ink <= 0.95, "ink = " + ink);
      check("ink colour is the site ink", near(inkHex[0], 0.07) && near(inkHex[2], 0.07), inkHex.join(", "));
      check("accent A is sticker yellow", near(yellow[0], 1) && near(yellow[1], 0.82) && near(yellow[2], 0.25), yellow.join(", "));
      check("accent B is sticker blue", near(blue[0], 0.36) && near(blue[1], 0.73) && near(blue[2], 1), blue.join(", "));
      check("ripple tint is the primary red", near(red[0], 0.92) && near(red[1], 0.24) && near(red[2], 0.17), red.join(", "));
      // grid dotSize must leave gaps between marks, otherwise the field reads
      // as a solid block behind the copy again.
      check("marks are small enough to leave gaps", p[8 + 1] > 0 && p[8 + 1] <= 0.65, "dotSize = " + p[8 + 1]);
    }
  }

  // 3. Canvas element absent - must bail without touching anything
  {
    const env = makeEnv({ webgpu: true });
    env.sandbox.document.getElementById = () => null;
    let threw = null;
    try { await run(env); } catch (e) { threw = e; }
    check("missing canvas: does not throw", !threw, threw ? threw.message : "clean bail");
    check("missing canvas: no work done", env.calls.draws === 0);
  }

  console.log(failures === 0 ? "\nSHAPE WAVES SMOKE TEST PASSED" : `\n${failures} SMOKE TEST FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
})();
