# ANVAYA — Canonical Validation, Generalization & Stress-Testing Report

**Document:** Canonical Validation and Stress-Testing Report  
**Reference Document:** `ANVAYA_PRD_v1.0.pdf` (§16.5, §16.6)  
**Author:** Senior AI/ML Engineer & Systems Quality Auditor  
**Date:** 2026-11-21  
**Baseline Tag:** `anvaya-ai-ml-baseline-v1.0`  
**Execution Environment:** Python 3.12.15 Virtual Environment (`.venv`)  
**Status:** **ALL STRESS & GENERALIZATION TARGETS PASSED**

---

## 1. Executive Summary

This report establishes the canonical verification record for ANVAYA's robustness, generalization, and scaling characteristics. 

To prove that the platform does not overfit to the 10 benchmark threads or 15 official queries, the implementation was evaluated across:
1. **Zero-Shot Synthetic Scenarios (`test_generalization.py`):** 34 tests covering 17 unseen scenarios.
2. **Deadline Compliance Engine (`test_deadline_compliance.py`):** 30 tests covering relative dates, deadline updates, and conflicts.
3. **Metamorphic Invariance (`test_generalized_intelligence.py`):** 5 tests validating mathematical invariance under semantic transformations.
4. **Scale-Up Stress Test M12:** Ingestion and reconstruction of 10,052 messages across 210 threads.
5. **Long-Chain Stress Test M13:** 50-message and 200-message linear chains.

---

## 2. Generalization Test Suite Summary (17 Synthetic Scenarios)

The test suite in `tests/test_generalization.py` executes 34 automated assertions against completely disjoint institutional conversations (`SYN-THR-101` through `SYN-THR-117`):

| Scenario | Institutional Case Description | Expected Behavior | Result |
| :--- | :--- | :--- | :--- |
| **SYN-01** | Procurement request without approval | Marked `AWAITING_RESPONSE`, zero decisions | **PASS** |
| **SYN-02** | Conditional approval with prerequisites | Decision extracted with `is_conditional=True` | **PASS** |
| **SYN-03** | Explicit proposal rejection | Decision extracted as `category=REJECTION` | **PASS** |
| **SYN-04** | Action assigned to previously unseen entity | Correct owner extracted without role dictionary | **PASS** |
| **SYN-05** | Deadline modification in follow-up email | Latest revised deadline supersedes earlier deadline | **PASS** |
| **SYN-06** | Completed action followed by new pending task | Correct separation of `COMPLETED` and `PENDING` | **PASS** |
| **SYN-07** | Conflicting statements in conversation | `is_conflicted=True` flagged | **PASS** |
| **SYN-08** | Explicit closure with zero pending tasks | Marked `none_stated`, `is_resolved=True` | **PASS** |
| **SYN-09** | Discussion without identifiable decision | Zero decisions extracted, no false positives | **PASS** |
| **SYN-10** | Attachment containing sole relevant facts | Extracted from attachment metadata | **PASS** |
| **SYN-11** | Budget planning acceptance | `is_budget_only=True`, zero authorization | **PASS** |
| **SYN-12** | Approval followed by explicit revocation | Later revocation supersedes earlier approval | **PASS** |
| **SYN-13** | Multiple actions assigned to different owners | All distinct tasks and owners extracted | **PASS** |
| **SYN-14** | Reopening previously resolved thread | Reopened thread reverts from `RESOLVED` to `IN_PROGRESS`| **PASS** |
| **SYN-15** | Thread with missing owner and deadline | Handled gracefully without crash or hallucination | **PASS** |
| **SYN-16** | Content-aware evidence quote validation | Fabricated quote strictly rejected | **PASS** |
| **SYN-17** | LLM provider retry & backoff handling | Exponential backoff on transient errors | **PASS** |

**Suite Result:** **34 / 34 passed in 2.75s**.

---

## 3. Metamorphic Invariance Properties (`test_generalized_intelligence.py`)

Metamorphic testing proves that applying label-preserving transformations does not alter extraction logic:

1. **Entity Replacement Invariance:**
   - Swapped "Vendor B" with "ThermoScientific", equipment with "Spectrophotometer", and amount with "INR 12.5 lakh".
   - Verified that `DecisionExtractor` extracted the new entity, amount (`1,250,000.0`), and conditions without benchmark bias.
2. **Crore-Level Amount Scaling Invariance:**
   - Evaluated with an academic complex construction package of "INR 4.5 crore".
   - Verified exact parsing to `45,000,000.0` with conditional status.
3. **Date Shift Invariance:**
   - Shifted deadlines forward into 2027 ("15 March 2027").
   - Verified that action item extraction marked status as `PENDING` and deadline state as `UPCOMING`.
4. **Independent Topic Addition:**
   - Added an unrelated proposal ("robotics workshop") to an existing equipment thread.
   - Verified that the new proposal did not contaminate or mutate earlier decisions.
5. **Polarity Inversion on Negation:**
   - Evaluated "not approved" versus "approved".
   - Verified that negation strictly inverts polarity from `APPROVAL` to `REJECTION`.

**Suite Result:** **5 / 5 passed in 0.01s**.

---

## 4. Deadline Compliance Engine (`test_deadline_compliance.py`)

The deadline engine in `sutra/intelligence/actions.py` was evaluated across 30 automated tests:
- Explicit dates ("by 15 October 2026", "before Friday").
- Relative dates ("within 2 weeks", "in three days").
- Normalization to ISO-8601 strings.
- Deadline modifications and superseding timestamps.
- Status categorization: `UPCOMING`, `MET`, `OVERDUE`, `UNDETERMINED`.

**Suite Result:** **30 / 30 passed in 0.002s**.

---

## 5. Large-Scale Stress Testing: M12 and M13

Executed via `sutra/evaluation/perturbations.py`:

### A. M12: Scale-Up Stress Test (10,052 Messages)
- **Corpus Composition:** 10 baseline threads (52 messages) + 200 synthetic threads (10,000 messages) in linear and branching reply chains.
- **Thread Reconstruction Duration:** **171.02 ms** (PRD Target: $< 5,000\text{ ms}$).
- **Indexing Duration (1,000 message sample):** **22,523.94 ms** (full hierarchical indexing with dense embeddings).
- **Retrieval Latency (p95):** **97.90 ms** for hybrid cross-level retrieval.
- **Threads Recovered:** **210 / 210 threads** without graph fragmentation.
- **Verdict:** **FULL PASS**.

### B. M13: Long-Thread Chains (50 and 200 Messages)
- **50-Message Chain:**
  - 50 messages sequenced in strict chronological order ($t_{i+1} > t_i$).
  - Summary conciseness: **17 words** (PRD Target: $\le 60\text{ words}$).
  - Final status: `RESOLVED`.
- **200-Message Chain:**
  - 200 messages sequenced in strict chronological order.
  - Summary conciseness: **17 words** (PRD Target: $\le 60\text{ words}$).
  - Final status: `RESOLVED`.
- **Verdict:** **FULL PASS**.

---

## 6. Execution Commands

To independently execute all validation, generalization, and stress-test suites:

```powershell
python -m unittest tests/test_generalization.py
python -m unittest tests/test_deadline_compliance.py
python -m unittest tests/test_generalized_intelligence.py
python -c "
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.evaluation.perturbations import PerturbationSuite
p = PerturbationSuite(EmailDatasetLoader('dataset').load_emails())
print('M12 Passed:', p.eval_m12()['passed'])
print('M13 Passed:', p.eval_m13()['passed'])
"
```
