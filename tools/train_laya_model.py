"""
Ratio'd Laya Model Trainer
Trains an authentic machine learning classifier (TF-IDF + Logistic Regression)
with full architectural alignment to Ratio'd's structural signals.
"""
import os
import re
import json
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_validate
from sklearn.metrics import classification_report
import joblib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURES_DIR = os.path.join(ROOT, "server", "fixtures")
LAYA_DIR = os.path.join(ROOT, "server", "laya")

def parse_corpus_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return []
    with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    
    blocks = re.split(r"\n-{20,}\n", content)
    records = []
    for b in blocks:
        b = b.strip()
        if not re.search(r"^ID:\s*(SCAM|HAM)-\d+", b, re.M):
            continue
        
        def get_field(name):
            m = re.search(rf"^{name}:[ \t]*(.*)$", b, re.M)
            return m.group(1).strip() if m else ""
            
        body_idx = b.find("BODY:")
        body = ""
        if body_idx != -1:
            body = b[body_idx + 5:].strip()
            
        records.append({
            "id": get_field("ID"),
            "label": get_field("LABEL"),
            "subject": get_field("SUBJECT"),
            "from": get_field("FROM"),
            "reply_to": get_field("REPLY-TO"),
            "date": get_field("DATE"),
            "body": body
        })
    return records

ADVERSARIAL_BENIGN = [
    {
        "id": "BENIGN-001",
        "label": "legitimate",
        "subject": "Your Netflix subscription ends on May 24",
        "from": "Netflix <info@mail.netflix.com>",
        "reply_to": "",
        "body": "Your Netflix subscription ends on May 24, 2026. Renew to keep watching. Netflix International B.V. All rights reserved."
    },
    {
        "id": "BENIGN-002",
        "label": "legitimate",
        "subject": "Your weekly Grab digest",
        "from": "Grab <news@grab.com>",
        "reply_to": "",
        "body": "Hi, here is what happened on Grab this week. Copyright 2024 by Grab SG. All Rights Reserved."
    },
    {
        "id": "BENIGN-003",
        "label": "legitimate",
        "subject": "Notice of Assessment",
        "from": "IRAS <noreply@iras.gov.sg>",
        "reply_to": "",
        "body": "Your tax assessment for the year is ready. Log in to IRAS to view it. Inland Revenue Authority of Singapore"
    },
    {
        "id": "BENIGN-004",
        "label": "legitimate",
        "subject": "Candidate details form",
        "from": "Talent <talent@greenhouse.io>",
        "reply_to": "",
        "body": "Please complete: Your Full Names: / Your Country: / Cell/Telephone Number: Use the link in your invitation to submit."
    },
    {
        "id": "BENIGN-005",
        "label": "legitimate",
        "subject": "Your order #1234 has shipped",
        "from": "Shopify Orders <orders@shopify.com>",
        "reply_to": "",
        "body": "Your order #1234 has shipped and arrives Friday. Track your shipment at https://shopify.com/orders"
    },
    {
        "id": "BENIGN-006",
        "label": "legitimate",
        "subject": "Your GitHub verification code",
        "from": "GitHub <no-reply@github.com>",
        "reply_to": "",
        "body": "Your verification code is 123456. Do not share this code with anyone. GitHub, Inc. 88 Colin P Kelly Jr St, San Francisco, CA"
    },
    {
        "id": "BENIGN-007",
        "label": "legitimate",
        "subject": "This week in tech: five links worth reading",
        "from": "Substack Weekly <hello@substack.com>",
        "reply_to": "",
        "body": "Welcome to our weekly newsletter! Here are 5 curated deep-dives into distributed systems, AI, and compilers. Unsubscribe at any time."
    },
    {
        "id": "BENIGN-008",
        "label": "legitimate",
        "subject": "Security alert for your linked Google Account",
        "from": "Google <no-reply@accounts.google.com>",
        "reply_to": "",
        "body": "A new sign-in was detected on Windows in Singapore. If this was you, you don't need to do anything. If not, check your account activity at https://myaccount.google.com/notifications"
    },
    {
        "id": "BENIGN-009",
        "label": "legitimate",
        "subject": "Your monthly Bank of America statement is available",
        "from": "Bank of America <onlinebanking@ealerts.bankofamerica.com>",
        "reply_to": "",
        "body": "Your e-statement for statement period ending September 2026 is ready to view. Sign in securely to Online Banking at https://www.bankofamerica.com to review your statement."
    },
    {
        "id": "BENIGN-010",
        "label": "legitimate",
        "subject": "Pull Request #42: Fix authentication race condition",
        "from": "GitHub Notifications <notifications@github.com>",
        "reply_to": "",
        "body": "VedxntDev requested your review on Pull Request #42. View it on GitHub: https://github.com/VedxntDev/Ratio-d/pull/42. Reply to this email directly or view it on GitHub."
    },
    {
        "id": "BENIGN-011",
        "label": "legitimate",
        "subject": "Your ride with Uber on Friday evening",
        "from": "Uber Receipts <uber.singapore@uber.com>",
        "reply_to": "",
        "body": "Thanks for riding with Uber! Total: 16.50 SGD. Pickup: Orchard Road, Destination: Marina Bay. View your receipt or report an item left behind at https://help.uber.com"
    },
    {
        "id": "BENIGN-012",
        "label": "legitimate",
        "subject": "Meeting Invitation: Engineering Sync @ 2:00 PM",
        "from": "Team Calendar <calendar-notification@google.com>",
        "reply_to": "",
        "body": "Engineering Sync has been scheduled for Wednesday, Oct 1, 2026 from 2:00 PM to 2:30 PM. Join Zoom Meeting: https://zoom.us/j/9876543210. Organiser: Engineering Lead."
    },
    {
        "id": "BENIGN-013",
        "label": "legitimate",
        "subject": "Your Spotify Premium receipt",
        "from": "Spotify <no-reply@spotify.com>",
        "reply_to": "",
        "body": "Your payment of $9.99 for Spotify Premium has succeeded. Terms and conditions apply. Manage your subscription at https://www.spotify.com/account"
    },
    {
        "id": "BENIGN-014",
        "label": "legitimate",
        "subject": "AWS Billing Notification: Free Tier Limit",
        "from": "Amazon Web Services <no-reply-aws@amazon.com>",
        "reply_to": "",
        "body": "Your AWS account 123456789 has reached 85% of your usage limit for Amazon EC2 under the AWS Free Tier. You can view your current usage in the AWS Billing Console."
    },
    {
        "id": "BENIGN-015",
        "label": "legitimate",
        "subject": "Weekly Singapore FinTech Newsletter",
        "from": "FinTech SG <newsletter@fintech.sg>",
        "reply_to": "",
        "body": "Discover the latest news in payment innovation and regulatory updates in Singapore. Organized in collaboration with industry partners. To unsubscribe, click here."
    }
]

# Standard Structural Rules (Matching Ratio'd STRUCTURAL_SIGNALS + new domain abuse signals)
STRUCTURAL_RULES = [
    {
        "name": "punycode_host",
        "weight": 0.34,
        "func": lambda text, r: bool(re.search(r"https?://[^\s/]*xn--", text, re.I))
    },
    {
        "name": "ip_literal_link",
        "weight": 0.34,
        "func": lambda text, r: bool(re.search(r"https?://\d{1,3}(?:\.\d{1,3}){3}", text))
    },
    {
        "name": "data_uri",
        "weight": 0.30,
        "func": lambda text, r: bool(re.search(r"data:(text/html|application/javascript|;base64)", text, re.I))
    },
    {
        "name": "base64_blob",
        "weight": 0.24,
        "func": lambda text, r: bool(re.search(r"[A-Za-z0-9+/]{120,}={0,2}", text))
    },
    {
        "name": "credential_or_wire",
        "weight": 0.20,
        "func": lambda text, r: (
            bool(re.search(r"(verify|confirm|update|validate|secure)\s+(your\s+)?(account|password|credentials|details|information)", text, re.I))
            or bool(re.search(r"(gift\s?card|bitcoin|crypto|wire\s+transfer|western\s+union|money\s+gram)", text, re.I))
        )
    },
    {
        "name": "link_farm",
        "weight": 0.18,
        "func": lambda text, r: len(set(re.findall(r"https?://([^\s/?#]+)", text, re.I))) >= 5
    },
    {
        "name": "free_abuse_hosting",
        "weight": 0.40,
        "func": lambda text, r: bool(re.search(r"unicornplatform\.page|firebaseapp\.com|amazonaws\.com/cld|\.xrea\.com|fanlink\.to|kazmatix\.com", text, re.I))
    },
    {
        "name": "reply_to_mismatch",
        "weight": 0.40,
        "func": lambda text, r: (
            bool(r.get("reply_to")) and
            bool(re.search(r"@([a-zA-Z0-9.-]+)", r.get("from", ""))) and
            bool(re.search(r"@([a-zA-Z0-9.-]+)", r.get("reply_to", ""))) and
            re.search(r"@([a-zA-Z0-9.-]+)", r.get("from", "")).group(1).lower() !=
            re.search(r"@([a-zA-Z0-9.-]+)", r.get("reply_to", "")).group(1).lower()
        )
    },
    {
        "name": "urgent_pressure",
        "weight": 0.30,
        "func": lambda text, r: bool(re.search(r"\b(within\s+\d+\s*(hours?|days?)|72h|24\s*hours|immediately|suspended|storage\s+is\s+almost\s+full|action\s+required|expire\s+in\s+\d+\s*days?)\b", text, re.I))
    },
    {
        "name": "payout_or_fee_bait",
        "weight": 0.35,
        "func": lambda text, r: bool(re.search(r"(\b\d+(\.\d+)?\s*(million|usd|sgd|euros)\b|\$\s*\d+,\d+|\b(disbursement|compensation\s+fund|grant\s+support|delivery\s+fees?|refund\s+processing|cashback)\b)", text, re.I))
    }
]

def extract_features(records):
    texts = []
    labels = []
    structural_matrix = []
    
    for r in records:
        full_text = f"Subject: {r['subject']}\nFrom: {r['from']}\nReply-To: {r.get('reply_to', '')}\n{r['body']}"
        texts.append(full_text)
        is_scam = 1 if r["label"].lower() in ["scam", "phishing", "threat"] else 0
        labels.append(is_scam)
        
        row = []
        for rule in STRUCTURAL_RULES:
            row.append(1.0 if rule["func"](full_text, r) else 0.0)
        structural_matrix.append(row)
        
    return texts, np.array(labels), np.array(structural_matrix)

def main():
    print("=" * 65)
    print("RATIO'D MACHINE LEARNING MODEL TRAINER (Laya ML v1)")
    print("=" * 65)
    
    scam_corpus = parse_corpus_file(os.path.join(FIXTURES_DIR, "scam-corpus.txt"))
    mixed_corpus = parse_corpus_file(os.path.join(FIXTURES_DIR, "real-world-mixed.txt"))
    new_corpus = parse_corpus_file(os.path.join(FIXTURES_DIR, "new-emails-corpus.txt"))
    
    all_records = scam_corpus + mixed_corpus + new_corpus + ADVERSARIAL_BENIGN
    scam_count = sum(1 for r in all_records if r["label"].lower() in ["scam", "phishing"])
    ham_count = sum(1 for r in all_records if r["label"].lower() in ["legitimate", "ham"])
    
    print(f"Total Dataset Size: {len(all_records)} samples (Scams: {scam_count}, Ham: {ham_count})")
    
    texts, y, struct_feat = extract_features(all_records)
    
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        min_df=1,
        max_features=800,
        sublinear_tf=True,
        token_pattern=r"(?u)\b[a-zA-Z0-9_.%-]{2,}\b"
    )
    X_text = vectorizer.fit_transform(texts).toarray()
    X = np.hstack([X_text, struct_feat])
    
    print(f"Features: {X.shape[1]} ({X_text.shape[1]} n-grams + {struct_feat.shape[1]} structural)")
    
    clf = LogisticRegression(C=2.0, class_weight="balanced", max_iter=1000, random_state=42)
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
    
    cv_results = cross_validate(
        clf, X, y, cv=skf,
        scoring=["accuracy", "precision", "recall", "f1", "roc_auc"]
    )
    
    print("-" * 50)
    print(f"CV Accuracy  : {np.mean(cv_results['test_accuracy']) * 100:.2f}%")
    print(f"CV Precision : {np.mean(cv_results['test_precision']) * 100:.2f}%")
    print(f"CV Recall    : {np.mean(cv_results['test_recall']) * 100:.2f}%")
    print(f"CV F1 Score  : {np.mean(cv_results['test_f1']):.4f}")
    print(f"CV ROC-AUC   : {np.mean(cv_results['test_roc_auc']):.4f}")
    print("-" * 50)
    
    clf.fit(X, y)
    train_preds = clf.predict(X)
    print(classification_report(y, train_preds, target_names=["Legitimate", "Scam"], digits=4))
    
    coefs = clf.coef_[0]
    
    # Export to JSON
    os.makedirs(LAYA_DIR, exist_ok=True)
    json_path = os.path.join(LAYA_DIR, "trained_model.json")
    joblib_path = os.path.join(LAYA_DIR, "trained_model.joblib")
    
    export_data = {
        "version": "1.0.0",
        "algorithm": "tfidf_logistic_regression",
        "intercept": float(clf.intercept_[0]),
        "vocabulary": {k: int(v) for k, v in vectorizer.vocabulary_.items()},
        "idf": [float(val) for val in vectorizer.idf_],
        "text_coefficients": [float(c) for c in coefs[:X_text.shape[1]]],
        "structural_coefficients": {
            s["name"]: float(coefs[X_text.shape[1] + j])
            for j, s in enumerate(STRUCTURAL_RULES)
        },
        "structural_rules": [
            {"name": s["name"], "weight": s["weight"]}
            for s in STRUCTURAL_RULES
        ],
        "thresholds": {
            "high_risk": 0.65,
            "suspicious": 0.35
        },
        "metrics": {
            "cv_accuracy": float(np.mean(cv_results['test_accuracy'])),
            "cv_f1": float(np.mean(cv_results['test_f1'])),
            "cv_roc_auc": float(np.mean(cv_results['test_roc_auc']))
        }
    }
    
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(export_data, f, indent=2)
    print(f"Exported JSON model to: {json_path}")
    
    joblib.dump({"vectorizer": vectorizer, "classifier": clf, "structural_names": [s["name"] for s in STRUCTURAL_RULES]}, joblib_path)
    print(f"Exported Joblib to: {joblib_path}")

if __name__ == "__main__":
    main()