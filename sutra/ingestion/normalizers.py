"""Data normalization utilities: dates, Indian currency, and text cleaning."""

import re
from datetime import datetime, timezone
from typing import Optional, List, Tuple

def parse_iso_timestamp(ts_str: str) -> datetime:
    """Parse ISO-8601 UTC timestamp string into timezone-aware datetime."""
    clean = ts_str.strip()
    if clean.endswith("Z"):
        clean = clean[:-1] + "+00:00"
    return datetime.fromisoformat(clean)

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

    # Match standard numeric INR amounts: e.g. INR 1,790,000 or INR 28,000 or INR 6,500
    std_pattern = re.compile(r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d+)?)", re.IGNORECASE)
    for m in std_pattern.finditer(text):
        full_match = m.group(0)
        # Skip if already part of a lakh pattern
        if any(w in text[m.start():m.end() + 15].lower() for w in ["lakh", "lac", "crore"]):
            continue
        val_str = m.group(1).replace(",", "")
        try:
            amount = float(val_str)
            formatted = f"INR {amount:,.0f}"
            results.append((amount, formatted))
        except ValueError:
            continue

    return results

def clean_email_body(body: str) -> str:
    """Normalize body text: strip extra spaces, preserve sentences."""
    if not body:
        return ""
    # Normalize Windows linebreaks
    text = body.replace("\r\n", "\n").replace("\r", "\n")
    # Collapse multiple blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()
