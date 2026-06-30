"""
detection.py
────────────
Microsoft Presidio NLP detection engine + custom regex rules.

Pipeline:
  1. Try to load Presidio AnalyzerEngine with en_core_web_lg spaCy model.
     Fall back to en_core_web_sm if lg is not installed.
  2. Run Presidio against the extracted text.
  3. Augment with custom regex rules for Indian PII
     (Aadhaar, PAN, Indian phone numbers).
  4. Merge overlapping spans (interval merge algorithm).
  5. Apply business policy: confidence > 0.70 → redacted,
     0.40–0.70 → uncertain, < 0.40 → kept.
  6. Return span objects that match the frontend's expected schema.
"""

import re
import uuid
from typing import Optional

# ── PRESIDIO SETUP ────────────────────────────────────────────────────────────
_analyzer: Optional[object] = None
_presidio_available = False

def _load_analyzer():
    global _analyzer, _presidio_available
    if _analyzer is not None:
        return
    try:
        from presidio_analyzer import AnalyzerEngine
        from presidio_analyzer.nlp_engine import NlpEngineProvider

        # Try large model first, fall back to small
        for model_name in ("en_core_web_lg", "en_core_web_sm"):
            try:
                provider = NlpEngineProvider(nlp_configuration={
                    "nlp_engine_name": "spacy",
                    "models": [{"lang_code": "en", "model_name": model_name}],
                })
                nlp_engine = provider.create_engine()
                _analyzer = AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=["en"])
                _presidio_available = True
                print(f"[Presidio] Loaded with spaCy model: {model_name}")
                return
            except Exception:
                continue
        print("[Presidio] No spaCy model found. Running regex-only mode.")
    except ImportError:
        print("[Presidio] presidio-analyzer not installed. Running regex-only mode.")


# ── BUSINESS POLICY ───────────────────────────────────────────────────────────
POLICY = {
    "EMAIL_ADDRESS":    {"status": "redacted",   "risk": "HIGH"},
    "PHONE_NUMBER":     {"status": "redacted",   "risk": "HIGH"},
    "PERSON":           {"status": "uncertain",  "risk": "HIGH"},
    "IN_PAN":           {"status": "redacted",   "risk": "CRITICAL"},
    "IN_AADHAAR":       {"status": "redacted",   "risk": "CRITICAL"},
    "CREDIT_CARD":      {"status": "redacted",   "risk": "CRITICAL"},
    "US_SSN":           {"status": "redacted",   "risk": "CRITICAL"},
    "IP_ADDRESS":       {"status": "uncertain",  "risk": "MEDIUM"},
    "URL":              {"status": "kept",        "risk": "LOW"},
    "ORGANIZATION":     {"status": "kept",        "risk": "LOW"},
    "LOCATION":         {"status": "uncertain",  "risk": "MEDIUM"},
    "DATE_TIME":        {"status": "kept",        "risk": "LOW"},
    "NRP":              {"status": "uncertain",  "risk": "MEDIUM"},
}

RISK_DETAILS = {
    "EMAIL_ADDRESS":  {"riskReason": "Emails directly identify individuals and enable unsolicited contact.", "recommendation": "Keep redacted"},
    "PHONE_NUMBER":   {"riskReason": "Phone numbers enable direct contact and identity verification.", "recommendation": "Keep redacted"},
    "PERSON":         {"riskReason": "Names combined with other context can directly identify individuals.", "recommendation": "Review and redact if personal"},
    "IN_PAN":         {"riskReason": "Indian tax identity number. Enables financial fraud.", "recommendation": "Keep redacted"},
    "IN_AADHAAR":     {"riskReason": "Government-issued ID. Exposure can enable identity theft.", "recommendation": "Keep redacted"},
    "CREDIT_CARD":    {"riskReason": "Financial identifier. Enables direct financial fraud.", "recommendation": "Keep redacted"},
    "US_SSN":         {"riskReason": "US government ID. Enables identity theft and fraud.", "recommendation": "Keep redacted"},
    "IP_ADDRESS":     {"riskReason": "IP addresses indirectly identify devices and individuals.", "recommendation": "Review manually"},
    "URL":            {"riskReason": "URLs reference public resources, not personal data.", "recommendation": "Safe to keep visible"},
    "ORGANIZATION":   {"riskReason": "Organization names are generally public information.", "recommendation": "Safe to keep visible"},
    "LOCATION":       {"riskReason": "Locations may reveal personal information depending on context.", "recommendation": "Review manually"},
    "DATE_TIME":      {"riskReason": "Dates are generally not personally identifiable in isolation.", "recommendation": "Safe to keep visible"},
}

# ── CUSTOM REGEX RULES (Indian PII + common patterns) ─────────────────────────
CUSTOM_RULES = [
    {
        "type": "IN_AADHAAR",
        "pattern": re.compile(r'\b\d{4}\s\d{4}\s\d{4}\b'),
        "confidence": 0.99,
        "reason": "Matches 12-digit Aadhaar format (groups of 4 separated by spaces).",
    },
    {
        "type": "IN_PAN",
        "pattern": re.compile(r'\b[A-Z]{5}[0-9]{4}[A-Z]\b'),
        "confidence": 0.99,
        "reason": "Matches Indian PAN card format (5 letters, 4 digits, 1 letter).",
    },
    {
        "type": "PHONE_NUMBER",
        "pattern": re.compile(r'(\+91[-\s]?)?[6-9]\d{4}[-\s]?\d{5}'),
        "confidence": 0.97,
        "reason": "Matches Indian mobile number format.",
    },
    {
        "type": "EMAIL_ADDRESS",
        "pattern": re.compile(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}'),
        "confidence": 0.99,
        "reason": "Matches standard email format (RFC 5322).",
    },
]


def _merge_spans(spans: list) -> list:
    """Interval-merge overlapping detected spans, combining evidence."""
    if not spans:
        return []
    spans.sort(key=lambda s: s["start"])
    merged = [spans[0].copy()]
    for current in spans[1:]:
        last = merged[-1]
        if current["start"] <= last["end"]:
            # Overlapping — extend end, keep highest confidence
            last["end"] = max(last["end"], current["end"])
            if current["confidence"] > last["confidence"]:
                last["confidence"] = current["confidence"]
                last["type"] = current["type"]
                last["reason"] = current["reason"]
        else:
            merged.append(current.copy())
    return merged


def detect_pii(text: str) -> list[dict]:
    """
    Run full PII detection on a text string.
    Returns a list of span dicts compatible with the frontend schema.
    """
    _load_analyzer()
    raw_candidates = []

    # ── Layer 1: Presidio NLP ─────────────────────────────────────────────────
    if _presidio_available and _analyzer:
        try:
            results = _analyzer.analyze(text=text, language="en")
            for r in results:
                entity_text = text[r.start:r.end]
                raw_candidates.append({
                    "start": r.start,
                    "end": r.end,
                    "text": entity_text,
                    "type": r.entity_type,
                    "confidence": r.score,
                    "source": "Presidio NLP",
                    "reason": f"Presidio detected {r.entity_type} with {r.score:.0%} confidence.",
                })
        except Exception as e:
            print(f"[Presidio] Analysis error: {e}")

    # ── Layer 2: Custom Regex Rules ───────────────────────────────────────────
    for rule in CUSTOM_RULES:
        for match in rule["pattern"].finditer(text):
            raw_candidates.append({
                "start": match.start(),
                "end": match.end(),
                "text": match.group(),
                "type": rule["type"],
                "confidence": rule["confidence"],
                "source": "Regex",
                "reason": rule["reason"],
            })

    # ── Merge overlapping spans ───────────────────────────────────────────────
    merged = _merge_spans(raw_candidates)

    # ── Apply business policy ─────────────────────────────────────────────────
    spans = []
    for candidate in merged:
        entity_type = candidate["type"]
        policy = POLICY.get(entity_type, {"status": "uncertain", "risk": "MEDIUM"})
        details = RISK_DETAILS.get(entity_type, {
            "riskReason": "Unknown entity type.",
            "recommendation": "Review manually",
        })

        # Override status based on confidence thresholds
        status = policy["status"]
        if candidate["confidence"] < 0.4:
            status = "uncertain" if policy["risk"] in ("HIGH", "CRITICAL") else "kept"
        elif candidate["confidence"] < 0.7 and status == "redacted":
            status = "uncertain"

        context_start = max(0, candidate["start"] - 40)
        context_end = min(len(text), candidate["end"] + 40)
        nearby_context = f"...{text[context_start:context_end]}..."

        spans.append({
            "id": str(uuid.uuid4()),
            "text": candidate["text"],
            "start": candidate["start"],
            "end": candidate["end"],
            "type": entity_type,
            "status": status,
            "confidence": candidate["confidence"],
            "source": candidate["source"],
            "reason": candidate["reason"],
            "nearby_context": nearby_context,
            "risk": policy["risk"],
            "riskReason": details["riskReason"],
            "recommendation": details["recommendation"],
        })

    return spans
