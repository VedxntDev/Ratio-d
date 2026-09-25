/**
 * Renders assets/logo.svg into every PNG size the site + extension need.
 * Uses headless Chrome so the raster output matches what the browser draws.
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const { spawn, execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PORT = 9341;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: PORT, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)));
  }).on("error", rej);
});

// size -> destination path. 16/48/128/512 are Chrome's required manifest sizes.
// Every extension icon must be listed here: a size that is not regenerated
// silently keeps the previous brand and ships an inconsistent toolbar icon.
const TARGETS = [
  [16, "assets/favicon-16x16.png"],
  [32, "assets/favicon-32x32.png"],
  [16, "extension/icons/icon16.png"],
  [48, "extension/icons/icon48.png"],
  [128, "extension/icons/icon128.png"],
  [512, "extension/icons/icon512.png"],
  [180, "assets/apple-touch-icon.png"],
  [192, "assets/icon-192.png"],
  [512, "assets/icon-512.png"],
];

(async () => {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", "--hide-scrollbars",
     "--no-first-run", "--user-data-dir=/tmp/logo-chrome", "about:blank"], { stdio: "ignore" });
  let t;
  for (let i = 0; i < 40; i++) { try { t = await get("/json/list"); break; } catch { await sleep(500); } }
  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const p = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
  const send = (method, params) => new Promise((res) => { const i = ++id; p.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true })).result.result.value;
  await send("Page.enable"); await send("Runtime.enable");

  const svg = fs.readFileSync(path.join(ROOT, "assets/logo.svg"), "utf8");
  for (const [size, rel] of TARGETS) {
    await send("Emulation.setDeviceMetricsOverride", { width: size, height: size, deviceScaleFactor: 1, mobile: false });
    const html = `<!doctype html><meta charset="utf-8">
      <style>html,body{margin:0;padding:0;background:transparent}
      svg{display:block;width:${size}px;height:${size}px}</style>${svg}`;
    await send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
    await sleep(450);
    const shot = await send("Page.captureScreenshot",
      { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: size, height: size, scale: 1 } });
    const out = path.join(ROOT, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
    const px = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", out], { encoding: "utf8" });
    const w = /pixelWidth: (\d+)/.exec(px)[1], h = /pixelHeight: (\d+)/.exec(px)[1];
    console.log(`wrote ${rel.padEnd(32)} ${w}x${h}`);
  }
  ws.close(); chrome.kill();
})();