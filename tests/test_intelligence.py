"""Unit tests for Conversation Intelligence: Summarization, Status, Decisions, Approvals, Actions, Pipeline, and Evidence."""

import os
import sys
import unittest
from datetime import datetime

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.ingestion.loader import EmailDatasetLoader
from sutra.processing.threading import ThreadManager
from sutra.models.intelligence import (
    ThreadStatusType,
    DecisionCategory,
    ActionStatus,
    LifecycleState,
)
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.intelligence.status import ThreadStatusDetector
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.actions import ActionExtractor
from sutra.intelligence.state_machine import ThreadLifecycleTracker
from sutra.intelligence.evidence import EvidenceValidator
from sutra.intelligence.pipeline import ConversationIntelligencePipeline

DATASET_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dataset"))


class TestConversationIntelligence(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.loader = EmailDatasetLoader(DATASET_DIR)
        cls.emails = cls.loader.load_emails()
        cls.threads = ThreadManager.build_threads_from_dataset(cls.emails)
        cls.pipeline = ConversationIntelligencePipeline(cls.emails)

    def test_pipeline_all_ten_threads(self):
        """Verify pipeline successfully processes all 10 institutional threads."""
        all_intel = self.pipeline.process_all_threads(self.threads)
        self.assertEqual(len(all_intel), 10)
        for tid, intel in all_intel.items():
            self.assertEqual(intel.thread_id, tid)
            self.assertTrue(len(intel.summary) > 20)
            self.assertTrue(len(intel.latest_status) > 10)
            self.assertTrue(len(intel.evidence_references) > 0)

    def test_thr001_procurement_intelligence(self):
        """THR-001: CNC turning centre procurement with conditional approval."""
        emails = [e for e in self.emails if e.thread_id == "THR-001"]
        intel = ThreadSummarizer.summarize_thread("THR-001", emails)

        # Decision checks
        self.assertEqual(len(intel.decisions), 1)
        d = intel.decisions[0]
        self.assertEqual(d.amount_inr, 1790000.0)
        self.assertTrue(d.is_conditional)
        self.assertIn("budget confirmation", d.scope_qualifier.lower())

        # Approval check
        apps = intel.approvals
        self.assertTrue(len(apps) >= 1)
        self.assertEqual(apps[0].approver_role, "Dean (Administration)")
        self.assertTrue(apps[0].is_conditional)

        # Action check
        acts = intel.actions
        self.assertTrue(len(acts) >= 1)
        self.assertEqual(acts[0].owner, "Vendor B")
        self.assertEqual(acts[0].status, ActionStatus.PENDING)

        # Status check
        status = ThreadStatusDetector.detect_status("THR-001", emails)
        self.assertFalse(status.is_resolved)
        self.assertTrue(status.has_pending_actions)

    def test_thr009_budget_approval_vs_purchase_authorization(self):
        """THR-009: Planning approval MUST NOT equal purchase authorization."""
        emails = [e for e in self.emails if e.thread_id == "THR-009"]
        intel = ThreadSummarizer.summarize_thread("THR-009", emails)

        # Approval check
        self.assertEqual(len(intel.approvals), 1)
        app = intel.approvals[0]
        self.assertEqual(app.amount_inr, 342000.0)
        self.assertFalse(app.is_authorization, "Budget planning acceptance must NOT be marked as authorization!")
        self.assertIn("budget planning only", app.scope_qualifier.lower())

        # Decision check
        self.assertEqual(len(intel.decisions), 1)
        dec = intel.decisions[0]
        self.assertEqual(dec.category, DecisionCategory.ACCEPTANCE)
        self.assertTrue(dec.is_conditional)

    def test_thr004_utm_repair_and_resolution(self):
        """THR-004: UTM repairs (28k + 6.5k = 34.5k) and zero pending actions."""
        emails = [e for e in self.emails if e.thread_id == "THR-004"]
        intel = ThreadSummarizer.summarize_thread("THR-004", emails)

        # Total amount check
        self.assertEqual(len(intel.decisions), 1)
        dec = intel.decisions[0]
        self.assertEqual(dec.amount_inr, 34500.0)

        # Action check: must be none_stated
        self.assertEqual(len(intel.actions), 1)
        act = intel.actions[0]
        self.assertEqual(act.status, ActionStatus.NONE_STATED)
        self.assertEqual(act.owner, "none_stated")

        # Status check
        status = ThreadStatusDetector.detect_status("THR-004", emails)
        self.assertTrue(status.is_resolved)
        self.assertFalse(status.has_pending_actions)
        self.assertEqual(status.current_status, ThreadStatusType.RESOLVED)

    def test_thr008_venue_change_without_date_change(self):
        """THR-008: Room change to Lecture Hall 4 while date/time remains unchanged."""
        emails = [e for e in self.emails if e.thread_id == "THR-008"]
        intel = ThreadSummarizer.summarize_thread("THR-008", emails)

        dec = intel.decisions[0]
        self.assertEqual(dec.category, DecisionCategory.MODIFICATION)
        self.assertIn("lecture hall 4", dec.decision.lower())
        self.assertIn("unchanged", dec.scope_qualifier.lower())

    def test_evidence_validator_valid_and_invalid(self):
        """Verify strict evidence validation and hallucination prevention."""
        validator = EvidenceValidator(self.emails)

        # Valid email in thread
        is_val, reason, conf = validator.validate_reference("E005", "THR-001")
        self.assertTrue(is_val)
        self.assertIsNone(reason)

        # Email in different thread
        is_val_wrong, reason_wrong, _ = validator.validate_reference("E005", "THR-002")
        self.assertFalse(is_val_wrong)
        self.assertIn("belongs to thread 'THR-001'", reason_wrong)

        # Non-existent ID
        is_val_fake, reason_fake, _ = validator.validate_reference("E999", "THR-001")
        self.assertFalse(is_val_fake)
        self.assertIn("not found", reason_fake)

        # Attachment verification
        is_att, att_reason, _ = validator.validate_reference("cnc_purchase_order.txt", "THR-001")
        self.assertTrue(is_att)
        self.assertIsNone(att_reason)


if __name__ == "__main__":
    unittest.main()
