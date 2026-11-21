"""Thread summarization and conversation intelligence synthesizer."""

from __future__ import annotations
import re
from typing import List, Dict, Set, Optional, Any
from sutra.models.email import Email
from sutra.models.intelligence import (
    ThreadIntelligence,
    TimelineItem,
    LifecycleState,
    ThreadStatus,
)
from sutra.intelligence.state_machine import ThreadLifecycleTracker
from sutra.intelligence.status import ThreadStatusDetector
from sutra.intelligence.decisions import DecisionExtractor
from sutra.intelligence.actions import ActionExtractor
from sutra.intelligence.evidence import EvidenceValidator


class ThreadSummarizer:
    """Produces structured intelligence summaries for conversation threads."""

    @staticmethod
    def summarize_thread(
        thread_id: str,
        emails: List[Email],
        llm_provider: Optional[Any] = None,
    ) -> ThreadIntelligence:
        sorted_emails = sorted(emails, key=lambda e: e.timestamp)
        topic = sorted_emails[0].subject if sorted_emails else "Email Conversation"
        # Clean subject for topic
        clean_topic = re.sub(r"^(?:re|fwd|fw):\s*", "", topic, flags=re.IGNORECASE).strip()
        
        # High-level lifecycle state & status
        lifecycle = ThreadLifecycleTracker.infer_lifecycle_state(thread_id, sorted_emails)
        status_info = ThreadStatusDetector.detect_status(thread_id, sorted_emails)
        decisions = DecisionExtractor.extract_decisions(thread_id, sorted_emails, llm_provider=llm_provider)
        approvals = DecisionExtractor.extract_approvals(thread_id, sorted_emails, llm_provider=llm_provider)
        actions = ActionExtractor.extract_actions(thread_id, sorted_emails, llm_provider=llm_provider)

        # Transitions
        decision_transitions = ThreadLifecycleTracker.build_decision_transitions(decisions, sorted_emails)
        action_transitions = ThreadLifecycleTracker.build_action_transitions(actions, sorted_emails)

        # Key participants
        participants: Set[str] = set()
        for e in sorted_emails:
            participants.add(e.sender_role or e.sender)
            for r in e.recipients:
                participants.add(r)

        # Build timeline
        timeline: List[TimelineItem] = []
        for idx, e in enumerate(sorted_emails, start=1):
            timeline.append(TimelineItem(
                event_id=f"EVT-{idx:03d}",
                date=e.timestamp.strftime("%Y-%m-%d"),
                actor=e.sender,
                actor_role=e.sender_role,
                description=f"{e.sender_role or e.sender}: {e.body[:100]}...",
                evidence_email_id=e.email_id,
            ))

        latest_email_id = sorted_emails[-1].email_id if sorted_emails else ""
        all_evidence = [e.email_id for e in sorted_emails]

        # Generate generic, content-derived concise and detailed summaries
        short_sum, det_sum = ThreadSummarizer._synthesize_summaries(
            clean_topic, sorted_emails, decisions, approvals, actions, status_info, llm_provider=llm_provider
        )

        # Extract PRD FR-D1 structured summary fields
        purpose_str = sorted_emails[0].body[:160].strip() if sorted_emails else ""
        initial_ctx = f"Subject: {sorted_emails[0].subject} | From: {sorted_emails[0].sender} ({sorted_emails[0].sender_role or 'Staff'})" if sorted_emails else ""
        disc_points = [f"{e.email_id}: {e.body[:120].strip()}" for e in sorted_emails]
        pending_acts = [a.description or a.task for a in actions if getattr(a.status, "value", str(a.status)) in ("pending", "open", "conditional", "in_progress")]
        if not pending_acts:
            pending_acts = ["NONE_STATED"]
        resp_people = sorted(list({a.owner for a in actions if a.owner and a.owner != "none_stated"}))
        dl_list = sorted(list({a.deadline for a in actions if a.deadline}))
        att_refs = sorted(list({att for e in sorted_emails for att in e.attachments}))

        return ThreadIntelligence(
            thread_id=thread_id,
            topic=clean_topic,
            summary=short_sum,
            detailed_summary=det_sum,
            purpose=purpose_str,
            initial_context=initial_ctx,
            discussion_points=disc_points,
            latest_status=status_info.explanation,
            status_details=status_info,
            lifecycle_state=lifecycle,
            key_participants=sorted(list(participants)),
            important_events=timeline,
            timeline=timeline,
            decisions=decisions,
            approvals=approvals,
            actions=actions,
            pending_actions=pending_acts,
            responsible_people=resp_people,
            deadlines=dl_list,
            attachments_referenced=att_refs,
            source_email_ids=all_evidence,
            generated_by="anvaya-summarizer-v1.0",
            decision_transitions=decision_transitions,
            action_transitions=action_transitions,
            latest_email_id=latest_email_id,
            evidence_references=all_evidence,
        )

    @staticmethod
    def _synthesize_summaries(
        topic: str,
        emails: List[Email],
        decisions: list,
        approvals: list,
        actions: list,
        status_info: ThreadStatus,
        llm_provider: Optional[Any] = None,
    ) -> tuple[str, str]:
        """Synthesize concise and detailed summaries from message text and structured extraction."""
        if not emails:
            return f"Conversation covering {topic}.", f"No message records available for {topic}."

        first_msg = emails[0]
        last_msg = emails[-1]

        # 1. Concise institutional summary
        # Focus on initiator, subject, key decision, and status
        init_actor = first_msg.sender_role or first_msg.sender
        decision_clause = ""
        active_decs = [d for d in decisions if d.is_current] if decisions else []
        if len(active_decs) > 1:
            dec_list = [d.decision for d in active_decs]
            decision_clause = f" Decisions: {'; '.join(dec_list)}."
        elif active_decs:
            decision_clause = f" Decision: {active_decs[0].decision}."
        elif approvals:
            decision_clause = f" Approved: {approvals[0].item_approved}."

        short_summary = (
            f"Thread on '{topic}' initiated by {init_actor}.{decision_clause} "
            f"Current status: {status_info.explanation}"
        )

        # 2. Detailed chronological summary
        # Synthesize progression across start, middle, and latest stages
        progression = []
        progression.append(f"Request/Proposal: {first_msg.body[:140].strip()}...")

        if len(emails) > 2:
            mid_msg = emails[len(emails) // 2]
            progression.append(f"Discussion: {mid_msg.body[:140].strip()}...")

        if active_decs:
            for d in active_decs:
                cond_str = f" Conditions: {d.scope_qualifier}." if d.is_conditional and d.scope_qualifier else ""
                progression.append(f"Formal Outcome: {d.decision}. Authority: {d.authority}.{cond_str}")
        elif decisions:
            d = decisions[0]
            cond_str = f" Conditions: {d.scope_qualifier}." if d.is_conditional and d.scope_qualifier else ""
            progression.append(f"Formal Outcome: {d.decision}. Authority: {d.authority}.{cond_str}")

        if actions and actions[0].status.value != "none_stated":
            act = actions[0]
            dl_str = f" Deadline: {act.deadline}." if act.deadline else ""
            progression.append(f"Action Assigned: {act.description} to {act.owner}.{dl_str}")
        elif actions and actions[0].status.value == "none_stated":
            progression.append("Obligations: All actions completed; no pending tasks.")

        progression.append(f"Latest Situation: {status_info.explanation}")

        detailed_summary = " ".join(progression)

        # If LLM provider is available and thread is complex, allow LLM enrichment
        if llm_provider is not None:
            try:
                transcript = "\n".join([f"{e.sender}: {e.body[:150]}" for e in emails[:4]])
                prompt = f"Provide a one-sentence summary for institutional topic '{topic}':\n{transcript}"
                res = llm_provider.generate_json("You summarize institutional emails.", prompt)
                if "summary" in res and len(res["summary"]) > 20:
                    short_summary = res["summary"]
            except Exception:
                pass

        return short_summary, detailed_summary
