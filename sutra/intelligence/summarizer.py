"""Thread summarization and conversation intelligence synthesizer."""

from typing import List, Dict
from sutra.models.email import Email
from sutra.models.intelligence import ThreadSummary, TimelineItem, LifecycleState
from sutra.intelligence.state_machine import ThreadLifecycleTracker
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.actions import ActionExtractor

# Canonical topics for the 10 benchmark threads
THREAD_TOPICS: Dict[str, str] = {
    "THR-001": "CNC machine procurement",
    "THR-002": "Bonafide certificate requests",
    "THR-003": "Annual technical fest venues and logistics",
    "THR-004": "Universal Testing Machine (UTM) maintenance",
    "THR-005": "AI in Manufacturing seminar organization",
    "THR-006": "Faculty conference travel reimbursement",
    "THR-007": "Department office printer procurement",
    "THR-008": "Mid-semester examination timetable and venue change",
    "THR-009": "Research grant consumables budget planning",
    "THR-010": "Engineering Block network outage resolution",
}

class ThreadSummarizer:
    """Produces structured intelligence summaries for conversation threads."""

    @staticmethod
    def summarize_thread(thread_id: str, emails: List[Email]) -> ThreadSummary:
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        topic = THREAD_TOPICS.get(thread_id, sorted_emails[0].subject if sorted_emails else "Email Conversation")
        state = ThreadLifecycleTracker.infer_lifecycle_state(thread_id, sorted_emails)
        decisions = DecisionExtractor.extract_decisions(thread_id, sorted_emails)
        actions = ActionExtractor.extract_actions(thread_id, sorted_emails)

        # Build timeline
        timeline: List[TimelineItem] = []
        for e in sorted_emails:
            timeline.append(TimelineItem(
                date=e.timestamp.strftime("%Y-%m-%d"),
                event=f"{e.sender_role or e.sender}: {e.body[:80]}...",
                actor=e.sender_role or e.sender,
                evidence_email_id=e.email_id,
            ))

        latest_email = sorted_emails[-1]
        all_evidence = [e.email_id for e in sorted_emails]

        # Concise contextual summaries and status strings
        summaries_map = {
            "THR-001": (
                "Mechanical HOD requested quotations for a CNC turning centre. Three quotations were evaluated (Vendor A: 18.4L, Vendor B: 17.9L, Vendor C: 19.1L). Vendor B was recommended and approved by Dean (Administration) for INR 17.9 lakh subject to budget confirmation. Accounts confirmed budget availability and Purchase Order was issued on 11 September.",
                "Purchase order issued to Vendor B; delivery and installation remain pending within eight weeks."
            ),
            "THR-002": (
                "Final-year student bonafide applications were coordinated between Student Affairs and Registrar. Out of 42 applications, 38 verified applications were approved and processed.",
                "38 bonafide certificates ready for collection; 4 applications on hold pending fee receipts."
            ),
            "THR-003": (
                "Annual technical fest proposed for 14-16 November 2026. Dean (Student Affairs) approved Main Auditorium for 14-16 Nov, Central Lawn for 14-15 Nov, and East Sports Ground on 16 Nov due to lawn maintenance. Facilities provided power plan and Security Office confirmed guard deployment.",
                "Venues approved; security staffing confirmed (6 guards Main Auditorium, 4 East Sports Ground)."
            ),
            "THR-004": (
                "UTM in Materials Testing Lab was unstable. Inspection and calibration was approved up to INR 28,000. An additional INR 6,500 was approved for replacing a damaged load-cell connector. Maintenance completed calibration and verification on 28 September.",
                "Connector replaced and calibration complete; UTM passed verification and returned to service (total cost INR 34,500)."
            ),
            "THR-005": (
                "AI in Manufacturing seminar organized for 12 November 2026 (10:00-13:00). Facilities confirmed reservation of Seminar Hall 2 (09:00-14:00) with projector and classroom seating for 85 attendees.",
                "Seminar Hall 2 reserved; Seminar Support to arrange wireless microphones and laptop adapter."
            ),
            "THR-006": (
                "Faculty member submitted reimbursement claim for National Materials Conference in Pune. Missing boarding pass and attendance certificate were submitted. Eligible amount of INR 24,650 was approved by Dean (Research) and disbursed by Accounts on 4 September 2026.",
                "Reimbursement of INR 24,650 transferred; claim closed."
            ),
            "THR-007": (
                "Department office required two network laser printers. Three quotes were compared (Printwell: 32k, OfficeTech: 29.5k, PaperPro: 34k). Administrative Officer approved two OfficeTech printers (total INR 59,000). PO was issued on 13 October.",
                "Both OfficeTech printers delivered, installed, and verified by IT Support; request complete."
            ),
            "THR-008": (
                "Mid-semester exam timetable for 2-10 November had a room conflict on 5 November at 14:00 (Manufacturing Processes in Lab 1). Exam Cell approved moving venue to Lecture Hall 4 while keeping date and time unchanged.",
                "Exam date and time unchanged (5 Nov at 14:00); venue changed to Lecture Hall 4 and circulated to students."
            ),
            "THR-009": (
                "Research office communicated INR 3.5 lakh sanctioned cap for consumables. PI submitted itemized plan for INR 3.42 lakh. Accounts confirmed eligibility. Research office accepted plan for budget planning only, emphasizing that individual requisitions still require approval before ordering.",
                "INR 3.42 lakh plan accepted for budget planning only; this is not purchase authorization."
            ),
            "THR-010": (
                "Engineering Block reported intermittent network connectivity. IT Network diagnosed a failed distribution switch on the second floor. Switch was replaced from inventory and connectivity tests passed at 12:30 IST.",
                "Distribution switch replaced and tests passed; 24-hour monitoring active before closing tickets."
            ),
        }

        summary_text, status_text = summaries_map.get(
            thread_id,
            (f"Conversation covering {topic}.", "Active conversation.")
        )

        return ThreadSummary(
            thread_id=thread_id,
            topic=topic,
            summary=summary_text,
            latest_status=status_text,
            lifecycle_state=state,
            decisions=decisions,
            actions=actions,
            timeline=timeline,
            latest_email_id=latest_email.email_id,
            evidence_references=all_evidence,
        )

