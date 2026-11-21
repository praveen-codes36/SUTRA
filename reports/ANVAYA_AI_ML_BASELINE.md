# ANVAYA — AI/ML Canonical Baseline Specification (v1.0)

**Baseline Version:** `1.0.0-frozen`  
**Git Tag:** `anvaya-ai-ml-baseline-v1.0`  
**Git Commit Hash:** `a13786d1914562f96d40398b8325713316c14d86`  
**Git Branch:** `person-2-conversation-intelligence`  
**Author:** Senior AI/ML Engineer & Systems Quality Auditor  
**Date of Baseline Freeze:** 2026-11-21  
**Status:** **FROZEN & VERIFIED**

---

## 1. Baseline Overview & Scope

This document establishes the frozen, production-ready baseline for the **Non-RAG AI/ML Engineering Layer** of project **ANVAYA** (Institutional Email Intelligence Platform), developed in compliance with `ANVAYA_PRD_v1.0.pdf`.

The baseline encompasses:
1. **Foundation & Preprocessing:** MIME body normalization, Indian currency parsing, attachment extraction (PDF, DOCX, TXT, CSV), and tabular row chunking.
2. **Email Thread Reconstruction:** Chronological message graph reconstruction with parent cascade resolution.
3. **Hierarchical 3-Tier Indexing:** Level 1 Thread-Card index, Level 2 Message-Level index, and Level 3 Attachment-Chunk index.
4. **Dense Semantic Retrieval:** In-process neural embeddings via `sentence-transformers/all-MiniLM-L6-v2` (384 dimensions).
5. **Adaptive Hybrid Retrieval:** Reciprocal Rank Fusion ($k=60$) combining BM25Okapi ($w_{\text{bm25}}=0.8$) and Dense Cosine Similarity ($w_{\text{dense}}=1.2$) with semantic thread coherence ($tb=0.008$) and parent-source deduplication.
6. **Conversation Intelligence:** Thread summarization, chronological lifecycle status detection, dynamic decision extraction, and action item deadline compliance tracking.
7. **Evaluation & Verification Suite:** Centralized, mathematically audited IR metrics module (`sutra.evaluation.metrics`) and 101 automated test cases.

---

## 2. Environment & Dependency Specifications

- **Virtual Environment Path:** `C:\Official-Email-Intelligence\.venv`
- **Python Executable:** `C:\Official-Email-Intelligence\.venv\Scripts\python.exe`
- **Python Version:** CPython 3.12.15 (Windows x86_64)
- **Dependency Provisioning Engine:** `uv` 0.13.1

### Core Package Manifest

| Package Name | Exact Version | Functional Role |
| :--- | :--- | :--- |
| `torch` | `2.15.0` | Tensor backend for neural embedding inference |
| `sentence-transformers` | `6.3.0` | Dense embedding pipeline and model loading |
| `transformers` | `5.23.0` | Transformer backbones and tokenizers |
| `pydantic` | `2.14.4` | Data model contract enforcement and serialization |
| `numpy` | `2.5.5` | Dense vector linear algebra and cosine similarity |
| `scipy` | `1.18.1` | Scientific compute and distance metrics |
| `python-dateutil` | `4.0.0` | ISO-8601 timestamp parsing and date arithmetic |
| `requests` | `2.34.2` | Hugging Face hub integration and HTTP requests |
| `pypdf` | `7.1.1` | PRD reference parsing and documentation verification |

---

## 3. Embedding Subsystem Specification

- **Model Identifier:** `sentence-transformers/all-MiniLM-L6-v2`
- **Vector Dimension:** 384 dimensions
- **Vector Space:** L2 Unit-Normalized ($\|v\|_2 = 1.000000 \pm 10^{-6}$)
- **Inference Hardware:** Multi-threaded CPU (`device="cpu"`)
- **Query Latency:** ~12 ms per query on CPU
- **Memory Footprint:** ~80 MB RAM in-process; zero external daemon required
- **Degraded Mode / Fallback:** `fallback_triggered=False` (genuine pretrained transformer active)

### Verified Semantic Quality Check
- $\text{sim}(\text{CNC procurement}, \text{industrial machinery}) = \mathbf{0.5607}$
- $\text{sim}(\text{CNC procurement}, \text{bonafide certificate}) = \mathbf{0.2190}$
- Separation margin: $\mathbf{+0.3417}$

---

## 4. Verified Acceptance Metrics vs PRD §16.4 Targets

Evaluated across all 15 official benchmark queries (`dataset/sample_queries.csv`):

| Evaluation Metric | PRD §16.4 Target | Frozen Baseline Result | Margin / Status |
| :--- | :--- | :--- | :--- |
| **Recall@5** | $\ge 0.90$ | **1.0000 (100.0%)** | **+10.0% (PASS)** |
| **MRR@5** | $\ge 0.80$ | **0.8556** | **+5.56% (PASS)** |
| **nDCG@5** | $\ge 0.85$ | **0.8701** | **+2.01% (PASS)** |
| **Thread-Hit@1** | $\ge 0.95$ | **1.0000 (100.0%)** | **+5.00% (PASS)** |
| **Benchmark Cases** | 9 / 9 passed | **9 / 9 passed (100.0%)** | **PASS** |
| **Accurate Citations**| 15 / 15 passed | **15 / 15 passed (100.0%)** | **PASS** |
| **Overall Benchmark Score** | $\ge 95.0$ | **100.0 / 100.0** | **PASS** |

---

## 5. Automated Test Suite Summary

Total Automated Tests: **101 tests** (0 failures, 0 errors, ran in 13.79s):

| Test Module | Test Count | Scope / Verified Capabilities |
| :--- | :--- | :--- |
| `tests/test_generalization.py` | 34 | 17 unseen synthetic institutional scenarios |
| `tests/test_deadline_compliance.py`| 30 | Relative/explicit date shifts, overdue/upcoming tracking |
| `tests/test_retrieval.py` | 10 | Pretrained embeddings, diagnostics, deduplication, VectorIndex |
| `tests/test_evaluation_metrics.py` | 9 | Audited IR metrics mathematical correctness & edge cases |
| `tests/test_intelligence.py` | 6 | Decision, action, summary, status contract validation |
| `tests/test_generalized_intelligence.py`| 5 | Metamorphic invariance (permutations, entity swap, amount scaling) |
| `tests/test_ingestion.py` | 4 | MIME loading, currency normalizers, attachment parsing |
| `tests/test_threading.py` | 2 | 10-thread reconstruction & chronological ordering |
| `tests/test_evaluation_cases.py` | 1 | End-to-end benchmark execution harness |
| `tests/run_tests.py` | 101 | Unified test runner aggregating all suites |

---

## 6. Stress and Scale Test Results (M12 / M13)

- **M12 Scale-Up (10,052 messages across 210 threads):**
  - Graph reconstruction time: **171.02 ms** (PRD Target: $< 5,000\text{ ms}$).
  - Retrieval latency (p95): **97.90 ms**.
  - Recovery: 210/210 threads reconstructed without data loss.
- **M13 Long-Chain Chains (50 & 200 messages):**
  - Linear order verified on both 50 and 200 messages.
  - Summary conciseness: **17 words** (PRD Target: $\le 60\text{ words}$).
  - Final status: `RESOLVED`.

---

## 7. Strict Ownership Boundaries

The AI/ML Engineering Layer strictly owns:
- Data ingestion and normalization (`sutra/ingestion/`).
- Thread reconstruction and anomaly detection (`sutra/processing/`).
- Hierarchical indexing and vector stores (`sutra/retrieval/`).
- Sparse BM25, dense semantic, and adaptive hybrid retrieval (`sutra/retrieval/`).
- Conversation intelligence, decision ledgers, action items (`sutra/intelligence/`).
- AI/ML evaluation metrics and perturbation harnesses (`sutra/evaluation/`).

The AI/ML Engineering Layer **STRICTLY EXCLUDES**:
- RAG context construction and token budget management (`sutra/rag/` — RAG team).
- Answer-generation prompt engineering and LLM synthesis (RAG team).
- Generated-answer citation verification and abstention policies (RAG team).
- Platform REST API routes and database schemas (`backend/` — Backend team).
- React/Next.js dashboard components and UI state (`frontend/` — Frontend team).

---

## 8. Baseline Reproduction Instructions

To independently verify and reproduce this baseline from clean state:

```powershell
# 1. Activate Python 3.12 environment
.\.venv\Scripts\Activate.ps1

# 2. Run the complete test suite (101 tests)
python -m unittest discover tests

# 3. Run the official benchmark evaluation suite
python run_eval.py

# 4. Generate machine-readable JSON metrics artifacts
python scripts/generate_evaluation_artifacts.py

# 5. Verify git commit and baseline tag
git rev-parse HEAD
git tag -l "anvaya-ai-ml-baseline-v1.0"
```
