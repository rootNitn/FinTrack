import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatStepperModule } from '@angular/material/stepper';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { TaxImportService } from '../tax-imports/tax-import.service';
import { TAX_IMPORT_DOCUMENT_ACCEPT, TAX_IMPORT_TYPE_LABELS, TaxImportRecord, TaxImportType } from '../tax-imports/tax-import.model';
import { ReconciliationService, TaxReconciliationReport } from '../reconciliation/reconciliation.service';
import { TaxPlannerService } from '../tax-planner/tax-planner.service';
import { StructuredTaxSavingSuggestion } from '../tax-planner/tax-planner.model';
import { TaxDashboardData, TaxFinancialYearSummary } from '../tax.model';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { TaxImportPasswordDialogComponent } from '../tax-imports/tax-import-password-dialog.component';

function currency(value: number | null): string {
  return value === null ? '-' : formatCurrency(value, { maximumFractionDigits: 0 });
}

const IMPORT_TYPES: TaxImportType[] = ['salary-slip', 'form16', 'ais', 'form26as'];

@Component({
  selector: 'app-tax-filing-workspace',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatStepperModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './tax-filing-workspace.component.html',
})
export class TaxFilingWorkspaceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly importService = inject(TaxImportService);
  private readonly reconciliationService = inject(ReconciliationService);
  private readonly plannerService = inject(TaxPlannerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly financialYearCode = this.fb.nonNullable.control('', Validators.required);

  readonly importTypes = IMPORT_TYPES;
  readonly importLabels = TAX_IMPORT_TYPE_LABELS;
  readonly importAccept = TAX_IMPORT_DOCUMENT_ACCEPT;
  readonly uploading = signal<Record<TaxImportType, boolean>>({ 'salary-slip': false, form16: false, ais: false, form26as: false });
  readonly uploaded = signal<Record<TaxImportType, boolean>>({ 'salary-slip': false, form16: false, ais: false, form26as: false });
  readonly existingByType = signal<Record<TaxImportType, TaxImportRecord[]>>({
    'salary-slip': [],
    form16: [],
    ais: [],
    form26as: [],
  });
  readonly selectedExisting = signal<Partial<Record<TaxImportType, string>>>({});

  readonly reconciling = signal(false);
  readonly reconciliation = signal<TaxReconciliationReport | null>(null);

  readonly generatingPlan = signal(false);
  readonly suggestions = signal<StructuredTaxSavingSuggestion[] | null>(null);

  readonly loadingSummary = signal(false);
  readonly summary = signal<TaxDashboardData | null>(null);
  readonly currency = currency;

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) {
          this.financialYearCode.setValue(defaultYear.code);
          this.loadExisting(defaultYear.code);
        }
      },
    });
  }

  onFinancialYearChange(): void {
    this.uploaded.set({ 'salary-slip': false, form16: false, ais: false, form26as: false });
    this.selectedExisting.set({});
    this.loadExisting(this.financialYearCode.value);
  }

  loadExisting(financialYearCode: string): void {
    if (!financialYearCode) return;
    const requests = Object.fromEntries(this.importTypes.map((type) => [type, this.importService.list(type, financialYearCode)])) as Record<
      TaxImportType,
      ReturnType<TaxImportService['list']>
    >;
    forkJoin(requests).subscribe({
      next: (records) => this.existingByType.set(records),
      error: () => this.existingByType.set({ 'salary-slip': [], form16: [], ais: [], form26as: [] }),
    });
  }

  selectExisting(type: TaxImportType, recordId: string): void {
    this.selectedExisting.update((selected) => ({ ...selected, [type]: recordId }));
    this.uploaded.update((state) => ({ ...state, [type]: Boolean(recordId) }));
  }

  uploadDocument(type: TaxImportType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !this.financialYearCode.value) return;
    this.uploading.update((s) => ({ ...s, [type]: true }));
    this.importService.import(type, file, this.financialYearCode.value).subscribe({
      next: () => {
        this.uploading.update((s) => ({ ...s, [type]: false }));
        this.uploaded.update((s) => ({ ...s, [type]: true }));
        this.loadExisting(this.financialYearCode.value);
        this.toast.success(`${this.importLabels[type]} imported successfully.`);
      },
      error: (err) => {
        this.uploading.update((s) => ({ ...s, [type]: false }));
        if (err?.status === 422 && err?.error?.errors?.code === 'PASSWORD_REQUIRED') {
          const documentId = err.error.errors.documentId as string;
          const ref = this.dialog.open(TaxImportPasswordDialogComponent, {
            width: '480px',
            data: { type, documentId, typeLabel: this.importLabels[type] },
          });
          ref.afterClosed().subscribe((record) => {
            if (!record) return;
            this.uploaded.update((s) => ({ ...s, [type]: true }));
            this.toast.success(`${this.importLabels[type]} unlocked and imported successfully.`);
          });
          return;
        }
        const message = err?.error?.message ?? err?.error?.errors?.message;
        this.toast.error(message || `Failed to import ${this.importLabels[type]}.`);
      },
    });
    input.value = '';
  }

  runReconciliation(): void {
    if (!this.financialYearCode.value) return;
    this.reconciling.set(true);
    this.reconciliationService.getReport(this.financialYearCode.value).subscribe({
      next: (report) => {
        this.reconciliation.set(report);
        this.reconciling.set(false);
      },
      error: () => {
        this.reconciling.set(false);
        this.toast.error('Failed to run reconciliation checks');
      },
    });
  }

  openCalculator(): void {
    this.router.navigate(['/tax/calculator']);
  }

  generatePlan(): void {
    if (!this.financialYearCode.value) return;
    this.generatingPlan.set(true);
    this.plannerService.generate(this.financialYearCode.value).subscribe({
      next: (result) => {
        this.suggestions.set(result.suggestions);
        this.generatingPlan.set(false);
      },
      error: () => {
        this.generatingPlan.set(false);
        this.toast.error('Failed to generate tax saving plan — save a tax calculation first.');
      },
    });
  }

  loadSummary(): void {
    if (!this.financialYearCode.value) return;
    this.loadingSummary.set(true);
    this.taxService.getDashboard(this.financialYearCode.value).subscribe({
      next: (data) => {
        this.summary.set(data);
        this.loadingSummary.set(false);
      },
      error: () => this.loadingSummary.set(false),
    });
  }

  openReports(): void {
    this.router.navigate(['/tax/reports']);
  }
}
