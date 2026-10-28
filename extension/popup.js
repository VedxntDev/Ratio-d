/**
 * Ratio'd Extension Popup Controller (v1.5.0)
 * Telemetry Analytics & Senders Whitelist / Continuous Learning Manager
 * Air-gapped client-side storage via chrome.storage.local with zero external transmission.
 */

// Global state for rules search/filter
let cachedSenderRules = [];
let currentSearchQuery = "";

// ---------------------------------------------------------------------------
// Chrome Storage Helpers (with fallback for standalone/test environments)
// ---------------------------------------------------------------------------
function getStorage(keys, callback) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, (res) => {
        callback(res || {});
      });
      return;
    }
  } catch (e) {}

  // Fallback to localStorage
  try {
    const result = {};
    const keyList = Array.isArray(keys) ? keys : [keys];
    for (const k of keyList) {
      const raw = localStorage.getItem(k);
      result[k] = raw ? JSON.parse(raw) : null;
    }
    callback(result);
  } catch (e) {
    callback({});
  }
}

function setStorage(items, callback) {
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(items, () => {
        if (callback) callback();
      });
      return;
    }
  } catch (e) {}

  try {
    for (const [k, v] of Object.entries(items)) {
      localStorage.setItem(k, JSON.stringify(v));
    }
    if (callback) callback();
  } catch (e) {
    if (callback) callback();
  }
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabPanels = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabTarget = btn.getAttribute("data-tab");
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabPanels.forEach((p) => p.classList.remove("active"));

      btn.classList.add("active");
      const activePanel = document.getElementById(`panel-${tabTarget}`);
      if (activePanel) activePanel.classList.add("active");
    });
  });
}

// ---------------------------------------------------------------------------
// Telemetry Analytics Renderer
// ---------------------------------------------------------------------------
function renderStats(stats) {
  if (typeof document === "undefined") return;
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
  const elTotal = document.getElementById("val-total");
  if (elTotal) elTotal.textContent = total.toLocaleString();
  const elSafe = document.getElementById("val-safe");
  if (elSafe) elSafe.textContent = safe.toLocaleString();
  const elPromo = document.getElementById("val-promo");
  if (elPromo) elPromo.textContent = promo.toLocaleString();
  const elSusp = document.getElementById("val-suspicious");
  if (elSusp) elSusp.textContent = suspicious.toLocaleString();
  const elRisk = document.getElementById("val-high_risk");
  if (elRisk) elRisk.textContent = highRisk.toLocaleString();
  const elPii = document.getElementById("val-pii");
  if (elPii) elPii.textContent = `${pii.toLocaleString()} items`;
  const elQr = document.getElementById("val-qr");
  if (elQr) elQr.textContent = qr.toLocaleString();

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

  const pctSafe = document.getElementById("pct-safe");
  if (pctSafe) pctSafe.textContent = `${safePct}%`;
  const pctPromo = document.getElementById("pct-promo");
  if (pctPromo) pctPromo.textContent = `${promoPct}%`;
  const pctSusp = document.getElementById("pct-suspicious");
  if (pctSusp) pctSusp.textContent = `${suspPct}%`;
  const pctRisk = document.getElementById("pct-high_risk");
  if (pctRisk) pctRisk.textContent = `${highRiskPct}%`;

  // Update multi-segment progress bar
  const barSafe = document.getElementById("bar-safe");
  const barPromo = document.getElementById("bar-promo");
  const barSusp = document.getElementById("bar-suspicious");
  const barHigh = document.getElementById("bar-high_risk");

  // Default triage counts from stats
  const elTCntAll = document.getElementById("triage-cnt-all");
  if (elTCntAll) elTCntAll.textContent = total.toLocaleString();
  const elTCntRisk = document.getElementById("triage-cnt-risk");
  if (elTCntRisk) elTCntRisk.textContent = highRisk.toLocaleString();
  const elTCntSusp = document.getElementById("triage-cnt-susp");
  if (elTCntSusp) elTCntSusp.textContent = suspicious.toLocaleString();
  const elTCntPromo = document.getElementById("triage-cnt-promo");
  if (elTCntPromo) elTCntPromo.textContent = promo.toLocaleString();
  const elTCntSafe = document.getElementById("triage-cnt-safe");
  if (elTCntSafe) elTCntSafe.textContent = safe.toLocaleString();

  if (total > 0) {
    if (barSafe) barSafe.style.width = `${(safe / total) * 100}%`;
    if (barPromo) barPromo.style.width = `${(promo / total) * 100}%`;
    if (barSusp) barSusp.style.width = `${(suspicious / total) * 100}%`;
    if (barHigh) barHigh.style.width = `${(highRisk / total) * 100}%`;
  } else {
    if (barSafe) barSafe.style.width = "0%";
    if (barPromo) barPromo.style.width = "0%";
    if (barSusp) barSusp.style.width = "0%";
    if (barHigh) barHigh.style.width = "0%";
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

// ---------------------------------------------------------------------------
// Sender Learning & Whitelist Rule Manager
// ---------------------------------------------------------------------------
function formatVerdictLabel(verdict) {
  switch (verdict) {
    case "safe": return { label: "SAFE", cls: "badge-safe" };
    case "promo_clutter": return { label: "PROMO", cls: "badge-promo" };
    case "suspicious": return { label: "CAUTION", cls: "badge-suspicious" };
    case "high_risk": return { label: "SCAM", cls: "badge-high_risk" };
    default: return { label: (verdict || "SAFE").toUpperCase(), cls: "badge-safe" };
  }
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Recently";
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function loadAndRenderSenderRules() {
  getStorage(["ratiod_sender_learning", "ratiod_user_overrides"], (res) => {
    const learning = res.ratiod_sender_learning || {};
    const overrides = res.ratiod_user_overrides || {};

    const ruleMap = new Map();

    // Ingest learned sender rules
    for (const [key, val] of Object.entries(learning)) {
      if (!val) continue;
      const cleanKey = String(val.sender || key).trim().toLowerCase();
      ruleMap.set(cleanKey, {
        key: cleanKey,
        domain: val.domain || "",
        verdict: val.verdict || "safe",
        score: val.score !== undefined ? val.score : 0,
        source: val.userExplicit ? "Learned Feedback" : "Auto Rule",
        updatedAt: val.updatedAt || Date.now()
      });
    }

    // Ingest manual overrides that are senders or domains
    for (const [key, val] of Object.entries(overrides)) {
      if (!val) continue;
      const cleanKey = String(val.sender || key).replace(/^sender:/i, "").trim().toLowerCase();
      if (!cleanKey || cleanKey.length < 3) continue;
      if (!ruleMap.has(cleanKey)) {
        ruleMap.set(cleanKey, {
          key: cleanKey,
          domain: val.domain || "",
          verdict: val.verdict || "safe",
          score: val.score !== undefined ? val.score : 0,
          source: "Manual Override",
          updatedAt: val.timestamp || Date.now()
        });
      }
    }

    cachedSenderRules = Array.from(ruleMap.values()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderSenderList(cachedSenderRules, currentSearchQuery);
  });
}

function renderSenderList(rules, query) {
  if (typeof document === "undefined") return;
  const container = document.getElementById("sender-rules-list");
  const countBadge = document.getElementById("val-rule-count");
  if (!container) return;

  const q = String(query || "").trim().toLowerCase();
  const filtered = q
    ? rules.filter(r => r.key.toLowerCase().includes(q) || (r.domain && r.domain.toLowerCase().includes(q)))
    : rules;

  if (countBadge) {
    countBadge.textContent = `${rules.length} ${rules.length === 1 ? 'Rule' : 'Rules'}`;
  }
  const tabCount = document.getElementById("tab-sender-count");
  if (tabCount) {
    tabCount.textContent = rules.length;
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="rules-empty-state">
        ${q ? 'No rules matching "<strong>' + escapeHtml(q) + '</strong>".' : 'No custom rules or learned senders yet.<br>Add a rule above or mark an email directly in Gmail!'}
      </div>
    `;
    return;
  }

  let html = "";
  for (const rule of filtered) {
    const vMeta = formatVerdictLabel(rule.verdict);
    const timeStr = formatRelativeTime(rule.updatedAt);
    html += `
      <div class="rule-item" data-rule-key="${escapeHtml(rule.key)}">
        <div class="rule-info">
          <div class="rule-sender" title="${escapeHtml(rule.key)}">${escapeHtml(rule.key)}</div>
          <div class="rule-meta">
            <span class="rule-verdict-badge ${vMeta.cls}">${vMeta.label}</span>
            <span class="rule-source">${escapeHtml(rule.source)} &bull; ${timeStr}</span>
          </div>
        </div>
        <button class="rule-del-btn" data-key="${escapeHtml(rule.key)}" type="button" title="Delete rule">
          ✕ Delete
        </button>
      </div>
    `;
  }

  container.innerHTML = html;

  // Attach delete handlers
  const delButtons = container.querySelectorAll(".rule-del-btn");
  delButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const keyToDelete = btn.getAttribute("data-key");
      if (keyToDelete) {
        deleteSenderRule(keyToDelete);
      }
    });
  });
}

function addSenderRule(rawAddress, verdict) {
  let target = String(rawAddress || "").trim().toLowerCase();
  if (!target) return;

  // Clean and normalize input
  if (target.startsWith("mailto:")) {
    target = target.replace(/^mailto:/i, "");
  }
  target = target.replace(/[<>]/g, "");

  // If user entered just a domain without @, e.g. "example.com", prepend @ for clean matching
  if (!target.includes("@") && target.includes(".") && !target.startsWith("@")) {
    target = "@" + target;
  }

  const cleanDomain = target.includes("@") ? target.split("@")[1] : target.replace(/^@/, "");

  let score = 0;
  if (verdict === "safe") score = 0;
  else if (verdict === "promo_clutter") score = 25;
  else if (verdict === "suspicious") score = 55;
  else if (verdict === "high_risk") score = 88;

  getStorage(["ratiod_sender_learning", "ratiod_user_overrides"], (res) => {
    const learning = res.ratiod_sender_learning || {};
    const overrides = res.ratiod_user_overrides || {};

    const record = {
      sender: target,
      domain: cleanDomain,
      verdict: verdict,
      score: score,
      feedback: verdict,
      userExplicit: true,
      updatedAt: Date.now()
    };

    learning[target] = record;
    overrides[target] = {
      verdict: verdict,
      score: score,
      feedback: verdict,
      sender: target,
      domain: cleanDomain,
      timestamp: Date.now()
    };
    overrides["sender:" + target] = overrides[target];

    setStorage({
      ratiod_sender_learning: learning,
      ratiod_user_overrides: overrides
    }, () => {
      loadAndRenderSenderRules();
    });
  });
}

function deleteSenderRule(ruleKey) {
  const target = String(ruleKey || "").trim().toLowerCase();
  if (!target) return;

  getStorage(["ratiod_sender_learning", "ratiod_user_overrides"], (res) => {
    const learning = res.ratiod_sender_learning || {};
    const overrides = res.ratiod_user_overrides || {};

    delete learning[target];
    delete overrides[target];
    delete overrides["sender:" + target];

    setStorage({
      ratiod_sender_learning: learning,
      ratiod_user_overrides: overrides
    }, () => {
      loadAndRenderSenderRules();
    });
  });
}

function clearAllSenderRules() {
  setStorage({
    ratiod_sender_learning: {},
    ratiod_user_overrides: {}
  }, () => {
    loadAndRenderSenderRules();
  });
}

// ---------------------------------------------------------------------------
// Inbox Quick Triage Filter Controller
// ---------------------------------------------------------------------------
function updateActiveTriageFilterBtn(filter) {
  if (typeof document === "undefined") return;
  const buttons = document.querySelectorAll(".triage-btn, .show-all-btn");
  buttons.forEach(btn => {
    if (btn.getAttribute("data-filter") === filter) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

function syncActiveTabTriage() {
  try {
    if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs || !tabs[0] || !tabs[0].id) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: "ratiod_get_inbox_triage_counts" }, (res) => {
          if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.lastError) return;
          if (!res || !res.counts) return;
          const c = res.counts;

          if (c.total > 0) {
            const elTotal = document.getElementById("val-total");
            if (elTotal) elTotal.textContent = c.total.toLocaleString();
            const elSub = document.getElementById("hero-subtext");
            if (elSub) elSub.textContent = `${c.safe} safe · ${c.promo} promo · ${c.suspicious + c.high_risk} flagged threats`;
          }

          const elSafe = document.getElementById("val-safe");
          if (elSafe && c.safe !== undefined) elSafe.textContent = c.safe.toLocaleString();
          const elPromo = document.getElementById("val-promo");
          if (elPromo && c.promo !== undefined) elPromo.textContent = c.promo.toLocaleString();
          const elSusp = document.getElementById("val-suspicious");
          if (elSusp && c.suspicious !== undefined) elSusp.textContent = c.suspicious.toLocaleString();
          const elRisk = document.getElementById("val-high_risk");
          if (elRisk && c.high_risk !== undefined) elRisk.textContent = c.high_risk.toLocaleString();

          const elAll = document.getElementById("triage-cnt-all");
          if (elAll && c.total !== undefined) elAll.textContent = c.total.toLocaleString();

          // Update multi-segment progress bar based on live counts
          const barSafe = document.getElementById("bar-safe");
          const barPromo = document.getElementById("bar-promo");
          const barSusp = document.getElementById("bar-suspicious");
          const barHigh = document.getElementById("bar-high_risk");
          if (c.total > 0) {
            if (barSafe) barSafe.style.width = `${(c.safe / c.total) * 100}%`;
            if (barPromo) barPromo.style.width = `${(c.promo / c.total) * 100}%`;
            if (barSusp) barSusp.style.width = `${(c.suspicious / c.total) * 100}%`;
            if (barHigh) barHigh.style.width = `${(c.high_risk / c.total) * 100}%`;
          }

          if (res.activeFilter) {
            updateActiveTriageFilterBtn(res.activeFilter);
          }
        });
      });
    }
  } catch (e) {}
}

function initTriageFilterButtons() {
  if (typeof document === "undefined") return;
  const buttons = document.querySelectorAll(".triage-btn, .show-all-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const filter = btn.getAttribute("data-filter");
      updateActiveTriageFilterBtn(filter);
      try {
        if (typeof chrome !== "undefined" && chrome.tabs && chrome.tabs.query) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || !tabs[0] || !tabs[0].id) return;
            chrome.tabs.sendMessage(tabs[0].id, { action: "ratiod_filter_inbox", filter: filter });
          });
        }
      } catch (e) {}
    });
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------
function initPopup() {
  initTabs();
  initTriageFilterButtons();
  syncActiveTabTriage();

  // Load telemetry stats
  getStorage(["ratiod_stats"], (res) => {
    renderStats(res.ratiod_stats);
  });

  // Load sender rules
  loadAndRenderSenderRules();

  // Search filter listener
  const searchInput = document.getElementById("sender-search-input");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentSearchQuery = e.target.value;
      renderSenderList(cachedSenderRules, currentSearchQuery);
    });
  }

  // Add rule listener
  const btnAdd = document.getElementById("btn-add-rule");
  const inputAddress = document.getElementById("new-sender-address");
  const selectVerdict = document.getElementById("new-sender-verdict");

  if (btnAdd && inputAddress && selectVerdict) {
    btnAdd.addEventListener("click", () => {
      const val = inputAddress.value;
      const verdict = selectVerdict.value;
      if (val && val.trim().length > 2) {
        addSenderRule(val, verdict);
        inputAddress.value = "";
      }
    });

    inputAddress.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const val = inputAddress.value;
        const verdict = selectVerdict.value;
        if (val && val.trim().length > 2) {
          addSenderRule(val, verdict);
          inputAddress.value = "";
        }
      }
    });
  }

  // Clear all rules listener
  const btnClearRules = document.getElementById("btn-clear-rules");
  if (btnClearRules) {
    btnClearRules.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all learned senders and custom whitelist rules?")) {
        clearAllSenderRules();
      }
    });
  }

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
      setStorage({ ratiod_stats: emptyStats }, () => {
        renderStats(emptyStats);
      });
    });
  }

  // Live storage change listener
  try {
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === "local") {
          if (changes.ratiod_stats) {
            renderStats(changes.ratiod_stats.newValue);
          }
          if (changes.ratiod_sender_learning || changes.ratiod_user_overrides) {
            loadAndRenderSenderRules();
          }
        }
      });
    }
  } catch (e) {}
}

if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", initPopup);
}

// Export helpers for testing
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    renderStats,
    formatVerdictLabel,
    formatRelativeTime,
    addSenderRule,
    deleteSenderRule,
    clearAllSenderRules
  };
}
