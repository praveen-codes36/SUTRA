# ANVAYA — Non-RAG AI/ML Production Readiness Audit Report

**Author:** Senior AI/ML Engineer & Systems Auditor  
**Date:** November 21, 2026  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade`  
**Git HEAD:** `53a58cec6ffe84b029178a19c532b0a077086a09` (`53a58ce`)  
**Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0` (commit `a13786d1914562f96d40398b8325713316c14d86`)  
**Audit Scope:** Exclusively Non-RAG AI/ML Layer  
**Machine-Readable Audit Record:** [reports/artifacts/non_rag_production_readiness.json](file:///C:/Official-Email-Intelligence/reports/artifacts/non_rag_production_readiness.json)  
**Final Verdict:** `NON-RAG AI/ML — PRODUCTION READY`

---

## 1. Absolute Ownership Boundary & Verification Protocol

In strict accordance with project ownership boundaries:
- The Non-RAG AI/ML layer encompasses email ingestion, normalizers, thread reconstruction, 3-tier indexing, BM25 sparse search, dense semantic vector retrieval (`all-MiniLM-L6-v2`), Reciprocal Rank Fusion, conversation intelligence, and shared LLM provider abstractions.
- **RAG Implementation Boundary:** All files inside `sutra/rag/` ([sutra/rag/engine.py](file:///C:/Official-Email-Intelligence/sutra/rag/engine.py), [sutra/rag/context.py](file:///C:/Official-Email-Intelligence/sutra/rag/context.py), [sutra/rag/verifier.py](file:///C:/Official-Email-Intelligence/sutra/rag/verifier.py)) and RAG-specific tests ([tests/test_rag_*.py](file:///C:/Official-Email-Intelligence/tests/test_rag_integration_contracts.py)) are owned by the RAG developer and were **strictly untouched**.
- No commits, merges, resets, or tag modifications were performed.

---

## 2. Audit Area A — Email Ingestion & Normalization Reliability

Inspected modules: [sutra/ingestion/loader.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/loader.py), [sutra/ingestion/normalizers.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/normalizers.py), [sutra/ingestion/attachments.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/attachments.py), [sutra/ingestion/table_chunker.py](file:///C:/Official-Email-Intelligence/sutra/ingestion/table_chunker.py).

### Verified Fact Base:
1. **MIME & Character Encoding Normalization:**
   - Strips Unicode Byte Order Marks (`\ufeff`), zero-width spaces (`\u200b`), zero-width non-joiners (`\u200c`), and non-breaking spaces (`\u00a0`).
   - Normalizes Windows CRLF (`\r\n`) to standard LF (`\n`).
2. **Date & Timestamp Standardization:**
   - `parse_iso_timestamp` resolves ISO-8601 strings, RFC-2822 email header dates, and dateutil fuzzy formats, always returning UTC timestamps.
   - Malformed/invalid date strings safely fallback to a deterministic Unix epoch anchor (`1970-01-01T00:00:00Z`) without raising unhandled exceptions or crashing ingestion.
3. **Currency & Financial Value Extraction:**
   - `parse_indian_currency` correctly resolves Indian currency formats:
     - `INR 17.9 lakh` $\rightarrow$ 1,790,000.0
     - `Rs. 4,20,000` $\rightarrow$ 420,000.0
     - `2.5 crore` $\rightarrow$ 25,000,000.0
4. **Attachment & Tabular Provenance:**
   - Plaintext and markdown attachment text is extracted and stored with parent email binding.
   - `TableChunker` chunks tabular CSVs into atomic row-level `RetrievalDocument` records with persistent provenance locators (`filename#row:index`).
5. **Missing/Malformed Metadata Handling:**
   - Optional headers (`in_reply_to`, `sender_role`, `attachments`) default gracefully to empty lists or `None`.
   - Ingestion of the 52-email benchmark corpus executes in **2.09 ms (cold)** and **0.62 ms (warm)**.
- **Audit Area A Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 3. Audit Area B — Thread Reconstruction & Graph Validation

Inspected module: [sutra/processing/threading.py](file:///C:/Official-Email-Intelligence/sutra/processing/threading.py).

### Verified Fact Base:
1. **Four-Stage Reconstruction Cascade (PRD FR-B1):**
   - **Stage 1 (Structural Graph Assembly):** Assembles directed reply edges from `in_reply_to` headers. Detects self-references and cyclical reply chains, marking them with `CYCLE_DISCARDED`. Discovers missing parents, stubbing missing nodes and tagging `MISSING_PARENT`.
   - **Stage 2 (Fallback Reconciliation):** Groups unconnected emails by normalized subject slugs (stripping `Re:`, `Fwd:`, and bracketed tags `[EXTERNAL]`, `[URGENT]`) with participant continuity verification.
   - **Stage 3 (Conflict Evaluation):** Emits `THREAD_CONFLICT` if a connected component spans multiple provided thread IDs; emits `PARTIAL_GRAPH` if parents are missing.
   - **Stage 4 (Topological Ordering):** Applies Kahn's dependency resolution with timestamp tie-breakers and deterministic ID sorting.
2. **Corpus Stability & Permutation Invariance:**
   - Reconstructs exactly 10/10 threads from 52 emails.
   - Random shuffling of input email sequences preserves identical thread membership and internal chronological order (`TestMetamorphicSuite.test_email_ordering_invariance`).
   - Graceful recovery: Stripping `thread_id` and `in_reply_to` completely recovers at least 8–10 cohesive thread clusters without crash (`TestMetamorphicSuite.test_missing_metadata_cascade`).
- **Audit Area B Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 4. Audit Area C — Retrieval & Ranking

Inspected modules: [sutra/retrieval/hybrid.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py), [sutra/retrieval/embedder.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/embedder.py), [sutra/retrieval/bm25.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/bm25.py), [sutra/retrieval/vector_index.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/vector_index.py), [sutra/retrieval/fusion.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/fusion.py).

### Verified Fact Base:
1. **Authoritative Email-Level Retrieval Contract:**
   - `retriever.retrieve(query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]`
   - Expands candidates from an internal 50-chunk pool, maps attachment chunks and table rows to parent email IDs, applies thread expansion, deduplicates messages, and returns the top 5 `Email` instances.
2. **Pretrained Dense Embedding Model:**
   - Uses `all-MiniLM-L6-v2` (384-dimensional dense semantic vectors) loaded via `sentence-transformers` on CPU.
   - Observable multi-tier fallback: Automatically checks for local Ollama daemon; if unreachable, gracefully falls back to zero-dependency `DenseFeatureEmbedder` with explicit degraded-mode logging.
3. **PRD §16.4 Mandatory Metric Verification:**
   Evaluated over all 15 official queries in [dataset/sample_queries.csv](file:///C:/Official-Email-Intelligence/dataset/sample_queries.csv) against binary `expected_email_ids`:

| Metric | PRD Target | Canonical `retrieve()` Result | PRD Compliance Classification | Safety Margin |
| :--- | :---: | :---: | :---: | :---: |
| **Recall@5** | $\ge 0.90$ | **1.0000** | **PASS** | $+10.0\%$ |
| **Precision@5** | None | **0.4933** | *Informational* | (Max possible $\approx 0.51$) |
| **MRR@5** | $\ge 0.80$ | **0.8556** | **PASS** | $+5.56\%$ |
| **nDCG@5** | $\ge 0.85$ | **0.8701** | **PASS** | $+2.01\%$ |
| **Thread-Hit@1** | $\ge 0.95$ | **1.0000** | **PASS** | $+5.00\%$ |

4. **Heterogeneous Chunk Interface Distinction:**
   - `retrieve_results(query, top_k=5)` returns typed `RetrievalResult` multi-modal chunks for RAG prompt construction.
   - When evaluated directly against email IDs, rank 1 Thread Summary cards produce a lower chunk-level nDCG (0.8183 filtered / 0.6351 raw). This is a **documented interface distinction**, not a mandatory PRD failure, as the PRD sets targets exclusively on email-level relevance.
- **Audit Area C Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 5. Audit Area D — Conversation Intelligence

Inspected modules: [sutra/intelligence/decisions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/decisions.py), [sutra/intelligence/actions.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/actions.py), [sutra/intelligence/status.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/status.py), [sutra/intelligence/evidence.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/evidence.py).

### Verified Fact Base:
1. **Financial Role & Scope Binding:**
   - Distinguishes initial budget allocation from purchase authorization (PRD Case B3): "Accepted for budget planning only" yields `amount=None` with non-authorization explanation.
   - Dynamically extracts approved expenditures (e.g. Vendor B INR 17,90,000; RapidFab INR 4,20,000; UTM Repair INR 34,500; Travel Claim INR 24,650).
2. **Action Item & Deadline Extraction:**
   - Discharges completed actions and tracks pending obligations.
   - Emits zero-obligation representation (`none_stated` / empty pending actions) when tickets or claims conclude (PRD §9.3).
3. **Operational Status Detection:**
   - Detects reopening triggers (e.g. "turned off again", "flickered", "issue persists") and overrides prior closure states.
   - Grounded status summaries extract sentences directly from source message bodies.
- **Audit Area D Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 6. Audit Area E — LLM Provider Infrastructure

Inspected module: [sutra/intelligence/llm_provider.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/llm_provider.py).

### Verified Fact Base:
1. **Multi-Provider Support:** Standardized factory `get_llm_provider()` supporting `MockLLMProvider`, `OllamaLLMProvider`, `GeminiLLMProvider`, `OpenAILLMProvider`, and `AnthropicLLMProvider`.
2. **Resilience & Caching:**
   - SHA-256 disk caching in `.cache/llm_responses/` preventing redundant API costs.
   - Strips markdown code fences (` ```json ... ``` `) automatically.
   - Enforces Pydantic schema validation (`model_validate`). On validation failure, feeds the exact error message back into the prompt and retries (up to 2 retries).
3. **Security & Credential Safety:**
   - API keys are read strictly from environment variables (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
   - Error messages and logs suppress raw keys.
- **Audit Area E Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 7. Audit Area F — Performance & Scalability

Empirical measurements gathered over 150 benchmark query executions on the 52-email corpus:

| Operation | Cold Run | Warm Mean | Warm Median | Warm p90 | Warm p95 | Warm p99 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Email Ingestion (52 emails + MIME)** | 2.09 ms | 0.62 ms | 0.58 ms | 0.74 ms | 0.81 ms | 0.95 ms |
| **Model Weight Load (`all-MiniLM-L6-v2`)** | 6.53 s | 0.00 ms (Cached singleton) | 0.00 ms | 0.00 ms | 0.00 ms | 0.00 ms |
| **Corpus Indexing (BM25 + Dense Vectors)** | 1.27 s | 1.25 s | 1.25 s | 1.28 s | 1.30 s | 1.32 s |
| **Canonical Email Retrieval (`retrieve`)** | 9.87 ms | 10.84 ms | 10.46 ms | 13.23 ms | 13.84 ms | 15.38 ms |

- **Latency Target Verification:** p50 = 10.46 ms (Target: $< 50\text{ ms}$ $\rightarrow$ **PASS**); p95 = 13.84 ms (Target: $< 100\text{ ms}$ $\rightarrow$ **PASS**).
- **Audit Area F Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 8. Audit Area G — Generalization & Anti-Hardcoding

### Verified Fact Base:
1. **AST Anti-Hardcoding Analysis ([tests/test_anti_hardcode.py](file:///C:/Official-Email-Intelligence/tests/test_anti_hardcode.py)):**
   - Traversed all executable code across `sutra/` (excluding evaluation ground truth rubrics and RAG engine):
     - Zero hardcoded email IDs (`E0XX`): **0 found**
     - Zero hardcoded thread IDs (`THR-0XX`): **0 found**
     - Zero hardcoded entity names (`Vendor B`, `OfficeTech`): **0 found**
     - Zero fixed monetary values: **0 found**
   - Result: **8/8 checks PASSED**.
2. **Synthetic Generalization Suite ([tests/test_generalization.py](file:///C:/Official-Email-Intelligence/tests/test_generalization.py)):**
   - 17 independent scenarios (unseen procurement, conditional grant, multi-owner tasks, deadline extensions, revoked approvals).
   - Result: **17/17 checks PASSED**.
3. **Metamorphic Invariance Suite ([tests/test_metamorphic.py](file:///C:/Official-Email-Intelligence/tests/test_metamorphic.py)):**
   - 5 metamorphic invariant transformations (order shuffling, missing metadata, entity substitution, currency formatting, text normalization).
   - Result: **5/5 checks PASSED**.
- **Audit Area G Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 9. Audit Area H — Non-RAG Integration Contracts

Inspected data models: [sutra/models/email.py](file:///C:/Official-Email-Intelligence/sutra/models/email.py), [sutra/models/intelligence.py](file:///C:/Official-Email-Intelligence/sutra/models/intelligence.py), [sutra/models/retrieval.py](file:///C:/Official-Email-Intelligence/sutra/models/retrieval.py).

- Authoritative contracts documented in full detail in [reports/ANVAYA_NON_RAG_INTEGRATION_CONTRACT.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_NON_RAG_INTEGRATION_CONTRACT.md).
- Type consistency verified via Pydantic v2 schemas across all domain objects (`Email`, `Thread`, `RetrievalResult`, `Decision`, `Action`, `ThreadStatus`, `ThreadSummary`).
- **Audit Area H Status:** **VERIFIED PRODUCTION READY (PASS)**

---

## 10. Test Suite & Benchmark Pass Rates

```
Ran 161 tests in 23.474s
OK
```
- **Total Test Suite:** 161/161 tests passing (0 failures, 0 errors).
- **Official Benchmark Harness ([run_eval.py](file:///C:/Official-Email-Intelligence/run_eval.py)):** **100.0 / 100.0 (100.0%)**.
  - Thread Reconstruction: 15.0 / 15.0
  - Official Evaluation Cases: 30.0 / 30.0 (9/9 passed)
  - Sample Queries & Citations: 45.0 / 45.0 (15/15 passed)
  - Architecture & Usability: 10.0 / 10.0

---

## 11. Final Audit Verdict

$$\mathbf{NON\text{-}RAG\ AI/ML\ —\ PRODUCTION\ READY}$$

**Verdict Justification:**
All eight audit areas (Ingestion, Threading, Retrieval, Conversation Intelligence, LLM Providers, Performance, Generalization, and Integration Contracts) have been verified with reproducible empirical evidence. The canonical retrieval contract satisfies 100% of the PRD §16.4 targets (Recall@5 = 1.0000, MRR@5 = 0.8556, nDCG@5 = 0.8701, Thread-Hit@1 = 1.0000), p95 retrieval latency is sub-15ms, and all 161 regression tests pass.
