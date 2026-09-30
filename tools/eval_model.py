"""
Ratio'd Laya Model Evaluator
Validates model performance across all corpora and verifies mathematical parity
between Python scikit-learn predictions and the exported JSON model weights.
"""
import os
import re
import json
import math
import numpy as np
import joblib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_DIR = os.path.join(ROOT, "server", "fixtures")
LAYA_DIR = os.path.join(ROOT, "server", "laya")

from train_laya_model import parse_corpus_file, extract_features, STRUCTURAL_RULES, ADVERSARIAL_BENIGN

def simulate_js_inference(text, model_json, record=None):
    """Simulates server/laya/inference.js in Python to verify exact parity."""
    vocabulary = model_json["vocabulary"]
    idf = model_json["idf"]
    text_coefs = model_json["text_coefficients"]
    struct_coefs = model_json["structural_coefficients"]
    intercept = model_json["intercept"]

    token_regex = re.compile(r"(?u)\b[a-zA-Z0-9_.%-]{2,}\b")
    raw_tokens = token_regex.findall(text.lower())
    
    counts = {}
    for i in range(len(raw_tokens)):
        u = raw_tokens[i]
        counts[u] = counts.get(u, 0) + 1
        if i < len(raw_tokens) - 1:
            bg = u + " " + raw_tokens[i + 1]
            counts[bg] = counts.get(bg, 0) + 1

    sum_sq = 0.0
    entries = []
    for term, count in counts.items():
        if term in vocabulary:
            idx = vocabulary[term]
            term_idf = idf[idx]
            sublinear_tf = 1 + math.log(count)
            val = sublinear_tf * term_idf
            entries.append((idx, val))
            sum_sq += val * val

    norm = math.sqrt(sum_sq) if sum_sq > 0 else 1.0
    z = intercept
    for idx, val in entries:
        norm_val = val / norm
        z += norm_val * text_coefs[idx]

    # Structural rules
    rec = record or {}
    for r in STRUCTURAL_RULES:
        name = r["name"]
        if r["func"](text, rec):
            if name in struct_coefs:
                z += struct_coefs[name]

    prob = 1.0 / (1.0 + math.exp(-z))
    return min(0.99, max(0.02, round(prob, 2)))

def main():
    print("=" * 70)
    print("RATIO'D LAYA MODEL EVALUATION & PARITY VERIFICATION")
    print("=" * 70)

    json_path = os.path.join(LAYA_DIR, "trained_model.json")
    joblib_path = os.path.join(LAYA_DIR, "trained_model.joblib")

    if not os.path.exists(json_path) or not os.path.exists(joblib_path):
        print("Model files not found. Run tools/train_laya_model.py first.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        model_json = json.load(f)

    saved = joblib.load(joblib_path)
    vectorizer = saved["vectorizer"]
    clf = saved["classifier"]

    # Datasets to evaluate
    datasets = [
        ("User Ingested Emails (14 datasets)", parse_corpus_file(os.path.join(FIXTURES_DIR, "new-emails-corpus.txt"))),
        ("Corpus A - Scam Corpus (20 scams)", parse_corpus_file(os.path.join(FIXTURES_DIR, "scam-corpus.txt"))),
        ("Corpus B - Real-World Mixed (11 mixed)", parse_corpus_file(os.path.join(FIXTURES_DIR, "real-world-mixed.txt"))),
        ("Baseline Legitimate / Ham (15 ham)", ADVERSARIAL_BENIGN)
    ]

    total_samples = 0
    total_correct = 0
    max_parity_diff = 0.0

    for name, records in datasets:
        print(f"\n--- Evaluating {name} ({len(records)} samples) ---")
        texts, y, struct_feat = extract_features(records)
        X_text = vectorizer.transform(texts).toarray()
        X = np.hstack([X_text, struct_feat])
        
        py_probs = clf.predict_proba(X)[:, 1]
        
        correct = 0
        for i, r in enumerate(records):
            expected_label = r["label"].lower()
            expected_binary = 1 if expected_label in ["scam", "phishing"] else 0
            
            p_prob = py_probs[i]
            js_prob = simulate_js_inference(texts[i], model_json, r)
            
            diff = abs(p_prob - js_prob)
            if diff > max_parity_diff:
                max_parity_diff = diff
                
            pred_binary = 1 if js_prob >= 0.50 else 0
            pred_label = "scam" if pred_binary == 1 else "legitimate"
            
            is_correct = (pred_binary == expected_binary)
            if is_correct:
                correct += 1
                
            status = "PASS" if is_correct else "FAIL"
            subj = re.sub(r"[^\x20-\x7E]", "", r.get('subject', ''))[:35]
            print(f"  [{status}] {r['id']} | Prob: {js_prob*100:5.1f}% (Py: {p_prob*100:5.1f}%) | Exp: {expected_label:<10} | Pred: {pred_label:<10} | {subj}")
            
        print(f"Section Accuracy: {correct}/{len(records)} ({correct/len(records)*100:.1f}%)")
        total_samples += len(records)
        total_correct += correct

    print("\n" + "=" * 70)
    print(f"OVERALL PERFORMANCE ACROSS ALL DATASETS:")
    print(f"  Total Evaluated : {total_samples}")
    print(f"  Correct Verdicts: {total_correct} ({total_correct / total_samples * 100:.1f}%)")
    print(f"  Python <-> JS Parity Max Delta: {max_parity_diff:.4f}")
    print("=" * 70)

if __name__ == "__main__":
    main()