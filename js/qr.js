/* QR decode + analyze client. Plain window global, no modules.
   Decode: BarcodeDetector if present, else vendored jsQR (js/vendor/jsQR.js, load it first). */
(function (global) {
  "use strict";
  var endpoints = ["http://127.0.0.1:3000/analyze-qr", "/analyze-qr"];
  var SCALES = [1, 0.5, 0.25];

  function setEndpoints(list) { endpoints = list.slice(); }

  async function decodeCanvas(cv) {
    if ("BarcodeDetector" in global) {
      try {
        var det = new global.BarcodeDetector({ formats: ["qr_code"] });
        var found = await det.detect(cv);
        if (found.length) return found.map(function (f) { return f.rawValue; });
      } catch (e) { /* fall through to jsQR */ }
    }
    if (typeof global.jsQR === "function") {
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      var id = ctx.getImageData(0, 0, cv.width, cv.height);
      var hit = global.jsQR(id.data, id.width, id.height, { inversionAttempts: "attemptBoth" });
      if (hit && hit.data) return [hit.data];
    }
    return [];
  }

  async function decodeBitmap(bmp) {
    var base = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    for (var i = 0; i < SCALES.length; i++) {
      var k = base * SCALES[i];
      var w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      var cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      var ctx = cv.getContext("2d", { willReadFrequently: true });
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h); // transparent PNGs would otherwise read as black
      ctx.drawImage(bmp, 0, 0, w, h);
      var out = await decodeCanvas(cv);
      if (out.length) return out;
    }
    return [];
  }

  async function decodeFile(file) {
    var bmp = await createImageBitmap(file);
    try { return await decodeBitmap(bmp); } finally { if (bmp.close) bmp.close(); }
  }

  // Redact PII before anything leaves the page. URLs: only query+fragment (host/path stay intact so rules work).
  function prepare(p) {
    var R = global.Redactor;
    if (!R || !R.redact) return p;
    if (/^https?:\/\//i.test(p)) {
      var i = p.search(/[?#]/);
      return i < 0 ? p : p.slice(0, i) + R.redact(p.slice(i)).redactedText;
    }
    return R.redact(p).redactedText;
  }

  async function analyze(payload) {
    var body = JSON.stringify({ payload: prepare(payload) }), last;
    for (var i = 0; i < endpoints.length; i++) {
      try {
        var r = await fetch(endpoints[i], { method: "POST", headers: { "Content-Type": "application/json" }, body: body });
        if (r.ok) return await r.json();
        last = new Error("HTTP " + r.status);
      } catch (e) { last = e; }
    }
    throw last || new Error("no endpoint reachable");
  }

  async function startCamera(video, onPayload) {
    var stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    video.srcObject = stream; await video.play();
    var cv = document.createElement("canvas"), stopped = false, busy = false;
    function stop() { stopped = true; stream.getTracks().forEach(function (t) { t.stop(); }); video.srcObject = null; }
    async function tick() {
      if (stopped) return;
      if (!busy && video.videoWidth) {
        busy = true;
        cv.width = video.videoWidth; cv.height = video.videoHeight;
        cv.getContext("2d", { willReadFrequently: true }).drawImage(video, 0, 0);
        var out = await decodeCanvas(cv); busy = false;
        if (out.length) { stop(); onPayload(out); return; }
      }
      setTimeout(tick, 200);
    }
    tick();
    return stop;
  }

  global.QrScan = { decodeFile: decodeFile, decodeBitmap: decodeBitmap, decodeCanvas: decodeCanvas, analyze: analyze, startCamera: startCamera, setEndpoints: setEndpoints };
})(typeof window !== "undefined" ? window : globalThis);
