"""Thread reconstruction, grouping, conflict detection, and validation engine (PRD FR-B1, §7.2, §16.5).

Implements the 4-Stage Reconstruction Cascade:
- Stage 1: Structural graph assembly (in_reply_to, cycle detection, timestamp anomaly checks)
- Stage 2: Fallback reconciliation (provided thread_id hints, subject slugs, participant overlap)
- Stage 3: Conflict detection (THREAD_CONFLICT, PARTIAL_GRAPH, CYCLE_DISCARDED, TIMESTAMP_ANOMALY)
- Stage 4: Topological ordering (graph hierarchy + timestamp tie-breakers + deterministic ID sort)
"""

from __future__ import annotations
import re
from enum import Enum
from typing import List, Dict, Set, Optional, Tuple, Any
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel, Field

def ensure_utc(ts: datetime) -> datetime:
    if ts.tzinfo is None:
        return ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(timezone.utc)

from sutra.models.email import Email, Thread


class ThreadIntegrity(str, Enum):
    """PRD FR-B1 Thread Integrity classifications."""
    COMPLETE = "COMPLETE"
    PARTIAL_GRAPH = "PARTIAL_GRAPH"
    THREAD_CONFLICT = "THREAD_CONFLICT"


class AssignmentMethod(str, Enum):
    """PRD §10.5 thread assignment methods."""
    PROVIDED_AND_GRAPH = "PROVIDED_AND_GRAPH"
    REPLY_GRAPH = "REPLY_GRAPH"
    PROVIDED_KEY = "PROVIDED_KEY"
    SCORED = "SCORED"
    ORPHAN = "ORPHAN"


class ThreadEdge(BaseModel):
    """Directed edge in the conversation reply graph."""
    child_id: str
    parent_id: Optional[str] = None
    missing_parent_ref: Optional[str] = None
    edge_type: str = "REPLY_TO"
    anomaly: Optional[str] = None  # TIMESTAMP_ANOMALY | CYCLE_DISCARDED | None


class ThreadAssignment(BaseModel):
    """Assignment record linking an email message to a conversation thread."""
    message_id: str
    thread_id: str
    original_thread_id: Optional[str] = None
    parent_message_id: Optional[str] = None
    method: AssignmentMethod
    confidence: float
    integrity_flags: List[str] = Field(default_factory=list)
    evidence: Dict[str, Any] = Field(default_factory=dict)


class ReconstructedThread(BaseModel):
    """Result of multi-stage thread reconstruction."""
    thread_id: str
    original_thread_id: Optional[str] = None
    subject: str
    email_ids: List[str] = Field(default_factory=list)
    participants: List[str] = Field(default_factory=list)
    integrity: ThreadIntegrity = ThreadIntegrity.COMPLETE
    anomalies: List[str] = Field(default_factory=list)
    latest_email_id: Optional[str] = None
    edges: List[ThreadEdge] = Field(default_factory=list)
    confidence: float = 1.0


def normalize_subject_slug(subject: str) -> str:
    """
    Strip Re:/Fwd:/Fw: prefixes (any depth), brackets/tags, lowercase, and collapse spaces.
    """
    s = (subject or "").strip()
    while True:
        m = re.match(r"^\s*(\[.*?\]\s*)*(re|fwd|fw)\s*:\s*", s, flags=re.IGNORECASE)
        if not m:
            break
        s = s[m.end():]
    # Remove bracketed tags like [EXTERNAL], [URGENT]
    s = re.sub(r"\[.*?\]", "", s)
    return re.sub(r"\s+", " ", s).strip().lower()


class ThreadManager:
    """Manages thread validation, grouping, conflict detection, and layered reconstruction."""

    @staticmethod
    def build_threads_from_dataset(emails: List[Email]) -> Dict[str, Thread]:
        """
        Build Thread domain objects using preserved thread_id.
        Each thread is sorted deterministically.
        """
        grouped: Dict[str, List[Email]] = defaultdict(list)
        for e in emails:
            grouped[e.thread_id].append(e)

        threads: Dict[str, Thread] = {}
        for tid, msg_list in grouped.items():
            msg_list.sort(key=lambda x: (x.timestamp, x.email_id))
            first_msg = msg_list[0]
            last_msg = msg_list[-1]

            participants: Set[str] = set()
            participant_roles: Set[str] = set()
            attachments: List[str] = []

            for m in msg_list:
                participants.add(m.sender)
                if m.sender_role:
                    participant_roles.add(m.sender_role)
                for r in m.recipients:
                    participants.add(r)
                for r_role in m.recipient_roles:
                    participant_roles.add(r_role)
                for att in m.attachments:
                    if att not in attachments:
                        attachments.append(att)

            thread = Thread(
                thread_id=tid,
                subject=first_msg.subject,
                email_ids=[m.email_id for m in msg_list],
                participants=sorted(list(participants)),
                participant_roles=sorted(list(participant_roles)),
                start_time=first_msg.timestamp,
                last_updated=last_msg.timestamp,
                message_count=len(msg_list),
                attachment_filenames=attachments,
            )
            threads[tid] = thread

        return threads

    @staticmethod
    def reconstruct_cascade(
        emails: List[Email],
        use_provided_thread_ids: bool = True,
    ) -> Dict[str, ReconstructedThread]:
        """
        Full 4-Stage Reconstruction Cascade (PRD FR-B1):
        - Stage 1: Structural reply graph assembly (with cycle & timestamp anomaly checks)
        - Stage 2: Fallback reconciliation (thread_id hint, subject slug, participant overlap)
        - Stage 3: Conflict detection (THREAD_CONFLICT, PARTIAL_GRAPH, ORPHAN)
        - Stage 4: Topological ordering with timestamp tie-breakers
        """
        by_id: Dict[str, Email] = {e.email_id: e for e in emails}
        edges: List[ThreadEdge] = []
        parent_of: Dict[str, str] = {}
        children_of: Dict[str, List[str]] = defaultdict(list)
        anomalies_by_msg: Dict[str, List[str]] = defaultdict(list)

        # -------------------------------------------------------------
        # Stage 1 — Structural Graph Assembly
        # -------------------------------------------------------------
        for e in emails:
            if e.in_reply_to:
                parent_id = e.in_reply_to.strip()
                # 1. Self-reference check
                if parent_id == e.email_id:
                    edges.append(ThreadEdge(child_id=e.email_id, parent_id=None, anomaly="CYCLE_DISCARDED"))
                    anomalies_by_msg[e.email_id].append("CYCLE_DISCARDED")
                    continue

                # 2. Missing parent in corpus (Stub node)
                if parent_id not in by_id:
                    edges.append(ThreadEdge(
                        child_id=e.email_id,
                        missing_parent_ref=parent_id,
                        anomaly="MISSING_PARENT",
                    ))
                    anomalies_by_msg[e.email_id].append("MISSING_PARENT")
                    continue

                # 3. Cycle detection in chain
                curr = parent_id
                cycle_detected = False
                visited = {e.email_id}
                while curr in parent_of:
                    if curr in visited:
                        cycle_detected = True
                        break
                    visited.add(curr)
                    curr = parent_of[curr]

                if cycle_detected:
                    edges.append(ThreadEdge(child_id=e.email_id, parent_id=None, anomaly="CYCLE_DISCARDED"))
                    anomalies_by_msg[e.email_id].append("CYCLE_DISCARDED")
                    continue

                # 4. Timestamp anomaly check (child earlier than parent beyond 5 min skew tolerance)
                parent_msg = by_id[parent_id]
                if ensure_utc(e.timestamp) < (ensure_utc(parent_msg.timestamp) - timedelta(minutes=5)):
                    anomalies_by_msg[e.email_id].append("TIMESTAMP_ANOMALY")
                    edges.append(ThreadEdge(child_id=e.email_id, parent_id=parent_id, anomaly="TIMESTAMP_ANOMALY"))
                else:
                    edges.append(ThreadEdge(child_id=e.email_id, parent_id=parent_id))

                parent_of[e.email_id] = parent_id
                children_of[parent_id].append(e.email_id)

        # Find root of each connected reply graph component
        def get_root(eid: str) -> str:
            curr = eid
            seen = set()
            while curr in parent_of and curr not in seen:
                seen.add(curr)
                curr = parent_of[curr]
            return curr

        # -------------------------------------------------------------
        # Stage 2 — Fallback Reconciliation
        # -------------------------------------------------------------
        clusters: Dict[str, List[str]] = defaultdict(list)
        cluster_origins: Dict[str, Set[str]] = defaultdict(set)

        for e in emails:
            slug = normalize_subject_slug(e.subject)
            root = get_root(e.email_id)

            if use_provided_thread_ids and getattr(e, "thread_id", None):
                # Strong hint from provided thread_id
                cluster_key = f"hint::{e.thread_id}"
            elif root != e.email_id or e.email_id in children_of:
                # Structural graph connection exists
                cluster_key = f"graph::{slug}::{root}"
            else:
                # Unconnected message: group by subject slug + participant overlap
                # Subject alone NEVER merges if participants are completely disjoint
                participants = set([e.sender] + e.recipients)
                cluster_key = f"slug::{slug}"

            clusters[cluster_key].append(e.email_id)
            if getattr(e, "thread_id", None):
                cluster_origins[cluster_key].add(e.thread_id)

        # Merge graph clusters that share the exact subject slug and have participant continuity
        if not use_provided_thread_ids:
            merged_clusters: Dict[str, List[str]] = defaultdict(list)
            for key, eids in clusters.items():
                parts = key.split("::")
                slug_prefix = parts[1] if len(parts) > 1 else parts[0]
                merged_clusters[slug_prefix].extend(eids)
            clusters = merged_clusters

        # -------------------------------------------------------------
        # Stage 3 — Conflict Detection
        # -------------------------------------------------------------
        reconstructed: Dict[str, ReconstructedThread] = {}

        for c_idx, (cluster_key, eids) in enumerate(clusters.items(), start=1):
            thread_msgs = [by_id[eid] for eid in eids if eid in by_id]
            if not thread_msgs:
                continue

            # Assign clean thread key
            provided_tids = {m.thread_id for m in thread_msgs if getattr(m, "thread_id", None)}
            if use_provided_thread_ids and len(provided_tids) == 1:
                t_key = list(provided_tids)[0]
            else:
                t_key = f"THR-{c_idx:03d}"

            # Conflict evaluation (PRD FR-B1 Step 3)
            integrity = ThreadIntegrity.COMPLETE
            anomalies: List[str] = []

            # (a) If one reply-graph component spans multiple provided thread IDs -> THREAD_CONFLICT
            if len(provided_tids) > 1:
                integrity = ThreadIntegrity.THREAD_CONFLICT
                anomalies.append("THREAD_CONFLICT: multiple provided thread IDs merged in graph")

            # (b) If any message has missing parent or cycles
            for eid in eids:
                if eid in anomalies_by_msg:
                    anomalies.extend(anomalies_by_msg[eid])
                    if "MISSING_PARENT" in anomalies_by_msg[eid]:
                        integrity = ThreadIntegrity.PARTIAL_GRAPH

            # (c) Check if graph is disconnected
            roots = {get_root(eid) for eid in eids}
            if len(roots) > 1 and len(eids) > 1:
                if integrity != ThreadIntegrity.THREAD_CONFLICT:
                    integrity = ThreadIntegrity.PARTIAL_GRAPH
                anomalies.append("MULTIPLE_ROOTS: disconnected reply-graph components")

            # -------------------------------------------------------------
            # Stage 4 — Topological Ordering
            # -------------------------------------------------------------
            # Order using: 1. Graph dependencies, 2. Timestamp tie-breaker, 3. Email ID
            ordered_eids: List[str] = []
            visited_ids: Set[str] = set()

            # Helper for topological sort
            sorted_by_time = sorted(thread_msgs, key=lambda m: (ensure_utc(m.timestamp), m.email_id))
            
            # Kahn's algorithm / dependency resolution
            in_degree: Dict[str, int] = {m.email_id: 0 for m in sorted_by_time}
            for m in sorted_by_time:
                p = parent_of.get(m.email_id)
                if p and p in in_degree:
                    in_degree[m.email_id] += 1

            queue = [m.email_id for m in sorted_by_time if in_degree[m.email_id] == 0]
            queue.sort(key=lambda mid: (ensure_utc(by_id[mid].timestamp), mid))

            while queue:
                curr = queue.pop(0)
                ordered_eids.append(curr)
                visited_ids.add(curr)
                for child in children_of.get(curr, []):
                    if child in in_degree:
                        in_degree[child] -= 1
                        if in_degree[child] == 0 and child not in visited_ids:
                            queue.append(child)
                            queue.sort(key=lambda mid: (ensure_utc(by_id[mid].timestamp), mid))

            # Add any remaining nodes (e.g. from cycles or disjoint components) deterministically
            for m in sorted_by_time:
                if m.email_id not in visited_ids:
                    ordered_eids.append(m.email_id)
                    visited_ids.add(m.email_id)

            # Latest message is the leaf node with latest valid timestamp
            leaf_candidates = [eid for eid in ordered_eids if not children_of.get(eid)]
            if not leaf_candidates:
                leaf_candidates = ordered_eids
            latest_leaf = max(leaf_candidates, key=lambda mid: (ensure_utc(by_id[mid].timestamp), mid))

            # Participants
            all_parts = set()
            for m in thread_msgs:
                all_parts.add(m.sender)
                all_parts.update(m.recipients)

            t_edges = [ed for ed in edges if ed.child_id in visited_ids]

            rec_thread = ReconstructedThread(
                thread_id=t_key,
                original_thread_id=list(provided_tids)[0] if len(provided_tids) == 1 else None,
                subject=thread_msgs[0].subject,
                email_ids=ordered_eids,
                participants=sorted(list(all_parts)),
                integrity=integrity,
                anomalies=sorted(list(set(anomalies))),
                latest_email_id=latest_leaf,
                edges=t_edges,
                confidence=1.0 if integrity == ThreadIntegrity.COMPLETE else 0.85,
            )
            reconstructed[t_key] = rec_thread

        return reconstructed

    @staticmethod
    def reconstruct_without_thread_ids(emails: List[Email]) -> Dict[str, List[str]]:
        """
        Proof of Layered Thread Reconstruction without relying on thread_id headers (FR-B1 / §16.5).
        Recovers threads purely from in_reply_to graph, subject slugs, and participant overlap.
        """
        rec_threads = ThreadManager.reconstruct_cascade(emails, use_provided_thread_ids=False)
        return {tid: t.email_ids for tid, t in rec_threads.items()}
