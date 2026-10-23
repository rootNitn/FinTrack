# Financial Health Rules — Implementation Plan

Scope for v1: implement the rules that are computable from data already tracked in the
app, with zero missing inputs. Presented as **"rules of thumb"**, not laws — every card
states this and shows the underlying numbers so the user can judge for themselves.

## Implemented Rules

| Rule | Formula | Data source (existing models) |
|---|---|---|
| **50/30/20** | Needs / Wants / Savings % of monthly income | `Income` (monthly sum), `Expense` (category → needs/wants map) |
| **Emergency Fund (3–6 months)** | Coverage = Liquid Assets ÷ Essential Monthly Expenses, scored on tiers (<1 Critical, 1–3 Building, 3–6 Healthy, 6–12 Strong, >12 Review excess cash) | `BankAccount.balance` + `FdPortfolio` (ACTIVE, current value) ÷ essential `Expense` categories |
| **Rule of 72 / 114 / 144** | 72 (114, 144) ÷ annual return % | Portfolio-wide XIRR via existing `calculateXirr()` (`backend/src/utils/xirr.util.ts`), reused across all `Investment` cash flows |
| **60/30/10 Allocation** | Equity / Debt / Gold % of current investment value | `Investment.category` grouped: Equity = STOCKS, MUTUAL_FUNDS, CRYPTO; Debt = FIXED_DEPOSIT, PPF, EPF, NPS, BONDS, CASH; Gold = GOLD (REAL_ESTATE/OTHER excluded from the 3-way split, shown as "Other") |
| **100 − Age** | Target equity % = 100 − age vs actual equity % of total investment value | `User.dateOfBirth` + `Investment` equity bucket vs total |
| **Save the Raise** | % of income increase (vs ~6 months ago) directed into savings | `Income`/`Expense` for current month vs the month 6 months prior |
| **Savings Rate Score** | Monthly Savings ÷ Monthly Income × 100, scored on app-defined tiers (<10% Critical, 10–19% Low, 20–29% Good, 30–39% Excellent, 40%+ Exceptional) | `Income`/`Expense` for the current month |
| **Rebalancing Score** | Actual equity/debt/gold % vs a *user-chosen* target (defaults to 60/30/10), scored on drift (<5pts On Track, 5-10pts Review, >10pts Rebalancing Needed) | Same `Investment` buckets as 60/30/10 + `Setting.targetEquityPercent/targetDebtPercent/targetGoldPercent` |
| **Goal Funding Ratio** | Current Goal Corpus ÷ Required Corpus × 100, one rule per goal (<25% Critical, 25-49% Underfunded, 50-79% Partially Funded, 80-99% On Track, 100%+ Fully Funded) | `Goal.currentAmount` / `Goal.targetAmount` |
| **Debt Health** | Total outstanding debt ÷ annual income × 100, scored (<20% Healthy, 20-35% Moderate, >35% High) | `CreditCard.currentOutstanding` + `Liability.amount` ÷ (monthly income × 12) |
| **Diversification (Concentration)** | Largest single equity holding (grouped by name) ÷ total equity value × 100, scored (≤10% Diversified, 10-20% Review, >20% High Concentration) | `Investment` equity bucket, grouped by `name` |
| **Retirement Readiness** | Investable Assets ÷ Required Corpus × 100, where Required Corpus = Annual Retirement Expense ÷ user-chosen Withdrawal Rate (3/3.5/4%), scored (<25% Critical, 25-49% Underfunded, 50-79% Partially Funded, 80-99% On Track, 100%+ Fully Funded) | Total assets (liquid + investments) ÷ (`Setting.retirementMonthlyExpense` or current needs+wants) × 12 ÷ `Setting.retirementWithdrawalRatePercent` (or 4%) |
| **Insurance Protection Score** | Health cover ≥ ₹5,00,000 floor; Life cover ≥ 10× annual income (only checked if the user has any `FamilyMember`, i.e. dependents) — worst of the two determines status | `InsurancePolicy` (HEALTH/LIFE, `sumInsured`) + `FamilyMember` count as a dependents proxy |
| **Tax Efficiency Score** | Compares old vs new regime tax payable from the most recently saved Tax Calculator result; "na" if none saved; framed as "tax-saving opportunity identified," not "invest to save tax" | `TaxCalculation.result` (old/new totalTaxPayable, recommendedRegime, taxSaved), most recent by `createdAt` |
| **Investment Discipline (SIP Consistency)** | Actual completed installments ÷ expected installments (from purchase date to now or recurrence end) × 100, scored (>95% Excellent, 90-95% Good, 75-90% Fair, <75% Poor) | `Investment.isRecurring/recurrenceInterval/recurrenceEndDate/purchaseDate` + generated child investments (`generatedInvestments` self-relation) |

**Net Worth** (Total Assets minus Total Liabilities, with month-over-month and YoY growth) is
shown as its own prominent, non-scored summary at the top of the page — assets = bank balance +
FD + investment current value; liabilities = active `CreditCard.currentOutstanding` + manually
tracked `Liability` entries (loans). Growth is read from the existing `MonthlySnapshot` history
(this module only reads the most recent and ~12-months-ago rows, it doesn't write snapshots).

50/30/20, 100-Age, 60/30/10, Save the Raise, Rule of 72/114/144, and the **Financial
Independence (FI) Ratio** (Investable Assets ÷ Required Corpus — same formula as Retirement
Readiness, shown for reference alongside it) are **benchmarks — rules of thumb, not scored health
checks.** They're returned separately as `benchmarks` (not `rules`) and excluded from
`overallScore`; shown on the page under "Benchmarks — Rules of Thumb (Not Scored)" instead of the
scored rule cards/pipeline. Deviating from a rule of thumb should inform a recommendation, never
tank the score.

**Action Plan** — the 3 most urgent scored rules (status `critical` or `warning`, critical first)
are surfaced as `topActions: ActionPlanItem[]` (`{ ruleId, title, message, severity }`), reusing
each rule's own `recommendation` text so there's only one place advice copy lives.

### Scoring model — weighted categories, not a flat "pass/fail average"

`overallScore` is a weighted average across categories (not a flat average of all rules), so one
bad rule can't disproportionately sink the score, and a category with several rules (e.g.
multiple goals) isn't over-weighted vs. one with a single rule. Target weights and current
implementation status:

| Category | Weight | Status |
|---|---|---|
| Emergency Fund | 15% | implemented |
| Debt Health | 15% | implemented |
| Savings Rate | 10% | implemented |
| Asset Allocation (Rebalancing Score) | 10% | implemented |
| Diversification | 10% | implemented |
| Retirement | 15% | implemented |
| Goals (Goal Funding Ratio) | 10% | implemented |
| Insurance | 5% | implemented |
| Tax Efficiency | 5% | implemented |
| Investment Discipline | 5% | implemented |

All 10 categories are implemented and the weights sum to exactly 100% — no renormalization is
needed. Investment Cost Score (weighted expense ratio), Inflation Protection / Real Return, and
Income Growth vs. Investment Growth were explicitly scoped **out** of this plan (not tracked, not
scored) since they weren't requested.

Category → needs/wants mapping (expenses):
- Needs: RENT, BILLS, EMI, INSURANCE, MEDICAL, EDUCATION, FUEL, FOOD
- Wants: SHOPPING, TRAVEL, ENTERTAINMENT, OTHERS

Status thresholds (traffic-light):
- 🟢 within tolerance of target
- 🟡 moderately off target
- 🔴 significantly off target / at risk
- Emergency fund: 🔴 < 3 months, 🟡 3–6 months but below target band edge, 🟢 ≥ 3 months (6+ ideal)

## Backend — new module `backend/src/modules/financial-health/`

- `financial-health.util.ts` — category mapping constants + per-rule pure calculation functions (unit-testable, no DB access).
- `financial-health.service.ts` — `getSummary(userId)`: fetches Income/Expense (last full month or trailing 30 days), BankAccount, FdPortfolio (ACTIVE), Investment; calls util functions; returns `{ rules: FinancialHealthRule[], overallScore, overallStatus }`.
- `financial-health.controller.ts` + `.routes.ts` — `GET /api/v1/financial-health/summary`, auth-protected, following the `capital-gains` module pattern (`requireAuth`, `asyncHandler`, `sendSuccess`).
- Wire into `backend/src/modules/router.ts`: `apiRouter.use("/financial-health", financialHealthRoutes);`

Each rule in the response is a uniform shape:
```ts
interface FinancialHealthRule {
  id: string;            // '50-30-20' | 'emergency-fund' | 'rule-of-72' | '60-30-10' | 'rebalancing' | 'goal-funding-<goalId>' | ...
  title: string;
  status: 'good' | 'warning' | 'critical' | 'na';
  summary: string;        // one-line human-readable result
  recommendation: string; // what to do next
  data: Record<string, number | null>; // raw numbers for charts/breakdown
}
```

## Frontend — new feature `frontend/src/app/features/financial-health/`

- `financial-health.model.ts` — mirrors backend types.
- `financial-health.service.ts` — `ApiBaseService` wrapper, `getSummary()`.
- `financial-health.component.ts/.html` — page with an overall score header + 4 rule cards
  (status chip, summary line, small breakdown, recommendation), modeled after the
  `ai-insights` page's signal/computed pattern and existing `glass-card` styling.
- Route: add to `frontend/src/app/app.routes.ts` under `/financial-health`.
- Sidebar: add `{ kind: 'item', label: 'Financial Health', icon: 'health_and_safety', route: '/financial-health' }` in `sidebar.component.ts`.

## New supporting modules added for this phase

- `backend/src/modules/liabilities/` — minimal CRUD (`GET/POST/PATCH/DELETE /api/v1/liabilities`)
  for manually-tracked loans/liabilities (`Liability` Prisma model: name, type, amount,
  interestRatePercent, optional familyMemberId). Feeds Net Worth's liabilities total alongside
  credit cards.
- `Setting.targetEquityPercent/targetDebtPercent/targetGoldPercent` (nullable Int, default null
  = 60/30/10) — updatable via the existing `PATCH /api/v1/settings` endpoint, used by the
  Rebalancing Score. Editable inline on the Rebalancing Score card on the Financial Health page.

## Explicitly out of scope (future rules, once data/UX is designed)

40/30/30, 70/20/10 (both variants), Pay Yourself First, Lifestyle Inflation, 110/120−Age,
5–10% Gold, Diversification/concentration checks, SIP regularity (Investment Discipline),
12-Month Emergency, High-Interest-Debt-First, Debt-to-Income (Debt Health), Credit Card,
25× Retirement / 4% Withdrawal / Retirement Readiness, Age-Based Progression, 30% Housing,
20% Down Payment, Total-Cost of housing, Insurance Protection Score, Tax Efficiency Score
(old vs new regime, 80C/80D tracking), Investment Cost Score (expense ratio), Inflation
Protection (real return), Income Growth vs Investment Growth, Financial Independence Ratio.
These need either new data (insurance policies, mutual fund expense ratios, SIP schedules,
retirement expense assumptions) or product decisions (which are deferred, not blocked on
missing code).

## Feature Overlap Audit (2026-08-10)

Before finalizing this plan, every module that touches money data was audited for overlap so
Financial Health doesn't become "yet another dashboard." Full module list checked: Financial
Health, Dashboard, Analytics, Reports, Goals, Investments, Tax, Calculators, Notifications,
Settings. All 10 exist and are in active use — none are dead/orphaned.

### Responsibility charter (who owns what)

| Concern | Owner | Everyone else's role |
|---|---|---|
| Scored health checks + Action Plan | **Financial Health** | Reads live data from Goals/Investments/Tax/Liabilities/Insurance; never re-implements their CRUD |
| Historical trend charts (12/24-month) & category breakdowns | **Analytics** | Dashboard/Financial Health show at most a single current-value KPI, not a duplicate chart |
| At-a-glance summary + shortcuts | **Dashboard** | Must not duplicate a chart that already exists 1:1 in Analytics — link out instead |
| Period exports (PDF/Excel/CSV) | **Reports** | Pure export of numbers Analytics/Investments/Goals already compute — no new charts or scoring |
| Goal/Investment/Liability/Insurance CRUD | **Goals / Investments / Financial Health's mini-managers** | Financial Health only owns Liabilities + Insurance CRUD because no other page manages them; Goals/Investments own their own data everywhere else |
| "What-if" exploration with custom assumptions | **Calculators** | Independent of live data; Financial Health never reuses calculator UI, only the underlying formula |
| Full tax computation & regime optimization | **Tax module** | Financial Health's Tax Efficiency rule only reads the last saved result — never recomputes |
| Preferences, notification toggles, backup, dashboard layout | **Settings** | Never contains a calculation |
| Notification inbox/delivery | **Notifications** | Never contains a calculation or score |

### Overlaps found and verdicts

1. **Dashboard "Key Metrics" (9 KPI cards) vs. Analytics "Investment Performance" (4 KPI cards)**
   — identical Total Invested / Current Value / Total Profit / ROI% numbers on both pages.
   **Verdict: trim Dashboard.** Keep one consolidated Portfolio card (Current Value + Profit%)
   on Dashboard linking to Analytics; drop the redundant standalone Total Invested/ROI% cards
   from Dashboard.
2. **Dashboard "Net Worth Over Time" (24-mo chart) vs. Analytics "Net Worth Growth" (24-mo
   chart)** — the exact same chart rendered twice. **Verdict: remove the full chart from
   Dashboard**, replace with a single Net Worth number (already shown) + "View trend in
   Analytics" link. Analytics keeps the only full chart.
3. **Dashboard "Monthly Cash Flow" chart vs. Analytics "Income vs Expense" (12-mo chart)** —
   same income/expense data at different resolution. **Verdict: Dashboard shows current month
   only** (already close to this); any multi-month bars belong solely to Analytics.
4. **Calculators → "Net Worth Calculator" vs. live Net Worth (Financial Health/Dashboard/
   Analytics)** — a hypothetical manual-entry version of a number the app already tracks live,
   with no adjustable assumptions to justify a separate "what-if" tool. **Verdict: remove** this
   calculator; it adds a screen with no unique value, which works against the "not the max
   number of screens" goal.
5. **Calculators → Retirement Calculator / Emergency Fund Calculator vs. Financial Health's
   Retirement Readiness / Emergency Fund rules** — same core formula, but Calculators lets users
   vary assumptions (inflation, custom returns, custom target months) that Financial Health
   doesn't expose. **Verdict: keep both**, but cross-link — Financial Health's card text should
   point to the matching calculator for "what if I change X" exploration instead of Financial
   Health growing its own scenario UI.
6. **Financial Health "Tax Efficiency" vs. Tax module's regime comparison** — Financial Health
   only reads the last saved `TaxCalculation`, never recomputes. **Verdict: keep as-is**, just
   tighten in-app copy so the card reads as a pointer/check ("last regime comparison shows ₹X
   saved — recompute in the Tax Planner") rather than implying it's a second tax engine.
7. **Reports "Investment/Goal Report" vs. Investments/Goals list pages** — Reports re-lists the
   same rows Investments/Goals already show. **Verdict: no change** — this is Reports doing its
   one job (exportable snapshot), not a competing UI. Keep Reports export-only; it must never
   grow interactive filtering/analysis that would compete with Investments/Goals/Analytics.
8. **Financial Health's Diversification/Rebalancing rules vs. Dashboard's Asset Allocation pie
   chart / Investments' Category Summary** — Financial Health scores concentration and drift
   against a target; Dashboard/Investments show the current-state breakdown only (no scoring).
   **Verdict: no change** — complementary (scored vs. informational), not duplicate.
9. **Insurance/Debt notification types (INSURANCE_RENEWAL, EMI_DUE, CC_PAYMENT_DUE) vs.
   Financial Health's Insurance/Debt Health rules** — notifications are time-based event
   triggers; Financial Health is a point-in-time score using the same underlying entities.
   **Verdict: no change** — correct separation of concerns.

### Action items from this audit (implemented 2026-08-10)

- [x] Trimmed Dashboard's "Key Metrics" widget to one consolidated Portfolio KPI card (dropped
      the duplicate Total Invested/ROI% standalone cards), linking to Analytics.
- [x] Removed the 24-month Net Worth chart from Dashboard; kept only the KPI number + a link to
      Analytics for the trend.
- [x] Replaced Dashboard's multi-month cash-flow bar chart with a current-month-only summary
      (Income/Expense/Net) + a link to Analytics for the historical trend.
- [x] Removed the standalone "Net Worth Calculator" from Calculators.
- [x] Added "explore in Calculators" links from Financial Health's Retirement Readiness and
      Emergency Fund rule cards (`CALCULATOR_LINKS` map in `financial-health.component.ts`).
- [x] Tightened Tax Efficiency card copy (`financial-health.util.ts`) to read as a pointer to the
      Tax Planner's last saved calculation, not a second tax engine.

These were Dashboard/Calculators/Financial Health copy changes outside this file's original scope
(Financial Health rules) — implemented as a follow-up pass after the Phase 3 backend/frontend
work above.

### Live UI QA pass via Playwright (2026-08-10) — 2 real bugs found and fixed

Logged in as the demo user and clicked through Dashboard, Financial Health, Analytics,
Calculators, Goals, Reports, Investments, and Settings in a live browser. Two real bugs were
found and fixed:

- [x] **Tax Efficiency Score "Savings Percent" showed 0% despite a real ₹73,320 tax saving.**
      `computeTaxEfficiency()` divided `taxSaved` by `cheaperRegimeTax`, which is legitimately ₹0
      whenever the recommended regime's tax is fully wiped out by the rebate (e.g. taxable income
      under the NEW-regime rebate threshold) — a 0-in-denominator case that isn't "no savings",
      it's "100% savings". Fixed in `backend/src/modules/financial-health/financial-health.util.ts`
      by dividing by the *other* (more expensive) regime's tax instead
      (`cheaperRegimeTax + taxSaved`), which is never zero when `taxSaved > 0`.
- [x] **Every route navigation logged an NG0100 `ExpressionChangedAfterItHasBeenCheckedError` for
      `@routeFade`** in `ShellComponent`. The template called `prepareRoute(outlet)` directly in the
      `[@routeFade]` binding, reading the router outlet's live `activatedRoute` — which changes
      mid change-detection-cycle right after the outlet activates, tripping Angular's dev-mode
      double-check. Fixed in `frontend/src/app/layout/shell/shell.component.ts`/`.html` by tracking
      the current route via a `routeAnimKey` signal updated from `Router` `NavigationEnd` events
      instead of a template method call, and binding `[@routeFade]="routeAnimKey()"`.

Both fixes verified via `tsc --noEmit`/`ng build` (clean) and by re-testing live in the browser:
the console error no longer appears on any route, and the Tax Efficiency card now shows
"Savings Percent: 100%" for the demo user's saved calculation.

