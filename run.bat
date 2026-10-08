@echo off
chcp 65001 > nul
echo ========================================================
echo   Thai Sentiment Analysis Web Application (Dashboard)
echo ========================================================

IF EXIST "venv\Scripts\python.exe" (
    echo [INFO] Using virtual environment in venv...
    venv\Scripts\python.exe run.py
) ELSE (
    echo [INFO] Using system python...
    python run.py
)

pause
