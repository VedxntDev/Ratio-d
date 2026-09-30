/**
 * Ratio'd Laya Trained Model Inference Engine
 * Zero-dependency, pure JavaScript execution of the trained TF-IDF + Logistic Regression model.
 */
const fs = require("fs");
const path = require("path");

let modelData = null;

function loadModel() {
  if (modelData) return modelData;
  const modelPath = path.join(__dirname, "trained_model.json");
  if (fs.existsSync(modelPath)) {
    try {
      modelData = JSON.parse(fs.readFileSync(modelPath, "utf8"));
    } catch (e) {
      modelData = null;
    }
  }
  return modelData;
}

const STRUCTURAL_TESTS = {
  punycode_host: (t) => /https?:\/\/[^\s/]*xn--/i.test(t),
  ip_literal_link: (t) => /https?:\/\/\d{1,3}(?:\.\d{1,3}){3}/.test(t),
  data_uri: (t) => /data:(text\/html|application\/javascript|;base64)/i.test(t),
  base64_blob: (t) => /[A-Za-z0-9+/]{120,}={0,2}/.test(t),
  credential_or_wire: (t) =>
    /(verify|confirm|update|validate|secure)\s+(your\s+)?(account|password|credentials|details|information)/i.test(t)
    || /(gift\s?card|bitcoin|crypto|wire\s+transfer|western\s+union|money\s+gram)/i.test(t),
  link_farm: (t) => {
    const hosts = new Set((t.match(/https?:\/\/([^\s/?#]+)/gi) || [])
      .map((u) => u.replace(/^https?:\/\//i, "").toLowerCase()));
    return hosts.size >= 5;
  },
  free_abuse_hosting: (t) => /unicornplatform\.page|firebaseapp\.com|amazonaws\.com\/cld|\.xrea\.com|fanlink\.to|kazmatix\.com/i.test(t),
  reply_to_mismatch: (t) => {
    const fromMatch = t.match(/^From:[ \t]*.*?@([a-zA-Z0-9.-]+)/im);
    const replyMatch = t.match(/^Reply-To:[ \t]*.*?@([a-zA-Z0-9.-]+)/im);
    if (fromMatch && replyMatch) {
      return fromMatch[1].toLowerCase() !== replyMatch[1].toLowerCase();
    }
    return false;
  },
  urgent_pressure: (t) => /\b(within\s+\d+\s*(hours?|days?)|72h|24\s*hours|immediately|suspended|storage\s+is\s+almost\s+full|action\s+required|expire\s+in\s+\d+\s*days?)\b/i.test(t),
  payout_or_fee_bait: (t) => /(\b\d+(\.\d+)?\s*(million|usd|sgd|euros)\b|\$\s*\d+,\d+|\b(disbursement|compensation\s+fund|grant\s+support|delivery\s+fees?|refund\s+processing|cashback)\b)/i.test(t)
};

/**
 * Predict scam probability using the trained model weights.
 */
function predictTrainedModel(text) {
  const model = loadModel();
  if (!model) return null;

  if (!text || typeof text !== "string") {
    return {
      label: "safe",
      probability: 0.02,
      source: "laya_trained_v1",
      note: "Empty text processed by trained Laya ML model.",
      signals: []
    };
  }

  const { vocabulary, idf, text_coefficients, structural_coefficients, intercept } = model;

  // 1. Tokenize text into words
  const tokenRegex = /[a-zA-Z0-9_.%-]{2,}/g;
  const rawTokens = (text.toLowerCase().match(tokenRegex) || []);
  
  // Count unigrams and bigrams
  const counts = {};
  for (let i = 0; i < rawTokens.length; i++) {
    const unigram = rawTokens[i];
    counts[unigram] = (counts[unigram] || 0) + 1;
    if (i < rawTokens.length - 1) {
      const bigram = unigram + " " + rawTokens[i + 1];
      counts[bigram] = (counts[bigram] || 0) + 1;
    }
  }

  // 2. Compute sublinear TF-IDF vector
  let sumSq = 0;
  const tfidfEntries = [];
  for (const [term, count] of Object.entries(counts)) {
    if (Object.prototype.hasOwnProperty.call(vocabulary, term)) {
      const idx = vocabulary[term];
      const termIdf = idf[idx];
      const sublinearTf = 1 + Math.log(count);
      const val = sublinearTf * termIdf;
      tfidfEntries.push({ idx, val, term });
      sumSq += val * val;
    }
  }

  // 3. L2 Normalize TF-IDF and compute text dot product
  const norm = Math.sqrt(sumSq) || 1.0;
  let z = intercept;
  const activeFeatures = [];

  for (const entry of tfidfEntries) {
    const normalizedVal = entry.val / norm;
    const weight = text_coefficients[entry.idx];
    const contribution = normalizedVal * weight;
    z += contribution;
    if (Math.abs(contribution) > 0.05) {
      activeFeatures.push({ feature: entry.term, contribution });
    }
  }

  // 4. Compute structural signal contributions
  const signals = [];
  for (const [name, testFn] of Object.entries(STRUCTURAL_TESTS)) {
    try {
      if (testFn(text)) {
        signals.push(name);
        if (structural_coefficients && structural_coefficients[name] !== undefined) {
          const sWeight = structural_coefficients[name];
          z += sWeight;
          activeFeatures.push({ feature: name, contribution: sWeight });
        }
      }
    } catch (e) {
      // safe ignore regex error
    }
  }

  // 5. Sigmoid activation
  const prob = 1 / (1 + Math.exp(-z));
  const probability = Math.min(0.99, Math.max(0.02, parseFloat(prob.toFixed(2))));

  // 6. Label assignment
  let label = "safe";
  if (probability >= 0.65) {
    label = "high_risk";
  } else if (probability >= 0.35) {
    label = "suspicious";
  }

  return {
    label,
    probability,
    source: "laya_trained_v1",
    note: "Trained TF-IDF + Logistic Regression model active.",
    signals,
    active_features: activeFeatures.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10)
  };
}

module.exports = {
  loadModel,
  predictTrainedModel,
  STRUCTURAL_TESTS
};