"""Evidence reference validation and attribution engine for Conversation Intelligence.

Performs layered validation:
Layer 1: Source existence (email ID or attachment filename in corpus).
Layer 2: Thread co-membership (email/attachment actually belongs to the given thread).
Layer 3: Content-aware excerpt verification with semantic mutation defenses:
  - Exact match (normalized whitespace, case, punctuation).
  - Substring / containment check with negation truncation guard.
  - Polarity and negation integrity (detects inverted meaning or dropped negation across inflected forms).
  - Numeric integrity with currency & comma normalization (detects altered currency, quantities, and statistics).
  - Date and time integrity with canonical month normalization (detects altered months, days, and timestamps).
  - Conditionality preservation (rejects claims asserting unconditional approval for conditional/planning items).
  - Token-level similarity check (rejects fabricated claims).
"""

from __future__ import annotations
import re
import string
from typing import List, Dict, Optional, Tuple, Set
from sutra.models.email import Email
from sutra.models.intelligence import EvidenceReference
from sutra.ingestion.normalizers import parse_indian_currency

NEGATION_TOKENS = {
    "not", "never", "cannot", "cant", "wont", "neither", "nor",
    "rejected", "declined", "disapproved", "refused", "denied",
    "without", "unauthorized", "prohibited", "no"
}

MONTH_CANONICAL = {
    "january": 1, "jan": 1,
    "february": 2, "feb": 2,
    "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "may": 5,
    "june": 6, "jun": 6,
    "july": 7, "jul": 7,
    "august": 8, "aug": 8,
    "september": 9, "sep": 9, "sept": 9,
    "october": 10, "oct": 10,
    "november": 11, "nov": 11,
    "december": 12, "dec": 12
}

POSITIVE_APPROVAL_TOKENS = {
    "approve", "approves", "approved", "approving", "approval",
    "accept", "accepts", "accepted", "accepting", "acceptance",
    "confirm", "confirms", "confirmed",
    "grant", "grants", "granted",
    "sanction", "sanctions", "sanctioned",
    "endorse", "endorses", "endorsed",
    "authorize", "authorizes", "authorized"
}


def normalize_text_for_matching(text: str) -> str:
    """Normalize text by collapsing whitespace, lowercasing, and stripping punctuation."""
    if not text:
        return ""
    cleaned = re.sub(r"\s+", " ", text.lower().strip())
    cleaned = cleaned.translate(str.maketrans("", "", string.punctuation))
    return re.sub(r"\s+", " ", cleaned).strip()


def remove_number_commas(text: str) -> str:
    """Remove internal formatting commas in numbers: '1,790,000' -> '1790000'."""
    return re.sub(r"(?<=\d),(?=\d)", "", text)


class EvidenceValidator:
    """
    Validates that every claim and extracted record references authentic,
    existing emails and attachments in the corpus and is genuinely supported by source text.
    """

    def __init__(self, emails: List[Email]):
        self.emails_by_id: Dict[str, Email] = {e.email_id: e for e in emails}
        self.attachments_by_name: Dict[str, Tuple[str, str]] = {}  # filename -> (thread_id, content_text)
        for e in emails:
            for att_name, att_meta in e.attachment_data.items():
                self.attachments_by_name[att_name] = (e.thread_id, att_meta.content_text)
            for att_name in e.attachments:
                if att_name not in self.attachments_by_name:
                    self.attachments_by_name[att_name] = (e.thread_id, "")

    def get_source_text(self, source_id: str) -> Optional[str]:
        """Retrieve full textual content of email (subject + body + attachments) or attachment."""
        if source_id in self.emails_by_id:
            e = self.emails_by_id[source_id]
            att_texts = " ".join([m.content_text for m in e.attachment_data.values()])
            ts_str = e.timestamp.strftime("%Y-%m-%d %H:%M")
            return f"{ts_str} {e.subject} {e.body} {att_texts}".strip()

        if source_id in self.attachments_by_name:
            return self.attachments_by_name[source_id][1]

        return None

    def validate_reference(
        self,
        source_id: str,
        thread_id: str,
        excerpt: str = "",
        min_token_overlap: float = 0.5,
    ) -> Tuple[bool, Optional[str], float]:
        """
        Check if a referenced source_id exists in corpus, belongs to thread_id,
        and verifies that excerpt is genuinely supported without meaning-altering mutations.

        Returns:
            (is_valid, failure_reason, support_confidence)
        """
        if not source_id:
            return False, "Empty source_id", 0.0

        # Layer 1 & 2: Existence & Thread Co-membership
        source_text = None
        if source_id in self.emails_by_id:
            email = self.emails_by_id[source_id]
            if email.thread_id != thread_id:
                return False, f"Email '{source_id}' belongs to thread '{email.thread_id}', not '{thread_id}'", 0.0
            source_text = self.get_source_text(source_id)
        elif source_id in self.attachments_by_name:
            att_thread, content = self.attachments_by_name[source_id]
            if att_thread != thread_id:
                return False, f"Attachment '{source_id}' does not appear in thread '{thread_id}'", 0.0
            source_text = content
        else:
            return False, f"Source '{source_id}' was not found in dataset emails or attachments", 0.0

        # Layer 3: Content-aware excerpt verification
        if not excerpt or not excerpt.strip():
            return True, None, 0.7

        if not source_text or not source_text.strip():
            return True, None, 0.7

        # Normalize with comma removal for numbers
        norm_source = remove_number_commas(source_text)
        norm_excerpt = remove_number_commas(excerpt)

        exc_lower = norm_excerpt.lower()
        source_lower = norm_source.lower()

        # ---------------------------------------------------------------------
        # Defense 1: Date and Time Alteration Check with Canonical Month Mapping
        # ---------------------------------------------------------------------
        exc_times = re.findall(r"\b\d{1,2}:\d{2}\b", norm_excerpt)
        if exc_times:
            source_times = set(re.findall(r"\b\d{1,2}:\d{2}\b", norm_source))
            missing_times = [t for t in exc_times if t not in source_times]
            if missing_times:
                return (
                    False,
                    f"Time mismatch: excerpt specifies time(s) {missing_times} not present in source '{source_id}'",
                    0.0,
                )

        exc_words_set = set(re.findall(r"\b[a-z]+\b", exc_lower))
        source_words_set = set(re.findall(r"\b[a-z]+\b", source_lower))

        exc_month_nums = {MONTH_CANONICAL[w] for w in exc_words_set if w in MONTH_CANONICAL}
        source_month_nums = {MONTH_CANONICAL[w] for w in source_words_set if w in MONTH_CANONICAL}
        missing_months = exc_month_nums - source_month_nums
        if missing_months:
            return (
                False,
                f"Date mismatch: excerpt references month(s) not present in source '{source_id}'",
                0.0,
            )

        # ---------------------------------------------------------------------
        # Defense 2: Numeric Alteration Check with Comma and Currency Normalization
        # ---------------------------------------------------------------------
        text_for_numbers = re.sub(r"\b\d{1,2}:\d{2}\b", "", norm_excerpt)
        exc_numbers = re.findall(r"\b\d+(?:\.\d+)?\b", text_for_numbers)
        if exc_numbers:
            source_numbers = set(re.findall(r"\b\d+(?:\.\d+)?\b", norm_source))
            # Also register parsed currency and integer/lakh variants
            for val, _ in parse_indian_currency(source_text):
                source_numbers.add(str(int(val)))
                source_numbers.add(str(val))
                lakh_val = val / 100000.0
                source_numbers.add(f"{lakh_val:.1f}")
                source_numbers.add(f"{lakh_val:.2f}".rstrip("0").rstrip("."))

            missing_nums = [n for n in exc_numbers if n not in source_numbers]
            if missing_nums:
                return (
                    False,
                    f"Numeric mismatch: excerpt contains number(s) {missing_nums} not supported by source '{source_id}'",
                    0.0,
                )

        # ---------------------------------------------------------------------
        # Defense 3: Polarity and Negation Integrity Check (Inflected Forms)
        # ---------------------------------------------------------------------
        exc_negations = exc_words_set.intersection(NEGATION_TOKENS)
        source_negations = source_words_set.intersection(NEGATION_TOKENS)

        # Case 3a: Excerpt introduces negation where source has none
        if exc_negations and not source_negations:
            return (
                False,
                f"Polarity mismatch: excerpt introduces negation {sorted(exc_negations)} absent from source '{source_id}'",
                0.0,
            )

        # Case 3b: Excerpt asserts positive approval, but source explicitly negates it
        exc_approvals = exc_words_set.intersection(POSITIVE_APPROVAL_TOKENS)
        if exc_approvals and not exc_negations:
            # Check for rejection or negation of approval in source text
            rejection_patterns = [
                r"\b(?:cannot|cant|not|will not|could not|declined to|refused to|disapproved|is not|are not|was not)\s+(?:\w+\s+){0,3}(?:approve|approved|accept|accepted|grant|granted|confirm|confirmed|sanction|sanctioned)\b",
                r"\b(?:approval|permission|grant|sanction)\s+(?:is\s+|was\s+)?(?:not\s+granted|denied|rejected|refused|not\s+approved)\b",
                r"\b(?:proposal|request|application|claim)\s+(?:is\s+|was\s+)?(?:rejected|declined|disapproved|refused)\b",
                r"\bcannot approve\b",
                r"\bnot approved\b",
                r"\bnot granted\b",
            ]
            for pat in rejection_patterns:
                if re.search(pat, source_lower):
                    return (
                        False,
                        f"Polarity mismatch: excerpt asserts approval but source '{source_id}' expresses rejection/negation",
                        0.0,
                    )

        # Case 3c: Excerpt drops preceding negation in exact matching substring
        match_exc = normalize_text_for_matching(norm_excerpt)
        match_src = normalize_text_for_matching(norm_source)
        if match_exc in match_src and not exc_negations:
            pos = match_src.find(match_exc)
            if pos > 0:
                preceding_slice = match_src[max(0, pos - 25):pos].strip().split()
                if preceding_slice and preceding_slice[-1] in NEGATION_TOKENS:
                    return (
                        False,
                        f"Polarity mismatch: excerpt drops preceding negation '{preceding_slice[-1]}' from source '{source_id}'",
                        0.0,
                    )

        # ---------------------------------------------------------------------
        # Defense 4: Conditionality Misrepresentation Check
        # ---------------------------------------------------------------------
        claims_unconditional = any(u in exc_lower for u in ["unconditional", "unconditionally", "without condition", "full authorization", "is authorized", "direct purchase"])
        source_is_conditional = any(c in source_lower for c in ["budget planning only", "subject to", "conditional", "does not authorize", "prerequisite", "still follow", "procurement rules"])
        if claims_unconditional and source_is_conditional:
            return (
                False,
                f"Conditionality mismatch: excerpt claims authorization or unconditional status when source '{source_id}' is conditional or requires separate approvals",
                0.0,
            )

        if any(p in exc_lower for p in ["authorized procurement", "procurement is authorized", "purchase is authorized", "authorized purchase", "authorizes purchases", "authorizes purchase", "direct purchase"]):
            if "does not authorize procurement" in source_lower or "budget planning only" in source_lower or "does not authorize" in source_lower or "still follow" in source_lower:
                return (
                    False,
                    f"Conditionality mismatch: excerpt claims purchase authorization when source '{source_id}' is conditional or requires separate approvals under procurement rules",
                    0.0,
                )

        # ---------------------------------------------------------------------
        # Defense 5: Exact Substring or Shingle / Token Overlap (Fabrication Defense)
        # ---------------------------------------------------------------------
        if match_exc in match_src:
            return True, None, 1.0

        excerpt_words = match_exc.split()
        if len(excerpt_words) >= 4:
            matches = 0
            total_shingles = max(len(excerpt_words) - 3, 1)
            for i in range(total_shingles):
                shingle = " ".join(excerpt_words[i:i+4])
                if shingle in match_src:
                    matches += 1
            if matches / total_shingles >= 0.4:
                return True, None, 0.9

        stopwords = {"the", "a", "an", "is", "was", "for", "in", "on", "at", "to", "and", "or", "of", "with", "by", "from"}
        exc_tokens = [w for w in excerpt_words if w not in stopwords and len(w) > 2]
        if not exc_tokens:
            return True, None, 0.7

        matched_tokens = [w for w in exc_tokens if w in source_words_set]
        overlap_ratio = len(matched_tokens) / len(exc_tokens)

        if overlap_ratio >= min_token_overlap:
            confidence = min(0.6 + overlap_ratio * 0.4, 0.95)
            return True, None, round(confidence, 2)

        return (
            False,
            f"Excerpt content has insufficient support in source '{source_id}' (overlap: {overlap_ratio:.1%}, required: {min_token_overlap:.1%})",
            round(overlap_ratio, 2),
        )

    def build_evidence(
        self,
        source_id: str,
        thread_id: str,
        excerpt: str = "",
        min_token_overlap: float = 0.4,
    ) -> Optional[EvidenceReference]:
        """Construct a validated, content-aware EvidenceReference object."""
        valid, failure_reason, confidence = self.validate_reference(
            source_id, thread_id, excerpt, min_token_overlap=min_token_overlap
        )
        if not valid:
            return None

        is_attachment = source_id in self.attachments_by_name
        timestamp_str = None
        if not is_attachment and source_id in self.emails_by_id:
            timestamp_str = self.emails_by_id[source_id].iso_timestamp

        return EvidenceReference(
            source_id=source_id,
            thread_id=thread_id,
            timestamp=timestamp_str,
            excerpt=excerpt,
            is_attachment=is_attachment,
            confidence=confidence,
        )
