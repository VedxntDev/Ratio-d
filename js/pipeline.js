/**
 * Ratio'd — Pipeline Stage Controller
 *
 * Drives the four-stage progress indicator. Deliberately dependency-free:
 * no GSAP, so the console works offline and honours reduced-motion
 * without any special-casing.
 */

window.PipelineController = {
  STAGES: 4,

  setStage(index) {
    const cards = document.querySelectorAll(".stage");
    cards.forEach(function (card, i) {
      card.classList.toggle("is-active", i === index);
    });
  },

  complete() {
    document.querySelectorAll(".stage").forEach(function (card) {
      card.classList.add("is-active");
    });
  },

  reset() {
    document.querySelectorAll(".stage").forEach(function (card) {
      card.classList.remove("is-active");
    });
  }
};
