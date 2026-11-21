"""Tabular and CSV Semantic Chunking Engine (PRD §8.3, §7.6, FR-F2, FR-F3).

Converts tabular attachments into:
1. Table-Summary Chunk: All headers, row count, totals, and parent context.
2. Row-Level Semantic Chunks: Formatted as 'Column: Value | Column: Value' with entity keys repeated
   and parent thread/email context preserved.
"""

from __future__ import annotations
import csv
import io
import re
from typing import List, Dict, Any, Optional, Tuple
from sutra.models.retrieval import RetrievalDocument, DocumentType, ChunkLevel


class TableChunker:
    """
    Parses CSV and tabular data into fine-grained, contextual semantic chunks
    designed for high-precision hybrid retrieval.
    """

    @staticmethod
    def chunk_csv(
        csv_content: str,
        filename: str,
        source_email_id: str,
        thread_id: str,
        email_subject: Optional[str] = None,
    ) -> List[RetrievalDocument]:
        """
        Produce a table-summary chunk and row-level chunks from CSV content.
        
        Args:
            csv_content: Raw or decoded CSV string.
            filename: Attachment filename (e.g. 'cnc_vendor_comparison.csv').
            source_email_id: Parent email ID (e.g. 'E002').
            thread_id: Parent thread ID (e.g. 'THR-001').
            email_subject: Subject of the parent message for context.
            
        Returns:
            List of `RetrievalDocument` containing 1 summary chunk + N row chunks.
        """
        if not csv_content or not csv_content.strip():
            return []

        # Parse CSV safely
        rows: List[Dict[str, str]] = []
        headers: List[str] = []
        try:
            f = io.StringIO(csv_content.strip())
            # Detect dialect or fallback to standard reader
            sample = csv_content[:1024]
            delimiter = ","
            if "\t" in sample and "," not in sample:
                delimiter = "\t"
            elif ";" in sample and "," not in sample:
                delimiter = ";"

            reader = csv.DictReader(f, delimiter=delimiter)
            if reader.fieldnames:
                headers = [h.strip() for h in reader.fieldnames if h and h.strip()]
            for row in reader:
                cleaned_row = {
                    (k.strip() if k else f"col_{idx}"): (v.strip() if v else "")
                    for idx, (k, v) in enumerate(row.items())
                    if k is not None
                }
                if any(cleaned_row.values()):
                    rows.append(cleaned_row)
        except Exception as e:
            # Malformed CSV fallback: simple line splitting
            lines = [l.strip() for l in csv_content.strip().splitlines() if l.strip()]
            if not lines:
                return []
            headers = [h.strip() for h in lines[0].split(",")]
            for l in lines[1:]:
                vals = [v.strip() for v in l.split(",")]
                row_dict = {headers[i] if i < len(headers) else f"col_{i}": vals[i] for i in range(len(vals))}
                rows.append(row_dict)

        if not headers and not rows:
            return []

        chunks: List[RetrievalDocument] = []
        clean_filename = filename.strip()
        table_name = clean_filename.replace(".csv", "").replace("_", " ").title()

        # 1. Table-Summary Chunk (PRD §8.3 Tabular content: (a) table-summary chunk)
        # Note any totals or summary rows
        summary_lines = [
            f"Attachment Table: {clean_filename}",
            f"Parent Thread: {thread_id} | Email: {source_email_id}",
            f"Columns: {', '.join(headers)}",
            f"Total Data Rows: {len(rows)}",
        ]
        if email_subject:
            summary_lines.insert(1, f"Context Subject: {email_subject}")

        # Check for numeric totals across rows
        total_notes = []
        for h in headers:
            h_lower = h.lower()
            if any(term in h_lower for term in ["price", "cost", "amount", "total", "budget", "value"]):
                nums = []
                for r in rows:
                    raw_val = r.get(h, "")
                    num_match = re.search(r"[\d,]+(?:\.\d+)?", raw_val.replace(" ", ""))
                    if num_match:
                        try:
                            clean_num = float(num_match.group(0).replace(",", ""))
                            nums.append(clean_num)
                        except ValueError:
                            pass
                if nums and len(nums) == len(rows):
                    total_notes.append(f"Sum of {h}: {sum(nums):,.2f}")

        if total_notes:
            summary_lines.append(f"Computed Totals: {'; '.join(total_notes)}")

        table_summary_text = "\n".join(summary_lines)
        summary_doc = RetrievalDocument(
            doc_id=f"tab_summary:{source_email_id}:{clean_filename}",
            source_id=clean_filename,
            thread_id=thread_id,
            doc_type=DocumentType.TABLE_SUMMARY,
            level=ChunkLevel.TABLE_SUMMARY,
            content=table_summary_text,
            text_for_index=f"Table: {clean_filename} {thread_id} {source_email_id} {table_summary_text}",
            locator="summary",
            metadata={
                "source": "attachment_table_summary",
                "filename": clean_filename,
                "email_id": source_email_id,
                "headers": headers,
                "row_count": len(rows),
            },
        )
        chunks.append(summary_doc)

        # 2. Row-Level Semantic Chunks (PRD §8.3: (b) row chunks rendered as column: value pairs with entity key repeated)
        # Find primary entity column if available (e.g. Vendor, Item, Description, Name)
        entity_key = None
        for h in headers:
            if any(k in h.lower() for k in ["vendor", "item", "description", "name", "component", "code"]):
                entity_key = h
                break
        if not entity_key and headers:
            entity_key = headers[0]

        seen_rows = set()
        for row_idx, r in enumerate(rows, start=1):
            # Render 'Column: Value | Column: Value'
            col_pairs = []
            for h in headers:
                val = r.get(h, "").strip()
                if val:
                    col_pairs.append(f"{h}: {val}")
            
            if not col_pairs:
                continue

            row_text = " | ".join(col_pairs)
            # Deduplicate exact identical rows
            if row_text in seen_rows:
                continue
            seen_rows.add(row_text)

            # Contextual representation with parent table and thread
            entity_val = r.get(entity_key, "") if entity_key else ""
            index_context = f"Attachment: {clean_filename} | Email: {source_email_id} | Thread: {thread_id}"
            if email_subject:
                index_context += f" | {email_subject}"
            
            full_index_text = f"{index_context} | {row_text}"

            row_doc = RetrievalDocument(
                doc_id=f"tab_row:{source_email_id}:{clean_filename}:row_{row_idx}",
                source_id=clean_filename,
                thread_id=thread_id,
                doc_type=DocumentType.TABLE_ROW,
                level=ChunkLevel.TABLE_ROW,
                content=row_text,
                text_for_index=full_index_text,
                locator=f"row_{row_idx}",
                metadata={
                    "source": "attachment_table_row",
                    "filename": clean_filename,
                    "email_id": source_email_id,
                    "row_index": row_idx,
                    "entity_key": entity_key,
                    "entity_value": entity_val,
                    "parsed_fields": r,
                },
            )
            chunks.append(row_doc)

        return chunks
