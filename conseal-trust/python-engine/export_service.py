"""
export_service.py
─────────────────
PyMuPDF bounding-box redaction engine.

This is the core of the PDF redaction pipeline. For each span that the
user has decided to redact or anonymize, we:

  1. Open the original PDF from raw bytes.
  2. For each page, extract every word with its bounding box coordinates
     using page.get_text("words").
  3. Rebuild the page text string from those words and maintain a
     char-index → bounding-box mapping array.
  4. For each span, use regex to locate it in the rebuilt page string.
  5. Merge the bounding boxes of all words that overlap the span.
  6. Call page.add_redact_annot(merged_rect, fill=(0, 0, 0)) and
     page.apply_redactions() — this PERMANENTLY DELETES underlying text
     from the PDF's text layer, not just draws a box over it.
  7. Save the output PDF to the exports directory.
"""

import re
import os
import uuid
from pathlib import Path

import fitz  # PyMuPDF

EXPORTS_DIR = Path(__file__).parent / "exports"
EXPORTS_DIR.mkdir(exist_ok=True)

# Placeholder labels for anonymized spans
ANON_LABELS = {
    "PERSON":           "<NAME>",
    "EMAIL_ADDRESS":    "<EMAIL>",
    "PHONE_NUMBER":     "<PHONE_NUMBER>",
    "IN_AADHAAR":       "<AADHAAR>",
    "IN_PAN":           "<PAN>",
    "CREDIT_CARD":      "<CREDIT_CARD>",
    "US_SSN":           "<SSN>",
    "IP_ADDRESS":       "<IP_ADDRESS>",
    "LOCATION":         "<LOCATION>",
    "URL":              "<URL>",
    "ORGANIZATION":     "<ORGANIZATION>",
}


def _get_anon_label(entity_type: str) -> str:
    return ANON_LABELS.get(entity_type, f"<{entity_type}>")


def _build_page_char_map(words: list) -> tuple[str, list]:
    """
    Given PyMuPDF word tuples (x0, y0, x1, y1, word, block, line, word_n),
    reconstruct the page text string and build a parallel array that maps
    every character index in that string back to the bounding rect of the
    word it came from.

    Returns:
      page_text : str      — reconstructed text for this page
      char_map  : list     — parallel array of fitz.Rect for each char
    """
    page_text = ""
    char_map = []  # one entry per character in page_text

    prev_block = None
    prev_line = None

    for w in words:
        x0, y0, x1, y1, word_text, block_no, line_no, word_no = w
        rect = fitz.Rect(x0, y0, x1, y1)

        # Insert a newline between blocks/lines (preserves structure)
        if prev_block is not None:
            if block_no != prev_block:
                page_text += "\n"
                char_map.append(None)  # newline has no bbox
            elif line_no != prev_line:
                page_text += " "
                char_map.append(None)
            else:
                page_text += " "
                char_map.append(None)

        prev_block = block_no
        prev_line = line_no

        # Add each character of the word with its bounding rect
        for ch in word_text:
            page_text += ch
            char_map.append(rect)

    return page_text, char_map


def redact_pdf(
    pdf_bytes: bytes,
    spans: list[dict],
    overrides: dict[str, str],
    doc_id: str,
) -> tuple[str, bytes]:
    """
    Apply redactions to a PDF based on span decisions.

    Args:
        pdf_bytes: raw bytes of the original uploaded PDF
        spans: list of span dicts from the detection engine
        overrides: map of span_id → status override from the user
        doc_id: unique document ID for naming the output file

    Returns:
        (export_url, redacted_bytes) — URL path and raw bytes of the output PDF
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")

    # Build full-document text with page offsets for span location
    full_text = ""
    page_offsets = []
    page_word_data = []  # store words per page for the char map

    for page_index in range(len(doc)):
        page = doc[page_index]
        words = page.get_text("words")  # list of (x0,y0,x1,y1,word,block,line,word_n)
        page_text, char_map = _build_page_char_map(words)

        start = len(full_text)
        full_text += page_text
        end = len(full_text)
        # Add separator between pages
        full_text += "\n"

        page_offsets.append({"page": page_index, "start": start, "end": end})
        page_word_data.append({"page_text": page_text, "char_map": char_map})

    # Process each span
    unique_actions = {}
    for span in spans:
        span_id = span["id"]
        effective_status = overrides.get(span_id, span.get("status", "uncertain"))

        # Only process redacted or anonymous spans
        if effective_status not in ("redacted", "anonymous"):
            continue

        span_text = span["text"].strip()
        if not span_text:
            continue

        # Keep track of unique text to redact/anonymize
        if span_text not in unique_actions:
            unique_actions[span_text] = {
                "status": effective_status,
                "type": span.get("type", "UNKNOWN"),
                "span_id": span_id
            }

    for span_text, action in unique_actions.items():
        effective_status = action["status"]
        span_id = action["span_id"]
        span_type = action["type"]

        matches_found = 0

        # Search across all pages to find bounding boxes
        for page_index, offsets in enumerate(page_offsets):
            page_obj = page_word_data[page_index]
            page_text = page_obj["page_text"]
            char_map = page_obj["char_map"]

            # Use regex to find all instances of this span text on this page
            try:
                # Normalize spaces and allow any whitespace sequence to match
                normalized_span = re.sub(r'\s+', ' ', span_text.strip())
                pattern_str = re.escape(normalized_span).replace(r'\ ', r'\s+')
                pattern_str = pattern_str.replace(' ', r'\s+')
                pattern = re.compile(pattern_str, re.IGNORECASE)
            except re.error:
                continue

            for match in pattern.finditer(page_text):
                matches_found += 1
                match_start = match.start()
                match_end = match.end()

                # Gather all bounding rects for chars in this range
                rects = [
                    char_map[i]
                    for i in range(match_start, min(match_end, len(char_map)))
                    if char_map[i] is not None
                ]

                if not rects:
                    continue

                # Merge all rects into one covering bbox
                merged_rect = rects[0]
                for r in rects[1:]:
                    merged_rect = merged_rect | r  # PyMuPDF union operator

                # Inflate rect slightly for clean visual coverage
                merged_rect = merged_rect + fitz.Rect(-1, -1, 1, 1)

                page = doc[page_index]

                if effective_status == "redacted":
                    # Draw solid black redaction annotation
                    # page.apply_redactions() permanently deletes underlying text
                    page.add_redact_annot(merged_rect, fill=(0, 0, 0))

                elif effective_status == "anonymous":
                    # Draw white fill + overlay placeholder text
                    label = _get_anon_label(span_type)
                    page.add_redact_annot(
                        merged_rect,
                        text=label,
                        fontsize=8,
                        fill=(1, 1, 1),     # white background
                        text_color=(0.5, 0, 0.5),  # purple text
                    )

        if matches_found == 0:
            print(f"[WARNING] Export: Span '{span_text}' (ID: {span_id}) produced zero matches. Redaction failed for this span.")

    # Apply all redaction annotations — this permanently burns them in
    for page_index in range(len(doc)):
        doc[page_index].apply_redactions()

    # Save the redacted PDF
    output_filename = f"{doc_id}_redacted.pdf"
    output_path = EXPORTS_DIR / output_filename
    doc.save(str(output_path), garbage=4, deflate=True)
    doc.close()

    # Also return bytes for inline serving
    with open(output_path, "rb") as f:
        redacted_bytes = f.read()

    export_url = f"/exports/{output_filename}"
    return export_url, redacted_bytes


def cleanup_export(doc_id: str):
    """Remove a previously exported redacted PDF from disk."""
    output_path = EXPORTS_DIR / f"{doc_id}_redacted.pdf"
    if output_path.exists():
        output_path.unlink()
