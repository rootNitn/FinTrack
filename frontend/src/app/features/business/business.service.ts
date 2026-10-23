import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { BusinessAccount, BusinessAccountingSummary, BusinessAgeingRow, BusinessBom, BusinessCreditNote, BusinessCustomer, BusinessDashboard, BusinessEntry, BusinessEntryPayload, BusinessExpiryAlert, BusinessJournalEntry, BusinessPayment, BusinessProductionOrder, BusinessProduct, BusinessProductType, BusinessProfile, BusinessPurchaseOrder, BusinessReport, BusinessSalesInvoice, BusinessStockMovement, BusinessStockMovementType, BusinessSupplier, BusinessType, BusinessWarehouse, RetailSummary, ServiceClient, ServiceInvoice, ServiceMilestone, ServiceProject, ServiceProfitability } from './business.model';

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly api = inject(ApiBaseService);

  dashboard(): Observable<BusinessDashboard> {
    return this.api.get<BusinessDashboard>('/businesses/dashboard');
  }

  createEntry(payload: BusinessEntryPayload): Observable<BusinessEntry> {
    return this.api.post<BusinessEntry>('/businesses/entries', payload);
  }

  removeEntry(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/businesses/entries/${id}`);
  }

  listBusinesses(): Observable<BusinessProfile[]> {
    return this.api.get<BusinessProfile[]>('/businesses/profiles');
  }

  createBusiness(payload: { name: string; type: BusinessType; currency: string; fiscalYearStart: number }): Observable<BusinessProfile> {
    return this.api.post<BusinessProfile>('/businesses/profiles', payload);
  }

  listAccounts(businessId: string): Observable<BusinessAccount[]> {
    return this.api.get<BusinessAccount[]>(`/businesses/profiles/${businessId}/accounts`);
  }

  accountingSummary(businessId: string): Observable<BusinessAccountingSummary> {
    return this.api.get<BusinessAccountingSummary>(`/businesses/profiles/${businessId}/summary`);
  }

  journalEntries(businessId: string): Observable<BusinessJournalEntry[]> {
    return this.api.get<BusinessJournalEntry[]>(`/businesses/profiles/${businessId}/journal`);
  }

  createJournalEntry(payload: { businessId: string; entryDate: string; reference?: string; description: string; lines: Array<{ accountId: string; debit: number; credit: number }> }): Observable<BusinessJournalEntry> {
    return this.api.post<BusinessJournalEntry>('/businesses/journal', payload);
  }

  pendingJournalApprovals(): Observable<BusinessJournalEntry[]> {
    return this.api.get<BusinessJournalEntry[]>('/businesses/journal/pending');
  }

  approveJournalEntry(id: string): Observable<BusinessJournalEntry> {
    return this.api.post<BusinessJournalEntry>(`/businesses/journal/${id}/approve`, {});
  }

  rejectJournalEntry(id: string, reason: string): Observable<BusinessJournalEntry> {
    return this.api.post<BusinessJournalEntry>(`/businesses/journal/${id}/reject`, { reason });
  }

  reverseJournalEntry(id: string, entryDate?: string): Observable<BusinessJournalEntry> {
    return this.api.post<BusinessJournalEntry>(`/businesses/journal/${id}/reverse`, entryDate ? { entryDate } : {});
  }

  migrateLegacy(): Observable<{ businessesCreated: number; entriesMigrated: number }> {
    return this.api.post<{ businessesCreated: number; entriesMigrated: number }>('/businesses/migrate-legacy', {});
  }

  products(businessId: string): Observable<BusinessProduct[]> {
    return this.api.get<BusinessProduct[]>(`/businesses/profiles/${businessId}/products`);
  }

  createProduct(payload: { businessId: string; sku: string; barcode?: string; retailCategory?: string; brand?: string; name: string; type: BusinessProductType; unit: string; reorderLevel: number; standardCost: number; sellingPrice: number }): Observable<BusinessProduct> {
    return this.api.post<BusinessProduct>('/businesses/products', payload);
  }

  updateProduct(productId: string, payload: Partial<{ sku: string; barcode?: string; retailCategory?: string; brand?: string; name: string; type: BusinessProductType; unit: string; reorderLevel: number; standardCost: number; sellingPrice: number }>): Observable<BusinessProduct> {
    return this.api.patch<BusinessProduct>(`/businesses/products/${productId}`, payload);
  }

  warehouses(businessId: string): Observable<BusinessWarehouse[]> {
    return this.api.get<BusinessWarehouse[]>(`/businesses/profiles/${businessId}/warehouses`);
  }

  createWarehouse(payload: { businessId: string; name: string; location?: string }): Observable<BusinessWarehouse> {
    return this.api.post<BusinessWarehouse>('/businesses/warehouses', payload);
  }

  createMovement(payload: { businessId: string; productId: string; warehouseId: string; type: BusinessStockMovementType; quantity: number; unitCost: number; reference?: string }): Observable<unknown> {
    return this.api.post<unknown>('/businesses/movements', payload);
  }

  suppliers(businessId: string): Observable<BusinessSupplier[]> { return this.api.get<BusinessSupplier[]>(`/businesses/profiles/${businessId}/suppliers`); }
  boms(businessId: string): Observable<BusinessBom[]> { return this.api.get<BusinessBom[]>(`/businesses/profiles/${businessId}/boms`); }
  expiryAlerts(businessId: string): Observable<BusinessExpiryAlert[]> { return this.api.get<BusinessExpiryAlert[]>(`/businesses/profiles/${businessId}/expiry-alerts`); }
  createPurchaseOrder(payload: { businessId: string; supplierId: string; orderNumber: string; lines: Array<{ productId: string; orderedQuantity: number; unitCost: number }> }): Observable<unknown> { return this.api.post<unknown>('/businesses/purchase-orders', payload); }
  createProductionOrder(payload: { businessId: string; orderNumber: string; productId: string; warehouseId: string; bomId: string; plannedQuantity: number }): Observable<unknown> { return this.api.post<unknown>('/businesses/production-orders', payload); }
  customers(businessId: string): Observable<BusinessCustomer[]> { return this.api.get<BusinessCustomer[]>(`/businesses/profiles/${businessId}/customers`); }
  createCustomer(payload: { businessId: string; name: string; email?: string; phone?: string }): Observable<BusinessCustomer> { return this.api.post<BusinessCustomer>('/businesses/customers', payload); }
  salesInvoices(businessId: string): Observable<BusinessSalesInvoice[]> { return this.api.get<BusinessSalesInvoice[]>(`/businesses/profiles/${businessId}/sales-invoices`); }
  createSalesInvoice(payload: { businessId: string; customerId: string; invoiceNumber: string; warehouseId: string; dueDate: string; lines: Array<{ productId: string; quantity: number; unitPrice: number; taxRate: number }> }): Observable<BusinessSalesInvoice> { return this.api.post<BusinessSalesInvoice>('/businesses/sales-invoices', payload); }
  ageing(businessId: string): Observable<BusinessAgeingRow[]> { return this.api.get<BusinessAgeingRow[]>(`/businesses/profiles/${businessId}/receivables-ageing`); }
  receivePayment(invoiceId: string, payload: { amount: number; paymentMode: string; reference?: string }): Observable<BusinessPayment> { return this.api.post<BusinessPayment>(`/businesses/sales-invoices/${invoiceId}/payments`, payload); }
  payments(businessId: string): Observable<BusinessPayment[]> { return this.api.get<BusinessPayment[]>(`/businesses/profiles/${businessId}/receivable-payments`); }
  createCreditNote(payload: { businessId: string; customerId: string; invoiceId?: string; creditNumber: string; amount: number; reason: string }): Observable<BusinessCreditNote> { return this.api.post<BusinessCreditNote>('/businesses/credit-notes', payload); }
  creditNotes(businessId: string): Observable<BusinessCreditNote[]> { return this.api.get<BusinessCreditNote[]>(`/businesses/profiles/${businessId}/credit-notes`); }
  purchaseOrders(businessId: string): Observable<BusinessPurchaseOrder[]> { return this.api.get<BusinessPurchaseOrder[]>(`/businesses/profiles/${businessId}/purchase-orders`); }
  receivePurchaseOrder(orderId: string, payload: { warehouseId: string; received: Array<{ lineId: string; quantity: number }> }): Observable<BusinessPurchaseOrder> { return this.api.post<BusinessPurchaseOrder>(`/businesses/purchase-orders/${orderId}/receive`, payload); }
  productionOrders(businessId: string): Observable<BusinessProductionOrder[]> { return this.api.get<BusinessProductionOrder[]>(`/businesses/profiles/${businessId}/production-orders`); }
  startProductionOrder(orderId: string): Observable<BusinessProductionOrder> { return this.api.post<BusinessProductionOrder>(`/businesses/production-orders/${orderId}/start`, {}); }
  completeProductionOrder(orderId: string, producedQuantity: number): Observable<BusinessProductionOrder> { return this.api.post<BusinessProductionOrder>(`/businesses/production-orders/${orderId}/complete`, { producedQuantity }); }
  createBom(payload: { businessId: string; productId: string; version: number; scrapPercent: number; lines: Array<{ productId: string; quantity: number; unit: string }> }): Observable<BusinessBom> { return this.api.post<BusinessBom>('/businesses/boms', payload); }
  movements(businessId: string): Observable<BusinessStockMovement[]> { return this.api.get<BusinessStockMovement[]>(`/businesses/profiles/${businessId}/movements`); }
  transferStock(payload: { businessId: string; productId: string; fromWarehouseId: string; toWarehouseId: string; quantity: number; unitCost: number; reference?: string }): Observable<BusinessStockMovement> { return this.api.post<BusinessStockMovement>('/businesses/transfers', payload); }
  retailCatalogue(businessId: string, search?: string): Observable<BusinessProduct[]> { return this.api.get<BusinessProduct[]>(`/businesses/profiles/${businessId}/retail/catalogue`, { search }); }
  retailSummary(businessId: string): Observable<RetailSummary> { return this.api.get<RetailSummary>(`/businesses/profiles/${businessId}/retail/summary`); }
  serviceClients(businessId: string): Observable<ServiceClient[]> { return this.api.get<ServiceClient[]>(`/businesses/profiles/${businessId}/service-clients`); }
  createServiceClient(payload: { businessId: string; name: string; email?: string; phone?: string }): Observable<ServiceClient> { return this.api.post<ServiceClient>('/businesses/service-clients', payload); }
  serviceProjects(businessId: string): Observable<ServiceProject[]> { return this.api.get<ServiceProject[]>(`/businesses/profiles/${businessId}/service-projects`); }
  createServiceProject(payload: { businessId: string; clientId: string; name: string; code: string; startDate: string; budget: number; hourlyRate: number }): Observable<ServiceProject> { return this.api.post<ServiceProject>('/businesses/service-projects', payload); }
  serviceProfitability(projectId: string): Observable<ServiceProfitability> { return this.api.get<ServiceProfitability>(`/businesses/service-projects/${projectId}/profitability`); }
  createTimesheet(payload: { projectId: string; workDate: string; hours: number; hourlyRate: number; description?: string; billable: boolean }): Observable<unknown> { return this.api.post<unknown>('/businesses/service-timesheets', payload); }
  createProjectExpense(payload: { projectId: string; expenseDate: string; amount: number; description: string; billable: boolean }): Observable<unknown> { return this.api.post<unknown>('/businesses/service-expenses', payload); }
  milestones(projectId: string): Observable<ServiceMilestone[]> { return this.api.get<ServiceMilestone[]>(`/businesses/service-projects/${projectId}/milestones`); }
  createMilestone(payload: { projectId: string; name: string; dueDate?: string; amount: number }): Observable<ServiceMilestone> { return this.api.post<ServiceMilestone>('/businesses/service-milestones', payload); }
  serviceInvoices(projectId: string): Observable<ServiceInvoice[]> { return this.api.get<ServiceInvoice[]>(`/businesses/service-projects/${projectId}/invoices`); }
  createServiceInvoice(payload: { projectId: string; invoiceNumber: string; issueDate: string; dueDate: string; amount: number; description: string }): Observable<ServiceInvoice> { return this.api.post<ServiceInvoice>('/businesses/service-invoices', payload); }
  businessReport(businessId: string, report: BusinessReport['type']): Observable<BusinessReport> { return this.api.get<BusinessReport>(`/businesses/profiles/${businessId}/reports/${report}`); }
  exportBusinessReport(businessId: string, report: string, format: 'csv' | 'xlsx' | 'pdf'): Observable<Blob> { return this.api.getBlob(`/businesses/profiles/${businessId}/reports/${report}/export`, { format }); }
}
