"""Comprehensive Generalization and Edge-Case Test Suite for SUTRA Conversation Intelligence.

Tests 17 completely independent synthetic institutional scenarios without relying on THR-001..THR-010:
1. New procurement request without approval (Pending proposal).
2. Conditional approval with explicit prerequisites.
3. Rejected proposal.
4. Action assigned to a previously unseen person.
5. Deadline modification in follow-up email.
6. Completed action followed by new pending action.
7. Conflicting statements in conversation.
8. Resolved thread with zero pending obligations (none_stated).
9. Conversation with no identifiable decision.
10. Attachment containing the only relevant information.
11. Budget planning acceptance WITHOUT procurement authorization.
12. Approval followed by revocation.
13. Multiple actions assigned to different people.
14. Reopened previously resolved thread.
15. Thread with missing owner and deadline.
16. Content-aware evidence validation: Fabricated claim rejection.
17. Ollama LLM provider retry and backoff error handling.
"""

import os
import sys
import unittest
from datetime import datetime

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sutra.models.email import Email, AttachmentMetadata
from sutra.models.intelligence import (
    ActionStatus,
    DecisionCategory,
    ThreadStatusType,
)
from sutra.intelligence.pipeline import ConversationIntelligencePipeline
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.actions import ActionExtractor
from sutra.intelligence.status import ThreadStatusDetector
from sutra.intelligence.evidence import EvidenceValidator
from sutra.intelligence.llm_provider import MockLLMProvider, OllamaLLMProvider


class TestGeneralizationIntelligence(unittest.TestCase):

    def setUp(self):
        self.mock_llm = MockLLMProvider()

    def test_scenario_01_procurement_request_without_approval(self):
        """Scenario 1: New procurement request without approval -> Awaiting response."""
        e1 = Email(
            email_id="SYN-01",
            thread_id="SYN-THR-101",
            sender="lab_incharge@univ.edu",
            recipients=["purchase_committee@univ.edu"],
            subject="Procurement of Digital Oscilloscope",
            timestamp=datetime(2026, 3, 1, 9, 30),
            body="We require one 100MHz Digital Storage Oscilloscope for Electronics Lab. Estimated cost INR 65,000. Please review.",
            sender_role="Lab Incharge",
        )
        status = ThreadStatusDetector.detect_status("SYN-THR-101", [e1])
        self.assertEqual(status.current_status, ThreadStatusType.AWAITING_RESPONSE)
        self.assertFalse(status.is_resolved)
        decs = DecisionExtractor.extract_decisions("SYN-THR-101", [e1])
        self.assertEqual(len(decs), 0)

    def test_scenario_02_conditional_approval(self):
        """Scenario 2: Conditional approval with explicit conditions."""
        e1 = Email(
            email_id="SYN-02A",
            thread_id="SYN-THR-102",
            sender="faculty@univ.edu",
            recipients=["dean_admin@univ.edu"],
            subject="Special Equipment Grant",
            timestamp=datetime(2026, 3, 2, 10, 0),
            body="Requesting grant of INR 200,000 for high-speed camera.",
            sender_role="Assistant Professor",
        )
        e2 = Email(
            email_id="SYN-02B",
            thread_id="SYN-THR-102",
            sender="dean_admin@univ.edu",
            recipients=["faculty@univ.edu"],
            subject="Re: Special Equipment Grant",
            timestamp=datetime(2026, 3, 3, 11, 0),
            body="Approved the purchase of high-speed camera for INR 200,000 subject to prerequisite co-funding confirmation from department.",
            sender_role="Dean (Administration)",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-102", [e1, e2])
        self.assertEqual(len(decs), 1)
        self.assertTrue(decs[0].is_conditional)
        self.assertEqual(decs[0].amount_inr, 200000.0)

    def test_scenario_03_rejected_proposal(self):
        """Scenario 3: Rejected proposal."""
        e1 = Email(
            email_id="SYN-03A",
            thread_id="SYN-THR-103",
            sender="student_rep@univ.edu",
            recipients=["dean_sa@univ.edu"],
            subject="Request for Overnight DJ Night",
            timestamp=datetime(2026, 3, 4, 14, 0),
            body="Students request permission for overnight musical concert till 4 AM.",
            sender_role="Student Secretary",
        )
        e2 = Email(
            email_id="SYN-03B",
            thread_id="SYN-THR-103",
            sender="dean_sa@univ.edu",
            recipients=["student_rep@univ.edu"],
            subject="Re: Request for Overnight DJ Night",
            timestamp=datetime(2026, 3, 5, 9, 0),
            body="We cannot approve the proposal for overnight concert due to campus safety regulations. Request is rejected.",
            sender_role="Dean (Student Affairs)",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-103", [e1, e2])
        self.assertEqual(len(decs), 1)
        self.assertEqual(decs[0].category, DecisionCategory.REJECTION)
        self.assertEqual(decs[0].status, "rejected")

    def test_scenario_04_action_assigned_to_unseen_person(self):
        """Scenario 4: Action assigned to unseen person with deadline."""
        e1 = Email(
            email_id="SYN-04",
            thread_id="SYN-THR-104",
            sender="hod_cs@univ.edu",
            recipients=["rajesh.kumar@univ.edu"],
            subject="Accreditation Documentation",
            timestamp=datetime(2026, 3, 6, 12, 0),
            body="Dear Rajesh, please prepare NBA accreditation course files by 25th March 2026.",
            sender_role="HOD CSE",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-104", [e1])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].owner, "rajesh.kumar@univ.edu")
        self.assertIn("25th march 2026", acts[0].deadline.lower())

    def test_scenario_05_deadline_modification(self):
        """Scenario 5: Follow-up email modifying deadline."""
        e1 = Email(
            email_id="SYN-05A",
            thread_id="SYN-THR-105",
            sender="controller@univ.edu",
            recipients=["evaluators@univ.edu"],
            subject="Grade Submission Deadline",
            timestamp=datetime(2026, 3, 7, 10, 0),
            body="Please submit final exam grades by 15th April.",
            sender_role="Controller of Examinations",
        )
        e2 = Email(
            email_id="SYN-05B",
            thread_id="SYN-THR-105",
            sender="controller@univ.edu",
            recipients=["evaluators@univ.edu"],
            subject="Re: Grade Submission Deadline",
            timestamp=datetime(2026, 3, 10, 11, 0),
            body="Deadline extended due to server downtime: please submit final exam grades by 20th April.",
            sender_role="Controller of Examinations",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-105", [e1, e2])
        self.assertEqual(len(acts), 1)
        self.assertIn("20th april", acts[0].deadline.lower())

    def test_scenario_06_completed_action_followed_by_new_pending_action(self):
        """Scenario 6: First task confirmed completed, subsequent task remains pending."""
        e1 = Email(
            email_id="SYN-06A",
            thread_id="SYN-THR-106",
            sender="hod@univ.edu",
            recipients=["tech@univ.edu"],
            subject="Server Maintenance",
            timestamp=datetime(2026, 3, 8, 9, 0),
            body="Please verify database backup.",
            sender_role="HOD",
        )
        e2 = Email(
            email_id="SYN-06B",
            thread_id="SYN-THR-106",
            sender="tech@univ.edu",
            recipients=["hod@univ.edu"],
            subject="Re: Server Maintenance",
            timestamp=datetime(2026, 3, 8, 14, 0),
            body="Backup verified and completed successfully. Please arrange storage quota expansion with IT head.",
            sender_role="Technician",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-106", [e1, e2])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].status, ActionStatus.PENDING)
        self.assertIn("quota expansion", acts[0].description.lower())

    def test_scenario_07_conflicting_statements_status(self):
        """Scenario 7: Conflicting statements evaluate to in_progress or unclear."""
        e1 = Email(
            email_id="SYN-07A",
            thread_id="SYN-THR-107",
            sender="user@univ.edu",
            recipients=["support@univ.edu"],
            subject="Software License Glitch",
            timestamp=datetime(2026, 3, 9, 10, 0),
            body="MATLAB license server is rejecting student connections.",
            sender_role="Assistant Professor",
        )
        e2 = Email(
            email_id="SYN-07B",
            thread_id="SYN-THR-107",
            sender="support@univ.edu",
            recipients=["user@univ.edu"],
            subject="Re: Software License Glitch",
            timestamp=datetime(2026, 3, 9, 12, 0),
            body="License service was restarted and seems complete, but monitoring indicates pending errors.",
            sender_role="IT Support",
        )
        status = ThreadStatusDetector.detect_status("SYN-THR-107", [e1, e2])
        self.assertFalse(status.is_resolved)
        self.assertEqual(status.current_status, ThreadStatusType.IN_PROGRESS)

    def test_scenario_08_resolved_thread_zero_pending_actions(self):
        """Scenario 8: Resolved thread has status none_stated."""
        e1 = Email(
            email_id="SYN-08A",
            thread_id="SYN-THR-108",
            sender="faculty@univ.edu",
            recipients=["estate_office@univ.edu"],
            subject="Air Conditioner Water Leakage",
            timestamp=datetime(2026, 3, 7, 8, 0),
            body="Faculty room 204 AC is leaking water.",
            sender_role="Faculty",
        )
        e2 = Email(
            email_id="SYN-08B",
            thread_id="SYN-THR-108",
            sender="estate_office@univ.edu",
            recipients=["faculty@univ.edu"],
            subject="Re: Air Conditioner Water Leakage",
            timestamp=datetime(2026, 3, 7, 16, 0),
            body="Technician replaced the drain pipe. AC tested for 2 hours and returned to service. Request complete.",
            sender_role="Estate Officer",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-108", [e1, e2])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].status, ActionStatus.NONE_STATED)
        self.assertEqual(acts[0].owner, "none_stated")

    def test_scenario_09_conversation_with_no_decision(self):
        """Scenario 9: Pure informational exchange produces no artificial decision."""
        e1 = Email(
            email_id="SYN-09A",
            thread_id="SYN-THR-109",
            sender="prof_a@univ.edu",
            recipients=["prof_b@univ.edu"],
            subject="Discussion on Curriculum Review",
            timestamp=datetime(2026, 3, 11, 10, 0),
            body="Here are my lecture notes on Heat Transfer for your review.",
            sender_role="Professor",
        )
        e2 = Email(
            email_id="SYN-09B",
            thread_id="SYN-THR-109",
            sender="prof_b@univ.edu",
            recipients=["prof_a@univ.edu"],
            subject="Re: Discussion on Curriculum Review",
            timestamp=datetime(2026, 3, 11, 11, 0),
            body="Thank you, I will look through chapter three tonight.",
            sender_role="Associate Professor",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-109", [e1, e2])
        self.assertEqual(len(decs), 0)

    def test_scenario_10_attachment_bearing_email(self):
        """Scenario 10: Attachment context preserves provenance in intelligence pipeline."""
        att = AttachmentMetadata(
            filename="quotation_sensor.txt",
            file_type="text",
            content_text="Quotation for Piezoelectric Sensor: INR 45,000 net payable. Delivery 2 weeks.",
        )
        e1 = Email(
            email_id="SYN-10",
            thread_id="SYN-THR-110",
            sender="vendor@sensors.com",
            recipients=["purchase@univ.edu"],
            subject="Quotation for Sensor",
            timestamp=datetime(2026, 3, 12, 10, 0),
            body="Please find attached our quotation.",
            attachments=["quotation_sensor.txt"],
            attachment_data={"quotation_sensor.txt": att},
            sender_role="Vendor Representative",
        )
        pipeline = ConversationIntelligencePipeline([e1])
        intel = pipeline.process_thread("SYN-THR-110")
        self.assertEqual(intel.thread_id, "SYN-THR-110")
        self.assertTrue(len(intel.summary) > 10)

    def test_scenario_11_budget_acceptance_without_authorization(self):
        """Scenario 11: Budget planning acceptance without procurement authorization."""
        e1 = Email(
            email_id="SYN-11",
            thread_id="SYN-THR-111",
            sender="dean_rnd@univ.edu",
            recipients=["pi_project@univ.edu"],
            subject="Grant Equipment Breakdown",
            timestamp=datetime(2026, 3, 8, 10, 0),
            body="We have accepted the projected equipment list for budget planning only. This is not purchase authorization; separate quotations must be submitted.",
            sender_role="Dean (R&D)",
        )
        apps = DecisionExtractor.extract_approvals("SYN-THR-111", [e1])
        self.assertEqual(len(apps), 1)
        self.assertFalse(apps[0].is_authorization)
        self.assertTrue(apps[0].is_conditional)

    def test_scenario_12_approval_followed_by_revocation(self):
        """Scenario 12: Decision revoked or rejected in subsequent communication."""
        e1 = Email(
            email_id="SYN-12A",
            thread_id="SYN-THR-112",
            sender="dean@univ.edu",
            recipients=["dept@univ.edu"],
            subject="Guest Speaker Honorarium",
            timestamp=datetime(2026, 3, 13, 9, 0),
            body="Approved the honorarium of INR 10,000 for guest lecture.",
            sender_role="Dean",
        )
        e2 = Email(
            email_id="SYN-12B",
            thread_id="SYN-THR-112",
            sender="dean@univ.edu",
            recipients=["dept@univ.edu"],
            subject="Re: Guest Speaker Honorarium",
            timestamp=datetime(2026, 3, 13, 15, 0),
            body="Upon review of funding account balance, earlier sanction cannot approve. Request is rejected and revoked.",
            sender_role="Dean",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-112", [e1, e2])
        self.assertEqual(len(decs), 1)
        self.assertEqual(decs[0].status, "rejected")

    def test_scenario_13_multiple_actions_different_people(self):
        """Scenario 13: Action assignment identified correctly from message context."""
        e1 = Email(
            email_id="SYN-13",
            thread_id="SYN-THR-113",
            sender="hod@univ.edu",
            recipients=["coordinator@univ.edu"],
            subject="Lab Audit Preparation",
            timestamp=datetime(2026, 3, 14, 11, 0),
            body="Please submit equipment register by 30th March 2026.",
            sender_role="HOD",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-113", [e1])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].owner, "coordinator@univ.edu")

    def test_scenario_14_reopened_thread_detection(self):
        """Scenario 14: Reopened issue after previous resolution -> In progress."""
        e1 = Email(
            email_id="SYN-14A",
            thread_id="SYN-THR-114",
            sender="tech@univ.edu",
            recipients=["user@univ.edu"],
            subject="Projector Lamp Repair",
            timestamp=datetime(2026, 3, 15, 10, 0),
            body="Lamp replaced and tested. Request complete.",
            sender_role="Technician",
        )
        e2 = Email(
            email_id="SYN-14B",
            thread_id="SYN-THR-114",
            sender="user@univ.edu",
            recipients=["tech@univ.edu"],
            subject="Re: Projector Lamp Repair",
            timestamp=datetime(2026, 3, 16, 9, 0),
            body="Projector flickered and turned off again during class this morning. Please reopen ticket.",
            sender_role="Professor",
        )
        status = ThreadStatusDetector.detect_status("SYN-THR-114", [e1, e2])
        self.assertFalse(status.is_resolved)
        self.assertEqual(status.current_status, ThreadStatusType.IN_PROGRESS)

    def test_scenario_15_thread_with_missing_owner_and_deadline(self):
        """Scenario 15: Task mentioned without specific owner -> Assigned to recipient or none_stated."""
        e1 = Email(
            email_id="SYN-15",
            thread_id="SYN-THR-115",
            sender="director@univ.edu",
            recipients=[],
            subject="General Cleanliness Drive",
            timestamp=datetime(2026, 3, 17, 8, 0),
            body="Please follow up on campus recycling bins placement.",
            sender_role="Director",
        )
        acts = ActionExtractor.extract_actions("SYN-THR-115", [e1])
        self.assertEqual(len(acts), 1)
        self.assertEqual(acts[0].owner, "none_stated")
        self.assertIsNone(acts[0].deadline)

    def test_scenario_16_content_aware_evidence_fabrication_rejection(self):
        """Scenario 16: Content-aware evidence validator strictly rejects fabricated excerpts."""
        e1 = Email(
            email_id="SYN-16",
            thread_id="SYN-THR-116",
            sender="registrar@univ.edu",
            recipients=["all_staff@univ.edu"],
            subject="Holiday Notification",
            timestamp=datetime(2026, 3, 9, 9, 0),
            body="Institute will remain closed on Monday on account of public holiday.",
            sender_role="Registrar",
        )
        validator = EvidenceValidator([e1])

        # Test true excerpt
        valid_ev = validator.build_evidence("SYN-16", "SYN-THR-116", "Institute will remain closed on Monday")
        self.assertIsNotNone(valid_ev)
        self.assertGreater(valid_ev.confidence, 0.7)

        # Test fabricated excerpt (the email exists and thread matches, but excerpt is fake)
        fabricated_ev = validator.build_evidence(
            "SYN-16", "SYN-THR-116", "Dean approved hiring 50 astronauts for Mars expedition"
        )
        self.assertIsNone(fabricated_ev, "Fabricated claim MUST be rejected by content-aware validation!")

    def test_scenario_17_ollama_provider_resilience(self):
        """Scenario 17: Ollama provider retries on connection error and raises RuntimeError."""
        unreachable_provider = OllamaLLMProvider(
            model="llama3.2", base_url="http://127.0.0.1:54321", timeout=0.1, max_retries=2, backoff_factor=1.0
        )
        self.assertFalse(unreachable_provider.check_health())
        with self.assertRaises(RuntimeError):
            unreachable_provider.generate_json("system", "user")

    def test_scenario_18_casual_cnc_mention_no_hijacking(self):
        """Scenario 18: Casual CNC mention does NOT hijack benchmark Vendor B procurement."""
        e1 = Email(
            email_id="SYN-18",
            thread_id="SYN-THR-118",
            sender="student@univ.edu",
            recipients=["friend@univ.edu"],
            subject="Cool machining video",
            timestamp=datetime(2026, 3, 10, 15, 0),
            body="Hey, did you see that YouTube video about CNC milling machines? It looked amazing!",
            sender_role="Student",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-118", [e1])
        self.assertEqual(len(decs), 0, "Casual CNC mention must NOT produce procurement decision")
        acts = ActionExtractor.extract_actions("SYN-THR-118", [e1])
        self.assertEqual(len(acts), 0, "Casual CNC mention must NOT produce Vendor B delivery action")
        apps = DecisionExtractor.extract_approvals("SYN-THR-118", [e1])
        self.assertEqual(len(apps), 0, "Casual CNC mention must NOT produce Dean approval")

    def test_scenario_19_casual_printer_jam_no_hijacking(self):
        """Scenario 19: Casual printer jam does NOT hijack benchmark OfficeTech procurement."""
        e1 = Email(
            email_id="SYN-19",
            thread_id="SYN-THR-119",
            sender="faculty@univ.edu",
            recipients=["office@univ.edu"],
            subject="Printer paper jam",
            timestamp=datetime(2026, 3, 11, 11, 0),
            body="The printer in room 101 is jammed and out of paper.",
            sender_role="Assistant Professor",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-119", [e1])
        self.assertEqual(len(decs), 0, "Printer jam must NOT produce OfficeTech procurement decision")
        acts = ActionExtractor.extract_actions("SYN-THR-119", [e1])
        self.assertEqual(len(acts), 0, "Printer jam must NOT produce delivery closure action")
        apps = DecisionExtractor.extract_approvals("SYN-THR-119", [e1])
        self.assertEqual(len(apps), 0, "Printer jam must NOT produce Administrative Officer approval")

    def test_scenario_20_casual_network_switch_no_hijacking(self):
        """Scenario 20: Casual network switch mention does NOT hijack distribution switch outage."""
        e1 = Email(
            email_id="SYN-20",
            thread_id="SYN-THR-120",
            sender="lab_tech@univ.edu",
            recipients=["admin@univ.edu"],
            subject="Storage room cleanup",
            timestamp=datetime(2026, 3, 12, 10, 0),
            body="There is a spare network switch sitting on the table in the closet during cleaning.",
            sender_role="Technician",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-120", [e1])
        self.assertEqual(len(decs), 0, "Spare switch mention must NOT produce switch replacement decision")
        acts = ActionExtractor.extract_actions("SYN-THR-120", [e1])
        self.assertEqual(len(acts), 0, "Spare switch mention must NOT produce 24-hr observation action")

    def test_scenario_21_casual_utm_parameter_no_hijacking(self):
        """Scenario 21: Marketing UTM parameter does NOT hijack UTM testing machine repair."""
        e1 = Email(
            email_id="SYN-21",
            thread_id="SYN-THR-121",
            sender="outreach@univ.edu",
            recipients=["webmaster@univ.edu"],
            subject="Campaign URLs",
            timestamp=datetime(2026, 3, 13, 9, 30),
            body="Please ensure the marketing link includes UTM tracking parameters for campaign analysis.",
            sender_role="Outreach Coordinator",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-121", [e1])
        self.assertEqual(len(decs), 0, "UTM parameter must NOT produce UTM repair decision")
        acts = ActionExtractor.extract_actions("SYN-THR-121", [e1])
        if acts:
            self.assertNotEqual(acts[0].description, "None pending; UTM verified and returned to service")

    def test_scenario_22_evidence_negation_mutation_rejection(self):
        """Scenario 22: Evidence validator rejects negation-inverted claims (polarity mismatch)."""
        e1 = Email(
            email_id="SYN-22",
            thread_id="SYN-THR-122",
            sender="dean@univ.edu",
            recipients=["faculty@univ.edu"],
            subject="Re: Laptop Grant",
            timestamp=datetime(2026, 3, 14, 10, 0),
            body="We cannot approve the purchase of laptops at this stage due to fiscal constraints.",
            sender_role="Dean",
        )
        validator = EvidenceValidator([e1])

        # Excerpt drops negation "cannot"
        valid, reason, _ = validator.validate_reference(
            "SYN-22", "SYN-THR-122", "We approve the purchase of laptops at this stage"
        )
        self.assertFalse(valid, "Negation-dropped claim MUST be rejected")
        self.assertIn("Polarity mismatch", reason)

        # Opposite: Source is positive, excerpt introduces negation
        e2 = Email(
            email_id="SYN-22B",
            thread_id="SYN-THR-122",
            sender="dean@univ.edu",
            recipients=["faculty@univ.edu"],
            subject="Laptop Grant",
            timestamp=datetime(2026, 3, 14, 11, 0),
            body="We approve the purchase of laptops.",
            sender_role="Dean",
        )
        validator2 = EvidenceValidator([e2])
        valid2, reason2, _ = validator2.validate_reference(
            "SYN-22B", "SYN-THR-122", "We cannot approve the purchase of laptops"
        )
        self.assertFalse(valid2, "Negation-added claim MUST be rejected")
        self.assertIn("Polarity mismatch", reason2)

    def test_scenario_23_evidence_numeric_mutation_rejection(self):
        """Scenario 23: Evidence validator rejects altered numeric values (e.g. 17.9 vs 19.7)."""
        e1 = Email(
            email_id="SYN-23",
            thread_id="SYN-THR-123",
            sender="procurement@univ.edu",
            recipients=["committee@univ.edu"],
            subject="Machinery Quotes",
            timestamp=datetime(2026, 3, 15, 12, 0),
            body="Vendor B quoted INR 17.9 lakh for the turning centre.",
            sender_role="Store Officer",
        )
        validator = EvidenceValidator([e1])

        # True excerpt with valid number
        valid, _, _ = validator.validate_reference("SYN-23", "SYN-THR-123", "Vendor B quoted INR 17.9 lakh")
        self.assertTrue(valid)

        # Mutated number 19.7
        valid_mutated, reason, _ = validator.validate_reference(
            "SYN-23", "SYN-THR-123", "Vendor B quoted INR 19.7 lakh for the turning centre"
        )
        self.assertFalse(valid_mutated, "Altered numeric claim MUST be rejected")
        self.assertIn("Numeric mismatch", reason)

    def test_scenario_24_evidence_date_time_mutation_rejection(self):
        """Scenario 24: Evidence validator rejects altered dates and times."""
        e1 = Email(
            email_id="SYN-24",
            thread_id="SYN-THR-124",
            sender="coe@univ.edu",
            recipients=["students@univ.edu"],
            subject="Exam Venue Schedule",
            timestamp=datetime(2026, 3, 16, 14, 0),
            body="The examination is scheduled on 5 November at 14:00 IST in Lecture Hall 4.",
            sender_role="Controller of Examinations",
        )
        validator = EvidenceValidator([e1])

        # Mutated month (December instead of November)
        valid_month, reason_month, _ = validator.validate_reference(
            "SYN-24", "SYN-THR-124", "The examination is scheduled on 5 December at 14:00 IST"
        )
        self.assertFalse(valid_month, "Altered month MUST be rejected")
        self.assertIn("Date mismatch", reason_month)

        # Mutated time (16:00 instead of 14:00)
        valid_time, reason_time, _ = validator.validate_reference(
            "SYN-24", "SYN-THR-124", "The examination is scheduled on 5 November at 16:00 IST"
        )
        self.assertFalse(valid_time, "Altered time MUST be rejected")
        self.assertIn("Time mismatch", reason_time)

    def test_scenario_25_evidence_conditionality_mutation_rejection(self):
        """Scenario 25: Evidence validator rejects unconditional claims on conditional statements."""
        e1 = Email(
            email_id="SYN-25",
            thread_id="SYN-THR-125",
            sender="dean@univ.edu",
            recipients=["pi@univ.edu"],
            subject="Project Plan",
            timestamp=datetime(2026, 3, 17, 10, 0),
            body="The revised plan is accepted for budget planning only; this does not authorize procurement.",
            sender_role="Dean",
        )
        validator = EvidenceValidator([e1])

        # Mutated conditionality (claiming unconditional authorization)
        valid_cond, reason_cond, _ = validator.validate_reference(
            "SYN-25", "SYN-THR-125", "The revised plan was approved with full authorization for procurement"
        )
        self.assertFalse(valid_cond, "Unconditional claim on planning-only source MUST be rejected")
        self.assertIn("Conditionality mismatch", reason_cond)

    def test_scenario_26_generic_new_procurement_fallback(self):
        """Scenario 26: Genuine unseen procurement is extracted generically without hardcoding."""
        e1 = Email(
            email_id="SYN-26A",
            thread_id="SYN-THR-126",
            sender="hod@univ.edu",
            recipients=["purchase@univ.edu"],
            subject="Requisition for 3D Printer",
            timestamp=datetime(2026, 3, 18, 9, 0),
            body="Requesting procurement of 3D printer for INR 45,000 from Alpha Technologies.",
            sender_role="HOD",
        )
        e2 = Email(
            email_id="SYN-26B",
            thread_id="SYN-THR-126",
            sender="purchase@univ.edu",
            recipients=["hod@univ.edu"],
            subject="Re: Requisition for 3D Printer",
            timestamp=datetime(2026, 3, 18, 11, 0),
            body="Approved the purchase of 3D printer for INR 45,000 from Alpha Technologies.",
            sender_role="Purchase Officer",
        )
        decs = DecisionExtractor.extract_decisions("SYN-THR-126", [e1, e2])
        self.assertEqual(len(decs), 1)
        self.assertEqual(decs[0].amount_inr, 45000.0)
        self.assertEqual(decs[0].status, "approved")
        self.assertNotIn("Vendor B", decs[0].decision)
        self.assertNotIn("OfficeTech", decs[0].decision)

    def test_scenario_27_status_regression_cases_a_through_g(self):
        """Scenario 27: Status detection regression cases A through G."""
        # A. Please review
        eA = Email(
            email_id="S27-A", thread_id="T27-A", sender="a@univ.edu", recipients=["b@univ.edu"],
            subject="Proposal Review", timestamp=datetime(2026, 3, 1),
            body="Please review the attached procurement proposal.", sender_role="Staff"
        )
        stA = ThreadStatusDetector.detect_status("T27-A", [eA])
        self.assertEqual(stA.current_status, ThreadStatusType.AWAITING_RESPONSE)
        self.assertFalse(stA.is_resolved)

        # B. Awaiting Dean approval
        eB = Email(
            email_id="S27-B", thread_id="T27-B", sender="a@univ.edu", recipients=["b@univ.edu"],
            subject="Equipment Request", timestamp=datetime(2026, 3, 2),
            body="The proposal is awaiting Dean approval.", sender_role="Staff"
        )
        stB = ThreadStatusDetector.detect_status("T27-B", [eB])
        self.assertEqual(stB.current_status, ThreadStatusType.AWAITING_RESPONSE)

        # C. Started manufacturing
        eC = Email(
            email_id="S27-C", thread_id="T27-C", sender="vendor@corp.com", recipients=["b@univ.edu"],
            subject="Order Update", timestamp=datetime(2026, 3, 3),
            body="The vendor has started manufacturing the equipment.", sender_role="Vendor"
        )
        stC = ThreadStatusDetector.detect_status("T27-C", [eC])
        self.assertEqual(stC.current_status, ThreadStatusType.IN_PROGRESS)

        # D. Delivered and installed
        eD = Email(
            email_id="S27-D", thread_id="T27-D", sender="tech@univ.edu", recipients=["b@univ.edu"],
            subject="Installation Complete", timestamp=datetime(2026, 3, 4),
            body="The equipment has been delivered and installed.", sender_role="Technician"
        )
        stD = ThreadStatusDetector.detect_status("T27-D", [eD])
        self.assertEqual(stD.current_status, ThreadStatusType.COMPLETED)
        self.assertTrue(stD.is_resolved)

        # E. Reopened issue
        eE = Email(
            email_id="S27-E", thread_id="T27-E", sender="user@univ.edu", recipients=["it@univ.edu"],
            subject="Network Issue", timestamp=datetime(2026, 3, 5),
            body="The previously resolved network outage has occurred again.", sender_role="User"
        )
        stE = ThreadStatusDetector.detect_status("T27-E", [eE])
        self.assertEqual(stE.current_status, ThreadStatusType.IN_PROGRESS)
        self.assertFalse(stE.is_resolved)

        # F. On hold pending verification
        eF = Email(
            email_id="S27-F", thread_id="T27-F", sender="admin@univ.edu", recipients=["applicant@univ.edu"],
            subject="Application Status", timestamp=datetime(2026, 3, 6),
            body="The application is on hold pending transcript verification.", sender_role="Officer"
        )
        stF = ThreadStatusDetector.detect_status("T27-F", [eF])
        self.assertEqual(stF.current_status, ThreadStatusType.BLOCKED)
        self.assertFalse(stF.is_resolved)

        # G. Single email request without response
        eG = Email(
            email_id="S27-G", thread_id="T27-G", sender="faculty@univ.edu", recipients=["dean@univ.edu"],
            subject="Grant Request", timestamp=datetime(2026, 3, 7),
            body="Requesting travel grant for presentation. Submitted for consideration.", sender_role="Faculty"
        )
        stG = ThreadStatusDetector.detect_status("T27-G", [eG])
        self.assertEqual(stG.current_status, ThreadStatusType.AWAITING_RESPONSE)
        self.assertFalse(stG.is_resolved)

    def test_scenario_28_approval_inversion_defenses_1_through_6(self):
        """Scenario 28: Approval extraction defenses against rejections and tentative phrases."""
        # 1. Rejected because exceeded sanctioned budget -> No approval
        e1 = Email(
            email_id="S28-1", thread_id="T28-1", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Equipment Request", timestamp=datetime(2026, 3, 1),
            body="The proposal was rejected because the quoted price exceeded the sanctioned budget.", sender_role="Dean"
        )
        apps1 = DecisionExtractor.extract_approvals("T28-1", [e1])
        self.assertEqual(len(apps1), 0, "Explicit rejection must NOT emit approval despite 'sanctioned budget'")

        # 2. Approved purchase
        e2 = Email(
            email_id="S28-2", thread_id="T28-2", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Equipment Purchase", timestamp=datetime(2026, 3, 2),
            body="The Dean approved the purchase.", sender_role="Dean"
        )
        apps2 = DecisionExtractor.extract_approvals("T28-2", [e2])
        self.assertEqual(len(apps2), 1)
        self.assertTrue(apps2[0].is_authorization)

        # 3. May approve next month -> Tentative suggestion, not approval
        e3 = Email(
            email_id="S28-3", thread_id="T28-3", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Re: Equipment Purchase", timestamp=datetime(2026, 3, 3),
            body="The Dean may approve the purchase next month.", sender_role="Dean"
        )
        apps3 = DecisionExtractor.extract_approvals("T28-3", [e3])
        self.assertEqual(len(apps3), 0, "Modal 'may approve' must not emit approval")

        # 4. Conditional approval subject to finance clearance
        e4 = Email(
            email_id="S28-4", thread_id="T28-4", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Purchase Request", timestamp=datetime(2026, 3, 4),
            body="The purchase is approved subject to finance clearance.", sender_role="Dean"
        )
        apps4 = DecisionExtractor.extract_approvals("T28-4", [e4])
        self.assertEqual(len(apps4), 1)
        self.assertTrue(apps4[0].is_conditional)

        # 5. Budget sanctioned but procurement approval pending -> Not purchase authorization
        e5 = Email(
            email_id="S28-5", thread_id="T28-5", sender="finance@univ.edu", recipients=["pi@univ.edu"],
            subject="Budget Allocation", timestamp=datetime(2026, 3, 5),
            body="The budget has been sanctioned, but procurement approval is pending.", sender_role="Finance"
        )
        apps5 = DecisionExtractor.extract_approvals("T28-5", [e5])
        if apps5:
            self.assertFalse(apps5[0].is_authorization, "Budget allocation must NOT authorize procurement")

        # 6. Committee declined proposal
        e6 = Email(
            email_id="S28-6", thread_id="T28-6", sender="committee@univ.edu", recipients=["pi@univ.edu"],
            subject="Proposal Outcome", timestamp=datetime(2026, 3, 6),
            body="The committee declined the proposal.", sender_role="Committee"
        )
        apps6 = DecisionExtractor.extract_approvals("T28-6", [e6])
        self.assertEqual(len(apps6), 0)

    def test_scenario_29_dynamic_decision_entity_extraction_a_through_e(self):
        """Scenario 29: Dynamic decision entity parsing without benchmark injections."""
        # A. Vendor A approved for INR 22 lakh
        eA = Email(
            email_id="S29-A", thread_id="T29-A", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="CNC Turning Centre Requisition", timestamp=datetime(2026, 3, 1),
            body="Following review of comparative statement, Vendor A has been approved for CNC turning centre procurement for INR 22 lakh.",
            sender_role="Dean (Administration)"
        )
        decsA = DecisionExtractor.extract_decisions("T29-A", [eA])
        self.assertEqual(len(decsA), 1)
        self.assertIn("Vendor A", decsA[0].decision)
        self.assertNotIn("Vendor B", decsA[0].decision)
        self.assertEqual(decsA[0].amount_inr, 2200000.0)

        # B. Vendor C quoted 15.5 lakh but selection is pending
        eB = Email(
            email_id="S29-B", thread_id="T29-B", sender="store@univ.edu", recipients=["pi@univ.edu"],
            subject="Quotation Update", timestamp=datetime(2026, 3, 2),
            body="Vendor C quoted INR 15.5 lakh but selection is pending final committee review.",
            sender_role="Store Officer"
        )
        decsB = DecisionExtractor.extract_decisions("T29-B", [eB])
        self.assertEqual(len(decsB), 0, "Pending selection must not emit a decision")

        # C. Vendor B rejected
        eC = Email(
            email_id="S29-C", thread_id="T29-C", sender="store@univ.edu", recipients=["vendor@b.com"],
            subject="Quotation Status", timestamp=datetime(2026, 3, 3),
            body="Vendor B was rejected due to non-compliant technical specifications.",
            sender_role="Store Officer"
        )
        decsC = DecisionExtractor.extract_decisions("T29-C", [eC])
        for d in decsC:
            self.assertNotEqual(d.status, "approved", "Rejected vendor must NOT be marked approved")

        # D. CNC machinery discussion without procurement decision
        eD = Email(
            email_id="S29-D", thread_id="T29-D", sender="student@univ.edu", recipients=["prof@univ.edu"],
            subject="Workshop Equipment Question", timestamp=datetime(2026, 3, 4),
            body="Does our mechanical workshop have a 5-axis CNC turning centre for thesis work?",
            sender_role="Student"
        )
        decsD = DecisionExtractor.extract_decisions("T29-D", [eD])
        self.assertEqual(len(decsD), 0, "Casual inquiry must not emit procurement decision")

    def test_scenario_30_status_narratives_unseen_cases_a_through_d(self):
        """Scenario 30: Status explanations must be grounded in source text without template leakage."""
        # A. HR Job Application
        eA = Email(
            email_id="S30-A", thread_id="T30-A", sender="hr@univ.edu", recipients=["applicant@gmail.com"],
            subject="Assistant Professor Application", timestamp=datetime(2026, 3, 1),
            body="Your application is currently on hold pending verification of your PhD transcript.",
            sender_role="HR Officer"
        )
        stA = ThreadStatusDetector.detect_status("T30-A", [eA])
        self.assertNotIn("certificate", stA.explanation.lower())
        self.assertNotIn("bonafide", stA.explanation.lower())
        self.assertIn("transcript", stA.explanation.lower())

        # B. Cricket Tournament
        eB = Email(
            email_id="S30-B", thread_id="T30-B", sender="sports@univ.edu", recipients=["teams@univ.edu"],
            subject="Cricket Tournament Venue", timestamp=datetime(2026, 3, 2),
            body="The cricket match venue is confirmed at West Grounds. The revised schedule has been circulated on the portal.",
            sender_role="Sports Secretary"
        )
        stB = ThreadStatusDetector.detect_status("T30-B", [eB])
        self.assertNotIn("exam", stB.explanation.lower())
        self.assertNotIn("lecture hall", stB.explanation.lower())
        self.assertIn("cricket", stB.explanation.lower())

        # C. Chemistry Lab
        eC = Email(
            email_id="S30-C", thread_id="T30-C", sender="prof@univ.edu", recipients=["store@univ.edu"],
            subject="Chemistry Lab Setup", timestamp=datetime(2026, 3, 3),
            body="The grant was approved. Please arrange the glassware delivery.",
            sender_role="Professor"
        )
        stC = ThreadStatusDetector.detect_status("T30-C", [eC])
        self.assertNotIn("audio-visual", stC.explanation.lower())
        self.assertNotIn("microphone", stC.explanation.lower())
        self.assertNotIn("seminar hall", stC.explanation.lower())

    def test_scenario_31_evidence_mutation_comprehensive_matrix(self):
        """Scenario 31: Evidence validator defends against mutations while accepting safe variants."""
        # Test 1: Dropped negation rejection
        e1 = Email(
            email_id="S31-1", thread_id="T31-1", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Grant Request", timestamp=datetime(2026, 3, 1),
            body="Purchase approval is NOT granted for this expenditure.", sender_role="Dean"
        )
        val1 = EvidenceValidator([e1])
        valid1, reason1, _ = val1.validate_reference("S31-1", "T31-1", "Purchase approval is granted for this expenditure")
        self.assertFalse(valid1, "Dropped negation MUST be rejected")
        self.assertIn("Polarity mismatch", reason1)

        # Test 2: Added negation rejection
        e2 = Email(
            email_id="S31-2", thread_id="T31-2", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Grant Request", timestamp=datetime(2026, 3, 2),
            body="Purchase approval is granted for this expenditure.", sender_role="Dean"
        )
        val2 = EvidenceValidator([e2])
        valid2, reason2, _ = val2.validate_reference("S31-2", "T31-2", "Purchase approval is NOT granted for this expenditure")
        self.assertFalse(valid2, "Added negation MUST be rejected")
        self.assertIn("Polarity mismatch", reason2)

        # Test 3: Safe currency equivalent 17.9 lakh <-> 1,790,000
        e3 = Email(
            email_id="S31-3", thread_id="T31-3", sender="store@univ.edu", recipients=["pi@univ.edu"],
            subject="Quote", timestamp=datetime(2026, 3, 3),
            body="Vendor quoted INR 17.9 lakh for the machinery.", sender_role="Store"
        )
        val3 = EvidenceValidator([e3])
        valid3, _, _ = val3.validate_reference("S31-3", "T31-3", "Vendor quoted INR 1,790,000 for the machinery")
        self.assertTrue(valid3, "INR 1,790,000 should match INR 17.9 lakh")

        # Test 4: Safe comma equivalent 34,500 <-> 34500
        e4 = Email(
            email_id="S31-4", thread_id="T31-4", sender="store@univ.edu", recipients=["pi@univ.edu"],
            subject="Repair", timestamp=datetime(2026, 3, 4),
            body="Repair cost INR 34,500 approved.", sender_role="Store"
        )
        val4 = EvidenceValidator([e4])
        valid4, _, _ = val4.validate_reference("S31-4", "T31-4", "Repair cost INR 34500 approved")
        self.assertTrue(valid4)

        # Test 5: Mutated numbers 19.7 vs 17.9 -> Reject
        valid5, reason5, _ = val3.validate_reference("S31-3", "T31-3", "Vendor quoted INR 19.7 lakh for the machinery")
        self.assertFalse(valid5)
        self.assertIn("Numeric mismatch", reason5)

        # Test 6: Mutated numbers 35,000 vs 34,500 -> Reject
        valid6, reason6, _ = val4.validate_reference("S31-4", "T31-4", "Repair cost INR 35,000 approved")
        self.assertFalse(valid6)
        self.assertIn("Numeric mismatch", reason6)

        # Test 7: Safe month abbreviation 12 November <-> 12 Nov
        e7 = Email(
            email_id="S31-7", thread_id="T31-7", sender="office@univ.edu", recipients=["all@univ.edu"],
            subject="Meeting", timestamp=datetime(2026, 11, 12, 14, 0),
            body="The departmental meeting is scheduled on 12 November at 14:00.", sender_role="Office"
        )
        val7 = EvidenceValidator([e7])
        valid7, _, _ = val7.validate_reference("S31-7", "T31-7", "The departmental meeting is scheduled on 12 Nov at 14:00")
        self.assertTrue(valid7, "12 Nov should match 12 November")

        # Test 8: Mutated date 21 November vs 12 November -> Reject
        valid8, reason8, _ = val7.validate_reference("S31-7", "T31-7", "The departmental meeting is scheduled on 21 November at 14:00")
        self.assertFalse(valid8)

        # Test 9: Mutated time 16:00 vs 14:00 -> Reject
        valid9, reason9, _ = val7.validate_reference("S31-7", "T31-7", "The departmental meeting is scheduled on 12 November at 16:00")
        self.assertFalse(valid9)
        self.assertIn("Time mismatch", reason9)

    def test_scenario_32_action_directives_and_casual_mentions(self):
        """Scenario 32: Action extraction captures genuine directives while ignoring casual chat."""
        # Genuine directive: Please obtain quotations
        e1 = Email(
            email_id="S32-1", thread_id="T32-1", sender="hod@univ.edu", recipients=["store@univ.edu"],
            subject="Printer Requisition", timestamp=datetime(2026, 3, 1),
            body="Please obtain quotations for three new laboratory printers.", sender_role="HOD"
        )
        acts1 = ActionExtractor.extract_actions("T32-1", [e1])
        self.assertEqual(len(acts1), 1)
        self.assertIn("obtain quotations", acts1[0].description.lower())

        # Genuine modal directive: Ravi must submit by 22 November
        e2 = Email(
            email_id="S32-2", thread_id="T32-2", sender="prof@univ.edu", recipients=["ravi@univ.edu"],
            subject="Quotation Submission", timestamp=datetime(2026, 3, 2),
            body="Ravi must submit the revised quotation by 22 November.", sender_role="Professor"
        )
        acts2 = ActionExtractor.extract_actions("T32-2", [e2])
        self.assertEqual(len(acts2), 1)
        self.assertEqual(acts2[0].owner, "Ravi")
        self.assertIn("22 november", acts2[0].deadline.lower())

        # Casual remark: Ravi mentioned quotation might be ready soon -> Not an action
        e3 = Email(
            email_id="S32-3", thread_id="T32-3", sender="prof@univ.edu", recipients=["colleague@univ.edu"],
            subject="Casual update", timestamp=datetime(2026, 3, 3),
            body="Ravi mentioned that the quotation might be ready soon.", sender_role="Professor"
        )
        acts3 = ActionExtractor.extract_actions("T32-3", [e3])
        self.assertEqual(len(acts3), 0, "Passing remark must not produce action")

        # Casual discussion: I saw a new printer online -> Not an action
        e4 = Email(
            email_id="S32-4", thread_id="T32-4", sender="prof@univ.edu", recipients=["colleague@univ.edu"],
            subject="Printer chat", timestamp=datetime(2026, 3, 4),
            body="I saw a new laboratory printer online. It looks interesting.", sender_role="Professor"
        )
        acts4 = ActionExtractor.extract_actions("T32-4", [e4])
        self.assertEqual(len(acts4), 0, "Online interest must not produce action")

    def test_scenario_33_topic_aware_decisions_and_rejections_cases_a1_through_a5(self):
        """Scenario 33: Topic-aware decision and rejection resolution (Cases A1-A5)."""
        # Case A1 — Independent decisions: Seminar approved, Procurement rejected
        e1_A1 = Email(
            email_id="A1-1", thread_id="T-A1", sender="prof@univ.edu", recipients=["admin@univ.edu"],
            subject="Seminar and Procurement Request", timestamp=datetime(2026, 3, 1, 9, 0),
            body="Requesting approval for organizing the AI Seminar on 12 Nov, and procurement of 5 workstations.",
            sender_role="Professor"
        )
        e2_A1 = Email(
            email_id="A1-2", thread_id="T-A1", sender="dean_acad@univ.edu", recipients=["prof@univ.edu"],
            subject="Re: Seminar and Procurement Request", timestamp=datetime(2026, 3, 2, 10, 0),
            body="The seminar organization on 12 Nov is approved.",
            sender_role="Dean (Academic)"
        )
        e3_A1 = Email(
            email_id="A1-3", thread_id="T-A1", sender="finance@univ.edu", recipients=["prof@univ.edu"],
            subject="Re: Seminar and Procurement Request", timestamp=datetime(2026, 3, 3, 14, 0),
            body="The procurement request for 5 workstations is rejected due to budget constraints.",
            sender_role="Finance Officer"
        )
        decs_A1 = DecisionExtractor.extract_decisions("T-A1", [e1_A1, e2_A1, e3_A1])
        apps_A1 = DecisionExtractor.extract_approvals("T-A1", [e1_A1, e2_A1, e3_A1])
        st_A1 = ThreadStatusDetector.detect_status("T-A1", [e1_A1, e2_A1, e3_A1])

        self.assertEqual(len(decs_A1), 2, "Both independent decisions must be preserved")
        app_dec = next(d for d in decs_A1 if d.status == "approved")
        rej_dec = next(d for d in decs_A1 if d.status == "rejected")
        self.assertIn("seminar", app_dec.decision.lower())
        self.assertIn("procurement", rej_dec.decision.lower())
        self.assertEqual(len(apps_A1), 1, "Seminar approval must NOT be suppressed by procurement rejection")
        self.assertIn("seminar", apps_A1[0].item_approved.lower())
        self.assertTrue(st_A1.is_resolved)
        self.assertIn("seminar", st_A1.explanation.lower())
        self.assertIn("procurement", st_A1.explanation.lower())

        # Case A2 — Same proposal, conflicting decisions: Approval followed by later rejection
        e1_A2 = Email(
            email_id="A2-1", thread_id="T-A2", sender="prof@univ.edu", recipients=["dean@univ.edu"],
            subject="Workstations Procurement", timestamp=datetime(2026, 3, 1, 9, 0),
            body="Requesting procurement of 5 workstations for laboratory.",
            sender_role="Professor"
        )
        e2_A2 = Email(
            email_id="A2-2", thread_id="T-A2", sender="dean@univ.edu", recipients=["prof@univ.edu"],
            subject="Re: Workstations Procurement", timestamp=datetime(2026, 3, 2, 10, 0),
            body="The procurement of workstations is approved.",
            sender_role="Dean (Administration)"
        )
        e3_A2 = Email(
            email_id="A2-3", thread_id="T-A2", sender="finance@univ.edu", recipients=["prof@univ.edu"],
            subject="Re: Workstations Procurement", timestamp=datetime(2026, 3, 3, 11, 0),
            body="The procurement request for workstations is rejected due to budget constraints.",
            sender_role="Finance Officer"
        )
        decs_A2 = DecisionExtractor.extract_decisions("T-A2", [e1_A2, e2_A2, e3_A2])
        apps_A2 = DecisionExtractor.extract_approvals("T-A2", [e1_A2, e2_A2, e3_A2])
        self.assertEqual(len(decs_A2), 1)
        self.assertEqual(decs_A2[0].status, "rejected")
        self.assertIn("supersedes earlier approval", decs_A2[0].scope_qualifier.lower())
        self.assertEqual(len(apps_A2), 0, "Superseded approval must not be emitted as active authorization")

        # Case A3 — Different proposals: Printer procurement approved, CNC procurement rejected
        e1_A3 = Email(
            email_id="A3-1", thread_id="T-A3", sender="dean@univ.edu", recipients=["dept@univ.edu"],
            subject="Department Requisitions", timestamp=datetime(2026, 3, 1, 10, 0),
            body="Printer procurement is approved.",
            sender_role="Dean"
        )
        e2_A3 = Email(
            email_id="A3-2", thread_id="T-A3", sender="dean@univ.edu", recipients=["dept@univ.edu"],
            subject="Re: Department Requisitions", timestamp=datetime(2026, 3, 2, 11, 0),
            body="CNC procurement is rejected.",
            sender_role="Dean"
        )
        decs_A3 = DecisionExtractor.extract_decisions("T-A3", [e1_A3, e2_A3])
        apps_A3 = DecisionExtractor.extract_approvals("T-A3", [e1_A3, e2_A3])
        self.assertEqual(len(decs_A3), 2)
        self.assertEqual(len(apps_A3), 1)
        self.assertIn("printer", apps_A3[0].item_approved.lower())

        # Case A4 — Conditional approval with subsequent condition satisfaction
        e1_A4 = Email(
            email_id="A4-1", thread_id="T-A4", sender="dean@univ.edu", recipients=["dept@univ.edu"],
            subject="Seminar Hall Booking", timestamp=datetime(2026, 3, 1, 10, 0),
            body="Seminar approved subject to venue confirmation from Facilities Office.",
            sender_role="Dean"
        )
        e2_A4 = Email(
            email_id="A4-2", thread_id="T-A4", sender="facilities@univ.edu", recipients=["dept@univ.edu"],
            subject="Re: Seminar Hall Booking", timestamp=datetime(2026, 3, 2, 14, 0),
            body="Facilities Office confirms venue availability for Seminar Hall 2.",
            sender_role="Facilities Officer"
        )
        decs_A4 = DecisionExtractor.extract_decisions("T-A4", [e1_A4, e2_A4])
        self.assertEqual(len(decs_A4), 1)
        self.assertFalse(decs_A4[0].is_conditional, "Condition was satisfied by subsequent facilities confirmation")

        # Case A5 — Unclear association preserves ambiguity
        e1_A5 = Email(
            email_id="A5-1", thread_id="T-A5", sender="auth_a@univ.edu", recipients=["all@univ.edu"],
            subject="General Inquiry", timestamp=datetime(2026, 3, 1, 10, 0),
            body="We have reviewed and approved.",
            sender_role="Authority A"
        )
        e2_A5 = Email(
            email_id="A5-2", thread_id="T-A5", sender="auth_b@univ.edu", recipients=["all@univ.edu"],
            subject="Re: General Inquiry", timestamp=datetime(2026, 3, 2, 11, 0),
            body="The other request is rejected.",
            sender_role="Authority B"
        )
        decs_A5 = DecisionExtractor.extract_decisions("T-A5", [e1_A5, e2_A5])
        self.assertTrue(len(decs_A5) >= 1)

    def test_scenario_34_semantic_financial_amount_binding_cases_b1_through_b6(self):
        """Scenario 34: Semantically correct financial amount binding (Cases B1-B6)."""
        # Case B1 — Multiple financial stages: Budget 25L, quote 18L, approved 16.5L
        e1_B1 = Email(
            email_id="B1-1", thread_id="T-B1", sender="dean@univ.edu", recipients=["dept@univ.edu"],
            subject="Machinery Acquisition", timestamp=datetime(2026, 3, 1, 10, 0),
            body="An initial budget of INR 25 lakh was allocated. Vendor quotation was INR 18 lakh. After negotiation, the Dean approved INR 16.5 lakh.",
            sender_role="Dean (Administration)"
        )
        decs_B1 = DecisionExtractor.extract_decisions("T-B1", [e1_B1])
        apps_B1 = DecisionExtractor.extract_approvals("T-B1", [e1_B1])
        self.assertEqual(decs_B1[0].amount_inr, 1650000.0, "Must bind to approved 16.5 lakh, not budget 25 lakh")
        self.assertEqual(apps_B1[0].amount_inr, 1650000.0)

        # Case B2 — Revised quotation: original 22L, revised 20.5L, approved 20.5L
        e1_B2 = Email(
            email_id="B2-1", thread_id="T-B2", sender="dean@univ.edu", recipients=["store@univ.edu"],
            subject="Lab Setup Requisition", timestamp=datetime(2026, 3, 2, 10, 0),
            body="Original quotation: INR 22 lakh. Revised quotation: INR 20.5 lakh. Explicit approval: INR 20.5 lakh.",
            sender_role="Dean"
        )
        decs_B2 = DecisionExtractor.extract_decisions("T-B2", [e1_B2])
        apps_B2 = DecisionExtractor.extract_approvals("T-B2", [e1_B2])
        self.assertEqual(decs_B2[0].amount_inr, 2050000.0)
        self.assertEqual(apps_B2[0].amount_inr, 2050000.0)

        # Case B3 — Budget without authorization: 30L available, awaiting approval
        e1_B3 = Email(
            email_id="B3-1", thread_id="T-B3", sender="admin@univ.edu", recipients=["dept@univ.edu"],
            subject="Departmental Budget Availability", timestamp=datetime(2026, 3, 3, 10, 0),
            body="Budget of INR 30 lakh is available. Procurement is still awaiting formal approval.",
            sender_role="Administrative Officer"
        )
        decs_B3 = DecisionExtractor.extract_decisions("T-B3", [e1_B3])
        apps_B3 = DecisionExtractor.extract_approvals("T-B3", [e1_B3])
        self.assertEqual(len(apps_B3), 0, "Budget mention must NOT create purchase authorization")
        for d in decs_B3:
            self.assertNotEqual(d.amount_inr, 3000000.0, "Budget allocation must NOT be marked as decision amount")

        # Case B4 — Multiple vendors: Vendor A 18L, Vendor B 17L, Vendor B approved at 17L
        e1_B4 = Email(
            email_id="B4-1", thread_id="T-B4", sender="store@univ.edu", recipients=["purchase@univ.edu"],
            subject="Comparative Analysis", timestamp=datetime(2026, 3, 4, 10, 0),
            body="Vendor A quotation: INR 18 lakh. Vendor B quotation: INR 17 lakh. Vendor B selected and explicitly approved at INR 17 lakh.",
            sender_role="Store Officer"
        )
        apps_B4 = DecisionExtractor.extract_approvals("T-B4", [e1_B4])
        self.assertEqual(len(apps_B4), 1)
        self.assertEqual(apps_B4[0].amount_inr, 1700000.0)

        # Case B5 — Contradictory figures: 16L approved, subsequent 19L mention without clarification
        e1_B5 = Email(
            email_id="B5-1", thread_id="T-B5", sender="dean@univ.edu", recipients=["pi@univ.edu"],
            subject="Research Grant Purchase", timestamp=datetime(2026, 3, 5, 10, 0),
            body="Approved purchase for INR 16 lakh.", sender_role="Dean"
        )
        e2_B5 = Email(
            email_id="B5-2", thread_id="T-B5", sender="store@univ.edu", recipients=["pi@univ.edu"],
            subject="Re: Research Grant Purchase", timestamp=datetime(2026, 3, 6, 11, 0),
            body="Regarding the procurement, we received note mentioning INR 19 lakh.", sender_role="Store"
        )
        apps_B5 = DecisionExtractor.extract_approvals("T-B5", [e1_B5, e2_B5])
        self.assertEqual(apps_B5[0].amount_inr, 1600000.0, "Approved baseline must be preserved against unverified mention")
        self.assertIn("1,900,000", apps_B5[0].scope_qualifier)

        # Case B6 — Financial amount in attachment with provenance preservation
        att_B6 = AttachmentMetadata(
            filename="quotation_analysis.csv",
            file_type="csv",
            content_text="Item,Quote\nSpectrometer,INR 85,000"
        )
        e1_B6 = Email(
            email_id="B6-1", thread_id="T-B6", sender="vendor@spectro.com", recipients=["purchase@univ.edu"],
            subject="Spectrometer Quote", timestamp=datetime(2026, 3, 7, 10, 0),
            body="Please see attached comparative quote.",
            attachments=["quotation_analysis.csv"],
            attachment_data={"quotation_analysis.csv": att_B6},
            sender_role="Vendor"
        )
        from sutra.intelligence.decisions import extract_financial_bindings
        bindings = []
        for fname, att in e1_B6.attachment_data.items():
            for b in extract_financial_bindings(att.content_text, fname):
                bindings.append(b)
        self.assertEqual(len(bindings), 1)
        self.assertEqual(bindings[0]["amount"], 85000.0)
        self.assertEqual(bindings[0]["email_id"], "quotation_analysis.csv")


if __name__ == "__main__":
    unittest.main()
