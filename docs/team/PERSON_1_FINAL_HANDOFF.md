# PERSON 1 — FINAL HANDOFF DOCUMENTATION
## Foundation, Data Engineering & Hybrid Retrieval

**Author:** Person 1 (Foundation & Retrieval Engineering)  
**Branch:** `person-1-foundation-retrieval`  
**Status:** Complete, Hardened, Integration-Ready  
**Consumers:** Person 2 (Intelligence & RAG Generation), Person 3 (Product Security & UI)

---

## 1. Executive Summary & Capabilities Implemented

Person 1 has completed the shared foundation and retrieval infrastructure for SUTRA:
1. **Shared Pydantic Data Contracts:** Strongly typed domain models for emails, attachments, threads, decisions, approvals, actions, and retrieval results.
2. **Ingestion & Attachment Processing:** Full CSV parsing (`52/52` emails), UTF-8 BOM sanitization, ISO-8601 timestamp normalization, Indian currency parsing (`INR 17.9 lakh` -> `1,790,000.0`), and tabular/text attachment parsing (`11/11` attachments).
3. **Thread Reconstruction:** Deterministic thread grouping, root identification, subject slug normalization, and chronological ordering (`10/10` threads).
4. **Participant & Role Resolution:** Standardized role resolution mapping sender/recipient email addresses to institutional roles (e.g. `HOD ME`, `Dean (Administration)`).
5. **Embedding Architecture (`BaseEmbedder`):**
   - Pluggable interface supporting `PretrainedSemanticEmbedder` (`sentence-transformers`), `OllamaEmbedder` (local HTTP endpoint), `DenseFeatureEmbedder` (zero-dependency offline baseline), and `MockEmbedder`.
   - Factory pattern (`get_embedder()`) with automatic environment detection and observable logging.
6. **Hardened In-Memory Dense Vector Store (`VectorIndex`):**
   - Cosine similarity search via vectorized NumPy dot products.
   - Guaranteed metadata filtering (`filter_fn`).
   - In-place document updates, deduplication by `doc_id`, empty/zero query vector protection, and deterministic tie-breaking.
7. **Sparse Keyword Search (`BM25Index`):**
   - BM25Okapi implementation indexing emails, attachments, and thread summaries.
8. **Hybrid Retrieval with Reciprocal Rank Fusion (`HybridRetriever`):**
   - Dual-mode retrieval combining sparse and dense rankings via RRF ($k=60$).
   - Multi-source coverage (emails, attachments, and thread summaries).
   - Graceful observable fallback if dense retrieval is unavailable.
9. **Stable Public API for Person 2 (`retrieve_results`):**
   - Returns typed `List[RetrievalResult]` with full metadata and score provenance.
   - Backward-compatible `retrieve()` interface preserved.

---

## 2. Public Retrieval Contract for Person 2

Person 2 (RAG & Intelligence Engine) should initialize and consume `HybridRetriever` as follows:

```python
from sutra.retrieval.hybrid import HybridRetriever
from sutra.models.retrieval import RetrievalResult, DocumentType

# 1. Initialize retriever with loaded emails and thread summaries
retriever = HybridRetriever(emails, summaries)

# 2. Query the engine using the typed API
results: list[RetrievalResult] = retriever.retrieve_results(
    query="Who approved the CNC machine purchase and what is still pending?",
    top_k=5,
    mode="hybrid",  # Supported modes: 'hybrid', 'bm25', 'dense'
)

# 3. Consume ranked evidence items
for item in results:
    print(f"Rank {item.rank}: [{item.doc_type}] {item.source_id} | Score: {item.score:.4f}")
    print(f"Content: {item.content[:120]}...")
    print(f"Metadata: {item.metadata}\n")
```

### RetrievalResult Schema

| Field | Type | Description |
| :--- | :--- | :--- |
| `query` | `str` | Original user question |
| `doc_id` | `str` | Unique document identifier (e.g., `email:E005`, `summary:THR-001`) |
| `source_id` | `str` | Underlying email ID (`E005`) or thread ID (`THR-001`) |
| `thread_id` | `str` | Associated conversation thread ID (`THR-001`) |
| `doc_type` | `DocumentType` | `email` or `thread_summary` |
| `content` | `str` | Full text indexed (email body, subject, attachments, summaries) |
| `retrieval_method` | `str` | `"hybrid_rrf"`, `"bm25"`, or `"dense"` |
| `score` | `float` | RRF fusion score or cosine/BM25 similarity score |
| `rank` | `int` | 1-indexed rank position |
| `metadata` | `dict` | Preserved headers, sender, sender_role, timestamp, attachments |

---

## 3. Embedding Model Selection & Environment Setup

### Available Backends

1. **`feature` (Default in current Python 3.15 environment):**
   - Uses `DenseFeatureEmbedder` (384-dimensional dense n-gram hashing vector with L2 normalization).
   - Requires zero external dependencies beyond NumPy.
   - Deterministic and sub-millisecond latency.
   - *Technical Note:* This is a structural n-gram hashing baseline, not a pretrained language model.
2. **`pretrained` (Recommended for production):**
   - Uses `PretrainedSemanticEmbedder` powered by `sentence-transformers` (`all-MiniLM-L6-v2` or `BAAI/bge-m3`).
   - Requires `sentence-transformers>=3.0.0` and C++ compiler/precompiled wheels.
3. **`ollama`:**
   - Connects to local Ollama instance (`http://localhost:11434`) running `nomic-embed-text` or `bge-m3`.
4. **`mock`:**
   - Deterministic mock for unit testing and CI pipelines.

### Environment Variable Configuration (`.env`)
```bash
# Choose embedding backend: pretrained, ollama, feature, mock
SUTRA_EMBEDDING_BACKEND=feature
SUTRA_EMBEDDING_MODEL=all-MiniLM-L6-v2
```

---

## 4. Retrieval Ablation Benchmark Results

Evaluated across the 15 gold institutional queries (`sample_queries.csv`):

```text
========================================================================================
 SUTRA RETRIEVAL ABLATION BENCHMARK: BM25 vs DENSE vs HYBRID (RRF)
========================================================================================
[*] Embedding backend in use: feature_baseline (dim=384)
[*] Indexed 62 documents in 11.0ms

----------------------------------------------------------------------------------------
Retrieval Mode   | R@1     | R@3     | R@5     | P@1     | P@3     | P@5     | MRR     | Latency  
----------------------------------------------------------------------------------------
BM25             |  15.6% |  45.0% |  70.6% |  26.7% |  33.3% |  32.0% |  0.522 |   0.16 ms
DENSE            |  15.6% |  33.3% |  56.7% |  40.0% |  26.7% |  25.3% |  0.544 |   0.09 ms
HYBRID (RRF)     |  25.6% |  56.1% |  73.3% |  53.3% |  42.2% |  34.7% |  0.656 |   0.20 ms
----------------------------------------------------------------------------------------
```

### Key Technical Findings
- **Hybrid RRF** yields the highest Mean Reciprocal Rank (**0.656** vs 0.522 for BM25 and 0.544 for Dense) and top-1 precision (**53.3%**).
- **BM25** captures exact alphanumeric codes (`THR-001`, `UTM`, `E024`, `Vendor B`).
- **Dense Vector Search** captures paraphrased institutional semantics.
- **Latency** is under **0.2ms per query**, ensuring zero retrieval bottleneck for Person 2's RAG pipeline.

---

## 5. Verification & Test Commands

To verify Person 1's deliverables independently, run:

1. **Unit Test Suite (15/15 tests passing):**
   ```bash
   python tests/run_tests.py
   ```
2. **Retrieval Ablation Benchmark:**
   ```bash
   python -m sutra.retrieval.ablation
   ```
3. **End-to-End Baseline Harness:**
   ```bash
   python run_eval.py
   ```

---

## 6. Known Limitations & Recommendations for Person 2

1. **Embedding Quality:** In Python 3.15 on Windows, PyYAML compilation requires MSVC C++ Build Tools, so `sentence-transformers` is configured as an optional dependency (`pip install sutra[semantic]`). In environments without C++ build tools, the system automatically runs the zero-dependency `feature_baseline`. Person 2 can connect to a local Ollama instance (`nomic-embed-text`) or run in Python 3.11/3.12 for full neural transformer embeddings.
2. **In-Memory Vector Store Scalability:** `VectorIndex` stores dense vectors in a NumPy matrix in RAM. This performs excellently for datasets up to ~50,000 documents (~75 MB RAM). If the corpus scales to millions of emails, Person 1 recommends switching the underlying matrix storage to an external vector database (such as Qdrant) without altering `HybridRetriever`'s interface.
