import os
import io
import logging
from typing import List, Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel, Field
import pandas as pd

from app.model import (
    load_model_and_metadata,
    predict_single_text,
    predict_batch_texts,
    train_and_save_model,
    load_custom_vocab,
    add_custom_word,
    delete_custom_word,
    clear_all_custom_words,
    DEFAULT_DATA_FILE
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("sentiment-app")

app = FastAPI(
    title="Thai Sentiment Analysis API",
    description="API for Thai Sentiment Analysis with Active Learning & Custom Vocabulary (v1.2)",
    version="1.2.0"
)

# CORS middleware for modern frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model state cache
model_state = None


@app.on_event("startup")
async def startup_event():
    global model_state
    try:
        logger.info("Initializing Thai Sentiment Analysis Model...")
        model_state = load_model_and_metadata()
        logger.info("Model loaded successfully. Ready to serve requests.")
    except Exception as e:
        logger.error(f"Failed to load model on startup: {e}")


# Pydantic Schemas
class PredictRequest(BaseModel):
    text: str = Field(..., description="Thai sentence or customer review", min_length=1)

class BatchPredictRequest(BaseModel):
    texts: List[str] = Field(..., description="List of Thai sentences")

class TeachWordRequest(BaseModel):
    word: str = Field(..., description="Thai word or phrase to teach", min_length=1)
    sentiment: str = Field(..., description="Sentiment polarity: Positive or Negative")
    weight: Optional[float] = Field(2.0, description="Confidence impact weight (default: 2.0)")
    is_sentence: Optional[bool] = Field(False, description="Whether this is a full sentence specification")


@app.get("/api/health")
async def health_check():
    """Health status and model readiness check."""
    global model_state
    if model_state is None:
        try:
            model_state = load_model_and_metadata()
        except Exception:
            pass

    is_ready = model_state is not None
    metadata = model_state.get("metadata", {}) if is_ready else {}
    custom_vocab = load_custom_vocab()
    
    return {
        "status": "ready" if is_ready else "initializing",
        "ready": is_ready,
        "model_name": "LinearSVC + TF-IDF (PyThaiNLP)",
        "version": "1.2.0",
        "last_trained": metadata.get("last_trained", "N/A"),
        "total_samples": metadata.get("total_samples", 0),
        "accuracy": metadata.get("accuracy", 0.0),
        "custom_words_count": len(custom_vocab)
    }


# Custom Vocabulary & Active Learning Endpoints (v1.2)
@app.get("/api/custom-words")
async def get_custom_words():
    """Retrieve all user-taught words in the custom vocabulary."""
    vocab = load_custom_vocab()
    words_list = list(vocab.values())
    pos_count = sum(1 for w in words_list if w.get("sentiment") == "Positive")
    neg_count = sum(1 for w in words_list if w.get("sentiment") == "Negative")
    return {
        "total": len(words_list),
        "positive_count": pos_count,
        "negative_count": neg_count,
        "words": vocab
    }


@app.post("/api/custom-words")
@app.post("/api/teach")
async def teach_word_endpoint(payload: TeachWordRequest):
    """Teach a word to the system, specifying whether it is Positive or Negative."""
    global model_state
    if model_state is None:
        model_state = load_model_and_metadata()
    try:
        updated = add_custom_word(
            payload.word, 
            payload.sentiment, 
            payload.weight or 2.0, 
            model_state, 
            is_sentence=payload.is_sentence or False
        )
        if not updated.get("saved", True):
            return {
                "success": False,
                "already_known": True,
                "message": updated.get("message", f"คำว่า '{payload.word}' มีอยู่ในพจนานุกรมของโมเดลอยู่แล้ว ไม่จำเป็นต้องบันทึก"),
                "data": updated
            }
        return {
            "success": True,
            "message": f"บันทึกคำว่า '{payload.word}' เป็น {updated['sentiment_th']} เรียบร้อยแล้ว",
            "data": updated
        }
    except Exception as e:
        logger.error(f"Error teaching word: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@app.delete("/api/custom-words/{word}")
async def delete_custom_word_endpoint(word: str):
    """Delete a learned word from custom vocabulary."""
    success = delete_custom_word(word)
    if not success:
        raise HTTPException(status_code=404, detail=f"ไม่พบคำว่า '{word}' ในคลังคำศัพท์ที่สอน")
    return {
        "success": True,
        "message": f"ลบคำว่า '{word}' ออกจากคลังคำศัพท์เรียบร้อยแล้ว"
    }


@app.delete("/api/custom-words")
async def clear_all_custom_words_endpoint():
    """Clear all taught custom words."""
    clear_all_custom_words()
    return {
        "success": True,
        "message": "ล้างคลังคำศัพท์ที่สอนระบบทั้งหมดเรียบร้อยแล้ว"
    }


@app.get("/api/metrics")
async def get_metrics():
    """Get model performance metrics and confusion matrix."""
    global model_state
    if model_state is None:
        model_state = load_model_and_metadata()
        
    metadata = model_state.get("metadata")
    if not metadata:
        raise HTTPException(status_code=500, detail="Metrics not available")
        
    return metadata


@app.post("/api/predict")
async def predict_sentiment(payload: PredictRequest):
    """Analyze sentiment for a single Thai sentence."""
    global model_state
    if model_state is None:
        model_state = load_model_and_metadata()
        
    try:
        result = predict_single_text(payload.text, model_state)
        return result
    except Exception as e:
        logger.error(f"Prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


@app.post("/api/batch-predict")
async def batch_predict(payload: BatchPredictRequest):
    """Analyze sentiment for multiple sentences in batch."""
    global model_state
    if model_state is None:
        model_state = load_model_and_metadata()
        
    cleaned_texts = [t.strip() for t in payload.texts if t and t.strip()]
    if not cleaned_texts:
        return {"total": 0, "results": [], "summary": {"positive": 0, "negative": 0}}
        
    results = predict_batch_texts(cleaned_texts, model_state)
    pos_count = sum(1 for r in results if r["sentiment"] == "Positive")
    neg_count = sum(1 for r in results if r["sentiment"] == "Negative")
    total = len(results)
    
    return {
        "total": total,
        "results": results,
        "summary": {
            "positive_count": pos_count,
            "negative_count": neg_count,
            "positive_rate": round((pos_count / total * 100), 2) if total else 0,
            "negative_rate": round((neg_count / total * 100), 2) if total else 0,
        }
    }


@app.post("/api/upload-batch")
async def upload_batch_file(file: UploadFile = File(...)):
    """Upload CSV or Excel file to analyze multiple comments."""
    global model_state
    if model_state is None:
        model_state = load_model_and_metadata()
        
    filename = file.filename.lower()
    contents = await file.read()
    
    try:
        if filename.endswith(".csv"):
            try:
                df = pd.read_csv(io.BytesIO(contents), encoding="utf-8")
            except UnicodeDecodeError:
                df = pd.read_csv(io.BytesIO(contents), encoding="cp874")
        elif filename.endswith((".xlsx", ".xls")):
            df = pd.read_excel(io.BytesIO(contents))
        else:
            raise HTTPException(status_code=400, detail="รองรับเฉพาะไฟล์ .csv หรือ .xlsx เท่านั้น")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ไม่สามารถอ่านไฟล์ได้: {str(e)}")
        
    # Auto-detect text column
    target_col = None
    possible_names = ["text", "comment", "ข้อความ", "รีวิว", "ความคิดเห็น", "ประโยค", "review", "detail", "content"]
    
    for c in df.columns:
        if str(c).strip().lower() in possible_names:
            target_col = c
            break
            
    if not target_col:
        # Fallback to first text column with string type
        for c in df.columns:
            if df[c].dtype == object:
                target_col = c
                break
                
    if not target_col:
        target_col = df.columns[0]
        
    texts = df[target_col].dropna().astype(str).tolist()
    texts = [t.strip() for t in texts if t.strip()]
    
    if not texts:
        raise HTTPException(status_code=400, detail="ไม่พบข้อมูลข้อความในไฟล์ที่อัปโหลด")
        
    # Batch predict (limit to first 1000 for responsive web experience)
    subset_texts = texts[:1000]
    results = predict_batch_texts(subset_texts, model_state)
    
    pos_count = sum(1 for r in results if r["sentiment"] == "Positive")
    neg_count = sum(1 for r in results if r["sentiment"] == "Negative")
    total = len(results)
    
    return {
        "filename": file.filename,
        "column_used": str(target_col),
        "total_analyzed": total,
        "results": results,
        "summary": {
            "positive_count": pos_count,
            "negative_count": neg_count,
            "positive_rate": round((pos_count / total * 100), 2) if total else 0,
            "negative_rate": round((neg_count / total * 100), 2) if total else 0,
        }
    }


@app.post("/api/retrain")
async def retrain_model_endpoint():
    """Trigger retraining of the model from the master dataset."""
    global model_state
    try:
        new_metrics = train_and_save_model(DEFAULT_DATA_FILE)
        model_state = load_model_and_metadata()
        return {
            "success": True,
            "message": "เทรนโมเดลใหม่และโหลดเข้าสู่ระบบเรียบร้อยแล้ว",
            "metrics": new_metrics
        }
    except Exception as e:
        logger.error(f"Retrain error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"เกิดข้อผิดพลาดในการเทรนโมเดล: {str(e)}")


# Mount Static Files and Root Route
static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.exists(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

@app.get("/")
async def root():
    index_file = os.path.join(os.path.dirname(__file__), "static", "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
    return {"message": "Thai Sentiment Analysis API is running. UI not found."}
