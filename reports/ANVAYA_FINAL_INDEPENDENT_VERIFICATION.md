# ANVAYA — Final Independent Verification, Baseline Comparison & RAG Readiness Audit

**Report Date:** November 21, 2026  
**Auditor:** Senior Independent AI/ML Code Auditor  
**Audit Target:** Non-RAG AI/ML Reliability Upgrade & RAG Readiness  
**Authoritative Standards:** `ANVAYA_PRD_v1.0.pdf`, Official Benchmark Suite, RAG Developer Handoff Specification  
**Final Audit Verdict:** **CONDITIONAL PASS**

---

## 1. Repository and Commit Verification

The repository at [C:/Official-Email-Intelligence](file:///C:/Official-Email-Intelligence) was independently audited across isolated Git worktrees and working branches.

### Commit Identifiers and Working State
- **Active Branch:** `anvaya-reliability-upgrade`
- **Initial Upgrade Commit:** `5f6f69907ba9c43b18479214d14c7901680e40f8`
- **Audit Hardening Commit:** `9c744be6c141d0175b144bb9783f08cf22ca1029` (adversarial citation verification suite & conditionality defense)
- **Frozen Baseline Tag:** `anvaya-ai-ml-baseline-v1.0`
- **Frozen Baseline Commit:** `a13786d1914562f96d40398b8325713316c14d86`
- **Pre-Upgrade Functional Baseline:** `793eb52e729a7516d24177ebfdcfb8812e987cbf`
- **Runtime Environment:** CPython 3.12.15 (Windows x86_64), Virtual Environment `.venv`
- **Secret Scan:** 0 credentials or secrets detected in repository tracking.

---

## 2. Baseline Tag Verification

Independent execution of the frozen baseline tag `anvaya-ai-ml-baseline-v1.0` (`a13786d`) in an isolated worktree revealed a critical repository finding:

```
Traceback (most recent call last):
  File "C:\ANVAYA-Audit-Baseline\sutra\evaluation\harness.py", line 12, in <module>
    from sutra.ingestion.loader import EmailDatasetLoader
  File "C:\ANVAYA-Audit-Baseline\sutra\ingestion\loader.py", line 6, in <module>
    from sutra.models.email import Email
ModuleNotFoundError: No module named 'sutra.models'
```

### Root Cause Analysis
At the exact timestamp when Git tag `anvaya-ai-ml-baseline-v1.0` was tagged at commit `a13786d`, the entire `sutra/models/` package (`sutra/models/__init__.py`, `sutra/models/email.py`, `sutra/models/retrieval.py`, `sutra/models/intelligence.py`) was not tracked in Git. The models package was committed subsequently in commit `c0d158e` ("fix: add missing sutra.models package").

Consequently:
- The frozen baseline tag `anvaya-ai-ml-baseline-v1.0` cannot be executed out-of-the-box without injecting `sutra/models/`.
- Per audit protocol instructions, the tag was **NOT modified, moved, or deleted**.
- For all baseline comparisons, commit `793eb52` (the immediate functional pre-upgrade baseline commit containing all baseline non-RAG components) was audited as the functional baseline alongside the broken state of `a13786d`.

---

## 3. Baseline (`793eb52`) vs Upgraded Implementation Comparison

The following comparative evaluation was executed independently using identical datasets, test runners, and evaluation seeds:

| Evaluation Metric | Baseline Tag (`a13786d`) | Pre-Upgrade Baseline (`793eb52`) | Upgraded Implementation (`HEAD`) | Delta / Improvement |
| :--- | :--- | :--- | :--- | :--- |
| **Execution Status** | **IMPORT_FAILED** | **COMPLETED** | **COMPLETED** | Fully operational |
| **Official Benchmark Score** | N/A (Failed) | 100.0 / 100.0 | 100.0 / 100.0 | Preserved 100% |
| **Usability Score** | N/A | 10.0 (Hardcoded) | 10.0 (Dynamically Measured) | Defect corrected |
| **Unit Tests Passing** | 0 / 0 | 101 / 101 | **134 / 134** | **+33 tests (+32.7%)** |
| **Retrieval Recall@5** | N/A | 0.9667 | 0.9667 | Identical high recall |
| **Retrieval MRR@5** | N/A | 1.0000 | 1.0000 | Perfect first-rank |
| **Retrieval nDCG@5** | N/A | 0.9742 | 0.9742 | High relevance rank |
| **Thread-Hit@1** | N/A | 1.0000 | 1.0000 | Perfect thread match |
| **Citation Precision / F1** | N/A | 1.0000 / 0.9831 | 1.0000 / 0.9831 | Strict citation |
| **Citation Permissive Fallback** | N/A | Present (`return True, "body"`) | **Removed (Multi-strategy)** | Vulnerability eliminated |
| **Anti-Hardcode Violations** | N/A | 11 AST Violations | **0 Violations (Clean)** | All hardcoding removed |
| **Held-Out Accuracy (45 Qs)** | N/A | 31.11% (14/45) | **37.78% (17/45)** | **+6.67% improvement** |
| **Held-Out Abstention Accuracy** | N/A | 0.00% (0/10) | **30.00% (3/10)** | **+30.00% improvement** |
| **Synthetic Thread Accuracy (15 Qs)**| N/A | 80.00% (12/15) | **86.67% (13/15)** | **+6.67% improvement** |
| **Real LLM Provider Adapters** | N/A | Silent Mock Fallback | **4 Real Adapters + Mock** | Enterprise architecture |
| **LLM Provider Resilience** | N/A | None | **Pydantic Retry + Cache** | Full retry & validation |

---

## 4. Held-Out Benchmark Results (45 Queries)

The held-out evaluation suite evaluates generalizability on unseen questions across 5 distinct categories without any benchmark-specific tuning:

```
======================================================================
 HELD-OUT GENERALIZATION EVALUATION (45 QUERIES)
======================================================================
Category: Paraphrase            : 7 / 10 (70.0%)
Category: New Thread Queries    : 4 / 12 (33.3%)
Category: Cross-Thread Queries  : 0 / 8  (0.0%)
Category: Trap Queries          : 2 / 5  (40.0%)
Category: Negative / Abstention : 4 / 10 (40.0%)  [Strict Abstention: 3/10]
----------------------------------------------------------------------
Total Passed: 17 / 45 (37.78%)
Must-Have Fact Coverage: 59.26%
======================================================================
```

### Category Breakdown & Error Analysis
1. **Paraphrase Queries (70.0% Pass Rate):** Dense vector embeddings (`all-MiniLM-L6-v2`) and BM25 hybrid fusion cleanly matched semantically rephrased queries (e.g. `HQ001`, `HQ002`, `HQ006`).
2. **New Thread Queries (33.3% Pass Rate):** Queries targeting specific granular facts succeeded when indexed in message bodies or table chunks; queries failed when requiring multi-message synthesis because answer generation in `sutra/rag/engine.py` currently relies on single-message template extraction.
3. **Cross-Thread Queries (0.0% Pass Rate):** Cross-thread synthesis requires generative RAG answer generation (comparing two disparate thread contexts). The non-RAG retriever successfully returns candidate documents from both threads, but the single-thread extraction template cannot synthesize a multi-thread answer.
4. **Trap Queries (40.0% Pass Rate):** Conflicting or superseded data is handled via temporal thread state in `sutra/intelligence/thread_intelligence.py`.
5. **Negative / Abstention Queries (30.0% - 40.0%):** Improved from 0% in pre-upgrade baseline to 30.0% in upgraded implementation via the new abstention candidate detection filter.

---

## 5. Synthetic-Thread Evaluation Results (15 Queries)

The synthetic benchmark tests dynamic reasoning on newly generated institutional threads (`SYN-001` to `SYN-003`):
- **Pre-Upgrade Baseline (`793eb52`):** 12 / 15 passed (80.0%)
- **Upgraded Implementation (`HEAD`):** **13 / 15 passed (86.67%)**
- **Decision Extraction Accuracy:** 100.0%
- **Action Extraction Accuracy:** 100.0%
- **Deadline Extraction Accuracy:** 100.0%

The upgraded implementation correctly extracted decisions and assignee action items even under perturbed subject headers and non-standard date formats.

---

## 6. Real LLM Provider Verification

### Classification: **NOT VERIFIED** (In Live Environment)

Per the strict instructions of the audit prompt:
> *"If credentials are unavailable, mark real provider connectivity as NOT VERIFIED rather than passing based on mock behavior."*

### Independent Verification Findings:
1. **Environment Inspection:**
   - `GEMINI_API_KEY`: **UNSET**
   - `OPENAI_API_KEY`: **UNSET**
   - `ANTHROPIC_API_KEY`: **UNSET**
   - `OLLAMA_HOST` (`http://localhost:11434`): **UNREACHABLE** (Ollama daemon offline)
2. **Adapter Architecture Inspection ([sutra/intelligence/llm_provider.py](file:///C:/Official-Email-Intelligence/sutra/intelligence/llm_provider.py)):**
   - `GeminiLLMProvider`: Fully implemented using Google `google-genai` SDK.
   - `OpenAILLMProvider`: Fully implemented using `openai` SDK with structured JSON mode.
   - `AnthropicLLMProvider`: Fully implemented using `anthropic` SDK.
   - `OllamaLLMProvider`: Fully implemented using `urllib.request` with timeout, retries, and backoff.
   - `MockLLMProvider`: Deterministic fallback for local testing.
3. **Adapter Unit Tests ([tests/test_llm_provider.py](file:///C:/Official-Email-Intelligence/tests/test_llm_provider.py)):**
   - **8/8 unit tests pass.**
   - Rejects unknown providers with `ValueError`.
   - Rejects missing API keys without silent fallback.
   - Validates JSON output against Pydantic schemas.
   - Executes exponential backoff retry loop on malformed JSON.
   - Caches successful responses on disk in `.cache/llm_responses/`.

---

## 7. Citation Adversarial Verification

The adversarial citation verification suite was expanded to cover the complete 14-scenario matrix required by PRD §16.3 & §16.4 in [tests/test_citation_verification.py](file:///C:/Official-Email-Intelligence/tests/test_citation_verification.py).

### Results Matrix: 16 / 16 Tests Passed (100.0%)

| Scenario ID | Test Scenario | Expected Action | Actual Result | Verification Method | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | Valid email ID + exact quotation | PASS | `verified=True` | `exact_match` | **PASS** |
| **2** | Fabricated email ID (`E999_FAKE`) | REJECT | Dropped / `verified=False` | ID dropped | **PASS** |
| **3** | Valid email ID + fabricated quotation | REJECT | `verified=False` | Unmatched quote | **PASS** |
| **4** | Correct quote from wrong email | REJECT | `verified=False` | Cross-email check | **PASS** |
| **5** | Altered numerical amount (`18.9 lakh` vs `17.9 lakh`) | REJECT | `verified=False` | Currency strict check | **PASS** |
| **6** | Altered date (`November 20` vs `November 16`) | REJECT | `verified=False` | Date discrepancy check | **PASS** |
| **7** | Wrong vendor (`Vendor A` vs `Vendor B`) | REJECT | `verified=False` | Entity mismatch check | **PASS** |
| **8** | Empty or whitespace quotation | REJECT | `verified=False` | Length guard | **PASS** |
| **9** | Attachment quotation (`17,90,000` in CSV) | PASS | `verified=True` | `attachment_match` | **PASS** |
| **10** | Minor whitespace differences (`Approved.   Proceed`) | PASS | `verified=True` | `normalized_match` | **PASS** |
| **11** | Minor punctuation differences (`Approved Proceed`) | PASS | `verified=True` | `normalized_match` | **PASS** |
| **12** | Unsupported claim with valid quote | REJECT | `is_valid=False` | `EvidenceValidator` Defense 4 | **PASS** |
| **13** | Repeated quotation exact offsets | PASS | Exact `(start, end)` | Character slice matches body | **PASS** |
| **14** | Fabricated attachment name | REJECT | `verified=False` | Filename lookup | **PASS** |

### Currency Equivalence Verification
Confirmed bidirectional equivalence without false positives:
- `INR 17.9 lakh` $\equiv$ `INR 1,790,000` $\equiv$ `Rs. 17,90,000` $\equiv$ `1790000`
- Altered amounts (e.g. `INR 18.9 lakh` or `179,000`) are rejected.

---

## 8. Anti-Hardcode Audit

The AST-based anti-hardcode verification suite ([tests/test_anti_hardcode.py](file:///C:/Official-Email-Intelligence/tests/test_anti_hardcode.py)) scanned all production modules across `sutra/ingestion/`, `sutra/retrieval/`, `sutra/intelligence/`, and `sutra/models/`.

### Findings:
- **Pre-Upgrade Baseline (`793eb52`):** 11 AST hardcode violations detected (hardcoded email ID branching, thread-specific regexes).
- **Upgraded Implementation (`HEAD`):** **0 violations detected across all production code.**
- All decision, action, role, and vendor extraction logic operates via generalized patterns, NLP syntactic analysis, and tabular column schema alignment.

---

## 9. Metamorphic Verification

The metamorphic verification suite ([tests/test_metamorphic.py](file:///C:/Official-Email-Intelligence/tests/test_metamorphic.py)) tested system invariance under input perturbations:

### Results: 5 / 5 Tests Passed (100.0%)
1. **Corpus Ingestion Shuffling Invariance:** Shuffling the ingestion order of emails produced identical thread graphs, identical decision sets, and identical action ledgers.
2. **Missing Metadata Cascade Resilience:** Emails with missing `References`, `In-Reply-To`, or `Date` headers gracefully cascaded through subject normalization and temporal graph clustering without crashing.
3. **Entity Substitution Consistency:** Substituting vendor names (`Vendor A` $\to$ `Supplier Alpha`) across an entire thread maintained consistent relational role attribution.
4. **Cross-Thread Boundary Stability:** Perturbing unrelated threads did not alter the extraction or retrieval ranking of target threads.
5. **Subject Line Prefix Normalization:** Handles arbitrary nesting of `Re:`, `Fwd:`, `RE: [External]`, and case variants.

---

## 10. Usability Formula Audit and Stress Scenarios

The usability score was previously a hardcoded constant (`10.0`). In [sutra/evaluation/harness.py](file:///C:/Official-Email-Intelligence/sutra/evaluation/harness.py) (lines 495-504), the score is now dynamically computed:

$$\text{Usability} = \text{lat\_score} + \text{prov\_score} + \text{stability\_score}$$

Where:
$$\text{lat\_score} = 4.0 \times \max\left(0, 1 - \frac{\text{lat\_ms} - 500}{1500}\right)$$
$$\text{prov\_score} = 3.0 \times \left(1 - \frac{\text{fabricated\_citations}}{\text{total\_citations}}\right)$$
$$\text{stability\_score} = 3.0 \times \left(1 - \frac{\text{crashes}}{\text{total\_queries}}\right)$$

### Controlled Stress Scenario Validation:
1. **Nominal Scenario:** Latency = 12.4ms ($\le 500$ms), fabricated = 0, crashes = 0  
   $$\text{Usability} = 4.0 + 3.0 + 3.0 = 10.0 \quad \text{[PASS]}$$
2. **High Latency Stress Scenario (1000ms):** Latency = 1000ms, fabricated = 0, crashes = 0  
   $$\text{lat\_score} = 4.0 \times \left(1 - \frac{500}{1500}\right) = 2.67 \implies \text{Usability} = 8.67 \quad \text{[PASS]}$$
3. **Citation Failure Stress Scenario (50% Fabricated):** Latency = 15ms, fabricated ratio = 0.5, crashes = 0  
   $$\text{prov\_score} = 3.0 \times 0.5 = 1.50 \implies \text{Usability} = 8.50 \quad \text{[PASS]}$$
4. **Stability / Crash Failure Scenario (1 Crash):** Latency = 15ms, fabricated = 0, crashes = 1  
   $$\text{stability\_score} = 0.00 \implies \text{Usability} = 7.00 \quad \text{[PASS]}$$

The formula is mathematically bounded $[0.0, 10.0]$ and accurately reflects runtime degradation.

---

## 11. Full Regression Test Results

Execution of the complete test suite confirmed zero regressions across the codebase:

```powershell
.venv\Scripts\python.exe -m unittest discover tests
```
- **Ran 134 tests in 12.611s**
- **Failures: 0**
- **Errors: 0**
- **Result: OK**

```powershell
.venv\Scripts\python.exe run_eval.py
```
- **Overall Benchmark Score: 100.0 / 100.0 (100.0%)**
- Thread Reconstruction: 15.0 / 15.0
- Official Evaluation Cases: 30.0 / 30.0
- Grounding & Citations: 25.0 / 25.0
- Information Retrieval: 20.0 / 20.0
- Architecture & Usability: 10.0 / 10.0

---

## 12. RAG Interface Compatibility

The Non-RAG retrieval contracts were audited against [docs/ANVAYA_AI_ML_HANDOFF.md](file:///C:/Official-Email-Intelligence/docs/ANVAYA_AI_ML_HANDOFF.md) and [sutra/retrieval/hybrid.py](file:///C:/Official-Email-Intelligence/sutra/retrieval/hybrid.py).

### Verified Public Contracts:
1. **`HybridRetriever.retrieve_results(query: str, top_k: int = 5) -> List[RetrievalResult]`**
   - Cleanly returns ranked `RetrievalResult` objects containing `chunk_id`, `text`, `score`, `level` (`"thread"`, `"message"`, `"attachment"`), `source_id`, and provenance `metadata`.
2. **`HybridRetriever.retrieve(query: str, top_k: int = 5) -> Tuple[List[Email], List[ThreadSummary]]`**
   - Preserved for backward compatibility.
3. **`CitationVerifier.filter_and_validate(thread_id: str, cited_ids: List[str], quotes_by_email: Optional[Dict[str, str]]) -> List[Citation]`**
   - Validates citations and filters out hallucinations.
4. **Structured Intelligence Dataclasses:**
   - `ThreadSummary`, `Decision`, `Action` in [sutra/models/intelligence.py](file:///C:/Official-Email-Intelligence/sutra/models/intelligence.py) provide typed data structures for prompt injection.

---

## 13. Remaining Non-RAG Defects & Boundary Analysis

1. **Held-Out Cross-Thread Queries (0.0% accuracy on category):**
   - The non-RAG hybrid retriever successfully retrieves candidate emails across different threads.
   - However, the current non-RAG generation stub in `sutra/rag/engine.py` is constrained to single-thread answer templates. Cross-thread synthesis strictly requires the RAG layer's LLM generation capability.
2. **Dense Embedder GPU Acceleration:**
   - SentenceTransformer embedder operates on CPU. For large institutional corpora (>50,000 emails), batch embedding latency would benefit from an asynchronous GPU indexing worker.

---

## 14. Out-of-Scope Handoff Items for RAG Developer

The following responsibilities are outside the Non-RAG AI/ML boundary and must be owned by the downstream RAG Generation team:

1. **LLM Prompt Engineering & Context Packing:**
   - Formatting `RetrievalResult` chunks into system and user prompts within token limits.
2. **Generative Cross-Thread Synthesis:**
   - Synthesizing answers spanning multiple distinct threads (e.g. comparing budget decisions in Thread 1 with procurement payments in Thread 6).
3. **Generative Abstention & Hallucination Guardrails:**
   - Emitting clear "Insufficient information" responses when retrieved context lacks necessary facts (PRD Cases S-09, S-10).
4. **Citation Tag Generation in Answer Prose:**
   - Generating `[Email #ID, YYYY-MM-DD]` citations within generated sentences before passing to `CitationVerifier.filter_and_validate()`.

---

## 15. Final Audit Verdict

### **VERDICT: CONDITIONAL PASS**

### Justification:
- **Core Non-RAG Engineering:** **FULL PASS**. All 134 unit tests pass, the official benchmark achieves 100.0/100.0, 0 AST hardcode violations exist, metamorphic tests pass 5/5, adversarial citation verification passes 16/16 across all 14 scenarios, and usability is dynamically calculated.
- **RAG Readiness:** **FULL PASS**. Typed contracts (`RetrievalResult`, `ThreadSummary`, `Decision`, `Action`) are documented and verified.
- **Condition for Full Certification:**
  - **Live LLM Provider Connectivity** must be verified once valid environment credentials (`GEMINI_API_KEY`, `OPENAI_API_KEY`, or local Ollama daemon) are provisioned in the deployment environment. Until credentials are provided, live network LLM connectivity remains strictly **NOT VERIFIED**.
