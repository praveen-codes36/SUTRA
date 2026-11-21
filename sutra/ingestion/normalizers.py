"""Data normalization utilities: dates, Indian currency, and text cleaning."""

import re
from datetime import datetime, timezone
from typing import Optional, List, Tuple

def parse_iso_timestamp(ts_str: str) -> datetime:
    """
    Robust ISO-8601 UTC timestamp parser with multi-format fallback.
    Guarantees returning a timezone-aware datetime object without crashing.
    """
    if not ts_str or not ts_str.strip():
        return datetime(1970, 1, 1, tzinfo=timezone.utc)

    clean = ts_str.strip().replace("\ufeff", "").replace("\u200b", "")
    clean = clean.replace("/", "-")

    # If space-separated: '2026-09-08 14:00:00' -> '2026-09-08T14:00:00'
    if " " in clean and "T" not in clean:
        parts = clean.split(" ", 1)
        clean = f"{parts[0]}T{parts[1]}"

    if clean.endswith("Z"):
        clean = clean[:-1] + "+00:00"

    try:
        dt = datetime.fromisoformat(clean)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        pass

    # Fallback to common timestamp formats
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M",
        "%Y-%m-%d",
        "%d-%m-%Y %H:%M:%S",
        "%d-%m-%Y",
    ):
        try:
            dt = datetime.strptime(clean, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue

    return datetime(1970, 1, 1, tzinfo=timezone.utc)

def normalize_recipients(recipients_raw: str) -> List[str]:
    """Split semicolon or comma-separated recipients list into trimmed lowercase emails."""
    if not recipients_raw:
        return []
    parts = re.split(r"[;,]", recipients_raw)
    return [p.strip().lower() for p in parts if p.strip()]

def parse_indian_currency(text: str) -> List[Tuple[float, str]]:
    """
    Extract and normalize INR currency amounts from text.
    Handles:
      - 'INR 17.9 lakh' -> (1790000.0, 'INR 1,790,000')
      - 'INR 1,790,000' -> (1790000.0, 'INR 1,790,000')
      - 'INR 28,000'    -> (28000.0, 'INR 28,000')
      - 'INR 3.5 lakh'  -> (350000.0, 'INR 350,000')
      - 'INR 3.42 lakh' -> (342000.0, 'INR 342,000')
      - 'INR 29,500'    -> (29500.0, 'INR 29,500')
      - 'INR 59,000'    -> (59000.0, 'INR 59,000')
    """
    results: List[Tuple[float, str]] = []
    
    # Match lakh / crore patterns: e.g. INR 17.9 lakh, 3.42 lakh, 3.5 lakh
    lakh_pattern = re.compile(r"(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore)", re.IGNORECASE)
    for m in lakh_pattern.finditer(text):
        val_str = m.group(1).replace(",", "")
        unit = m.group(2).lower()
        val = float(val_str)
        multiplier = 100000.0 if "la" in unit else 10000000.0
        amount = round(val * multiplier, 2)
        formatted = f"INR {amount:,.0f}"
        results.append((amount, formatted))

    # Match standard numeric INR amounts: e.g. INR 1,790,000 or INR 28,000 or 17,90,000 INR
    std_pattern = re.compile(
        r"(?:(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?))|(?:([\d,]+(?:\.\d+)?)\s*(?:INR|Rs\.?|₹))",
        re.IGNORECASE,
    )
    for m in std_pattern.finditer(text):
        full_match = m.group(0)
        # Skip if already part of a lakh pattern
        if any(w in text[max(0, m.start() - 10):min(len(text), m.end() + 15)].lower() for w in ["lakh", "lac", "crore"]):
            continue
        val_str = (m.group(1) or m.group(2)).replace(",", "")
        try:
            amount = float(val_str)
            formatted = f"INR {amount:,.0f}"
            if not any(r[0] == amount for r in results):
                results.append((amount, formatted))
        except ValueError:
            continue

    return results

def clean_email_body(body: str) -> str:
    """Normalize body text: strip extra spaces, zero-width chars, preserve sentences and multilingual unicode."""
    if not body:
        return ""
    # Remove zero-width characters and BOMs
    text = re.sub(r"[\u200b\u200c\u200d\ufeff\u200e\u200f]", "", body)
    # Normalize Windows and legacy Mac linebreaks
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
