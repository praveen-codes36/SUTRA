# SUTRA — Team Coordination, Ownership & Parallel Execution Plan

**Project:** SUTRA (AI-Powered Institutional Email Intelligence Platform)  
**Team Size:** 3 Members  
**Core Purpose:** Guide seamless parallel execution, define strict module boundaries, enforce shared contracts, and establish conflict resolution procedures.

---

## 1. Final Ownership Table

| Role | Member | Primary Focus | Key Modules / Directories | Deliverables |
|---|---|---|---|---|
| **Role 1** | **Person 1** | **Foundation, Data Engineering & Retrieval Engineering** | `sutra/models/`<br>`sutra/ingestion/`<br>`sutra/processing/`<br>`sutra/retrieval/`<br>`sutra/evaluation/`<br>`tests/` | Shared Pydantic contracts, data loader, normalizers, thread manager, hybrid retriever, benchmark harness. |
| **Role 2** | **Teammate 2** | **Conversation Intelligence & RAG Generation** | `sutra/intelligence/`<br>`sutra/rag/` | Decision/approval extractor, lifecycle tracker, action extractor, thread summarizer, grounded RAG generator, citation verifier. |
| **Role 3** | **Teammate 3** | **Product Interface, Security & Demonstration** | `sutra/interface/`<br>`docs/` | Streamlit interface, evidence explorer, pending actions dashboard, prompt injection defense, architecture diagram, demo script. |

---

## 2. Shared Data Contracts (Single Source of Truth)

All modules communicate exclusively via typed Pydantic models defined in [`sutra/models/`](../../sutra/models/).

```
      [Person 1: Ingestion & Threading]
                     │
           produces  │ List[Email], Dict[str, Thread]
                     ▼
      [Person 2: Conversation Intelligence]
                     │
           produces  │ Dict[str, ThreadIntelligence]
                     ▼
      [Person 1: Hybrid Retriever]
                     │
           produces  │ List[RetrievalResult]
                     ▼
      [Person 2: RAG Answer Engine]
                     │
           produces  │ RAGAnswer (with verified Citations)
                     ▼
      [Person 3: Streamlit Interface]
```

### The 6 Core Contracts

| Contract Model | Producing Role | Consuming Roles | Description | Realistic Example |
|---|---|---|---|---|
| **`Email`** | Person 1 | Person 2, Person 3 | Normalized message record | `Email(email_id="E005", thread_id="THR-001", sender="dean.admin@northbridge.edu", sender_role="Dean (Administration)", ...)` |
| **`Thread`** | Person 1 | Person 2, Person 3 | Grouped conversation | `Thread(thread_id="THR-001", email_ids=["E001"..."E007"], message_count=7, ...)` |
| **`ThreadIntelligence`** | Person 2 | Person 1, Person 3 | Full thread summary & facts | `ThreadIntelligence(thread_id="THR-001", lifecycle_state="ordered", decisions=[...], actions=[...])` |
| **`RetrievalDocument`** | Person 1 | Person 1 (internal) | Indexable text unit | `RetrievalDocument(doc_id="doc:E005", source_id="E005", content="...", metadata={...})` |
| **`RetrievalResult`** | Person 1 | Person 2 | Ranked search hit | `RetrievalResult(query="...", source_id="E005", retrieval_method="hybrid_rrf", score=0.0328, rank=1)` |
| **`RAGAnswer`** | Person 2 | Person 3 | Final evidence answer | `RAGAnswer(question="...", answer="...", citations=[Citation(email_id="E005", ...)], abstained=False)` |

---

## 3. Module Ownership Boundaries

To eliminate development collisions and duplication:
1. **Person 1 does NOT generate conversational answers:** Person 1 retrieves and ranks documents (`RetrievalResult`). Answer prompt design and conversational synthesis belong strictly to Person 2.
2. **Person 2 does NOT build vector stores or keyword search:** Person 2 consumes retrieval results. Person 2 does not duplicate BM25 or embedding indexes.
3. **Person 3 does NOT alter backend business logic:** Person 3 calls public APIs (`SutraRAGEngine.answer_query()`, `ThreadManager.build_threads_from_dataset()`) and does not hardcode extraction or retrieval rules inside UI components.

---

## 4. Parallel Development Plan (Working Against Mocks)

Team members can work in parallel immediately without waiting for other modules:

```
[Phase 1: Contracts Frozen]
      │
      ├───► Person 1 works on Ingestion, Currency Normalizer, BM25 & Hybrid Retrieval
      │
      ├───► Person 2 works on Decision Rules, Lifecycle State Machine & Prompt Formatting (using mock Email/Thread objects)
      │
      └───► Person 3 works on Streamlit layout & UI components (using mock RAGAnswer & Thread lists)
```

- **Mock Data for Person 2:** Can use the sample JSON representations in `sutra/models/` or the existing test fixtures.
- **Mock Data for Person 3:** Can instantiate a static `RAGAnswer` to test the citation cards and expandable email bodies before connecting the live backend.

---

## 5. Integration Sequence & Checkpoints

### Checkpoint 1 (Phase 1 Exit): Contracts & Baseline
- All shared models import cleanly.
- `python run_eval.py` executes without errors.

### Checkpoint 2 (Phase 3 Exit): Intelligence & Retrieval Integration
- Person 1's `HybridRetriever` provides ranked `RetrievalResult` objects to Person 2.
- Person 2's `ThreadSummarizer` provides `ThreadIntelligence` for index enrichment.

### Checkpoint 3 (Phase 4 Exit): Full UI & RAG Integration
- Person 3's Streamlit app connects to Person 2's `SutraRAGEngine`.
- Live queries in the UI return formatted answers with clickable citations.

### Checkpoint 4 (Phase 8 Exit): Final Submission Freeze
- `python tests/run_tests.py` passes 100%.
- `python run_eval.py` maintains 100.0/100.0.
- `streamlit run sutra/interface/app.py` boots in $< 3$ seconds.

---

## 6. Expected Deliverables by Role

### Person 1 Deliverables
- Working ingestion engine (`sutra/ingestion/loader.py`).
- Deterministic normalizers for Indian currency and administrative roles.
- Layered thread reconstruction engine (`sutra/processing/threading.py`).
- Multi-level Hybrid Retriever (`sutra/retrieval/hybrid.py`).
- Passing unit test suite (`tests/run_tests.py`).

### Person 2 Deliverables
- Lifecycle state tracker (`sutra/intelligence/state_machine.py`).
- Decision and action extractors (`decisions.py`, `actions.py`).
- Thread summarization engine (`summarizer.py`).
- Grounded RAG answer generator (`sutra/rag/engine.py`).
- Citation verifier and abstention engine (`verifier.py`).

### Person 3 Deliverables
- Interactive Streamlit application (`sutra/interface/app.py`).
- Visual provenance and citation explorer.
- Prompt injection protection.
- Architecture diagram (`docs/architecture.png`).
- 4-minute demo script (`docs/DEMO_SCRIPT.md`).

---

## 7. Rules for Changing Shared Models
1. **Owner Authority:** Person 1 owns `sutra/models/`.
2. **No Unilateral Edits:** Person 2 and Person 3 must **not** edit files in `sutra/models/` directly.
3. **Change Proposal Process:** If a new field is needed (e.g. `confidence_interval` on `RAGAnswer`):
   - Open a discussion with Person 1.
   - Propose field name, type, and default value.
   - Person 1 updates the contract, ensures backwards compatibility with defaults, and notifies the team.

---

## 8. Branching & Directory Strategy
- `main`: Production-ready code only. Code must pass `tests/run_tests.py` and `run_eval.py` before merging.
- `feature/person1-retrieval`: Person 1's working branch.
- `feature/person2-intelligence`: Person 2's working branch.
- `feature/person3-interface`: Person 3's working branch.

---

## 9. Interface Conflict Resolution
- If an output schema mismatch occurs (e.g. Person 2 expects `RetrievalResult.text` instead of `RetrievalResult.content`):
  - Consult `sutra/models/retrieval.py` as the canonical reference.
  - The consuming module updates its field access to match the frozen Pydantic contract.
  - In cases of genuine ambiguity, Person 1 arbitrates the contract definition.

---

## 10. Progress Reporting & Standups
- Daily 10-minute sync:
  1. What did I complete yesterday?
  2. What am I completing today?
  3. Am I blocked by any shared interface?
- Every merge into `main` must re-run `python run_eval.py` to ensure zero regression on the official benchmark.

