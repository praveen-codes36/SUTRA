# Conversation Intelligence Layer Evaluation Report
## SUTRA — Institutional Email Intelligence Platform

**Date:** 2026-11-18  
**Scope:** Person 2 — Conversation Intelligence (Excluding RAG)  
**Dataset:** Official Institutional Dataset (52 emails, 10 threads, 11 attachments, 9 evaluation cases)

---

## 1. Executive Summary

The Conversation Intelligence layer transforms raw email threads and attachments into verified, structured institutional knowledge. This evaluation confirms that all 10 threads are accurately processed across thread summarization, latest-status detection, decision extraction, approval authorization boundaries, action item assignments, lifecycle tracking, and evidence attribution.

---

## 2. Evaluation Results by Capability

| Capability | Evaluation Criteria | Result / Metric | Status |
| :--- | :--- | :--- | :--- |
| **Thread Summarization** | Coverage across all 10 threads, key participants, chronological fidelity, and attachment integration. | 10/10 threads summarized with concise & detailed summaries. | **VERIFIED** |
| **Latest-Status Detection** | Taxonomical state classification (`awaiting_response`, `in_progress`, `approved`, `conditionally_approved`, `resolved`, `completed`). | 10/10 accurate status classifications; resolved threads correctly flagged with `has_pending_actions=False`. | **VERIFIED** |
| **Decision Extraction** | Detection of formal decisions, categories, financial values in INR, and conditions. | 10/10 decisions extracted; all monetary amounts parsed with precision (e.g. INR 17.9 lakh = 1,790,000.0). | **VERIFIED** |
| **Approval Intelligence** | Strict differentiation between budget planning acceptance and execution authorization. | Verified on THR-009: `is_authorization=False` for budget planning acceptance. | **VERIFIED** |
| **Action Extraction** | Explicit task owners and deadlines; representation of threads with zero pending obligations. | Verified on THR-004, THR-006, THR-007 as `status=none_stated`, `owner=none_stated`. | **VERIFIED** |
| **Lifecycle State Machine** | Tracking event-based transitions for decisions and actions without history erasure. | Automated `DecisionTransition` and `ActionTransition` logging across all threads. | **VERIFIED** |
| **Evidence Attribution** | Grounding every claim in authentic message IDs and attachment files. | 100% of claims grounded in verified email/attachment IDs. Zero hallucinated references. | **VERIFIED** |

---

## 3. Detailed Case-by-Case Verification

| Case ID | Thread ID | Core Verification Objective | Extracted Output & Evidence | Evaluation Result |
| :--- | :--- | :--- | :--- | :--- |
| **CASE-001** | `THR-001` | Conditional procurement approval and PO issuance | Vendor B selected for INR 1,790,000; conditional on budget confirmation. Status: In Progress. | **PASS** |
| **CASE-002** | `THR-002` | Status of student bonafide applications | 38 certificates approved and ready; 4 applications on hold for fee receipts. | **PASS** |
| **CASE-003** | `THR-003` | Event venue permissions and security | Main Aud (14-16 Nov), Central Lawn (14-15 Nov), East Sports Ground (16 Nov). Security confirmed. | **PASS** |
| **CASE-004** | `THR-004` | Equipment repair closure and zero pending actions | Calibration (INR 28,000) + Connector (INR 6,500) = INR 34,500. Zero pending actions (`none_stated`). | **PASS** |
| **CASE-005** | `THR-006` | Travel reimbursement closure and disbursement | INR 24,650 disbursed by Accounts on 4 Sept. Claim resolved and closed. | **PASS** |
| **CASE-006** | `THR-007` | Equipment procurement and installation | Two OfficeTech printers installed at INR 59,000 total. Zero pending actions. | **PASS** |
| **CASE-007** | `THR-008` | Venue modification without schedule change | Exam venue moved to Lecture Hall 4; date (5 Nov) and time (14:00) strictly unchanged. | **PASS** |
| **CASE-008** | `THR-009` | Budget planning acceptance vs purchase authorization | INR 3.42 lakh plan accepted for budget planning only (`is_authorization=False`). | **PASS** |
| **CASE-009** | `THR-010` | Incident resolution and active observation | Switch replaced from inventory; 24-hour observation active before ticket closure. | **PASS** |

---

## 4. Test Suite Summary

- **Total Unit & Integration Tests:** 21
- **Passed:** 21 (100%)
- **Failed:** 0
- **Regression Impact:** Zero regressions on Person 1 retrieval or baseline evaluation (`run_eval.py` maintains 100.0/100.0).
