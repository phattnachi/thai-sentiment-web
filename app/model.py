import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional

import numpy as np
import pandas as pd
import joblib

from pythainlp.util import normalize
from pythainlp.tokenize import word_tokenize
from pythainlp.corpus import thai_stopwords

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC
from sklearn.model_selection import train_test_split
from sklearn.metrics import confusion_matrix, accuracy_score, precision_score, recall_score, f1_score

logger = logging.getLogger(__name__)

# Stopwords set preserving negation words to prevent inverted sentiment
THAI_STOPWORDS = set(thai_stopwords())
NEGATION_WORDS = {
    "ไม่", "ไม่ได้", "อย่า", "มิ", "มิได้", "หาไม่", "บ่", "ไร้", "ปราศจาก",
    "ไม่เคย", "ไม่มี", "ไม่ใช่", "ไม่ควร", "ไม่ค่อย", "ไม่อาจ", "มิใช่", "มิควร",
    "อย่าเพิ่ง", "มิอาจ", "ไม่น่า", "ไม่เห็น", "ไม่ดี", "ไม่ชอบ", "แย่", "ห่วย"
}
FILTERED_STOPWORDS = THAI_STOPWORDS - NEGATION_WORDS

# Excel column definitions
NEGATIVE_COLS = [
    "จงเขียนประโยคด่าแบบแรงมาก จนทำให้อีกฝ่ายต้องน้ำตาไหล",
    "จงเขียนประโยคด่าแบบแรงปานกลาง จนทำให้อีกฝ่ายโกรธ",
    "จงเขียนประโยคด่าแบบแรงน้อย ละมุนละม่อมให้อีกฝ่ายรู้ตัว"
]

POSITIVE_COLS = [
    "จงกล่าวชมดีสุด ๆ จนทำให้คนได้รับคำชมตัวลอย",
    "จงกล่าวชมดี จนทำให้มีกำลังใจขึ้น",
    "จงกล่าวชมเล็ก ๆ ให้รู้ว่าทำถูกแล้ว ทำต่อไป"
]

DEFAULT_DATA_FILE = "เก็บข้อมูลเพื่อทำ Sentiment Analysis (Responses).xlsx"
MODEL_DIR = "models"
MODEL_PATH = os.path.join(MODEL_DIR, "sentiment_model.joblib")
METRICS_PATH = os.path.join(MODEL_DIR, "model_metadata.json")


def clean_text_normalization(text: str) -> str:
    """Normalize Thai text, remove noise and collapse multiple spaces."""
    if not isinstance(text, str):
        return ""
    # Thai orthographic normalization
    text = normalize(text)
    # Remove control characters and newlines
    text = re.sub(r'[\r\n\t]+', ' ', text)
    # Remove excessive punctuation repetitions (e.g. !!!!! -> !)
    text = re.sub(r'([!?.~_#@$%^&*()+=/\\-])\1+', r'\1', text)
    # Collapse multiple whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def preprocess_and_tokenize(text: str) -> str:
    """Preprocess and tokenize Thai text, preserving negation words."""
    cleaned = clean_text_normalization(text)
    if not cleaned:
        return ""
    
    # Tokenize with pythainlp newmm engine
    tokens = word_tokenize(cleaned, engine='newmm', keep_whitespace=False)
    
    # Filter stopwords but preserve negation words
    filtered_tokens = [
        t.strip() for t in tokens 
        if t.strip() and (t.strip() not in FILTERED_STOPWORDS or t.strip() in NEGATION_WORDS)
    ]
    return " ".join(filtered_tokens)


def load_dataset_from_excel(excel_path: str = DEFAULT_DATA_FILE) -> pd.DataFrame:
    """Read the Excel file and reshape into 2 classes (Negative and Positive)."""
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Dataset file '{excel_path}' not found.")
    
    df = pd.read_excel(excel_path)
    records = []
    
    for _, row in df.iterrows():
        for col in NEGATIVE_COLS:
            val = row.get(col)
            if pd.notna(val) and str(val).strip():
                records.append({
                    "text": str(val).strip(),
                    "label": "Negative",
                    "sub_category": col
                })
        for col in POSITIVE_COLS:
            val = row.get(col)
            if pd.notna(val) and str(val).strip():
                records.append({
                    "text": str(val).strip(),
                    "label": "Positive",
                    "sub_category": col
                })
                
    data_df = pd.DataFrame(records)
    # Drop duplicates
    data_df = data_df.drop_duplicates(subset=["text"]).reset_index(drop=True)
    return data_df


def train_and_save_model(
    excel_path: str = DEFAULT_DATA_FILE, 
    model_dir: str = MODEL_DIR
) -> Dict[str, Any]:
    """Train TfidfVectorizer + LinearSVC pipeline, compute metrics and persist artifacts."""
    os.makedirs(model_dir, exist_ok=True)
    data_df = load_dataset_from_excel(excel_path)
    
    # Preprocessing
    data_df["processed_text"] = data_df["text"].apply(preprocess_and_tokenize)
    clean_df = data_df[data_df["processed_text"].str.strip() != ""].copy()
    
    X = clean_df["processed_text"]
    y = clean_df["label"]
    
    # Stratified Train/Test split 80/20
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # TfidfVectorizer specification
    vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=2
    )
    X_train_vec = vectorizer.fit_transform(X_train)
    X_test_vec = vectorizer.transform(X_test)
    
    # LinearSVC specification
    classifier = LinearSVC(
        C=1.0,
        loss='squared_hinge',
        penalty='l2',
        random_state=42,
        dual=True
    )
    classifier.fit(X_train_vec, y_train)
    
    # Evaluation
    y_pred = classifier.predict(X_test_vec)
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, pos_label="Positive")
    rec = recall_score(y_test, y_pred, pos_label="Positive")
    f1 = f1_score(y_test, y_pred, pos_label="Positive")
    
    # Confusion matrix: rows = true [Negative, Positive], cols = pred [Negative, Positive]
    cm = confusion_matrix(y_test, y_pred, labels=["Negative", "Positive"]).tolist()
    
    # Train full model on all clean data for maximum deployment performance
    full_vectorizer = TfidfVectorizer(
        ngram_range=(1, 2),
        sublinear_tf=True,
        min_df=2
    )
    X_full_vec = full_vectorizer.fit_transform(X)
    full_classifier = LinearSVC(
        C=1.0,
        loss='squared_hinge',
        penalty='l2',
        random_state=42,
        dual=True
    )
    full_classifier.fit(X_full_vec, y)
    
    # Save model artifact
    model_artifact = {
        "vectorizer": full_vectorizer,
        "classifier": full_classifier,
        "eval_vectorizer": vectorizer,
        "eval_classifier": classifier,
        "classes": list(full_classifier.classes_),
        "created_at": datetime.now().isoformat()
    }
    joblib.dump(model_artifact, MODEL_PATH)
    
    # Save metadata & evaluation metrics
    neg_count = int((clean_df["label"] == "Negative").sum())
    pos_count = int((clean_df["label"] == "Positive").sum())
    
    metadata = {
        "accuracy": round(float(acc) * 100, 2),
        "precision": round(float(prec) * 100, 2),
        "recall": round(float(rec) * 100, 2),
        "f1_score": round(float(f1) * 100, 2),
        "confusion_matrix": cm,
        "labels": ["Negative", "Positive"],
        "total_samples": len(clean_df),
        "class_distribution": {
            "Negative": neg_count,
            "Positive": pos_count
        },
        "train_samples": len(X_train),
        "test_samples": len(X_test),
        "vocabulary_size": len(full_vectorizer.vocabulary_),
        "ngram_range": [1, 2],
        "algorithm": "TfidfVectorizer + LinearSVC",
        "last_trained": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    with open(METRICS_PATH, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)
        
    return metadata


def load_model_and_metadata() -> Dict[str, Any]:
    """Load model artifact and metadata, training automatically if not found."""
    if not os.path.exists(MODEL_PATH) or not os.path.exists(METRICS_PATH):
        logger.info("Model not found. Initiating automatic training...")
        train_and_save_model()
        
    model_artifact = joblib.load(MODEL_PATH)
    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        metadata = json.load(f)
        
    return {
        "artifact": model_artifact,
        "metadata": metadata
    }


def calculate_confidence(decision_val: float) -> Dict[str, Any]:
    """
    Convert LinearSVC decision function distance into a probabilistic confidence score
    using a sigmoid transformation.
    """
    # Sigmoid function for probability
    # If decision_val > 0, pushes towards class index 1 (Positive)
    # If decision_val < 0, pushes towards class index 0 (Negative)
    prob_pos = 1.0 / (1.0 + np.exp(-decision_val))
    prob_neg = 1.0 - prob_pos
    
    sentiment = "Positive" if decision_val >= 0 else "Negative"
    confidence = prob_pos if sentiment == "Positive" else prob_neg
    
    return {
        "sentiment": sentiment,
        "confidence_percentage": round(float(confidence) * 100, 2),
        "decision_score": round(float(decision_val), 4),
        "positive_prob": round(float(prob_pos) * 100, 2),
        "negative_prob": round(float(prob_neg) * 100, 2)
    }


def extract_keywords_importance(
    tokenized_text: str,
    vectorizer: TfidfVectorizer,
    classifier: LinearSVC
) -> List[Dict[str, Any]]:
    """
    Extract the active TF-IDF features and calculate their individual contribution
    to the linear decision boundary (w_i * x_i).
    Positive contribution favors 'Positive', negative favors 'Negative'.
    """
    if not tokenized_text.strip():
        return []
        
    vec = vectorizer.transform([tokenized_text])
    feature_names = vectorizer.get_feature_names_out()
    coefs = classifier.coef_[0]
    
    # Identify positive class index
    # classifier.classes_ is ['Negative', 'Positive']
    pos_idx = list(classifier.classes_).index("Positive")
    sign_multiplier = 1.0 if pos_idx == 1 else -1.0
    
    non_zero_indices = vec.indices
    non_zero_values = vec.data
    
    keyword_contributions = []
    for idx, tfidf_val in zip(non_zero_indices, non_zero_values):
        feat = feature_names[idx]
        weight = coefs[idx] * sign_multiplier
        contribution = weight * tfidf_val
        impact = "Positive" if contribution > 0 else "Negative"
        
        keyword_contributions.append({
            "word": feat,
            "impact": impact,
            "weight": round(float(weight), 4),
            "contribution": round(float(contribution), 4),
            "abs_contribution": round(abs(float(contribution)), 4)
        })
        
    # Sort by absolute contribution descending
    keyword_contributions.sort(key=lambda k: k["abs_contribution"], reverse=True)
    return keyword_contributions[:8]


def predict_single_text(text: str, model_data: Dict[str, Any]) -> Dict[str, Any]:
    """Analyze a single input sentence."""
    raw_text = text.strip() if text else ""
    if not raw_text:
        return {
            "text": "",
            "tokens": [],
            "sentiment": "Neutral",
            "sentiment_th": "เป็นกลาง",
            "confidence": 50.0,
            "decision_score": 0.0,
            "positive_prob": 50.0,
            "negative_prob": 50.0,
            "keywords": []
        }
        
    processed_text = preprocess_and_tokenize(raw_text)
    tokens = [t for t in processed_text.split() if t]
    
    artifact = model_data["artifact"]
    vectorizer: TfidfVectorizer = artifact["vectorizer"]
    classifier: LinearSVC = artifact["classifier"]
    
    # Transform
    vec = vectorizer.transform([processed_text])
    # Decision function
    dec = classifier.decision_function(vec)[0]
    
    # Check if classifier classes are ['Negative', 'Positive']
    classes = list(classifier.classes_)
    if classes[1] == "Positive":
        decision_val = dec
    else:
        decision_val = -dec
        
    conf_data = calculate_confidence(decision_val)
    keywords = extract_keywords_importance(processed_text, vectorizer, classifier)
    
    sentiment_th = "เชิงบวก (Positive)" if conf_data["sentiment"] == "Positive" else "เชิงลบ (Negative)"
    
    return {
        "text": raw_text,
        "processed_text": processed_text,
        "tokens": tokens,
        "sentiment": conf_data["sentiment"],
        "sentiment_th": sentiment_th,
        "confidence": conf_data["confidence_percentage"],
        "decision_score": conf_data["decision_score"],
        "positive_prob": conf_data["positive_prob"],
        "negative_prob": conf_data["negative_prob"],
        "keywords": keywords
    }


def predict_batch_texts(texts: List[str], model_data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Analyze a list of sentences in batch mode."""
    artifact = model_data["artifact"]
    vectorizer: TfidfVectorizer = artifact["vectorizer"]
    classifier: LinearSVC = artifact["classifier"]
    
    processed_list = [preprocess_and_tokenize(t) for t in texts]
    vecs = vectorizer.transform(processed_list)
    decisions = classifier.decision_function(vecs)
    
    results = []
    classes = list(classifier.classes_)
    is_pos_one = (classes[1] == "Positive")
    
    for original, processed, dec in zip(texts, processed_list, decisions):
        dec_val = dec if is_pos_one else -dec
        conf_data = calculate_confidence(dec_val)
        sentiment_th = "เชิงบวก (Positive)" if conf_data["sentiment"] == "Positive" else "เชิงลบ (Negative)"
        
        # Get top 3 keywords
        keywords = extract_keywords_importance(processed, vectorizer, classifier)[:3]
        top_keyword_words = [k["word"] for k in keywords]
        
        results.append({
            "text": original,
            "processed_text": processed,
            "sentiment": conf_data["sentiment"],
            "sentiment_th": sentiment_th,
            "confidence": conf_data["confidence_percentage"],
            "positive_prob": conf_data["positive_prob"],
            "negative_prob": conf_data["negative_prob"],
            "top_keywords": ", ".join(top_keyword_words) if top_keyword_words else "-"
        })
        
    return results
