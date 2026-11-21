"""Unified Conversation Intelligence Orchestration Pipeline."""

from __future__ import annotations
from typing import List, Dict, Optional, Any
from sutra.models.email import Email, Thread
from sutra.models.intelligence import ThreadIntelligence
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.intelligence.evidence import EvidenceValidator
from sutra.intelligence.llm_provider import BaseLLMProvider, get_llm_provider


class ConversationIntelligencePipeline:
    """
    Unified entry point for Person 2's Conversation Intelligence Layer.
    Extracts summaries, status, decisions, approvals, actions, lifecycles, and validates evidence.
    Supports dependency injection of LLM provider for hybrid rule + LLM extraction.
    """

    def __init__(self, emails: List[Email], llm_provider: Optional[BaseLLMProvider] = None):
        self.emails = emails
        self.emails_by_thread: Dict[str, List[Email]] = {}
        for e in emails:
            if e.thread_id not in self.emails_by_thread:
                self.emails_by_thread[e.thread_id] = []
            self.emails_by_thread[e.thread_id].append(e)

        self.evidence_validator = EvidenceValidator(emails)
        self.llm_provider = llm_provider or get_llm_provider()

    def process_thread(self, thread_id: str) -> ThreadIntelligence:
        """Process a single conversation thread through the complete intelligence pipeline."""
        emails = self.emails_by_thread.get(thread_id, [])
        intelligence = ThreadSummarizer.summarize_thread(
            thread_id, emails, llm_provider=self.llm_provider
        )

        # Validate all evidence references on extracted entities using content-aware validator
        for d in intelligence.decisions:
            for ref in d.evidence_references:
                ev = self.evidence_validator.build_evidence(
                    ref, thread_id, excerpt=d.decision, min_token_overlap=0.25
                )
                if ev:
                    d.evidence_details.append(ev)

        for a in intelligence.approvals:
            for ref in a.evidence_references:
                ev = self.evidence_validator.build_evidence(
                    ref, thread_id, excerpt=a.item_approved, min_token_overlap=0.25
                )
                if ev:
                    a.evidence_details.append(ev)

        for act in intelligence.actions:
            for ref in act.evidence_references:
                ev = self.evidence_validator.build_evidence(
                    ref, thread_id, excerpt=act.description, min_token_overlap=0.25
                )
                if ev:
                    act.evidence_details.append(ev)

        return intelligence

    def process_all_threads(self, threads: Dict[str, Thread]) -> Dict[str, ThreadIntelligence]:
        """Process all threads in batch and return mapping of thread_id -> ThreadIntelligence."""
        results: Dict[str, ThreadIntelligence] = {}
        for tid in threads.keys():
            results[tid] = self.process_thread(tid)
        return results
