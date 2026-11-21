# ANVAYA — Held-Out Evaluation & Generalization Benchmark Report

**Date:** November 21, 2026  
**Evaluation Scope:** 45 Held-Out Queries (`evaluation/heldout/queries.json`) & 15 Synthetic Queries across 4 Multi-Turn Synthetic Threads (`evaluation/heldout/synthetic_corpus.json`)  
**Objective:** Honest, un-overfitted measurement of retrieval recall, citation precision, trap avoidance, and abstention calibration.

---

## 1. Held-Out Evaluation Dataset Design

To overcome the risk of benchmark-specific overfitting on the 15 official queries, an independent 45-query held-out benchmark was designed across 5 distinct failure categories:

```
Held-Out Test Set (45 Queries)
├── Paraphrase Queries (10): Rewritten queries testing syntactic/lexical robustness
├── New Thread Inquiries (15): Novel questions probing unqueried parts of the 10 threads
├── Cross-Thread Queries (5): Multi-hop queries requiring synthesis across disparate threads
├── Adversarial Trap Queries (5): Negative/deceptive assertions designed to trigger false approvals
└── Negative / Abstention Queries (10): Unanswerable queries requiring strict abstention
```

### Synthetic Multi-Turn Corpus (4 Threads, 15 Queries)
- **SYN-THR-01 (5 emails):** High-Performance Computing (HPC) cluster procurement. Focus: **Conditional Approval** subject to Finance Committee clearance.
- **SYN-THR-02 (5 emails):** Chemistry Lab Gas Pipeline Renovation. Focus: **Reversed Decision** where safety inspection revokes an emergency work order.
- **SYN-THR-03 (4 emails):** Glassware & Consumables Allocation. Focus: **Budget Planning vs Purchase Authorization** (PRD Case S-12 nuance).
- **SYN-THR-04 (4 emails):** Campus Inter-Hostel Fiber Backbone. Focus: **Currency Variations & Ongoing Discussion** awaiting Director sanction.

---

## 2. Quantitative Results & Category Breakdown

```
Overall Held-Out Accuracy: 37.8% (17 / 45 queries passed)
Synthetic Multi-Turn Accuracy: 86.7% (13 / 15 queries passed)
```

| Category | Total Queries | Passed | Accuracy | Primary Failure Mode & Analysis |
| :--- | :--- | :--- | :--- | :--- |
| **Paraphrases** | 10 | 7 | **70.0%** | Paraphrases of CNC, Fest, UTM, Printer succeeded. Bonafide paraphrase failed due to specific regex anchor expectations in legacy summarizer. |
| **New Thread Queries** | 15 | 5 | **33.3%** | Detailed unprompted facts (e.g. Vendor A quote in comparative statement) successfully retrieved, but generation engine defaulted to thread summary templates. |
| **Cross-Thread Queries** | 5 | 0 | **0.0%** | Cross-thread synthesis requires multi-turn RAG reasoning; existing non-RAG routing restricts synthesis to single-thread context. |
| **Adversarial Traps** | 5 | 2 | **40.0%** | Traps on CNC vendor selection and exam rescheduling correctly rejected. Consumables planning trap partially matched approval language. |
| **Negative (Abstention)** | 10 | 3 | **30.0%** | Completely novel queries with low semantic and keyword similarity correctly abstained. Queries mentioning generic words ('bonus', 'hostel') partially matched. |

---

## 3. Synthetic Multi-Turn Performance Analysis

On the 15 synthetic questions evaluating complex decision states:
- **Conditional Approvals (SYN-THR-01):** SUTRA correctly identified the conditionality (Finance Committee clearance pending) and extracted the INR 42.5 lakh value.
- **Reversed Decisions (SYN-THR-02):** The revocation of FlameSafe's work order was accurately captured; the system did not report the work order as active.
- **Planning vs Authorization (SYN-THR-03):** Correctly distinguished between annual budget planning and direct purchasing authorization.
- **Currency Variations (SYN-THR-04):** Correctly normalized `Rs. 12,75,000` to `12.75 lakh` and `INR 1,275,000`.

---

## 4. Key Engineering Takeaways

1. **Deterministic Fast-Paths vs True Generalization:**
   The official benchmark's 100% score is partially driven by thread-specific fast-path extractors. The held-out benchmark exposes that general natural language queries require multi-thread retrieval and flexible LLM synthesis.
2. **Abstention Calibration:**
   Abstention cannot rely solely on cosine similarity or raw BM25 score. By combining stopword-filtered content token overlap with dense semantic thresholds, false positive responses to out-of-domain queries were significantly reduced.
3. **Cross-Thread Bottleneck:**
   Cross-thread queries cannot be answered by summarization of individual threads. They require hybrid multi-thread evidence retrieval, which is now supported by `HybridRetriever.retrieve_results()`.

---

## 5. Artifact Links

- Held-Out Evaluation Dataset: [queries.json](file:///C:/Official-Email-Intelligence/evaluation/heldout/queries.json)
- Synthetic Corpus: [synthetic_corpus.json](file:///C:/Official-Email-Intelligence/evaluation/heldout/synthetic_corpus.json)
- Evaluation Results: [heldout_results.json](file:///C:/Official-Email-Intelligence/reports/artifacts/heldout_results.json)
