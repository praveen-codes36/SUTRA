# SUTRA (`सूत्र`) — Institutional Email Intelligence Frontend

**SUTRA** (*Every Connection. One Intelligence.*) is a React 19 + TypeScript strict single-page application for turning institutional email archives and attachments into traceable conversations, typed decisions, tracked action items, and evidence-backed answers.

This repository implements the frontend application built against the **Demo Dataset** (`public/assets/aistudio/sutra_demo_data_b75ea19a.json`, copied into `src/data/demoData.ts`) and the **SUTRA FastAPI Backend Contract** (`VITE_API_BASE_URL`, defaulting to `http://localhost:8000/api/v1`).

---

## Setup & Scripts

```bash
npm install
npm run dev        # Starts Vite dev server on http://localhost:3000
npm run lint       # Strict TypeScript check (tsc --noEmit)
npm run build      # Production Vite build to dist/
npx tsx --test src/lib/phase*.test.ts  # Runs Phase 1–7 unit tests
```

---

## Environment Configuration

Copy `.env.example` to `.env` if customising settings locally:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_DATA_MODE` | `demo` | Initial data mode: `demo` (bundled benchmark) or `live` (FastAPI backend). |
| `VITE_ALLOW_MODE_SWITCH` | `true` | Shows or hides the Demo ↔ Live switch tab in Settings. |
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | FastAPI backend base URL (used strictly in `live` mode). |
| `VITE_ROUTER_MODE` | `hash` | `hash` (recommended for iframe previews) or `browser` (`BrowserRouter`). |
| `VITE_ORG_TIMEZONE` | `Asia/Kolkata` | Organisation display timezone (IST by default; UTC always shown in tooltips/toggle). |
| `VITE_REQUEST_TIMEOUT_MS` | `20000` | Standard API request timeout in milliseconds. |
| `VITE_ANSWER_TIMEOUT_MS` | `45000` | Timeout for `POST /answers`. |
| `VITE_UPLOAD_TIMEOUT_MS` | `120000` | Timeout for `POST /ingestion/jobs` multipart XHR uploads. |
| `VITE_MAX_UPLOAD_MB` | `100` | Maximum combined upload size enforced in the CSV pre-check. |
| `VITE_CSRF_HEADER` | `X-CSRF-Token` | CSRF header sent on mutating requests alongside cookie credentials. |
| `VITE_ENDPOINT_<KEY>` | *(built-in paths)* | Optional path overrides (e.g. `VITE_ENDPOINT_ANSWERS=/answers`). |

---

## Demo Mode vs Live Mode

- **Strict separation**: Demo data and Live backend data are never mixed. Live mode never falls back to demo data if a request fails or the backend is offline — when `/health/ready` is unreachable in Live mode, the workspace renders a **Service Unavailable** screen with diagnostic details and a Retry button.
- **No browser LLM calls**: Ask SUTRA never imports or invokes any LLM SDK in browser code. In Demo mode, matched benchmark questions return the pre-authored answers from the demo JSON and unmatched questions show `"Demo corpus only — live synthesis requires the backend."` In Live mode, answers come solely from `POST /answers`.
- **Browser pre-check vs Backend ingestion**: On `/app/import`, CSV validation runs locally via **PapaParse** (`"Browser pre-check (the backend validates authoritatively)"`), while the seven-stage pipeline `Stepper` remains `NOT_STARTED` in Demo mode and updates exclusively from backend `GET /ingestion/jobs/{job_id}` polling (every 2 seconds) in Live mode.

---

## Connecting the FastAPI Backend

All endpoint paths live in `src/config/endpoints.ts` and support runtime `VITE_ENDPOINT_<KEY>` overrides:

- **Auth & Health**: `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /health/ready`
- **Ingestion**: `POST /ingestion/jobs`, `GET /ingestion/jobs`, `GET /ingestion/jobs/{job_id}`, `GET /ingestion/jobs/{job_id}/records`
- **Emails & Threads**: `GET /emails`, `GET /emails/{email_id}`, `GET /threads`, `GET /threads/{thread_key}`, `GET /threads/{thread_key}/summary`, `POST /threads/{thread_key}/summary/refresh`, `GET /threads/{thread_key}/reconstruction`, `GET /topics`
- **Intelligence & Citations**: `GET /search`, `POST /answers`, `GET /answers/{answer_id}`, `POST /answers/{answer_id}/feedback`, `GET /citations/{citation_id}`
- **Ledgers & Attachments**: `GET /decisions`, `GET /decisions/{id}`, `GET /action-items`, `PATCH /action-items/{id}`, `GET /attachments`, `GET /attachments/{id}`, `GET /attachments/{id}/text`, `GET /attachments/{id}/download-url`
- **Analytics & Evaluation**: `GET /analytics/overview`, `GET /evaluation/runs`, `GET /evaluation/runs/{run_id}`

Backend expectations:
- **Cookies & CORS**: Requests use `credentials: 'include'` and expect CORS `Access-Control-Allow-Credentials: true` for your frontend origin. Mutating requests include an `Idempotency-Key` and the `VITE_CSRF_HEADER` header when a CSRF cookie/token is available.
- **Response envelope**: Standard responses return `{ "data": ..., "meta": { "next_cursor": ..., "total_estimate": ... } }` (errors return `{ "error": { "code": "...", "message": "...", "request_id": "..." } }`). `src/adapters/normalisers.ts` also normalises legacy answer payloads and string/object decision conditions.

---

## Router Mode

- `VITE_ROUTER_MODE=hash` (default) uses `HashRouter` so deep links and page refreshes work inside iframe previews and static hosts without server rewrite rules.
- Set `VITE_ROUTER_MODE=browser` when deploying behind a server that serves `index.html` for all app routes.

---

## Known Limitations

- **Live backend not bundled**: End-to-end Live mode execution (authentication cookies, multipart CSV upload processing, 2-second job polling, live RAG answer generation, action item patching, and `GET /evaluation/runs` execution) requires a running SUTRA FastAPI backend at `VITE_API_BASE_URL`.
- **Mailbox connectors**: Live IMAP/Gmail/Outlook sync connectors are intentionally omitted; `/app/import` notes that live mailbox connectors are planned for a later phase.
- **Browser console in Live-offline state**: When `VITE_DATA_MODE=live` is tested with no backend running on port `8000`, Chromium natively logs `net::ERR_CONNECTION_REFUSED` for `/health/ready`; application code handles the network failure cleanly without uncaught exceptions.
- **Template dependency entry**: `package.json` still lists `@google/genai` from the initial workspace template, though it is not imported anywhere in `src/`.

---

## Manual QA Checklist

1. **Landing (`/`)**: Verify headline *"Every Connection. One Intelligence."*, WebGL Hero & Workflow scenes with SVG fallbacks when `3D visuals` is toggled off or `prefers-reduced-motion` is enabled.
2. **Sign In & Personas (`/signin`)**: Sign in with a demo persona (Dean / HOD / Faculty) vs full demo viewer and verify persona banner and unscoped/scoped counts.
3. **Overview (`/app`)**: Check KPI source labels, Scene C Constellation click + list view toggle, and Recent activity tabs.
4. **Email Explorer (`/app/emails`)**: Test search, thread/date/attachment/sender filters persisted in URL, amount normalisation (`INR 17.9 lakh → INR 1,790,000`), and Evidence Drawer attachment tab.
5. **Threads (`/app/threads`, `/app/threads/:threadId`)**: Inspect `THR-001` (Recommendation vs Conditional approval + conditions) and `THR-009` (`E048` Limited-scope acceptance), source highlight scroll, and `Ask about this conversation`.
6. **Ask SUTRA (`/app/ask`)**: Submit *"What happened with the CNC machine procurement?"* (8 claims + citations), inspect Evidence panel & mobile bottom sheet, and submit an out-of-corpus question to confirm refusal/insufficiency handling.
7. **Decisions & Actions (`/app/decisions`, `/app/actions`)**: Confirm summary counts (`14` decisions, `18` actions, `"Not reported by backend"` for In progress / Blocked), filter by `LIMITED_SCOPE_ACCEPTANCE` (`E048`) and `deadline_state` (`MET: 6`, `UNDETERMINED: 3`, `UPCOMING: 1`).
8. **Data Ingestion (`/app/import`)**: Upload CSVs missing `body`, with duplicate `email_id`, and with invalid timestamp; download the CSV error report; verify 7 pipeline steps stay `NOT_STARTED` in Demo mode and benchmark job displays `52 / 0 / 0 / 10 / 11`.
9. **Settings & Evaluation (`/app/settings`, `/app/evaluation`)**: Verify browser-stored preferences (including Sidebar default), read-only Role model & Security state (`"Not available in this deployment"`), Demo ↔ Live confirmation dialog, and official `25/20/15/15/15/10` evaluation rubric.
