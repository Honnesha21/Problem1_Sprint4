"""
main.py
───────
FastAPI application — Conseal Python PDF Engine
Runs on port 8000.

Routes:
  POST /api/analyze   — Upload PDF → extract text → run Presidio → return spans
  POST /api/export    — Upload PDF + span decisions → bounding-box redact → return PDF
  GET  /api/verify/{doc_id} — Re-extract text from redacted PDF → check for PII leaks
  GET  /exports/{filename}  — Serve exported PDF files (for browser canvas render)
"""

import os
import uuid
import json
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse, Response
from fastapi.staticfiles import StaticFiles

from document_parser import extract_text_from_pdf_bytes, check_pdf_for_strings
from detection import detect_pii
from export_service import redact_pdf, EXPORTS_DIR

# ── App Setup ─────────────────────────────────────────────────────────────────
app = FastAPI(title="Conseal PDF Engine", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve exported PDFs statically
app.mount("/exports", StaticFiles(directory=str(EXPORTS_DIR)), name="exports")

# In-memory store for document data (keyed by doc_id)
# Stores: { doc_id: { "pdf_bytes": bytes, "spans": list, "original_name": str } }
_doc_store: dict[str, dict] = {}


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "engine": "Conseal PDF Engine v1.0"}


@app.post("/api/analyze")
async def analyze_pdf(file: UploadFile = File(...)):
    """
    Phase 1 + 2: Receive PDF, extract text via PyMuPDF, run Presidio NLP,
    return detected spans and a doc_id for follow-up export/verify calls.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted by this endpoint.")

    pdf_bytes = await file.read()
    if len(pdf_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Phase 1: Extract text
    try:
        parsed = extract_text_from_pdf_bytes(pdf_bytes)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"PDF text extraction failed: {e}")

    full_text = parsed["full_text"]

    if len(full_text.strip()) < 20:
        raise HTTPException(
            status_code=422,
            detail="The PDF appears to be image-only (scanned graphics). No selectable text was found. Please use a text-based PDF."
        )

    # Phase 2: Detect PII
    try:
        spans = detect_pii(full_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PII detection failed: {e}")

    # Store document data for later export/verify calls
    doc_id = str(uuid.uuid4())
    _doc_store[doc_id] = {
        "pdf_bytes": pdf_bytes,
        "spans": spans,
        "original_name": file.filename,
        "full_text": full_text,
    }

    # Build document summary for the frontend ReadinessCard
    redacted_count = sum(1 for s in spans if s["status"] == "redacted")
    uncertain_count = sum(1 for s in spans if s["status"] == "uncertain")
    missed_count = 0  # No missed detection for Presidio pipeline

    trust_message = (
        f"Presidio NLP detected {len(spans)} entities across {parsed['page_count']} pages. "
        f"{redacted_count} will be redacted, {uncertain_count} require review."
    )

    return JSONResponse({
        "doc_id": doc_id,
        "documentText": full_text,
        "spans": spans,
        "page_count": parsed["page_count"],
        "documentSummary": {
            "totalDetected": len(spans),
            "autoRedacted": redacted_count,
            "uncertainCount": uncertain_count,
            "missedCount": missed_count,
            "trustMessage": trust_message,
        }
    })


@app.post("/api/export")
async def export_pdf(
    doc_id: str = Form(...),
    overrides: str = Form(default="{}"),
):
    """
    Phase 3: Apply bounding-box redactions to the original PDF.
    Receives the doc_id (from /api/analyze) and a JSON string of user overrides.
    Returns the redacted PDF as a binary download.
    """
    if doc_id not in _doc_store:
        raise HTTPException(status_code=404, detail="Document not found. Please re-upload the PDF.")

    doc_data = _doc_store[doc_id]
    pdf_bytes = doc_data["pdf_bytes"]
    spans = doc_data["spans"]
    original_name = doc_data["original_name"]

    try:
        overrides_dict = json.loads(overrides)
    except json.JSONDecodeError:
        overrides_dict = {}

    # Phase 3: Run bounding-box redaction engine
    try:
        export_url, redacted_bytes = redact_pdf(
            pdf_bytes=pdf_bytes,
            spans=spans,
            overrides=overrides_dict,
            doc_id=doc_id,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Redaction engine failed: {e}")

    # Return the redacted PDF as a binary response
    safe_name = original_name.replace(".pdf", "_redacted.pdf")
    return Response(
        content=redacted_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"',
            "X-Export-URL": export_url,
            "X-Doc-ID": doc_id,
        }
    )


@app.get("/api/verify/{doc_id}")
async def verify_redaction(doc_id: str):
    """
    Phase 4: Mechanical verification.
    Re-extracts text from the exported (redacted) PDF and checks
    that none of the originally detected PII strings remain in the text layer.
    """
    if doc_id not in _doc_store:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Find the redacted PDF
    redacted_path = EXPORTS_DIR / f"{doc_id}_redacted.pdf"
    if not redacted_path.exists():
        raise HTTPException(
            status_code=404,
            detail="Redacted PDF not found. Please export the document first."
        )

    doc_data = _doc_store[doc_id]
    spans = doc_data["spans"]

    # Collect all span texts that were supposed to be redacted
    target_strings = list({
        s["text"] for s in spans
        if s["status"] in ("redacted", "anonymous")
    })

    # Re-extract text from the redacted PDF and search for each string
    with open(redacted_path, "rb") as f:
        redacted_bytes = f.read()

    try:
        result = check_pdf_for_strings(redacted_bytes, target_strings)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Verification scan failed: {e}")

    leaking_strings = [s for s, found in result["findings"].items() if found]

    return JSONResponse({
        "doc_id": doc_id,
        "verified": not result["any_found"],
        "leaking_count": len(leaking_strings),
        "leaking_strings": leaking_strings,
        "total_checked": len(target_strings),
        "message": (
            "✓ Verification passed. All redacted strings are permanently deleted from the PDF text layer."
            if not result["any_found"]
            else f"⚠ Verification failed. {len(leaking_strings)} string(s) were found in the exported PDF text layer."
        )
    })
