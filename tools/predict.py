"""
Ratio'd Command-Line Predictor
Analyzes an email text or file using the trained Laya ML model.
Usage:
    python tools/predict.py --file <path-to-email.txt>
    python tools/predict.py "Urgent! Your account has been suspended..."
"""
import os
import sys
import json
import argparse
from eval_model import simulate_js_inference

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_JSON_PATH = os.path.join(ROOT, "server", "laya", "trained_model.json")

def analyze_text(text):
    if not os.path.exists(MODEL_JSON_PATH):
        print(f"Error: Model file {MODEL_JSON_PATH} not found.")
        sys.exit(1)
        
    with open(MODEL_JSON_PATH, "r", encoding="utf-8") as f:
        model_json = json.load(f)
        
    prob = simulate_js_inference(text, model_json)
    
    if prob >= 0.65:
        verdict = "HIGH_RISK"
        color = "RED"
    elif prob >= 0.35:
        verdict = "SUSPICIOUS"
        color = "YELLOW"
    else:
        verdict = "SAFE"
        color = "GREEN"
        
    return {
        "verdict": verdict,
        "threat_probability": prob,
        "score": int(round(prob * 100)),
        "source": "laya_trained_v1"
    }

def main():
    parser = argparse.ArgumentParser(description="Ratio'd Laya ML Predictor")
    parser.add_argument("text", nargs="?", default="", help="Raw text to analyze")
    parser.add_argument("--file", "-f", help="Path to text or email file to analyze")
    
    args = parser.parse_args()
    
    if args.file:
        with open(args.file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    elif args.text:
        content = args.text
    else:
        parser.print_help()
        sys.exit(1)
        
    res = analyze_text(content)
    print("\n" + "=" * 45)
    print(f"  VERDICT     : {res['verdict']}")
    print(f"  PROBABILITY : {res['threat_probability'] * 100:.1f}% (Score: {res['score']}/100)")
    print(f"  ENGINE      : {res['source']}")
    print("=" * 45 + "\n")

if __name__ == "__main__":
    main()