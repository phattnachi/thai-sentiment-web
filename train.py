"""
Standalone script to train the Thai Sentiment Analysis model and save artifacts.
Usage:
    python train.py
"""
import os
import sys
import json
from app.model import train_and_save_model, MODEL_PATH, METRICS_PATH, DEFAULT_DATA_FILE

def main():
    print("=" * 60)
    print("Thai Sentiment Analysis - Model Training Pipeline")
    print("=" * 60)
    
    if not os.path.exists(DEFAULT_DATA_FILE):
        print(f"[Error] Dataset file not found: {DEFAULT_DATA_FILE}")
        sys.exit(1)
        
    print(f"[1/4] Loading and cleaning dataset from '{DEFAULT_DATA_FILE}'...")
    print("[2/4] Preprocessing with pythainlp (engine='newmm') and custom negation stop words...")
    print("[3/4] Fitting TfidfVectorizer (ngram_range=(1, 2)) & LinearSVC(C=1.0)...")
    
    metrics = train_and_save_model()
    
    print("[4/4] Model training completed successfully!")
    print(f"      - Saved model artifact: {MODEL_PATH}")
    print(f"      - Saved metadata: {METRICS_PATH}")
    print("-" * 60)
    print(f"Accuracy:  {metrics['accuracy']}%")
    print(f"Precision: {metrics['precision']}%")
    print(f"Recall:    {metrics['recall']}%")
    print(f"F1-Score:  {metrics['f1_score']}%")
    print(f"Total Clean Samples: {metrics['total_samples']} (Train: {metrics['train_samples']}, Test: {metrics['test_samples']})")
    print(f"Vocabulary Size:     {metrics['vocabulary_size']} features")
    print(f"Confusion Matrix:")
    print(f"  [TN: {metrics['confusion_matrix'][0][0]}, FP: {metrics['confusion_matrix'][0][1]}]")
    print(f"  [FN: {metrics['confusion_matrix'][1][0]}, TP: {metrics['confusion_matrix'][1][1]}]")
    print("=" * 60)

if __name__ == "__main__":
    main()
