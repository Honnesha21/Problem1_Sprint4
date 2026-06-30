# Conseal — Secure Document Redaction Pipeline

> A local-first, privacy-preserving PII detection and redaction tool for `.txt` and `.pdf` documents.
> No API keys. No cloud services. Everything runs on your machine.

---

## Table of Contents

1. [What is Conseal?](#what-is-conseal)
2. [Video Explanation](#video-explanation)
3. [System Architecture](#system-architecture)
4. [Project Structure](#project-structure)
5. [Prerequisites](#prerequisites)
6. [Installation](#installation)
7. [Running the Application](#running-the-application)
8. [How It Works — Pipeline Overview](#how-it-works--pipeline-overview)
9. [API Reference](#api-reference)
10. [Submission Writeup](#submission-writeup)

---

## What is Conseal?

Conseal is a full-stack document redaction pipeline that lets users upload sensitive documents, automatically detect personally identifiable information (PII), interactively review every detection decision, and download a clean, redacted copy — all locally, with no data leaving the machine.

It supports:
- **`.txt` files** — scanned with a deterministic regex + heuristic NER engine (Node.js)
- **`.pdf` files** — text extracted via PyMuPDF, scanned with Microsoft Presidio NLP (Python/FastAPI), and exported as pixel-level bounding-box-redacted PDFs

---

## Video Explanation

Watch the video explanation of the Conseal Document Redaction Pipeline:

- [Video Explanation / Vidoe explanation](https://drive.google.com/file/d/1BUJmdyVw4IjJ0BSN4dvMte8s278JKIFE/view?usp=drive_link)

---

## System Architecture

```
Browser (localhost:5173)
React 19 + Vite — App.jsx

  [Upload/Drop]    [Document Viewer]    [Review Sidebar]
  .txt / .pdf      Highlighted spans    Decision queue

        |                  |                   |
   .txt |           Render |          Resolve   |
  upload|           spans  |          overrides |
        |                  |                   |
        v                                      v
Node.js Server (localhost:4000)    Python FastAPI (localhost:8000)
POST /api/detect                   POST /api/analyze  (PDF → spans)
- Regex rules                      POST /api/export   (spans → redacted PDF)
- Heuristic NER                    GET  /api/verify/{id} (audit check)
- Policy engine
                                   Libraries:
Libraries:                         - PyMuPDF (text extraction + redaction)
- Express.js                       - Microsoft Presidio NLP
- CORS                             - spaCy (en_core_web_lg / sm)
```

### Data Flow

```
User uploads .txt              User uploads .pdf
      |                               |
      v                               v
Node.js /api/detect         Client extracts text via PDF.js
  - Regex (Layer 1)                   |
  - Heuristic NER (Layer 2)           v
  - Merge overlaps            Python /api/analyze
  - Policy engine               - PyMuPDF text extraction
      |                         - Presidio NLP (Layer 1)
      |                         - Custom regex (Layer 2)
      |                         - Merge + policy engine
      |                               |
      +---------------+---------------+
                      v
              Frontend renders
              highlighted document
                      |
            User reviews each span:
            [Redact] [Keep] [Anonymize]
                      |
                      v
           .txt -> buildRedactedText()
                      |
           .pdf -> Python /api/export
                  (PyMuPDF bounding-box
                   permanent redaction)
                      |
                      v
            Download redacted copy
            + Audit log modal
```

---

## Project Structure

```
conseal-trust/
|
+-- start.ps1                   # One-command launcher (Windows PowerShell)
|
+-- client/                     # React 19 + Vite frontend
|   +-- index.html              # PDF.js CDN loaded here
|   +-- src/
|   |   +-- App.jsx             # Entire application UI + state
|   |   +-- App.css             # Full design system + animations
|   |   +-- index.css           # Base reset
|   |   +-- main.jsx            # React entry point
|   +-- package.json
|   +-- vite.config.js
|
+-- server/                     # Node.js Express detection server
|   +-- server.js               # 5-stage detection engine + REST API
|   +-- mockData.js             # Built-in demo document with annotated spans
|   +-- package.json
|
+-- python-engine/              # Python FastAPI PDF engine
    +-- main.py                 # FastAPI routes: /analyze, /export, /verify
    +-- detection.py            # Presidio NLP + custom regex pipeline
    +-- document_parser.py      # PyMuPDF text extraction
    +-- export_service.py       # Bounding-box PDF redaction engine
    +-- requirements.txt
```

---

## Prerequisites

Make sure the following are installed before proceeding:

### Required

| Tool | Minimum Version | Check Command |
|------|----------------|---------------|
| Node.js | v18+ | `node --version` |
| npm | v9+ | `npm --version` |
| Python | 3.10+ | `python --version` |
| pip | 23+ | `pip --version` |

### Windows-specific

- **PowerShell** 5.1+ (comes with Windows 10/11)
- Execution policy must allow local scripts:
  ```powershell
  Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
  ```

---

## Installation

Run these **once** before first launch.

### Step 1 — Install Node.js dependencies

```powershell
# Detection server
cd server
npm install

# React client
cd ../client
npm install
```

### Step 2 — Install Python dependencies

```powershell
cd ../python-engine
pip install -r requirements.txt
```

`requirements.txt` installs:
- `fastapi==0.115.5`
- `uvicorn[standard]==0.32.1`
- `python-multipart==0.0.17`
- `PyMuPDF==1.24.14`
- `presidio-analyzer==2.2.356`
- `presidio-anonymizer==2.2.356`
- `spacy>=3.8.0`

### Step 3 — Download spaCy language model

Presidio requires a spaCy NLP model. Install at least one:

```powershell
# Recommended (larger, more accurate)
python -m spacy download en_core_web_lg

# OR fallback (smaller, faster)
python -m spacy download en_core_web_sm
```

> The engine automatically falls back to `en_core_web_sm` if `en_core_web_lg` is not found.
> If neither is installed, the Python engine operates in regex-only mode for PDFs.

---

## Running the Application

### Option A — One-command start (recommended)

From the project root in PowerShell:

```powershell
.\start.ps1
```

This opens **3 separate terminal windows** automatically:

| Window | Service | Port |
|--------|---------|------|
| 1 | Python FastAPI engine | `8000` |
| 2 | Node.js detection server | `4000` |
| 3 | React/Vite dev client | `5173` |

Then open: **http://localhost:5173**

---

### Option B — Manual start (3 separate terminals)

**Terminal 1 — Python engine:**
```powershell
cd python-engine
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Node.js server:**
```powershell
cd server
node server.js
```

**Terminal 3 — React client:**
```powershell
cd client
npm run dev
```

---

### Verify all services are running

| URL | Expected response |
|-----|-------------------|
| http://localhost:8000/health | `{"status":"ok","engine":"Conseal PDF Engine v1.0"}` |
| http://localhost:4000 | Connection accepted (POST only endpoints) |
| http://localhost:5173 | Conseal UI loads in browser |

---

## How It Works — Pipeline Overview

### TXT File Pipeline (Node.js, port 4000)

1. **Upload** — User drops a `.txt` file
2. **Detect** — `POST /api/detect` runs:
   - **Layer 1 (Regex):** Email, phone, Aadhaar, PAN, URL, IP address patterns
   - **Layer 2 (Heuristic NER):** Known org names, job titles, context-based name detection, title-case sequences
   - **Stage 3 (Merge):** Interval merge deduplicates overlapping spans
   - **Stage 4 (Policy Engine):** Assigns `redacted` / `uncertain` / `kept` using a weighted evidence model
3. **Review** — User inspects highlighted spans inline
4. **Export** — `buildRedactedText()` replaces spans with `████` blocks, `<PLACEHOLDER>` tags, or plain text

### PDF File Pipeline (Python, port 8000)

1. **Upload** — User drops a `.pdf` file; PDF.js extracts raw text client-side for preview
2. **Analyze** — `POST /api/analyze` runs:
   - PyMuPDF extracts per-page text with character offsets
   - Microsoft Presidio NLP runs full NER analysis
   - Custom regex augments with Indian PII patterns (Aadhaar, PAN, Indian phones)
   - Spans are merged and scored by confidence thresholds
3. **Review** — Same interactive UI as TXT
4. **Export** — `POST /api/export` performs PyMuPDF bounding-box redaction:
   - Locates each span's exact word bounding boxes on the PDF page
   - Calls `page.add_redact_annot()` + `page.apply_redactions()` — permanently deletes text from the PDF text layer
5. **Verify** — `GET /api/verify/{doc_id}` re-extracts text and confirms no PII strings remain

### Span Decision States

| Status | Visual | Exported As |
|--------|--------|-------------|
| `redacted` | Black block | `████████` |
| `kept` | Green highlight | Original text |
| `anonymous` | Purple/dashed border | `<NAME>`, `<EMAIL>`, etc. |
| `uncertain` | Yellow highlight | Requires user decision |

---

## API Reference

### Node.js Server (port 4000)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/detect` | `{ text, name }` | Run detection on plain text |
| POST | `/api/spans/:id/override` | `{ newStatus }` | Override a span's status |
| POST | `/api/spans/:id/override/undo` | — | Revert an override |

### Python FastAPI Engine (port 8000)

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/health` | — | Health check |
| POST | `/api/analyze` | `multipart: file (PDF)` | Extract text + detect PII |
| POST | `/api/export` | `multipart: doc_id, overrides` | Generate redacted PDF |
| GET | `/api/verify/{doc_id}` | — | Verify redaction completeness |
| GET | `/exports/{filename}` | — | Serve exported PDF file |

---

## Submission Writeup

### What I Built

Conseal is a local-first document redaction pipeline built as a full-stack application. The core problem it solves is the **gap between detecting sensitive information and actually resolving it** — most tools either auto-redact everything (too aggressive) or surface raw detections with no workflow for a human to act on them.

The system handles both `.txt` and `.pdf` files through separate, purpose-built backends. The TXT pipeline runs entirely in Node.js using a deterministic 5-stage engine: regex rules, heuristic NER, interval merging, and a weighted evidence model that produces probabilistic status decisions rather than binary flags. The PDF pipeline routes through a Python FastAPI service that pairs Microsoft Presidio NLP with PyMuPDF, enabling true bounding-box redaction — where text is permanently deleted from the PDF text layer, not just painted over.

The front-end is a single-page React 19 application with a document viewer that renders highlighted spans inline, a sidebar review queue sorted by risk level, a guided wizard for step-by-step span resolution, and a live readiness score that recomputes as the user makes decisions. All state is session-local; no data is transmitted to any external service at any point.

The PDF export system issues a cryptographic audit log rendered in-app on download, listing every span and its final resolution with a timestamp and decision trail.

---

### What I Chose NOT to Build, and Why

**No user authentication or persistent storage.** The core trust model of the application is that sensitive documents never leave the machine. Adding a database or user accounts would have introduced a storage layer, and any server-side persistence immediately weakens the local-first guarantee. Session memory is the right scope for a review tool.

**No OCR for image-based PDFs.** Scanned documents (image-only PDFs with no text layer) are detected and the user is warned with a clear error. Integrating Tesseract or a cloud OCR service would have added a significant dependency and a network surface area for what is primarily a text-processing pipeline. The limitation is surfaced honestly.

**No LLM-assisted redaction.** Presidio + regex gives deterministic, auditable, reproducible results. LLM-based suggestions would introduce non-determinism, hallucination risk, and API key dependencies — all of which directly conflict with the local-first, no-external-service constraint. The weighted evidence model already handles ambiguous cases (e.g., "May" as a calendar month vs. a first name) through context-window scoring and explicit confidence thresholds.

**No bulk batch processing.** While the backend can handle multiple documents (state supports a documents array), the priority was making the single-document review experience trustworthy and polished rather than building a queue manager that processes everything automatically and bypasses the human review step entirely. A tool that blindly auto-redacts every uncertain span is not safer — it is just less honest about what it missed.

**No multi-user collaboration.** The review workflow is designed for a single reviewer working through a document. Real-time collaboration would require WebSocket infrastructure and merge conflict resolution that is well out of scope for a local tool with session-based state.

The prioritization principle throughout: **human oversight over automation speed.** The application is designed to make it easy to act on every ambiguous detection, not to make decisions on the user's behalf.
