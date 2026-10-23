import { BusinessAccountType, BusinessSalesInvoiceStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { CreateCreditNoteInput, CreateCustomerInput, CreateReceivablePaymentInput, CreateSalesInvoiceInput } from "./sales.dto";
import { BusinessStockMovementType } from "@prisma/client";
import { createMovementInTransaction } from "./manufacturing.service";
import { assertBusinessPeriodOpen } from "./business-controls.service";
import { createBusinessJournalEntry } from "./business-journal.util";
import { CreateQuotationInput, CreateSalesOrderInput, CreateSalesReturnInput } from "./sales-documents.dto";
import { BusinessCreditNoteStatus, BusinessQuotationStatus, BusinessSalesOrderStatus, BusinessSalesReturnStatus } from "@prisma/client";

const round2 = (value: number) => Number(value.toFixed(2));

async function ownedBusiness(userId: string, businessId: string) {
  const business = await prisma.businessProfile.findFirst({ where: { id: businessId, userId } });
  if (!business) throw AppError.notFound("Business not found");
  return business;
}

async function ensureSalesAccounts(tx: Prisma.TransactionClient, businessId: string) {
  await tx.businessAccount.createMany({
    data: [
      { businessId, code: "1100", name: "Accounts Receivable", type: BusinessAccountType.ASSET },
      { businessId, code: "2100", name: "Sales Tax Payable", type: BusinessAccountType.LIABILITY },
    ],
    skipDuplicates: true,
  });
  const accounts = await tx.businessAccount.findMany({ where: { businessId, code: { in: ["1000", "1100", "2100", "4000", "5000", "1400"] } } });
  return new Map(accounts.map((account) => [account.code, account]));
}

function computedInvoiceStatus(status: BusinessSalesInvoiceStatus, dueDate: Date, total: number, paid: number) {
  if (status === BusinessSalesInvoiceStatus.CANCELLED || status === BusinessSalesInvoiceStatus.DRAFT) return status;
  if (paid >= total) return BusinessSalesInvoiceStatus.PAID;
  if (paid > 0) return BusinessSalesInvoiceStatus.PARTIALLY_PAID;
  return dueDate < new Date() ? BusinessSalesInvoiceStatus.OVERDUE : BusinessSalesInvoiceStatus.ISSUED;
}

export const salesService = {
  async customers(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessCustomer.findMany({ where: { businessId }, orderBy: { name: "asc" } });
  },

  async createCustomer(userId: string, input: CreateCustomerInput) {
    await ownedBusiness(userId, input.businessId);
    return prisma.businessCustomer.create({ data: input });
  },

  async createInvoice(userId: string, input: CreateSalesInvoiceInput) {
    await ownedBusiness(userId, input.businessId);
    await assertBusinessPeriodOpen(input.businessId, input.issueDate);
    const [customer, warehouse, products] = await Promise.all([
      prisma.businessCustomer.findFirst({ where: { id: input.customerId, businessId: input.businessId, status: "ACTIVE" } }),
      prisma.businessWarehouse.findFirst({ where: { id: input.warehouseId, businessId: input.businessId, isActive: true } }),
      prisma.businessProduct.findMany({ where: { businessId: input.businessId, id: { in: input.lines.map((line) => line.productId) }, isActive: true }, include: { stockMovements: { select: { type: true, quantity: true, warehouseId: true } } } }),
    ]);
    if (!customer || !warehouse || products.length !== new Set(input.lines.map((line) => line.productId)).size) throw AppError.badRequest("Customer, warehouse and products must belong to this business");
    const productById = new Map(products.map((product) => [product.id, product]));
    for (const line of input.lines) {
      const product = productById.get(line.productId)!;
      const stock = product.stockMovements.filter((movement) => movement.warehouseId === input.warehouseId).reduce((sum, movement) => sum + (movement.type === BusinessStockMovementType.PURCHASE || movement.type === BusinessStockMovementType.PRODUCTION_RECEIPT || movement.type === BusinessStockMovementType.ADJUSTMENT_IN || movement.type === BusinessStockMovementType.TRANSFER_IN || movement.type === BusinessStockMovementType.SALES_RETURN ? Number(movement.quantity) : -Number(movement.quantity)), 0);
      if (stock < line.quantity) throw AppError.badRequest(`Insufficient stock for ${product.name}. Available: ${stock} ${product.unit}`);
    }
    const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    if (input.discountAmount > subtotal) throw AppError.badRequest("Discount cannot exceed subtotal");
    const netSubtotal = subtotal - input.discountAmount;
    const taxAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.taxRate / 100, 0);
    const totalAmount = netSubtotal + taxAmount;
    const invoice = await prisma.$transaction(async (tx) => {
      const accounts = await ensureSalesAccounts(tx, input.businessId);
      const created = await tx.businessSalesInvoice.create({ data: { businessId: input.businessId, customerId: input.customerId, invoiceNumber: input.invoiceNumber, issueDate: input.issueDate, dueDate: input.dueDate, status: BusinessSalesInvoiceStatus.ISSUED, subtotal: round2(subtotal), taxAmount: round2(taxAmount), discountAmount: round2(input.discountAmount), totalAmount: round2(totalAmount), notes: input.notes, lines: { create: input.lines.map((line) => ({ productId: line.productId, description: line.description, quantity: line.quantity, unitPrice: line.unitPrice, taxRate: line.taxRate, costPerUnit: Number(productById.get(line.productId)!.standardCost) })) } }, include: { customer: true, lines: { include: { product: true } } } });
      const journalLines = [{ accountId: accounts.get("1100")!.id, debit: totalAmount }, { accountId: accounts.get("4000")!.id, credit: netSubtotal }];
      if (taxAmount > 0) journalLines.push({ accountId: accounts.get("2100")!.id, credit: taxAmount });
      await createBusinessJournalEntry(tx, { businessId: input.businessId, entryDate: input.issueDate, reference: input.invoiceNumber, description: `Sales invoice ${input.invoiceNumber}`, lines: journalLines.map((line) => ({ ...line, debit: line.debit ?? 0, credit: line.credit ?? 0 })) });
      for (const line of input.lines) {
        const product = productById.get(line.productId)!;
        await createMovementInTransaction(tx, { businessId: input.businessId, productId: line.productId, warehouseId: input.warehouseId, type: BusinessStockMovementType.SALE_ISSUE, quantity: line.quantity, unitCost: Number(product.standardCost), reference: input.invoiceNumber, movementDate: input.issueDate }, product);
      }
      return created;
    });
    return invoice;
  },

  async invoices(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    const invoices = await prisma.businessSalesInvoice.findMany({ where: { businessId }, include: { customer: true, lines: { include: { product: true } }, payments: true, creditNotes: true }, orderBy: { dueDate: "asc" } });
    return invoices.map((invoice) => ({ ...invoice, status: computedInvoiceStatus(invoice.status, invoice.dueDate, Number(invoice.totalAmount), Number(invoice.paidAmount) - invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)), outstandingAmount: round2(Number(invoice.totalAmount) - Number(invoice.paidAmount) - invoice.creditNotes.reduce((sum, note) => sum + Number(note.amount), 0)) }));
  },

  async payInvoice(userId: string, invoiceId: string, input: CreateReceivablePaymentInput) {
    const invoice = await prisma.businessSalesInvoice.findFirst({ where: { id: invoiceId, business: { userId } } });
    if (!invoice) throw AppError.notFound("Sales invoice not found");
    await assertBusinessPeriodOpen(invoice.businessId, input.paymentDate);
    const outstanding = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (input.amount > outstanding) throw AppError.badRequest(`Payment exceeds outstanding amount of ${outstanding}`);
    return prisma.$transaction(async (tx) => {
      const accounts = await ensureSalesAccounts(tx, invoice.businessId);
      const payment = await tx.businessReceivablePayment.create({ data: { invoiceId, ...input } });
      const paidAmount = Number(invoice.paidAmount) + input.amount;
      await tx.businessSalesInvoice.update({ where: { id: invoiceId }, data: { paidAmount, status: paidAmount >= Number(invoice.totalAmount) ? BusinessSalesInvoiceStatus.PAID : BusinessSalesInvoiceStatus.PARTIALLY_PAID } });
      await createBusinessJournalEntry(tx, { businessId: invoice.businessId, entryDate: input.paymentDate, reference: input.reference, description: `Payment for invoice ${invoice.invoiceNumber}`, lines: [{ accountId: accounts.get("1000")!.id, debit: input.amount, credit: 0 }, { accountId: accounts.get("1100")!.id, debit: 0, credit: input.amount }] });
      return payment;
    });
  },

  async createCreditNote(userId: string, input: CreateCreditNoteInput) {
    await ownedBusiness(userId, input.businessId);
    await assertBusinessPeriodOpen(input.businessId, input.issueDate);
    const customer = await prisma.businessCustomer.findFirst({ where: { id: input.customerId, businessId: input.businessId } });
    if (!customer) throw AppError.badRequest("Customer does not belong to this business");
    if (input.invoiceId) {
      const invoice = await prisma.businessSalesInvoice.findFirst({ where: { id: input.invoiceId, businessId: input.businessId, customerId: input.customerId } });
      if (!invoice || input.amount > Number(invoice.totalAmount)) throw AppError.badRequest("Credit note amount is invalid for this invoice");
    }
    return prisma.$transaction(async (tx) => {
      const accounts = await ensureSalesAccounts(tx, input.businessId);
      const note = await tx.businessCreditNote.create({ data: input });
      await createBusinessJournalEntry(tx, { businessId: input.businessId, entryDate: input.issueDate, reference: input.creditNumber, description: `Credit note ${input.creditNumber}`, lines: [{ accountId: accounts.get("4000")!.id, debit: input.amount, credit: 0 }, { accountId: accounts.get("1100")!.id, debit: 0, credit: input.amount }] });
      return note;
    });
  },

  async ageing(userId: string, businessId: string) {
    const invoices = await this.invoices(userId, businessId);
    const now = new Date();
    return invoices.filter((invoice) => invoice.outstandingAmount > 0).map((invoice) => {
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - new Date(invoice.dueDate).getTime()) / 86400000));
      const bucket = daysOverdue === 0 ? "CURRENT" : daysOverdue <= 30 ? "1_30" : daysOverdue <= 60 ? "31_60" : daysOverdue <= 90 ? "61_90" : "90_PLUS";
      return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, customer: invoice.customer.name, dueDate: invoice.dueDate, outstandingAmount: invoice.outstandingAmount, daysOverdue, bucket };
    });
  },

  async profitability(userId: string, businessId: string) {
    const invoices = await prisma.businessSalesInvoice.findMany({ where: { businessId }, include: { customer: true, lines: true, creditNotes: true } });
    const byCustomer = new Map<string, { customerId: string; customer: string; revenue: number; cost: number; profit: number }>();
    for (const invoice of invoices) {
      const revenue = Number(invoice.subtotal) - Number(invoice.discountAmount);
      const cost = invoice.lines.reduce((sum, line) => sum + Number(line.quantity) * Number(line.costPerUnit), 0);
      const current = byCustomer.get(invoice.customerId) ?? { customerId: invoice.customerId, customer: invoice.customer.name, revenue: 0, cost: 0, profit: 0 };
      current.revenue += revenue; current.cost += cost; current.profit += revenue - cost;
      byCustomer.set(invoice.customerId, current);
    }
    return Array.from(byCustomer.values()).map((row) => ({ ...row, revenue: round2(row.revenue), cost: round2(row.cost), profit: round2(row.profit) })).sort((a, b) => b.profit - a.profit);
  },

  async createQuotation(userId: string, input: CreateQuotationInput) {
    await ownedBusiness(userId, input.businessId);
    const customer = await prisma.businessCustomer.findFirst({ where: { id: input.customerId, businessId: input.businessId, status: "ACTIVE" } });
    const products = await prisma.businessProduct.findMany({ where: { id: { in: input.lines.map((line) => line.productId) }, businessId: input.businessId, isActive: true }, select: { id: true } });
    if (!customer || products.length !== new Set(input.lines.map((line) => line.productId)).size) throw AppError.badRequest("Customer and products must belong to this business");
    const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.taxRate / 100, 0);
    return prisma.businessQuotation.create({ data: { businessId: input.businessId, customerId: input.customerId, quotationNumber: input.quotationNumber, issueDate: input.issueDate, validUntil: input.validUntil, status: BusinessQuotationStatus.SENT, subtotal: round2(subtotal), taxAmount: round2(taxAmount), totalAmount: round2(subtotal + taxAmount), notes: input.notes, lines: { create: input.lines } }, include: { customer: true, lines: { include: { product: true } } } });
  },

  async quotations(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessQuotation.findMany({ where: { businessId }, include: { customer: true, lines: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
  },

  async acceptQuotation(userId: string, quotationId: string) {
    const quotation = await prisma.businessQuotation.findFirst({ where: { id: quotationId, business: { userId } } });
    if (!quotation) throw AppError.notFound("Quotation not found");
    if (quotation.status !== BusinessQuotationStatus.SENT && quotation.status !== BusinessQuotationStatus.DRAFT) throw AppError.badRequest("Only draft or sent quotations can be accepted");
    if (quotation.validUntil < new Date()) throw AppError.badRequest("Quotation has expired");
    return prisma.businessQuotation.update({ where: { id: quotationId }, data: { status: BusinessQuotationStatus.ACCEPTED } });
  },

  async createSalesOrder(userId: string, input: CreateSalesOrderInput) {
    await ownedBusiness(userId, input.businessId);
    const customer = await prisma.businessCustomer.findFirst({ where: { id: input.customerId, businessId: input.businessId, status: "ACTIVE" } });
    const products = await prisma.businessProduct.findMany({ where: { id: { in: input.lines.map((line) => line.productId) }, businessId: input.businessId, isActive: true }, select: { id: true } });
    if (!customer || products.length !== new Set(input.lines.map((line) => line.productId)).size) throw AppError.badRequest("Customer and products must belong to this business");
    if (input.quotationId) {
      const quotation = await prisma.businessQuotation.findFirst({ where: { id: input.quotationId, businessId: input.businessId, customerId: input.customerId, status: BusinessQuotationStatus.ACCEPTED } });
      if (!quotation) throw AppError.badRequest("Only an accepted quotation can become a sales order");
    }
    const subtotal = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const taxAmount = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice * line.taxRate / 100, 0);
    return prisma.businessSalesOrder.create({ data: { businessId: input.businessId, customerId: input.customerId, quotationId: input.quotationId, orderNumber: input.orderNumber, orderDate: input.orderDate, status: BusinessSalesOrderStatus.CONFIRMED, subtotal: round2(subtotal), taxAmount: round2(taxAmount), totalAmount: round2(subtotal + taxAmount), notes: input.notes, lines: { create: input.lines } }, include: { customer: true, lines: { include: { product: true } } } });
  },

  async salesOrders(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessSalesOrder.findMany({ where: { businessId }, include: { customer: true, quotation: true, lines: { include: { product: true } } }, orderBy: { createdAt: "desc" } });
  },

  async createSalesReturn(userId: string, input: CreateSalesReturnInput) {
    await ownedBusiness(userId, input.businessId);
    await assertBusinessPeriodOpen(input.businessId, input.returnDate);
    const customer = await prisma.businessCustomer.findFirst({ where: { id: input.customerId, businessId: input.businessId, status: "ACTIVE" } });
    const warehouse = await prisma.businessWarehouse.findFirst({ where: { id: input.warehouseId, businessId: input.businessId, isActive: true } });
    const products = await prisma.businessProduct.findMany({ where: { id: { in: input.lines.map((line) => line.productId) }, businessId: input.businessId, isActive: true }, select: { id: true } });
    if (!customer || !warehouse || products.length !== new Set(input.lines.map((line) => line.productId)).size) throw AppError.badRequest("Customer, warehouse and products must belong to this business");
    const amount = input.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const returned = await prisma.$transaction(async (tx) => {
      const accounts = await ensureSalesAccounts(tx, input.businessId);
      const salesReturn = await tx.businessSalesReturn.create({ data: { businessId: input.businessId, customerId: input.customerId, invoiceId: input.invoiceId, warehouseId: input.warehouseId, returnNumber: input.returnNumber, returnDate: input.returnDate, amount: round2(amount), reason: input.reason, status: BusinessSalesReturnStatus.POSTED, lines: { create: input.lines } } });
      await tx.businessCreditNote.create({ data: { businessId: input.businessId, customerId: input.customerId, invoiceId: input.invoiceId, creditNumber: `RET-${input.returnNumber}`, issueDate: input.returnDate, amount: round2(amount), reason: input.reason, status: BusinessCreditNoteStatus.ISSUED } });
      await createBusinessJournalEntry(tx, { businessId: input.businessId, entryDate: input.returnDate, reference: input.returnNumber, description: `Sales return ${input.returnNumber}`, lines: [{ accountId: accounts.get("4000")!.id, debit: amount, credit: 0 }, { accountId: accounts.get("1100")!.id, debit: 0, credit: amount }] });
      const productRecords = await tx.businessProduct.findMany({ where: { businessId: input.businessId, id: { in: input.lines.map((line) => line.productId) }, isActive: true } });
      const productsById = new Map(productRecords.map((product) => [product.id, product]));
      for (const line of input.lines) {
        const product = productsById.get(line.productId);
        if (!product) throw AppError.badRequest("Sales return product does not belong to this business");
        await createMovementInTransaction(tx, { businessId: input.businessId, productId: line.productId, warehouseId: input.warehouseId, type: BusinessStockMovementType.SALES_RETURN, quantity: line.quantity, unitCost: line.unitCost, reference: input.returnNumber, movementDate: input.returnDate }, product);
      }
      return salesReturn;
    });
    return returned;
  },

  async salesReturns(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessSalesReturn.findMany({ where: { businessId }, include: { customer: true, invoice: true, warehouse: true, lines: { include: { product: true } } }, orderBy: { returnDate: "desc" } });
  },

  async payments(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessReceivablePayment.findMany({ where: { invoice: { businessId } }, include: { invoice: { include: { customer: true } } }, orderBy: { paymentDate: "desc" } });
  },

  async creditNotes(userId: string, businessId: string) {
    await ownedBusiness(userId, businessId);
    return prisma.businessCreditNote.findMany({ where: { businessId }, include: { customer: true, invoice: true }, orderBy: { issueDate: "desc" } });
  },
};
