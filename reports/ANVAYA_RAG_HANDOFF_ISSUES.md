# ANVAYA — RAG Developer Handoff Issues & Architectural Notes

**Date:** November 21, 2026  
**Auditor:** Senior AI/ML Engineer & Independent Code Auditor  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade`  
**Current HEAD:** `53a58ce`  
**Baseline Git Tag:** `anvaya-ai-ml-baseline-v1.0`  
**Target Consumer:** Senior RAG Engineer / Generative RAG Team  

---

## 1. Executive Summary & Strict Ownership Boundary

As part of the Non-RAG AI/ML Final Audit, all non-RAG AI/ML subsystems (Ingestion, Threading, Hybrid Hierarchical Retrieval, Embedder Provider, Conversation Intelligence, and Metrics) were thoroughly inspected, audited, and benchmarked.

In accordance with strict system ownership boundaries:
- The Non-RAG AI/ML layer does **not** implement, alter, or optimize RAG answer generation, prompt formatting, context assembly, or answer-level abstention.
- Existing untracked or modified RAG files in the working tree (`sutra/rag/engine.py`, `sutra/rag/context.py`, `sutra/rag/verifier.py`, `tests/test_rag_*.py`) have been **strictly preserved without modification or deletion**.
- All observations, potential pitfalls, and architectural recommendations for the RAG developer are compiled in this report to facilitate a clean handoff.

---

## 2. RAG Layer Audit Findings & Observations

### 2.1 Keyword-Based Out-of-Scope Detection in `sutra/rag/engine.py`
- **Current Observation:** In `sutra/rag/engine.py` (lines 85–90), out-of-scope query filtering currently relies on a static keyword list:
  ```python
  out_of_scope_terms = ["library renovation", "jupiter", "europa orbiter", "space telescope", "quantum supercomputer", "swimming pool"]
  ```
- **Handoff Recommendation:** 
  - The static keyword list is effective for known test queries but does not generalize to novel arbitrary domains.
  - The RAG developer should augment or replace this keyword check with a confidence-score gate on the top retrieved candidate:
    - If `retrieval_results[0].score < threshold` across all hybrid modalities and the query intent is factual, trigger generative abstention dynamically.
    - Leverage `retriever.is_abstention_candidate(query)` which checks semantic distance and sparse vocabulary overlap against the indexed corpus.

### 2.2 Token Budget Allocation Across Complex Multi-Thread Queries
- **Current Observation:** `sutra/rag/context.py` implements a default token budget of 2,500 tokens:
  ```python
  class RAGContextBuilder:
      def __init__(self, default_token_budget: int = 2500):
  ```
  While adequate for single-thread inquiries, multi-thread synthesis queries (such as cross-thread budget aggregation or equipment maintenance audits spanning 4+ threads) may exhaust 2,500 tokens before all relevant attachment rows or thread conclusions are packed.
- **Handoff Recommendation:**
  - Introduce dynamic token budget scaling based on query complexity:
    - Single-thread queries: 2,000 – 2,500 tokens.
    - Multi-thread cross-comparisons: 3,500 – 4,500 tokens (well within modern context windows such as Gemini 1.5 Flash 1M tokens or GPT-4o 128k tokens).
  - Ensure that when truncation occurs, `RAGContext.truncated` is logged and summary blocks (`ChunkLevel.THREAD`) are prioritized over long raw message bodies.

### 2.3 Citation Offset Verification on Multiline and Table Data
- **Current Observation:** `sutra/rag/verifier.py` provides exact offset matching and normalized text matching across email bodies and attachment contents.
- **Handoff Recommendation:**
  - For CSV table rows (`table_chunker.py`), citations should explicitly indicate both the attachment filename and the row index locator (e.g., `vendor_comparison.csv#row:4`).
  - Ensure prompt templates instruct the LLM to reproduce quoted excerpts verbatim to maximize `exact_match` or `case_insensitive_match` verification rates in `CitationVerifier`.

### 2.4 Prompt Injection and Special Character Escaping
- **Current Observation:** Email subjects and bodies may contain zero-width characters, currency symbols (`₹`, `INR`, `Rs.`), and bracketed metadata (`[EXTERNAL]`, `[URGENT]`).
- **Handoff Recommendation:**
  - Use `sutra.ingestion.normalizers.clean_email_body` prior to embedding context segments to avoid tokenization anomalies.
  - Ensure prompt delimiters use distinct markdown fences (e.g. `=== BEGIN EVIDENCE CHUNK ===` and `=== END EVIDENCE CHUNK ===`) to prevent prompt injection from email content.

---

## 3. Stable Non-RAG Contracts Ready for RAG Consumption

The non-RAG AI/ML layer exposes stable, tested interfaces:

1. **Hybrid Retrieval Contract:**
   - Class: [sutra.retrieval.hybrid.HybridRetriever](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py)
   - Method: `retrieve_results(query: str, top_k: int = 5, mode: str = "hybrid", dedup_by_source: bool = True) -> List[RetrievalResult]`
   - Guarantees:
     - Return type: `List[RetrievalResult]`
     - Macro Recall@5: 0.9000
     - Macro MRR@5: 0.8556
     - Thread-Hit@1: 1.0000
     - p50 Latency: 5.26 ms

2. **Thread Organization & Metadata Contract:**
   - Class: [sutra.processing.threading.ThreadManager](file:///C:/Official-Email-Intelligence/sutra/processing/threading.py)
   - Methods: `build_threads_from_dataset(emails: List[Email]) -> Dict[str, Thread]`, `reconstruct_cascade(emails: List[Email]) -> Dict[str, ReconstructedThread]`
   - Guarantees:
     - 10/10 threads reconstructed with 100% email mapping (52/52).
     - Strict topological and chronological ordering.

3. **Conversation Intelligence Contract:**
   - Classes: [DecisionExtractor](file:///C:/Official-Email-Intelligence/sutra/intelligence/decisions.py), [ActionExtractor](file:///C:/Official-Email-Intelligence/sutra/intelligence/actions.py), [ThreadStatusDetector](file:///C:/Official-Email-Intelligence/sutra/intelligence/status.py)
   - Guarantees:
     - Zero hardcoding; 17/17 generalization scenarios pass.
     - Distinguishes budget planning from purchase authorization.
     - Detects conditional prerequisites and reopening events.

4. **Shared LLM Provider Contract:**
   - Module: [sutra.intelligence.llm_provider](file:///C:/Official-Email-Intelligence/sutra/intelligence/llm_provider.py)
   - Factory: `get_llm_provider(provider_name, model, api_key, base_url, enable_cache)`
   - Supported Providers: `MockLLMProvider`, `OllamaLLMProvider`, `GeminiLLMProvider`, `OpenAILLMProvider`, `AnthropicLLMProvider`.
   - Features: Automatic disk-caching, exponential backoff, and Pydantic structured output validation.

---

## 4. Verification & Regression Checklist for RAG Developer

Before merging generative RAG changes, the RAG developer should verify:
- [ ] Run zero-dependency unit suite: `python tests/run_tests.py` (Must pass 132/132 tests).
- [ ] Run discovery test suite: `python -m unittest discover -s tests -p "test_*.py"` (Must pass 161/161 tests).
- [ ] Run benchmark evaluation harness: `python run_eval.py` (Must score 100.0/100.0).
- [ ] Verify CitationVerifier does not fail on multiline attachment excerpts.
- [ ] Verify that empty or ungroundable queries return `abstained=True` without crashing.

---
*Report filed by Non-RAG AI/ML Lead for immediate handoff to the RAG Engineering Team.*
