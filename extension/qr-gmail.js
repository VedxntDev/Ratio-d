/* Gmail: find images in the open message, decode QR codes, show a separate Shadow DOM banner.
   Best effort: Gmail proxies images, so fetch may fail for some (then nothing is shown). Needs qr-core.js + jsQR.js loaded first. */
(function () {
  "use strict";
  if (!window.QrScan) return;
  window.QrScan.setEndpoints(["http://127.0.0.1:3000/analyze-qr", "https://ratio-d.vercel.app/analyze-qr"]);
  var seen = new WeakSet(), VERD = ["safe", "suspicious", "high_risk"];

  function banner(anchor, res) {
    var v = VERD.indexOf(res.verdict) >= 0 ? res.verdict : "suspicious";
    if (v === "safe") return; // stay quiet on clean codes
    var host = document.createElement("div"), sh = host.attachShadow({ mode: "open" });
    var st = document.createElement("style");
    st.textContent = ".b{font:12px 'JetBrains Mono',monospace;border:2px solid #121212;background:#F8F7F2;box-shadow:3px 3px 0 #121212;padding:8px 10px;margin:6px 0;border-radius:6px}.h{font-weight:800;color:" + (v === "high_risk" ? "#EA3E2B" : "#E8720C") + "}code{display:block;word-break:break-all;margin:4px 0;background:#fff;border:1px dashed #121212;padding:3px 6px;border-radius:4px}";
    var b = document.createElement("div"); b.className = "b";
    var h = document.createElement("div"); h.className = "h"; h.textContent = "[ 📱 QR SECURITY CODE ALERT ]  RISK SCORE: " + Number(res.score) + "/100 (" + v.toUpperCase() + ")";
    var c = document.createElement("code"); c.textContent = String(res.defanged);
    var ul = document.createElement("ul"); ul.style.margin = "4px 0 0 16px"; ul.style.padding = "0";
    (res.flags || []).slice(0, 4).forEach(function (f) { var li = document.createElement("li"); li.textContent = f.reason; ul.append(li); });
    b.append(h, c, ul); sh.append(st, b);
    anchor.parentNode.insertBefore(host, anchor);
  }

  async function scan() {
    var body = document.querySelector(".a3s.aiL, .a3s, .ii.gt"); if (!body) return;
    var imgs = body.querySelectorAll("img");
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      if (seen.has(img) || !img.complete || img.naturalWidth < 80) continue;
      seen.add(img);
      try {
        var blob = await (await fetch(img.src, { credentials: "include" })).blob();
        var bmp = await createImageBitmap(blob);
        var codes = await window.QrScan.decodeBitmap(bmp);
        for (var j = 0; j < codes.length; j++) {
          var qrRes = await window.QrScan.analyze(codes[j]);
          if (window.updateRatiodBannerQr) {
            window.updateRatiodBannerQr(qrRes);
          }
          banner(img, qrRes);
        }
      } catch (e) { /* CORS / proxy failure: skip silently */ }
    }
  }
  setInterval(scan, 2000);
})();
