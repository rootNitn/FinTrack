import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { BusinessService } from './business.service';
import { BusinessAccount, BusinessAccountingSummary, BusinessAgeingRow, BusinessBom, BusinessCreditNote, BusinessCustomer, BusinessDashboard, BusinessEntryType, BusinessExpiryAlert, BusinessJournalEntry, BusinessPayment, BusinessProductionOrder, BusinessProduct, BusinessProductType, BusinessProfile, BusinessPurchaseOrder, BusinessReport, BusinessSalesInvoice, BusinessStockMovement, BusinessStockMovementType, BusinessSupplier, BusinessType, BusinessWarehouse, RetailCartLine, RetailSummary, ServiceClient, ServiceInvoice, ServiceMilestone, ServiceProject, ServiceProfitability } from './business.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ChartCardComponent } from '../../shared/components/chart-card/chart-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../shared/components/skeleton-loader/skeleton-loader.component';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmDialogService } from '../../shared/components/confirm-dialog/confirm-dialog.service';
import { CHART_PALETTE } from '../../shared/charts/chart-style.util';
import { formatCurrency } from '../../shared/utils/currency.util';
import { formatDate } from '../../shared/utils/date.util';

@Component({
  selector: 'app-business',
  imports: [CommonModule, FormsModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, ChartCardComponent, EmptyStateComponent, SkeletonLoaderComponent],
  templateUrl: './business.component.html',
  styleUrl: './business.component.scss',
})
export class BusinessComponent implements OnInit {
  private readonly service = inject(BusinessService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly data = signal<BusinessDashboard | null>(null);
  readonly profiles = signal<BusinessProfile[]>([]);
  readonly selectedBusinessId = signal('');
  readonly accounting = signal<BusinessAccountingSummary | null>(null);
  readonly businessAccounts = signal<BusinessAccount[]>([]);
  readonly journalEntries = signal<BusinessJournalEntry[]>([]);
  readonly journalForm = signal({ entryDate: new Date().toISOString().slice(0, 10), reference: '', description: '', debitAccountId: '', debitAmount: 0, creditAccountId: '', creditAmount: 0 });
  readonly accountsLoading = signal(false);
  readonly showBusinessForm = signal(false);
  readonly businessForm = signal({ name: '', type: 'MANUFACTURING' as BusinessType });
  readonly products = signal<BusinessProduct[]>([]);
  readonly warehouses = signal<BusinessWarehouse[]>([]);
  readonly showWarehouseForm = signal(false);
  readonly warehouseForm = signal({ name: '', location: '' });
  readonly showManufacturingForm = signal(false);
  readonly editingProductId = signal<string | null>(null);
  readonly productForm = signal({ sku: '', barcode: '', retailCategory: '', brand: '', name: '', type: 'RAW_MATERIAL' as BusinessProductType, unit: 'PCS', reorderLevel: 0, standardCost: 0, sellingPrice: 0 });
  readonly movementForm = signal({ productId: '', warehouseId: '', type: 'PURCHASE' as BusinessStockMovementType, quantity: 0, unitCost: 0, reference: '' });
  readonly suppliers = signal<BusinessSupplier[]>([]);
  readonly boms = signal<BusinessBom[]>([]);
  readonly expiryAlerts = signal<BusinessExpiryAlert[]>([]);
  readonly orderForm = signal({ supplierId: '', productId: '', orderNumber: '', quantity: 0, unitCost: 0 });
  readonly productionForm = signal({ productId: '', bomId: '', orderNumber: '', plannedQuantity: 0, warehouseId: '' });
  readonly customers = signal<BusinessCustomer[]>([]);
  readonly salesInvoices = signal<BusinessSalesInvoice[]>([]);
  readonly ageing = signal<BusinessAgeingRow[]>([]);
  readonly salesForm = signal({ customerId: '', productId: '', warehouseId: '', invoiceNumber: '', quantity: 0, unitPrice: 0, dueDate: new Date().toISOString().slice(0, 10) });
  readonly customerForm = signal({ name: '', email: '', phone: '' });
  readonly payments = signal<BusinessPayment[]>([]);
  readonly creditNotes = signal<BusinessCreditNote[]>([]);
  readonly paymentForm = signal({ invoiceId: '', amount: 0, paymentMode: 'BANK_TRANSFER', reference: '' });
  readonly creditNoteForm = signal({ customerId: '', invoiceId: '', creditNumber: '', amount: 0, reason: '' });
  readonly purchaseOrders = signal<BusinessPurchaseOrder[]>([]);
  readonly productionOrders = signal<BusinessProductionOrder[]>([]);
  readonly movements = signal<BusinessStockMovement[]>([]);
  readonly retailSummary = signal<RetailSummary | null>(null);
  readonly retailSearch = signal('');
  readonly retailCatalogue = signal<BusinessProduct[]>([]);
  readonly retailCart = signal<RetailCartLine[]>([]);
  readonly posForm = signal({ customerId: '', warehouseId: '', invoiceNumber: `POS-${Date.now().toString().slice(-8)}`, dueDate: new Date().toISOString().slice(0, 10) });
  readonly retailPurchaseForm = signal({ supplierId: '', productId: '', orderNumber: `PUR-${Date.now().toString().slice(-8)}`, quantity: 0, unitCost: 0 });
  readonly retailReceiptForm = signal({ invoiceNumber: '', customerId: '', warehouseId: '', paymentMode: 'CASH' });
  readonly serviceClients = signal<ServiceClient[]>([]);
  readonly serviceProjects = signal<ServiceProject[]>([]);
  readonly selectedServiceProfitability = signal<ServiceProfitability | null>(null);
  readonly serviceMilestones = signal<ServiceMilestone[]>([]);
  readonly serviceInvoices = signal<ServiceInvoice[]>([]);
  readonly serviceTimesheetForm = signal({ projectId: '', workDate: new Date().toISOString().slice(0, 10), hours: 0, hourlyRate: 0, description: '' });
  readonly serviceExpenseForm = signal({ projectId: '', expenseDate: new Date().toISOString().slice(0, 10), amount: 0, description: '' });
  readonly milestoneForm = signal({ projectId: '', name: '', dueDate: new Date().toISOString().slice(0, 10), amount: 0 });
  readonly serviceInvoiceForm = signal({ projectId: '', invoiceNumber: `SVC-${Date.now().toString().slice(-8)}`, dueDate: new Date().toISOString().slice(0, 10), amount: 0, description: '' });
  readonly businessReport = signal<BusinessReport | null>(null);
  readonly businessReportType = signal('');
  readonly serviceClientForm = signal({ name: '', email: '', phone: '' });
  readonly serviceProjectForm = signal({ clientId: '', name: '', code: '', startDate: new Date().toISOString().slice(0, 10), budget: 0, hourlyRate: 0 });
  readonly receiveForm = signal({ orderId: '', lineId: '', warehouseId: '', quantity: 0 });
  readonly completionForm = signal({ orderId: '', quantity: 0 });
  readonly bomForm = signal({ productId: '', version: 1, scrapPercent: 0, componentProductId: '', componentQuantity: 0 });
  readonly transferForm = signal({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 0, unitCost: 0, reference: '' });
  readonly showForm = signal(false);
  readonly activeWorkspace = signal<'overview' | 'operations' | 'sales' | 'accounting'>('overview');
  readonly manufacturingExpanded = signal(false);
  readonly form = signal({ businessName: '', type: 'INVESTMENT' as BusinessEntryType, category: '', amount: null as number | null, date: new Date().toISOString().slice(0, 10), description: '' });

  readonly cashFlowOptions = computed<EChartsCoreOption | null>(() => {
    const monthly = this.data()?.monthly;
    if (!monthly?.length) return null;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => this.currency(v as number) },
      legend: { top: 0, data: ['Investment', 'Income', 'Expense', 'Profit'] },
      grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: monthly.map((row) => row.label) },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => this.currency(v) } },
      series: [
        { name: 'Investment', type: 'bar', data: monthly.map((row) => row.investment), itemStyle: { color: CHART_PALETTE[5] }, barMaxWidth: 18 },
        { name: 'Income', type: 'bar', data: monthly.map((row) => row.income), itemStyle: { color: CHART_PALETTE[1] }, barMaxWidth: 18 },
        { name: 'Expense', type: 'bar', data: monthly.map((row) => row.expense), itemStyle: { color: CHART_PALETTE[6] }, barMaxWidth: 18 },
        { name: 'Profit', type: 'line', smooth: true, data: monthly.map((row) => row.profit), itemStyle: { color: CHART_PALETTE[0] } },
      ],
    };
  });

  readonly spendingOptions = computed<EChartsCoreOption | null>(() => {
    const spending = this.data()?.spending;
    if (!spending?.length) return null;
    return {
      tooltip: { trigger: 'item', formatter: (point: { name: string; value: number; percent: number }) => `${point.name}: ${this.currency(point.value)} (${point.percent}%)` },
      legend: { orient: 'vertical', left: 0, top: 'middle', textStyle: { fontSize: 11 } },
      series: [{ type: 'pie', radius: ['45%', '75%'], center: ['65%', '50%'], data: spending.map((item, index) => ({ name: item.category, value: item.amount, itemStyle: { color: CHART_PALETTE[index % CHART_PALETTE.length] } })), label: { show: false } }],
    };
  });

  ngOnInit(): void {
    this.load();
    this.service.listBusinesses().subscribe({ next: (profiles) => {
      const ownedProfiles = profiles.filter((profile) => profile.currentUserRole === 'OWNER');
      if (!ownedProfiles.length && profiles.length) {
        this.router.navigate(['/business/journal-approvals']);
        return;
      }
      this.profiles.set(ownedProfiles);
      if (ownedProfiles[0]) this.selectBusiness(ownedProfiles[0].id);
    } });
  }

  load(): void {
    this.loading.set(true);
    this.service.dashboard().subscribe({
      next: (data) => { this.data.set(data); this.loading.set(false); },
      error: (err) => { this.error.set(err?.error?.error?.message ?? 'Unable to load business data.'); this.loading.set(false); },
    });
  }

  selectBusiness(id: string): void {
    this.selectedBusinessId.set(id);
    const profile = this.profiles().find((item) => item.id === id);
    if (profile) this.updateField('businessName', profile.name);
    this.accountsLoading.set(true);
    this.service.accountingSummary(id).subscribe({ next: (summary) => { this.accounting.set(summary); this.accountsLoading.set(false); }, error: () => this.accountsLoading.set(false) });
    this.service.listAccounts(id).subscribe({ next: (accounts) => this.businessAccounts.set(accounts) });
    this.service.journalEntries(id).subscribe({ next: (entries) => this.journalEntries.set(entries) });
    this.service.products(id).subscribe({ next: (products) => this.products.set(products) });
    this.service.warehouses(id).subscribe({ next: (warehouses) => { this.warehouses.set(warehouses); if (warehouses[0]) { this.movementForm.update((current) => ({ ...current, warehouseId: warehouses[0].id })); this.salesForm.update((current) => ({ ...current, warehouseId: current.warehouseId || warehouses[0].id })); } } });
    this.service.suppliers(id).subscribe({ next: (suppliers) => this.suppliers.set(suppliers) });
    this.service.boms(id).subscribe({ next: (boms) => this.boms.set(boms) });
    this.service.expiryAlerts(id).subscribe({ next: (alerts) => this.expiryAlerts.set(alerts) });
    this.service.customers(id).subscribe({ next: (customers) => this.customers.set(customers) });
    this.service.salesInvoices(id).subscribe({ next: (invoices) => this.salesInvoices.set(invoices) });
    this.service.ageing(id).subscribe({ next: (rows) => this.ageing.set(rows) });
    this.service.payments(id).subscribe({ next: (payments) => this.payments.set(payments) });
    this.service.creditNotes(id).subscribe({ next: (notes) => this.creditNotes.set(notes) });
    this.service.purchaseOrders(id).subscribe({ next: (orders) => this.purchaseOrders.set(orders) });
    this.service.productionOrders(id).subscribe({ next: (orders) => this.productionOrders.set(orders) });
    this.service.movements(id).subscribe({ next: (movements) => this.movements.set(movements) });
    this.service.retailSummary(id).subscribe({ next: (summary) => this.retailSummary.set(summary) });
    this.service.retailCatalogue(id).subscribe({ next: (products) => this.retailCatalogue.set(products) });
    this.service.serviceClients(id).subscribe({ next: (clients) => this.serviceClients.set(clients) });
    this.service.serviceProjects(id).subscribe({ next: (projects) => this.serviceProjects.set(projects) });
  }

  scrollToBusinessSection(sectionId: string): void {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  startBusinessSetup(): void {
    this.showBusinessForm.set(true);
    this.scrollToBusinessSection('business-setup');
  }

  setWorkspace(workspace: 'overview' | 'operations' | 'sales' | 'accounting'): void {
    this.activeWorkspace.set(workspace);
  }

  switchWorkspaceAndScroll(workspace: 'operations' | 'sales' | 'accounting', sectionId: string): void {
    this.setWorkspace(workspace);
    queueMicrotask(() => this.scrollToBusinessSection(sectionId));
  }

  updateBusinessField(field: 'name' | 'type', value: string): void { this.businessForm.update((current) => ({ ...current, [field]: value })); }

  createBusiness(): void {
    const value = this.businessForm();
    if (!value.name.trim()) { this.toast.error('Business name is required.'); return; }
    this.service.createBusiness({ name: value.name.trim(), type: value.type, currency: 'INR', fiscalYearStart: 4 }).subscribe({
      next: (profile) => { this.toast.success('Business profile created with a manufacturing chart of accounts.'); this.profiles.update((items) => [...items, profile]); this.showBusinessForm.set(false); this.businessForm.set({ name: '', type: 'MANUFACTURING' }); this.selectBusiness(profile.id); },
      error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create business profile.'),
    });
  }

  migrateLegacy(): void {
    this.service.migrateLegacy().subscribe({ next: (result) => { this.toast.success(`${result.entriesMigrated} legacy entries migrated into ${result.businessesCreated} business profile(s).`); this.ngOnInit(); }, error: () => this.toast.error('Could not migrate legacy entries.') });
  }

  updateJournalField(field: keyof ReturnType<typeof this.journalForm>, value: string | number): void {
    this.journalForm.update((current) => ({ ...current, [field]: value }));
  }

  createJournalEntry(): void {
    const businessId = this.selectedBusinessId();
    const form = this.journalForm();
    if (!businessId || !form.description.trim() || !form.debitAccountId || !form.creditAccountId || form.debitAccountId === form.creditAccountId || form.debitAmount <= 0 || form.creditAmount <= 0) {
      this.toast.error('Enter a description, two different accounts, and positive debit/credit amounts.');
      return;
    }
    if (Math.abs(form.debitAmount - form.creditAmount) > 0.01) {
      this.toast.error('Journal debits and credits must balance.');
      return;
    }
    this.service.createJournalEntry({
      businessId,
      entryDate: form.entryDate,
      reference: form.reference.trim() || undefined,
      description: form.description.trim(),
      lines: [
        { accountId: form.debitAccountId, debit: form.debitAmount, credit: 0 },
        { accountId: form.creditAccountId, debit: 0, credit: form.creditAmount },
      ],
    }).subscribe({
      next: () => {
        this.toast.success('Journal submitted for approval.');
        this.journalForm.set({ entryDate: new Date().toISOString().slice(0, 10), reference: '', description: '', debitAccountId: '', debitAmount: 0, creditAccountId: '', creditAmount: 0 });
        this.selectBusiness(businessId);
      },
      error: (error) => this.toast.error(error?.error?.error?.message ?? 'Could not submit the journal entry.'),
    });
  }

  reverseJournalEntry(entry: BusinessJournalEntry): void {
    this.confirm.open({
      title: 'Reverse journal entry',
      message: `Create an equal and opposite posted entry for "${entry.description}"? The original will remain in the ledger for audit history.`,
      confirmLabel: 'Create reversal',
      danger: true,
    }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.reverseJournalEntry(entry.id).subscribe({
        next: () => {
          this.toast.success('Reversal posted.');
          this.selectBusiness(entry.businessId);
        },
        error: (error) => this.toast.error(error?.error?.error?.message ?? 'Could not reverse the journal entry.'),
      });
    });
  }

  journalDate(value: string): string { return formatDate(value); }

  updateProductField(field: keyof ReturnType<typeof this.productForm>, value: string | number): void { this.productForm.update((current) => ({ ...current, [field]: value })); }
  updateMovementField(field: keyof ReturnType<typeof this.movementForm>, value: string | number): void { this.movementForm.update((current) => ({ ...current, [field]: value })); }

  saveProduct(): void {
    const businessId = this.selectedBusinessId();
    const value = this.productForm();
    if (!businessId || !value.sku.trim() || !value.name.trim()) { this.toast.error('Business, SKU and product name are required.'); return; }
    const payload = { sku: value.sku.trim(), barcode: value.barcode.trim() || undefined, retailCategory: value.retailCategory.trim() || undefined, brand: value.brand.trim() || undefined, name: value.name.trim(), type: value.type, unit: value.unit, reorderLevel: value.reorderLevel, standardCost: value.standardCost, sellingPrice: value.sellingPrice };
    const request = this.editingProductId() ? this.service.updateProduct(this.editingProductId()!, payload) : this.service.createProduct({ ...payload, businessId });
    request.subscribe({ next: () => { this.toast.success(this.editingProductId() ? 'Product updated.' : 'Product added.'); this.cancelProductEdit(); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not save product.') });
  }

  editProduct(product: BusinessProduct): void {
    this.editingProductId.set(product.id);
    this.productForm.set({ sku: product.sku, barcode: product.barcode ?? '', retailCategory: product.retailCategory ?? '', brand: product.brand ?? '', name: product.name, type: product.type, unit: product.unit, reorderLevel: product.reorderLevel, standardCost: product.standardCost, sellingPrice: product.sellingPrice });
    this.showManufacturingForm.set(true);
  }

  cancelProductEdit(): void {
    this.editingProductId.set(null);
    this.productForm.set({ sku: '', barcode: '', retailCategory: '', brand: '', name: '', type: 'RAW_MATERIAL', unit: 'PCS', reorderLevel: 0, standardCost: 0, sellingPrice: 0 });
    this.showManufacturingForm.set(false);
  }

  saveMovement(): void {
    const businessId = this.selectedBusinessId();
    const value = this.movementForm();
    if (!businessId || !value.productId || !value.warehouseId || value.quantity <= 0) { this.toast.error('Select a product, warehouse and positive quantity.'); return; }
    this.service.createMovement({ ...value, businessId, reference: value.reference.trim() || undefined }).subscribe({ next: () => { this.toast.success('Stock movement recorded and posted to accounting.'); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not record stock movement.') });
  }

  updateWarehouseField(field: keyof ReturnType<typeof this.warehouseForm>, value: string): void { this.warehouseForm.update((current) => ({ ...current, [field]: value })); }

  saveWarehouse(): void {
    const businessId = this.selectedBusinessId();
    const value = this.warehouseForm();
    if (!businessId || !value.name.trim()) { this.toast.error('Warehouse name is required.'); return; }
    this.service.createWarehouse({ businessId, name: value.name.trim(), location: value.location.trim() || undefined }).subscribe({
      next: (warehouse) => { this.toast.success('Warehouse added.'); this.warehouses.update((items) => [...items, warehouse]); this.movementForm.update((current) => ({ ...current, warehouseId: warehouse.id })); this.transferForm.update((current) => ({ ...current, toWarehouseId: warehouse.id })); this.warehouseForm.set({ name: '', location: '' }); this.showWarehouseForm.set(false); },
      error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not add warehouse.'),
    });
  }

  updateOrderField(field: keyof ReturnType<typeof this.orderForm>, value: string | number): void { this.orderForm.update((current) => ({ ...current, [field]: value })); }
  updateProductionField(field: keyof ReturnType<typeof this.productionForm>, value: string | number): void { this.productionForm.update((current) => ({ ...current, [field]: value })); }
  selectProductionProduct(productId: string): void { this.productionForm.update((current) => ({ ...current, productId, bomId: '' })); }

  savePurchaseOrder(): void {
    const businessId = this.selectedBusinessId(); const value = this.orderForm();
    if (!businessId || !value.supplierId || !value.productId || !value.orderNumber.trim() || value.quantity <= 0) { this.toast.error('Supplier, product, order number and quantity are required.'); return; }
    this.service.createPurchaseOrder({ businessId, supplierId: value.supplierId, orderNumber: value.orderNumber.trim(), lines: [{ productId: value.productId, orderedQuantity: value.quantity, unitCost: value.unitCost }] }).subscribe({ next: () => { this.toast.success('Purchase order created.'); this.orderForm.set({ supplierId: '', productId: '', orderNumber: '', quantity: 0, unitCost: 0 }); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create purchase order.') });
  }

  saveProductionOrder(): void {
    const businessId = this.selectedBusinessId(); const value = this.productionForm();
    if (!businessId || !value.productId || !value.bomId || !value.warehouseId || !value.orderNumber.trim() || value.plannedQuantity <= 0) { this.toast.error('Finished product, BOM, warehouse, order number and quantity are required.'); return; }
    this.service.createProductionOrder({ businessId, ...value, orderNumber: value.orderNumber.trim() }).subscribe({ next: () => { this.toast.success('Production order created.'); this.productionForm.set({ productId: '', bomId: '', orderNumber: '', plannedQuantity: 0, warehouseId: value.warehouseId }); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create production order.') });
  }

  updateSalesField(field: keyof ReturnType<typeof this.salesForm>, value: string | number): void { this.salesForm.update((current) => ({ ...current, [field]: value })); }
  updateCustomerField(field: keyof ReturnType<typeof this.customerForm>, value: string): void { this.customerForm.update((current) => ({ ...current, [field]: value })); }

  saveCustomer(): void {
    const businessId = this.selectedBusinessId(); const value = this.customerForm();
    if (!businessId || !value.name.trim()) { this.toast.error('Customer name is required.'); return; }
    this.service.createCustomer({ businessId, name: value.name.trim(), email: value.email.trim() || undefined, phone: value.phone.trim() || undefined }).subscribe({ next: (customer) => { this.toast.success('Customer added.'); this.customers.update((items) => [...items, customer]); this.salesForm.update((current) => ({ ...current, customerId: customer.id })); this.customerForm.set({ name: '', email: '', phone: '' }); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not add customer.') });
  }

  updatePaymentField(field: keyof ReturnType<typeof this.paymentForm>, value: string | number): void { this.paymentForm.update((current) => ({ ...current, [field]: value })); }
  updateCreditNoteField(field: keyof ReturnType<typeof this.creditNoteForm>, value: string | number): void { this.creditNoteForm.update((current) => ({ ...current, [field]: value })); }

  savePayment(): void {
    const businessId = this.selectedBusinessId(); const value = this.paymentForm();
    if (!businessId || !value.invoiceId || value.amount <= 0) { this.toast.error('Select an invoice and enter a positive payment amount.'); return; }
    this.service.receivePayment(value.invoiceId, { amount: value.amount, paymentMode: value.paymentMode, reference: value.reference.trim() || undefined }).subscribe({ next: () => { this.toast.success('Payment recorded.'); this.paymentForm.set({ invoiceId: '', amount: 0, paymentMode: 'BANK_TRANSFER', reference: '' }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not record payment.') });
  }

  saveCreditNote(): void {
    const businessId = this.selectedBusinessId(); const value = this.creditNoteForm();
    if (!businessId || !value.customerId || !value.creditNumber.trim() || value.amount <= 0 || !value.reason.trim()) { this.toast.error('Customer, credit number, amount and reason are required.'); return; }
    this.service.createCreditNote({ businessId, customerId: value.customerId, invoiceId: value.invoiceId || undefined, creditNumber: value.creditNumber.trim(), amount: value.amount, reason: value.reason.trim() }).subscribe({ next: () => { this.toast.success('Credit note issued.'); this.creditNoteForm.set({ customerId: '', invoiceId: '', creditNumber: '', amount: 0, reason: '' }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not issue credit note.') });
  }

  updateReceiveField(field: keyof ReturnType<typeof this.receiveForm>, value: string | number): void { this.receiveForm.update((current) => ({ ...current, [field]: value })); }
  updateCompletionField(field: keyof ReturnType<typeof this.completionForm>, value: string | number): void { this.completionForm.update((current) => ({ ...current, [field]: value })); }
  updateBomField(field: keyof ReturnType<typeof this.bomForm>, value: string | number): void { this.bomForm.update((current) => ({ ...current, [field]: value })); }
  updateTransferField(field: keyof ReturnType<typeof this.transferForm>, value: string | number): void { this.transferForm.update((current) => ({ ...current, [field]: value })); }
  purchaseLines(): BusinessPurchaseOrder['lines'] { return this.purchaseOrders().find((order) => order.id === this.receiveForm().orderId)?.lines ?? []; }
  selectReceiveOrder(orderId: string): void { const firstLine = this.purchaseOrders().find((order) => order.id === orderId)?.lines.find((line) => line.receivedQuantity < line.orderedQuantity); this.receiveForm.update((current) => ({ ...current, orderId, lineId: firstLine?.id ?? '', quantity: 0 })); }

  receivePurchase(): void {
    const businessId = this.selectedBusinessId(); const value = this.receiveForm();
    if (!businessId || !value.orderId || !value.lineId || !value.warehouseId || value.quantity <= 0) { this.toast.error('Select an order, line, warehouse and positive quantity.'); return; }
    this.service.receivePurchaseOrder(value.orderId, { warehouseId: value.warehouseId, received: [{ lineId: value.lineId, quantity: value.quantity }] }).subscribe({ next: () => { this.toast.success('Purchase receipt posted to stock and accounting.'); this.receiveForm.set({ orderId: '', lineId: '', warehouseId: value.warehouseId, quantity: 0 }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not receive purchase order.') });
  }

  startProduction(order: BusinessProductionOrder): void { this.service.startProductionOrder(order.id).subscribe({ next: () => { this.toast.success('Production started.'); this.selectBusiness(this.selectedBusinessId()); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not start production.') }); }
  completeProduction(): void {
    const value = this.completionForm();
    if (!value.orderId || value.quantity <= 0) { this.toast.error('Select a production order and enter output quantity.'); return; }
    this.service.completeProductionOrder(value.orderId, value.quantity).subscribe({ next: () => { this.toast.success('Production completed and stock/accounting updated.'); this.completionForm.set({ orderId: '', quantity: 0 }); this.selectBusiness(this.selectedBusinessId()); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not complete production.') });
  }

  saveBom(): void {
    const businessId = this.selectedBusinessId(); const value = this.bomForm();
    if (!businessId || !value.productId || !value.componentProductId || value.componentQuantity <= 0) { this.toast.error('Select finished product, component and quantity.'); return; }
    this.service.createBom({ businessId, productId: value.productId, version: value.version, scrapPercent: value.scrapPercent, lines: [{ productId: value.componentProductId, quantity: value.componentQuantity, unit: 'PCS' }] }).subscribe({ next: () => { this.toast.success('BOM version created.'); this.bomForm.set({ productId: '', version: 1, scrapPercent: 0, componentProductId: '', componentQuantity: 0 }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create BOM.') });
  }

  transferStock(): void {
    const businessId = this.selectedBusinessId(); const value = this.transferForm();
    if (!businessId || !value.productId || !value.fromWarehouseId || !value.toWarehouseId || value.fromWarehouseId === value.toWarehouseId || value.quantity <= 0) { this.toast.error('Select different source/destination warehouses and a positive quantity.'); return; }
    this.service.transferStock({ ...value, businessId, reference: value.reference.trim() || undefined }).subscribe({ next: () => { this.toast.success('Stock transferred and journaled.'); this.transferForm.set({ productId: '', fromWarehouseId: '', toWarehouseId: '', quantity: 0, unitCost: 0, reference: '' }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not transfer stock.') });
  }

  searchRetail(value: string): void { this.retailSearch.set(value); const businessId = this.selectedBusinessId(); if (businessId) this.service.retailCatalogue(businessId, value.trim() || undefined).subscribe({ next: (products) => this.retailCatalogue.set(products) }); }

  addToRetailCart(product: BusinessProduct): void {
    if (product.stock <= 0) { this.toast.error(`${product.name} has no available stock.`); return; }
    this.retailCart.update((lines) => {
      const existing = lines.find((line) => line.product.id === product.id);
      if (existing) return lines.map((line) => line.product.id === product.id ? { ...line, quantity: Math.min(line.quantity + 1, product.stock) } : line);
      return [...lines, { product, quantity: 1, unitPrice: product.sellingPrice }];
    });
  }

  updateCartQuantity(productId: string, quantity: number): void {
    const line = this.retailCart().find((item) => item.product.id === productId);
    if (!line) return;
    if (quantity <= 0) { this.removeFromRetailCart(productId); return; }
    line.quantity = Math.min(quantity, line.product.stock);
    this.retailCart.set([...this.retailCart()]);
  }

  removeFromRetailCart(productId: string): void { this.retailCart.update((lines) => lines.filter((line) => line.product.id !== productId)); }
  cartTotal(): number { return this.retailCart().reduce((sum, line) => sum + line.quantity * line.unitPrice, 0); }
  updatePosField(field: keyof ReturnType<typeof this.posForm>, value: string): void { this.posForm.update((current) => ({ ...current, [field]: value })); }

  checkoutRetail(): void {
    const businessId = this.selectedBusinessId(); const pos = this.posForm(); const cart = this.retailCart();
    if (!businessId || !pos.customerId || !pos.warehouseId || !cart.length || !pos.invoiceNumber.trim()) { this.toast.error('Select customer, warehouse, add products, and enter receipt number.'); return; }
    this.service.createSalesInvoice({ businessId, customerId: pos.customerId, warehouseId: pos.warehouseId, invoiceNumber: pos.invoiceNumber.trim(), dueDate: pos.dueDate, lines: cart.map((line) => ({ productId: line.product.id, quantity: line.quantity, unitPrice: line.unitPrice, taxRate: 0 })) }).subscribe({
      next: () => { this.toast.success('Retail sale completed.'); this.retailCart.set([]); this.posForm.set({ customerId: '', warehouseId: pos.warehouseId, invoiceNumber: `POS-${Date.now().toString().slice(-8)}`, dueDate: new Date().toISOString().slice(0, 10) }); this.selectBusiness(businessId); },
      error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not complete retail sale.'),
    });
  }

  updateRetailPurchaseField(field: keyof ReturnType<typeof this.retailPurchaseForm>, value: string | number): void { this.retailPurchaseForm.update((current) => ({ ...current, [field]: value })); }
  updateRetailReceiptField(field: keyof ReturnType<typeof this.retailReceiptForm>, value: string): void { this.retailReceiptForm.update((current) => ({ ...current, [field]: value })); }

  createRetailPurchase(): void {
    const businessId = this.selectedBusinessId(); const value = this.retailPurchaseForm();
    if (!businessId || !value.supplierId || !value.productId || value.quantity <= 0 || value.unitCost < 0) { this.toast.error('Select supplier/product and enter a valid quantity and cost.'); return; }
    this.service.createPurchaseOrder({ businessId, supplierId: value.supplierId, orderNumber: value.orderNumber.trim(), lines: [{ productId: value.productId, orderedQuantity: value.quantity, unitCost: value.unitCost }] }).subscribe({ next: () => { this.toast.success('Retail purchase order created. Receive it from Purchase Receipts.'); this.retailPurchaseForm.set({ supplierId: '', productId: '', orderNumber: `PUR-${Date.now().toString().slice(-8)}`, quantity: 0, unitCost: 0 }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create retail purchase.') });
  }

  prepareRetailReceipt(): void {
    const value = this.retailReceiptForm();
    this.posForm.update((current) => ({ ...current, customerId: value.customerId, warehouseId: value.warehouseId, invoiceNumber: value.invoiceNumber.trim() || `POS-${Date.now().toString().slice(-8)}` }));
    this.toast.success('Receipt details prepared for checkout.');
  }

  updateServiceClientField(field: keyof ReturnType<typeof this.serviceClientForm>, value: string): void { this.serviceClientForm.update((current) => ({ ...current, [field]: value })); }
  updateServiceProjectField(field: keyof ReturnType<typeof this.serviceProjectForm>, value: string | number): void { this.serviceProjectForm.update((current) => ({ ...current, [field]: value })); }
  saveServiceClient(): void {
    const businessId = this.selectedBusinessId(); const value = this.serviceClientForm();
    if (!businessId || !value.name.trim()) { this.toast.error('Service client name is required.'); return; }
    this.service.createServiceClient({ businessId, name: value.name.trim(), email: value.email.trim() || undefined, phone: value.phone.trim() || undefined }).subscribe({ next: (client) => { this.toast.success('Service client added.'); this.serviceClients.update((items) => [...items, client]); this.serviceProjectForm.update((current) => ({ ...current, clientId: client.id })); this.serviceClientForm.set({ name: '', email: '', phone: '' }); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not add service client.') });
  }
  saveServiceProject(): void {
    const businessId = this.selectedBusinessId(); const value = this.serviceProjectForm();
    if (!businessId || !value.clientId || !value.name.trim() || !value.code.trim()) { this.toast.error('Client, project name and code are required.'); return; }
    this.service.createServiceProject({ businessId, ...value, name: value.name.trim(), code: value.code.trim() }).subscribe({ next: (project) => { this.toast.success('Service project created.'); this.serviceProjects.update((items) => [project, ...items]); this.serviceProjectForm.set({ clientId: '', name: '', code: '', startDate: new Date().toISOString().slice(0, 10), budget: 0, hourlyRate: 0 }); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create service project.') });
  }
  viewServiceProfitability(project: ServiceProject): void { this.service.serviceProfitability(project.id).subscribe({ next: (result) => { this.selectedServiceProfitability.set(result); this.serviceMilestones.set([]); this.service.milestones(project.id).subscribe({ next: (items) => this.serviceMilestones.set(items) }); this.service.serviceInvoices(project.id).subscribe({ next: (items) => this.serviceInvoices.set(items) }); }, error: () => this.toast.error('Could not load project profitability.') }); }
  updateServiceTimesheetField(field: keyof ReturnType<typeof this.serviceTimesheetForm>, value: string | number): void { this.serviceTimesheetForm.update((current) => ({ ...current, [field]: value })); }
  updateServiceExpenseField(field: keyof ReturnType<typeof this.serviceExpenseForm>, value: string | number): void { this.serviceExpenseForm.update((current) => ({ ...current, [field]: value })); }
  updateMilestoneField(field: keyof ReturnType<typeof this.milestoneForm>, value: string | number): void { this.milestoneForm.update((current) => ({ ...current, [field]: value })); }
  updateServiceInvoiceField(field: keyof ReturnType<typeof this.serviceInvoiceForm>, value: string | number): void { this.serviceInvoiceForm.update((current) => ({ ...current, [field]: value })); }
  saveTimesheet(): void { const value = this.serviceTimesheetForm(); if (!value.projectId || value.hours <= 0) { this.toast.error('Select a project and enter positive hours.'); return; } this.service.createTimesheet({ ...value, billable: true }).subscribe({ next: () => { this.toast.success('Timesheet saved.'); this.serviceTimesheetForm.update((current) => ({ ...current, hours: 0, description: '' })); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not save timesheet.') }); }
  saveServiceExpense(): void { const value = this.serviceExpenseForm(); if (!value.projectId || value.amount <= 0 || !value.description.trim()) { this.toast.error('Select a project, amount and description.'); return; } this.service.createProjectExpense({ ...value, description: value.description.trim(), billable: true }).subscribe({ next: () => { this.toast.success('Project expense saved.'); this.serviceExpenseForm.update((current) => ({ ...current, amount: 0, description: '' })); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not save project expense.') }); }
  saveMilestone(): void { const value = this.milestoneForm(); if (!value.projectId || !value.name.trim()) { this.toast.error('Select a project and milestone name.'); return; } this.service.createMilestone({ ...value, name: value.name.trim() }).subscribe({ next: () => { this.toast.success('Milestone added.'); this.milestoneForm.update((current) => ({ ...current, name: '', amount: 0 })); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not add milestone.') }); }
  saveServiceInvoice(): void { const value = this.serviceInvoiceForm(); if (!value.projectId || !value.invoiceNumber.trim() || value.amount <= 0 || !value.description.trim()) { this.toast.error('Select a project, invoice number, amount and description.'); return; } this.service.createServiceInvoice({ ...value, invoiceNumber: value.invoiceNumber.trim(), description: value.description.trim(), issueDate: new Date().toISOString() }).subscribe({ next: () => { this.toast.success('Service invoice created.'); this.serviceInvoiceForm.update((current) => ({ ...current, invoiceNumber: `SVC-${Date.now().toString().slice(-8)}`, amount: 0, description: '' })); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not create service invoice.') }); }
  saveSelectedMilestone(projectId: string): void { this.milestoneForm.update((current) => ({ ...current, projectId })); this.saveMilestone(); }
  saveSelectedServiceInvoice(projectId: string): void { this.serviceInvoiceForm.update((current) => ({ ...current, projectId })); this.saveServiceInvoice(); }
  loadBusinessReport(report: 'trial-balance' | 'profit-and-loss' | 'balance-sheet' | 'cash-flow' | 'general-ledger'): void { const businessId = this.selectedBusinessId(); if (!businessId) return; this.service.businessReport(businessId, report).subscribe({ next: (result) => { this.businessReportType.set(report); this.businessReport.set(result); }, error: () => this.toast.error('Could not load business report.') }); }
  exportBusinessReport(format: 'csv' | 'xlsx' | 'pdf'): void { const businessId = this.selectedBusinessId(); const report = this.businessReportType(); if (!businessId || !report) return; this.service.exportBusinessReport(businessId, report, format).subscribe({ next: (blob) => { const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${report}-business-report.${format}`; link.click(); URL.revokeObjectURL(link.href); }, error: () => this.toast.error('Could not export business report.') }); }

  saveSalesInvoice(): void {
    const businessId = this.selectedBusinessId(); const value = this.salesForm();
    if (!businessId || !value.customerId || !value.productId || !value.warehouseId || !value.invoiceNumber.trim() || value.quantity <= 0 || value.unitPrice < 0 || !value.dueDate) { this.toast.error('Customer, product, warehouse, invoice number, quantity and due date are required.'); return; }
    this.service.createSalesInvoice({ businessId, customerId: value.customerId, invoiceNumber: value.invoiceNumber.trim(), warehouseId: value.warehouseId, dueDate: value.dueDate, lines: [{ productId: value.productId, quantity: value.quantity, unitPrice: value.unitPrice, taxRate: 0 }] }).subscribe({ next: () => { this.toast.success('Invoice issued and stock/accounting updated.'); this.salesForm.set({ customerId: '', productId: '', warehouseId: value.warehouseId, invoiceNumber: '', quantity: 0, unitPrice: 0, dueDate: new Date().toISOString().slice(0, 10) }); this.selectBusiness(businessId); }, error: (err) => this.toast.error(err?.error?.error?.message ?? 'Could not issue invoice.') });
  }

  updateField(field: keyof ReturnType<typeof this.form>, value: string | number | null): void {
    this.form.update((current) => ({ ...current, [field]: value }));
  }

  save(): void {
    const value = this.form();
    if (!value.businessName.trim() || !value.amount || value.amount <= 0 || !value.date) {
      this.toast.error('Business name, amount and date are required.');
      return;
    }
    this.saving.set(true);
    this.service.createEntry({ ...value, businessName: value.businessName.trim(), category: value.category.trim() || undefined, description: value.description.trim() || undefined, amount: value.amount }).subscribe({
      next: () => { this.toast.success('Business entry added.'); this.showForm.set(false); this.resetForm(); this.saving.set(false); this.load(); },
      error: (err) => { this.saving.set(false); this.toast.error(err?.error?.error?.message ?? 'Could not save business entry.'); },
    });
  }

  remove(entry: BusinessDashboard['entries'][number]): void {
    this.confirm.open({ title: 'Delete business entry?', message: `${entry.businessName} - ${this.currency(entry.amount)}` }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.service.removeEntry(entry.id).subscribe({ next: () => { this.toast.success('Entry deleted.'); this.load(); }, error: () => this.toast.error('Could not delete entry.') });
    });
  }

  resetForm(): void { this.form.set({ businessName: '', type: 'INVESTMENT', category: '', amount: null, date: new Date().toISOString().slice(0, 10), description: '' }); }
  currency(value: number): string { return formatCurrency(value, { maximumFractionDigits: 0 }); }
  typeLabel(type: BusinessEntryType): string { return type.charAt(0) + type.slice(1).toLowerCase(); }
  profitClass(value: number): string { return value >= 0 ? 'text-profit' : 'text-loss'; }
}
