"""State machine tracking the evolution and transitions of decisions and actions over time."""

from __future__ import annotations
from typing import List, Dict, Optional, Tuple
from sutra.models.email import Email
from sutra.models.intelligence import (
    LifecycleState,
    Decision,
    Action,
    ActionStatus,
    DecisionTransition,
    ActionTransition,
)


class ThreadLifecycleTracker:
    """
    Tracks high-level thread workflow progression and granular
    state transitions for individual decisions and action items.
    """

    @staticmethod
    def infer_lifecycle_state(thread_id: str, emails: List[Email]) -> LifecycleState:
        """Evaluate messages in chronological order to find the latest verified thread-level state."""
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        if not sorted_emails:
            return LifecycleState.UNKNOWN

        combined_text = " ".join([e.body.lower() for e in sorted_emails])
        last_body = sorted_emails[-1].body.lower()

        # Closed / Completed states
        if any(w in last_body for w in [
            "claim is closed", "request complete", "returned to service",
            "monitoring continues", "tickets if no further drops occur", "claim closed"
        ]):
            return LifecycleState.CLOSED

        # Executed / Delivered
        if any(w in last_body for w in [
            "delivered and installed", "transferred on", "calibration completed", "switch replaced"
        ]):
            return LifecycleState.EXECUTED

        # Ordered
        if any(w in combined_text for w in [
            "purchase order has been sent", "purchase order is being prepared",
            "issue order by", "purchase order was issued"
        ]):
            if "delivery and installation remain pending" in last_body or "delivery expected" in last_body or "issued" in last_body:
                return LifecycleState.ORDERED

        # Approved / Conditional Approval
        if any(w in combined_text for w in ["approved", "accepted for budget planning only", "approves"]):
            return LifecycleState.APPROVED

        # Quoted / Recommended
        if "recommends" in combined_text:
            return LifecycleState.RECOMMENDED
        if "quotation" in combined_text or "quotes:" in combined_text:
            return LifecycleState.QUOTED

        return LifecycleState.REQUESTED

    @staticmethod
    def build_decision_transitions(decisions: List[Decision], emails: List[Email]) -> List[DecisionTransition]:
        """Track explicit state changes across decisions."""
        transitions: List[DecisionTransition] = []
        emails_by_id = {e.email_id: e for e in emails}

        default_trig = emails[0].email_id if emails else ""
        for d in decisions:
            if d.is_conditional:
                # Transition from proposed -> conditionally_approved
                trig = d.evidence_references[0] if d.evidence_references else default_trig
                ts = emails_by_id[trig].iso_timestamp if trig in emails_by_id else ""
                transitions.append(DecisionTransition(
                    decision_id=d.decision_id,
                    from_state="proposed",
                    to_state="conditionally_approved",
                    trigger_email_id=trig,
                    reason=d.scope_qualifier or "Conditional approval granted",
                    timestamp=ts,
                ))
            elif d.status == "approved":
                trig = d.evidence_references[0] if d.evidence_references else default_trig
                ts = emails_by_id[trig].iso_timestamp if trig in emails_by_id else ""
                transitions.append(DecisionTransition(
                    decision_id=d.decision_id,
                    from_state="proposed",
                    to_state="approved",
                    trigger_email_id=trig,
                    reason="Formal approval granted",
                    timestamp=ts,
                ))

            if d.superseded_by:
                trig = d.evidence_references[-1] if d.evidence_references else default_trig
                ts = emails_by_id[trig].iso_timestamp if trig in emails_by_id else ""
                transitions.append(DecisionTransition(
                    decision_id=d.decision_id,
                    from_state=d.status,
                    to_state="superseded",
                    trigger_email_id=trig,
                    reason=f"Superseded by {d.superseded_by}",
                    timestamp=ts,
                ))

        return transitions

    @staticmethod
    def build_action_transitions(actions: List[Action], emails: List[Email]) -> List[ActionTransition]:
        """Track state changes across action items (assigned -> completed / in_progress)."""
        transitions: List[ActionTransition] = []
        emails_by_id = {e.email_id: e for e in emails}

        default_trig = emails[0].email_id if emails else ""
        for a in actions:
            if a.status == ActionStatus.NONE_STATED:
                continue

            trig = a.evidence_references[0] if a.evidence_references else default_trig
            ts = emails_by_id[trig].iso_timestamp if trig in emails_by_id else ""

            # Creation transition
            transitions.append(ActionTransition(
                action_id=a.action_id,
                from_state="created",
                to_state="assigned" if a.owner != "none_stated" else "pending",
                trigger_email_id=trig,
                reason=f"Assigned to {a.owner}" if a.owner != "none_stated" else "Action item logged",
                timestamp=ts,
            ))

            # If completed
            if a.status == ActionStatus.COMPLETED and len(a.evidence_references) > 1:
                trig_comp = a.evidence_references[-1]
                ts_comp = emails_by_id[trig_comp].iso_timestamp if trig_comp in emails_by_id else ""
                transitions.append(ActionTransition(
                    action_id=a.action_id,
                    from_state="in_progress",
                    to_state="completed",
                    trigger_email_id=trig_comp,
                    reason="Task completion confirmed in message",
                    timestamp=ts_comp,
                ))

        return transitions
