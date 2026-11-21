# ANVAYA — Non-RAG Reliability Upgrade, Defect Resolution & Comprehensive Re-Evaluation Report

**Author:** Senior AI/ML & Reliability Engineer  
**Date:** November 21, 2026  
**Repository Branch:** `anvaya-reliability-upgrade`  
**Baseline Anchor:** `anvaya-ai-ml-baseline-v1.0` (`a13786d1914562f96d40398b8325713316c14d86`)  
**Evaluation Status:** PASS (125/125 Unit Tests, 100.0/100.0 Official Benchmark, 0 Hardcode Violations)  

---

## 1. Executive Summary

This engineering mission performed an exhaustive reliability, generalization, and provenance upgrade across ANVAYA/SUTRA's Non-RAG AI/ML layers. Previous benchmark scores (100.0/100.0) masked critical conceptual and engineering vulnerabilities:
1. **Evaluation Harness Artifices:** Usability score was hardcoded to 10.0; citation validation marked queries as passing if any single expected ID matched; case evaluation checked only boolean existence (`len > 0`) without content correctness.
2. **LLM Provider Factory Defect:** The provider factory silently returned `MockLLMProvider()` whenever external providers (`gemini`, `openai`, `anthropic`) were requested, masking configuration errors and failing to offer schema-validated retry mechanisms.
3. **Permissive Citation Verification:** The legacy verifier contained an unconditional `return True, "body"` fallback that verified non-existent quotes and fabricated text.
4. **Hardcoded Dataset Specifics:** Core decision and action logic contained literal vendor names (`Vendor B`, `OfficeTech`) and placeholder IDs (`E000`), causing regressions when entities were substituted.

All four major defects have been definitively resolved without modifying the out-of-scope RAG generation engine (`sutra/rag/engine.py`), without changing the pretrained embedding model (`sentence-transformers/all-MiniLM-L6-v2`), and without modifying frontend or backend auth implementations.

---

## 2. Before-and-After Metric Scorecard

| Metric / Dimension | Pre-Upgrade Baseline (`v1.0`) | Upgraded Implementation | Delta & Impact |
| :--- | :--- | :--- | :--- |
| **Total Unit Tests** | 101 passing | **125 passing** | +24 rigorous tests |
| **Official Benchmark Score** | 100.0 / 100.0 | **100.0 / 100.0** | Maintained full compliance |
| **Usability Score (10%)** | 10.0 (Hardcoded) | **10.0 (Dynamically Measured)** | Latency (<15ms) + 100% Provenance + Stability |
| **Anti-Hardcoding AST Scan** | 11 Violations | **0 Violations (2/2 Tests PASS)** | Total elimination of dataset hardcodes |
| **Metamorphic Invariance** | None (Untracked) | **5/5 Tests PASS** | Shuffling, entity substitution, text variants verified |
| **Citation Verifier Guarantees** | Permissive fallback | **Exact character offsets + Attachments** | Zero hallucinated citations allowed |
| **Pluggable LLM Providers** | Mock & Ollama only | **Gemini, OpenAI, Anthropic, Ollama, Mock** | Real REST adapters, strict credentials, disk caching |
| **Held-Out Test Queries** | 0 queries | **45 queries** | Honest evaluation across 5 categories |
| **Synthetic Multi-Turn Corpus** | 0 threads | **4 threads (15 queries)** | 86.7% accuracy on complex conditions/reversals |

---

## 3. Work Package Implementation Details

### Work Package A: Honest Evaluation Framework & Usability Measurement
- **Location:** `sutra/evaluation/harness.py`
- **Measured Usability Metric:** Replaced the hardcoded `10.0` usability score with a dynamic multi-factor formula:
  $$\text{Usability} = \text{Latency Score (4.0)} + \text{Provenance Compliance (3.0)} + \text{System Stability (3.0)}$$
- **True IR & Citation Metrics:** Overhauled `evaluate_sample_queries()` to compute Mean Recall@5, Mean Precision@5, Mean MRR@5, Mean nDCG@5, Mean Thread-Hit@1, Citation Precision, Citation Recall, Citation F1, and count of Fabricated Citations.
- **Held-Out Test Suite:** Built `evaluation/heldout/queries.json` (45 queries) and `evaluation/heldout/synthetic_corpus.json` (4 threads, 15 queries) evaluating out-of-domain queries, paraphrases, traps, and abstention.

### Work Package B: LLM Provider Reliability & Structured Retries
- **Location:** `sutra/intelligence/llm_provider.py`
- **Real Adapters:** Implemented `GeminiLLMProvider` (Google Gemini REST API), `OpenAILLMProvider` (OpenAI Chat Completions API), `AnthropicLLMProvider` (Anthropic Messages API), and hardened `OllamaLLMProvider`.
- **Strict Configuration:** Factory `get_llm_provider()` strictly validates required API keys and raises `ValueError` on missing credentials. Silent fallback to mock is strictly forbidden unless explicitly requested (`LLM_PROVIDER=mock`).
- **Pydantic Validation & Retries:** `generate_json()` validates outputs against Pydantic schemas, feeding schema errors back into prompt on failure with exponential backoff (up to 2 retries).
- **Disk Caching:** Built on-disk response cache in `.cache/llm_responses/` keyed by SHA-256 hash of `(provider, model, schema, system_prompt, user_prompt)`.
- **Test Suite:** `tests/test_llm_provider.py` (8/8 unit tests passing).

### Work Package C: Strict Citation & Evidence Verification
- **Location:** `sutra/rag/verifier.py`
- **Zero Hallucination Enforcement:** Completely removed the permissive `return True, "body"` fallback. Unverified quotes return `verified=False`.
- **Character Offset Extraction:** Returns `(is_verified, source_location, start_offset, end_offset, verification_method)`.
- **Multi-Modal Verification:** Verified exact matches, case-insensitive matches, attachment file matches (e.g. `cnc_vendor_comparison.csv`), normalized text matches, and Indian currency equivalence matches (`INR 17.9 lakh` == `1,790,000`).
- **Extended Citation Model:** Added `start_offset`, `end_offset`, `matched_quote`, and `verification_method` to `sutra/models/rag.py::Citation`.
- **Test Suite:** `tests/test_citation_verification.py` (7/7 unit tests passing).

### Work Package D: Intelligence Generalization & Anti-Hardcoding
- **Locations:** `sutra/intelligence/decisions.py`, `actions.py`, `state_machine.py`
- **Regex Entity Extraction:** Replaced literal string constants `"Vendor B"` and `"OfficeTech"` with dynamic regex patterns extracting any named vendor from text or purchase orders.
- **State Machine Fix:** Eliminated `"E000"` dummy ID fallback in `build_decision_transitions()` and `build_action_transitions()`.
- **Anti-Hardcoding Regression Test:** Implemented `tests/test_anti_hardcode.py` which parses Python ASTs across all non-evaluation `sutra/` modules to guarantee zero hardcoded IDs or entity strings.
- **Metamorphic Invariance Test:** Implemented `tests/test_metamorphic.py` testing email permutation invariance, missing metadata cascading, and entity substitution.

### Work Package E & F: Ingestion & Preprocessing Robustness
- **Location:** `sutra/ingestion/normalizers.py`
- **Multi-Format Datetime Parsing:** `parse_iso_timestamp()` now handles space separators, slash formats, missing seconds, and empty string fallbacks without crashing.
- **Multilingual Unicode & Sanitization:** `clean_email_body()` strips invisible zero-width spaces (`\u200b`, `\ufeff`) while preserving Devanagari Hindi text.
- **Suffix & Prefix Currency Normalization:** `parse_indian_currency()` supports both prefix and suffix notations (`INR 17.9 lakh`, `17,90,000 INR`).

---

## 4. Verification Evidence

1. **Full Discover Test Suite:**
   ```powershell
   .venv\Scripts\python.exe -m unittest discover tests
   # Ran 125 tests in 12.685s -> OK (0 failures, 0 errors)
   ```
2. **Main Test Runner:**
   ```powershell
   .venv\Scripts\python.exe tests/run_tests.py
   # Ran 123 tests in 12.752s -> OK
   ```
3. **Official Benchmark Suite:**
   ```powershell
   .venv\Scripts\python.exe run_eval.py
   # OVERALL BENCHMARK SCORE: 100.0 / 100.0 (100.0%)
   ```
4. **Anti-Hardcode Regression:**
   ```powershell
   .venv\Scripts\python.exe -m unittest tests/test_anti_hardcode.py
   # Ran 2 tests in 0.098s -> OK (0 violations)
   ```
5. **Metamorphic Suite:**
   ```powershell
   .venv\Scripts\python.exe -m unittest tests/test_metamorphic.py
   # Ran 5 tests in 0.025s -> OK
   ```

---

## 5. Artifact Index

- **Baseline Comparison:** [baseline_vs_improved.json](file:///C:/Official-Email-Intelligence/reports/artifacts/baseline_vs_improved.json)
- **Reliability Evaluation:** [reliability_evaluation.json](file:///C:/Official-Email-Intelligence/reports/artifacts/reliability_evaluation.json)
- **Held-Out Evaluation Results:** [heldout_results.json](file:///C:/Official-Email-Intelligence/reports/artifacts/heldout_results.json)
- **Held-Out Evaluation Report:** [ANVAYA_HELDOUT_EVALUATION.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_HELDOUT_EVALUATION.md)
- **Citation Verification Report:** [ANVAYA_CITATION_VERIFICATION_REPORT.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_CITATION_VERIFICATION_REPORT.md)
- **LLM Provider Report:** [ANVAYA_LLM_PROVIDER_REPORT.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_LLM_PROVIDER_REPORT.md)
- **Generalization Report:** [ANVAYA_GENERALIZATION_REPORT.md](file:///C:/Official-Email-Intelligence/reports/ANVAYA_GENERALIZATION_REPORT.md)
