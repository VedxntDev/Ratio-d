/**
 * Ratio'd Extension Popup Analytics Controller
 * Reads local client-side threat & clutter telemetry from chrome.storage.local.
 * Zero telemetry transmitted to external servers.
 */

function getStorage(callback) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(["ratiod_stats"], (res) => {
        callback(res && res.ratiod_stats ? res.ratiod_stats : null);
      });
      return;
    }
  } catch (e) {}

  // Fallback to localStorage if chrome.storage is unavailable
  try {
    const raw = localStorage.getItem("ratiod_stats");
    callback(raw ? JSON.parse(raw) : null);
  } catch (e) {
    callback(null);
  }
}

function setStorage(stats, callback) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ ratiod_stats: stats }, () => {
        if (callback) callback();
      });
      return;
    }
  } catch (e) {}

  try {
    localStorage.setItem("ratiod_stats", JSON.stringify(stats));
    if (callback) callback();
  } catch (e) {
    if (callback) callback();
  }
}

function renderStats(stats) {
  const s = stats || {
    total: 0,
    safe: 0,
    promo: 0,
    suspicious: 0,
    high_risk: 0,
    qr_scanned: 0,
    pii_redacted: 0
  };

  const total = Number(s.total) || 0;
  const safe = Number(s.safe) || 0;
  const promo = Number(s.promo) || 0;
  const suspicious = Number(s.suspicious) || 0;
  const highRisk = Number(s.high_risk) || 0;
  const pii = Number(s.pii_redacted) || 0;
  const qr = Number(s.qr_scanned) || 0;

  // Render values
  document.getElementById("val-total").textContent = total.toLocaleString();
  document.getElementById("val-safe").textContent = safe.toLocaleString();
  document.getElementById("val-promo").textContent = promo.toLocaleString();
  document.getElementById("val-suspicious").textContent = suspicious.toLocaleString();
  document.getElementById("val-high_risk").textContent = highRisk.toLocaleString();
  document.getElementById("val-pii").textContent = `${pii.toLocaleString()} items`;
  document.getElementById("val-qr").textContent = qr.toLocaleString();

  // Empty state notice
  const emptyNotice = document.getElementById("empty-notice");
  if (emptyNotice) {
    emptyNotice.style.display = total === 0 ? "block" : "none";
  }

  // Calculate percentages
  const safePct = total > 0 ? Math.round((safe / total) * 100) : 0;
  const promoPct = total > 0 ? Math.round((promo / total) * 100) : 0;
  const suspPct = total > 0 ? Math.round((suspicious / total) * 100) : 0;
  const highRiskPct = total > 0 ? Math.round((highRisk / total) * 100) : 0;

  document.getElementById("pct-safe").textContent = `${safePct}%`;
  document.getElementById("pct-promo").textContent = `${promoPct}%`;
  document.getElementById("pct-suspicious").textContent = `${suspPct}%`;
  document.getElementById("pct-high_risk").textContent = `${highRiskPct}%`;

  // Update multi-segment progress bar
  const barSafe = document.getElementById("bar-safe");
  const barPromo = document.getElementById("bar-promo");
  const barSusp = document.getElementById("bar-suspicious");
  const barHigh = document.getElementById("bar-high_risk");

  if (total > 0) {
    barSafe.style.width = `${(safe / total) * 100}%`;
    barPromo.style.width = `${(promo / total) * 100}%`;
    barSusp.style.width = `${(suspicious / total) * 100}%`;
    barHigh.style.width = `${(highRisk / total) * 100}%`;
  } else {
    barSafe.style.width = "0%";
    barPromo.style.width = "0%";
    barSusp.style.width = "0%";
    barHigh.style.width = "0%";
  }

  const sub = document.getElementById("hero-subtext");
  if (sub) {
    if (total === 0) {
      sub.textContent = "Open an email in Gmail to start live analysis";
    } else {
      sub.textContent = `${safe} safe · ${promo} promo · ${suspicious + highRisk} flagged threats`;
    }
  }
}

function initPopup() {
  getStorage((stats) => {
    renderStats(stats);
  });

  // Open Gmail button
  const btnGmail = document.getElementById("btn-open-gmail");
  if (btnGmail) {
    btnGmail.addEventListener("click", () => {
      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.create) {
          chrome.tabs.create({ url: "https://mail.google.com" });
          return;
        }
      } catch (e) {}
      window.open("https://mail.google.com", "_blank");
    });
  }


  // Reset counters button
  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      const emptyStats = {
        total: 0,
        safe: 0,
        promo: 0,
        suspicious: 0,
        high_risk: 0,
        qr_scanned: 0,
        pii_redacted: 0
      };
      setStorage(emptyStats, () => {
        renderStats(emptyStats);
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", initPopup);
