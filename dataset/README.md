# Official Email Intelligence System — Synthetic Benchmark Dataset

## Files
- `emails.csv`: 52 fictional email messages across 10 threads.
- `attachments/`: synthetic supporting documents referenced by messages.
- `sample_queries.csv`: 15 natural-language queries with gold thread/message references and reference answers.
- `evaluation_cases.csv`: 9 evaluation cases for decision, status, amount, owner, pending-action, and grounding extraction.

## emails.csv schema
- `email_id`: unique message ID.
- `thread_id`: conversation ID.
- `sender`: sender email address.
- `recipients`: semicolon-separated recipient addresses.
- `subject`: email subject.
- `timestamp`: ISO-8601 timestamp in UTC (`Z`).
- `body`: email body text.
- `in_reply_to`: parent email ID, if available.
- `attachments`: semicolon-separated filenames under `attachments/`.

## Notes
1. All names, addresses, institution details, vendors, and messages are fictional.
2. This is a starter benchmark dataset, not real institutional email data.
3. Reference answers are guidance; equivalent correct wording should receive credit.
4. Gold email IDs indicate strong supporting evidence. Systems may cite additional relevant messages.
5. Cases deliberately test nuance: budget-plan acceptance is not purchase authorization; a timetable update may change venue without changing date/time; and a thread may have no explicit pending action.
6. Evaluate retrieval by relevance and evidence coverage, not exact string matching alone.
7. Amounts are synthetic INR values.
