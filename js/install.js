/**
 * Ratio'd — Extension promo bar
 *
 * Lives in its own IIFE, deliberately independent of the install-steps
 * controller below. That controller bails out early when the #isteps markup is
 * absent; when the promo bar shared that function, any change to the install
 * section could silently take the promo bar down with it.
 *
 * The dismissal key is versioned. An unversioned key ("ratiod.promo.dismissed")
 * is a one-way door: once written it can never be invalidated by a code change,
 * so a promo that needs to come back is unreachable without asking every
 * visitor to open devtools. Bumping the suffix re-opens the bar for everyone
 * who dismissed an earlier revision, and the "Show extension promo" control in
 * the footer gives anyone who dismisses this one a visible way back.
 */
(function () {
  "use strict";

  var PROMO_KEY = "ratiod.promo.dismissed.v2";
  var LEGACY_PROMO_KEYS = ["ratiod.promo.dismissed", "ratiod.promo.dismissed.v1"];
  var promoBar = document.getElementById("promo-bar");
  var promoClose = document.getElementById("promo-close");
  var promoRestore = document.getElementById("promo-restore");

  if (!promoBar) return;

  function read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      /* storage disabled - the bar simply reappears next visit */
    }
  }

  function clear(keys) {
    try {
      for (var i = 0; i < keys.length; i++) window.localStorage.removeItem(keys[i]);
    } catch (e) {
      /* nothing to do */
    }
  }

  /* Retire superseded keys so they cannot accumulate or resurrect later. */
  clear(LEGACY_PROMO_KEYS);

  var dismissed = read(PROMO_KEY) === "1";
  promoBar.hidden = dismissed;

  if (promoRestore) {
    promoRestore.hidden = !dismissed;
    promoRestore.addEventListener("click", function () {
      clear([PROMO_KEY]);
      promoBar.hidden = false;
      promoRestore.hidden = true;
      promoBar.scrollIntoView({ block: "nearest" });
      var close = document.getElementById("promo-close");
      if (close) close.focus();
    });
  }

  if (promoClose) {
    promoClose.addEventListener("click", function () {
      promoBar.hidden = true;
      write(PROMO_KEY, "1");
      if (promoRestore) promoRestore.hidden = false;
    });
  }
})();

/**
 * Ratio'd — Store-version notice dialog
 *
 * The Chrome Web Store listing is published by hand and takes days to clear a
 * review, so for a while after a release the Store serves a build that is
 * behind the ZIP on this site. This dialog says so once and steers people to
 * the ZIP.
 *
 * It is a notice, not a gate. The Store link stays in the dialog, the backdrop
 * is dismissible by click, Escape and the close button, and the dismissal is
 * versioned for the same reason the promo key is: an unversioned key is a
 * one-way door, so a notice that needs to return becomes unreachable without
 * asking people to open devtools. "Show install notice" in the footer is the
 * way back.
 *
 * Modal behaviour is implemented here rather than using <dialog> because the
 * rest of the page is styled by hand and showModal() brings a UA stylesheet
 * that fights it. The focus trap, Escape handling and scroll lock are all
 * explicit below.
 */
(function () {
  "use strict";

  var KEY = "ratiod.store.notice.dismissed.v1";
  var modal = document.getElementById("store-notice");
  if (!modal) return;

  var closeBtn = document.getElementById("store-notice-close");
  var dismissBtn = document.getElementById("store-notice-dismiss");
  var downloadLink = document.getElementById("store-notice-dl");
  var storeLink = document.getElementById("store-notice-store");
  var restore = document.getElementById("store-notice-restore");
  var lastFocused = null;

  function read(key) {
    try { return window.localStorage.getItem(key); } catch (e) { return null; }
  }
  function write(key, value) {
    /* Storage can be disabled entirely; the notice then shows every visit,
       which is the safe failure direction for a message worth reading. */
    try { window.localStorage.setItem(key, value); } catch (e) {}
  }
  function clear(key) {
    try { window.localStorage.removeItem(key); } catch (e) {}
  }

  function focusables() {
    return Array.prototype.slice
      .call(modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null; });
  }

  function open() {
    lastFocused = document.activeElement;
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    var f = focusables();
    (f[0] || closeBtn || modal).focus();
  }

  function close() {
    modal.hidden = true;
    document.body.style.overflow = "";
    /* Return focus where it was, so a keyboard user is not dropped at the top
       of the document. Falls back to the restore control if it is visible. */
    if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    else if (restore && !restore.hidden) restore.focus();
  }

  /* The "×" is a plain close for this visit only: someone who taps it may just
     not want to read it right now, and permanently suppressing it would be
     presumptuous. Only the explicit "Don't show this again" records a
     dismissal, and so does acting on either link - a choice is a choice. */
  if (closeBtn) closeBtn.addEventListener("click", close);

  if (dismissBtn) {
    dismissBtn.addEventListener("click", function () {
      write(KEY, "1");
      close();
      if (restore) restore.hidden = false;
    });
  }

  [downloadLink, storeLink].forEach(function (el) {
    if (el) el.addEventListener("click", function () { write(KEY, "1"); });
  });

  /* Click the backdrop, not the card. */
  modal.addEventListener("mousedown", function (e) {
    if (e.target === modal) close();
  });

  document.addEventListener("keydown", function (e) {
    if (modal.hidden) return;

    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }

    /* Focus trap: Tab from the last control wraps to the first, and Shift+Tab
       from the first wraps to the last. Without this a keyboard user tabs
       straight out of the dialog into the page behind it. */
    if (e.key !== "Tab") return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  var dismissed = read(KEY) === "1";
  if (restore) restore.hidden = !dismissed;

  if (restore) {
    restore.addEventListener("click", function () {
      clear(KEY);
      if (restore) restore.hidden = true;
      open();
    });
  }

  /* Auto-open disabled: notice is suppressed so visitors are not interrupted by a popup */
  if (false && !dismissed) {
    window.setTimeout(open, 900);
  }
})();

/**
 * Ratio'd — Extension install flow
 *
 * Interactive, dependency-free, and resilient: progress is persisted so a
 * user who leaves mid-way through comes back to their place, and every
 * storage / clipboard failure degrades silently instead of breaking the page.
 */

(function () {
  "use strict";

  var STORAGE_KEY = "ratiod.install.steps";
  var steps = Array.prototype.slice.call(
    document.querySelectorAll('#isteps input[type="checkbox"][data-step]')
  );
  if (!steps.length) return;

  var progressFill = document.getElementById("progress-fill");
  var progressText = document.getElementById("progress-text");
  var resetBtn = document.getElementById("reset-steps");

  /* ---------- persistence (never throws) ---------- */
  function load() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }
  function save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* private mode / storage disabled - progress simply will not persist */
    }
  }

  var state = load();

  /* ---------- progress ---------- */
  function render() {
    var done = 0;
    steps.forEach(function (input) {
      var key = input.getAttribute("data-step");
      var checked = Boolean(state[key]);
      input.checked = checked;
      var row = input.closest(".istep");
      if (row) row.classList.toggle("is-done", checked);
      if (checked) done++;
    });

    var total = steps.length;
    if (progressFill) progressFill.style.width = (done / total) * 100 + "%";
    if (progressText) {
      progressText.textContent =
        done === total ? "All done — enjoy!" : done + " of " + total + " done";
    }
  }

  steps.forEach(function (input) {
    input.addEventListener("change", function () {
      state[input.getAttribute("data-step")] = input.checked;
      save(state);
      render();
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      state = {};
      save(state);
      render();
    });
  }

  /* The promo bar is handled by its own IIFE at the top of this file, so that
     the early return above (no #isteps markup) can never suppress it. */

  /* The floating entry point to the install section is the mascot button
     (#mascot-fab). It is CSS-visible from first paint, so there is nothing to
     set up here: the old .dl-fab needed a JS class to become visible, and it
     has been replaced. */

  /* ---------- copy to clipboard ---------- */
  function flash(button, message) {
    var original = button.getAttribute("data-label") || button.textContent;
    button.setAttribute("data-label", original);
    button.textContent = message;
    button.disabled = true;
    window.setTimeout(function () {
      button.textContent = original;
      button.disabled = false;
    }, 1600);
  }

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-copy]"),
    function (button) {
      button.addEventListener("click", function () {
        var value = button.getAttribute("data-copy");

        function fallback() {
          // execCommand path for browsers/contexts without the async clipboard API
          var ta = document.createElement("textarea");
          ta.value = value;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          var ok = false;
          try {
            ok = document.execCommand("copy");
          } catch (e) {
            ok = false;
          }
          document.body.removeChild(ta);
          flash(button, ok ? "Copied" : "Press " + navigator.platform + "+C");
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(value).then(
            function () {
              flash(button, "Copied");
            },
            fallback
          );
        } else {
          fallback();
        }
      });
    }
  );

  /* ---------- download feedback ---------- */
  var dlBtn = document.getElementById("dl-btn");
  if (dlBtn) {
    dlBtn.addEventListener("click", function () {
      // Only nudge on same-origin downloads; the browser handles the rest.
      window.setTimeout(function () {
        var stepOne = document.querySelector('#isteps input[data-step="1"]');
        if (stepOne && !stepOne.checked) {
          stepOne.checked = true;
          state["1"] = true;
          save(state);
          render();
        }
      }, 400);
    });
  }

  render();
})();
