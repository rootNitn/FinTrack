import { Response } from "express";
import { asyncHandler } from "../../utils/async-handler";
import { sendSuccess } from "../../utils/api-response";
import { AuthenticatedRequest } from "../../middleware/auth";
import { AppError } from "../../utils/app-error";
import { businessService } from "./business.service";
import { businessAccountingService } from "./business.accounting.service";
import { manufacturingService } from "./manufacturing.service";
import { salesService } from "./sales.service";
import { retailService } from "./retail.service";
import { servicesService } from "./services.service";
import { createMilestoneSchema, createProjectExpenseInputSchema, createServiceInvoiceSchema, createTimesheetInputSchema } from "./services-completion.dto";
import { businessReportsService } from "./business-reports.service";
import { businessControlsService } from "./business-controls.service";
import { reportsExportService } from "../reports/reports.export.service";

function userId(req: AuthenticatedRequest): string {
  if (!req.user) throw AppError.unauthorized();
  return req.user.sub;
}

export const businessController = {
  products: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.products(userId(req), req.params.businessId));
  }),
  createProduct: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createProduct(userId(req), req.body));
  }),
  updateProduct: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.updateProduct(userId(req), req.params.productId, req.body));
  }),
  suppliers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.suppliers(userId(req), req.params.businessId));
  }),
  createSupplier: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createSupplier(userId(req), req.body));
  }),
  warehouses: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.warehouses(userId(req), req.params.businessId));
  }),
  createWarehouse: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createWarehouse(userId(req), req.body));
  }),
  movements: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
    sendSuccess(res, await manufacturingService.movements(userId(req), req.params.businessId, productId));
  }),
  createMovement: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createMovement(userId(req), req.body));
  }),
  boms: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.boms(userId(req), req.params.businessId));
  }),
  createBom: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createBom(userId(req), req.body));
  }),
  createPurchaseOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createPurchaseOrder(userId(req), req.body));
  }),
  purchaseOrders: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.purchaseOrders(userId(req), req.params.businessId));
  }),
  receivePurchaseOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.receivePurchaseOrder(userId(req), req.params.orderId, req.body));
  }),
  createProductionOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.createProductionOrder(userId(req), req.body));
  }),
  productionOrders: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.productionOrders(userId(req), req.params.businessId));
  }),
  startProductionOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.startProductionOrder(userId(req), req.params.orderId));
  }),
  completeProductionOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.completeProductionOrder(userId(req), req.params.orderId, req.body));
  }),
  transferStock: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await manufacturingService.transferStock(userId(req), req.body));
  }),
  expiryAlerts: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const days = typeof req.query.days === "string" ? Number(req.query.days) : 30;
    sendSuccess(res, await manufacturingService.expiryAlerts(userId(req), req.params.businessId, days));
  }),
  costSheet: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const quantity = typeof req.query.quantity === "string" ? Number(req.query.quantity) : 1;
    sendSuccess(res, await manufacturingService.costSheet(userId(req), req.params.businessId, req.params.productId, quantity));
  }),
  customers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.customers(userId(req), req.params.businessId));
  }),
  createCustomer: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createCustomer(userId(req), req.body));
  }),
  createSalesInvoice: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createInvoice(userId(req), req.body));
  }),
  salesInvoices: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.invoices(userId(req), req.params.businessId));
  }),
  paySalesInvoice: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.payInvoice(userId(req), req.params.invoiceId, req.body));
  }),
  createCreditNote: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createCreditNote(userId(req), req.body));
  }),
  receivablesAgeing: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.ageing(userId(req), req.params.businessId));
  }),
  customerProfitability: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.profitability(userId(req), req.params.businessId));
  }),
  quotations: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.quotations(userId(req), req.params.businessId));
  }),
  createQuotation: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createQuotation(userId(req), req.body));
  }),
  acceptQuotation: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.acceptQuotation(userId(req), req.params.quotationId));
  }),
  salesOrders: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.salesOrders(userId(req), req.params.businessId));
  }),
  createSalesOrder: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createSalesOrder(userId(req), req.body));
  }),
  salesReturns: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.salesReturns(userId(req), req.params.businessId));
  }),
  createSalesReturn: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.createSalesReturn(userId(req), req.body));
  }),
  payments: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.payments(userId(req), req.params.businessId));
  }),
  creditNotes: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await salesService.creditNotes(userId(req), req.params.businessId));
  }),
  retailCatalogue: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await retailService.catalogue(userId(req), req.params.businessId, { search: typeof req.query.search === "string" ? req.query.search : undefined, category: typeof req.query.category === "string" ? req.query.category : undefined, lowStockOnly: req.query.lowStockOnly === "true" }));
  }),
  retailSummary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await retailService.summary(userId(req), req.params.businessId));
  }),
  retailMembers: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await retailService.members(userId(req), req.params.businessId));
  }),
  addRetailMember: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await retailService.addMember(userId(req), req.body));
  }),
  serviceClients: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.clients(userId(req), req.params.businessId));
  }),
  createServiceClient: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.createClient(userId(req), req.body));
  }),
  serviceProjects: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.projects(userId(req), req.params.businessId));
  }),
  createServiceProject: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.createProject(userId(req), req.body));
  }),
  createServiceContract: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.createContract(userId(req), req.body));
  }),
  createTimesheet: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.createTimesheet(userId(req), req.body));
  }),
  createServiceExpense: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.createExpense(userId(req), req.body));
  }),
  serviceProfitability: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await servicesService.profitability(userId(req), req.params.projectId));
  }),
  serviceMilestones: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.milestones(userId(req), req.params.projectId)); }),
  createServiceMilestone: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.createMilestone(userId(req), req.body)); }),
  createServiceInvoice: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.createInvoice(userId(req), req.body)); }),
  serviceInvoices: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.invoices(userId(req), req.params.projectId)); }),
  createServiceTimesheet: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.createTimesheet(userId(req), req.body)); }),
  createProjectExpense: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await servicesService.createExpense(userId(req), req.body)); }),
  businessTrialBalance: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessReportsService.trialBalance(userId(req), req.params.businessId, req.query.from ? new Date(String(req.query.from)) : undefined, req.query.to ? new Date(String(req.query.to)) : undefined)); }),
  businessProfitLoss: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessReportsService.profitAndLoss(userId(req), req.params.businessId, req.query.from ? new Date(String(req.query.from)) : undefined, req.query.to ? new Date(String(req.query.to)) : undefined)); }),
  businessBalanceSheet: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessReportsService.balanceSheet(userId(req), req.params.businessId)); }),
  businessCashFlow: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessReportsService.cashFlow(userId(req), req.params.businessId, req.query.from ? new Date(String(req.query.from)) : undefined, req.query.to ? new Date(String(req.query.to)) : undefined)); }),
  businessGeneralLedger: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessReportsService.generalLedger(userId(req), req.params.businessId, req.query.from ? new Date(String(req.query.from)) : undefined, req.query.to ? new Date(String(req.query.to)) : undefined)); }),
  businessPeriods: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessControlsService.periods(userId(req), req.params.businessId)); }),
  createBusinessPeriod: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessControlsService.createPeriod(userId(req), req.params.businessId, req.body)); }),
  closeBusinessPeriod: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessControlsService.close(userId(req), req.params.businessId, req.body.period)); }),
  reopenBusinessPeriod: asyncHandler(async (req: AuthenticatedRequest, res: Response) => { sendSuccess(res, await businessControlsService.reopen(userId(req), req.params.businessId, req.body.period)); }),
  exportBusinessReport: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const type = String(req.params.reportType) as "trial-balance" | "profit-and-loss" | "balance-sheet" | "cash-flow" | "general-ledger";
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const report = type === "trial-balance" ? await businessReportsService.trialBalance(userId(req), req.params.businessId, from, to) : type === "profit-and-loss" ? await businessReportsService.profitAndLoss(userId(req), req.params.businessId, from, to) : type === "balance-sheet" ? await businessReportsService.balanceSheet(userId(req), req.params.businessId) : type === "cash-flow" ? await businessReportsService.cashFlow(userId(req), req.params.businessId, from, to) : await businessReportsService.generalLedger(userId(req), req.params.businessId, from, to);
    const format = String(req.query.format ?? "csv");
    if (format === "xlsx") { res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); res.send(await reportsExportService.toExcel(report as never)); return; }
    if (format === "pdf") { res.setHeader("Content-Type", "application/pdf"); res.send(await reportsExportService.toPdf(report as never)); return; }
    res.setHeader("Content-Type", "text/csv"); res.send(reportsExportService.toCsv(report as never));
  }),
  listBusinesses: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.listBusinesses(userId(req)));
  }),
  createBusiness: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.createBusiness(userId(req), req.body));
  }),
  listAccounts: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.listAccounts(userId(req), req.params.businessId));
  }),
  createAccount: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.createAccount(userId(req), req.params.businessId, req.body));
  }),
  summary: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.summary(userId(req), req.params.businessId));
  }),
  listJournalEntries: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.listJournalEntries(userId(req), req.params.businessId));
  }),
  listPendingJournalApprovals: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.listPendingJournalApprovals(userId(req)));
  }),
  createJournalEntry: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.createJournalEntry(userId(req), req.body));
  }),
  approveJournalEntry: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.approveJournalEntry(userId(req), req.params.entryId));
  }),
  rejectJournalEntry: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.rejectJournalEntry(userId(req), req.params.entryId, req.body.reason));
  }),
  reverseJournalEntry: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.reverseJournalEntry(userId(req), req.params.entryId, req.body.entryDate));
  }),
  migrateLegacy: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessAccountingService.migrateLegacyEntries(userId(req)));
  }),
  dashboard: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessService.dashboard(userId(req)));
  }),
  list: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const businessName = typeof req.query.businessName === "string" ? req.query.businessName : undefined;
    sendSuccess(res, await businessService.list(userId(req), businessName));
  }),
  create: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    sendSuccess(res, await businessService.create(userId(req), req.body));
  }),
  remove: asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    await businessService.remove(userId(req), req.params.id);
    sendSuccess(res, { message: "Business entry deleted" });
  }),
};
