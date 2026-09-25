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
  const calls = { draws: 0, submits: 0, passes: [], textures: 0, destroyed: 0 };

  const device = {
    queue: {
      writeBuffer() {},
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
      createElement: () => ({
        width: 0, height: 0,
        getContext: () => ({
          fillRect() {}, fillText() {}, measureText: () => ({ width: 100 }),
          set font(v) {}, set fillStyle(v) {}, set textAlign(v) {}, set textBaseline(v) {}
        })
      }),
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
