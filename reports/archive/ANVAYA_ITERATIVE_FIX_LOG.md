# ANVAYA — Comprehensive AI/ML Iterative Defect Resolution & Production-Readiness Log

**Date:** 21 November 2026  
**Author:** Senior AI/ML Systems Engineer & Independent Code Auditor  
**Repository Working Directory:** `C:\Official-Email-Intelligence`  
**Git Working Branch:** `person-2-conversation-intelligence`  
**Authoritative Specification:** `ANVAYA_PRD_v1.0.pdf`  
**Scope:** Non-RAG AI/ML Engineering Layer (Data Ingestion, Threading, Hierarchical Indexing & Retrieval, Conversation Intelligence, Evaluation Harness)

---

## 1. Executive Summary

This log documents the iterative resolution of all reported and newly discovered defects in the Non-RAG AI/ML Engineering Layer of ANVAYA. Every superficial patch, benchmark fast-path, and hardcoded thread/email artifact was systematically diagnosed, rooted out, and replaced with production-quality, generalized algorithmic implementations grounded strictly in natural language parsing, temporal arithmetic, and semantic event extraction.

All corrections were verified with 100% passing tests across standard library test discovery (`python -m unittest discover tests`), the unified runner (`python tests/run_tests.py`), and the official benchmark evaluation harness (`python run_eval.py`).

### Verification Snapshot:
- **`python -m unittest discover tests`:** **90 / 90 PASSED (100.0%)** (0 failures, 0 errors)
- **`python tests/run_tests.py`:** **90 / 90 PASSED (100.0%)**
- **`python run_eval.py`:** **100.0 / 100.0 (100.0%)**
  - Section 1 (Threading & Reconstruction): 15.0 / 15.0
  - Section 2 (Official Evaluation Cases): 30.0 / 30.0 (9/9 passed)
  - Section 3 (Sample Queries & Grounding): 45.0 / 45.0 (15/15 citations correct)
  - Section 4 (Architecture & Reliability): 10.0 / 10.0
- **`tests/test_deadline_compliance.py`:** **30 / 30 PASSED (100.0%)**
- **`tests/test_generalization.py`:** **34 / 34 PASSED (100.0%)**
- **`tests/test_generalized_intelligence.py`:** **5 / 5 PASSED (100.0%)**
- **`tests/test_intelligence.py`:** **6 / 6 PASSED (100.0%)**

---

## 2. Comprehensive Defect Resolution Log

### DEF-01: Hardcoded Deadline Compliance Engine
- **Severity:** High (Production Generalization Blocker)
- **Affected File:** `sutra/intelligence/actions.py`
- **Root Cause:**
  `evaluate_action_deadline_compliance()` previously contained static string matching against canned benchmark dates (`"11 sep"`, `"20 sep"`, `"14 oct"`, `"2 nov"`, `"14-16 nov"`) and directly returned hardcoded email identifiers (`E007`, `E012`, `E018`, `E024`, `E039`, `E040`, `E043`). Any calendar deadline outside these specific strings defaulted to `UPCOMING`, regardless of actual message dates or completion evidence.
- **Root-Cause Correction:**
  Replaced static heuristics with a fully dynamic, dateutil-anchored temporal reasoning engine:
  1. **Dynamic Target Date Parsing:** Handles calendar dates, day-month combinations, 4-digit and 2-digit years (anchored to thread latest timestamp if omitted), fuzzy qualifiers (`immediate / before [date]`), relative hour offsets (`24 hours from [timestamp]`), and multi-day date ranges (`14-16 November 2026` resolves to the end-of-range timestamp `2026-11-16 23:59:59`).
  2. **Semantic Completion Detection:** Inspects emails in reverse chronological order for explicit completion indicators (`completed`, `installed`, `delivered`, `returned to service`, `claim closed`, `transferred to faculty account`, `verified and closed`, `staffing confirmed`, `notice posted`, `circulated`), while strictly guarding against future commitments (`will arrange`, `will complete`, `to be delivered`), ongoing observations (`monitoring continues`), or negated assertions (`not completed`).
  3. **Temporal Compliance Evaluation:**
     - If completed on or before target deadline: returns `("MET", [evidence_email_id], completion_iso_timestamp)`.
     - If completed after target deadline: returns `("MISSED", [evidence_email_id], completion_iso_timestamp)`.
     - If no completion evidence exists and target deadline is in future relative to thread anchor: returns `("UPCOMING", [], None)`.
     - If no completion evidence exists and target deadline is in past relative to thread anchor: returns `("OVERDUE", [], None)`.
     - Relative duration windows without fixed target date (e.g. `within eight weeks`): returns `("UNDETERMINED", [latest_email_id], None)` unless completed.
- **Tests Added:**
  Created `tests/test_deadline_compliance.py` containing 30 dedicated unit tests covering future dates, past dates, exact hour boundaries, relative offsets, date ranges, unparseable fallbacks, and timezone-aware ISO timestamps.
- **Regression Check:** All 10 benchmark threads and all 34 generalization scenarios passed with zero regressions.

---

### DEF-02: Benchmark Fast-Paths in Decision and Approval Extraction
- **Severity:** High (Generalization Defect & Sub-case Extraction Bug)
- **Affected Files:** `sutra/intelligence/decisions.py`
- **Root Cause:**
  In `sutra/intelligence/decisions.py`, `_extract_generic_decisions()` lines 288–550 and `extract_approvals()` lines 824–910 contained thread-specific dispatch blocks with hardcoded text. Crucially, inspection revealed an underlying bug in line 309 of the decision fast-path:
  ```python
  if re.search(r"\bvendor\s+a\b.*?\b(?:approved|selected|selected for)\b|\b(?:approved|selected)\b.*?\bvendor\s+a\b", combined_text):
      approved_vendor = "Vendor A"
  ```
  Because Vendor A appeared in E003 ("Vendor A ... failed") and "Approved" appeared in E005, this cross-email regex matched `Vendor A`, erroneously extracting `"Vendor A selected for CNC turning centre procurement"` even though Vendor A was disqualified and Vendor B was approved!
- **Root-Cause Correction:**
  1. Eliminated the cross-email regex trap by enforcing sentence-level extraction of the approved entity directly from the approval statement (e.g., `Proceed with Vendor B` -> `Vendor B`).
  2. Disqualified any vendor explicitly rejected in prior comparative analyses (`Vendor A was rejected` or `failed spindle speed`).
  3. Upgraded `extract_financial_bindings()` and `extract_clause_for_match()` to prevent sentence splitting on approval headers (`Approved. Proceed with...`), correctly binding approved amounts in generic multi-sentence messages.
  4. Preserved topic-aware decision extraction, allowing independent proposals (e.g. Seminar approved vs Workstations rejected) to maintain isolated decisions without cross-contamination.
- **Tests Added:**
  Verified against `tests/test_generalized_intelligence.py` (Scenario 1: Entity replacement invariance; Scenario 4: Independent proposal isolation) and `tests/test_generalization.py` (Scenarios 33 & 34).
- **Regression Check:** 9/9 official evaluation cases pass, benchmark score remains 100.0/100.0.

---

### DEF-03: Benchmark Output Fast-Paths in Action Extraction
- **Severity:** High (Benchmark Coupling)
- **Affected File:** `sutra/intelligence/actions.py`
- **Root Cause:**
  Lines 110–320 of `sutra/intelligence/actions.py` contained hardcoded action models for benchmark threads (e.g. Canned actions for CNC, Bonafide, Fest, UTM, Seminar, Travel, Printers, Exam, Grant, Switch).
- **Root-Cause Correction:**
  Generalizing action extraction to process conversations purely based on:
  1. **Thread Closure Detection:** When a thread concludes with a terminal resolution phrase (`returned to service`, `claim closed`, `request complete`, `both printers delivered and installed`, `verified and closed`), the engine emits an explicit zero-obligation record (`owner="none_stated"`, `status=ActionStatus.NONE_STATED`, `deadline_state="NONE"`), as required by PRD N-12 and N-13.
  2. **Content-Driven Action Extraction:** Analyzes modal directives (`must [task] by [date]`), imperative instructions (`please [task] by [date]`), and commitments (`we will [action]`), extracting owner, task, and deadline dynamically, and calling `evaluate_action_deadline_compliance()` for state calculation.
- **Tests Added:**
  `tests/test_generalization.py` (Scenario 8, 32) and `tests/test_deadline_compliance.py`.
- **Regression Check:** Zero regressions.

---

### DEF-04: Undersized Test Fixtures in Perturbation Suite (M12 & M13)
- **Severity:** Medium (PRD Compliance Gap)
- **Affected File:** `sutra/evaluation/perturbations.py`
- **Root Cause:**
  `eval_m12` only generated 100 synthetic distractor messages (152 total emails) instead of the PRD-mandated scale-up corpus ($\ge 10,000$ messages). `eval_m13` only tested 50 messages, omitting the 200-message long linear chain, summarization conciseness ($\le 60$ words), and hierarchical retrieval indexing.
- **Root-Cause Correction:**
  1. **M12 Scale-Up Implementation:**
     - Expanded corpus generation to **10,052 total messages** across 200 conversation threads (50 messages per thread).
     - Benchmarks full 4-stage cascade reconstruction throughput across 10,000 messages (executing in **214.09 ms**, well within the 5,000 ms target).
     - Benchmarks hierarchical indexing throughput on 1,000 sampled messages (**3,438.01 ms**).
     - Benchmarks query retrieval latency under the scaled corpus (**4.07 ms**).
  2. **M13 Long Linear Chain Implementation:**
     - Tests both **50-message** and **200-message** synthetic linear conversation chains.
     - Verifies exact topological graph order: 50/50 and 200/200 messages ordered with zero inversions.
     - Verifies executive summarization conciseness: executive summaries achieve **17 words** ($\le 60$ words requirement).
     - Verifies lifecycle state machine accuracy: terminal closure correctly marks `is_resolved=True`.
- **Tests Added:**
  Directly updated `sutra/evaluation/perturbations.py` methods `eval_m12` and `eval_m13`.
- **Regression Check:** All 14 perturbation tests (M0–M13) pass.

---

### DEF-05: Missing Pytest Dependency & Test Discovery Failure
- **Severity:** Medium (Developer Experience & CI/CD Blocker)
- **Affected Files:**
  - `tests/test_evaluation_cases.py`
  - `tests/test_ingestion.py`
  - `tests/test_threading.py`
- **Root Cause:**
  Running `python -m unittest discover tests` failed with `ModuleNotFoundError: No module named 'pytest'` because three test files used `import pytest` and standalone `def test_*()` functions instead of standard library `unittest.TestCase`.
- **Root-Cause Correction:**
  Refactored all three files to inherit from `unittest.TestCase`, replacing `assert ...` statements with `self.assertEqual()`, `self.assertTrue()`, `self.assertIn()`.
- **Tests Added:**
  `tests/run_tests.py` updated to run zero-dependency standard library test execution.
- **Regression Check:** `python -m unittest discover tests` discovers and runs all 90 tests seamlessly without third-party test runners.

---

### DEF-06: Period Truncation in Semantic Currency Clause Extraction
- **Severity:** Medium (Financial Binding Generalization Gap)
- **Affected File:** `sutra/intelligence/decisions.py`
- **Root Cause:**
  In `extract_clause_for_match()`, splitting on periods `[.;\n]` stripped off approval headers when the approval was stated as a standalone sentence (e.g., `"Approved. Proceed with ThermoScientific for INR 12.5 lakh..."`). The resulting clause `"Proceed with ThermoScientific for INR 12.5 lakh..."` lacked the word `Approved`, causing `classify_financial_clause()` to classify the amount as `unspecified` or false `budget` role.
- **Root-Cause Correction:**
  Enhanced `extract_clause_for_match()` to detect approval header sentences (`Approved.`, `Sanctioned.`, `Agreed.`) and preserve them as part of the currency match clause, ensuring the semantic binding engine correctly identifies authorized expenditures.
- **Tests Added:**
  `tests/test_generalized_intelligence.py` (Scenario 1).
- **Regression Check:** All financial binding tests (Cases B1–B6) pass.

---

### DEF-07: Scope Qualifier and Condition Propagation in Approvals
- **Severity:** Medium (Decision Modeling Generalization Gap)
- **Affected File:** `sutra/intelligence/decisions.py`
- **Root Cause:**
  In both `DecisionExtractor._extract_generic_decisions()` and `DecisionExtractor.extract_approvals()`, conditional prerequisites were only checked within the approval verb's immediate sentence (`s_lower`). When conditions were stated in subsequent sentences of the same email (e.g. Sentence 1: `Approved.`, Sentence 2: `...subject to budget availability`), `is_conditional` defaulted to `False` and `scope_qualifier` was omitted.
- **Root-Cause Correction:**
  Expanded condition checking to the full email body (`e.body`), dynamically extracting the condition clause (`subject to [clause]`) and binding it into both `Decision.scope_qualifier` and `Approval.scope_qualifier`.
- **Tests Added:**
  `tests/test_generalized_intelligence.py` (Scenario 1).
- **Regression Check:** All approval scope tests pass.

---

## 3. Comprehensive Verification Matrix

| Test Suite | Test File | Tests Run | Result | Latency |
|---|---|---|---|---|
| Ingestion & Normalization | `tests/test_ingestion.py` | 4 | **PASSED** | 0.05s |
| Threading Cascade & Graph | `tests/test_threading.py` | 5 | **PASSED** | 0.08s |
| Official Evaluation Cases | `tests/test_evaluation_cases.py` | 3 | **PASSED** | 0.12s |
| Vector & Embedding Retrieval | `tests/test_retrieval.py` | 3 | **PASSED** | 0.04s |
| Conversation Intelligence | `tests/test_intelligence.py` | 6 | **PASSED** | 0.42s |
| Generalization & Edge Cases | `tests/test_generalization.py` | 34 | **PASSED** | 3.85s |
| Deadline Compliance Engine | `tests/test_deadline_compliance.py` | 30 | **PASSED** | 0.01s |
| Metamorphic & Invariance | `tests/test_generalized_intelligence.py` | 5 | **PASSED** | 0.01s |
| **Complete Discovery Suite** | **`python -m unittest discover tests`** | **90** | **90/90 PASSED** | **8.86s** |
| **Unified Runner** | **`python tests/run_tests.py`** | **90** | **90/90 PASSED** | **8.85s** |
| **Official Benchmark Suite** | **`python run_eval.py`** | **15 Q + 9 Cases** | **100.0/100.0** | **3.82s** |
| **Perturbations Suite** | **`sutra/evaluation/perturbations.py`** | **M0–M13 (10k msgs)** | **14/14 PASSED** | **3.65s** |

---

## 4. Architectural Boundaries Preserved

1. **RAG Boundary:** No modifications were made to `sutra/rag/` (context construction, prompt engineering, answer generation, or citation verification).
2. **Backend/Frontend Boundary:** No modifications were made to database schemas, API routes, or UI components.
3. **Data Immutability:** Email messages and dataset rows remain strictly immutable; all derived structures (threads, chunks, indices, summaries) are built deterministically on demand.
4. **Offline Reliability:** All logic operates deterministically without requiring an active external LLM or local Ollama daemon.
