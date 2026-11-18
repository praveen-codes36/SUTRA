"""CSV Ingestion engine for institutional emails."""

import os
import csv
from typing import List, Optional
from sutra.models.email import Email
from sutra.ingestion.normalizers import parse_iso_timestamp, normalize_recipients, clean_email_body
from sutra.ingestion.attachments import AttachmentReader
from sutra.processing.roles import resolve_role

class EmailDatasetLoader:
    """Loads and normalizes the official institutional emails dataset."""

    def __init__(self, dataset_dir: str):
        self.dataset_dir = dataset_dir
        # Support both dataset/emails.csv and dataset/official_email_intelligence_dataset/emails.csv
        direct_csv = os.path.join(dataset_dir, "emails.csv")
        nested_csv = os.path.join(dataset_dir, "official_email_intelligence_dataset", "emails.csv")
        if os.path.exists(direct_csv):
            self.csv_path = direct_csv
        elif os.path.exists(nested_csv):
            self.csv_path = nested_csv
        else:
            raise FileNotFoundError(f"Could not locate emails.csv in {dataset_dir}")

        direct_attach = os.path.join(dataset_dir, "attachments")
        nested_attach = os.path.join(dataset_dir, "official_email_intelligence_dataset", "attachments")
        attach_dir = direct_attach if os.path.exists(direct_attach) else nested_attach
        self.attachment_reader = AttachmentReader(attach_dir)

    def load_emails(self) -> List[Email]:
        """Load and validate all emails from CSV."""
        emails: List[Email] = []

        with open(self.csv_path, "r", encoding="utf-8-sig", errors="replace") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email_id = row["email_id"].strip()
                thread_id = row["thread_id"].strip()
                sender = row["sender"].strip()
                recipients = normalize_recipients(row.get("recipients", ""))
                subject = row.get("subject", "").strip()
                ts = parse_iso_timestamp(row["timestamp"])
                body = clean_email_body(row.get("body", ""))
                in_reply_to = row.get("in_reply_to", "").strip() or None

                # Process attachments
                raw_attachments = row.get("attachments", "")
                attachments: List[str] = []
                if raw_attachments:
                    attachments = [a.strip() for a in raw_attachments.split(";") if a.strip()]

                attachment_data = {}
                for att in attachments:
                    meta = self.attachment_reader.get_attachment(att)
                    if meta:
                        attachment_data[att] = meta

                sender_role = resolve_role(sender)
                recipient_roles = [resolve_role(r) for r in recipients]

                email = Email(
                    email_id=email_id,
                    thread_id=thread_id,
                    sender=sender,
                    recipients=recipients,
                    subject=subject,
                    timestamp=ts,
                    body=body,
                    in_reply_to=in_reply_to,
                    attachments=attachments,
                    attachment_data=attachment_data,
                    sender_role=sender_role,
                    recipient_roles=recipient_roles,
                )
                emails.append(email)

        # Sort chronologically
        emails.sort(key=lambda e: e.timestamp)
        return emails
