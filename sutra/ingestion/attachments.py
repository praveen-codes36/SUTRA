"""Attachment parser for text, tabular, and document files."""

import os
import csv
from typing import Dict, Optional, List, Any
from sutra.models.email import AttachmentMetadata

class AttachmentReader:
    """Discovers and parses attachments associated with email messages."""

    def __init__(self, attachments_dir: str):
        self.attachments_dir = attachments_dir
        self._cache: Dict[str, AttachmentMetadata] = {}

    def get_attachment(self, filename: str) -> Optional[AttachmentMetadata]:
        """Read and parse an attachment file by name."""
        clean_name = filename.strip()
        if not clean_name:
            return None
        if clean_name in self._cache:
            return self._cache[clean_name]

        file_path = os.path.join(self.attachments_dir, clean_name)
        if not os.path.exists(file_path):
            return None

        ext = os.path.splitext(clean_name)[1].lower()
        content_text = ""
        row_count = None
        structured_data: Optional[List[Dict[str, Any]]] = None

        if ext == ".csv":
            file_type = "csv"
            try:
                with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
                    reader = csv.DictReader(f)
                    structured_data = [dict(row) for row in reader]
                    row_count = len(structured_data)
                # Render tabular representation
                if structured_data and len(structured_data) > 0:
                    headers = list(structured_data[0].keys())
                    lines = [", ".join(headers)]
                    for r in structured_data:
                        lines.append(", ".join(str(r.get(h, "")) for h in headers))
                    content_text = "\n".join(lines)
            except Exception as e:
                content_text = f"Error reading CSV: {e}"
        else:
            file_type = "text"
            try:
                with open(file_path, "r", encoding="utf-8-sig", errors="replace") as f:
                    content_text = f.read().strip()
            except Exception as e:
                content_text = f"Error reading text file: {e}"

        meta = AttachmentMetadata(
            filename=clean_name,
            file_type=file_type,
            content_text=content_text,
            row_count=row_count,
            structured_data=structured_data,
        )
        self._cache[clean_name] = meta
        return meta
