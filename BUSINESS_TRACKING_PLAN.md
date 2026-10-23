# Advanced Business Tracking Roadmap

The business module is being expanded from a simple income/expense ledger into a multi-business operating and accounting system. Manufacturing is the first domain, with a flexible foundation so retail and services can be added without replacing the accounting core.

## Phase 1 - Accounting foundation (complete)

- Multiple business profiles per user, with business type and fiscal year settings.
- Double-entry chart of accounts: assets, liabilities, equity, revenue, cost of goods sold, expenses, and inventory.
- Balanced journal entries: every posted transaction must have total debits equal to total credits.
- Account balances and business-level profit, cash, liabilities, and equity summaries.
- Draft and posted journal states with immutable posted entries.
- Migration of existing `BusinessEntry` records into a default business profile and journal entries.
- Audit-friendly references, descriptions, dates, and source links.

## Phase 2 - Manufacturing operations (complete)

- [x] Raw-material, work-in-progress, finished-goods, and consumable inventory foundation.
- [x] Product master with units of measure, reorder levels, standard cost, and selling price.
- [x] Suppliers and warehouses with business ownership validation.
- [x] Stock movements with negative-stock protection and automatic inventory journal postings.
- [x] BOM data model and validated BOM creation/listing API.
- [x] Purchase orders and goods receipt workflow API, including partial receipts and supplier linkage.
- [x] Production orders with BOM material issue and finished-good output receipt API.
- [x] Batch/lot fields, expiry-alert API, and warehouse stock-transfer API.
- [x] Manufacturing material cost sheet API with scrap/wastage calculation.
- [x] Dedicated purchase/production/BOM management screens and full stock-transfer UI.

## Phase 3 - Sales and receivables (complete)

- [x] Customer master with contact, credit-limit, and opening-receivable fields.
- [x] Sales invoice creation with product lines, due dates, server-calculated totals, stock checks, and invoice status.
- [x] Automatic journal postings for receivables, revenue, tax payable, COGS, and finished-goods stock issue.
- [x] Receivable payments with cash/AR journal posting and partial/full payment status.
- [x] Credit notes with receivable and revenue adjustment postings.
- [x] Receivables ageing and customer profitability endpoints/UI.
- [x] Quotations and sales-order workflow before invoicing.
- [x] Sales returns with returned stock receipt, receivable credit adjustment, and COGS reversal.
- [x] Due-date notification job with user preference support and deduplicated reminders.
- [x] Dedicated payment and credit-note management controls with recent-history views.

### Foundation hardening completed before Phase 4

- [x] Invoice, return, purchase receipt, production completion, and warehouse transfer stock/accounting writes are transactionally atomic.
- [x] Journal balance invariant is centralized and covered by tests.
- [x] Backend regression suite and frontend production build pass.

## Phase 4 - Retail mode

- [x] Product catalogue with SKU, barcode, retail category, brand, pricing, and searchable UI.
- [x] Retail inventory value, margin, fast-moving/slow-moving, and reorder-suggestion analytics.
- [x] Cashier, manager, owner, and inventory-clerk business member roles foundation.
- [x] Existing purchase entry, sales invoice, and stock-transfer workflows reused by retail mode.
- [x] Dedicated POS cart and cashier checkout screen.
- [x] Dedicated retail purchase and sales receipt screens.

## Phase 5 - Services mode (complete)

- [x] Service clients and projects with status, budget, dates, and hourly rates.
- [x] Service contracts, timesheets, and project expenses data/API foundation.
- [x] Project profitability based on service revenue, labor cost, expenses, and billable hours.
- [x] Services workspace UI for client/project creation and profitability review.
- [x] Dedicated timesheet and project-expense entry screens.
- [x] Milestones and service invoice generation UI.

## Phase 6 - Controls, reporting, and compliance (core complete)

- [x] Trial balance, profit and loss, balance sheet, cash-flow statement, and general ledger report APIs/UI.
- [x] Excel/CSV/PDF export endpoints for business accounting reports.
- [x] Accounting period creation, close/reopen controls, closed-period journal enforcement, and audit logging.
- [x] Balanced reversing journal entries preserve the original posting and net to zero in posted reports.
- [x] Manual journal submissions require approval; owners and active Managers can review, approve, or reject with a reason. Managers receive journal-only read/approval access.
- [ ] Expand role-based permission enforcement across all business actions; business creation and operational mutations remain owner-only for now.
- GST/VAT-ready tax fields and invoice numbering, configurable by jurisdiction.
- CSV/Excel import, backups, scheduled monthly close, and management dashboards.

## Product decisions

- Manufacturing is the first business type, but the core accounting models remain generic.
- Existing legacy ledger entries are preserved and migrated; they are never silently deleted.
- Accounting amounts use the business base currency and decimal database types.
- Inventory and production features must post accounting entries through the same journal service rather than writing balances independently.
