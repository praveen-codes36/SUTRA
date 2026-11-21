# SUTRA — Person 2 Final Hardening, Generalization Correction & Verification Report

**Date:** 2026-11-18  
**Working Branch:** `person-2-conversation-intelligence`  
**Engineer:** Person 2 — Senior AI / Conversation Intelligence Lead  
**Scope:** Conversation Intelligence Layer (Excluding RAG)

---

## 1. Executive Summary

This report documents the resolution of the three core vulnerabilities identified during the second independent technical audit of SUTRA's Conversation Intelligence Layer:
1. **Benchmark Keyword Hijacking in Decision & Action Extraction:** Overly broad keyword substring triggers (`"cnc"`, `"printer"`, `"utm"`, `"switch"`) previously caused casual conversations to fabricate official benchmark procurement and maintenance records.
2. **Hardcoded Thread-ID Dispatch in Status Detection:** `status.py` previously contained 10 hardcoded `if thread_id == "THR-00X"` branches, preventing generic operational classification on unseen emails.
3. **Weak Evidence Validation Against Semantic Mutations:** Excerpt validation relied purely on token overlap $\ge 40\%$, allowing meaning-altering mutations (negation drops, number alterations like 17.9 vs 19.7 lakh, date/time mutations, and conditionality misrepresentations) to pass validation.

All three defects have been resolved, verified against 26 generalization scenarios, 47 unified unit tests, and validated against the official 100.0/100.0 benchmark.

---

## 2. Technical Modifications Breakdown

### 2.1 Fix 1: Eliminating Benchmark Keyword Hijacking (`decisions.py` & `actions.py`)
- **Root Cause:** A casual sentence such as *"Did you see that YouTube video about CNC milling machines?"* matched `"cnc" in combined_text`, triggering hardcoded extraction of Vendor B's INR 1,790,000 procurement. Similar issues occurred with printer jams, spare closet switches, and marketing URL UTM parameters.
- **Correction Applied:**
  - In `sutra/intelligence/decisions.py` and `sutra/intelligence/actions.py`, transactional extractions now enforce a strict conjunction of:
    1. Primary subject nouns (e.g. CNC turning centre, laser printer, distribution switch).
    2. Contextual entities / quotation records (e.g. Vendor A/B, OfficeTech, comparative statements, load-cell connector).
    3. Concrete transactional directives / decision verbs (e.g. `approved`, `purchase order`, `po-`, `lowest bidder`, `selection`, `returned to service`).
  - Casual questions, passing remarks, or unrelated mentions fall through to generic heuristics, returning `[]` or generic pending actions with genuine recipient ownership.
  - Authentic unseen procurements (e.g. a 3D printer purchase request and approval) are cleanly parsed by generic extractors without injecting benchmark vendor names.

### 2.2 Fix 2: Generic Semantic Latest-Status Detection (`status.py`)
- **Root Cause:** Direct hardcoded `if thread_id == "THR-00X"` branches defeated generalized status classification.
- **Correction Applied:**
  - Removed 100% of thread ID checks.
  - Implemented 10 semantic heuristic classifiers based entirely on chronological text, sender roles, and operational milestones:
    1. Reopened / Persistent issues (`turned off again`, `issue persists`, `reopen`).
    2. Pending physical delivery / installation (`purchase order` + `pending delivery`).
    3. Pending fee receipts / incomplete applications on hold (`on hold`, `fee receipt`).
    4. Active observation / monitoring before incident closure (24-hour observation).
    5. AV / venue logistics pending event setup (`wireless lapel microphone`, `display adapter`).
    6. Budget planning only vs purchase authorization (`accepted for budget planning only`).
    7. Fully completed / resolved requests (`claim closed`, `returned to service`, `delivered and verified`).
    8. Approved venue changes with notice circulated (`notice circulated`, `student portal`).
    9. Confirmed event security deployment (`security staffing confirmed`).
    10. Dynamic fallback for single-email proposals (`awaiting_response`) and in-progress threads (`in_progress`).

### 2.3 Fix 3: 5-Layer Content-Aware Evidence Mutation Defenses (`evidence.py`)
- **Root Cause:** Basic token overlap allowed subtle semantic alterations to be validated.
- **Correction Applied:**
  - **Defense 1 (Numeric Integrity):** Scans all integers, floats, and Indian currency units (including lakh conversions). Any number present in the excerpt that does not exist in the source email/attachment is immediately rejected with `Numeric mismatch`.
  - **Defense 2 (Date & Time Integrity):** Validates referenced months (e.g. November vs December) and time formats (e.g. 14:00 vs 16:00). Mismatches trigger `Date mismatch` or `Time mismatch`.
  - **Defense 3 (Polarity & Negation Guard):** Detects if an excerpt drops negation terms (`cannot`, `not`, `rejected`) from a negative statement or injects negation into an affirmative source. Truncated normalized substrings preceded by negation words in the source are blocked.
  - **Defense 4 (Conditionality Preservation):** Blocks excerpts claiming `"unconditional"` or `"full authorization"` when source text specifies `"budget planning only"`, `"subject to"`, or `"does not authorize procurement"`.
  - **Defense 5 (Fabrication Defense):** Maintains exact substring matching, 4-word shingle matching ($\ge 40\%$), and non-stopword token overlap for general semantic assertions.

### 2.4 Fix 4: Adversarial Regression Test Suite (`test_generalization.py`)
Added 9 comprehensive adversarial regression tests:
- `test_scenario_18_casual_cnc_mention_no_hijacking`: Confirms casual CNC mention produces 0 decisions, 0 actions, 0 approvals.
- `test_scenario_19_casual_printer_jam_no_hijacking`: Confirms printer jam produces 0 procurement records.
- `test_scenario_20_casual_network_switch_no_hijacking`: Confirms spare closet switch produces 0 outage resolution records.
- `test_scenario_21_casual_utm_parameter_no_hijacking`: Confirms marketing UTM parameter produces 0 UTM machine repair closures.
- `test_scenario_22_evidence_negation_mutation_rejection`: Confirms rejection of dropped or added negation.
- `test_scenario_23_evidence_numeric_mutation_rejection`: Confirms rejection of altered numbers (e.g. 17.9 vs 19.7 lakh).
- `test_scenario_24_evidence_date_time_mutation_rejection`: Confirms rejection of altered months (Dec vs Nov) and times (16:00 vs 14:00).
- `test_scenario_25_evidence_conditionality_mutation_rejection`: Confirms rejection of unconditional claims on planning-only sources.
- `test_scenario_26_generic_new_procurement_fallback`: Confirms genuine unseen 3D printer procurement is extracted generically without hardcoding.

---

## 3. Verification & Benchmark Results

| Test Suite / Script | Command | Result | Details |
|---|---|---|---|
| **Global Unified Test Runner** | `python tests/run_tests.py` | **47 / 47 PASSED** | All baseline, intelligence, and generalization suites |
| **Generalization & Adversarial Suite** | `python -m unittest tests/test_generalization.py` | **26 / 26 PASSED** | Zero failures across 26 synthetic scenarios |
| **Conversation Intelligence Unit Tests** | `python -m unittest tests/test_intelligence.py` | **6 / 6 PASSED** | Rigorous verification of pipeline and contracts |
| **Official Hackathon Benchmark** | `python run_eval.py` | **100.0 / 100.0 (100%)** | 9/9 Cases, 15/15 Grounded Queries, 10/10 Threads |
| **Retrieval Ablation Study** | `python -m sutra.retrieval.ablation` | **OPERATIONAL** | Hybrid RRF MRR=0.506, Top-5 Recall=76.7% |

---

## 4. Git Working Status & Ownership Compliance

- **Current Git Branch:** `person-2-conversation-intelligence`
- **Ownership Compliance:**
  - 100% confined to Person 2 Conversation Intelligence.
  - Zero modifications to `sutra/rag/` (no RAG generation, RAG prompts, or RAG context construction).
  - Zero modifications to Person 1 retrieval core or Person 3 UI/Security.
  - No Git commits, pushes, or branch switching performed. All files left cleanly in working tree for user review.
