# ระบบวิเคราะห์ความรู้สึกความคิดเห็นภาษาไทย (Thai Sentiment Analysis Web Application)

ระบบวิเคราะห์ขั้วอารมณ์และความรู้สึกจากความคิดเห็น/รีวิวภาษาไทยแบบ **All-in-One Dashboard** พัฒนาขึ้นโดยใช้ Machine Learning สำหรับจำแนก 2 คลาส:
* **เชิงบวก (Positive):** คำชมดีสุดๆ, ดี, ชมเล็กๆ
* **เชิงลบ (Negative):** คำด่าแรงมาก, แรงปานกลาง, แรงน้อย

---

## 🚀 คุณสมบัติเด่น (Features)

1. **Core ML Pipeline**:
   - การตัดคำภาษาไทยด้วย `PyThaiNLP` (`engine='newmm'`)
   - กรอง Stop Words อัตโนมัติโดย **คงคำปฏิเสธไว้** (เช่น *ไม่, ไม่ได้, อย่า, มิ*) เพื่อรักษาทิศทางขั้วอารมณ์
   - แปลงข้อความเป็นเวกเตอร์ด้วย `TfidfVectorizer` (`ngram_range=(1, 2)`, `sublinear_tf=True`, `min_df=2`)
   - จำแนกประเภทด้วย `LinearSVC` (`C=1.0`, `loss='squared_hinge'`, `penalty='l2'`)
   - แถบวัดความเชื่อมั่น (Confidence Score %) คำนวณจาก Decision Function ผ่านฟังก์ชัน Sigmoid
   - ระบบ **Explainable AI (Keyword Highlights)** แสดงคำสำคัญที่มีอิทธิพลต่อผลการตัดสินใจ พร้อมค่าน้ำหนัก
   - บันทึกและโหลดโมเดลอัตโนมัติผ่านไฟล์ `.joblib` โดยไม่ต้องเทรนใหม่ทุกครั้ง

2. **Modern All-in-One Dashboard**:
   - ธีม Clean Dashboard สไตล์ทันสมัย พร้อมสลับ **Light / Dark Mode**
   - **Real-time Sentiment Analyzer**: ช่องพิมพ์ข้อความ, ปุ่มล้างข้อความ, และ **Quick Test Chips** สำหรับคลิกทดสอบประโยคตัวอย่างได้ทันที
   - **Result Display Card**: การ์ดแสดงผลลัพธ์แยกสีเขียว (บวก) / แดง (ลบ) พร้อม Animated Circular Confidence Gauge และหลอดเปรียบเทียบความน่าจะเป็น
   - **Batch / Bulk Upload**: รองรับการอัปโหลดไฟล์ **CSV หรือ Excel (.xlsx)** หรือวางข้อความหลายบรรทัด พร้อมตารางกรองผล ค้นหา และ **ส่งออกผลลัพธ์เป็นไฟล์ CSV**
   - **Model Performance & Metrics**: แสดงค่า Accuracy, Precision, Recall, F1-Score, ตาราง **Confusion Matrix (Heatmap)** และปุ่มสำหรับสั่ง Train โมเดลใหม่ได้ทันที

---

## 📁 โครงสร้างโปรเจกต์ (Project Structure)

```
SentimentAnalysis/
├── app/
│   ├── __init__.py
│   ├── model.py              # ML Pipeline, Data Preprocessing, Tokenizer, Explainability
│   ├── main.py               # FastAPI Web Server & REST Endpoints
│   └── static/
│       ├── css/
│       │   └── style.css     # Glassmorphism, animations & design system
│       ├── js/
│       │   └── app.js        # Frontend logic, charts, batch processor, CSV exporter
│       └── index.html        # Modern Tailwind CSS Dashboard UI
├── models/
│   ├── sentiment_model.joblib # โมเดลที่เทรนและบันทึกไว้
│   └── model_metadata.json   # ผลลัพธ์และเมตริกการประเมิน (Accuracy, F1, Confusion Matrix)
├── เก็บข้อมูลเพื่อทำ Sentiment Analysis (Responses).xlsx # ชุดข้อมูลต้นฉบับ
├── requirements.txt          # รายการแพ็กเกจที่จำเป็น
├── train.py                  # สคริปต์สั่งเทรนโมเดลแบบ Standalone
├── run.py                    # สคริปต์รันเซิร์ฟเวอร์หลัก (Python)
├── run.bat                   # สคริปต์รันแบบดับเบิลคลิกบน Windows
└── README.md
```

---

## ⚡ วิธีการรันโปรเจกต์ (Quick Start)

### วิธีที่ 1: One-command Run (แนะนำ)
เปิด Terminal หรือ PowerShell ในโฟลเดอร์โปรเจกต์ แล้วรันคำสั่ง:

```bash
.\venv\Scripts\python.exe run.py
```
*(หรือดับเบิลคลิกที่ไฟล์ `run.bat`)*

ระบบจะตรวจสอบไฟล์โมเดลอัตโนมัติ (หากยังไม่มีจะทำการเทรนให้อัตโนมัติ) และเปิดหน้าเว็บเบราว์เซอร์ที่:
👉 **http://127.0.0.1:8000**

---

### วิธีที่ 2: รันผ่าน FastAPI Uvicorn โดยตรง
```bash
.\venv\Scripts\uvicorn.exe app.main:app --host 127.0.0.1 --port 8000 --reload
```

---

## 📡 REST API Endpoints

* `GET /api/health` - ตรวจสอบสถานะความพร้อมของโมเดล
* `GET /api/metrics` - ดึงค่าประสิทธิภาพโมเดล (Accuracy, Precision, Recall, F1, Confusion Matrix)
* `POST /api/predict` - ส่งข้อความเดี่ยวเพื่อทำนายผลลัพธ์
  ```json
  {
    "text": "สินค้าคุณภาพดีมาก บริการรวดเร็ว ประทับใจสุดๆ"
  }
  ```
* `POST /api/batch-predict` - ส่งรายการข้อความเพื่อทำนายแบบกลุ่ม
* `POST /api/upload-batch` - อัปโหลดไฟล์ `.csv` หรือ `.xlsx` สำหรับวิเคราะห์ทั้งตาราง
* `POST /api/retrain` - สั่งให้ระบบเทรนโมเดลใหม่จากชุดข้อมูลต้นฉบับ
* `GET /docs` - เอกสาร Interactive API Documentation (Swagger UI)
