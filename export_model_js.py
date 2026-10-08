import json
import joblib
import numpy as np

# Load trained model artifact
artifact = joblib.load("models/sentiment_model.joblib")
vec = artifact["vectorizer"]
clf = artifact["classifier"]

vocab = vec.vocabulary_ # dict of term -> index
idf = vec.idf_ # array of idf values
coef = clf.coef_[0] # array of weights
intercept = float(clf.intercept_[0])

classes = list(clf.classes_)
print(f"Classes: {classes}")
print(f"Vocabulary size: {len(vocab)}")
print(f"Intercept: {intercept}")

# Build export dictionary
# Each feature: { term: { "idf": float, "weight": float } }
features = {}
for term, idx in vocab.items():
    features[term] = {
        "idf": round(float(idf[idx]), 6),
        "weight": round(float(coef[idx]), 6)
    }

with open("models/model_metadata.json", "r", encoding="utf-8") as f:
    metadata = json.load(f)

model_export = {
    "algorithm": "TfidfVectorizer + LinearSVC",
    "classes": classes,
    "intercept": round(intercept, 6),
    "features": features,
    "metadata": metadata
}

with open("models/model_web.json", "w", encoding="utf-8") as f:
    json.dump(model_export, f, ensure_ascii=False, indent=2)

print(f"Exported model_web.json successfully. Total features: {len(features)}")
