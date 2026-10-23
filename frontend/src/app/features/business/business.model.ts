export type BusinessEntryType = 'INVESTMENT' | 'INCOME' | 'EXPENSE';

export interface BusinessEntry {
  id: string;
  businessName: string;
  type: BusinessEntryType;
  category?: string | null;
  amount: number;
  date: string;
  description?: string | null;
}

export interface BusinessDashboard {
  businesses: Array<{ name: string; investment: number; income: number; expense: number; profit: number }>;
  totals: { investment: number; income: number; expense: number; profit: number };
  monthly: Array<{ label: string; investment: number; income: number; expense: number; profit: number }>;
  spending: Array<{ category: string; amount: number }>;
  entries: BusinessEntry[];
}

export interface BusinessEntryPayload {
  businessName: string;
  type: BusinessEntryType;
  category?: string;
  amount: number;
  date: string;
  description?: string;
}

export type BusinessType = 'MANUFACTURING' | 'RETAIL' | 'SERVICES' | 'MIXED';

export interface BusinessProfile {
  id: string;
  name: string;
  legalName?: string | null;
  type: BusinessType;
  currency: string;
  fiscalYearStart: number;
  currentUserRole?: 'OWNER' | 'MANAGER';
  _count?: { accounts: number; journalEntries: number };
}

export interface BusinessAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  balance?: number;
}

export interface BusinessAccountingSummary {
  revenue: number;
  cogs: number;
  expenses: number;
  grossProfit: number;
  netProfit: number;
  accountBalances: Array<BusinessAccount & { debit: number; credit: number; balance: number }>;
}

export type BusinessJournalStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'POSTED' | 'REJECTED';

export interface BusinessJournalEntry {
  id: string;
  businessId: string;
  entryDate: string;
  reference?: string | null;
  description: string;
  status: BusinessJournalStatus;
  createdByUserId?: string | null;
  approvedByUserId?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  reversalOfId?: string | null;
  reversalEntry?: { id: string; entryDate: string; description: string } | null;
  business?: { id: string; name: string };
  lines: Array<{
    id: string;
    accountId: string;
    debit: number | string;
    credit: number | string;
    description?: string | null;
    account: { code: string; name: string };
  }>;
}

export interface BusinessReportRow {
  accountId?: string;
  code?: string;
  name?: string;
  type?: string;
  debit: number;
  credit: number;
  balance: number;
  period?: string;
  inflow: number;
  outflow: number;
  net: number;
  date?: string;
  reference?: string | null;
  description?: string | null;
  accountCode?: string;
  accountName?: string;
}

export interface BusinessReport {
  type: 'trial-balance' | 'profit-and-loss' | 'balance-sheet' | 'cash-flow' | 'general-ledger';
  from?: string | null;
  to?: string | null;
  asOf?: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  assets: number;
  liabilities: number;
  equity: number;
  balanced?: boolean;
  totalDebit: number;
  totalCredit: number;
  rows: BusinessReportRow[];
}

export type BusinessProductType = 'RAW_MATERIAL' | 'WORK_IN_PROGRESS' | 'FINISHED_GOOD' | 'CONSUMABLE';
export type BusinessStockMovementType = 'PURCHASE' | 'ISSUE' | 'PRODUCTION_RECEIPT' | 'SALE_ISSUE' | 'ADJUSTMENT_IN' | 'ADJUSTMENT_OUT' | 'TRANSFER_IN' | 'TRANSFER_OUT';

export interface BusinessProduct {
  id: string;
  sku: string;
  name: string;
  type: BusinessProductType;
  unit: string;
  reorderLevel: number;
  standardCost: number;
  sellingPrice: number;
  stock: number;
  stockValue: number;
  lowStock: boolean;
  barcode?: string | null;
  retailCategory?: string | null;
  brand?: string | null;
}

export interface BusinessWarehouse {
  id: string;
  name: string;
  location?: string | null;
}

export interface BusinessSupplier { id: string; name: string; }
export interface BusinessBom { id: string; version: number; productId: string; product: BusinessProduct; scrapPercent: number; lines: Array<{ productId: string; quantity: number; product: BusinessProduct }>; }
export interface BusinessExpiryAlert { id: string; expiryDate: string; batchNumber?: string | null; quantity: number; product: BusinessProduct; warehouse: BusinessWarehouse; }
export interface BusinessCustomer { id: string; name: string; email?: string | null; phone?: string | null; creditLimit: number; openingReceivable: number; }
export interface BusinessSalesInvoice { id: string; invoiceNumber: string; dueDate: string; totalAmount: number; paidAmount: number; outstandingAmount: number; status: string; customer: BusinessCustomer; }
export interface BusinessAgeingRow { invoiceId: string; invoiceNumber: string; customer: string; dueDate: string; outstandingAmount: number; daysOverdue: number; bucket: string; }
export interface BusinessPayment { id: string; amount: number; paymentDate: string; paymentMode: string; reference?: string | null; invoice: { invoiceNumber: string; customer: BusinessCustomer }; }
export interface BusinessCreditNote { id: string; creditNumber: string; issueDate: string; amount: number; reason: string; customer: BusinessCustomer; }
export interface BusinessPurchaseOrder { id: string; orderNumber: string; status: string; supplier: BusinessSupplier; lines: Array<{ id: string; productId: string; orderedQuantity: number; receivedQuantity: number; unitCost: number; product: BusinessProduct }>; }
export interface BusinessProductionOrder { id: string; orderNumber: string; status: string; plannedQuantity: number; producedQuantity: number; product: BusinessProduct; warehouse: BusinessWarehouse; }
export interface BusinessStockMovement { id: string; type: string; quantity: number; unitCost: number; batchNumber?: string | null; expiryDate?: string | null; product: BusinessProduct; warehouse: BusinessWarehouse; }
export interface RetailSummary { totalProducts: number; lowStockCount: number; inventoryValue: number; revenue: number; margin: number; fastMoving: Array<BusinessProduct & { soldQuantity: number; revenue: number; margin: number }>; slowMoving: Array<BusinessProduct & { soldQuantity: number; revenue: number; margin: number }>; reorderSuggestions: Array<{ id: string; sku: string; name: string; stock: number; reorderLevel: number; suggestedQuantity: number }>; }
export interface RetailCartLine { product: BusinessProduct; quantity: number; unitPrice: number; }
export interface ServiceClient { id: string; name: string; email?: string | null; phone?: string | null; }
export interface ServiceProject { id: string; name: string; code: string; status: string; budget: number; hourlyRate: number; client: ServiceClient; }
export interface ServiceProfitability { project: ServiceProject; revenue: number; laborCost: number; expenseCost: number; totalCost: number; profit: number; billableHours: number; }
export interface ServiceMilestone { id: string; name: string; dueDate?: string | null; amount: number; completed: boolean; }
export interface ServiceInvoice { id: string; invoiceNumber: string; issueDate: string; dueDate: string; amount: number; description: string; }
