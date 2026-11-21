# ANVAYA — AI/ML Engineering Team Handoff Document
**Version:** 1.0.0  
**Target Audience:** RAG Developer, Backend API Developer, Frontend/UI Engineer (Person 3)  
**Author:** Senior AI/ML Engineer (Non-RAG Lead)  
**Working Branch:** `person-2-conversation-intelligence`  
**Repository Working Directory:** `C:\Official-Email-Intelligence`

---

## 1. Overview & Architectural Role

The Non-RAG AI/ML Engineering Layer provides the data engineering, conversation intelligence, hierarchical indexing, and evaluation foundation for ANVAYA. It ingests raw multi-party institutional email corpora and attachments, reconstructs conversation trees via a 4-stage cascade, extracts structured decisions and action items with institutional role attribution, and indexes content across a 3-level hierarchy for precision retrieval.

This document outlines the contracts, data structures, and guarantees exposed to consuming engineers.

---

## 2. Interface Contracts for RAG Developer

### 2.1 Retrieval Engines (`sutra/retrieval/`)

The retrieval layer exposes two primary interfaces:
1. `HybridRetriever` (`sutra/retrieval/hybrid.py`)
2. `HierarchicalRetriever` (`sutra/retrieval/hierarchical.py`)

#### 2.1.1 `HybridRetriever.retrieve_results(query: str, top_k: int = 5) -> List[RetrievedChunk]`
Provides backward-compatible reciprocal rank fusion across BM25 lexical and dense semantic embeddings.
```python
from sutra.retrieval.hybrid import HybridRetriever

retriever = HybridRetriever(emails=corpus, thread_summaries=summaries)
chunks = retriever.retrieve_results(query="Which printer vendor was selected?", top_k=5)
```

#### 2.1.2 `HierarchicalRetriever.retrieve_hierarchical(...) -> Dict[str, List[RetrievedChunk]]`
Performs multi-level retrieval across the 3 index levels specified in PRD §8.3:
```python
from sutra.retrieval.hierarchical import HierarchicalRetriever, ChunkLevel

h_retriever = HierarchicalRetriever(emails=corpus, thread_summaries=summaries)

# Retrieve segregated chunks across levels
results = h_retriever.retrieve_hierarchical(
    query="CNC machine procurement quotation Vendor B",
    top_k_per_level=3
)

# Results dictionary keys:
# - "thread_cards": Level 1 Thread-Card chunks
# - "messages": Level 2 Email message body chunks
# - "attachments_tables": Level 3 PDF text, Table-Summary, and Table-Row chunks
# - "ledger": Structured Decision and Action chunks
```

### 2.2 `RetrievedChunk` Schema (`sutra/models/retrieval.py`)
Each returned chunk includes full provenance metadata:
```python
class RetrievedChunk(BaseModel):
    chunk_id: str
    content: str
    score: float
    source_id: str               # email_id, thread_id, or attachment filename
    thread_id: Optional[str]     # Root thread ID
    email_id: Optional[str]      # Specific email ID if message-level
    metadata: Dict[str, Any]
    level: ChunkLevel            # THREAD_CARD, MESSAGE, ATTACHMENT, TABLE_SUMMARY, TABLE_ROW, LEDGER
    locator: Dict[str, Any]      # {thread_id, email_id, row_index, sheet_name, entity_key}
    text_for_index: str
```

### 2.3 Table Chunks (`sutra/ingestion/table_chunker.py`)
Tabular attachments (e.g. procurement quotes, fee records) are chunked into two formats:
1. `ChunkLevel.TABLE_SUMMARY`: Summary containing headers, row count, and totals.
2. `ChunkLevel.TABLE_ROW`: Granular row representations: `[Entity Key] Column1: Value1 | Column2: Value2`.

---

## 3. Interface Contracts for Backend API Developer

### 3.1 Thread Management (`sutra/processing/threading.py`)
```python
from sutra.processing.threading import ThreadManager, ReconstructedThread

# Execute 4-Stage Cascade Reconstructor
threads: Dict[str, ReconstructedThread] = ThreadManager.reconstruct_cascade(
    emails=incoming_emails,
    use_provided_thread_ids=True
)

for thread_id, thread in threads.items():
    print(thread.thread_id)        # Canonical thread ID
    print(thread.subject)          # Cleaned root subject
    print(thread.email_ids)         # Topologically and chronologically ordered email IDs
    print(thread.participants)      # Unique participant set
    print(thread.integrity)         # VERIFIED, PARTIAL_GRAPH, or THREAD_CONFLICT
    print(thread.anomalies)         # List of anomaly flags (e.g. TIMESTAMP_ANOMALY, CYCLE_DISCARDED)
```

### 3.2 Thread Intelligence & Summarization (`sutra/intelligence/summarizer.py`)
```python
from sutra.intelligence.summarizer import ThreadSummarizer
from sutra.models.intelligence import ThreadIntelligence

summary: ThreadIntelligence = ThreadSummarizer.summarize_thread(
    thread_id="THR-001",
    emails=thread_emails
)
```
**Returned `ThreadIntelligence` Properties:**
- `summary.purpose`: Objective of the conversation.
- `summary.initial_context`: Background of initiation.
- `summary.discussion_points`: List of key deliberation points.
- `summary.decisions`: List of `Decision` objects (approver, amount, scope).
- `summary.actions`: List of `Action` objects (task, owner, deadline state).
- `summary.current_status`: Latest effective operational status.
- `summary.confidence_score`: Float between 0.0 and 1.0.

### 3.3 Institutional Identity Validation (`sutra/intelligence/identity.py`)
```python
from sutra.intelligence.identity import get_canonical_identity, DEMO_IDENTITY_DIRECTORY

info = get_canonical_identity("dean.admin@northbridge.edu")
# Returns: {
#   "name": "Prof. R. Venkatraman",
#   "role": "Dean (Administration)",
#   "department": "Administration",
#   "type": "ADMIN_ACADEMIC",
#   "source": "INFERRED_FROM_ADDRESS"
# }
```

---

## 4. Interface Contracts for Frontend Developer (Person 3)

### 4.1 Thread-Card View (PRD §10.1)
The backend exposes `ReconstructedThread` and `ThreadIntelligence` for rendering thread cards:
- **Badge Indicators:**
  - `integrity`: `"VERIFIED"` (green check), `"PARTIAL_GRAPH"` (amber warning — missing parents), `"THREAD_CONFLICT"` (red alert).
  - `confidence_score`: Visual confidence percentage bar.
- **Participant Avatars:**
  - Resolved through `sutra/intelligence/identity.py` to display institutional role pills (e.g., `[HoD]`, `[Dean]`, `[Registrar]`).

### 4.2 Decision & Action Ledger View (PRD §10.2)
- **Decision Table Columns:**
  - `Decision / Subject`: `decision.text`
  - `Scope (Authorizes)`: `decision.scope.authorizes` (list of approved actions)
  - `Scope (Excludes)`: `decision.scope.excludes` (explicit denials / limitations)
  - `Approver & Authority`: `decision.approver` (`decision.authority_basis`)
  - `Effective Amount`: `decision.amount_inr` (formatted INR)
  - `Status`: `decision.status` (`APPROVED`, `CONDITIONAL`, `SUPERSEDED`, `REJECTED`)
- **Action Table Columns:**
  - `Task`: `action.task`
  - `Kind`: `action.action_kind` (`DIRECTIVE`, `REQUEST`, `FOLLOW_UP`)
  - `Assignee`: `action.owner` (`action.owner_status`: `ASSIGNED` vs `UNASSIGNED`)
  - `Deadline State`: `action.deadline_state` (`MET`, `MISSED`, `UNDETERMINED`, `NONE`)
  - `Evidence`: `action.completion_evidence`

---

## 5. Non-RAG Guarantees and Invariants

1. **Deterministic Execution:** Core threading, table chunking, decision extraction, and BM25 indexing require no external API keys or live LLM daemon.
2. **Zero Ingestion Failures:** All datetime comparisons use normalized UTC timestamps via `ensure_utc()`.
3. **Citation Precision:** In the benchmark evaluation suite, all generated summaries and decision models retain 100% email ID grounding.
4. **Adversarial Robustness:** Passed all 14 benchmark perturbation tests (M0–M13) with zero false merges on subject/participant collision attacks.
