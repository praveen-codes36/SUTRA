# PERSON 2 — Conversation Intelligence & RAG Answer Generation

**Owner:** Teammate 2  
**Primary Focus:** Extracting structured knowledge from email threads (decisions, approvals, actions, lifecycle states) and generating evidence-grounded answers with verified citations.

---

## 1. Role Overview
Person 2 turns raw conversation transcripts and retrieved search results into structured, trustworthy institutional knowledge. This role is responsible for:
1. Thread-level summarization and latest status detection.
2. Structured decision, approval, and scope-qualifier extraction.
3. Pending action-item, owner, and deadline tracking (handling "none stated" cases).
4. Lifecycle state tracking (requested $\rightarrow$ quoted $\rightarrow$ approved $\rightarrow$ executed $\rightarrow$ closed).
5. Grounded RAG answer generation consuming retrieval evidence from Person 1.
6. Citation verification (ensuring zero hallucinated evidence IDs) and abstention on out-of-scope queries.

---

## 2. Exact Responsibilities
1. **Decision Extraction:** Identify formal outcomes, selected vendors, approved amounts, and authorities.
2. **Approval Scope Detection:** Capture caveats (e.g. "planning only", "subject to budget confirmation").
3. **Action Intelligence:** Extract pending tasks, assignees, deadlines, and identify completed workflows.
4. **Lifecycle State Machine:** Model conversations across 7 states to determine latest operational status.
5. **Thread Summaries:** Synthesize full thread transcripts into concise summaries with timelines.
6. **RAG Context Construction:** Ingest `RetrievalResult` objects from Person 1 and assemble context.
7. **Answer Synthesis:** Produce structured direct answers answering user questions.
8. **Citation Grounding:** Link every claim to specific email IDs (`E001`, `E005`) and attachment names.
9. **Citation Verification:** Enforce string/substring validation against source texts to eliminate hallucinations.
10. **Abstention Logic:** Detect unanswerable/out-of-scope questions and abstain gracefully.

---

## 3. Explicit Exclusions (What You Must NOT Build)
- **NO Ingestion or CSV Parsing:** Do NOT write CSV loaders or attachment decoders. That is owned by **Person 1**.
- **NO Vector Database or BM25 Implementation:** Do NOT build keyword indexes or vector databases. That is owned by **Person 1**.
- **NO UI / Streamlit Development:** Do NOT build the visual interface. That is owned by **Person 3**.
- **NO Security Permissions / RBAC:** That is owned by **Person 3**.

---

## 4. Relevant Architecture
Person 2 owns **Layer 3 (Conversation Intelligence)** and **Layer 5 (RAG Generation & Verification)**:

```
[From Person 1: Thread Context & RetrievalResult]
        │
  [Layer 3: Conversation Intelligence] (Person 2)
  ├── Lifecycle State Machine (state_machine.py)
  ├── Decision & Approval Extractor (decisions.py)
  ├── Action Item & Owner Extractor (actions.py)
  └── Thread Summarizer & Timelines (summarizer.py)
        │
  [Layer 5: SUTRA RAG Engine] (Person 2)
  ├── Context Assembly & Answer Generator (engine.py)
  └── Citation Verifier & Abstention (verifier.py)
        │
        ▼ Emits RAGAnswer to Person 3 (UI)
```

---

## 5. Files and Directories Owned

| Directory / File | Status | Responsibility |
|---|---|---|
| `sutra/intelligence/state_machine.py` | Active | 7-stage workflow lifecycle state machine |
| `sutra/intelligence/decisions.py` | Active | Decision & approval extractor with scope caveats |
| `sutra/intelligence/actions.py` | Active | Action item, owner, and deadline extractor |
| `sutra/intelligence/summarizer.py` | Active | Structured thread summary and timeline generator |
| `sutra/rag/engine.py` | Active | Grounded answer generation and query routing |
| `sutra/rag/verifier.py` | Active | Span-level citation validation & abstention logic |
| `sutra/models/intelligence.py` | Active (Shared) | `Decision`, `Approval`, `Action`, `ThreadIntelligence` |
| `sutra/models/rag.py` | Active (Shared) | `Citation`, `RAGAnswer` |
| `tests/test_evaluation_cases.py` | Active | Verification test suite for 9 cases and 15 queries |

---

## 6. Detailed Implementation Instructions

### Handling Dataset Edge Cases (Deliberate Traps)
The hackathon dataset includes specific trap cases that separate winning systems:
1. **Approval $\ne$ Authorization (`THR-009`):** PI submits a 3.42L consumables plan. Accounts accepts it *"for budget planning only"*. You must extract status as `budget_planning_accepted` and explicitly record that this is **NOT** purchase authorization.
2. **Partial Schedule Change (`THR-008`):** Exam room changes from Lab 1 to Lecture Hall 4. Date and time (5 Nov at 14:00) **did not change**. The answer must state both what changed and what remained unchanged.
3. **No Pending Action (`THR-004`, `THR-006`, `THR-007`):**
   - UTM is repaired and returned to service (`THR-004`) $\rightarrow$ action is `"none_stated"`.
   - Travel claim is paid and closed (`THR-006`) $\rightarrow$ action is `"none_stated"`.
   - Printers are installed and verified (`THR-007`) $\rightarrow$ action is `"none_stated"`.
   - **Never fabricate a pending action when a matter is resolved.**
4. **Amount Normalization:** Use normalized amounts provided by Person 1's normalizer (`amount_inr=1790000.0`, `amount_formatted="INR 1,790,000"`).
5. **Decisions Not in Last Email:** In `THR-001`, the decision is in `E005` by Dean (Admin), while the PO is issued in `E007`. Maintain the decision authority (`Dean (Administration)`), not the PO issuer.

### Citation Verification (`sutra/rag/verifier.py`)
- For every statement made in `RAGAnswer`, compile a list of cited `email_id`s.
- `verify_citation(email_id, text_span)` must confirm:
  1. `email_id` exists in the dataset.
  2. The cited facts/tokens appear in `email.body` or linked `attachment_data`.
  3. Drop or flag any citation that cannot be verified against the source text.

---

## 7. Task-by-Task Roadmap (Mapped to Master Roadmap)

- **Task 1.2:** Define Intelligence & RAG Extraction Rubrics.
- **Task 3.3:** Implement Decision & Approval Extraction Engine.
- **Task 3.4:** Implement Action & Lifecycle State Engine.
- **Task 3.5:** Implement Thread Summarizer.
- **Task 4.1:** Build Grounded Answer Generator.
- **Task 4.2:** Implement Citation Verification & Abstention.
- **Task 5.1:** End-to-End Pipeline Integration Checkpoint (with Person 1).
- **Task 6.2:** Messy Data & Edge-Case Stress Testing.
- **Task 8.1:** Final End-to-End Verification & Code Freeze.

---

## 8. Interface Contracts (Inputs & Outputs)

### Input Contract: Consumed from Person 1 (`RetrievalResult`)
Person 2 receives a ranked list of `RetrievalResult` objects:
```python
# Provided by Person 1's HybridRetriever:
retrieved_evidence: List[RetrievalResult] = retriever.retrieve(query, top_k=5)
```

### Output Contract: Emitted to Person 3 (`RAGAnswer`)
```python
from sutra.models.rag import RAGAnswer, Citation

answer = RAGAnswer(
    question="What was the final decision on the CNC machine procurement?",
    answer="Vendor B was selected for the CNC turning centre procurement at INR 17.9 lakh. Dean (Administration) approved the procurement on 8 September 2026. Purchase order was issued on 11 September, and delivery and installation remain pending within eight weeks.",
    summary="Quotations evaluated from three vendors; Vendor B approved by Dean (Admin) subject to budget confirmation.",
    direct_decision="Vendor B selected for CNC turning centre procurement",
    approver="Dean (Administration)",
    amount_inr=1790000.0,
    pending_action="Delivery and installation of CNC turning centre",
    citations=[
        Citation(
            email_id="E005",
            thread_id="THR-001",
            evidence_text="Approved. Proceed with Vendor B for INR 17.9 lakh, subject to standard purchase terms and budget confirmation.",
            source_location="body",
            verified=True
        ),
        Citation(
            email_id="E007",
            thread_id="THR-001",
            evidence_text="Purchase order has been sent to Vendor B. Vendor acknowledged receipt and confirmed the eight-week delivery schedule. Delivery and installation remain pending.",
            source_location="body",
            verified=True
        )
    ],
    cited_email_ids=["E005", "E007"],
    confidence=1.0,
    abstained=False
)
```

---

## 9. Testing Requirements
1. `python tests/test_evaluation_cases.py`:
   - Must pass 100% on all 9 evaluation cases (`CASE-001` through `CASE-009`).
2. `python run_eval.py`:
   - Must achieve 15/15 (100%) accurate citations on all sample queries.
   - Must score 25.0/25.0 on RAG accuracy and 30.0/30.0 on extraction/summarization.
3. Abstention Test:
   - Query: `"Who approved the purchase of Apple MacBooks?"` $\rightarrow$ Must return `abstained=True` with `"No matching evidence in corpus"`.

---

## 10. Deliverables
- Working `DecisionExtractor` and `ActionExtractor`.
- `ThreadLifecycleTracker` state machine.
- `ThreadSummarizer` generating full `ThreadIntelligence` objects.
- `SutraRAGEngine` generating grounded `RAGAnswer` instances.
- Robust citation verifier preventing hallucinations.

---

## 11. Definition of Done
- 9/9 evaluation cases extract correct decision, amount, approver, and action.
- 15/15 sample queries answer accurately with exact gold email citations.
- 0 fabricated citations.
- Clean abstention when query cannot be answered from the corpus.

---

## 12. Integration Instructions
- Expose `SutraRAGEngine(emails, summaries)` as the primary service.
- Method `engine.answer_query(query: str) -> RAGAnswer` is called directly by Person 3's UI.

---

## 13. Common Mistakes to Avoid
- **Hallucinating pending actions:** In closed cases (`THR-004`, `THR-006`, `THR-007`), always set `status="none_stated"`.
- **Confusing budget planning with purchase authorization:** Always flag `THR-009` as conditional planning only.
- **Dropping citations:** Every factual claim must carry its supporting `email_id`.

---

## 14. Suggested Development Order
1. Run `python run_eval.py` to inspect the baseline evaluation report.
2. Refine extraction logic in `sutra/intelligence/decisions.py` and `actions.py`.
3. Enhance prompt construction in `sutra/rag/engine.py`.
4. Test edge cases and noisy dataset variants (`Task 6.2`).

