/**
 * Renders the real extension banner in headless Chrome against a stubbed
 * chrome.runtime, so the Shadow DOM UI, the credit link and the HTML escaping
 * are verified in a real browser rather than by regex alone.
 */
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");

const PORT = 9342;
const ROOT = require("path").join(__dirname, "..");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port: PORT, path: p }, (r) => {
    let d = ""; r.on("data", (c) => (d += c)); r.on("end", () => res(JSON.parse(d)));
  }).on("error", rej);
});

// The flag span is copied verbatim out of the email body, so an XSS payload
// here is exactly what a hostile sender would put into a message.
const PAYLOAD = {
  score: 88,
  verdict: "high_risk",
  explanation: "HIGH RISK DETECTED: this EMAIL combines credential harvesting.",
  next_steps: ["Do NOT click any links.", "Report sender as phishing."],
  privacy: { phones_masked: 1, emails_masked: 2, otp_masked: 1 },
  flags: [
    { span: "<img src=x onerror=alert(1)>", reason: "Suspicious inline markup" },
    { span: "paypa1-security.com", reason: "Homoglyph/Typosquat domain" },
  ],
};

let failures = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
  if (!ok) failures++;
};

async function connect() {
  const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ["--headless=new", `--remote-debugging-port=${PORT}`, "--disable-gpu", "--hide-scrollbars",
     "--no-first-run", "--user-data-dir=/tmp/banner-chrome", "about:blank"], { stdio: "ignore" });
  let t;
  for (let i = 0; i < 40; i++) { try { t = await get("/json/list"); break; } catch { await sleep(500); } }
  const ws = new WebSocket(t.find((x) => x.type === "page").webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  let id = 0; const p = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && p.has(m.id)) { p.get(m.id)(m); p.delete(m.id); } };
  const send = (method, params) => new Promise((res) => { const i = ++id; p.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result.result.value;
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable");
  await send("Network.enable");
  const errs = [];
  ws.addEventListener("message", (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Log.entryAdded" && m.params.entry.level === "error") {
      const e = m.params.entry;
      errs.push(`${e.text} ${e.url ? "[" + e.url + "]" : ""}`);
    }
    if (m.method === "Runtime.exceptionThrown") {
      errs.push(m.params.exceptionDetails.text + " " +
        (m.params.exceptionDetails.exception?.description || ""));
    }
    if (m.method === "Network.loadingFailed") {
      errs.push("loadingFailed: " + (m.params.errorText || ""));
    }
  });
  return { chrome, ws, send, ev, errs };
}

const HOST_SEL = "document.getElementById('ratiod-banner-host')";

const PROBE = `(() => {
  const host = ${HOST_SEL};
  const root = host && host.shadowRoot;
  if (!root) return { error: "no shadow root" };
  const q = (s) => root.querySelector(s);
  const logo = q(".ratiod-logo"), cred = q(".ratiod-cred"), toggle = q("#toggle-drawer");
  return {
    xssFired: window.__xssFired,
    injectedImgs: root.querySelectorAll("img").length - (logo ? 1 : 0),
    spanText: (q(".flag-span")||{}).textContent,
    tag: (q(".ratiod-tag")||{}).textContent,
    logoSrc: logo ? logo.getAttribute("src") : null,
    credHref: cred ? cred.getAttribute("href") : null,
    credRel: cred ? cred.getAttribute("rel") : null,
    hasDismiss: !!q("#btn-dismiss"),
    hasCollapse: !!q("#btn-collapse"),
    drawerAria: toggle ? toggle.getAttribute("aria-expanded") : null,
    srText: Array.from(root.querySelectorAll(".sr-only")).map(n => n.textContent.trim()),
  };
})()`;

const INTERACT = `(() => {
  const root = ${HOST_SEL}.shadowRoot;
  const drawer = root.getElementById("analysis-drawer"), toggle = root.getElementById("toggle-drawer");
  toggle.click();
  const open = { open: drawer.classList.contains("open"), aria: toggle.getAttribute("aria-expanded") };
  const body = root.getElementById("ratiod-body"), collapse = root.getElementById("btn-collapse");
  collapse.click();
  const collapsed = body.classList.contains("collapsed");
  collapse.click();
  root.getElementById("btn-dismiss").click();
  return { open, collapsed, reExpanded: !body.classList.contains("collapsed"),
           gone: !document.body.contains(${HOST_SEL}) };
})()`;

(async () => {
  const { chrome, ws, send, ev, errs } = await connect();
  const bannerJs = fs.readFileSync(`${ROOT}/extension/banner.js`, "utf8");
  const html = `<!doctype html><meta charset="utf-8">
    <body style="margin:0;padding:24px;background:#F6F1E7">
      <div id="target"><p>Fake Gmail message body goes here.</p></div>
      <script>
        window.chrome = { runtime: { getURL: (p) => "chrome-extension://ratio-d/" + p } };
        window.__xssFired = false;
        window.alert = function () { window.__xssFired = true; };
      <\/script>
      <script>${bannerJs.replace(/<\/script>/gi, "<\\/script>")}<\/script>
      <script>window.injectRatiodBanner(document.getElementById("target"), ${JSON.stringify(PAYLOAD)});<\/script>
    </body>`;

  await send("Page.navigate", { url: "data:text/html;charset=utf-8," + encodeURIComponent(html) });
  await sleep(2500);

  const r = await ev(PROBE);
  check("banner mounts a shadow root", !r.error, r.error);
  check("hostile span did NOT execute", r.xssFired === false, `alert fired: ${r.xssFired}`);
  check("hostile span rendered as text, not an <img>",
    r.injectedImgs === 0 && /<img src=x/.test(r.spanText || ""), r.spanText);
  // The API verdict vocabulary is snake_case, so the tag renders "HIGH_RISK".
  check("verdict tag uses the server verdict", /HIGH[_ ]RISK/.test(r.tag || ""), r.tag);
  check("logo points at a packaged icon", /icons\/icon\d+\.png$/.test(r.logoSrc || ""), r.logoSrc);
  check("credit links to the GitHub profile", r.credHref === "https://github.com/VedxntDev", r.credHref);
  check("credit link is rel-safe", /noopener/.test(r.credRel || ""), r.credRel);
  check("dismiss and collapse controls exist", r.hasDismiss && r.hasCollapse);
  check("drawer starts collapsed with aria-expanded=false", r.drawerAria === "false", String(r.drawerAria));
  check("icon buttons have screen-reader names", r.srText.length >= 2, JSON.stringify(r.srText));

  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true,
    clip: { x: 0, y: 0, width: 900, height: 560, scale: 1.5 } });
  fs.writeFileSync("/tmp/banner_render.png", Buffer.from(shot.result.data, "base64"));

  // Interact only after the screenshot: dismiss removes the host, so capturing
  // afterwards would only ever photograph an empty page.
  const i = await ev(INTERACT);
  check("drawer toggle syncs aria-expanded", i.open.open === true && i.open.aria === "true", JSON.stringify(i.open));
  check("collapse hides the body and re-expands", i.collapsed === true && i.reExpanded === true);
  check("dismiss removes the banner from the DOM", i.gone === true);

  // Clear anything collected from the harness page above, so the counts below
  // describe the real site only.
  errs.length = 0;
  await send("Page.navigate", { url: "http://127.0.0.1:3000/" });
  await sleep(4000);
  const local = await ev(`(() => ({
    title: document.title,
    h1: (document.querySelector('h1')||{}).innerText,
    bg: getComputedStyle(document.body).backgroundColor,
    logoMark: !!document.querySelector('.logo-mark'),
    credit: !!Array.from(document.querySelectorAll('a')).find(a => a.href === 'https://github.com/VedxntDev' && a.textContent.trim() === 'Developed by Vedant'),
    tabs: document.querySelectorAll('[id^=tab-]').length
  }))()`);
  console.log("LOCAL:", JSON.stringify(local, null, 1));
  console.log("CONSOLE ERRORS:", JSON.stringify(errs, null, 1));

  await send("Page.navigate", { url: "https://ratio-d.vercel.app/" });
  await sleep(4500);
  const live = await ev(`(() => ({
    title: document.title,
    icons: Array.from(document.querySelectorAll('link[rel*=icon], link[rel="apple-touch-icon"], link[rel="mask-icon"]'))
      .map(l => l.getAttribute('href')),
    og: !!document.querySelector('meta[property="og:image"]'),
    credit: !!Array.from(document.querySelectorAll('a')).find(a => a.href === 'https://github.com/VedxntDev' && a.textContent.trim() === 'Developed by Vedant')
  }))()`);
  console.log("LIVE:", JSON.stringify(live, null, 1));
  const liveShot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync("/tmp/live_top.png", Buffer.from(liveShot.result.data, "base64"));

  console.log(failures === 0 ? "\nBANNER RENDERS AND ESCAPES CORRECTLY" : `\n${failures} BANNER PROBLEM(S)`);
  ws.close(); chrome.kill();
  process.exit(failures === 0 ? 0 : 1);
})();
