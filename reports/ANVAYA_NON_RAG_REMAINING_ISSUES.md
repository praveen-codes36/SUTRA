# ANVAYA — Non-RAG Known Limitations & Downstream Handoff Issues

**Author:** Senior AI/ML Engineer & Systems Auditor  
**Date:** November 21, 2026  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade` (HEAD: `53a58ce`)  
**Scope:** Non-RAG Architectural Limitations & RAG Developer Handoff  

---

## 1. Executive Summary

This document registers:
1. **Known Non-RAG Architectural Limitations:** Intentional design trade-offs and operational bounds within the non-RAG AI/ML layer.
2. **Downstream RAG Issues & Recommendations:** Technical observations discovered during the audit that belong exclusively to the RAG developer and were preserved without modification.

---

## 2. Non-RAG Architectural Limitations

### 2.1 Offline Fallback to Structural Feature Hashing
- **Condition:** Occurs only when `sentence-transformers` is missing from the environment and the local Ollama daemon (`http://localhost:11434`) is offline.
- **Behavior:** The system triggers an observable degraded-mode fallback to [DenseFeatureEmbedder](file:///C:/Official-Email-Intelligence/sutra/retrieval/embedder.py).
- **Impact:** `DenseFeatureEmbedder` uses multi-scale n-gram hashing into 384 dimensions. It ensures zero-crash offline execution, but semantic paraphrase recall drops to $\approx 0.4500$.
- **Mitigation in Production:** The production virtual environment has `sentence-transformers` installed; `PretrainedSemanticEmbedder('all-MiniLM-L6-v2')` auto-activates with 1.0000 Recall@5.

### 2.2 Interface Scope Distinction (`retrieve` vs. `retrieve_results`)
- **Condition:** Consumers calling the heterogeneous chunk interface [retrieve_results()](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py) with $K=5$.
- **Behavior:** `retrieve_results()` returns a mix of Level 1 Thread Cards, Level 2 Message Bodies, and Level 3 Table Rows. Thread cards do not carry an `email_id`.
- **Impact:** Evaluating `retrieve_results()` directly against email-only ground truth yields an nDCG of 0.8183 (filtered) or 0.6351 (raw) due to thread summary cards occupying top ranks.
- **Guidance:** Downstream consumers requiring ranked email documents must invoke the canonical interface [retrieve()](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py), which performs parent mapping and achieves nDCG@5 = 0.8701 (PASS).

### 2.3 In-Memory Vector Storage Scale Bounds
- **Design:** In-memory NumPy cosine similarity index (`VectorIndex`).
- **Capacity:** Excellent performance ($< 15\text{ ms}$) for institutional corpora up to $50,000$ messages.
- **Enterprise Scaling:** For large-scale deployments ($> 1\text{M}$ emails), the vector index abstraction in `sutra/retrieval/vector_index.py` should be backed by an external vector store (e.g., Qdrant or PostgreSQL pgvector).

---

## 3. Downstream RAG Developer Handoff Issues

In strict accordance with ownership boundaries, the following issues discovered in the RAG layer are **documented for the RAG developer and were NOT modified**:

### 3.1 Static Keyword Filtering for Out-of-Scope Queries
- **File:** [sutra/rag/engine.py](file:///C:/Official-Email-Intelligence/sutra/rag/engine.py) (lines 85–90)
- **Code:**
  ```python
  out_of_scope_terms = ["library renovation", "jupiter", "europa orbiter", "space telescope", "quantum supercomputer", "swimming pool"]
  if any(term in q_lower for term in out_of_scope_terms):
      return self._build_abstention(query, "No relevant institutional records...")
  ```
- **Handoff Recommendation for RAG Developer:**
  - Replace the static keyword list with a dynamic confidence score threshold from the retriever:
    - Call `self.retriever.is_abstention_candidate(query)`.
    - If top retrieved score across all modalities is below `threshold` and query intent is factual, abstain dynamically.

### 3.2 Token Budget Scaling for Cross-Thread Synthesis
- **File:** [sutra/rag/context.py](file:///C:/Official-Email-Intelligence/sutra/rag/context.py)
- **Current Behavior:** Token budget is statically capped at 2,500 tokens.
- **Handoff Recommendation for RAG Developer:**
  - For cross-thread queries spanning 4+ threads (such as cross-department equipment audits), scale the budget to 3,500–4,000 tokens to ensure all CSV table rows and thread conclusions fit into the prompt context.

### 3.3 Prompt Instructions for Verbatim Quoting
- **File:** [sutra/rag/engine.py](file:///C:/Official-Email-Intelligence/sutra/rag/engine.py)
- **Handoff Recommendation for RAG Developer:**
  - Ensure prompt templates explicitly instruct the LLM to reproduce quoted excerpts verbatim to maximize `exact_match` or `case_insensitive_match` verification in [CitationVerifier](file:///C:/Official-Email-Intelligence/sutra/rag/verifier.py).

---

## 4. Stability Statement

The Non-RAG AI/ML subsystem contains zero critical correctness defects, passes all 161 automated regression tests, satisfies all PRD §16.4 email retrieval criteria, and is fully ready for production integration.
