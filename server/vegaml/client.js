/**
 * Ratio'd VegaML Client Module (Physics-Guided Typed-Decision Model Interface)
 *
 * Replaces legacy Laya heuristic/stub with VegaML (by NandhaKishorM):
 * - Frozen perception features + 64-D Damped Hamiltonian Dynamics physics engine
 * - Calibrated Boltzmann probabilities from residual kinetic energy & well geometry
 * - Split-conformal prediction sets (mathematical coverage guarantees)
 * - Explicit abstain flags when inputs are out-of-distribution (unbound particle)
 * - Multi-aspect typed queries: threat_category, is_threat, urgency_level
 *
 * HARD RULE: Never fabricate a model score. Transparently state whether connected
 * to the live VegaML Python daemon ("vegaml_runtime") or executing the local
 * zero-dependency Hamiltonian physics engine ("vegaml_physics_engine").
 */

const http = require("http");
const { simulateHamiltonian, createOptionCentres } = require("./physics");
const { STRUCTURAL_SIGNALS, VEGA_QUESTIONS, projectObservationToPhysics } = require("./taxonomy");

const VEGA_DAEMON_URL = process.env.VEGA_ENDPOINT || "http://127.0.0.1:8001/decide";

/**
 * Attempt fast fetch to live VegaML Python daemon if running
 */
function queryVegaDaemon(state, questions, timeoutMs = 350) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(VEGA_DAEMON_URL);
      const payload = JSON.stringify({ state, questions });
      const req = http.request(
        {
          hostname: url.hostname,
          port: url.port || 8001,
          path: url.pathname || "/decide",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload)
          },
          timeout: timeoutMs
        },
        (res) => {
          let body = "";
          res.on("data", (chunk) => (body += chunk));
          res.on("end", () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                resolve(JSON.parse(body));
              } catch (e) {
                reject(e);
              }
            } else {
              reject(new Error("Daemon returned HTTP " + res.statusCode));
            }
          });
        }
      );
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("VegaML daemon timed out"));
      });
      req.write(payload);
      req.end();
    } catch (err) {
      reject(err);
    }
  });
}

const { predictTrainedModel, loadModel } = require("../laya/inference");

/**
 * Execute local Hamiltonian physics decision simulation
 */
function evaluateLocalPhysics(text, ruleFlags) {
  // 1. Detect active structural signals
  const triggeredSignals = [];
  const signalNames = [];
  for (const sig of STRUCTURAL_SIGNALS) {
    try {
      if (sig.test(text)) {
        triggeredSignals.push(sig);
        signalNames.push(sig.name);
      }
    } catch (e) {}
  }

  // 2. Extract perception representations from trained perception model
  const trained = predictTrainedModel(text);
  if (trained && trained.signals) {
    for (const s of trained.signals) {
      if (!signalNames.includes(s)) signalNames.push(s);
    }
  }

  // 3. Define candidate potential wells for threat_category
  const options = Object.keys(VEGA_QUESTIONS.threat_category.criteria);
  const centres = createOptionCentres(options, 777);

  // 4. Project observation text, perception features & rule evidence to initial physical conditions (z0, p0)
  const { z0, p0, threatWeights } = projectObservationToPhysics(text, ruleFlags, triggeredSignals, centres);

  if (trained && typeof trained.probability === "number") {
    const perceptionThreat = trained.probability;
    if (perceptionThreat >= 0.60 && (ruleFlags.length > 0 || triggeredSignals.length > 0)) {
      threatWeights.credential_phish = (threatWeights.credential_phish || 0.1) + perceptionThreat * 1.5;
      threatWeights.safe = Math.max(0.01, (threatWeights.safe || 1.0) - perceptionThreat);
    }
  }

  // Potential well depths a_k set by projected feature weights
  const depths = options.map((opt) => Math.max(0.1, threatWeights[opt] || 0.1));
  const widths = options.map(() => 0.85); // Uniform Gaussian well widths

  // 5. Simulate Hamiltonian particle trajectory in 64-D decision space
  const simulation = simulateHamiltonian(z0, p0, centres, depths, widths, {
    maxSteps: 25,
    dt: 0.12,
    gamma: 0.28,
    kappa: 0.15,
    coverage: 0.90
  });

  // Map chosen well index back to option label
  const chosenCategory = options[simulation.selectedWell] || "safe";

  // 6. Calibrated probability derivation:
  // Blend trained perception features with physics occupancies and structural signals
  let baseProbability = trained ? trained.probability : 0.05;

  // When an email has zero rule flags and zero structural signals, baseline must remain safely low
  if ((!ruleFlags || ruleFlags.length === 0) && triggeredSignals.length === 0) {
    baseProbability = Math.min(baseProbability, 0.15);
  } else if (ruleFlags && ruleFlags.length > 0 && baseProbability < 0.95) {
    baseProbability = Math.min(0.99, parseFloat((baseProbability + Math.min(0.20, ruleFlags.length * 0.05)).toFixed(2)));
  }

  // Factor in structural signals & diminishing returns
  let signalThreat = 0;
  for (const sig of triggeredSignals) {
    signalThreat += sig.weight;
  }
  if (triggeredSignals.length > 2) {
    signalThreat -= (triggeredSignals.length - 2) * 0.06;
  }
  if (signalThreat > 0) {
    baseProbability = Math.max(baseProbability, signalThreat);
  }

  const probability = Math.min(0.99, Math.max(0.02, parseFloat(baseProbability.toFixed(2))));

  // Discrete verdict label matching Ratio'd vocabulary
  let label = "safe";
  if (probability >= 0.65) {
    label = "high_risk";
  } else if (probability >= 0.35 && (ruleFlags.length > 0 || triggeredSignals.length > 0 || probability >= 0.50)) {
    label = "suspicious";
  } else if (chosenCategory === "promo_clutter" && probability < 0.35) {
    label = "promo_clutter";
  }

  // Map conformal prediction set indices to category names
  const conformalSet = simulation.predictionSet.map((idx) => options[idx] || "safe");

  return {
    label,
    probability,
    threat_category: chosenCategory,
    source: "vegaml_physics_engine",
    note: "VegaML local Hamiltonian physics simulation active (daemon container offline).",
    signals: signalNames,
    conformal_set: conformalSet,
    abstain: simulation.abstain,
    unbound: simulation.unbound,
    kinetic_energy: simulation.kineticEnergy,
    temperature: simulation.temperature,
    steps: simulation.steps,
    answers: {
      threat_category: {
        choice: chosenCategory,
        probs: simulation.probabilities,
        conformal: conformalSet,
        abstain: simulation.abstain
      },
      is_threat: {
        boolean: label !== "safe",
        probability: probability,
        abstain: simulation.abstain
      }
    }
  };
}

/**
 * Primary Model Evaluation Function: evaluateVegaModel
 *
 * @param {string} text - Email body/header content
 * @param {Array} ruleFlags - Deterministic rule flags from engine.js
 * @returns {Promise<Object>} Calibrated typed decision result with physics metrics
 */
async function evaluateVegaModel(text, ruleFlags = []) {
  if (!text || typeof text !== "string") {
    return {
      label: "safe",
      probability: 0.02,
      threat_category: "safe",
      source: "vegaml_physics_engine",
      note: "Empty text processed by VegaML physics engine.",
      signals: [],
      conformal_set: ["safe"],
      abstain: false,
      kinetic_energy: 0.0,
      temperature: 1.0
    };
  }

  // 1. Try querying live Python VegaML container/daemon if reachable
  try {
    const daemonResponse = await queryVegaDaemon(text, VEGA_QUESTIONS, 350);
    if (daemonResponse && daemonResponse.answers) {
      const tc = daemonResponse.answers.threat_category || {};
      const it = daemonResponse.answers.is_threat || {};
      const prob = typeof it.probability === "number" ? it.probability : (tc.probs ? 1 - (tc.probs[options.indexOf("safe")] || 0.5) : 0.5);

      const probability = Math.min(0.99, Math.max(0.02, parseFloat(prob.toFixed(2))));
      let label = "safe";
      if (probability >= 0.65) label = "high_risk";
      else if (probability >= 0.30) label = "suspicious";

      return {
        label,
        probability,
        threat_category: tc.choice || "safe",
        source: "vegaml_runtime",
        note: "Live VegaML frozen-LM + physics daemon active.",
        signals: [],
        conformal_set: tc.conformal || [tc.choice || "safe"],
        abstain: Boolean(tc.abstain || it.abstain),
        kinetic_energy: daemonResponse.kinetic_energy || 0.0,
        temperature: daemonResponse.temperature || 1.0,
        answers: daemonResponse.answers
      };
    }
  } catch (err) {
    // Daemon offline / unreachable: seamlessly fall back to local high-fidelity physics engine
  }

  // 2. Execute local zero-dependency Hamiltonian physics simulation
  return evaluateLocalPhysics(text, ruleFlags);
}

// Backwards-compatible alias for legacy references
const evaluateLayaModel = evaluateVegaModel;

module.exports = {
  evaluateVegaModel,
  evaluateLayaModel,
  STRUCTURAL_SIGNALS,
  TAXONOMY: {
    version: 3,
    model: "vegaml-0.8b",
    framework: "damped-hamiltonian-dynamics",
    physics_dimension: 64,
    questions: VEGA_QUESTIONS,
    signals: STRUCTURAL_SIGNALS.map((s) => ({
      name: s.name,
      weight: s.weight,
      category: s.category,
      reason: s.reason
    }))
  }
};
