/**
 * Ratio'd VegaML Physics Engine & Typed-Decision Verification Suite
 * Validates Hamiltonian dynamics, Boltzmann occupancies, temperature calibration,
 * split-conformal prediction sets, explicit abstain handling, and API integration.
 */
const { simulateHamiltonian, createOptionCentres, softmax, norm2 } = require("./vegaml/physics");
const { STRUCTURAL_SIGNALS, VEGA_QUESTIONS, projectObservationToPhysics } = require("./vegaml/taxonomy");
const { evaluateVegaModel } = require("./vegaml/client");
const { combineScore } = require("./combine/score");
const { handleAnalyze } = require("./routes/analyze");

let failures = 0;
function assert(name, condition, detail = "") {
  if (condition) {
    console.log(`PASS  ${name}${detail ? " -> " + detail : ""}`);
  } else {
    console.error(`FAIL  ${name}${detail ? " -> " + detail : ""}`);
    failures++;
  }
}

async function runVegaMLTests() {
  console.log("=== 1. Hamiltonian Dynamics Physics Simulation ===");
  const options = Object.keys(VEGA_QUESTIONS.threat_category.criteria);
  const centres = createOptionCentres(options, 777);
  assert("Centres are 64-dimensional", centres.length === options.length && centres[0].length === 64);
  assert("Centres are normalized to radius 1.5", Math.abs(norm2(centres[0]) - 1.5) < 1e-4);

  // Particle in well 0 with small perturbation
  const z0 = new Float64Array(centres[0]);
  const p0 = new Float64Array(64);
  const depths = options.map((_, i) => (i === 0 ? 2.5 : 0.2));
  const widths = options.map(() => 0.85);

  const sim = simulateHamiltonian(z0, p0, centres, depths, widths, { maxSteps: 25, dt: 0.12, gamma: 0.28 });
  assert("Simulation completes within step budget", sim.steps <= 25 && sim.steps > 0, `${sim.steps} steps`);
  assert("Selected well matches deepest basin", sim.selectedWell === 0, `selected well ${sim.selectedWell}`);
  assert("Kinetic energy settles cleanly", sim.kineticEnergy <= 0.05, `kinetic ${sim.kineticEnergy}`);
  assert("Calibrated temperature is physically bounded", sim.temperature >= 0.4 && sim.temperature <= 2.5, `tau=${sim.temperature}`);
  assert("Boltzmann probabilities sum to ~1.0", Math.abs(sim.probabilities.reduce((a, b) => a + b, 0) - 1.0) < 1e-3);

  console.log("\n=== 2. Conformal Prediction Sets & Honest Abstain ===");
  // Particle placed far from all centres (out of distribution)
  const zFar = new Float64Array(64).fill(4.5);
  const pFar = new Float64Array(64).fill(0.1);
  const flatDepths = options.map(() => 0.1);
  const simFar = simulateHamiltonian(zFar, pFar, centres, flatDepths, widths, { maxSteps: 25 });
  assert("Out-of-distribution input triggers unbound state", simFar.unbound === true, `d_min=${simFar.minDistance}`);
  assert("Unbound state forces honest abstain flag", simFar.abstain === true);

  console.log("\n=== 3. End-to-End Typed Threat Evaluations ===");
  // Severe credential phishing
  const phishText = "URGENT: Your Microsoft account will be suspended. Verify now at http://m1crosoft-support.com/login.";
  const phishRes = await evaluateVegaModel(phishText, [{ span: "m1crosoft-support.com", reason: "Homoglyph brand impersonation" }]);
  assert("Phishing detected with high risk or suspicious", phishRes.label === "high_risk" || phishRes.label === "suspicious");
  assert("Phishing probability calibrated in range [0.65, 0.99]", phishRes.probability >= 0.65 && phishRes.probability <= 0.99, `p=${phishRes.probability}`);
  assert("Source identifies as vegaml_physics_engine", phishRes.source === "vegaml_physics_engine");
  assert("Conformal set exists and is non-empty", phishRes.conformal_set.length > 0, `[${phishRes.conformal_set.join(", ")}]`);

  // Benign newsletter
  const benignText = "This week in tech: five links worth reading. From hello@substack.com. Unsubscribe anytime.";
  const benignRes = await evaluateVegaModel(benignText, []);
  assert("Benign newsletter classified as safe", benignRes.label === "safe" || benignRes.label === "promo_clutter", `label=${benignRes.label}`);
  assert("Benign probability remains low", benignRes.probability <= 0.35, `p=${benignRes.probability}`);
  assert("Conformal set includes safe", benignRes.conformal_set.includes("safe"));

  console.log("\n=== 4. Score Combiner Safety with VegaML Abstain & Conformal Sets ===");
  // Case A: Model unbound / out of distribution -> defer 100% to rules
  const abstainingModel = { probability: 0.10, unbound: true, abstain: true, conformal_set: ["safe", "credential_phish"] };
  const combinedAbstain = combineScore(80, abstainingModel, "email", []);
  assert("Combiner defers 100% to rules when model is unbound", combinedAbstain.score === 80, `score=${combinedAbstain.score}`);

  // Case B: Conformal set excludes safe with elevated probability -> floor applied
  const confidentThreatModel = { probability: 0.55, abstain: false, conformal_set: ["credential_phish", "impersonation_spoof"] };
  const combinedConformal = combineScore(20, confidentThreatModel, "email", []);
  assert("Conformal coverage floor prevents diluting threat to safe", combinedConformal.score >= 40, `score=${combinedConformal.score}`);

  console.log("\n=== 5. API Route Telemetry Contract ===");
  const apiRes = await handleAnalyze({ text: phishText, channel: "email" });
  assert("API engine metadata names vegaml", apiRes.engine.model_name === "vegaml");
  assert("API engine includes conformal set", Array.isArray(apiRes.engine.model_conformal_set));
  assert("API engine includes kinetic energy metric", typeof apiRes.engine.model_kinetic_energy === "number");
  assert("API engine includes calibrated temperature", typeof apiRes.engine.model_temperature === "number");
  assert("API engine includes abstain boolean", typeof apiRes.engine.model_abstain === "boolean");

  console.log(failures === 0 ? "\nALL VEGAML CHECKS PASSED ✅" : `\n${failures} VEGAML CHECK(S) FAILED ❌`);
  process.exit(failures === 0 ? 0 : 1);
}

runVegaMLTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
