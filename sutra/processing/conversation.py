"""Conversation assembly and context formatting."""

from typing import List, Dict
from sutra.models.email import Email

class ConversationAssembler:
    """Combines individual messages into coherent conversation documents."""

    @staticmethod
    def assemble_thread_context(emails_in_thread: List[Email]) -> str:
        """
        Produce a chronologically ordered, rich text transcript of a thread
        including participants, institutional roles, body text, and attachments.
        """
        sorted_emails = sorted(emails_in_thread, key=lambda e: e.timestamp)
        lines: List[str] = []

        if sorted_emails:
            lines.append(f"=== CONVERSATION THREAD: {sorted_emails[0].thread_id} ===")
            lines.append(f"Subject: {sorted_emails[0].subject}")
            lines.append(f"Message Count: {len(sorted_emails)}")
            lines.append("")

        for idx, email in enumerate(sorted_emails, 1):
            sender_title = f"{email.sender_role} ({email.sender})" if email.sender_role else email.sender
            recipients_str = "; ".join(email.recipients)
            lines.append(f"--- [Message {idx}/{len(sorted_emails)} | ID: {email.email_id}] ---")
            lines.append(f"Date: {email.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            lines.append(f"From: {sender_title}")
            lines.append(f"To: {recipients_str}")
            if email.in_reply_to:
                lines.append(f"In-Reply-To: {email.in_reply_to}")
            if email.attachments:
                lines.append(f"Attachments: {', '.join(email.attachments)}")
            lines.append("")
            lines.append(email.body)
            lines.append("")

            # Inline attachment summary if present
            if email.attachment_data:
                for att_name, meta in email.attachment_data.items():
                    lines.append(f"[ATTACHED DOCUMENT: {att_name} ({meta.file_type})]")
                    lines.append(meta.content_text)
                    lines.append("")

        return "\n".join(lines)

