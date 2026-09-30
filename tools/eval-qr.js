"use strict";
/* node tools/eval-qr.js --benign tranco.csv --phish openphish.txt [--n 2000]
   benign: Tranco CSV "rank,domain"; phish: one URL per line (OpenPhish / PhishTank / URLhaus urls).
   Prints confusion matrix + first misses. Put the numbers in the README, not adjectives. */
const fs = require("fs");
const { analyzeQr } = require("../server/rules/qr");
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg("n", 2000);
const lines = f => fs.readFileSync(f, "utf8").split(/\r?\n/).filter(Boolean);
const sample = (a, n) => a.sort(() => Math.random() - 0.5).slice(0, n);
const benign = sample(lines(arg("benign")).map(l => l.split(",").pop().trim()).filter(d => /\./.test(d)).map(d => "https://" + d + "/"), N);
const phish = sample(lines(arg("phish")).filter(l => /^https?:\/\//i.test(l)), N);
let TP = 0, FN = 0, TN = 0, FP = 0; const fn = [], fp = [];
for (const u of phish) { const r = analyzeQr(u); if (r.verdict !== "safe") TP++; else { FN++; fn.length < 15 && fn.push(u); } }
for (const u of benign) { const r = analyzeQr(u); if (r.verdict === "safe") TN++; else { FP++; fp.length < 15 && fp.push([u, r.flags.map(f => f.reason).join("; ")]); } }
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) : "n/a") + "%";
console.log({ TP, FN, TN, FP, recall: pct(TP, TP + FN), precision: pct(TP, TP + FP), specificity: pct(TN, TN + FP) });
console.log("\nfalse negatives:\n" + fn.join("\n")); console.log("\nfalse positives:"); fp.forEach(x => console.log(x[0], "<-", x[1]));
