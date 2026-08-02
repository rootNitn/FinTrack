# Personal Finance & Investment Tracker — Project Overview

A full-stack personal finance and investment management application: track investments (Stocks,
Mutual Funds, Fixed Deposits, PPF, EPF, NPS, Gold, Crypto, Bonds, Real Estate, Cash), expenses,
income, budgets, goals, credit cards, bank accounts, and get AI-style rule-based insights — with
broker-statement Excel import, live market data, and scheduled notifications.

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
| `goals` | Savings/investment goals with progress tracking |
| `banks` | Bank account management |
| `credit-cards` | Credit card tracking with due-date reminders |
| `fd` | Fixed Deposit bank/rate directory, FD portfolio tracking, maturity notifications |
| `market-rates` | Fetches and caches live equity/index quotes from Yahoo Finance |
| `ai-insights` | Rule-based (non-LLM) financial insights/recommendations engine |
| `analytics` | Aggregated analytics/reporting data for dashboards |
| `dashboard` | Combined summary data for the main dashboard view |
| `reports` | Generates downloadable reports |
| `notifications` | In-app notification center (populated by scheduled jobs) |
| `upcoming-bills` | Aggregates upcoming recurring bills/dues across modules |
| `settings` | User preferences (display currency, theme, notification prefs, dashboard widget layout), full-account JSON backup/export (`GET /settings/backup`) |
| `admin` | Admin-only endpoints |
| `tax` | Indian Income Tax calculator & tax-planning module — full old-vs-new regime comparison, DB-driven slabs/rebate/surcharge/cess/deduction rules (no hardcoded values), save/history of calculations, Excel/PDF export, and an admin-only rules-management API (see §6b) |

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

## 7. Frontend Features (`frontend/src/app/features/`)


Each folder is a lazy-loaded Angular route with its own list/detail/form components, a
feature-scoped `*.service.ts` (thin HTTP wrapper around `ApiBaseService`), and `*.model.ts` types:

`admin`, `ai-insights`, `analytics`, `auth`, `banks`, `calculators`, `credit-cards`, `dashboard`
(supports **Customize** mode — show/hide and drag-to-reorder the 8 top-level dashboard sections,
persisted per-user via `Setting.dashboardLayout`), `expenses`, `fd`, `goals`, `income`,
`investment-comparison`, `investments` (includes the broker import dialog with a generic-CSV
column-mapping step + import history dialog + the price-refresh button + per-investment
currency/exchange-rate fields for foreign-currency holdings), `notifications`, `reports`,
`settings` (includes a "Download Backup" button — exports the full account as JSON), `transactions`,
`upcoming-bills`.

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

`Setting.dashboardLayout` (`Json`, default `[]`) stores an array of
`{ id: string, visible: boolean }` describing per-user dashboard widget order/visibility; an empty
array means "use the app default" (all 8 sections, default order).

---

## 9. Known Gaps / Possible Future Improvements

Roughly in priority order (from an earlier product review):

1. ~~Live price refresh for Stocks/Mutual Funds~~ — **done** (see §6).
2. **Auth hardening**: password-reset emails are not actually delivered (no email provider wired
   up), no 2FA, no account-lockout/rate-limit tuning beyond the basics.
3. ~~Import/export breadth~~ — **mostly done**: Zerodha and Upstox importers added, plus a generic
   CSV import with user-driven column mapping for any unrecognized broker format (see §5). Manual
   investment entries now also capture `symbol`/`units` (see §6). ICICI Direct and other brokers
   would still need their own importer implementations following the existing pluggable pattern.
4. **Testing/DevOps**: no CI pipeline, limited automated test coverage, no containerized production
   deployment setup (only a local Postgres docker-compose).
5. ~~UX/product depth~~ — **mostly done**: the app is installable as a PWA and works offline (§7),
   a full-account JSON backup/export is available from Settings, dashboard sections can be
   shown/hidden/reordered per user (§7), and investments can record a foreign purchase
   currency + exchange rate (§8, informational — `principalAmount`/`currentValue` still store the
   account's base-currency equivalent so aggregates stay correct). Still open: no true multi-currency
   *conversion* across the whole app (Expenses/Income/Transactions remain single-currency, and
   there's no live FX-rate lookup — the exchange rate is entered manually at entry time), and no
   restore-from-backup flow (export only).
6. **Advanced Tax Intelligence extension** (§6c) known limitations: OCR only works well on
   text-layer PDFs (`pdf-parse`) and true JPG/PNG images (`tesseract.js`) — scanned/image-only PDFs
   with no embedded text layer won't extract cleanly, since no PDF-to-image rasterization library
   (Poppler/canvas) is installed; `tesseract.js` also downloads ~10-15MB of language data on its
   first OCR call (needs network access unless pre-bundled). Reconciliation (AIS vs Salary Slip,
   Form16 vs Form26AS) is aggregate-tolerance only, not line-item/transaction-ID matching, since the
   source documents don't share common transaction IDs. No automated test suite was added for this
   extension either, consistent with the rest of the project's browser-based verification approach.

---

*Last updated: after adding the Indian Income Tax Calculator & Tax Planning module (§6b) \u2014 DB-driven
old-vs-new regime comparison engine, save/history, Excel/PDF export, and an admin rules-management
UI \u2014 plus, from before that, manual-entry symbol/units capture, PWA packaging, full-account JSON
backup/export, Zerodha + Upstox + generic-CSV (column-mapping) importers, per-user dashboard
customization (show/hide/reorder widgets via `Setting.dashboardLayout`), and per-investment
currency/exchange-rate fields for foreign-currency holdings.*

