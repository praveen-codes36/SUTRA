"""Lifecycle state tracking for institutional email threads."""

from typing import List
from sutra.models.email import Email
from sutra.models.intelligence import LifecycleState

class ThreadLifecycleTracker:
    """
    Determines the lifecycle stage of an institutional workflow based on
    chronological email progression and administrative actions.
    """

    @staticmethod
    def infer_lifecycle_state(thread_id: str, emails: List[Email]) -> LifecycleState:
        """Evaluate messages in chronological order to find the latest verified state."""
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        if not sorted_emails:
            return LifecycleState.UNKNOWN

        combined_text = " ".join([e.body.lower() for e in sorted_emails])
        last_body = sorted_emails[-1].body.lower()

        # Closed / Completed states
        if any(w in last_body for w in ["claim is closed", "request complete", "returned to service", "monitoring continues", "tickets if no further drops occur"]):
            return LifecycleState.CLOSED

        # Executed / Delivered
        if any(w in last_body for w in ["delivered and installed", "transferred on", "calibration completed", "switch replaced"]):
            return LifecycleState.EXECUTED

        # Ordered
        if any(w in combined_text for w in ["purchase order has been sent", "purchase order is being prepared", "issue order by"]):
            if "delivery and installation remain pending" in last_body or "delivery expected" in last_body:
                return LifecycleState.ORDERED

        # Approved / Conditional Approval
        if any(w in combined_text for w in ["approved", "accepted for budget planning only"]):
            return LifecycleState.APPROVED

        # Quoted / Recommended
        if "recommends" in combined_text:
            return LifecycleState.RECOMMENDED
        if "quotation" in combined_text or "quotes:" in combined_text:
            return LifecycleState.QUOTED

        return LifecycleState.REQUESTED

