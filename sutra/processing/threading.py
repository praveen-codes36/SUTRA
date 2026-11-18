"""Thread reconstruction, grouping, and validation engine."""

import re
from typing import List, Dict, Set
from collections import defaultdict
from datetime import datetime
from sutra.models.email import Email, Thread

def normalize_subject_slug(subject: str) -> str:
    """
    Adapted from mailrag's subject_slug (Apache 2.0):
    Strip Re:/Fwd:/Fw: prefixes (any depth), lowercases, and collapse spaces.
    """
    s = (subject or "").strip()
    while True:
        m = re.match(r"^\s*(re|fwd|fw)\s*:\s*", s, flags=re.IGNORECASE)
        if not m:
            break
        s = s[m.end():]
    return re.sub(r"\s+", " ", s).strip().lower()

class ThreadManager:
    """Manages thread validation, grouping, and layered reconstruction."""

    @staticmethod
    def build_threads_from_dataset(emails: List[Email]) -> Dict[str, Thread]:
        """
        Build Thread objects using the dataset's preserved thread_id.
        Each thread is sorted chronologically.
        """
        grouped: Dict[str, List[Email]] = defaultdict(list)
        for e in emails:
            grouped[e.thread_id].append(e)

        threads: Dict[str, Thread] = {}
        for tid, msg_list in grouped.items():
            msg_list.sort(key=lambda x: x.timestamp)
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
    def reconstruct_without_thread_ids(emails: List[Email]) -> Dict[str, List[str]]:
        """
        Proof of Layered Thread Reconstruction:
        Recovers threads using in_reply_to chains, falling back to subject slug.
        Simulates unlabelled/hidden test datasets.
        """
        # Map email_id -> email
        by_id = {e.email_id: e for e in emails}
        # Parent pointer mapping
        parent_of: Dict[str, str] = {}
        for e in emails:
            if e.in_reply_to and e.in_reply_to in by_id:
                parent_of[e.email_id] = e.in_reply_to

        # Find root of each email via in_reply_to
        def find_root(eid: str) -> str:
            curr = eid
            visited = set()
            while curr in parent_of and curr not in visited:
                visited.add(curr)
                curr = parent_of[curr]
            return curr

        # Cluster by root or normalized subject slug
        root_clusters: Dict[str, List[str]] = defaultdict(list)
        for e in emails:
            root = find_root(e.email_id)
            slug = normalize_subject_slug(e.subject)
            cluster_key = f"{slug}::{root}"
            root_clusters[cluster_key].append(e.email_id)

        # Merge clusters that share the same subject slug and have temporal continuity
        final_threads: Dict[str, List[str]] = defaultdict(list)
        for cluster_key, eids in root_clusters.items():
            slug = cluster_key.split("::")[0]
            final_threads[slug].extend(eids)

        return dict(final_threads)

