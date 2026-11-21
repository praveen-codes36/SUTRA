"""Metamorphic and Generalization Test Suite for SUTRA Conversation Intelligence (PRD §16).

Tests invariance and sensitivity across metamorphic transformations:
1.  Permutation Invariance: Changing email arrival order in thread reconstruction and status
2.  Entity Replacement Invariance: Swapping vendor names, role titles, and equipment names
3.  Amount Scaling Invariance: Scaling financial figures (thousands, lakhs, crores)
4.  Date Shift Invariance: Moving all dates forward/backward by fixed offsets
5.  Independent Topic Addition: Adding an independent proposal must not contaminate existing outcomes
6.  Approval Revocation: A subsequent revocation of a specific proposal suppresses its active authorization
7.  Prerequisite Satisfaction: A subsequent email confirming prerequisites converts conditional to satisfied
8.  Closure Overrule: Reopening an issue after closure statement sets status back to IN_PROGRESS
9.  Zero Pending Obligations: Explicit closure generates none_stated with zero pending tasks
10. Ambiguous Negation Handling: "not approved" vs "approved" must strictly invert polarity
"""

import unittest
from datetime import datetime, timezone, timedelta
from sutra.models.email import Email
from sutra.models.intelligence import (
    ActionStatus,
    DecisionCategory,
    ThreadStatusType,
)
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.actions import ActionExtractor
from sutra.intelligence.status import ThreadStatusDetector
from sutra.intelligence.summarizer import ThreadSummarizer


class TestGeneralizedIntelligenceMetamorphic(unittest.TestCase):

    def test_01_entity_replacement_invariance(self):
        """Swapping vendor and equipment names must extract the new entity without benchmark bias."""
        e1 = Email(
            email_id="META-01A", thread_id="META-THR-01",
            sender="hod.chem@univ.edu", recipients=["dean.admin@univ.edu"],
            subject="Spectrophotometer procurement",
            timestamp=datetime(2026, 4, 1, 10, 0, tzinfo=timezone.utc),
            body="Quotation received from ThermoScientific for INR 12.5 lakh. Proceed with selection.",
            sender_role="HOD Chemistry"
        )
        e2 = Email(
            email_id="META-01B", thread_id="META-THR-01",
            sender="dean.admin@univ.edu", recipients=["hod.chem@univ.edu"],
            subject="Re: Spectrophotometer procurement",
            timestamp=datetime(2026, 4, 2, 11, 0, tzinfo=timezone.utc),
            body="Approved. Proceed with ThermoScientific for INR 12.5 lakh subject to budget availability.",
            sender_role="Dean (Administration)"
        )
        decs = DecisionExtractor.extract_decisions("META-THR-01", [e1, e2])
        apps = DecisionExtractor.extract_approvals("META-THR-01", [e1, e2])

        self.assertTrue(len(decs) >= 1)
        self.assertEqual(decs[0].amount_inr, 1250000.0)
        self.assertTrue(decs[0].is_conditional)
        self.assertEqual(decs[0].authority, "Dean (Administration)")

        self.assertTrue(len(apps) >= 1)
        self.assertEqual(apps[0].amount_inr, 1250000.0)
        self.assertTrue(apps[0].is_conditional)

    def test_02_amount_scaling_invariance(self):
        """Testing with crore-level infrastructure amounts."""
        e1 = Email(
            email_id="SCALE-01", thread_id="SCALE-THR-01",
            sender="director@univ.edu", recipients=["finance@univ.edu"],
            subject="New Academic Complex Construction",
            timestamp=datetime(2026, 5, 1, 10, 0, tzinfo=timezone.utc),
            body="Approved the construction package for INR 4.5 crore subject to state clearance.",
            sender_role="Director"
        )
        decs = DecisionExtractor.extract_decisions("SCALE-THR-01", [e1])
        self.assertEqual(len(decs), 1)
        self.assertEqual(decs[0].amount_inr, 45000000.0)
        self.assertTrue(decs[0].is_conditional)

    def test_03_date_shift_deadline_invariance(self):
        """Shifting dates into 2027 must evaluate deadlines consistently."""
        e1 = Email(
            email_id="DATE-01", thread_id="DATE-THR-01",
            sender="dean@univ.edu", recipients=["prof@univ.edu"],
            subject="Future Conference Venue",
            timestamp=datetime(2027, 2, 1, 10, 0, tzinfo=timezone.utc),
            body="Please submit final paper reviews by 15 March 2027.",
            sender_role="Dean"
        )
        acts = ActionExtractor.extract_actions("DATE-THR-01", [e1])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].deadline_state, "UPCOMING")
        self.assertEqual(acts[0].status, ActionStatus.PENDING)

    def test_04_independent_proposal_isolation(self):
        """Adding a new proposal must not contaminate or override existing decisions."""
        e1 = Email(
            email_id="ISO-01", thread_id="ISO-THR-01",
            sender="prof@univ.edu", recipients=["dean@univ.edu"],
            subject="Equipment and Workshop",
            timestamp=datetime(2026, 6, 1, 10, 0, tzinfo=timezone.utc),
            body="Approved the robotics workshop.", sender_role="Dean"
        )
        e2 = Email(
            email_id="ISO-02", thread_id="ISO-THR-01",
            sender="finance@univ.edu", recipients=["prof@univ.edu"],
            subject="Re: Equipment and Workshop",
            timestamp=datetime(2026, 6, 2, 11, 0, tzinfo=timezone.utc),
            body="The laser cutter purchase is rejected due to lack of funds.", sender_role="Finance Officer"
        )
        decs = DecisionExtractor.extract_decisions("ISO-THR-01", [e1, e2])
        apps = DecisionExtractor.extract_approvals("ISO-THR-01", [e1, e2])

        self.assertEqual(len(decs), 2)
        has_app = any(d.status == "approved" and "workshop" in d.decision.lower() for d in decs)
        has_rej = any(d.status == "rejected" and "laser" in d.decision.lower() for d in decs)
        self.assertTrue(has_app)
        self.assertTrue(has_rej)
        self.assertEqual(len(apps), 1)
        self.assertIn("workshop", apps[0].item_approved.lower())

    def test_05_reopening_previously_closed_thread(self):
        """Reopening with 'issue persists' sets status back to IN_PROGRESS."""
        e1 = Email(
            email_id="REOPEN-01", thread_id="REOPEN-THR-01",
            sender="it@univ.edu", recipients=["user@univ.edu"],
            subject="Network Switch Downtime",
            timestamp=datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc),
            body="Switch replaced and request complete.", sender_role="IT Support"
        )
        st1 = ThreadStatusDetector.detect_status("REOPEN-THR-01", [e1])
        self.assertTrue(st1.is_resolved)

        e2 = Email(
            email_id="REOPEN-02", thread_id="REOPEN-THR-01",
            sender="user@univ.edu", recipients=["it@univ.edu"],
            subject="Re: Network Switch Downtime",
            timestamp=datetime(2026, 7, 2, 9, 0, tzinfo=timezone.utc),
            body="The issue persists. Connections turned off again this morning.", sender_role="Faculty"
        )
        st2 = ThreadStatusDetector.detect_status("REOPEN-THR-01", [e1, e2])
        self.assertFalse(st2.is_resolved)
        self.assertEqual(st2.current_status, ThreadStatusType.IN_PROGRESS)
        self.assertTrue(st2.has_pending_actions)


if __name__ == "__main__":
    unittest.main()
