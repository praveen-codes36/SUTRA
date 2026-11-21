# ANVAYA — Final Retrieval Contract & PRD Compliance Verification Report

**Author:** Senior AI/ML Engineer & Systems Auditor  
**Date:** November 21, 2026  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade` (HEAD: `53a58ce`)  
**Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0` (commit `a13786d1914562f96d40398b8325713316c14d86`)  
**Scope:** Read-Only Non-RAG Retrieval Contract Audit  
**Authoritative Artifact:** [reports/artifacts/final_retrieval_metrics.json](file:///C:/Official-Email-Intelligence/reports/artifacts/final_retrieval_metrics.json)  
**Final Verdict:** `NON-RAG RETRIEVAL — PRD COMPLIANT`

---

## 1. Executive Summary

This audit performs a definitive, read-only verification of the ANVAYA / SUTRA non-RAG retrieval contracts against the authoritative Product Requirements Document (`ANVAYA_PRD_v1.0.pdf`) and the codebase implementation.

The investigation addresses the interface distinction between:
1. `retriever.retrieve(query, top_k=5)` — Canonical email-level retrieval contract.
2. `retriever.retrieve_results(query, top_k=5)` — Granular multi-modal chunk retrieval contract.

**Key Determination:**
The PRD §16.4 information retrieval targets (Recall@5 $\ge 0.90$, MRR@5 $\ge 0.80$, nDCG@5 $\ge 0.85$, Thread-Hit@1 $\ge 0.95$) are established over [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv), where ground truth relevance is defined strictly on **`expected_email_ids`**. 

The authoritative interface designed to return email-level candidates against email ground truth is **`retriever.retrieve()`**. This interface satisfies **100% of the PRD targets** (Recall@5 = 1.0000, MRR@5 = 0.8556, nDCG@5 = 0.8701, Thread-Hit@1 = 1.0000).

The lower score observed when evaluating `retrieve_results()` directly against email IDs is a **documented interface distinction** (multi-level chunks vs. document-level entities), not a mandatory PRD target failure.

---

## 2. PRD Retrieval Requirements & Specifications

### 2.1 Authoritative PRD Sections
- **PRD §7.7 (Module G: Advanced Retrieval):** Mandates hybrid search combining BM25 keyword matching and dense semantic embeddings with Reciprocal Rank Fusion ($k=60$), multi-tiered document representation, and parent-thread context expansion.
- **PRD §8.3 (Hierarchical Indexing Architecture):** Specifies 3-tier indexing: Level 1 (Thread Cards), Level 2 (Message Bodies), and Level 3 (Attachments & Table Rows). Mandates that queries must be able to return whole emails with attachment context.
- **PRD §16.4 (IR Evaluation Metrics & Thresholds):** Defines the mandatory acceptance criteria on official benchmark queries:
  - $\text{Recall@5} \ge 0.90$ (Pass threshold)
  - $\text{MRR@5} \ge 0.80$ (Pass threshold)
  - $\text{nDCG@5} \ge 0.85$ (Pass threshold)
  - $\text{Thread-Hit@1} \ge 0.95$ (Pass threshold)
- **PRD Appendix A (Benchmark Query Dataset):** Ground truth in `sample_queries.csv` provides columns:
  - `query_id`
  - `query`
  - `expected_thread_id`
  - `expected_email_ids` (Semicolon-delimited list of relevant email IDs, e.g. `E005;E007`)
  - `reference_answer`

Crucially, **no chunk-level ground truth (`expected_chunk_ids`) exists in the PRD**. The PRD's evaluation definition is inherently an email-level relevance evaluation.

---

## 3. Downstream Consumers & Interface Map

An audit of all callers across the repository reveals distinct roles for the two retrieval interfaces:

| Consumer Component | File Path | Method Invoked | Target Unit | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Canonical Evaluation Artifact Generator** | [scripts/generate_evaluation_artifacts.py](file:///C:/Official-Email-Intelligence/scripts/generate_evaluation_artifacts.py) | `retriever.retrieve(query, top_k=5)` | `List[Email]` | Benchmarks email retrieval against `expected_email_ids` |
| **Official Hackathon Benchmark Harness** | [sutra/evaluation/harness.py](file:///C:/Official-Email-Intelligence/sutra/evaluation/harness.py) | `engine.answer_query(q_text)` (consumes citations) | `List[str]` (`cited_email_ids`) | Evaluates end-to-end grounding and citation recall/precision |
| **RAG Answer Generation Engine** | [sutra/rag/engine.py](file:///C:/Official-Email-Intelligence/sutra/rag/engine.py) | `retriever.retrieve_results(query, top_k=candidate_k)` | `List[RetrievalResult]` | Gathers multi-modal chunks (tables, attachments, bodies) for prompt packing |
| **Retrieval Ablation Script** | [sutra/retrieval/ablation.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/ablation.py) | `retriever.retrieve_results(q_text, top_k=5, mode=mode)` | `List[RetrievalResult]` | Compares BM25 vs. Dense vs. Hybrid candidate scores |
| **Domain-Level API Wrapper** | [sutra/retrieval/hybrid.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py) | `retrieve()` wraps `retrieve_results(top_k=50)` | `Tuple[List[Email], List[ThreadSummary]]` | Resolves chunk-to-parent mappings and thread expansion |

### Summary of Consumer Roles:
1. **`retrieve(query, top_k=5)`:** The authoritative public method for applications and evaluations requiring **email-level domain objects and citation lists**. It performs candidate expansion, maps attachment excerpts and CSV table rows to their parent emails, deduplicates by message, and returns the top 5 `Email` instances.
2. **`retrieve_results(query, top_k=5)`:** The specialized internal pipeline method for **RAG context builders** requiring fine-grained chunks (`DocumentType.TABLE_ROW`, `DocumentType.ATTACHMENT`, `DocumentType.THREAD_SUMMARY`) with token budgets and locators.

---

## 4. Evaluation Harness Verification

[sutra/evaluation/harness.py](file:///C:/Official-Email-Intelligence/sutra/evaluation/harness.py) was verified to confirm that metrics are computed cleanly without mixing chunk-level and email-level judgments:

1. **Strict Type Isolation:**
   - In `evaluate_sample_queries()` (lines 172–196), the harness queries `ans = self.engine.answer_query(q_text)`.
   - The evaluated candidate list is `retrieved_eids = ans.cited_email_ids`, which contains strictly validated email IDs.
   - IR metrics (`recall_at_k`, `precision_at_k`, `mrr_at_k`, `ndcg_at_k`, `thread_hit_at_1`) compare `retrieved_eids` directly against `gold_eids` (`expected_email_ids`).
2. **Zero Fabricated Citations:**
   - The harness checks `fabs = [eid for eid in retrieved_eids if eid not in self.engine.emails_by_id]`.
   - Result: `total_fabricated_citations = 0`.
3. **No Metric Mixing:**
   - The harness does not treat chunk locators as missing emails. It evaluates citations against the authoritative email ground truth, yielding:
     - Mean Recall@5: **1.0000**
     - Mean MRR@5: **1.0000**
     - Mean nDCG@5: **1.0000**
     - Mean Thread-Hit@1: **1.0000**
     - Official Benchmark Score: **100.0 / 100.0**

---

## 5. Independent Metric Verification

All three evaluation methods were independently re-executed on the 15 benchmark queries using `all-MiniLM-L6-v2` dense embeddings, BM25 Okapi, and RRF ($k=60$):

| Evaluation Mode | Evaluation Method | Evaluated Unit | Recall@5 | Precision@5 | MRR@5 | nDCG@5 | Thread-Hit@1 |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Canonical Email Retrieval** | `retriever.retrieve(query, top_k=5)` | Top 5 distinct emails mapped from all corpus levels | **1.0000** | **0.4933** | **0.8556** | **0.8701** | **1.0000** |
| **Filtered Chunk Retrieval** | `retrieve_results(top_k=5)` with `None` stripped | Top 4 emails (Thread Summary card stripped from top-5) | **0.9000** | **0.4400** | **0.8556** | **0.8183** | **1.0000** |
| **Raw Chunk Retrieval** | `retrieve_results(top_k=5)` raw | 5 chunks with Thread Summary at rank 1 scored $rel=0$ | **0.9000** | **0.4400** | **0.5278** | **0.6351** | **1.0000** |

### Per-Query Breakdown (Canonical `retrieve()`):
- **Q001:** Gold `['E005', 'E007']` $\rightarrow$ Retrieved `['E004', 'E005', 'E001', 'E006', 'E007']` (Rec: 1.0, MRR: 0.5000, nDCG: 0.6241)
- **Q002:** Gold `['E005', 'E006', 'E007']` $\rightarrow$ Retrieved `['E007', 'E006', 'E005', 'E001', 'E004']` (Rec: 1.0, MRR: 1.0000, nDCG: 1.0000)
- **Q003:** Gold `['E009', 'E010']` $\rightarrow$ Retrieved `['E008', 'E012', 'E010', 'E011', 'E009']` (Rec: 1.0, MRR: 0.3333, nDCG: 0.5438)
- **Q004:** Gold `['E011', 'E012']` $\rightarrow$ Retrieved `['E012', 'E011', 'E009', 'E008', 'E010']` (Rec: 1.0, MRR: 1.0000, nDCG: 1.0000)
- **Q005:** Gold `['E014', 'E016']` $\rightarrow$ Retrieved `['E013', 'E016', 'E015', 'E014', 'E017']` (Rec: 1.0, MRR: 0.5000, nDCG: 0.6509)
- **Q006:** Gold `['E017', 'E018']` $\rightarrow$ Retrieved `['E018', 'E017', 'E013', 'E016', 'E015']` (Rec: 1.0, MRR: 1.0000, nDCG: 1.0000)
- **Q007:** Gold `['E021', 'E022', 'E023', 'E024']` $\rightarrow$ Retrieved `['E023', 'E024', 'E021', 'E020', 'E022']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9829)
- **Q008:** Gold `['E025', 'E028']` $\rightarrow$ Retrieved `['E025', 'E027', 'E028', 'E026', 'E042']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9197)
- **Q009:** Gold `['E032', 'E033', 'E034']` $\rightarrow$ Retrieved `['E033', 'E031', 'E034', 'E032', 'E029']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9060)
- **Q010:** Gold `['E037', 'E038', 'E039', 'E040']` $\rightarrow$ Retrieved `['E038', 'E035', 'E039', 'E040', 'E037']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9047)
- **Q011:** Gold `['E042', 'E043', 'E044']` $\rightarrow$ Retrieved `['E042', 'E041', 'E044', 'E043', 'E025']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9060)
- **Q012:** Gold `['E047', 'E048']` $\rightarrow$ Retrieved `['E045', 'E048', 'E047', 'E046', 'E007']` (Rec: 1.0, MRR: 0.5000, nDCG: 0.6934)
- **Q013:** Gold `['E049', 'E050', 'E052']` $\rightarrow$ Retrieved `['E049', 'E052', 'E050', 'E051', 'E035']` (Rec: 1.0, MRR: 1.0000, nDCG: 1.0000)
- **Q014:** Gold `['E002', 'E003']` $\rightarrow$ Retrieved `['E002', 'E004', 'E003', 'E005', 'E007']` (Rec: 1.0, MRR: 1.0000, nDCG: 0.9197)
- **Q015:** Gold `['E024']` $\rightarrow$ Retrieved `['E024', 'E020', 'E019', 'E023', 'E021']` (Rec: 1.0, MRR: 1.0000, nDCG: 1.0000)

**Summary for Canonical Email Retrieval:**
- **Recall@5:** 1.0000 (15/15 queries have 100% gold recall)
- **MRR@5:** 0.8556 (10 queries rank gold at #1, 4 at #2, 1 at #3)
- **nDCG@5:** 0.8701
- **Thread-Hit@1:** 1.0000 (15/15 top hits match expected thread)

---

## 6. PRD Compliance & Target Assessment

Applying the strict PRD thresholds:
- **Recall@5 Target ($\ge 0.90$):** Canonical result is **1.0000** $\rightarrow$ **PASS** (+10.0% margin).
- **MRR@5 Target ($\ge 0.80$):** Canonical result is **0.8556** $\rightarrow$ **PASS** (+5.56% margin).
- **nDCG@5 Target ($\ge 0.85$):** Canonical result is **0.8701** $\rightarrow$ **PASS** (+2.01% margin).
- **Thread-Hit@1 Target ($\ge 0.95$):** Canonical result is **1.0000** $\rightarrow$ **PASS** (+5.00% margin).

### Is Chunk Retrieval a Mandatory PRD Gap?
**No.** 
1. The PRD §16.4 targets are defined on `sample_queries.csv`, where relevance is defined exclusively on email IDs.
2. `retrieve_results()` was designed as an internal ingestion interface for the RAG Context Builder to consume multi-level evidence chunks (Level 1 Thread Cards, Level 2 Message Bodies, Level 3 Table Rows and Attachments).
3. The PRD does not establish separate nDCG targets for heterogeneous chunk retrieval against email ground truth.
4. Calling `retrieve_results(top_k=5)` against email ground truth introduces a structural unit mismatch because Level 1 Thread Summary cards occupy rank 1.
5. In accordance with Task 7 guidelines (*"Do not classify an alternative interface as a mandatory PRD failure unless the PRD or an official downstream contract requires that interface to meet the same metric"*), the lower score on `retrieve_results` is properly classified as a **documented interface limitation**, while the system's official email retrieval contract is **fully PRD compliant**.

---

## 7. Unresolved Ambiguities

No architectural or mathematical ambiguities remain:
1. **Contract Clarity:** Downstream components needing ranked email documents must call `retrieve()`. Downstream components needing chunk-level prompt context must call `retrieve_results()`.
2. **Reproducibility:** All metrics are 100% reproducible via [scripts/generate_evaluation_artifacts.py](file:///C:/Official-Email-Intelligence/scripts/generate_evaluation_artifacts.py) and committed to [reports/artifacts/final_retrieval_metrics.json](file:///C:/Official-Email-Intelligence/reports/artifacts/final_retrieval_metrics.json).
3. **Test Stability:** All 161 automated regression and unit tests pass cleanly.

---

## 8. Final Verdict

$$\mathbf{NON\text{-}RAG\ RETRIEVAL\ —\ PRD\ COMPLIANT}$$

The non-RAG retrieval engine strictly satisfies all PRD §16.4 requirements when measured through its authoritative email-level interface `retriever.retrieve(query, top_k=5)`:
- Recall@5 = **1.0000** ($\ge 0.90$) — **PASS**
- MRR@5 = **0.8556** ($\ge 0.80$) — **PASS**
- nDCG@5 = **0.8701** ($\ge 0.85$) — **PASS**
- Thread-Hit@1 = **1.0000** ($\ge 0.95$) — **PASS**
