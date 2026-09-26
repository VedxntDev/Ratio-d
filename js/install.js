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

  /* ---------- promo bar (dismissible, remembered) ---------- */
  var PROMO_KEY = "ratiod.promo.dismissed";
  var promoBar = document.getElementById("promo-bar");
  var promoClose = document.getElementById("promo-close");

  if (promoBar) {
    var dismissed = false;
    try {
      dismissed = window.localStorage.getItem(PROMO_KEY) === "1";
    } catch (e) {
      dismissed = false;
    }

    if (!dismissed) promoBar.hidden = false;

    if (promoClose) {
      promoClose.addEventListener("click", function () {
        promoBar.hidden = true;
        try {
          window.localStorage.setItem(PROMO_KEY, "1");
        } catch (e) {
          /* nothing to do - it will simply reappear next visit */
        }
      });
    }
  }

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
