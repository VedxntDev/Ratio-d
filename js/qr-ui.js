/* QR panel wiring. Everything attacker-controlled (payload, flags) is written with textContent, never innerHTML. */
(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var root = $("qr-result"), fileIn = $("qr-file"), camBtn = $("qr-cam"), video = $("qr-video"), drop = $("qr-drop"), steps = $("qr-steps");
  if (!root || !window.QrScan) return;
  var VERDICTS = ["safe", "suspicious", "high_risk"], stopCam = null;

  function mk(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function step(n, state) { // n: 1 capture, 2 decode, 3 analyze, 4 verdict; state: idle|active|done|fail
    if (!steps) return;
    var li = steps.children[n - 1]; if (li) li.setAttribute("data-state", state);
  }
  function resetSteps() { for (var i = 1; i <= 4; i++) step(i, "idle"); }

  function card(res) {
    var v = VERDICTS.indexOf(res.verdict) >= 0 ? res.verdict : "suspicious";
    var c = mk("article", "qr-card qr-" + v);
    c.append(mk("div", "qr-verdict", "[ " + v.toUpperCase() + " ]  RISK SCORE: " + Number(res.score) + "/100"));
    c.append(mk("div", "qr-label", "QR CONTAINS (" + String(res.payload_kind) + ", defanged, not clickable)"));
    c.append(mk("code", "qr-payload", String(res.defanged)));
    if (res.flags && res.flags.length) {
      var ul = mk("ul", "qr-flags");
      res.flags.forEach(function (f) { ul.append(mk("li", null, "[" + f.span + "] " + f.reason + " (+" + f.points + ")")); });
      c.append(ul);
    }
    var ns = mk("ul", "qr-next"); (res.next_steps || []).forEach(function (s) { ns.append(mk("li", null, s)); }); c.append(ns);
    c.append(mk("div", "qr-engine", "engine: " + (res.engine && res.engine.source)));
    return c;
  }

  async function run(getPayloads) {
    root.textContent = ""; resetSteps(); step(1, "done"); step(2, "active");
    var list;
    try { list = await getPayloads(); } catch (e) { step(2, "fail"); root.append(mk("p", "qr-msg", "Could not read that image/camera: " + e.message)); return; }
    if (!list.length) { step(2, "fail"); root.append(mk("p", "qr-msg", "No QR code found. Try a sharper, closer, well-lit image.")); return; }
    step(2, "done"); step(3, "active");
    try {
      for (var i = 0; i < Math.min(list.length, 5); i++) root.append(card(await window.QrScan.analyze(list[i])));
      step(3, "done"); step(4, "done");
    } catch (e) { step(3, "fail"); root.append(mk("p", "qr-msg", "Analysis engine unreachable (start `npm start`).")); }
  }

  function fromFile(f) { if (f && /^image\//.test(f.type)) run(function () { return window.QrScan.decodeFile(f); }); }

  if (fileIn) fileIn.addEventListener("change", function () { fromFile(fileIn.files[0]); fileIn.value = ""; });
  document.addEventListener("paste", function (e) {
    var items = (e.clipboardData && e.clipboardData.items) || [];
    for (var i = 0; i < items.length; i++) if (items[i].type.indexOf("image/") === 0) { fromFile(items[i].getAsFile()); break; }
  });
  if (drop) {
    ["dragenter", "dragover"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove("over"); }); });
    drop.addEventListener("drop", function (e) { fromFile(e.dataTransfer.files[0]); });
  }
  if (camBtn && video) camBtn.addEventListener("click", async function () {
    if (stopCam) { stopCam(); stopCam = null; video.hidden = true; camBtn.textContent = "Use camera"; return; }
    video.hidden = false; camBtn.textContent = "Stop camera";
    run(function () {
      return new Promise(async function (resolve, reject) {
        try { stopCam = await window.QrScan.startCamera(video, function (out) { stopCam = null; video.hidden = true; camBtn.textContent = "Use camera"; resolve(out); }); }
        catch (e) { video.hidden = true; camBtn.textContent = "Use camera"; reject(e); }
      });
    });
  });
})();
