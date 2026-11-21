# ANVAYA — Non-RAG AI/ML Final Audit & Architecture Verification

**Role:** Senior AI/ML Engineer & Independent Code Auditor  
**Date:** November 21, 2026  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade`  
**Git HEAD:** `53a58ce`  
**Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0` (commit `a13786d1914562f96d40398b8325713316c14d86`)  
**Audit Target:** Non-RAG AI/ML Layer Exclusively  
**Final Audit Verdict:** `NON-RAG AI/ML COMPLETE — DOCUMENTED PRD GAP`

---

## 1. Audit Scope & Strict Ownership Boundaries

This independent audit rigorously evaluates the non-RAG AI/ML subsystem of the ANVAYA institutional communication intelligence platform.

### Scope Boundaries
- **IN SCOPE:**
  - Email Ingestion & Parsing: [sutra/ingestion/loader.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/loader.py), [sutra/ingestion/normalizers.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/normalizers.py), [sutra/ingestion/attachments.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/attachments.py), [sutra/ingestion/table_chunker.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/table_chunker.py).
  - Thread Reconstruction & Topological Validation: [sutra/processing/threading.py](file:///C:/Official-Email-Intelligence/sutra/processing/threading.py), [sutra/processing/roles.py](file:///C:/Official-Email-Intelligence/sutra/processing/roles.py).
  - Hierarchical Hybrid Retrieval & Vector Indexing: [sutra/retrieval/hybrid.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py), [sutra/retrieval/hierarchical.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/hierarchical.py), [sutra/retrieval/bm25.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/bm25.py), [sutra/retrieval/vector_index.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/vector_index.py), [sutra/retrieval/embedder.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/embedder.py), [sutra/retrieval/fusion.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/fusion.py).
  - Conversation Intelligence & Operational Semantics: [sutra/intelligence/decisions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/decisions.py), [sutra/intelligence/actions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/actions.py), [sutra/intelligence/status.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/status.py), [sutra/intelligence/evidence.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/evidence.py), [sutra/intelligence/state_machine.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/state_machine.py), [sutra/intelligence/summarizer.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/summarizer.py).
  - Pluggable LLM Provider Infrastructure: [sutra/intelligence/llm_provider.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/llm_provider.py).
  - Evaluation Harness & Statistical Metrics: [sutra/evaluation/metrics.py](file:///C:/Official-Email-Intelligence/sutra/evaluation/metrics.py), [sutra/evaluation/harness.py](file:///C:/Official-Email-Intelligence/sutra/evaluation/harness.py).
  - Domain Data Models: [sutra/models/email.py](file:///C:/Official-Email-Intelligence/sutra/models/email.py), [sutra/models/intelligence.py](file:///C:/Official-Email-Intelligence/sutra/models/intelligence.py), [sutra/models/retrieval.py](file:///C:/Official-Email-Intelligence/sutra/models/retrieval.py).
- **STRICTLY OUT OF SCOPE:**
  - RAG answer generation, context packing, prompts, generative citations, and answer-level abstention (`sutra/rag/engine.py`, `sutra/rag/context.py`, `sutra/rag/verifier.py`).
  - Frontend UI, backend web APIs, authentication, database storage, Docker/deployment.
  - *All RAG-layer observations have been documented separately in [reports/ANVAYA_RAG_HANDOFF_ISSUES.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_RAG_HANDOFF_ISSUES.md) without modifying RAG code.*

---

## 2. Git & Repository Integrity Verification

1. **Working Branch:** `anvaya-reliability-upgrade` confirmed at commit `53a58ce`.
2. **Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0` points securely to `a13786d1914562f96d40398b8325713316c14d86`. It remains untouched.
3. **Working Tree Safety:** Uncommitted working tree files relating to RAG development were preserved in place without resetting or discarding changes.

---

## 3. nDCG@5 Discrepancy Investigation

### 3.1 Overview of the Issue
In prior reporting cycles, two divergent nDCG@5 values were published for the hybrid retrieval engine running `all-MiniLM-L6-v2`:
- **Earlier Reported Value:** `0.8701` (with Recall@5 = 1.0000, MRR@5 = 0.8556, Thread-Hit@1 = 1.0000)
- **Latest Reported Value:** `0.8183` (with Recall@5 = 0.9000, MRR@5 = 0.8556, Thread-Hit@1 = 1.0000)

Crucially, in the latest audit report, `0.8183` was compared against the PRD target of $\ge 0.85$ and misclassified as `HIGH` rather than `FAIL`. This audit investigation re-evaluated both implementations from scratch to establish the mathematical and engineering cause.

### 3.2 Independently Reproduced Values
Through side-by-side execution on the identical corpus (52 emails, 10 threads) and evaluation query set ([dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv)), three distinct evaluation pathways were uncovered:

| Evaluation Pathway | Evaluation Method Called | Evaluated Candidate List | Recall@5 | MRR@5 | nDCG@5 | Thread-Hit@1 | nDCG Target ($\ge 0.85$) Status |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Method A (Canonical Email Retrieval)** | `retriever.retrieve(query, top_k=5)` | 5 distinct emails mapped across message bodies, attachments, and tables | **1.0000** | **0.8556** | **0.8701** | **1.0000** | **PASS** |
| **Method C (Filtered Heterogeneous Chunks)** | `retrieve_results(query, top_k=5)` with `None` stripped | 4 distinct emails (Level 1 Thread Summary stripped out of top-5 chunks) | **0.9000** | **0.8556** | **0.8183** | **1.0000** | **FAIL** |
| **Method B (Raw Heterogeneous Chunks)** | `retrieve_results(query, top_k=5)` raw | 5 chunks where Level 1 Thread Summary at rank 1 is scored $rel=0$ | **0.9000** | **0.5278** | **0.6351** | **1.0000** | **FAIL** |

### 3.3 Exact Root Cause Analysis
1. **Contract Mismatch between Ground Truth and Retrieved Units:**
   - The benchmark ground truth in [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv) defines relevance strictly in terms of **`expected_email_ids`** (e.g. `E005;E007`).
   - In **Method A** ([scripts/generate_evaluation_artifacts.py](file:///C:/Official-Email-Intelligence/scripts/generate_evaluation_artifacts.py)), the evaluation invoked `retriever.retrieve(query, top_k=5)`. This method expands candidates from an internal pool of 50 chunks, maps attachments and table rows back to their parent email IDs, and returns exactly the **top 5 distinct `Email` domain objects**. Consequently, all 5 evaluated positions are valid email IDs. Every gold email is found within the top 5 (Recall = 1.0000), producing **nDCG@5 = 0.8701** and **MRR@5 = 0.8556**.
   - In **Method C** (the one-off evaluation script executed in turn 10), the script invoked `retriever.retrieve_results(query, top_k=5, mode="hybrid", dedup_by_source=True)`. This method returns raw multi-level chunks (`THREAD_SUMMARY`, `EMAIL`, `ATTACHMENT`, `TABLE_ROW`).
   - For 11 of the 15 queries (Q001, Q002, Q004, Q006, Q007, Q008, Q009, Q010, Q011, Q012, Q015), rank 1 was a Level 1 `THREAD_SUMMARY` (`summary:THR-XXX`).
   - Because a thread summary represents the whole thread and has no single `email_id`, its mapped ID was `None`.
   - The script then executed `filtered = [e for e in ret_eids if e]`.
   - Stripping `None` collapsed the 5-item list into an **evaluated list of only 4 items**.
   - For queries with multiple gold emails (e.g. Q001 gold `['E005', 'E007']`), the 5th email (`E007`, positioned at chunk rank 6) was cut off because the evaluation list was prematurely truncated at length 4.
   - For Q001, Q003, Q007, and Q010, Recall dropped from 1.0 to 0.5–0.75, driving overall Macro Recall down from 1.0000 to 0.9000, and Macro nDCG down from 0.8701 to **0.8183**.
   - MRR remained identical at 0.8556 because removing `None` at rank 1 shifted the first relevant email from rank 2 to rank 1, exactly preserving reciprocal ranks.
2. **Audit Classification Defect:**
   - The previous audit report noted `0.8183` as a major improvement over the `DenseFeatureEmbedder` baseline (`0.4921`) and labeled it `HIGH`.
   - Under strict PRD compliance rules, any score below the mandatory target ($\ge 0.85$) must be classified as **`FAIL`**. Labeling 0.8183 as `HIGH` was a severe audit defect that obscured the target miss.

### 3.4 Correct Final Metric Values and Classification
- Under the **Canonical Email Retrieval Contract** (`retriever.retrieve(query, top_k=5)`), which matches the ground truth unit of [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv):
  - **nDCG@5:** **0.8701** $\rightarrow$ **PRD Target Met: PASS**
- Under the **Raw Multi-Modal Chunk Contract** (`retriever.retrieve_results(query, top_k=5)`):
  - **nDCG@5:** **0.8183** (filtered, $K=4$) / **0.6351** (raw, $K=5$) $\rightarrow$ **PRD Target Not Met: FAIL**

---

## 4. Comprehensive Retrieval Metrics Table & Compliance

Below is the verified compliance matrix evaluated on the official 15 queries in [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv):

| Metric | Mathematical Formula | Relevance Ground Truth | Canonical Result (`retrieve`) | Canonical PRD Classification | Chunk-Level Result (`retrieve_results`) | Chunk-Level PRD Classification | PRD Target |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Recall@5** | $\frac{\|\text{Relevant} \cap \text{Retrieved@5}\|}{\|\text{Relevant}\|}$ | Binary `expected_email_ids` | **1.0000** | **PASS** | **0.9000** | **PASS** | $\ge 0.90$ |
| **Precision@5** | $\frac{\|\text{Relevant} \cap \text{Retrieved@5}\|}{5}$ | Binary `expected_email_ids` | **0.4933** | *No Threshold* | **0.4400** | *No Threshold* | N/A (Max $\approx 0.51$) |
| **MRR@5** | $\frac{1}{\text{rank of 1st relevant item}}$ | Binary `expected_email_ids` | **0.8556** | **PASS** | **0.5278** (raw) / **0.8556** (filtered) | **FAIL** (raw) / **PASS** (filtered) | $\ge 0.80$ |
| **nDCG@5** | $\frac{\text{DCG@5}}{\text{IDCG@5}}$ | Binary `expected_email_ids` | **0.8701** | **PASS** | **0.6351** (raw) / **0.8183** (filtered) | **FAIL** | $\ge 0.85$ |
| **Thread-Hit@1** | $\mathbb{I}(\text{Top Thread} == \text{Expected})$ | `expected_thread_id` | **1.0000** | **PASS** | **1.0000** | **PASS** | $\ge 0.95$ |

---

## 5. Subsystem Component Verification

### 5.1 Email Ingestion & Preprocessing
- [sutra/ingestion/normalizers.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/normalizers.py): Strips zero-width non-breaking spaces (`\ufeff`), zero-width spaces (`\u200b`), and soft hyphens. Converts dates to ISO-8601 UTC. Correctly normalizes Indian currency notations (lakhs, crores, commas).
- [sutra/ingestion/table_chunker.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/table_chunker.py): Preserves tabular schema with locator metadata (`vendor_comparison.csv#row:4`).

### 5.2 Thread Reconstruction Cascade
- [sutra/processing/threading.py](file:///C:/Official-Email-Intelligence/sutra/processing/threading.py): Implements 4-stage cascade with cycle detection (`CYCLE_DISCARDED`) and topological Kahn's sort.
- Reconstructs 10/10 threads deterministically with 52/52 emails mapped. Permutation invariance verified.

### 5.3 Conversation Intelligence
- [sutra/intelligence/decisions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/decisions.py): Distinguishes initial budget planning from formal purchase authorization (Case B3).
- [sutra/intelligence/actions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/actions.py): Emits `none_stated` when conversations conclude without obligations (PRD §9.3).
- [sutra/intelligence/status.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/status.py): Recognizes persistent issues / reopening triggers and grounds status explanations directly in source sentences.

### 5.4 LLM Provider Infrastructure
- [sutra/intelligence/llm_provider.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/llm_provider.py): Factory supporting `Mock`, `Ollama`, `Gemini`, `OpenAI`, and `Anthropic` with disk-caching, exponential backoff, and Pydantic validation.

---

## 6. Regression Testing & Benchmark Integrity

### 6.1 Test Suite Results
```
Ran 161 tests in 23.474s
OK
```
- Unit & Ingestion Tests: 101/101 PASSED
- Synthetic Generalization Tests: 17/17 PASSED
- Metamorphic Invariance Tests: 5/5 PASSED
- Anti-Hardcoding AST Analysis: 8/8 PASSED (0 hardcoded IDs or entities in executable logic)
- Deadline Compliance Tests: 30/30 PASSED

### 6.2 Official Hackathon Benchmark ([run_eval.py](file:///C:/Official-Email-Intelligence/run_eval.py))
- **Overall Benchmark Score: 100.0 / 100.0 (100.0%)**
  - Thread Reconstruction: 15.0 / 15.0
  - Official Evaluation Cases: 30.0 / 30.0 (9/9 passed)
  - Sample Queries & Citations: 45.0 / 45.0 (15/15 passed)
  - Architecture & Usability: 10.0 / 10.0

---

## 7. Performance & Latency Benchmarks

| Metric | Target | Measured Result | Margin |
| :--- | :---: | :---: | :---: |
| **Ingestion Time (52 emails)** | $< 1.0\text{ s}$ | **$0.010\text{ s}$** | $100\times$ faster |
| **Corpus Indexing (Pretrained Dense + BM25)** | $< 5.0\text{ s}$ | **$1.305\text{ s}$** | $3.8\times$ faster |
| **Retrieval Latency (p50)** | $< 50\text{ ms}$ | **$5.26\text{ ms}$** | $9.5\times$ faster |
| **Retrieval Latency (p95)** | $< 100\text{ ms}$ | **$7.53\text{ ms}$** | $13.3\times$ faster |

---

## 8. Final Verdict & Architectural Guidance

In accordance with strict audit rules:
- **Canonical Email Retrieval:** When consumers retrieve email candidates via `retriever.retrieve(query, top_k=5)` (the contract directly aligned with email ground truth), the system achieves Recall@5 = 1.0000, MRR@5 = 0.8556, nDCG@5 = 0.8701, and Thread-Hit@1 = 1.0000, fully satisfying all PRD criteria.
- **Heterogeneous Chunk Retrieval:** When consumers retrieve raw multi-modal chunks via `retriever.retrieve_results(query, top_k=5)` without mapping thread summaries back to constituent messages, nDCG@5 drops to 0.8183 (filtered) or 0.6351 (raw), failing the PRD threshold of $\ge 0.85$.

$$\mathbf{FINAL\ VERDICT:\ NON\text{-}RAG\ AI/ML\ COMPLETE\ —\ DOCUMENTED\ PRD\ GAP}$$

The gap is fully documented: consumers requiring high nDCG against email-level ground truth must consume the canonical `retrieve()` interface or configure chunk-level pooling to avoid truncating candidate lists with thread summary cards. All non-RAG components are stable, reproducible, and ready for RAG handoff.
