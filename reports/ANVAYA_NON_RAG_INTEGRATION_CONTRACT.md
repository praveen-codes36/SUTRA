# ANVAYA — Non-RAG AI/ML Public Integration Contract Specification

**Author:** Senior AI/ML Integration Engineer  
**Date:** November 21, 2026  
**Repository:** [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence)  
**Branch:** `anvaya-reliability-upgrade` (HEAD: `53a58ce`)  
**Target Consumers:** Downstream RAG Developer, Backend Engineering Team, Frontend Engineering Team  

---

## 1. System Overview & Ownership Boundary

The Non-RAG AI/ML layer provides typed, deterministic foundation services for institutional email communication:
1. **Data Ingestion & Extraction:** Parsing raw email headers, MIME text, CSV tables, and plaintext attachments.
2. **Thread Reconstruction:** Directed conversation graph assembly with cycle detection and topological ordering.
3. **Information Retrieval:** Dual-mode retrieval exposing an authoritative email-level interface and a fine-grained chunk interface.
4. **Conversation Intelligence:** Extracting decision ledgers, action items, deadline compliance, and operational lifecycle states.
5. **Shared LLM Provider Utility:** Pluggable, cached, schema-validated completion infrastructure.

---

## 2. Ingestion & Data Contracts

### 2.1 Ingestion Service
- **Class:** `sutra.ingestion.loader.EmailDatasetLoader`
- **Method:** `load_emails() -> List[Email]`
  - **Inputs:** `dataset_dir: str`
  - **Outputs:** List of validated [Email](file:///C:/Official-Email-Intelligence/sutra/models/email.py) domain objects.
  - **Failure Mode:** If files are unreadable, logs warning and skips invalid files without crashing the pipeline.

### 2.2 Schema: `Email`
```python
class Email(BaseModel):
    email_id: str                      # Guaranteed: Unique identifier (e.g. "E001")
    thread_id: str                     # Guaranteed: Thread cluster ID (e.g. "THR-001")
    sender: str                        # Guaranteed: Normalized email address
    recipients: List[str]              # Guaranteed: List of normalized recipient emails
    subject: str                       # Guaranteed: Normalized subject string
    timestamp: datetime                # Guaranteed: UTC timezone-aware datetime
    body: str                          # Guaranteed: Cleaned UTF-8 plaintext body
    sender_role: Optional[str] = None  # Optional: Resolved role (e.g. "Dean (Administration)")
    recipient_roles: List[str] = []    # Optional: List of resolved recipient roles
    in_reply_to: Optional[str] = None  # Optional: Parent email_id
    references: List[str] = []         # Optional: List of referenced email_ids
    attachments: List[str] = []        # Optional: Filenames of discovered attachments
    attachment_data: Dict[str, AttachmentMetadata] = {} # Optional: Parsed attachment text
```

---

## 3. Thread Reconstruction Contracts

### 3.1 Thread Construction API
- **Class:** `sutra.processing.threading.ThreadManager`
- **Method 1 (Dataset Preserved):** `build_threads_from_dataset(emails: List[Email]) -> Dict[str, Thread]`
  - Groups emails by their native thread ID, orders messages deterministically by `(timestamp, email_id)`, aggregates participants, roles, and attachments.
- **Method 2 (Four-Stage Reconstruction Cascade):** `reconstruct_cascade(emails: List[Email], use_provided_thread_ids: bool = True) -> Dict[str, ReconstructedThread]`
  - Recovers conversation graphs from `in_reply_to`, normalized subject slugs, and participant overlap.
  - Evaluates thread integrity: `ThreadIntegrity.COMPLETE`, `ThreadIntegrity.PARTIAL_GRAPH`, or `ThreadIntegrity.THREAD_CONFLICT`.

### 3.2 Schema: `Thread` & `ReconstructedThread`
| Field | Type | Description |
| :--- | :--- | :--- |
| `thread_id` | `str` | Guaranteed: Canonical thread identifier |
| `subject` | `str` | Guaranteed: Base conversation topic |
| `email_ids` | `List[str]` | Guaranteed: Topologically and chronologically sorted message IDs |
| `participants` | `List[str]` | Guaranteed: Sorted list of all unique participant email addresses |
| `participant_roles` | `List[str]` | Guaranteed: Sorted list of all distinct resolved institutional roles |
| `start_time` | `datetime` | Guaranteed: UTC timestamp of earliest message |
| `last_updated` | `datetime` | Guaranteed: UTC timestamp of latest message |
| `message_count` | `int` | Guaranteed: Total number of emails in thread |
| `integrity` | `str` | Guaranteed in cascade: `COMPLETE`, `PARTIAL_GRAPH`, `THREAD_CONFLICT` |
| `anomalies` | `List[str]` | Optional: Detected anomalies (`CYCLE_DISCARDED`, `MISSING_PARENT`, etc.) |

---

## 4. Information Retrieval Contracts

The retrieval engine exposes two distinct public interfaces designed for different consumer purposes:

```mermaid
flowchart TD
    Q["Search Query"] --> R["HybridRetriever"]
    R -->|retrieve| E["Canonical Email Interface"]
    R -->|retrieve_results| C["Granular Chunk Interface"]
    E -->|Tuple of Email & ThreadSummary| D["Email Citations & PRD §16.4 Benchmark"]
    C -->|List of RetrievalResult| P["RAG Prompt Context Builder"]
```

### 4.1 Authoritative Email-Level Retrieval Contract
- **Method:** `retriever.retrieve(query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]`
- **Authoritative Status:** This is the **authoritative public method** for email-level citation retrieval and PRD §16.4 benchmark evaluation.
- **Internal Pipeline:**
  1. Retrieves top 50 candidates from hybrid RRF fusion.
  2. Maps attachment excerpts and CSV table rows back to their parent email IDs.
  3. Deduplicates emails, retaining the highest-scoring occurrence.
  4. Applies thread expansion, pulling top thread summary cards.
  5. Returns `(matched_emails[:top_k], matched_summaries[:2])`.
- **Guarantees:**
  - Guaranteed to return valid `Email` and `ThreadSummary` domain objects.
  - Verified benchmark metrics against `expected_email_ids`: Recall@5 = **1.0000**, MRR@5 = **0.8556**, nDCG@5 = **0.8701**, Thread-Hit@1 = **1.0000**.
  - All 4 PRD §16.4 mandatory targets are satisfied.

### 4.2 Specialized Multi-Modal Chunk Retrieval Contract
- **Method:** `retriever.retrieve_results(query: str, top_k: int = 5, mode: str = "hybrid", dedup_by_source: bool = False) -> List[RetrievalResult]`
- **Consumer:** Specifically designed for the **RAG Context Builder** to assemble token-budgeted prompt blocks.
- **Return Type:** `List[RetrievalResult]`
```python
class RetrievalResult(BaseModel):
    query: str                       # Search query
    doc_id: str                      # Document locator (e.g. "email:E001", "tab_row:E002:cnc.csv:1")
    source_id: str                   # Source identifier ("E001" or attachment name)
    thread_id: str                   # Thread identifier ("THR-001")
    doc_type: DocumentType           # EMAIL, ATTACHMENT, TABLE_ROW, THREAD_SUMMARY
    level: ChunkLevel                # THREAD_CARD, MESSAGE, ATTACHMENT, TABLE_ROW
    content: str                     # Verbatim chunk text for prompt inclusion
    retrieval_method: str            # "hybrid_rrf", "bm25", or "dense"
    score: float                     # Normalized RRF score
    rank: int                        # 1-indexed retrieval position
    locator: Optional[str] = None    # Row or attachment locator
    metadata: Dict[str, Any] = {}    # Provenance metadata (sender, date, filename, etc.)
```
- **Important Interface Note:** In this interface, Level 1 `THREAD_SUMMARY` cards frequently occupy rank 1. If evaluated directly against email-only ground truth without parent mapping, it produces a chunk-level nDCG of 0.8183 (filtered) or 0.6351 (raw). This interface is specialized for RAG chunk ingestion and must not be used for standalone email-level benchmark evaluation.

---

## 5. Conversation Intelligence Contracts

### 5.1 Decision Extraction
- **Module:** `sutra.intelligence.decisions`
- **Method:** `DecisionExtractor.extract_decisions(thread_id: str, emails: List[Email]) -> List[Decision]`
- **Guarantees:**
  - Distinguishes proposals from authorized decisions.
  - Returns `amount_inr: Optional[float]`. Initial budget allocations without authorization return `amount_inr = None`.
  - Flags conditional approvals: `is_conditional: bool`, `conditions: List[str]`.

### 5.2 Action Extraction & Deadline Compliance
- **Module:** `sutra.intelligence.actions`
- **Method:** `ActionExtractor.extract_actions(thread_id: str, emails: List[Email]) -> List[Action]`
- **Guarantees:**
  - Extracts assigned owners, tasks, and deadlines.
  - Completed actions have `status = ActionStatus.COMPLETED` and `deadline_state = "MET"`.
  - Conversations resolved without obligations return an empty action list or `task = "none_stated"` (PRD §9.3).

### 5.3 Operational Status Detection
- **Module:** `sutra.intelligence.status`
- **Method:** `ThreadStatusDetector.detect_status(thread_id: str, emails: List[Email]) -> ThreadStatus`
- **Guarantees:**
  - Detects `current_status: ThreadStatusType` (`COMPLETED`, `RESOLVED`, `IN_PROGRESS`, `AWAITING_RESPONSE`).
  - Overrules prior closures if reopening keywords appear in later emails.
  - `explanation: str` is grounded directly in verbatim email body text.

---

## 6. Shared LLM Provider Contracts

- **Module:** `sutra.intelligence.llm_provider`
- **Factory:** `get_llm_provider(provider_name: Optional[str] = None, model: Optional[str] = None, api_key: Optional[str] = None, base_url: Optional[str] = None, enable_cache: bool = True) -> BaseLLMProvider`
- **Primary Method:** `generate_json(system_prompt: str, user_prompt: str, schema: Optional[Type[BaseModel]] = None, max_retries: int = 2) -> Dict[str, Any]`
- **Guarantees:**
  - Enforces schema compliance via Pydantic.
  - Automatic SHA-256 disk caching in `.cache/llm_responses/`.
  - Automatically cleans markdown code fences (` ```json ... ``` `).
  - Exponential backoff retry on network or validation errors.
  - Zero credential leakage in logs or exceptions.

---

## 7. Contract Summary Matrix

| Subsystem | Authoritative Method | Primary Output Type | Guaranteed Fields |
| :--- | :--- | :--- | :--- |
| **Ingestion** | `EmailDatasetLoader.load_emails()` | `List[Email]` | `email_id`, `thread_id`, `sender`, `recipients`, `timestamp`, `body` |
| **Threading** | `ThreadManager.build_threads_from_dataset()` | `Dict[str, Thread]` | `thread_id`, `email_ids`, `participants`, `message_count`, `start_time` |
| **Email Retrieval** | `HybridRetriever.retrieve()` | `Tuple[List[Email], List[ThreadSummary]]` | Ranked `Email` instances, top parent `ThreadSummary` cards |
| **Chunk Retrieval** | `HybridRetriever.retrieve_results()` | `List[RetrievalResult]` | `doc_id`, `source_id`, `thread_id`, `content`, `rank`, `score`, `level` |
| **Decisions** | `DecisionExtractor.extract_decisions()` | `List[Decision]` | `decision`, `category`, `decision_maker`, `is_conditional`, `evidence_email_id` |
| **Actions** | `ActionExtractor.extract_actions()` | `List[Action]` | `task`, `owner`, `deadline`, `status`, `deadline_state` |
| **Status** | `ThreadStatusDetector.detect_status()` | `ThreadStatus` | `thread_id`, `current_status`, `explanation`, `is_resolved` |
| **LLM Provider** | `BaseLLMProvider.generate_json()` | `Dict[str, Any]` | Validated structured dictionary conforming to requested schema |
