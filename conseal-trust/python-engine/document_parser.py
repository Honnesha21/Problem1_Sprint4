"""
document_parser.py
──────────────────
PyMuPDF-based text extraction from PDF binary streams.

Returns two things:
  - full_text : str  — the complete concatenated text of all pages
  - page_texts : list[str] — per-page text for offset tracking
"""

import fitz  # PyMuPDF


def extract_text_from_pdf_bytes(pdf_bytes: bytes) -> dict:
    """
    Open a PDF from raw bytes, extract text from every page,
    and return the concatenated full text plus per-page offsets.

    The per-page offset lets the redaction engine know exactly which
    character indices in full_text belong to which page.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    
    full_text = ""
    page_offsets = []  # list of (page_index, start_char, end_char)

    for page_index in range(len(doc)):
        page = doc[page_index]
        # get_text() with default "text" flag preserves line breaks
        page_text = page.get_text()
        start = len(full_text)
        full_text += page_text
        end = len(full_text)
        page_offsets.append({
            "page": page_index,
            "start": start,
            "end": end,
        })
    
    doc.close()
    return {
        "full_text": full_text,
        "page_offsets": page_offsets,
        "page_count": len(page_offsets),
    }


def check_pdf_for_strings(pdf_bytes: bytes, target_strings: list[str]) -> dict:
    """
    Re-extract text from a (potentially redacted) PDF and check
    whether any of the given strings still appear in the text layer.

    Used by the /api/verify endpoint for post-redaction safety checks.
    Returns a dict of {string: found (bool)} for each target string.
    """
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    full_text = ""
    for page_index in range(len(doc)):
        full_text += doc[page_index].get_text()
    doc.close()

    results = {}
    for s in target_strings:
        results[s] = s in full_text

    return {
        "full_text_length": len(full_text),
        "findings": results,
        "any_found": any(results.values()),
    }
