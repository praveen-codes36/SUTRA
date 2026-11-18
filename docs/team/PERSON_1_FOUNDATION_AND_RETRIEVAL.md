# PERSON 1 — Foundation, Data Engineering & Retrieval Engineering

**Owner:** Person 1 
**Primary Focus:** Core data contracts, robust ingestion, thread management, and multi-level retrieval infrastructure.

---

## 1. Role Overview
Person 1 is the anchor for the system's data integrity and retrieval performance. This role is responsible for:
1. Defining and freezing all shared data contracts (Pydantic models) used by all three team members.
2. Building the email, attachment, and normalization pipeline.
3. Managing layered conversation thread reconstruction.
4. Engineering the dense/sparse hybrid retrieval engine, Reciprocal Rank Fusion (RRF), and reranking.
5. Providing structured `RetrievalResult` objects to Person 2 (RAG) and maintaining the benchmark harness.

---

## 2. Exact Responsibilities
1. **Shared Pydantic Models:** Maintain single source of truth in `sutra/models/`.
2. **Data Ingestion:** Load `dataset/emails.csv` and parse all files in `dataset/attachments/`.
3. **Normalization:** Standardize ISO-8601 timestamps, recipient addresses, and Indian currency values (`"INR 17.9 lakh" -> 1,790,000`).
4. **Institutional Role Mapping:** Resolve email addresses (`mech.hod@...`) to administrative roles (`Head of Department`).
5. **Thread Reconstruction:** Group emails chronologically into conversation threads using a layered algorithm.
6. **BM25 Keyword Index:** High-speed in-memory keyword search over emails, attachments, and summaries.
7. **Dense Vector Indexing:** Embedding generation and vector indexing for semantic similarity.
8. **Hybrid Retrieval:** Multi-level retrieval with Reciprocal Rank Fusion (RRF) and thread context expansion.
9. **Benchmark Evaluation Harness:** Maintain `sutra/evaluation/harness.py` and `run_eval.py`.
10. **Foundational Unit Tests:** Maintain `tests/test_ingestion.py` and `tests/test_threading.py`.

---

## 3. Explicit Exclusions (What You Must NOT Build)
- **NO Final RAG Conversational Answer Synthesis:** Do NOT design answer prompts or construct the final user-facing text answer. That is owned by **Person 2**.
- **NO Conversation Intelligence Extraction Logic:** Do NOT write the LLM extraction logic for decisions, approvals, and actions. That is owned by **Person 2**.
- **NO User Interface or Dashboards:** Do NOT build the Streamlit UI or web frontends. That is owned by **Person 3**.
- **NO Pitch Deck or Presentation Materials:** That is owned by **Person 3**.

---

## 4. Relevant Architecture
Person 1 owns **Layer 1 (Ingestion)**, **Layer 2 (Thread Processing)**, **Layer 4 (Retrieval & Indexing)**, and **Layer 6 (Evaluation Harness)**:

```
emails.csv + attachments/
        │
  [Layer 1: Ingestion & Normalization] (Person 1)
        │
  [Layer 2: Thread Reconstruction & Roles] (Person 1)
        │
  [Layer 4: Hybrid Retrieval Engine] (Person 1) ───► Emits RetrievalResult to Person 2
        │
  [Layer 6: Benchmark Harness] (Person 1)
```

---

## 5. Files and Directories Owned

| Directory / File | Status | Responsibility |
|---|---|---|
| `sutra/models/email.py` | Active | `Email`, `Thread`, `AttachmentMetadata` models |
| `sutra/models/retrieval.py` | Active | `RetrievalDocument`, `RetrievalResult` models |
| `sutra/models/__init__.py` | Active | Single source of truth exports |
| `sutra/ingestion/loader.py` | Active | CSV dataset ingestion engine |
| `sutra/ingestion/normalizers.py` | Active | Currency, date, and text normalizers |
| `sutra/ingestion/attachments.py` | Active | Plaintext and tabular CSV attachment reader |
| `sutra/processing/threading.py` | Active | Layered conversation reconstruction |
| `sutra/processing/roles.py` | Active | Institutional email-to-role directory |
| `sutra/processing/conversation.py`| Active | Chronological transcript builder |
| `sutra/retrieval/bm25.py` | Active | BM25Okapi keyword search engine |
| `sutra/retrieval/fusion.py` | Active | Reciprocal Rank Fusion (mailrag adaptation) |
| `sutra/retrieval/hybrid.py` | Active | Multi-level hybrid retriever + thread expansion |
| `sutra/evaluation/harness.py` | Active | Official benchmark evaluator |
| `run_eval.py` | Active | One-command evaluation CLI |
| `tests/run_tests.py` | Active | Unit test runner |
| `tests/test_ingestion.py` | Active | Ingestion and currency test suite |
| `tests/test_threading.py` | Active | Thread integrity test suite |

---

## 6. Detailed Implementation Instructions

### Ingestion & Normalization (`sutra/ingestion/`)
- Open `emails.csv` with `encoding="utf-8-sig"` to prevent UTF-8 BOM issues (`\xef\xbb\xbf`).
- Parse semicolon-separated recipient strings into lowercase lists.
- Normalize Indian currency formats: regex must capture both numeric formats (`INR 28,000`, `INR 1,790,000`) and word denominations (`INR 17.9 lakh` $\rightarrow$ `1,790,000.0`, `INR 3.5 lakh` $\rightarrow$ `350,000.0`, `INR 3.42 lakh` $\rightarrow$ `342,000.0`). Always use `round(amount, 2)` to eliminate floating-point precision issues.
- Attachment reading: parse `.csv` files into structured dictionaries and formatted tabular text. Parse `.txt` into clean strings.

### Thread Reconstruction (`sutra/processing/threading.py`)
- Primary grouping: Use `thread_id` from the dataset.
- Secondary fallback: Follow `in_reply_to` links to find conversation root message.
- Tertiary fallback: Compute normalized `subject_slug` (adapted from mailrag) by recursively stripping `Re:`, `Fwd:`, and collapsing spaces.
- Guarantee that all 52 emails belong to exactly 10 threads, sorted in ascending chronological order by timestamp.

### Hybrid Retrieval (`sutra/retrieval/`)
- Multi-level indexing: Index individual emails (with sender, role, body, and attachment content), attachment files independently, and thread summaries.
- BM25 scoring: Tokenize queries, preserving special institutional tokens (`THR-001`, `E005`, vendor names, dates).
- RRF Fusion: Adapt mailrag's `fusion.py`:
  $$RRF(d) = \sum_{m \in M} \frac{1}{60 + \text{rank}_m(d)}$$
- Thread expansion: If an email message (e.g. `E005`) scores high, retrieve its parent thread context (`THR-001`) so that Person 2 has full situational awareness.

---

## 7. Task-by-Task Roadmap (Mapped to Master Roadmap)

- **Task 1.1:** Stabilize Shared Data Models & Typed Contracts.
- **Task 1.4:** Implement Baseline Benchmark Harness (`run_eval.py`).
- **Task 2.1:** Implement CSV Ingestion & Attachment Parser.
- **Task 2.2:** Implement Deterministic Currency & Role Normalizers.
- **Task 2.3:** Implement Layered Thread Reconstruction.
- **Task 3.1:** Implement Multi-Level BM25 Keyword Search.
- **Task 3.2:** Implement Reciprocal Rank Fusion & Thread Expansion.
- **Task 5.1:** End-to-End Pipeline Integration Checkpoint (with Person 2).
- **Task 6.1:** Retrieval Ablation Study (BM25 vs Dense vs Hybrid vs Reranked).
- **Task 8.1:** Final End-to-End Verification & Code Freeze.

---

## 8. Interface Contracts (What You Provide to Others)

### Output Contract: `RetrievalResult` (Consumed by Person 2 & 3)
```python
from sutra.models.retrieval import RetrievalResult, DocumentType

result = RetrievalResult(
    query="What was the final decision on the CNC machine procurement?",
    doc_id="doc:E005",
    source_id="E005",
    thread_id="THR-001",
    doc_type=DocumentType.EMAIL,
    content="Approved. Proceed with Vendor B for INR 17.9 lakh, subject to standard purchase terms and budget confirmation.",
    retrieval_method="hybrid_rrf",
    score=0.0328,
    rank=1,
    metadata={
        "sender": "dean.admin@northbridge.edu",
        "sender_role": "Dean (Administration)",
        "timestamp": "2026-09-08T12:30:00+00:00",
        "attachments": []
    }
)
```

---

## 9. Testing Requirements
1. `python tests/run_tests.py`: Must pass 7/7 tests in $< 0.05$s.
2. `python run_eval.py`: Must verify 10/10 threads and 52/52 emails mapped.
3. Test layered thread recovery without `thread_id` and `in_reply_to`.

---

## 10. Deliverables
- Fully working ingestion and attachment parsing pipeline.
- Layered thread reconstruction engine.
- High-precision Hybrid Retriever (`HybridRetriever`).
- Passing unit test suite (`tests/`).
- Automated benchmark evaluator (`run_eval.py`).

---

## 11. Definition of Done
- 52 emails and 11 attachments loaded with 0 missing fields.
- 10 threads reconstructed and sorted chronologically.
- Recall@5 $\ge 0.95$ on `sample_queries.csv`.
- Retrieval output adheres strictly to `RetrievalResult` schema.

---

## 12. Integration Instructions
- Expose `HybridRetriever(emails, summaries)` as the public entry point.
- Person 2 calls `retriever.retrieve(query, top_k=5)`.
- Person 3 queries `ThreadManager.build_threads_from_dataset(emails)` to render the Thread Explorer.

---

## 13. Common Mistakes to Avoid
- **BOM encoding bug:** Never open `emails.csv` without `utf-8-sig`.
- **Floating point math:** Never do `17.9 * 100000` without rounding; IEEE 754 results in `1789999.9999999998`.
- **Model drift:** Never modify Pydantic models in `sutra/models/` without notifying Person 2 and Person 3.
- **Scope creep:** Do not attempt to write answer generation prompts. Pass ranked evidence to Person 2.

---

## 14. Suggested Development Order
1. Run `python tests/run_tests.py` and `python run_eval.py` to confirm baseline.
2. Inspect `sutra/ingestion/` and `sutra/processing/`.
3. Add dense vector embeddings into `HybridRetriever` if connecting local embedding endpoints.
4. Run ablation benchmarks (`Task 6.1`).

