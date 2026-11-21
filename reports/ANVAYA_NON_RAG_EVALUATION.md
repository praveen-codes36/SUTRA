# ANVAYA — Non-RAG AI/ML Comprehensive Evaluation Report

**Date:** November 21, 2026  
**Auditor / Lead:** Senior AI/ML Engineer & Evaluation Specialist  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade`  
**Git HEAD:** `53a58ce`  
**Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0`  
**Authoritative Artifacts:**  
- [reports/artifacts/final_retrieval_metrics.json](file:///C:/Official-Email-Intelligence/reports/artifacts/final_retrieval_metrics.json) (Canonical Evaluation Artifact)  
- [reports/artifacts/non_rag_final_results.json](file:///C:/Official-Email-Intelligence/reports/artifacts/non_rag_final_results.json) (Multi-Modal & Chunk Profiling Artifact)  

---

## 1. Executive Summary

This report delivers the authoritative, reproducible evaluation of ANVAYA's non-RAG AI/ML layer. It resolves the recent discrepancy between reported nDCG@5 values (`0.8701` vs. `0.8183`), rectifies previous classification mislabelings, and documents the exact performance characteristics across canonical email retrieval and heterogeneous chunk retrieval modes.

---

## 2. nDCG@5 Discrepancy Investigation

### 2.1 The Discrepancy Context
In previous reports, two different nDCG@5 metrics were published:
- **Earlier Reported Value:** `0.8701`
- **Latest Reported Value:** `0.8183`
In the previous audit turn, `0.8183` was compared against the PRD target of $\ge 0.85$ and mislabeled as `HIGH`. This was an audit classification error; under strict PRD evaluation criteria, `0.8183 < 0.85` is a **FAIL**.

### 2.2 Independent Reproduction & Technical Root Cause
Both results were independently reproduced under identical environment conditions using `all-MiniLM-L6-v2` dense embeddings, BM25 Okapi, and Reciprocal Rank Fusion ($k=60$):

1. **Method A: Canonical Email Retrieval ([scripts/generate_evaluation_artifacts.py](file:///C:/Official-Email-Intelligence/scripts/generate_evaluation_artifacts.py)):**
   - Calls `retriever.retrieve(query, top_k=5)`.
   - Fetches an expanded candidate pool (top 50 chunks), maps all attachments and CSV table rows back to their parent email IDs, and returns exactly the **top 5 unique `Email` objects**.
   - Because the ground truth in [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv) consists of `expected_email_ids` (e.g. `E005;E007`), all 5 evaluated items are valid email IDs.
   - **Result:**
     - **Recall@5:** 1.0000 ($\ge 0.90 \rightarrow$ **PASS**)
     - **MRR@5:** 0.8556 ($\ge 0.80 \rightarrow$ **PASS**)
     - **nDCG@5:** **0.8701** ($\ge 0.85 \rightarrow$ **PASS**)
     - **Thread-Hit@1:** 1.0000 ($\ge 0.95 \rightarrow$ **PASS**)

2. **Method C: Filtered Heterogeneous Chunks Retrieval:**
   - Calls `retriever.retrieve_results(query, top_k=5, mode="hybrid", dedup_by_source=True)`.
   - Returns raw multi-level chunks (`THREAD_SUMMARY`, `EMAIL`, `ATTACHMENT`, `TABLE_ROW`).
   - For all 15 queries, a Level 1 `THREAD_SUMMARY` (`summary:THR-XXX`) was retrieved in the top 5 (at rank 1 for 11 queries, and ranks 2–4 for the remaining 4).
   - Because a thread summary represents the whole thread, its mapped `email_id` was `None`.
   - The script then executed `[e for e in ret_eids if e]`, which stripped out the `None`.
   - This truncated the evaluated candidate list from length 5 to **length 4**.
   - As a result, the 5th email candidate was truncated for Q001, Q003, Q007, and Q010:
     - Q001: Gold `['E005', 'E007']`. Only `E005` retrieved in top 4; `E007` cut off $\rightarrow$ Recall = 0.5000, nDCG = 0.3869.
     - Q003: Gold `['E009', 'E010']`. Only `E010` retrieved in top 4; `E009` cut off $\rightarrow$ Recall = 0.5000, nDCG = 0.3066.
     - Q007: Gold `['E021', 'E022', 'E023', 'E024']`. 3 of 4 retrieved $\rightarrow$ Recall = 0.7500, nDCG = 0.8319.
     - Q010: Gold `['E037', 'E038', 'E039', 'E040']`. 3 of 4 retrieved $\rightarrow$ Recall = 0.7500, nDCG = 0.7537.
   - **Result:**
     - **Recall@5:** 0.9000 ($\ge 0.90 \rightarrow$ **PASS**)
     - **MRR@5:** 0.8556 ($\ge 0.80 \rightarrow$ **PASS**)
     - **nDCG@5:** **0.8183** ($\ge 0.85 \rightarrow$ **FAIL**)
     - **Thread-Hit@1:** 1.0000 ($\ge 0.95 \rightarrow$ **PASS**)

3. **Method B: Raw Heterogeneous Chunks Retrieval (No Filtering):**
   - If the Level 1 `THREAD_SUMMARY` at rank 1 is evaluated directly against `expected_email_ids`, it receives relevance $0.0$ at rank 1.
   - **Result:**
     - **Recall@5:** 0.9000 ($\ge 0.90 \rightarrow$ **PASS**)
     - **MRR@5:** 0.5278 ($\ge 0.80 \rightarrow$ **FAIL**)
     - **nDCG@5:** 0.6351 ($\ge 0.85 \rightarrow$ **FAIL**)
     - **Thread-Hit@1:** 1.0000 ($\ge 0.95 \rightarrow$ **PASS**)

### 2.3 Per-Query Comparison: Method A vs. Method C

| Query ID | Expected Gold Email IDs | Method A Retrieved Top-5 | Method A nDCG@5 | Method C Retrieved (Length 4) | Method C nDCG@5 | Cause of Divergence |
| :--- | :--- | :--- | :---: | :--- | :---: | :--- |
| **Q001** | `['E005', 'E007']` | `E004, E005, E001, E006, E007` | **0.6241** | `E004, E005, E001, E006` | **0.3869** | `E007` truncated by missing 5th slot |
| **Q002** | `['E005', 'E006', 'E007']` | `E007, E006, E005, E001, E004` | **1.0000** | `E007, E006, E005, E001` | **1.0000** | All 3 gold items in top 3 |
| **Q003** | `['E009', 'E010']` | `E008, E012, E010, E011, E009` | **0.5438** | `E008, E012, E010, E011` | **0.3066** | `E009` truncated by missing 5th slot |
| **Q004** | `['E011', 'E012']` | `E012, E011, E009, E008, E010` | **1.0000** | `E012, E011, E009, E008` | **1.0000** | Both gold items in top 2 |
| **Q005** | `['E014', 'E016']` | `E013, E016, E015, E014, E017` | **0.6509** | `E013, E016, E015, E014` | **0.6509** | Gold items at ranks 2 and 4 |
| **Q006** | `['E017', 'E018']` | `E018, E017, E013, E016, E015` | **1.0000** | `E018, E017, E013, E016` | **1.0000** | Both gold items in top 2 |
| **Q007** | `['E021', 'E022', 'E023', 'E024']` | `E023, E024, E021, E020, E022` | **0.9829** | `E023, E024, E021, E020` | **0.8319** | `E022` truncated by missing 5th slot |
| **Q008** | `['E025', 'E028']` | `E025, E027, E028, E026, E042` | **0.9197** | `E025, E027, E028, E026` | **0.9197** | Gold items at ranks 1 and 3 |
| **Q009** | `['E032', 'E033', 'E034']` | `E033, E031, E034, E032, E029` | **0.9060** | `E033, E031, E034, E032` | **0.9060** | Gold items at ranks 1, 3, 4 |
| **Q010** | `['E037', 'E038', 'E039', 'E040']` | `E038, E035, E039, E040, E037` | **0.9047** | `E038, E035, E039, E040` | **0.7537** | `E037` truncated by missing 5th slot |
| **Q011** | `['E042', 'E043', 'E044']` | `E042, E041, E044, E043, E025` | **0.9060** | `E042, E041, E044, E043` | **0.9060** | Gold items at ranks 1, 3, 4 |
| **Q012** | `['E047', 'E048']` | `E045, E048, E047, E046, E007` | **0.6934** | `E045, E048, E047, E046` | **0.6934** | Gold items at ranks 2 and 3 |
| **Q013** | `['E049', 'E050', 'E052']` | `E049, E052, E050, E051, E035` | **1.0000** | `E049, E052, E050, E051` | **1.0000** | Gold items at ranks 1, 2, 3 |
| **Q014** | `['E002', 'E003']` | `E002, E004, E003, E005, E007` | **0.9197** | `E002, E004, E003, E005` | **0.9197** | Gold items at ranks 1 and 3 |
| **Q015** | `['E024']` | `E024, E020, E019, E023, E021` | **1.0000** | `E024, E020, E019, E023` | **1.0000** | Gold item at rank 1 |
| **Macro Average** | — | — | **0.8701 (PASS)** | — | **0.8183 (FAIL)** | **Delta: -0.0518** |

---

## 3. Authoritative Metric Summary & PRD Compliance

| Metric | PRD Target | Canonical Method A (`retrieve`) | Method A Classification | Method C (`retrieve_results` filtered) | Method C Classification |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Recall@5** | $\ge 0.90$ | **1.0000** | **PASS** | **0.9000** | **PASS** |
| **Precision@5** | None | **0.4933** | *Informational* | **0.4400** | *Informational* |
| **MRR@5** | $\ge 0.80$ | **0.8556** | **PASS** | **0.8556** | **PASS** |
| **nDCG@5** | $\ge 0.85$ | **0.8701** | **PASS** | **0.8183** | **FAIL** |
| **Thread-Hit@1** | $\ge 0.95$ | **1.0000** | **PASS** | **1.0000** | **PASS** |

---

## 4. Benchmark Harness Results ([run_eval.py](file:///C:/Official-Email-Intelligence/run_eval.py))

```
======================================================================
 SUTRA — Institutional Email Intelligence Platform
 Official Hackathon Benchmark Evaluation Suite
======================================================================

[1] Thread Reconstruction & Organization (Weight: 15%):
    - Threads identified: 10 / 10 | Score: 15.0 / 15.0

[2] Official Evaluation Cases (Weight: 30%):
    - Cases passed: 9 / 9 (100.0%) | Score: 30.0 / 30.0

[3] Sample Queries & Source Grounding (Weight: 45%):
    - Accurate Citations: 15 / 15 (100.0%) | Score: 45.0 / 45.0

[4] Architecture, Reliability & Usability (Weight: 10%):
    - Score: 10.0 / 10.0

======================================================================
 OVERALL BENCHMARK SCORE: 100.0 / 100.0 (100.0%)
======================================================================
```

---

## 5. Latency and Scalability Profile

- **Corpus Ingestion Time (52 emails):** $0.010\text{ s}$
- **Full Corpus Indexing (Pretrained Dense + BM25):** $1.305\text{ s}$ (Target: $< 5.0\text{ s}$)
- **Mean Retrieval Latency:** $5.63\text{ ms}$
- **p50 Retrieval Latency:** $5.26\text{ ms}$ (Target: $< 50\text{ ms}$)
- **p95 Retrieval Latency:** $7.53\text{ ms}$ (Target: $< 100\text{ ms}$)
- **p99 Retrieval Latency:** $8.12\text{ ms}$

---

## 6. Generalization and Metamorphic Verification

- **Anti-Hardcoding AST Analysis:** 8/8 checks passed. Zero hardcoded email IDs (`E0XX`), thread IDs (`THR-0XX`), or entity names in executable code.
- **Synthetic Generalization Suite:** 17/17 institutional scenarios passed (including conditional approvals, budget-only scopes, and multi-owner assignments).
- **Metamorphic Invariance Suite:** 5/5 invariant tests passed (order shuffling, header stripping, entity substitution).

---

## 7. Final Classification and Verdict

Under the canonical email retrieval contract (`retriever.retrieve`), the system achieves **100% PRD compliance** across all four mandatory retrieval metrics (Recall@5 = 1.0000, MRR@5 = 0.8556, nDCG@5 = 0.8701, Thread-Hit@1 = 1.0000).

Under the multi-modal chunk retrieval contract (`retriever.retrieve_results`), if raw chunks are evaluated directly against email IDs without mapping thread summaries back to constituent messages, nDCG@5 is 0.8183 (filtered) or 0.6351 (raw), which is a **documented target miss**.

$$\mathbf{VERDICT:\ NON\text{-}RAG\ AI/ML\ COMPLETE\ —\ DOCUMENTED\ PRD\ GAP}$$

The gap is documented and fully explained. Downstream consumers requiring email-level document ranking must consume the canonical `retrieve()` interface.
