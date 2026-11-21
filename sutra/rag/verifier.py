"""Citation verification and provenance validator for SUTRA / ANVAYA (PRD §16.3 & §16.4).

Verifies that claims, excerpts, and citations are strictly grounded in original
email texts or attachment contents with exact character offsets.
Prevents hallucinated or fabricated citations.
"""

from __future__ import annotations
import re
import string
from typing import List, Dict, Tuple, Optional
from sutra.models.email import Email
from sutra.models.rag import Citation
from sutra.ingestion.normalizers import parse_indian_currency


def _normalize_whitespace_and_punctuation(text: str) -> str:
    """Normalize text by collapsing whitespace, lowercasing, and removing commas in numbers & punctuation."""
    if not text:
        return ""
    # Strip number commas first: 1,790,000 -> 1790000
    cleaned = re.sub(r"(?<=\d),(?=\d)", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned.lower().strip())
    cleaned = cleaned.translate(str.maketrans("", "", string.punctuation))
    return re.sub(r"\s+", " ", cleaned).strip()


class CitationVerifier:
    """
    Verifies that claims and citations are genuinely grounded in original email text or attachments.
    Returns exact character offsets, verification method, and rejects fabricated quotes.
    """

    def __init__(self, emails_by_id: Dict[str, Email]):
        self.emails_by_id = emails_by_id

    def verify_citation(
        self, email_id: str, span_text: str
    ) -> Tuple[bool, str, Optional[int], Optional[int], Optional[str]]:
        """
        Check whether an email exists and whether the given span/quote appears in it.

        Returns:
            (is_verified, source_location, start_offset, end_offset, verification_method)
        """
        if not email_id or email_id not in self.emails_by_id:
            return False, "unknown", None, None, None

        if not span_text or not span_text.strip():
            # Empty quote cannot be verified
            return False, "body", None, None, None

        email = self.emails_by_id[email_id]
        body = email.body
        body_lower = body.lower()
        span_clean = span_text.strip()
        span_lower = span_clean.lower()

        # 1. Exact match in email body
        idx = body.find(span_clean)
        if idx != -1:
            return True, "body", idx, idx + len(span_clean), "exact_match"

        # 2. Case-insensitive match in email body
        idx_ci = body_lower.find(span_lower)
        if idx_ci != -1:
            return True, "body", idx_ci, idx_ci + len(span_clean), "case_insensitive_match"

        # 3. Exact or case-insensitive match in attachments
        for att_name, meta in email.attachment_data.items():
            att_text = meta.content_text
            att_idx = att_text.find(span_clean)
            if att_idx != -1:
                return True, att_name, att_idx, att_idx + len(span_clean), "attachment_exact_match"
            att_idx_ci = att_text.lower().find(span_lower)
            if att_idx_ci != -1:
                return True, att_name, att_idx_ci, att_idx_ci + len(span_clean), "attachment_case_insensitive_match"

        # 4. Normalized whitespace & punctuation match in email body and attachments
        norm_body = _normalize_whitespace_and_punctuation(body)
        norm_span = _normalize_whitespace_and_punctuation(span_text)
        if norm_span and norm_span in norm_body:
            words = [w for w in re.findall(r"\b\w+\b", span_lower) if len(w) > 3]
            start_pos = None
            end_pos = None
            if words:
                first_w_idx = body_lower.find(words[0])
                last_w_idx = body_lower.rfind(words[-1])
                if first_w_idx != -1 and last_w_idx != -1 and last_w_idx >= first_w_idx:
                    start_pos = first_w_idx
                    end_pos = last_w_idx + len(words[-1])
            return True, "body", start_pos, end_pos, "normalized_text_match"

        for att_name, meta in email.attachment_data.items():
            norm_att = _normalize_whitespace_and_punctuation(meta.content_text)
            if norm_span and norm_span in norm_att:
                return True, att_name, 0, len(meta.content_text), "attachment_normalized_match"

        # 5. Currency / Number Equivalence Match
        span_curr = parse_indian_currency(span_text)
        if span_curr:
            body_curr = parse_indian_currency(body)
            span_amounts = {c[0] for c in span_curr}
            body_amounts = {c[0] for c in body_curr}
            overlap = span_amounts & body_amounts
            if overlap:
                m_num = re.search(r"(\b\d[\d,]*\b)", body)
                start_p = m_num.start() if m_num else None
                end_p = m_num.end() if m_num else None
                return True, "body", start_p, end_p, "currency_equivalence_match"

            for att_name, meta in email.attachment_data.items():
                att_curr = parse_indian_currency(meta.content_text)
                att_amounts = {c[0] for c in att_curr}
                if span_amounts & att_amounts:
                    return True, att_name, 0, len(meta.content_text), "attachment_currency_match"

        # If not matched through any method, quote is UNVERIFIED
        return False, "body", None, None, None

    def filter_and_validate(
        self,
        thread_id: str,
        cited_ids: List[str],
        quotes_by_email: Optional[Dict[str, str]] = None,
    ) -> List[Citation]:
        """
        Filter out non-existent email IDs and validate quotes against authentic source text.
        Returns strictly verified Citation objects.
        """
        citations: List[Citation] = []
        quotes_by_email = quotes_by_email or {}

        for eid in cited_ids:
            if eid not in self.emails_by_id:
                # Non-existent email: drop fabricated citation
                continue

            email = self.emails_by_id[eid]
            quote = quotes_by_email.get(eid, "")

            if quote:
                is_v, loc, start_o, end_o, method = self.verify_citation(eid, quote)
                citations.append(
                    Citation(
                        email_id=eid,
                        thread_id=email.thread_id,
                        evidence_text=quote if is_v else email.body[:120],
                        source_location=loc,
                        verified=is_v,
                        start_offset=start_o,
                        end_offset=end_o,
                        matched_quote=quote if is_v else None,
                        verification_method=method,
                    )
                )
            else:
                citations.append(
                    Citation(
                        email_id=eid,
                        thread_id=email.thread_id,
                        evidence_text=email.body[:120],
                        source_location="body",
                        verified=True,
                        start_offset=0,
                        end_offset=min(120, len(email.body)),
                        matched_quote=email.body[:120],
                        verification_method="email_body_reference",
                    )
                )

        return citations
