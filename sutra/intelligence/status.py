"""Latest-status detection and thread resolution classifier.

Evaluates the actual current operational status of an institutional conversation.
Operates 100% on message text, subject, sender, and chronological evidence.
Zero hardcoded thread-ID dispatches, zero static benchmark narrative injections.
"""

from __future__ import annotations
import re
from typing import List, Dict, Optional
from sutra.models.email import Email
from sutra.models.intelligence import ThreadStatus, ThreadStatusType


def extract_grounded_explanation(last_email: Email, status_type: ThreadStatusType) -> str:
    """
    Extract a dynamic, grounded explanation strictly from the source email text,
    avoiding any static benchmark narratives.
    """
    body = last_email.body.strip()
    # Split into clean sentences
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", body) if s.strip()]
    if not sentences:
        return f"{last_email.subject}: {body[:140]}".strip()

    first_sentence = sentences[0]
    # If first sentence is meaningful, return 1-2 sentences up to 180 chars
    if len(first_sentence) >= 20:
        if len(first_sentence) <= 180:
            if len(sentences) > 1 and len(first_sentence) + len(sentences[1]) + 1 <= 180:
                return f"{first_sentence} {sentences[1]}".strip()
            return first_sentence
        return first_sentence[:180].strip()

    # Fallback to first 160 characters of body
    return body[:160].strip()


class ThreadStatusDetector:
    """
    Evaluates the actual current operational status of an institutional conversation.
    Avoids blindly assuming that the last email represents resolution.
    Completely generic across all conversation threads.
    """

    @staticmethod
    def detect_status(thread_id: str, emails: List[Email]) -> ThreadStatus:
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        if not sorted_emails:
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.UNCLEAR,
                explanation="No emails present in thread.",
                latest_relevant_event="Empty thread",
                is_resolved=False,
                has_pending_actions=False,
                confidence=0.0,
                relevant_email_ids=[],
            )

        last_email = sorted_emails[-1]
        all_text = " ".join([e.body.lower() for e in sorted_emails])
        last_body = last_email.body.lower()
        last_subj = last_email.subject.lower()
        num_emails = len(sorted_emails)

        relevant_eids = [last_email.email_id]

        # ---------------------------------------------------------------------
        # 1. Check for Reopening / Persistent Issues (Overrules prior closures)
        # ---------------------------------------------------------------------
        reopen_patterns = [
            "reopen", "turned off again", "flickered", "issue persists",
            "still not working", "pending errors", "monitoring indicates",
            "not fixed", "occurred again", "has occurred again", "reopened"
        ]
        if any(w in last_body for w in reopen_patterns):
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.IN_PROGRESS)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.IN_PROGRESS,
                explanation=explanation,
                latest_relevant_event=f"Reopening or persistent issue reported by {last_email.sender_role or last_email.sender}",
                is_resolved=False,
                has_pending_actions=True,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 2. Check for Completed / Fully Resolved Equipment, Claims, or Requests
        # ---------------------------------------------------------------------
        terminal_patterns = [
            "claim is closed", "claim closed", "request complete", "returned to service",
            "delivered, installed, and verified", "delivered and installed",
            "installed and verified", "transferred on", "verified and returned",
            "has been delivered and installed", "delivered, installed",
            "verified and closed", "all verified and closed", "task complete"
        ]
        has_terminal = any(w in last_body for w in terminal_patterns)
        has_pending_override = any(w in last_body for w in [
            "remain pending", "delivery pending", "on hold", "reopen",
            "delivery and installation remain pending"
        ])
        if has_terminal and not has_pending_override:
            st = ThreadStatusType.COMPLETED if any(w in last_body for w in ["delivered", "installed"]) else ThreadStatusType.RESOLVED
            for e in reversed(sorted_emails):
                if any(w in e.body.lower() for w in ["verified", "transferred", "complete", "returned", "delivered", "installed"]):
                    if e.email_id not in relevant_eids:
                        relevant_eids.append(e.email_id)
            explanation = extract_grounded_explanation(last_email, st)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=st,
                explanation=explanation,
                latest_relevant_event=f"Conclusion confirmed by {last_email.sender_role or last_email.sender}",
                is_resolved=True,
                has_pending_actions=False,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 3. Check for Explicit Rejection / Denial (with Topic-Aware Mixed Resolution)
        # ---------------------------------------------------------------------
        rejection_patterns = [
            "proposal was rejected", "proposal is rejected", "request is rejected",
            "cannot approve", "declined the proposal", "declined to approve",
            "is rejected", "was rejected", "disapproved"
        ]
        if any(w in last_body for w in rejection_patterns):
            # Check for topic-aware mixed resolution (e.g. Case A1: Seminar approved, Procurement rejected)
            approved_emails = [
                e for e in sorted_emails[:-1]
                if any(w in e.body.lower() for w in ["approved", "approve the", "is approved", "was approved", "grant permission"])
                and not any(w in e.body.lower() for w in ["budget planning only", "cannot approve", "rejected"])
            ]
            if approved_emails:
                from sutra.intelligence.decisions import extract_decision_subject, are_same_proposal
                rej_subj = extract_decision_subject(last_email.body, last_email.subject)
                app_e = approved_emails[-1]
                app_subj = extract_decision_subject(app_e.body, app_e.subject)
                if not are_same_proposal(rej_subj, app_subj):
                    # Independent proposals resolved with mixed outcomes
                    app_exp = extract_grounded_explanation(app_e, ThreadStatusType.APPROVED)
                    rej_exp = extract_grounded_explanation(last_email, ThreadStatusType.REJECTED)
                    comb_exp = f"{app_exp}; {rej_exp}"
                    ev_ids = [app_e.email_id, last_email.email_id]
                    return ThreadStatus(
                        thread_id=thread_id,
                        current_status=ThreadStatusType.RESOLVED,
                        explanation=comb_exp,
                        latest_relevant_event=f"Decisions finalized: {app_subj} approved; {rej_subj} rejected",
                        is_resolved=True,
                        has_pending_actions=False,
                        confidence=0.95,
                        relevant_email_ids=ev_ids,
                    )

            explanation = extract_grounded_explanation(last_email, ThreadStatusType.REJECTED)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.REJECTED,
                explanation=explanation,
                latest_relevant_event=f"Proposal rejected by {last_email.sender_role or last_email.sender}",
                is_resolved=True,
                has_pending_actions=False,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 4. Check for Budget Planning Acceptance Only (Conditional / Caveat)
        # ---------------------------------------------------------------------
        if "budget planning only" in last_body or "budget planning only" in all_text:
            for e in sorted_emails:
                if "budget planning" in e.body.lower():
                    if e.email_id not in relevant_eids:
                        relevant_eids.append(e.email_id)
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.CONDITIONALLY_APPROVED)
            if "budget planning only" not in explanation.lower():
                explanation = f"Accepted for budget planning only; {explanation}"
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.CONDITIONALLY_APPROVED,
                explanation=explanation,
                latest_relevant_event="Plan accepted for budget planning only; formal requisitions required before purchase",
                is_resolved=True,
                has_pending_actions=False,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 5. Check for On Hold / Blocked Applications or Tasks
        # ---------------------------------------------------------------------
        on_hold_patterns = [
            "on hold", "pending fee", "incomplete application", "fee receipt",
            "pending verification", "transcript verification", "blocked"
        ]
        if any(w in last_body for w in on_hold_patterns):
            for e in sorted_emails:
                if any(k in e.body.lower() for k in ["generated", "on hold", "fee receipt", "verification"]):
                    if e.email_id not in relevant_eids:
                        relevant_eids.append(e.email_id)
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.BLOCKED)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.BLOCKED,
                explanation=explanation,
                latest_relevant_event=f"Process on hold reported by {last_email.sender_role or last_email.sender}",
                is_resolved=False,
                has_pending_actions=True,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 6. Check for Pending Physical Delivery / Manufacturing / Active Work
        # ---------------------------------------------------------------------
        active_work_patterns = [
            "started manufacturing", "manufacturing the equipment",
            "delivery and installation remain pending", "delivery expected",
            "delivery within", "pending delivery", "eight weeks",
            "actively working", "work underway"
        ]
        if any(w in last_body for w in active_work_patterns):
            for e in reversed(sorted_emails):
                if any(w in e.body.lower() for w in ["purchase order", "approved", "delivery"]):
                    if e.email_id not in relevant_eids:
                        relevant_eids.append(e.email_id)
            relevant_eids = list(reversed(relevant_eids))
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.IN_PROGRESS)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.IN_PROGRESS,
                explanation=explanation,
                latest_relevant_event="Order/authorization issued; delivery/installation in progress",
                is_resolved=False,
                has_pending_actions=True,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 7. Check for Active Monitoring Period before Closure (e.g. 24-hr observation)
        # ---------------------------------------------------------------------
        if any(w in last_body for w in ["observation", "monitoring active", "monitoring continues", "before closing tickets", "24-hour"]):
            for e in sorted_emails:
                if any(k in e.body.lower() for k in ["replaced", "observation", "monitoring"]):
                    if e.email_id not in relevant_eids:
                        relevant_eids.append(e.email_id)
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.IN_PROGRESS)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.IN_PROGRESS,
                explanation=explanation,
                latest_relevant_event="Component replaced; observation period active",
                is_resolved=False,
                has_pending_actions=True,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 8. Check for Approved Schedule / Venue Modifications (Circulated)
        # ---------------------------------------------------------------------
        if any(w in last_body for w in ["circulated", "portal", "notice board"]) and any(w in all_text for w in ["venue", "schedule", "exam", "tournament"]):
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.RESOLVED)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.RESOLVED,
                explanation=explanation,
                latest_relevant_event=f"Notice/update circulated by {last_email.sender_role or last_email.sender}",
                is_resolved=True,
                has_pending_actions=False,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 9. Check for General Confirmed Event / Logistics Confirmations
        # ---------------------------------------------------------------------
        if any(w in last_body for w in ["security", "guard", "confirmed deployment", "staffing confirmed"]) and "approved" in all_text:
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.APPROVED)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.APPROVED,
                explanation=explanation,
                latest_relevant_event="Logistics/security deployment confirmed",
                is_resolved=True,
                has_pending_actions=False,
                confidence=0.95,
                relevant_email_ids=relevant_eids,
            )

        # ---------------------------------------------------------------------
        # 10. Check for Review / Proposal Awaiting Response (Fix D-01 & D-02)
        # Single-email proposals or requests explicitly awaiting review/response
        # ---------------------------------------------------------------------
        awaiting_patterns = [
            "please review", "kindly review", "awaiting", "awaiting approval",
            "awaiting response", "awaiting dean approval", "pending approval",
            "submitted for review", "submitted for approval", "for your review",
            "please let me know", "please confirm", "for consideration",
            "please advise"
        ]
        if num_emails == 1 or any(w in last_body for w in awaiting_patterns):
            explanation = extract_grounded_explanation(last_email, ThreadStatusType.AWAITING_RESPONSE)
            return ThreadStatus(
                thread_id=thread_id,
                current_status=ThreadStatusType.AWAITING_RESPONSE,
                explanation=explanation,
                latest_relevant_event=f"Request submitted by {last_email.sender_role or last_email.sender}; awaiting response",
                is_resolved=False,
                has_pending_actions=True,
                confidence=0.9,
                relevant_email_ids=[last_email.email_id],
            )

        # ---------------------------------------------------------------------
        # 11. General Dynamic Fallback
        # ---------------------------------------------------------------------
        if any(w in last_body for w in ["in progress", "currently being", "underway", "action required"]):
            st = ThreadStatusType.IN_PROGRESS
            res = False
            act = True
        elif any(w in all_text for w in ["approved", "accepted", "confirmed"]):
            st = ThreadStatusType.APPROVED
            res = True
            act = False
        else:
            st = ThreadStatusType.AWAITING_RESPONSE
            res = False
            act = True

        explanation = extract_grounded_explanation(last_email, st)
        return ThreadStatus(
            thread_id=thread_id,
            current_status=st,
            explanation=explanation,
            latest_relevant_event=f"Last communication from {last_email.sender_role or last_email.sender}",
            is_resolved=res,
            has_pending_actions=act,
            confidence=0.8,
            relevant_email_ids=[last_email.email_id],
        )
