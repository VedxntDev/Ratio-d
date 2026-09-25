/**
 * Ratio'd GSAP Live Pipeline & Score Gauge Animation Controller
 */

window.PipelineController = {
  animatePipeline(stageIndex = 0, onCompleteCallback) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = document.querySelectorAll(".pipeline-card");

    cards.forEach((card, idx) => {
      if (idx === stageIndex) {
        card.classList.add("active-stage");
      } else {
        card.classList.remove("active-stage");
      }
    });

    if (prefersReducedMotion || typeof gsap === "undefined") {
      if (stageIndex === 3 && onCompleteCallback) onCompleteCallback();
      return;
    }

    // Step-by-step sequential pulse if GSAP is available
    if (cards[stageIndex]) {
      gsap.fromTo(cards[stageIndex], 
        { scale: 0.98 }, 
        { scale: 1.02, duration: 0.25, yoyo: true, repeat: 1, ease: "sine.inOut", onComplete: () => {
          if (stageIndex === 3 && onCompleteCallback) {
            onCompleteCallback();
          }
        }}
      );
    }
  },

  animateGaugeArc(targetScore, verdict) {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gaugeArc = document.getElementById("gauge-arc");
    const numDisplay = document.getElementById("score-num");

    if (!gaugeArc || !numDisplay) return;

    // Arc math: Circle circumference = 2 * PI * r = 2 * 3.14159 * 36 = 226.19
    const circumference = 226.19;
    const fillPercent = targetScore / 100;
    const dashOffset = circumference * (1 - fillPercent);

    let arcColor = "#EA3E2B"; // High risk primary
    if (verdict === "suspicious") arcColor = "#E8720C";
    if (verdict === "safe") arcColor = "#8A8B5C"; // Muted olive

    gaugeArc.setAttribute("stroke", arcColor);

    // Retrigger the cartoon "pop" on the verdict card each reveal
    const verdictBox = document.querySelector(".verdict-box");
    if (verdictBox && targetScore > 0) {
      verdictBox.classList.remove("pop");
      void verdictBox.offsetWidth;
      verdictBox.classList.add("pop");
    }

    if (prefersReducedMotion || typeof gsap === "undefined") {
      gaugeArc.style.strokeDashoffset = dashOffset;
      numDisplay.textContent = targetScore;
      return;
    }

    // Elastic spring reveal for the score dial
    gsap.to(gaugeArc, {
      strokeDashoffset: dashOffset,
      duration: 1.2,
      ease: "back.out(1.7)"
    });

    // Count up number animation
    const obj = { val: 0 };
    gsap.to(obj, {
      val: targetScore,
      duration: 1.0,
      ease: "power2.out",
      onUpdate: () => {
        numDisplay.textContent = Math.round(obj.val);
      }
    });
  }
};
