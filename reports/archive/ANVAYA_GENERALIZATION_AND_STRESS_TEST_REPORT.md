# ANVAYA — Generalization, Adversarial and Stress-Testing Report

**Author:** Senior AI/ML Engineer & Systems Auditor  
**Date:** 2026-11-21  
**Project:** ANVAYA (Institutional Email Intelligence Platform)  
**Execution Environment:** Python 3.12.15 Virtual Environment (`.venv`)  
**Status:** **PASSED ALL GENERALIZATION, METAMORPHIC & SCALE BENCHMARKS**

---

## 1. Executive Summary

This report evaluates ANVAYA's Non-RAG AI/ML layer against requirements for generalization beyond the synthetic benchmark dataset. It details the dataset splits, adversarial robustness suites, metamorphic invariance properties, and large-scale stress testing (PRD M12 and M13).

### Key Test Results
- **Generalization Suite (`tests/test_generalization.py`):** **34/34 passed** (17 completely unseen institutional scenarios).
- **Deadline Intelligence Suite (`tests/test_deadline_compliance.py`):** **30/30 passed** (strict date parsing, shifts, overdue/upcoming tracking).
- **Metamorphic Invariance Suite (`tests/test_generalized_intelligence.py`):** **5/5 passed** (permutation, entity swap, amount scaling, date shifting).
- **Scale Stress Test M12:** **10,052 messages across 210 threads** reconstructed in **171.02 ms**; sub-100ms retrieval latency.
- **Long-Chain Stress Test M13:** 50-message and 200-message linear chains reconstructed with concise summaries ($\le 17$ words) and 100% resolution status accuracy.

---

## 2. Dataset Separation & Data Leakage Prevention

To ensure evaluation validity and prevent data leakage:

### A. Dataset Splits Architecture

| Dataset Partition | Threads / Emails | Purpose | Leakage Controls |
| :--- | :--- | :--- | :--- |
| **Development Set** | 7 threads (36 emails) | Algorithm development & tuning (THR-001 to THR-007) | None |
| **Validation Set** | 3 threads (16 emails) | Hyperparameter validation (THR-008 to THR-010) | Completely isolated queries |
| **Synthetic Generalization Set** | 17 threads (38 emails) | Zero-shot generalization (`test_generalization.py`) | 100% disjoint entities, vendors, dates, and amounts |
| **Scale Corpus (M12)** | 210 threads (10,052 emails) | Ingestion throughput & latency stress testing | Synthetic administrative groups |
| **Long Chains (M13)** | 2 threads (250 emails) | Linear chronological retention (50 & 200 steps) | Zero overlap with official threads |

### B. Leakage & Overfitting Safeguards
- **Zero Query Matching in Code:** No query strings from `sample_queries.csv` appear in `sutra/` production files.
- **Dynamic Entity Extraction:** Vendor selection, financial amounts, and approval roles are extracted dynamically from text regexes rather than hardcoded string lookup tables.
- **Permutation Resistance:** Reconstruction order invariance is tested by shuffling message arrivals.

---

## 3. Adversarial & Metamorphic Test Suites

### A. Metamorphic Invariance (`tests/test_generalized_intelligence.py`)

1. **Entity Replacement Invariance:**
   - Swapped "Vendor B" with "ThermoScientific", equipment with "Spectrophotometer", and amount with "INR 12.5 lakh".
   - Verified that `DecisionExtractor` and `extract_approvals` extracted the new entity, amount (1,250,000.0), and conditions without benchmark bias.
2. **Crore-Level Amount Scaling Invariance:**
   - Evaluated with an academic complex construction proposal of "INR 4.5 crore".
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

---

## 4. Large-Scale Stress Testing: M12 and M13

The stress tests specified in PRD §16.4 and §16.5 were executed via `sutra/evaluation/perturbations.py`:

### M12: Scale-Up Stress Test (10,052 Messages)

- **Total Corpus Size:** 10,052 messages (10 baseline threads + 200 synthetic threads of 50 messages each).
- **Reconstruction Duration:** **171.02 ms** (PRD Target: $< 5,000\text{ ms}$ — **PASSED** by a factor of 29x).
- **Indexing Duration (1,000 message sample):** **22,523.94 ms** (hierarchical chunking + embedding).
- **Retrieval Latency (p95):** **97.90 ms** for hybrid cross-level retrieval.
- **Threads Recovered:** **210 / 210 threads** without data loss or graph fragmentation.
- **Result:** **FULL PASS**.

### M13: Long-Thread Chains (50 and 200 Messages)

- **Chain 1 (50 Messages):**
  - Linear order verified: 50 / 50 messages strictly sequenced chronologically.
  - Summary conciseness: 17 words (PRD Target: $\le 60\text{ words}$).
  - Final lifecycle status: `RESOLVED` (correctly captured final milestone closure).
- **Chain 2 (200 Messages):**
  - Linear order verified: 200 / 200 messages strictly sequenced chronologically.
  - Summary conciseness: 17 words (PRD Target: $\le 60\text{ words}$).
  - Final lifecycle status: `RESOLVED`.
- **Result:** **FULL PASS**.

---

## 5. Execution & Verification Commands

All generalization and stress test suites can be executed with:

```powershell
.venv\Scripts\python.exe -m unittest tests/test_generalization.py
.venv\Scripts\python.exe -m unittest tests/test_deadline_compliance.py
.venv\Scripts\python.exe -m unittest tests/test_generalized_intelligence.py
.venv\Scripts\python.exe -c "
from sutra.ingestion.loader import EmailDatasetLoader
from sutra.evaluation.perturbations import PerturbationSuite
p = PerturbationSuite(EmailDatasetLoader('dataset').load_emails())
print('M12:', p.eval_m12()['passed'])
print('M13:', p.eval_m13()['passed'])
"
```
