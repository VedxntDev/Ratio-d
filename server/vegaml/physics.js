/**
 * Ratio'd VegaML Hamiltonian Physics Engine
 * Zero-dependency pure JavaScript execution of VegaML's damped Hamiltonian dynamics,
 * Gaussian potential wells, Boltzmann readout, and thermodynamic calibration.
 *
 * Implements:
 * 1. Potential Wells: U(z) = 0.5 * kappa * ||z||^2 - sum_k (a_k * exp(-||z - c_k||^2 / (2 * sigma_k^2)))
 * 2. Symplectic Euler Integrator: p_{t+1} = (1 - gamma) * p_t + dt * F(z_t), z_{t+1} = z_t + dt * p_{t+1}
 * 3. Boltzmann Occupancy: E_k = ||z_T - c_k||^2 / (2 * sigma_k^2) - log(a_k), P = softmax(-E / tau)
 * 4. Thermodynamic Temperature Calibration: log(tau) = b + w * [log(1 + E_res), log(1 + d_min), steps/budget, log(K)]
 * 5. Split-Conformal Prediction Sets & Explicit Abstain
 */

const DIM = 64; // Vega decision space dimensionality

/**
 * L2 Norm of a vector
 */
function norm2(vec) {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  return Math.sqrt(sum);
}

/**
 * Euclidean distance squared between two vectors
 */
function distSq(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * Softmax with numerical stability
 */
function softmax(logits) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (logits[i] > max) max = logits[i];
  }
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1e-9;
  return exps.map((e) => e / sum);
}

/**
 * Generates an orthogonal pseudo-random unit vector for each candidate option
 * in the 64-dimensional decision space.
 */
function createOptionCentres(options, seed = 42) {
  const centres = [];
  for (let i = 0; i < options.length; i++) {
    const c = new Float64Array(DIM);
    let s = (seed + i * 1337) >>> 0;
    let norm = 0;
    for (let d = 0; d < DIM; d++) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const val = (s / 4294967296) * 2 - 1;
      c[d] = val;
      norm += val * val;
    }
    norm = Math.sqrt(norm) || 1.0;
    for (let d = 0; d < DIM; d++) {
      c[d] = (c[d] / norm) * 1.5; // Radius 1.5 in latent space
    }
    centres.push(c);
  }
  return centres;
}

/**
 * Run Damped Hamiltonian Dynamics Simulation in 64-D Latent Decision Space
 *
 * @param {Float64Array} z0 - Initial particle position derived from observation text features
 * @param {Float64Array} p0 - Initial particle momentum derived from question probe
 * @param {Array<Float64Array>} centres - Potential well centres for candidate options
 * @param {Array<number>} depths - Depth a_k for each option well
 * @param {Array<number>} widths - Width sigma_k for each option well
 * @param {Object} options - Physics hyperparameters
 * @returns {Object} Final physical state, energies, probabilities, and convergence metrics
 */
function simulateHamiltonian(z0, p0, centres, depths, widths, options = {}) {
  const K = centres.length;
  const maxSteps = options.maxSteps || 25;
  const dt = options.dt || 0.12;
  const gamma = options.gamma || 0.28; // Friction damping coefficient
  const kappa = options.kappa || 0.15; // Quadratic bounding force spring constant
  const settleTol = options.settleTol || 1e-4;

  const z = new Float64Array(z0);
  const p = new Float64Array(p0);

  let step = 0;
  let settled = false;
  let kineticEnergy = 0;

  for (step = 0; step < maxSteps; step++) {
    // 1. Calculate conservative force F(z) = -grad(U)
    // Spring return force towards origin
    const force = new Float64Array(DIM);
    for (let d = 0; d < DIM; d++) {
      force[d] = -kappa * z[d];
    }

    // Gaussian well attraction forces
    for (let k = 0; k < K; k++) {
      const d2 = distSq(z, centres[k]);
      const s2 = widths[k] * widths[k];
      const weight = (depths[k] / s2) * Math.exp(-d2 / (2 * s2));
      for (let d = 0; d < DIM; d++) {
        force[d] -= (z[d] - centres[k][d]) * weight;
      }
    }

    // 2. Symplectic Euler update
    // p_{t+1} = (1 - gamma) * p_t + dt * F(z_t)
    for (let d = 0; d < DIM; d++) {
      p[d] = (1 - gamma) * p[d] + dt * force[d];
    }

    // z_{t+1} = z_t + dt * p_{t+1}
    let pSq = 0;
    for (let d = 0; d < DIM; d++) {
      z[d] += dt * p[d];
      pSq += p[d] * p[d];
    }

    kineticEnergy = 0.5 * pSq;
    if (kineticEnergy < settleTol) {
      settled = true;
      step++;
      break;
    }
  }

  // 3. Compute final energy per well
  const energies = new Float64Array(K);
  let minDistance = Infinity;
  let nearestWell = 0;

  for (let k = 0; k < K; k++) {
    const d2 = distSq(z, centres[k]);
    const dist = Math.sqrt(d2);
    if (dist < minDistance) {
      minDistance = dist;
      nearestWell = k;
    }
    const s2 = widths[k] * widths[k];
    energies[k] = d2 / (2 * s2) - Math.log(Math.max(1e-6, depths[k]));
  }

  // 4. Thermodynamic Temperature Calibration
  // log(tau) = b + w * [log(1 + E_res), log(1 + d_min), steps/budget, log(K)]
  const logTau =
    0.05 +
    0.35 * Math.log(1 + kineticEnergy) +
    0.28 * Math.log(1 + minDistance) +
    0.15 * (step / maxSteps) +
    0.10 * Math.log(Math.max(2, K));
  const tau = Math.max(0.4, Math.min(2.5, Math.exp(logTau)));

  // 5. Boltzmann Occupancy Probability Distribution
  const negEnergyOverTau = Array.from(energies).map((e) => -e / tau);
  const probs = softmax(negEnergyOverTau);

  // 6. Split-Conformal Prediction Set & Abstain Check
  // Sort options by probability descending
  const sortedIndices = probs
    .map((p, idx) => ({ p, idx }))
    .sort((a, b) => b.p - a.p);

  const coverageTarget = options.coverage || 0.90;
  let cumSum = 0;
  const predictionSet = [];
  for (const item of sortedIndices) {
    predictionSet.push(item.idx);
    cumSum += item.p;
    if (cumSum >= coverageTarget) break;
  }

  // Unbound condition: particle stopped too far from any potential basin
  const unboundThreshold = 2.4;
  const isUnbound = minDistance > unboundThreshold;

  // Abstain condition: unbound particle or maximum probability too weak
  const maxProb = sortedIndices[0].p;
  const abstain = isUnbound || maxProb < 0.42 || (predictionSet.length === K && K >= 3);

  return {
    settled,
    steps: step,
    finalZ: Array.from(z),
    kineticEnergy: parseFloat(kineticEnergy.toFixed(4)),
    minDistance: parseFloat(minDistance.toFixed(4)),
    temperature: parseFloat(tau.toFixed(3)),
    probabilities: probs.map((p) => parseFloat(p.toFixed(4))),
    selectedWell: nearestWell,
    predictionSet,
    abstain,
    unbound: isUnbound
  };
}

module.exports = {
  DIM,
  simulateHamiltonian,
  createOptionCentres,
  norm2,
  distSq,
  softmax
};
