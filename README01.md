# SUTRA — AI-Powered Institutional Email Intelligence Platform

> Transforming fragmented organizational conversations into connected, searchable, and evidence-grounded institutional knowledge.

---

## 📑 Team Documentation & Execution Guides

- 🗺️ **Master Execution Roadmap:** [`docs/team/SUTRA_EXECUTION_ROADMAP.md`](docs/team/SUTRA_EXECUTION_ROADMAP.md)
- 🤝 **Team Coordination & Data Contracts:** [`docs/team/TEAM_COORDINATION.md`](docs/team/TEAM_COORDINATION.md)
- 👤 **Person 1 Guide (Foundation & Retrieval):** [`docs/team/PERSON_1_FOUNDATION_AND_RETRIEVAL.md`](docs/team/PERSON_1_FOUNDATION_AND_RETRIEVAL.md)
- 👤 **Person 2 Guide (Intelligence & RAG Generation):** [`docs/team/PERSON_2_INTELLIGENCE_AND_RAG.md`](docs/team/PERSON_2_INTELLIGENCE_AND_RAG.md)
- 👤 **Person 3 Guide (Product Interface, Security & Demo):** [`docs/team/PERSON_3_PRODUCT_SECURITY_AND_UI.md`](docs/team/PERSON_3_PRODUCT_SECURITY_AND_UI.md)

---

## 1. Project Purpose & Problem Solved

Every educational institution and enterprise generates thousands of emails containing critical decisions, quotations, purchase authorizations, schedule changes, and operational incidents. However, understanding the complete history behind an outcome is difficult:
- **Conversation Fragmentation:** Approvals, purchase orders, and quotations are scattered across separate emails and supporting attachments.
- **Context Loss:** Individual messages rarely reveal whether a request was ultimately approved, amended, executed, or closed.
- **Nuanced Administrative Rules:** Budget planning acceptance is often mistaken for purchase authorization; schedule updates may change venues while preserving dates and times; and completed tasks may be reported as pending if historical messages are misread.

**SUTRA** solves this by establishing an institutional intelligence layer over email conversations: reconstructing chronological threads, extracting decisions and pending actions with formal scope caveats, indexing multi-level evidence (messages, summaries, attachments), and providing evidence-grounded natural-language question answering.

---

## 2. Core Capabilities

1. **Intelligent Ingestion:** Ingests raw email exports with robust UTF-8-sig BOM handling and parses structured tabular (`.csv`) and text (`.txt`) attachments.
2. **Layered Thread Reconstruction:** Groups messages chronologically by thread ID, `in_reply_to` reference trees, and normalized subject slug clustering.
3. **Institutional Role Mapping:** Automatically maps email addresses (`dean.admin@northbridge.edu`) to administrative titles (`Dean (Administration)`).
4. **Deterministic Normalization:** Normalizes dates and Indian numbering denominations (`"INR 17.9 lakh" -> 1,790,000`).
5. **Decision & Action Intelligence:** Detects workflow lifecycle states, approvals with scope qualifiers, and pending tasks with owners and deadlines.
6. **Multi-Level Hybrid Retrieval:** In-memory BM25Okapi keyword search combined with Reciprocal Rank Fusion (RRF) and thread context expansion.
7. **Evidence Grounding & Verification:** Emits direct answers linked to verified source email IDs, preventing hallucinated citations.

---

## 3. Current System Architecture

SUTRA follows a 6-layer modular architecture:

```
[Layer 1: Ingestion & Attachments] (Person 1)
      │ Loads dataset/emails.csv & parses 11 files in dataset/attachments/
      ▼
[Layer 2: Thread Processing & Roles] (Person 1)
      │ Layered thread reconstruction (10 threads) & institutional role resolution
      ▼
[Layer 3: Conversation Intelligence] (Person 2)
      │ 7-stage lifecycle state machine (requested -> approved -> executed -> closed)
      │ Decision & approval extraction (with scope qualifiers)
      │ Pending action & deadline tracking ("none stated" handling)
      ▼
[Layer 4: Hybrid Retrieval & Indexing] (Person 1)
      │ In-memory BM25Okapi index + Reciprocal Rank Fusion (RRF)
      ▼
[Layer 5: SUTRA RAG & Evidence Verification] (Person 2)
      │ Context assembly, grounded answer synthesis, citation validation & abstention
      ▼
[Layer 6: Evaluation & Interface] (Person 1 & 3)
      │ Automated evaluation harness (run_eval.py)
      │ Interactive Streamlit demo UI (sutra/interface/app.py)
```

---

## 4. Repository Structure

```text
Official-Email-Intelligence/
│
├── dataset/                                   # Official benchmark dataset
│   ├── emails.csv                             # 52 messages across 10 threads
│   ├── sample_queries.csv                     # 15 gold queries and reference citations
│   ├── evaluation_cases.csv                   # 9 structured decision & action test cases
│   ├── attachments/                           # 11 supporting documents (.txt and .csv)
│   └── README.md                              # Dataset documentation
│
├── hackathon_docs/                            # Official problem statement & roadmap PDFs
│   ├── problem_statement.pdf
│   └── project_roadmap.pdf
│
├── references/                                # Unmodified technical references
│   ├── mailrag/                               # Extracted mailrag reference repo (Apache 2.0)
│   ├── AI Based Intelligent Email System.pdf
│   ├── Email_Intelligence_Hackathon_Roadmap.md
│   └── readme2.md                             # Original SUTRA vision & concept README
│
├── sutra/                                     # SUTRA Python Library Package
│   ├── __init__.py
│   ├── models/                                # Shared Pydantic contracts (Single source of truth)
│   │   ├── email.py                           # Email, Thread, AttachmentMetadata
│   │   ├── intelligence.py                    # Decision, Approval, Action, ThreadIntelligence
│   │   ├── retrieval.py                       # RetrievalDocument, RetrievalResult
│   │   └── rag.py                             # Citation, RAGAnswer
│   ├── ingestion/                             # Layer 1: Data loader, attachments, normalizers
│   ├── processing/                            # Layer 2: Thread grouping, roles, conversation builder
│   ├── intelligence/                          # Layer 3: Decisions, actions, state machine, summarizer
│   ├── retrieval/                             # Layer 4: BM25, RRF fusion, hybrid retriever
│   ├── rag/                                   # Layer 5: Answer engine, citation verifier
│   ├── interface/                             # Layer 6: Streamlit user interface
│   └── evaluation/                            # Layer 6: Benchmark evaluation harness
│
├── tests/                                     # Unit & integration test suite
│   ├── run_tests.py                           # Zero-dependency test runner
│   ├── test_ingestion.py                      # Ingestion, attachment, and currency tests
│   ├── test_threading.py                      # Thread reconstruction tests
│   └── test_evaluation_cases.py               # Benchmark assertion test
│
├── docs/
│   └── team/                                  # 3-Person Team Execution Documentation
│       ├── PERSON_1_FOUNDATION_AND_RETRIEVAL.md
│       ├── PERSON_2_INTELLIGENCE_AND_RAG.md
│       ├── PERSON_3_PRODUCT_SECURITY_AND_UI.md
│       ├── SUTRA_EXECUTION_ROADMAP.md
│       └── TEAM_COORDINATION.md
│
├── .gitignore                                 # Git ignore rules for Python, IDEs, and local data
├── .env.example                               # Environment template for LLM and embedding keys
├── LICENSE                                    # Apache 2.0 License
├── NOTICE                                     # Attribution notice for mailrag reuse
├── pyproject.toml                             # Package specification
├── requirements.txt                           # Core dependencies
└── run_eval.py                                # One-command benchmark evaluator
```

---

## 5. Technology Stack

- **Core Language:** Python 3.11+ (Windows compatible, standard library prioritized).
- **Data Modeling & Validation:** `pydantic>=2.10.0`.
- **Search & Retrieval:** In-memory BM25Okapi + Reciprocal Rank Fusion (RRF, adapted from mailrag).
- **User Interface:** Streamlit (`streamlit>=1.30.0`).
- **Testing:** Standard library `unittest` (zero external test runner friction).

---

## 6. Installation & Setup Instructions

### Prerequisites
- Python 3.11, 3.12, 3.13, or 3.14/3.15.
- Git.

### 1. Clone & Setup Environment
```bash
# Clone the repository
git clone https://github.com/your-org/Official-Email-Intelligence.git
cd Official-Email-Intelligence

# Create and activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Create and activate virtual environment (Linux / macOS)
# python3 -m venv .venv
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Optional Environment Configuration
If using external LLM APIs (e.g. Gemini, OpenAI) or local Ollama endpoints:
```bash
cp .env.example .env
# Edit .env with your configuration
```

---

## 7. How to Run Tests & Evaluation

### Run the Unit Test Suite:
```bash
python tests/run_tests.py
```
*Executes all 7 foundational unit tests verifying email loading, attachments, currency parsing, role mapping, and thread counts.*

### Run the Evaluation Benchmark:
```bash
python run_eval.py
```
*Evaluates the system against all 15 sample queries and 9 evaluation cases, computing accuracy and citation precision according to the official weighting criteria.*

### Launch the Streamlit Demo Application:
```bash
streamlit run sutra/interface/app.py
```

---

## 8. Team Responsibilities & Ownership

| Member | Role | Primary Modules | Key Deliverables |
|---|---|---|---|
| **Person 1** | **Foundation, Data & Retrieval Engineering** | `sutra/models/`<br>`sutra/ingestion/`<br>`sutra/processing/`<br>`sutra/retrieval/`<br>`sutra/evaluation/`<br>`tests/` | Pydantic contracts, CSV/attachment ingestion, thread reconstruction, BM25, hybrid retrieval, benchmark harness. |
| **Person 2** | **Conversation Intelligence & RAG Generation** | `sutra/intelligence/`<br>`sutra/rag/` | Decisions, approvals, action items, lifecycle tracking, thread summarization, grounded RAG generator, citation verifier. |
| **Person 3** | **Product Interface, Security & Demo** | `sutra/interface/`<br>`docs/` | Streamlit UI, provenance explorer, prompt injection defense, RBAC filtering, architecture visual, 4-minute demo. |

*Detailed execution instructions are in [`docs/team/`](docs/team/).*

---

## 9. Current Implementation Status

To provide an honest and accurate view of the project:

### ✅ Implemented & Verified
- Complete ingestion of official dataset (52 emails, 11 attachments) with UTF-8-sig BOM handling.
- Deterministic Indian currency parsing (`"INR 17.9 lakh" -> 1,790,000`).
- Institutional role directory mapping addresses to formal titles.
- Layered thread reconstruction grouping all 10 threads chronologically.
- Multi-level BM25 keyword index and Reciprocal Rank Fusion (adapted from mailrag).
- Rule-based decision and action extraction capturing dataset edge cases.
- Grounded RAG answer synthesis and sentence-level citation verification.
- Internal evaluation harness scoring 100% on the starter dataset queries and cases.

### 🟡 Partially Implemented (Under Active Development)
- **Streamlit Demo UI (`sutra/interface/app.py`):** Application skeleton and navigation are built; detailed interactive cards and search views are currently being styled by Person 3.
- **RAG Generation Prompting (`sutra/rag/engine.py`):** Rule-based synthesis for starter queries is verified; zero-shot dynamic LLM prompts for unseen threads are being finalized by Person 2.

### ⏳ Planned (Future Phases)
- **Dense Vector Embedding Pipeline:** Connecting local embedding models (e.g. `bge-m3` or Ollama) to complement BM25 in `sutra/retrieval/hybrid.py`.
- **Retrieval-Time Access Control:** Permission filtering restricting evidence retrieval based on user roles.
- **Adversarial & Scale Benchmarking:** Stress-testing retrieval and extraction on 5,000+ synthetic emails with noisy formatting.

---

## 10. Evaluation Criteria & Benchmark Distinction

The hackathon defines the following official evaluation criteria:

| Criterion | Weight | SUTRA Status |
|---|---:|:---:|
| RAG response accuracy & source grounding | 25% | Baseline verified (15/15 queries) |
| Information retrieval accuracy | 20% | Baseline verified (15/15 citations) |
| Thread reconstruction & topic organization | 15% | Baseline verified (10/10 threads) |
| Conversation summarization quality | 15% | Baseline verified (9/9 cases) |
| Decision & action-item extraction accuracy | 15% | Baseline verified (9/9 cases) |
| Usability & practical applicability | 10% | Streamlit app initialized |
| **Total Official Weight** | **100%** | **Evaluation Harness Automated** |

> **Note on Benchmark Metrics:** Running `python run_eval.py` currently outputs `100.0 / 100.0` against the 15 starter queries and 9 starter evaluation cases in the provided synthetic benchmark dataset. This internal test score confirms baseline correctness against known data, but does **not** represent the final hackathon judging score, which will be evaluated independently on hidden test datasets.

---

## 11. Technical Attribution & License

- **License:** SUTRA is licensed under the [Apache License, Version 2.0](LICENSE).
- **Mailrag Attribution:** Portions of SUTRA's retrieval design (Reciprocal Rank Fusion in `sutra/retrieval/fusion.py`, subject normalization in `sutra/processing/threading.py`, and body cleaning insights) are adapted from [mailrag](https://github.com/fmasi/mailrag) by Frederic Masi (Apache 2.0). See [NOTICE](NOTICE). The original mailrag reference repository is preserved unmodified in [`references/mailrag/`](references/mailrag/).