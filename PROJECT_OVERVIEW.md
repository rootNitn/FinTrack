# LifeTrack — Project Overview

A full-stack personal finance and investment management application: track investments (Stocks,
Mutual Funds, Fixed Deposits, PPF, EPF, NPS, Gold, Crypto, Bonds, Real Estate, Cash), expenses,
income, budgets, goals, credit cards, bank accounts, Indian income tax planning, a weighted
Financial Health score, a household wellness (health) tracker, and get AI-style rule-based
insights plus a Groq-backed AI chat assistant — with broker-statement Excel import, live market
data, and scheduled notifications.

This file is the single source of truth for what the app does and how it's put together. Update it
whenever a module or major feature is added/changed.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express, TypeScript, Prisma ORM v5, PostgreSQL |
| Frontend | Angular 19 (standalone components + signals), Angular Material, Tailwind CSS |
| Auth | JWT access + refresh tokens (rotation), bcrypt password hashing |
| Scheduled jobs | `node-cron` |
| Excel import/export | `exceljs` |
| PDF export | `pdfkit` |
| Logging | `pino` / `pino-http` |
| Live market data | Yahoo Finance chart API (stocks/indices), `api.mfapi.in` (mutual fund NAVs, mirrors AMFI data) |
| PWA | Angular Service Worker (`@angular/service-worker`) — installable, works offline for previously-visited pages |

---

## 2. Repository Layout

```
/                       — root workspace (concurrently-based combined dev script)
├── backend/            — Express + TypeScript API (port 4000, routes under /api/v1)
│   ├── prisma/          — schema.prisma, migrations, seed.ts
│   └── src/
│       ├── modules/     — one folder per domain feature (routes, controller, service, dto)
│       ├── jobs/         — node-cron scheduled jobs + scheduler.ts registrar
│       ├── config/       — prisma client, logger, env config
│       └── utils/        — shared helpers (asyncHandler, AppError, etc.)
└── frontend/            — Angular 19 app (port 4200)
    └── src/app/
        ├── features/     — one folder per domain feature (component + service + model)
        ├── core/          — auth, interceptors, base API service, guards
        └── shared/        — shared UI components (data table, dialogs, page header, etc.)
```

### How to run

```bash
npm run install:all   # once — installs backend + frontend deps
npm run db:up          # starts Postgres via docker compose (or run your own local Postgres)
npm run prisma:migrate # applies backend/prisma migrations
npm run dev             # starts BOTH backend (4000) and frontend (4200) in one terminal
```

`npm run dev` (root `package.json`) uses `concurrently` to run `dev:backend` (`tsx watch src/server.ts`)
and `dev:frontend` (`ng serve`) side by side with labeled, colored output — this is the standard way
to start the app locally instead of opening two separate terminals.

---

## 3. Backend Modules (`backend/src/modules/`)

| Module | Responsibility |
|---|---|
| `auth` | Register/login, JWT access + refresh token issuance/rotation, password reset flow |
| `investments` | CRUD for investments, category summary, Excel/PDF export, Excel import (generic template), **live price refresh** (see §6) |
| `investment-import` | Pluggable broker-statement importer framework — detects provider from an uploaded Excel/CSV file (Groww, Zerodha, Upstox), or falls back to a user-driven column-mapping flow for unrecognized/generic CSV files; parses rows, previews, and commits them as Investments + Transactions (see §5) |
| `investment-comparison` | Compares investment vehicles (e.g. FD vs Mutual Fund vs Stocks) using live/periodically-refreshed trailing CAGR rates |
| `transactions` | Ledger of all money movements (buys/sells/SIPs/income/expense/transfers), linked to Investments where relevant |
| `expenses` | Expense tracking with categories and bill-splitting (`ExpenseSplit`) |
| `income` | Income entries |
| `budgets` | Monthly/category budgets with "budget exceeded" alerting |
| `goals` | Savings/investment goals with progress tracking, contribution history, required monthly contribution, projected completion dates, and deadline status |
| `banks` | Bank account management |
| `credit-cards` | Credit card tracking with credit-limit/outstanding/utilization/available-credit calculations, statement and payment history, due-date reminders, rewards, cashback, and billing-cycle support |
| `fd` | Fixed Deposit bank/rate directory, comparison across 13 seeded providers, FD portfolio tracking, maturity notifications |
| `market-rates` | Fetches and caches live equity/index quotes from Yahoo Finance |
| `ai-insights` | Rule-based (non-LLM) financial insights/recommendations engine with explanations and supporting-data links |
| `analytics` | Aggregated analytics/reporting data for dashboards |
| `dashboard` | Combined summary data for the main dashboard view, including the Financial Snapshot and explainable health category scores |
| `reports` | Generates downloadable reports |
| `notifications` | In-app notification center (populated by scheduled jobs) |
| `upcoming-bills` | Aggregates upcoming recurring bills/dues across modules, with due-date metrics, paid actions, and snooze support |
| `settings` | User preferences (display currency, theme, notification prefs, dashboard widget layout), full-account JSON backup/export (`GET /settings/backup`) |
| `admin` | Admin-only endpoints |
| `family-members` | Household member directory (name/relation/color) linked via an optional FK from Expense/Investment/Budget/FdPortfolio/CreditCard/Goal/Liability/InsurancePolicy, with a usage-count check before delete (see §6f) |
| `insurance` | Dedicated CRUD for insurance policies (Health/Life/Other, sum insured, covers-family flag) — same `InsurancePolicy` table Financial Health's Insurance Protection rule reads from (see §6f) |
| `liabilities` | Dedicated CRUD for manual loan/debt tracking (`Liability` model), feeding Net Worth and the Financial Health Debt Health rule (see §6f) |
| `mutual-funds` | Read-only dashboard aggregating Mutual Fund holdings per scheme — XIRR, benchmark rating vs Investment Comparison, long/short-term split (see §6g) |
| `ai-chat` | Groq-backed AI chat widget, grounded in the user's real financial data, with a propose-then-confirm tool-calling security boundary and visible safety guidance (see §6h) |
| `support-tickets` | Help Desk — user-reported ERROR/SUGGESTION/DOUBT tickets, AI-auto-answered doubts, admin respond flow (see §6i) |
| `health` | Standalone wellness tracker (body metrics, vitals, workouts, medications, appointments, health goals, lab report OCR) — unrelated to finance, included for household completeness (see §6e) |
| `tax` | Indian Income Tax calculator & tax-planning module — full old-vs-new regime comparison, DB-driven slabs/rebate/surcharge/cess/deduction rules (no hardcoded values), save/history of calculations, Excel/PDF export, and an admin-only rules-management API (see §6b) |
| `financial-health` | Weighted Financial Health score across 10 categories (Emergency Fund, Debt Health, Savings Rate, Asset Allocation/Rebalancing, Diversification, Retirement Readiness, Goal Funding, Insurance, Tax Efficiency, Investment Discipline) plus non-scored rules-of-thumb benchmarks and a Top-3 Action Plan (see §6d) |
| `financial-level` | 6-tier "Financially Vulnerable → Wealthy" classification built on top of the Financial Health score plus 7 gated progression requirements (emergency fund, savings rate, debt ratio, income dependency, goal progress, FI progress, passive-income coverage), income diversification/passive-income breakdown, and a Financial Independence estimate (see §6k) |
| `business` | Multi-business tracking with a manufacturing-first roadmap; currently includes legacy ledger tracking and the double-entry accounting foundation. See `BUSINESS_TRACKING_PLAN.md`. |

All modules follow the same layered pattern: `*.routes.ts` → `*.controller.ts` → `*.service.ts`
(+ `*.dto.ts` for Zod validation schemas). Routes are mounted under `/api/v1` (see `modules/router.ts`).

---

## 4. Scheduled Jobs (`backend/src/jobs/`, registered in `scheduler.ts`)

| Job | Purpose |
|---|---|
| `recurring-expense.job` | Auto-creates recurring expense entries |
| `recurring-expense-reminder.job` | Reminds about upcoming recurring expenses |
| `budget-exceeded.job` | Notifies when a budget is exceeded |
| `credit-card-due-reminder.job` | Reminds about upcoming credit card payment due dates |
| `birthday-reminder.job` | Birthday reminders (if configured) |
| `sip-reminder.job` | Reminds about upcoming SIP (Systematic Investment Plan) contributions |
| `fd-maturity.job` | Notifies when a Fixed Deposit is nearing/at maturity |
| `fd-portfolio-notifications.job` | FD portfolio related notifications |
| `monthly-summary.job` | Generates a monthly financial summary notification |
| `market-rates-refresh.job` | Refreshes cached live equity/index quotes |
| `investment-comparison-live-refresh.job` | Refreshes trailing CAGR rates used by the Investment Comparison tool |
| `investment-price-refresh.job` | **Refreshes currentNav/currentValue for Stock/Mutual Fund holdings** (see §6) |

---

## 5. Broker Excel Import (pluggable importer architecture)

`backend/src/modules/investment-import/` implements a provider-agnostic Excel import pipeline:

1. User uploads a broker statement `.xlsx` file.
2. `importerRegistry.detect()` inspects the header row of each registered importer's
   `REQUIRED_HEADERS` and picks the matching one (or returns `NONE`).
3. The matched importer's `parse()` converts rows into `ParsedInvestmentRow[]` (name, date, amount,
   units, NAV, transaction type, and optionally `symbol` for equities).
4. The frontend shows a preview (ready / duplicate / invalid rows) before commit.
5. On commit, `importerRegistry.getByKey(providerKey)` resolves the importer again so the correct
   `category` (e.g. `STOCKS` vs `MUTUAL_FUNDS`) and `brokerName` are used when creating the
   `Investment` + linked `Transaction` records — this is resolved dynamically per-importer rather
   than hardcoded, so adding a new importer requires zero changes to the commit logic.

Currently registered importers:
- **`GROWW`** — Groww Mutual Fund order history export.
- **`GROWW_STOCKS`** — Groww Stocks order history export (captures the exchange ticker `symbol`
  per row, used by the live price refresh feature below).
- **`ZERODHA`** — Zerodha Console Tradebook (Equity) export.
- **`UPSTOX`** — Upstox Trade Book export.

Adding a new broker format = adding one new file implementing `InvestmentImporter` and registering
it in `importer-registry.ts` — no other code needs to change.

**Generic CSV / unrecognized formats:** if no importer's `canHandle()` matches, the backend responds
with a `{ code: "UNRECOGNIZED_FORMAT" }` error instead of a hard failure. The frontend import dialog
then calls `POST /investment-imports/columns` to read the file's header row + sample rows, shows a
column-mapping form (map source columns to name/date/amount/units/NAV/symbol/transaction-type, plus
an explicit category picker since it can't be auto-detected), and calls
`POST /investment-imports/parse-mapped` with the mapping to produce the same preview/commit flow as
a recognized importer (`investment-import/importers/generic-csv-importer.ts`).

---

## 6. Live Price Refresh (Stocks & Mutual Funds)

**Problem it solves:** previously, `currentValue`/`currentNav` for investments were static —
whatever was entered manually or at import time — and never updated with real market movement.

**How it works** (`backend/src/modules/investments/investment-price-refresh.service.ts`):
- **Stocks**: looks up the investment's `symbol` (captured during Groww Stocks import, or can be
  set manually) and fetches a live quote from Yahoo Finance, trying the NSE listing (`SYMBOL.NS`)
  first and falling back to BSE (`SYMBOL.BO`) if that fails.
- **Mutual Funds**: fetches the full scheme list from `api.mfapi.in` (a free mirror of AMFI's data —
  AMFI's own `NAVAll.txt` download was retired when their site was rebuilt, so this is the more
  reliable public source as of 2026; cached in-memory for 6 hours) and matches the investment's
  name against scheme names — exact normalized match first, falling back to a best-effort match
  that prioritizes covering all of the investment's name words (recall ≥ 80%, e.g. correctly
  distinguishing a "Direct Plan" scheme from a similarly-named "Regular" one) before fetching that
  scheme's latest NAV from `api.mfapi.in/mf/{code}/latest` (also cached 6 hours).
- Only investments with `units` recorded are refreshed (`currentValue = live price × units`) —
  this is populated automatically for broker-imported holdings; manually-added investments without
  `units`, or Stocks without a `symbol`, are skipped rather than guessed at.
- Each investment's `lastPriceRefreshAt` timestamp is updated on success. Per-row failures are
  logged and counted but don't abort the rest of the batch.

**Where it's exposed:**
- `POST /api/v1/investments/refresh-prices` — manually triggers a refresh for the logged-in user's
  holdings, returns `{ total, updated, skipped, failed }`.
- A **"Refresh Prices" button** (sync icon) on the Investments page toolbar calls this endpoint and
  shows a toast with the result, then reloads the list.
- `investment-price-refresh.job` + `scheduler.ts` run this automatically for **all users** daily at
  18:30 (after market close), independent of anyone visiting the page.

**Known limitation (resolved):** `units` and `symbol` are populated automatically by broker
importers, and the manual "Add Investment" form now also captures `symbol`/`units` directly
(shown for Stocks/Mutual Funds categories) so manually-entered holdings can opt into live price
refresh too.

---

## 6b. Indian Income Tax Calculator (`backend/src/modules/tax/`)

A full tax-planning module comparing the **Old** vs **New** Indian income tax regimes for a given
financial year, with all rates/slabs/thresholds stored in the database rather than hardcoded —
adding/adjusting a financial year's rules (e.g. for a new Union Budget) requires only an admin/DB
change, no code deployment.

**Calculation engine** — Strategy pattern (`tax/calculators/`):
- `TaxCalculator` (abstract base) defines the shared calculation pipeline (gross income → apply
  deductions → slab tax → rebate (Sec 87A) → surcharge → marginal relief → health & education cess).
- `OldRegimeCalculator` / `NewRegimeCalculator` implement regime-specific deduction eligibility and
  slab lookups, both pulling their rules from the DB for the selected financial year.
- Handles salary income (with standard deduction, HRA exemption incl. metro-state list), house
  property income/loss, other income, business income (presumptive), capital gains (simplified
  flat-rate constants per asset type — STCG/LTCG equity & non-equity, informational only, not a
  full securities-transaction-type engine), and Chapter VI-A deductions (80C/80D/80CCD(1B)/80E/80G/
  24(b) etc., each gated by regime eligibility per DB rule).
- Home-loan interest (Sec 24(b)) deduction is currently **informational-only** in the New Regime
  suggestions (New Regime doesn't allow it, but the engine still surfaces it as a suggestion
  reminder if the user has a home loan and picked New Regime).

**Data flow**: `POST /api/v1/tax/calculate` (and `/tax/what-if` for scenario overrides) takes a full
`TaxCalculationInput` and returns a `TaxComparisonResult` (both regimes' full breakdowns +
recommendation + tax-saving suggestions). `POST /tax/save` persists a `TaxCalculationRecord`;
`GET /tax/history` (paginated) and `DELETE /tax/history/:id` manage saved calculations.
`POST /tax/export/excel` and `/tax/export/pdf` generate downloadable reports from a calculation
input (also available per saved history record).

**Admin rules API** (`/api/v1/tax/admin/*`, admin-guarded): full CRUD for `TaxFinancialYear`,
`TaxSlab`, `TaxRebateRule`, `TaxSurchargeRule`, `TaxCessRule`, `TaxDeductionRule`, plus (added in the
Advanced Tax Intelligence extension below) `TaxCapitalGainRule`, `CostInflationIndex`, and
`TaxValidationRule` — this is what keeps all rates/thresholds DB-driven instead of hardcoded in the
calculators.

### 6c. Advanced Tax Intelligence & Tax Planning extension

Builds on §6b with document import/OCR, standalone calculators, a dashboard, reports, AI insights
and a guided filing wizard — all additive to the existing tax module.

**Document import & OCR** (`backend/src/modules/documents/`, `salary-slip/`, `form16/`, `ais/`,
`form26as/`): `POST /documents/upload` stores the raw file **AES-256-GCM encrypted** in Postgres
(`UploadedDocument.contentEncrypted`, via `encryptBuffer`/`decryptBuffer` in `utils/crypto.ts`),
versioned per (user, documentType, financialYear) with a `previousVersionId` chain. Text extraction
(`documents/parsers/text-extractor.service.ts`) routes PDF → `pdf-parse`, JPG/PNG → `tesseract.js`
OCR, XLSX/CSV → `exceljs` — followed by a per-document-type heuristic regex parser
(`SalarySlipParser`/`Form16Parser`/`AisParser`/`Form26ASParser`) implementing a common
`DocumentParser<T>` interface. Each import module (`salary-slip`, `form16`, `ais`, `form26as`)
exposes `POST /import`, `PATCH /:id` (user edits, sets `isEdited=true`), `GET`/`GET :id`/`DELETE`,
and runs DB-driven `TaxValidationRule` tolerance checks (e.g. Gross ≈ sum of salary components)
that surface as non-blocking warnings. `backend/src/modules/reconciliation/` cross-checks AIS vs
Salary Slip sums and Form26AS TDS vs Form16 TDS at an aggregate-tolerance level (no line-item ID
matching, since the source documents share no common transaction IDs) via
`GET /reconciliation?financialYearCode=`. Frontend: `tax-documents` (upload/list/preview/download/
version-history) and `tax-imports` (per-type extracted-field review/edit + reconciliation banner).

**Standalone calculators**:
- **Capital Gains** (`capital-gains/`): `POST /capital-gains/calculate` — multi-transaction/lot-level
  batch input, holding-period classification, DB-driven `TaxCapitalGainRule` rates + `CostInflationIndex`
  indexation, persists `CapitalGainsTransaction` rows. Frontend `tax/capital-gains` page can send its
  computed totals directly into the main Tax Calculator's Capital Gains tab via a small in-memory
  bridge service (`CapitalGainsBridgeService`).
- **HRA / Gratuity / Leave Encashment** (`hra/`, `gratuity/`, `leave-encashment/`): each a dedicated
  `POST /.../calculate` endpoint reusing/extending the existing exemption formulas, surfaced as
  entries on the generic Calculators page (`frontend/src/app/features/calculators/`).
- **Advance Tax** (`advance-tax/`): `POST /advance-tax/calculate` — quarterly payment schedule
  (15%/45%/75%/100% by Jun15/Sep15/Dec15/Mar15) with Section 234B/234C interest, persists
  `AdvanceTaxCalculation`. Frontend `tax/advance-tax` page.
- **Tax Saving Planner** (`tax-planner/`): `POST /tax-planner` analyzes the latest saved
  `TaxCalculation` (or an explicit input) against remaining deduction headroom (80C, NPS/80CCD(1B),
  80D, home loan, 80E, 80G, HRA, employer NPS 80CCD(2)) and returns prioritized structured
  suggestions `{title, description, investmentRequired, potentialTaxSaving, priorityScore}`,
  persisted as `TaxSavingPlan`. Frontend `tax/planner` page (card grid sorted by priority).

**Tax Dashboard** (`tax-dashboard.service.ts`, frontend `tax-dashboard/`) — now the `/tax` landing
route (the original calculator moved to `/tax/calculator`): read-only aggregation of the latest
saved `TaxCalculation`, `Form26ASRecord`, `AdvanceTaxCalculation` and `TaxSavingPlan` for the
selected financial year, plus an **AI Insights** panel.

**AI Insights** (`tax-ai-insights.util.ts`) — rule-based (no LLM), combining: regime recommendation,
Form26AS-vs-computed-liability refund/shortfall detection, reconciliation warnings, and the top 3
Tax Saving Planner suggestions, each tagged `info`/`warning`/`success`.

**Reports** (`tax-reports.service.ts`, `GET /tax/reports` + `/tax/reports/export/{excel,pdf}`): six
report types — Income Summary, Tax Summary (old vs new regime), Capital Gains, TDS Summary, Tax
Saving, Investment Summary — each renderable as a generic table and exportable to Excel/PDF.
Frontend `tax/reports` page (report-type picker + export buttons).

**One-Click Tax Filing Workspace** (`tax-filing-workspace/`, route `/tax/workspace`): a
`mat-stepper` wizard that orchestrates the above features client-side in sequence — (1) upload
documents, (2) run reconciliation checks, (3) jump to the Tax Calculator for regime comparison,
(4) generate Tax Saving Planner suggestions, (5) load the dashboard summary and jump to Reports for
export — without introducing any new backend "god endpoint".

---

## 6d. Financial Health Score (`backend/src/modules/financial-health/`, frontend `financial-health/`)

A single `/financial-health` page (route + sidebar link) that scores the user's overall financial
wellbeing out of 100, deliberately designed to **reuse** the other modules' data rather than
re-implement them — see `FINANCIAL_HEALTH_RULES_PLAN.md` at the repo root for the full design doc,
including a "feature overlap audit" that documents why each rule doesn't duplicate Analytics/
Calculators/Tax Planner/Dashboard.

**10 weighted, scored categories** (`CATEGORY_WEIGHTS` in `financial-health.service.ts`, only
renormalized across categories that currently have data so new ones can be added without breaking
old scores): Emergency Fund (15%), Debt Health (15%), Savings Rate (10%), Asset Allocation/
Rebalancing (10%), Diversification (10%), Retirement Readiness (15%), Goal Funding (10%), Insurance
Protection (5%), Tax Efficiency (5%), Investment Discipline (5%). Each rule returns a status
(`critical`/`warning`/`good`/`na`), a plain-language summary + recommendation, and supporting data
for the UI. A **Top-3 Action Plan** (`topActions`) picks the worst `critical`/`warning` rules
(critical first) to surface as headline next-steps.

**Non-scored benchmarks** ("rules of thumb", explicitly NOT penalized for non-compliance): 50/30/20,
100−Age equity allocation, 60/30/10 asset allocation, Save-the-Raise, Rule of 72/114/144, and a
Financial Independence Ratio.

**Reuses, doesn't duplicate, other modules**: Tax Efficiency reads the user's last-saved
`TaxCalculation` (Tax Planner) instead of recomputing tax; Retirement Readiness and Emergency Fund
rule cards link out to the matching Calculators page for "what-if" exploration instead of building
a second calculator; Net Worth is computed from the existing `MonthlySnapshot` table, not
recalculated. New models: `Liability` (manual loan/debt tracking, `LiabilityType` enum) and
`InsurancePolicy` (`InsuranceType` enum: HEALTH/LIFE/OTHER, sum insured, `coversFamily` flag) — both
have simple CRUD from the Financial Health page. `Setting` gained `targetEquityPercent`/
`targetDebtPercent`/`targetGoldPercent` (rebalancing targets) and `retirementMonthlyExpense`/
`retirementWithdrawalRatePercent` (retirement assumptions), both user-editable inline on the page.

---

## 6e. Health Tracker (`backend/src/modules/health/`, frontend `health/`)

A complete wellness tracker, deliberately unrelated to finance beyond sharing the same app shell —
included here for completeness since it's a full module, not a side feature. Sub-resources, each
with its own routes/service (`body-metrics`, `vitals`, `workouts`, `daily-log`, `medications`,
`appointments`, `health-goals`, `health-reports`, `health-summary`):

- **Body Metrics** — weight/height/BMI (auto-computed)/body-fat/waist, point-in-time logs.
- **Vitals** — blood pressure, blood sugar, heart rate, and generic numeric vitals, filterable by
  type and date range.
- **Workouts** — type (cardio/strength/yoga/sports/etc.), duration, calories, distance.
- **Daily Wellness Log** — one row per user per calendar day: water intake, sleep hours, steps.
- **Medications** — name/dosage/schedule (JSON array of "HH:mm" times)/active flag, plus a separate
  `MedicationLog` adherence table; reminders fire from their own `*/10 * * * *` cron group (not the
  shared daily 07:00 job group) so per-time-of-day reminders actually land close to the scheduled time.
- **Doctor Appointments** — doctor/specialty/date/location/status, with reminders on the shared
  daily 07:00 cron group.
- **Health Goals** — target-seeking metrics (e.g. weight target) use a closeness ratio
  (`min(current,target)/max(current,target)`, capped at 99% until achieved) rather than a naive
  `current/target` percent, since a plain ratio would misleadingly show ≥100% while still far from
  an exact-number goal; `health-goal-sync.util.ts` recalculates progress after any relevant write
  (mirrors the Investment→Goal sync pattern used elsewhere).
- **Health Reports** — lab report upload (PDF via `pdf-parse`, JPG/PNG via `tesseract.js` OCR,
  XLSX/CSV via `exceljs`) → heuristic regex line-parser extracts test name/value/unit/reference
  range → flags each result LOW/NORMAL/HIGH/UNKNOWN, with an LLM-assisted fallback parser when the
  regex pass finds nothing and `GROQ_API_KEY` is configured. `GET /health-reports/compare` trends a
  named test across report history. **Differs from the tax OCR pipeline (§6c)**: only structured
  extracted values are persisted, never raw file bytes (no encryption/versioning needed, minimizing
  retention of sensitive medical documents) — a password-protected PDF that fails once can't be
  "unlocked" later server-side, so the frontend must resend the same file + password together.
- **Health Summary** — one dashboard payload aggregating the latest data from every sub-resource
  above (weight trend, today's wellness log, vital trends, active meds, upcoming appointments, goals).

New `NotificationType`s: `MEDICATION_REMINDER`, `APPOINTMENT_REMINDER`, `HEALTH_GOAL_ACHIEVEMENT`.
Frontend `health-dashboard` hub page links out to one list/form pair per sub-resource, following the
same hub-and-spoke pattern as the `fd`/`tax` modules (each spoke page has an explicit Back button
since it isn't directly reachable from the sidebar).

---

## 6f. Family Members, Insurance & Liabilities

**Family Members** (`family-members/`) model a household: name, relation (e.g. "Spouse", "Son"),
and a UI color. Every `Expense`, `Investment`, `Budget`, `FdPortfolio`, `CreditCard`, `Goal`,
`Liability`, and `InsurancePolicy` row has an optional `familyMemberId` FK (`onDelete: SetNull`), so
removing a member never cascade-deletes their history. `GET /family-members` returns a usage count
per member (how many rows across all 8 linked tables reference them) so the UI can warn before
deletion.

**Insurance** (`insurance/`) and **Liabilities** (`liabilities/`) are plain CRUD modules over the
`InsurancePolicy` and `Liability` models introduced for Financial Health (§6d) — they are the actual
management screens (add/edit/delete a policy or a loan), while Financial Health's Insurance
Protection and Debt Health rules only *read* the same tables to compute a score. Not a duplication:
one is data entry, the other is read-only scoring/guidance.

---

## 6g. Mutual Fund Portfolio Dashboard (`backend/src/modules/mutual-funds/`)

A single read-only `GET /mutual-funds/dashboard` endpoint (no external API calls of its own) that
groups the user's `MUTUAL_FUND` category `Investment` rows by scheme and computes, per fund: **XIRR**
(money-weighted return from all buy/sell lot cash flows), a **Fund Rating** (XIRR vs. the matching
category benchmark CAGR from `investment-comparison`), a long-term (≥1yr) vs short-term (<1yr)
**term split** for tax planning, profit %, and unit count — sorted by current value. Relies entirely
on `Investment.currentValue`/`mfSchemeCode` already kept fresh by the daily
`investment-price-refresh.job` (§6), so the dashboard itself never hits a live NAV API.

---

## 6h. AI Chat Assistant (`backend/src/modules/ai-chat/`)

A Groq-backed chat widget (`ai-chat-widget` component, available app-wide) that grounds every
answer in the user's real financial snapshot (spending, investments, tax situation) injected as
context, with a rolling history of up to 10 prior exchanges. **Function-calling security boundary**:
the model can propose `create_expense`/`create_income`/`create_goal` via an OpenAI-style `tools`
schema, but `sendMessage()` never executes a tool call directly — it returns `{ reply,
proposedAction }` for the frontend to render as a confirm/cancel card. Only an explicit user
confirmation hits `POST /ai-chat/confirm-action`, which re-validates the args against the *same* Zod
DTO schema as the equivalent normal create endpoint before calling the real service method — the AI
only ever proposes, it can't bypass validation or write directly. Falls back to a friendly error if
`GROQ_API_KEY` isn't configured. Also powers Support Tickets' (§6i) auto-answered DOUBT tickets via
a separate non-tool-calling `answerDoubt()` helper.

---

## 6i. Help Desk / Support Tickets (`backend/src/modules/support-tickets/`)

Three ticket types: **ERROR** (bug reports — persisted to DB *and* appended as JSON-lines to
`backend/logs/error-tickets.log` for review without DB access), **SUGGESTION** (feature requests),
and **DOUBT** (questions — answered synchronously on creation via the AI Chat module's
`answerDoubt()`, auto-marked RESOLVED on success, otherwise left OPEN for a human). Status flow:
OPEN → IN_PROGRESS → RESOLVED → CLOSED. Admin routes are mounted at `/support-tickets/admin` (must
be registered *before* the generic `/support-tickets/:id` route, otherwise `id="admin"` gets
swallowed by the user router). Frontend: user-facing list/raise-ticket/view-ticket dialogs plus an
admin list + respond dialog (status + adminResponse), with a "Help Desk" sidebar entry.

---

## 6j. Calculators (`frontend/src/app/features/calculators/`)

A data-driven collection of 19 standalone "what-if" calculators (`calculators.data.ts` — each entry
is just input fields + a `compute()` function producing summary KPIs, an optional chart, and a
breakdown table; no backend calls), organized by category on the `calculator-list` landing page:

- **Investment**: SIP, Step-Up SIP, Lumpsum, SWP, CAGR, ROI, Stock Average Price
- **Loan**: EMI, Home Loan, Personal Loan
- **Savings/Deposit**: FD, RD, Compound Interest
- **Planning**: Retirement, FIRE, Emergency Fund
- **Tax**: Income Tax (simplified new-regime estimate), GST, Inflation

The standalone **Net Worth Calculator** that used to live here was removed during the Financial
Health feature-overlap audit (2026-08-10) — it duplicated the app's own live net worth tracking with
no unique "what-if" value; see `FINANCIAL_HEALTH_RULES_PLAN.md`. Financial Health's Retirement
Readiness and Emergency Fund rule cards (§6d) cross-link to the matching calculator here instead of
re-implementing the same projection twice.

---

## 6k. Financial Level (`backend/src/modules/financial-level/`, frontend `features/financial-level/`)

A single `GET /financial-level/summary` endpoint (own dedicated page + a dashboard summary widget)
that classifies the user into one of **6 tiers** — Financially Vulnerable → Stable → Secure → Strong
→ Independent → Wealthy — built entirely on top of data the app already computes elsewhere (no new
scoring formula duplicated): the tier is driven by the existing Financial Health `overallScore`
(§6d) gated behind **7 pass/fail progression requirements** (`financial-level.util.ts`
`scoreLevel()`): emergency fund ≥ 6 months, positive savings rate, debt-to-income ratio < 35%,
primary income dependency < 75%, at least one goal in "good" funding status, FI progress ≥ 100%, and
passive income covering 100% of expenses — a level is only awarded once its minimum score **and**
every gate below it are satisfied, so a high score alone can't skip past an unmet fundamental (e.g.
no emergency fund).

Also surfaces, from the same `IncomeSourceProfile` data used by Income Sources management:
- **Income diversification** — number of active income sources, and *primary income dependency %*
  (largest single source ÷ total monthly income), labelled Diversified (≤60%) / Moderate dependency
  (60–75%) / High dependency (>75%).
- **Passive income %** — sources with `incomeMode` PASSIVE/SEMI_PASSIVE ÷ total income.
- **Financial Independence estimate** — FI Number = `annual expenses × 25` (the standard 4%-rule
  multiplier, independent of the separately user-configurable retirement withdrawal rate used by
  Financial Health's Retirement Readiness rule — these are two distinct "withdrawal rate" concepts
  in the app, not yet unified), FI progress = current total assets ÷ FI Number.

All figures are computed live from Prisma (`IncomeSourceProfile`, legacy `Income` entries, and the
shared `computeUserNetWorth`) on every request — nothing here is cached or precomputed.

---

## 7. Frontend Features (`frontend/src/app/features/`)


Each folder is a lazy-loaded Angular route with its own list/detail/form components, a
feature-scoped `*.service.ts` (thin HTTP wrapper around `ApiBaseService`), and `*.model.ts` types:

`admin`, `ai-insights`, `analytics`, `auth`, `banks`, `calculators` (see §6j — 19 data-driven
"what-if" calculators), `credit-cards`, `dashboard` (supports **Customize** mode — show/hide and
drag-to-reorder the 8 top-level dashboard sections, persisted per-user via
`Setting.dashboardLayout`), `expenses`, `family-members` (see §6f — member list + usage-count-aware
delete), `fd`, `financial-health` (see §6d — scored rules, Action Plan, Insurance CRUD, retirement
assumptions editor, rebalancing target editor), `goals`, `health` (see §6e — dashboard hub +
body-metrics/vitals/workouts/medications/appointments/health-goals/health-reports spokes), `income`,
`investment-comparison`, `investments` (includes the broker import dialog with a generic-CSV
column-mapping step + import history dialog + the price-refresh button + per-investment
currency/exchange-rate fields for foreign-currency holdings), `mutual-funds` (see §6g — per-scheme
XIRR/rating/term-split table), `notifications`, `reports`, `settings` (includes a "Download Backup"
button — exports the full account as JSON), `support-tickets` (see §6i — raise/view tickets +
admin respond queue), `transactions`, `upcoming-bills`.

Shared building blocks (`frontend/src/app/shared/`): `DataTableComponent` (sortable/paginated
table), `ConfirmDialogService`, `PageHeaderComponent`, toast notifications (`ToastService`), and
currency/file-download utilities (`currency.util.ts` exposes `formatCurrency`/`formatCurrencyAs`
and the app-wide `currencyCode` signal driven by Settings > Currency).

The app is installable as a **PWA** (Angular Service Worker) — see `frontend/ngsw-config.json` —
and works offline for previously-visited pages/data.

**`tax/`** (Income Tax module, see §6b/§6c): `tax.model.ts` / `tax.service.ts` (calculate/what-if/
save/history/export/dashboard), `tax-admin.model.ts` / `tax-admin.service.ts` (rules CRUD incl.
Capital Gain Rules/CII/Validation Rules), and components `tax-dashboard` (landing page — KPIs, AI
Insights, quick links), `tax-calculator` (FY selector + 7-tab input form: Personal/Salary/House
Property/Other Income/Business/Capital Gains/Deductions), `tax-result` (reusable result display),
`tax-save-dialog`, `tax-history`, `tax-admin` (admin-only rules management), `tax-documents` /
`tax-imports` (document upload + extracted-field review + reconciliation), `capital-gains`,
`advance-tax`, `tax-planner` (Tax Saving Planner), `tax-reports`, and `tax-filing-workspace` (the
guided one-click filing wizard). Nav: "Income Tax" (dashboard), "Tax Calculator", "Capital Gains",
"Advance Tax", "Tax Saving Planner", "Tax Filing Workspace", "Tax Reports", "Tax History", "Tax
Documents", "Document Imports", and "Tax Admin" (admin-only) sidebar links.

---

## 8. Data Model Highlights (`backend/prisma/schema.prisma`)

Key models: `User`, `RefreshToken`, `PasswordResetToken`, `Investment`, `ImportHistory`,
`Transaction`, `Expense`, `ExpenseSplit`, `Income`, `Goal`, `BankAccount`, `Category`,
`Notification`, `Setting`, `Budget`, `MonthlySnapshot`, `AuditLog`, `FdBank`, `FdRate`,
`FdRateHistory`, `FdPortfolio`.

`Investment` fields of note: `category` (`InvestmentCategory` enum), `status` (`InvestmentStatus`
enum), `principalAmount`, `units`, `currentNav`, `currentValue`, `symbol` (exchange ticker, used
for live price refresh), `lastPriceRefreshAt`, plus broker-import provenance fields
(`source`, broker name, import batch reference).
Fixed Deposit investments additionally store tenure value/unit, annual interest rate, compounding
frequency, payout type (cumulative, monthly, or quarterly), and the calculated maturity amount/date;
these values are calculated server-side using the shared FD calculation utility.

**Tax module models** (see §6b): `TaxFinancialYear` (code, label, assessment year, date range,
`isDefault`/`isActive`), `TaxSlab` (regime, age category, order, min/max income, rate),
`TaxRebateRule`, `TaxSurchargeRule`, `TaxCessRule`, `TaxDeductionRule` (all scoped to a financial
year + regime, so multiple years' rules coexist and nothing is hardcoded), and
`TaxCalculationRecord` (a user's saved calculation — input snapshot + computed comparison result +
optional label). Enums: `TaxRegime`, `TaxAgeCategory`, `TaxGender`, `TaxResidentialStatus`,
`TaxEmploymentType`, `TaxHousePropertyType`.

**Advanced Tax Intelligence models** (see §6c): `UploadedDocument` (encrypted file bytes, checksum,
version chain, `TaxDocumentType`/`TaxDocumentStatus` enums), `SalarySlipRecord`/`Form16Record`/
`AisRecord`/`Form26ASRecord` (extracted fields + `isEdited` + `rawExtractedJson` audit snapshot +
`validationWarnings`), `CapitalGainsTransaction` (`CapitalGainAssetType`/`CapitalGainTermType`
enums), `AdvanceTaxCalculation`, `TaxSavingPlan` (snapshot pattern mirroring
`TaxCalculationRecord`), and the admin-managed `CostInflationIndex` / `TaxCapitalGainRule` /
`TaxValidationRule` (replace what used to be hardcoded constants/messages).

`currency` (ISO 4217, default `"INR"`) and
`exchangeRate` (default `1`) support recording a holding purchased in a foreign currency —
`principalAmount`/`currentValue` always stay in the account's base currency (so existing
sums/aggregates/reports are unaffected), while `currency`/`exchangeRate` are informational,
letting the UI show back the original foreign-currency amount for transparency.

`GoalContribution` stores dated goal contribution amounts and optional notes. Goal API responses
also include a projected completion date based on recent contribution history, the required monthly
contribution to meet the deadline, and an `ACHIEVED`/`ON_TRACK`/`AT_RISK`/`BEHIND`/`OVERDUE` status.
`Expense.paidDate` and `Expense.snoozedUntil` track bill actions, while recurring
expenses advance to their next scheduled occurrence after payment. `CreditCardStatement.snoozedUntil` supports
`CreditCardStatement.snoozedUntil` supports temporarily hiding a statement from Upcoming Bills.

`Setting.dashboardLayout` (`Json`, default `[]`) stores an array of
`{ id: string, visible: boolean }` describing per-user dashboard widget order/visibility; an empty
array means "use the app default" (all 8 sections, default order).

The dashboard's Financial Snapshot shows net worth, current-month net cash flow, investments, cash,
debt, and savings rate from existing dashboard and Financial Health data. Its Financial Health Score
breakdown shows Savings, Debt, Investments, Emergency Fund, Insurance, Goals, and Credit scores;
the first six reuse the existing weighted Financial Health rules, while Credit is derived from total
credit-card utilization. Missing source data is displayed as unavailable instead of being treated as
a zero score.

**Financial Health models** (see §6d): `Liability` (`LiabilityType` enum — manual loan/debt
tracking, feeds Net Worth and the Debt Health rule) and `InsurancePolicy` (`InsuranceType` enum:
HEALTH/LIFE/OTHER, sum insured, `coversFamily` flag — feeds the Insurance Protection rule). `Setting`
gained `targetEquityPercent`/`targetDebtPercent`/`targetGoldPercent` (nullable, user-editable
rebalancing targets) and `retirementMonthlyExpense`/`retirementWithdrawalRatePercent` (nullable,
user-editable retirement assumptions).

**`FamilyMember`** (see §6f): name/relation/color, referenced by an optional `familyMemberId` FK on
`Expense`/`Investment`/`Budget`/`FdPortfolio`/`CreditCard`/`Goal`/`Liability`/`InsurancePolicy`
(`onDelete: SetNull`).

**`SupportTicket`** (see §6i): `type` enum ERROR/SUGGESTION/DOUBT, `status` enum
OPEN/IN_PROGRESS/RESOLVED/CLOSED, plus nullable `aiResponse`/`adminResponse`/`errorContext` (Json).

**Health Tracker models** (see §6e): `BodyMetricLog`, `VitalLog`, `WorkoutLog`,
`DailyWellnessLog` (unique per user+date), `Medication` + `MedicationLog`, `DoctorAppointment`,
`HealthGoal`, `HealthReportDocument` + `HealthReportResult` (extracted lab values only — raw file
bytes are never persisted, unlike the encrypted tax `UploadedDocument`).

---

## 9. Known Gaps / Possible Future Improvements

Roughly in priority order (from an earlier product review):

1. ~~Live price refresh for Stocks/Mutual Funds~~ — **done** (see §6).
2. **Auth hardening**: password-reset emails use optional Resend delivery when `RESEND_API_KEY`,
  `EMAIL_FROM`, and `FRONTEND_URL` are configured; no 2FA or account lockout is wired up yet.
3. ~~Import/export breadth~~ — **mostly done**: Zerodha and Upstox importers added, plus a generic
   CSV import with user-driven column mapping for any unrecognized broker format (see §5). Manual
   investment entries now also capture `symbol`/`units` (see §6). ICICI Direct and other brokers
   would still need their own importer implementations following the existing pluggable pattern.
4. **Testing/DevOps**: no CI pipeline, limited automated test coverage. ~~No production deployment
   setup~~ — a free single-service deployment path now exists (see §10); still no CI pipeline or
   containerized (Docker) production build.
5. ~~UX/product depth~~ — **mostly done**: the app is installable as a PWA and works offline (§7),
   a full-account JSON backup/export **and restore** is available from Settings (
   `GET /settings/backup` / `POST /settings/restore`), dashboard sections can be
   shown/hidden/reordered per user (§7), and investments can record a foreign purchase
   currency + exchange rate (§8, informational — `principalAmount`/`currentValue` still store the
   account's base-currency equivalent so aggregates stay correct). Still open: no true multi-currency
   *conversion* across the whole app (Expenses/Income/Transactions remain single-currency, and
   there's no live FX-rate lookup — the exchange rate is entered manually at entry time), and the
   financial year is still hardcoded to India's April–March (no `country`/configurable fiscal-year
   setting).
6. **Advanced Tax Intelligence extension** (§6c) known limitations: OCR only works well on
   text-layer PDFs (`pdf-parse`) and true JPG/PNG images (`tesseract.js`) — scanned/image-only PDFs
   with no embedded text layer won't extract cleanly, since no PDF-to-image rasterization library
   (Poppler/canvas) is installed; `tesseract.js` also downloads ~10-15MB of language data on its
   first OCR call (needs network access unless pre-bundled). Reconciliation (AIS vs Salary Slip,
   Form16 vs Form26AS) is aggregate-tolerance only, not line-item/transaction-ID matching, since the
   source documents don't share common transaction IDs. No automated test suite was added for this
   extension either, consistent with the rest of the project's browser-based verification approach.
7. **Full feature-review audit (2026-09-25)** — a P0/P1/P2/P3 gap analysis across every module;
   P1 and P2 items are now **done**: liability EMI/amortization schedule + prepayment-impact what-if
   (`GET/POST /liabilities/:id/{amortization,prepayment-impact}`), FD premature withdrawal + renewal
   (`POST /fd/portfolio/:id/{premature-withdrawal,renew}`), onboarding wizard answers now persist
   (income source + budget), unguarded Financial Health delete actions now confirm, insurance
   renewal reminders fire off the policy's own `renewalDate`/`expiryDate` directly (plus `nominee`
   field), manual expense/income entry now flags same-day/amount/category duplicates (409, override
   with `force:true`), Expense/Income Excel export, credit card reward-points/cashback now
   auto-accrue from a configurable per-card rate, and account deletion (`DELETE /auth/account`).
   Remaining P3 items: a dedicated Angel One/ICICI Direct importer (deferred — no real sample export
   to build/verify a parser against, unlike Groww/Zerodha/Upstox; use the generic CSV column-mapping
   importer for now), and a live FX-rate lookup for true multi-currency conversion.

## 10. Deployment (Free Hosting)

The backend ([app.ts](../backend/src/app.ts)) serves the Angular production build directly when
`frontend/dist/frontend/browser/index.html` exists next to it, so the whole app deploys as **one**
free Node web service (no CORS/proxy setup needed — the frontend already calls the relative
`/api/v1` path, see `environment.production.ts`).

**Recommended free stack (no credit card required):**

1. **Database** — [Neon](https://neon.tech) or [Supabase](https://supabase.com) free Postgres.
   Copy the connection string into `DATABASE_URL`.
2. **App host** — [Render](https://render.com) free Web Service, using the `render.yaml` Blueprint
   at the repo root (New → Blueprint → select this GitHub repo). It runs:
   - Build: `npm run install:all && npm run build` (builds backend, then frontend into
     `frontend/dist/frontend/browser`).
   - Start: `npm run start` (runs `prisma migrate deploy`, then `node dist/server.js`).
   - Health check: `GET /health`.
3. Fill in the env vars Render leaves blank: `DATABASE_URL`, `CORS_ORIGIN` (set to the Render URL
   itself, e.g. `https://finance-tracker.onrender.com`), `ACCOUNT_NUMBER_ENCRYPTION_KEY` (generate
   with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`), and optionally
   `GROQ_API_KEY` for the AI chat widget.

**Known caveats of this free setup:**

- Render's free plan spins the service down after ~15 min idle and wipes its local disk on every
  redeploy/restart — uploaded receipts/documents (multer disk storage) and anything the cron jobs
  wrote will not persist. Acceptable for a personal/demo deployment; move to object storage (e.g.
  Cloudinary free tier) if persistence matters.
- The `node-cron` jobs in `scheduler.ts` only run while the process is awake — pinging `/health`
  periodically with a free uptime monitor (e.g. UptimeRobot, cron-job.org) keeps the service alive
  so scheduled jobs actually fire.

## 11. Finance Modules — Data Integrity & UI/UX Review

A full-app audit (P0 calculation correctness, data integrity, AI safety, sensitive-data exposure;
P1 core-UX gaps; P2 polish) covering every finance + investment module. Fixed items are marked
**FIXED**; everything else is a documented, not-yet-addressed finding.

### P0 — Critical (calculation correctness & data integrity)

- **FIXED — Bank account balance never synced with linked expenses/income.** `BankAccount.balance`
  is a stored field; creating/updating/deleting an `Expense`/`Income` linked via `bankAccountId`
  never adjusted it (confirmed by code search — the only `bankAccount.update` call in the whole
  backend was the manual "edit account" endpoint). This silently inflated Net Worth and the Bank
  Accounts page balance over time. Fixed in `expenses.service.ts` / `income.service.ts` (create,
  update, remove) and the `recurring-expense.job.ts` / `recurring-income.job.ts` auto-generation
  jobs, via a new shared `adjustBankAccountBalance()` helper
  (`backend/src/utils/bank-account-balance.util.ts`), all inside the existing `$transaction`.
- **FIXED — Month-end date-math bug causing recurring dates to drift forward.** `addInterval()`
  (duplicated in `recurring-expense.job.ts`, `recurring-income.job.ts`, `recurring-investment.job.ts`,
  `expenses.service.ts`, `income.service.ts`) and `nextMonthlyOccurrence()` (in
  `upcoming-bills.service.ts`, used for SIP due-dates) used raw `Date.setMonth()`, which overflows
  for day-29/30/31 (e.g. Jan 31 + 1 month → Mar 3, not Feb 28) — a recurring bill/SIP on the 31st
  would drift forward a few days every single cycle and never return to its real day. Centralized
  into `backend/src/utils/recurrence.util.ts` (`addMonthsClamped`, `addRecurrenceInterval`,
  `nextMonthlyOccurrence`) with proper month-end clamping, unit-tested
  (`recurrence.util.test.ts`, 9 tests), and wired into all 6 call sites above.
- **FIXED — Credit card `round2()` used a different rounding algorithm than every other module**
  (`Math.round(v*100)/100` vs `.toFixed(2)` elsewhere) — aligned in `credit-cards.util.ts`.
- **FIXED — One delete action had no confirmation dialog**: FD interest rate rows in
  `fd-rate-manager-dialog.component.ts` deleted immediately on click; now wrapped in the standard
  `ConfirmDialogService` pattern used everywhere else.
- **Verified correct (no bug)**: Goals progress % (`computeGoalProgress`), Credit Card outstanding
  balance / utilization % / statement status (`credit-cards.util.ts`), pagination `total`/`count`
  consistency (every paginated list endpoint's `count()` uses the identical `where` clause as its
  `findMany()` — checked expenses, income, investments, transactions, admin users/audit-logs,
  support tickets, tax calculations), XIRR (Newton-Raphson + bisection, already centralized in
  `backend/src/utils/xirr.util.ts`, unit-tested), Mutual Fund invested/current/gain/XIRR (see §6g /
  earlier session — cross-checked against manually recomputed CAGR, exact match), AI recommendation
  freshness (every AI feature queries Prisma live at request time, no caching), AI action
  confirmation (ai-chat's `proposedAction` flow requires an explicit "Confirm" button click — no
  AI feature auto-executes a mutation), and bank/card number masking (encrypted at rest with
  AES-256-GCM, only `••••1234`-style masked values ever appear in API responses — confirmed by
  reading the actual `serializeBankAccount`/`serializeCard` response-building code).
- **NOT fixed — 20 delete confirmations already correct**, confirmed present across
  banks/credit-cards/expenses/family-members/fd/goals/health/income/investments/notifications/tax.
- **FIXED — `Transaction` ledger rows could go stale/orphaned.** Added nullable `sourceType` and
  `sourceId` links for expense/income rows, safely backfilled only unambiguous one-to-one historical
  matches, and synchronize/delete linked ledger rows inside the existing expense/income database
  transactions. Recurring rows are linked as they are generated. Ambiguous legacy rows, investment
  sells and transfers remain read-only; expense, income and investment-buy rows reuse their source
  edit forms. Investment-buy mirror rows update/delete with their Investment in the same transaction.
  Transaction Excel export uses the active list filters.
- **NOT fixed — `round2()` duplicated in ~10 backend files** (ai-insights, budgets, expenses,
  fd-calculation, financial-health, investment-comparison, live-return, market-rates, mutual-funds,
  plus the now-fixed credit-cards one) instead of importing the one in
  `finance-calculations.util.ts`. Purely cosmetic/maintenance risk (all now compute the same
  result) — not consolidated to avoid touching many working files for zero behavior change.
- **FIXED — app currency preferences were bypassed by shared display helpers.** Calculator money,
  tax import/admin values, FD admin/comparison amounts, dashboard market-index numbers, AI proposed
  amount summaries and cashback display now use the shared currency/locale formatters. Remaining
  explicit INR formatting is limited to public INR pricing/defaults; Health measurement values and
  dates use locale formatting without a currency symbol.
- **FIXED — analytics date boundaries and timezone-sensitive buckets.** Income/expense queries use
  the requested upper bound; date-only end filters include the whole UTC day, invalid calendar dates
  are rejected, and analytics month/day grouping and snapshot boundaries use UTC. Focused tests cover
  end-of-day inclusion, impossible/reversed ranges, UTC buckets, leap-month boundaries and rolling
  range starts.
- **NOT fixed — `monthsBetween()` in `ai-insights.util.ts`** (goal "required monthly contribution")
  ignores day-of-month (Jan 31 → Feb 1 counts as 0 months, clamped to a minimum of 1 by the caller,
  so no crash/division-by-zero — just a slightly-off number right at a month boundary). Left as-is;
  same-severity class as the Analytics date-boundary item above.

### P1 — Core UX (status of items from the review checklist; none newly built this session)

| Item | Status |
|---|---|
| Mutual Fund detail page, transaction/SIP history, filter/sort/search | **Done** (see §6g) |
| Transaction detail/edit flow | **Partial** — source-linked expense/income/investment-buy rows reuse their edit forms; investment sells and transfers remain read-only |
| Transaction export | **Done** — filtered Excel export |
| Expense recurring transactions | Done — `Expense.isRecurring`/`recurrenceInterval` + job |
| Expense category breakdown | Done — `expensesService.getSpendingTrends()` `byCategory` |
| Income filtering and recurring income | Done — filters in `income.service.ts` `list()`; recurring via job |
| Bank Account detail and transaction history | **Done** — masked account detail and paginated transaction history |
| Credit Card statement history | Done — `getById()` returns `statements[]` |
| Credit Card payment tracking | Done — `recordPayment()` + payments list |
| Credit Card rewards/cashback details | Done — `rewardPointsBalance`/`cashbackBalance` tracked |
| Goal contribution history | **Done** — dated amount/note records are stored in `GoalContribution` and shown in a history dialog |
| Goal projected completion date | **Done** — estimated from recent contribution history and shown in the Goals table |
| Upcoming Bill mark-as-paid flow | **Done** for recurring EMI/insurance expenses and credit-card statements |
| Upcoming Bill snooze flow | **Done** — seven-day snooze for actionable EMI/insurance and credit-card items |
| Upcoming Bill recurring schedule | Done (this session's date-math fix improves its accuracy) |
| Notifications/reminders | Done — dedicated Notifications module + preferences in Settings |
| Analytics date-range selector | **Done** — optional start/end dates filter transaction and snapshot charts |
| Analytics chart drill-down | **Partial** — category charts navigate to filtered expense/investment routes |
| Analytics export | **Done** — date-filtered CSV, Excel workbook and PDF exports |
| AI insight explanation/source links | Partial — rating/benchmark tooltips exist (Mutual Funds); AI Insights/AI Report have no "why"/source links back to the underlying transactions |

### P2 — Polish (status)

| Item | Status |
|---|---|
| Standardize date formatting | Mostly done — shared `shared/utils/date.util.ts`, but not universally used |
| Standardize currency formatting | **Mostly done** — shared preference-aware helpers cover audited money/number displays; public INR pricing/defaults and non-currency measures remain explicit |
| Standardize empty/loading/error states | Mostly done — shared `EmptyStateComponent`/`SkeletonLoaderComponent` used broadly |
| Standardize table pagination | Done for financial list modules (see P0 pagination check); several non-financial modules (health, family members, banks, FD, credit cards, goals, budgets) have no pagination (small/bounded lists, likely intentional) |
| Consistent confirmation dialogs | Done — one shared `ConfirmDialogService` pattern, only 1 gap found (fixed above) |
| Consistent tooltip/help text | Not audited this session |
| Responsive table behavior | Partial — Analytics YoY table uses horizontal overflow; full-app review remains open |
| Accessibility audit | **Partial** — Playwright used the seeded admin and checked visible main-content buttons for accessible names on Transactions, Banks, Analytics, Journal Approvals, and FD Portfolio; a complete screen-reader/contrast audit remains open |
| Keyboard navigation | **Still open** — no full keyboard-only workflow audit has been run |
| Mobile/tablet layout review | **Partial** — Playwright checks passed at 390px and 1280px without document horizontal overflow on Transactions, Banks, Analytics, Journal Approvals, and FD Portfolio; remaining routes and physical devices still need review |

---


*Last updated: filled in documentation gaps for modules that existed in the codebase but were
missing from this file — Health Tracker (§6e), Family Members/Insurance/Liabilities (§6f), Mutual
Fund Portfolio Dashboard (§6g), AI Chat Assistant (§6h), Help Desk/Support Tickets (§6i), and the
full 19-calculator Calculators list (§6j) — plus their models in §8 and entries in the §3/§7
module tables. Before that: the Financial Health Score module (§6d) — 10 weighted scoring
categories, a Top-3 Action Plan, Insurance/Liability CRUD, and retirement/rebalancing assumption
editors — followed by a feature-overlap audit (trimming duplicate Dashboard widgets, removing the
redundant Net Worth Calculator, cross-linking Calculators from Financial Health, and tightening Tax
Efficiency copy to point at the Tax Planner instead of re-deriving tax), and a live Playwright UI
QA pass that found and fixed a Tax Efficiency "0% savings" division bug and a recurring NG0100
routing-animation console error. Before that: the Indian Income Tax Calculator & Tax Planning
module (§6b) — DB-driven old-vs-new regime comparison engine, save/history, Excel/PDF export, and
an admin rules-management UI — plus, from before that, manual-entry symbol/units capture, PWA
packaging, full-account JSON backup/export, Zerodha + Upstox + generic-CSV (column-mapping)
importers, per-user dashboard customization (show/hide/reorder widgets via
`Setting.dashboardLayout`), and per-investment currency/exchange-rate fields for foreign-currency
holdings.*

