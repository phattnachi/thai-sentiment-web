FROM python:3.11-slim

WORKDIR /app

# Install build dependencies if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Preload/verify model artifact during image build
RUN python -c "from app.model import load_model_and_metadata; load_model_and_metadata()"

# Default port
ENV PORT=8000
ENV HOST=0.0.0.0
EXPOSE 8000

CMD ["python", "run.py"]
