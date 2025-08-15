# MVP Execution Plan v1.0

**Owner:** You (PM)\
**Partners:** ChatGPT PM (this chat), Cursor (ASK + AGENT)\
**Audience for MVP:** 4 advisors\
**Target window:** \~2–3 weeks\
**Repo anchors:**

- Source of truth notes: `Docs/Notes/Redesign_Plan_1.md`
- This plan: `Docs/Plan/MVP_Execution_Plan_v1.0.md` (copy this doc there)
- Status tracker: `Docs/Status/STATUS.md`
- Decision log: `Docs/Status/DECISIONS.md`
- Bench results: `Docs/Status/BENCHMARKS.md`

---

## 1) North Star & MVP Scope

### Goals

- **Rock‑solid core**: Monthly performance uploads → clean tables → Asset Class view → Compare view.
- **Simple, repeatable operations**: deterministic seeds, verification, and performance proof‑points.
- **Editable scoring**: Scoring profiles & weights tunable per asset class.

### In-Scope for MVP

- Seed 12 months of EOM data (\~120 recommended funds, 28 benchmarks); optional +400 compare‑only funds.
- Upload flow (CSV→validate→upsert) for **fund\_performance** and **benchmark\_performance**.
- Asset Class table with one primary benchmark row and ranked funds.
- Compare up to 4 tickers (fund vs fund and fund vs benchmark).
- Scoring Profiles UI (select profile per asset class, edit weights; audit saved).
- PDF/CSV export for Asset Class and Compare.
- Performance proof points (bench harness) at target p95 thresholds.
- Minimal RBAC: internal use (9 staff), desktop-first.

### Out of Scope (for now)

-
  > 12 months backfill; automated data vendor integration.
- Non‑recommended fund historical backfill (compare‑only snapshot OK later).
- Mobile polish; multi-tenant; SSO; complex caching.

---

## 2) Acceptance Criteria (what “done” means)

### Upload Flow (Funds & Benchmarks)

- Accepts CSV with required columns; rejects malformed rows with a clear error file.
- Guarantees **EOM dates only**; non‑EOM rejected with guidance.
- Upsert is **idempotent** (re‑upload same file → 0 net changes).
- On success shows a summary: rows inserted/updated/skipped; active month updated.
- Adds an entry in `activity_logs` with user, IP, and counts.

### Asset Class Table

- Given a date (default = **active month**), shows: primary benchmark row (exactly one), top N funds with score, returns (YTD/1y/3y/5y/10y), Sharpe, ER, Up/Down capture, Std Dev (3y/5y).
- Sorting, paging, and CSV export work.
- Score reflects chosen **Scoring Profile** for that asset class.

### Compare View

- Select up to 4 tickers; renders a side‑by‑side table with deltas vs. selected benchmark.
- Export to PDF and CSV.
- Validates tickers and date; helpful error if missing in snapshot.

### Scoring Profiles

- Create/edit **Profiles** (name, description, default flag).
- Add **Weights** by scope: `global`, `asset_class`, `fund` (existing schema). Toggle enabled.
- Assign **Asset Classes → Profile** (stored mapping or convention).
- Persist changes; **Audit** row written to `scoring_weights_audit`.

---

## 3) Data & Performance Baseline

### Seeds (Golden Sample Pack)

- ``: 32 asset classes, 28 benchmarks, \~120 recommended funds (`RJFA001..120`), 12 EOM months (2024‑08‑31 → 2025‑07‑31), optional +400 (`RJX001..400`) compare‑only at 2025‑07‑31. Deterministic ranges; idempotent.
- ``: asserts month coverage, counts, EOM guarantee, primary-benchmark rule, optional 400.

**Commands**

```bash
# Mode A (real-funds-first roster, no +400)
psql "$DATABASE_URL" -c "select set_config('app.golden_pack_use_existing','true',false);"
psql "$DATABASE_URL" -c "select set_config('app.golden_pack_add_extra','false',false);"
psql "$DATABASE_URL" -f seeds/golden_pack.sql
psql "$DATABASE_URL" -f seeds/verify_golden_pack.sql

# Mode B (+400 compare-only at 2025-07-31)
psql "$DATABASE_URL" -c "select set_config('app.golden_pack_add_extra','true',false);"
psql "$DATABASE_URL" -f seeds/golden_pack.sql
psql "$DATABASE_URL" -f seeds/verify_golden_pack.sql
```

### Bench & Verify

- ``: runs RPC latency for 6 APIs with warm‑up and randomized args.
- ``: counts, constraints, EXPLAIN hints, index checks.

**Thresholds (p95, in ms)**

| API                             | Mode A | Mode B |
| ------------------------------- | ------ | ------ |
| get\_funds\_as\_of              | ≤150   | ≤180   |
| get\_asset\_class\_table        | ≤120   | ≤140   |
| get\_scores\_as\_of             | ≤180   | ≤200   |
| get\_history\_for\_tickers (10) | ≤140   | ≤160   |
| list\_snapshot\_counts          | ≤100   | ≤110   |
| get\_compare\_dataset (4)       | ≤120   | ≤140   |

**Run**

```bash
node bench/bench.js --mode=A --url "$SUPABASE_URL" --anon "$SUPABASE_ANON_KEY"
node bench/bench.js --mode=A --url "$SUPABASE_URL" --anon "$SUPABASE_ANON_KEY" --concurrency=1
# repeat for --mode=B after enabling +400
```

**Paste template → **``

```md
## Bench results (date)

Mode A @ concurrency=5
| API | p50 (ms) | p95 (ms) | p99 (ms) | min | max | n | errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
...

Mode A @ concurrency=1
| API | p50 (ms) | p95 (ms) | p99 (ms) | min | max | n | errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
...

Mode B @ concurrency=5
...

Mode B @ concurrency=1
...
```

---

## 4) Environment & Setup (hand‑holding)

> You mentioned you’re not fully set up on Supabase/Vercel; this is the minimal, safe path.

### Supabase

1. Create project; note **Supabase URL** and **anon key**.
2. Run schema (your migrations) → ensure tables match `Docs/Notes/Redesign_Plan_1.md`.
3. **Load seeds** (3. Data & Performance Baseline) and verify.
4. **RLS (Row‑Level Security)**: keep **enabled** by default.
   - For internal app with anon key, expose reads via **RPCs** (Postgres functions) with `SECURITY DEFINER` and explicit grants.
   - Create permissive policies only where you write directly to tables (e.g., uploads via admin).
5. **Grants (example)**

```sql
-- Allow anon to execute read RPCs
grant usage on schema public to anon;
grant execute on function public.get_funds_as_of(date) to anon;
grant execute on function public.get_asset_class_table(date, uuid, boolean) to anon;
grant execute on function public.get_compare_dataset(date, text[]) to anon;
grant execute on function public.list_snapshot_counts() to anon;
-- Keep write RPCs (uploads) restricted to service role only
```

### Vercel (or hosting)

- Set env vars:
  - `REACT_APP_SUPABASE_URL`
  - `REACT_APP_SUPABASE_ANON_KEY`
  - Feature flags: `REACT_APP_DB_ASOF_RESOLVER=true`, `REACT_APP_DB_HISTORY_BATCH=true`, optional `REACT_APP_DB_SCORES=true`.
- Add a protected **Admin Upload** route (simple gate for now: internal network or basic auth while internal).

---

## 5) Sprints & Gates

> Four tight iterations; ship something testable at the end of each.

### Sprint 0 — Baseline (1–2 days)

**Deliverables**

- Seeds loaded (Mode A) + verify passes.
- Bench results captured in `Docs/Status/BENCHMARKS.md`.
- Status and Decisions files created.
- Upload CSV templates exported to `Docs/Plan/templates/`.

**Gate to Sprint 1**: All p95s within thresholds (or noted with mitigation), seeds idempotent.

### Sprint 1 — Upload Flow (2–4 days)

**Build**

- CSV upload UI (funds & benchmarks) → validate → upsert RPCs.
- Error report download; activity log row.

**Gate**: Re‑upload same file = 0 changes; bad file shows clear errors; activity log populated.

### Sprint 2 — Asset Class Table (3–4 days)

**Build**

- Table with primary benchmark row, fund rows, scoring, sort/paginate/export.
- Profile selector per asset class (reads current mapping).

**Gate**: Benchmark row count = 1; export works; p95 within threshold.

### Sprint 3 — Compare (2–3 days)

**Build**

- Pick up to 4 tickers; deltas vs benchmark; export PDF/CSV.
- Optional: enable +400 compare‑only and re‑bench Mode B.

**Gate**: Compare handles mixed fund/benchmark selection; exports; Mode B p95 within thresholds.

### Stretch — Scoring Profiles UI (parallel if time allows)

- CRUD Profiles; edit Weights by scope; assign Asset Classes → Profile; record audit.

---

## 6) Operating Model: ChatGPT PM ↔ Cursor

### Files we’ll maintain

- `Docs/Status/STATUS.md` — live checklist, sprint burndown, blockers.
- `Docs/Status/DECISIONS.md` — ADR‑style log: context → decision → consequences.
- `Docs/Status/BENCHMARKS.md` — paste results from `bench/bench.js`.

### Rules of engagement

- **One Cursor AGENT at a time.** Many **ASKs** okay in parallel.
- Always attach file paths and acceptance criteria in every request.
- After any AGENT push, paste the diff summary into `STATUS.md` and run verify/bench if relevant.

### Starter prompts

**ChatGPT PM — new chat (paste this as message 1)**

```md
You are my project manager and architect for an internal investment‑research app MVP. Your job is to write/critique prompts for Cursor (ASK for research, AGENT for code), keep a status tracker, and gate sprints.

Context files in repo:
- Docs/Notes/Redesign_Plan_1.md — full discovery file
- Docs/Plan/MVP_Execution_Plan_v1.0.md — master plan (this doc)
- Docs/Status/STATUS.md — live status
- Docs/Status/DECISIONS.md — decision log

Constraints:
- Audience: 4 advisors; desktop; fiber; 12 months EOM data; ~120 funds; 28 benchmarks; optional +400 compare‑only.
- Core flows: Upload → Asset Class Table → Compare. Scoring Profiles editable.
- One Cursor AGENT at a time; any number of ASKs in parallel.

What I need from you now:
1) Confirm plan assumptions; 2) Create the first 3 Cursor ASKs below; 3) Prepare the first Cursor AGENT prompt for Sprint 0.
```

**Cursor — ASK #A1 (Bench run)**

```md
Read Docs/Plan/MVP_Execution_Plan_v1.0.md. Run Mode A and Mode B benches per bench/README.md on the current Supabase. Paste the four result tables into Docs/Status/BENCHMARKS.md. If any p95 exceeds thresholds, propose exact index or query fixes.
```

**Cursor — ASK #A2 (Upload CSV templates)**

```md
From our schema, generate two CSV templates (fund_performance, benchmark_performance) with required columns and sample rows; add them to Docs/Plan/templates/. Include a validator checklist in Docs/Plan/templates/README.md.
```

**Cursor — ASK #A3 (Scoring defaults)**

```md
Propose initial scoring profiles and default weights for Equity vs Fixed Income. Create Docs/Plan/scoring_profiles.md with rationale, and populate scoring_profiles + scoring_weights via a migration file.
```

**Cursor — AGENT #G1 (Sprint 0)**

```md
Goal: Baseline environment + seeds + verify + bench.
Tasks:
1) Wire “Seeds” and “Bench” scripts into package.json; add docs in Docs/Plan/.
2) Create Docs/Status/STATUS.md and DECISIONS.md from templates (below).
3) Execute seeds/verify; then run benches and paste results to Docs/Status/BENCHMARKS.md.
4) If any verify/bench check fails, fix with minimal migrations or indexes; document changes.
Acceptance: All verify checks pass; BENCHMARKS.md populated; plan sections cross‑linked.
```

**STATUS.md template**

```md
# STATUS

## Sprint
- Name:
- Dates:
- Goal:

## Checklist
- [ ] Seeds loaded (Mode A)
- [ ] Verify passed
- [ ] Bench Mode A (5 & 1) captured
- [ ] Upload flow implemented
- [ ] Asset Class table implemented
- [ ] Compare implemented

## Blockers
- None

## Notes
-
```

**DECISIONS.md template**

```md
# Decisions

## D-0001 — Primary benchmark index
- Context: Ensure one primary benchmark per asset class with fast lookup.
- Decision: Create unique partial index on asset_class_benchmarks(asset_class_id) where kind='primary'.
- Consequences: Simple join in get_asset_class_table; fewer bugs.
```

---

## 7) Current vs Redesigned (MVP)

### Today (from DB snapshot & notes)

- Single month of performance (2025‑07‑31); \~112 funds in perf table; admin UX is chaotic; manual upload; limited verification.
- Indexes exist but uneven; no formal bench targets; unclear primary benchmark enforcement.

### MVP After Redesign

- 12 months seeded + ongoing monthly uploads (idempotent, EOM‑only).
- Smooth Upload UI with validation and error artifact.
- Asset Class table with **exactly one** benchmark row and ranked funds.
- Compare up to 4, exports (CSV/PDF).
- Scoring Profiles editable; per‑asset‑class mapping; audit trail.
- Verify & Bench scripts with thresholds; results logged in repo.
- Operating discipline: status/decisions tracked; one‑agent flow; ASKs for research.

---

## 8) Risks & Mitigations

- **Env misconfig (Supabase/Vercel)** → Use this doc’s checklist; create `.env.example`; verify via bench script before Sprint 1.
- **Data inconsistencies** → Validator + EOM rule + idempotent upsert; seeds/verify scripts.
- **Performance regressions** → Bench on each sprint gate; keep indexes (`fund_performance(fund_ticker,date)`, `benchmark_performance(benchmark_ticker,date)`, unique partial index on `asset_class_benchmarks(kind='primary')`).
- **Scope creep** → “Out of scope” list; Decisions log for changes.

---

## 9) Next Steps (immediate)

1. Copy this doc to `Docs/Plan/MVP_Execution_Plan_v1.0.md`.
2. Create `Docs/Status/STATUS.md`, `Docs/Status/DECISIONS.md`, `Docs/Status/BENCHMARKS.md` from templates.
3. Open new **ChatGPT PM** chat with the provided starter prompt.
4. In Cursor, open new **ASK** chat and send #A1–#A3; open new **AGENT** chat and send #G1 (after A1 confirms bench environment).
5. After AGENT finishes Sprint 0, review outputs; update STATUS and DECISIONS; proceed to Sprint 1.

---

## 10) Appendix — Helpful Snippets

**Upload RPC pattern (sketch)**

```sql
create or replace function public.upsert_fund_performance(_rows jsonb)
returns jsonb
language plpgsql security definer as $$
-- Validate EOM dates; upsert; return counts
$$;
```

**Primary benchmark partial unique index**

```sql
create unique index if not exists uq_ac_primary
  on public.asset_class_benchmarks(asset_class_id)
  where kind='primary';
```

**Key read indexes**

```sql
create index if not exists idx_fp_ticker_date on public.fund_performance(fund_ticker, date);
create index if not exists idx_bp_ticker_date on public.benchmark_performance(benchmark_ticker, date);
```

**CSV Template columns**

```text
fund_performance: fund_ticker,date,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation_3y,standard_deviation_5y,expense_ratio,alpha,beta,up_capture_ratio,down_capture_ratio,manager_tenure
benchmark_performance: benchmark_ticker,date,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation_3y,standard_deviation_5y,expense_ratio,alpha,beta,up_capture_ratio,down_capture_ratio
```

---

*End of v1.0*

