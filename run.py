"""
Main one-command execution script for Thai Sentiment Analysis Web App.
Usage:
    python run.py
"""
import os
import sys
import webbrowser
import uvicorn
from app.model import MODEL_PATH, train_and_save_model

def ensure_model_ready():
    if not os.path.exists(MODEL_PATH):
        print("\n[INFO] Model artifact not found. Starting automatic model training...")
        train_and_save_model()
        print("[INFO] Model trained and ready!\n")
    else:
        print(f"[INFO] Found existing model artifact at '{MODEL_PATH}'")

def main():
    print("=" * 60)
    print(" Thai Sentiment Analysis Web Application (All-in-One Dashboard)")
    print("=" * 60)
    
    ensure_model_ready()
    
    host = os.environ.get("HOST", "0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
    port = int(os.environ.get("PORT", 8000))
    url = f"http://{host}:{port}"
    
    print(f"[INFO] Starting Web Server on {url} ...")
    print(f"[INFO] Web Dashboard:   {url}")
    print(f"[INFO] Swagger API Doc: {url}/docs")
    print("=" * 60)
    print("Press CTRL+C to stop the server.\n")
    
    # Try opening browser after server start (only if running locally)
    if host in ("127.0.0.1", "localhost") and not os.environ.get("PORT"):
        try:
            webbrowser.open(url)
        except Exception:
            pass
        
    uvicorn.run("app.main:app", host=host, port=port, reload=False)

if __name__ == "__main__":
    main()
