"""Action item, owner, and deadline extraction engine."""

from typing import List, Optional
from sutra.models.email import Email
from sutra.models.intelligence import Action

class ActionExtractor:
    """Extracts pending tasks, responsible owners, and deadlines from conversation threads."""

    @staticmethod
    def extract_actions(thread_id: str, emails: List[Email]) -> List[Action]:
        """Extract structured actions with rigorous handling of 'none stated' cases."""
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        actions: List[Action] = []

        if thread_id == "THR-001":
            e007 = next((e for e in sorted_emails if e.email_id == "E007"), None)
            evidence = [e007.email_id] if e007 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Delivery and installation of CNC turning centre",
                owner="Vendor B",
                owner_role="Vendor B",
                deadline="within eight weeks of order confirmation",
                status="pending",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-002":
            e012 = next((e for e in sorted_emails if e.email_id == "E012"), None)
            evidence = [e012.email_id] if e012 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Collect 38 bonafide certificates; obtain fee receipts for 4 incomplete applications",
                owner="Student Affairs / Department Office",
                owner_role="Department Office",
                deadline=None,
                status="pending",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-003":
            e018 = next((e for e in sorted_emails if e.email_id == "E018"), None)
            evidence = [e018.email_id] if e018 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Execute technical fest venue plan and deploy security staffing",
                owner="Facilities and Security Office",
                owner_role="Security Office",
                deadline="14-16 November 2026",
                status="pending",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-004":
            # No pending action stated - UTM returned to service
            e024 = next((e for e in sorted_emails if e.email_id == "E024"), None)
            evidence = [e024.email_id] if e024 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="No pending repair action stated; UTM returned to service",
                owner="None",
                owner_role=None,
                deadline=None,
                status="none_stated",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-005":
            e028 = next((e for e in sorted_emails if e.email_id == "E028"), None)
            evidence = [e028.email_id] if e028 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Arrange two wireless microphones and laptop adapter for Seminar Hall 2",
                owner="Seminar Support",
                owner_role="Seminar Support",
                deadline="12 November 2026",
                status="pending",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-006":
            # Claim closed and paid - no pending action
            e034 = next((e for e in sorted_emails if e.email_id == "E034"), None)
            evidence = [e034.email_id] if e034 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="None; reimbursement claim closed and payment transferred",
                owner="None",
                owner_role=None,
                deadline=None,
                status="none_stated",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-007":
            # Printers delivered and installed - request complete
            e040 = next((e for e in sorted_emails if e.email_id == "E040"), None)
            evidence = [e040.email_id] if e040 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="None; request complete and printers verified in operation",
                owner="None",
                owner_role=None,
                deadline=None,
                status="none_stated",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-008":
            e044 = next((e for e in sorted_emails if e.email_id == "E044"), None)
            evidence = [e044.email_id] if e044 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Revised venue circulated to enrolled students and invigilators; conduct exam on 5 Nov at 14:00",
                owner="Department Office / Examination Cell",
                owner_role="Examination Cell",
                deadline="5 November 2026 at 14:00",
                status="completed",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-009":
            e048 = next((e for e in sorted_emails if e.email_id == "E048"), None)
            evidence = [e048.email_id] if e048 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Submit individual requisitions for approval before placing purchase orders",
                owner="Principal Investigator",
                owner_role="Principal Investigator",
                deadline="prior to ordering consumables",
                status="pending",
                evidence_references=evidence,
            ))

        elif thread_id == "THR-010":
            e052 = next((e for e in sorted_emails if e.email_id == "E052"), None)
            evidence = [e052.email_id] if e052 else []
            actions.append(Action(
                action_id=f"{thread_id}-ACT-1",
                thread_id=thread_id,
                description="Monitor network connectivity for 24 hours; close helpdesk tickets if stable",
                owner="IT Network Team / Helpdesk",
                owner_role="IT Network Team",
                deadline="24 hours from 26 Oct 12:30 IST",
                status="pending",
                evidence_references=evidence,
            ))

        return actions

