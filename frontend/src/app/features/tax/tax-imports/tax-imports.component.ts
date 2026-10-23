import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { TaxFinancialYearSummary } from '../tax.model';
import { TaxImportService, TaxReconciliationReport } from './tax-import.service';
import { TaxImportEditDialogComponent } from './tax-import-edit-dialog.component';
import { TaxImportPasswordDialogComponent } from './tax-import-password-dialog.component';
import {
  TAX_IMPORT_DOCUMENT_ACCEPT,
  TAX_IMPORT_FIELD_CONFIGS,
  TAX_IMPORT_TYPE_LABELS,
  TaxImportRecord,
  TaxImportType,
} from './tax-import.model';

const IMPORT_TYPES: TaxImportType[] = ['salary-slip', 'form16', 'ais', 'form26as'];

@Component({
  selector: 'app-tax-imports',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './tax-imports.component.html',
  styleUrl: './tax-imports.component.scss',
})
export class TaxImportsComponent implements OnInit {
  private readonly taxService = inject(TaxService);
  private readonly importService = inject(TaxImportService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly importTypes = IMPORT_TYPES;
  readonly typeLabels = TAX_IMPORT_TYPE_LABELS;
  readonly acceptByType = TAX_IMPORT_DOCUMENT_ACCEPT;

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly uploading = signal<TaxImportType | null>(null);
  readonly reconciliation = signal<TaxReconciliationReport | null>(null);

  selectedFinancialYearCode = '';
  activeTabIndex = 0;

  readonly recordsByType: Record<TaxImportType, ReturnType<typeof signal<TaxImportRecord[]>>> = {
    'salary-slip': signal<TaxImportRecord[]>([]),
    form16: signal<TaxImportRecord[]>([]),
    ais: signal<TaxImportRecord[]>([]),
    form26as: signal<TaxImportRecord[]>([]),
  };

  readonly loadingByType: Record<TaxImportType, ReturnType<typeof signal<boolean>>> = {
    'salary-slip': signal(true),
    form16: signal(true),
    ais: signal(true),
    form26as: signal(true),
  };

  readonly columnsByType: Record<TaxImportType, DataTableColumn<TaxImportRecord>[]> = {
    'salary-slip': [
      { key: 'month', header: 'Month', cell: (row) => (row['month'] as string) ?? '—' },
      { key: 'employerName', header: 'Employer', cell: (row) => (row['employerName'] as string) ?? '—' },
      { key: 'grossSalary', header: 'Gross Salary', cell: (row) => this.formatCurrency(row['grossSalary']) },
      { key: 'netSalary', header: 'Net Salary', cell: (row) => this.formatCurrency(row['netSalary']) },
      { key: 'warnings', header: 'Warnings', cell: (row) => `${row.validationWarnings?.length ?? 0}` },
    ],
    form16: [
      { key: 'employerName', header: 'Employer', cell: (row) => (row['employerName'] as string) ?? '—' },
      { key: 'assessmentYear', header: 'Assessment Year', cell: (row) => (row['assessmentYear'] as string) ?? '—' },
      { key: 'taxableIncome', header: 'Taxable Income', cell: (row) => this.formatCurrency(row['taxableIncome']) },
      { key: 'tdsDeducted', header: 'TDS Deducted', cell: (row) => this.formatCurrency(row['tdsDeducted']) },
      { key: 'warnings', header: 'Warnings', cell: (row) => `${row.validationWarnings?.length ?? 0}` },
    ],
    ais: [
      { key: 'salaryIncome', header: 'Salary Income', cell: (row) => this.formatCurrency(row['salaryIncome']) },
      { key: 'interestIncome', header: 'Interest Income', cell: (row) => this.formatCurrency(row['interestIncome']) },
      { key: 'capitalGainsIncome', header: 'Capital Gains', cell: (row) => this.formatCurrency(row['capitalGainsIncome']) },
      { key: 'tdsAmount', header: 'TDS Amount', cell: (row) => this.formatCurrency(row['tdsAmount']) },
      { key: 'warnings', header: 'Warnings', cell: (row) => `${row.validationWarnings?.length ?? 0}` },
    ],
    form26as: [
      { key: 'employerTds', header: 'Employer TDS', cell: (row) => this.formatCurrency(row['employerTds']) },
      { key: 'bankTds', header: 'Bank TDS', cell: (row) => this.formatCurrency(row['bankTds']) },
      { key: 'totalTaxPaid', header: 'Total Tax Paid', cell: (row) => this.formatCurrency(row['totalTaxPaid']) },
      { key: 'refund', header: 'Refund', cell: (row) => this.formatCurrency(row['refund']) },
      { key: 'warnings', header: 'Warnings', cell: (row) => `${row.validationWarnings?.length ?? 0}` },
    ],
  };

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.selectedFinancialYearCode = defaultYear.code;
        this.loadAll();
      },
      error: () => this.loadAll(),
    });
  }

  formatCurrency(value: unknown): string {
    const num = typeof value === 'number' ? value : Number(value ?? 0);
    return formatCurrency(num, { maximumFractionDigits: 0 });
  }

  onFinancialYearChange(): void {
    this.loadAll();
  }

  loadAll(): void {
    for (const type of this.importTypes) this.load(type);
    if (this.selectedFinancialYearCode) {
      this.importService.reconciliation(this.selectedFinancialYearCode).subscribe({
        next: (report) => this.reconciliation.set(report),
        error: () => this.reconciliation.set(null),
      });
    }
  }

  load(type: TaxImportType): void {
    this.loadingByType[type].set(true);
    this.importService.list(type, this.selectedFinancialYearCode || undefined).subscribe({
      next: (records) => {
        this.recordsByType[type].set(records);
        this.loadingByType[type].set(false);
      },
      error: () => this.loadingByType[type].set(false),
    });
  }

  onFileSelected(type: TaxImportType, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.selectedFinancialYearCode) {
      this.toast.error('Select a financial year before uploading.');
      input.value = '';
      return;
    }
    this.uploading.set(type);
    this.importService.import(type, file, this.selectedFinancialYearCode).subscribe({
      next: () => {
        this.uploading.set(null);
        input.value = '';
        this.toast.success(`${this.typeLabels[type]} imported successfully.`);
        this.loadAll();
      },
      error: (err) => {
        this.uploading.set(null);
        input.value = '';
        if (err?.status === 422 && err?.error?.errors?.code === 'PASSWORD_REQUIRED') {
          this.promptForPassword(type, err.error.errors.documentId as string);
          return;
        }
        this.toast.error(err?.error?.message ?? `Failed to import ${this.typeLabels[type]}.`);
      },
    });
  }

  private promptForPassword(type: TaxImportType, documentId: string): void {
    const ref = this.dialog.open(TaxImportPasswordDialogComponent, {
      width: '480px',
      data: { type, documentId, typeLabel: this.typeLabels[type] },
    });
    ref.afterClosed().subscribe((record: TaxImportRecord | undefined) => {
      if (!record) return;
      this.toast.success(`${this.typeLabels[type]} unlocked and imported successfully.`);
      this.previewUnlockedRecord(type, record);
    });
  }

  private previewUnlockedRecord(type: TaxImportType, row: TaxImportRecord): void {
    const ref = this.dialog.open(TaxImportEditDialogComponent, {
      width: '640px',
      data: { title: `Review ${this.typeLabels[type]}`, fields: TAX_IMPORT_FIELD_CONFIGS[type], record: row },
    });
    ref.afterClosed().subscribe((changes: Record<string, unknown> | undefined) => {
      if (changes) {
        this.importService.update(type, row.id, changes).subscribe({
          next: () => this.toast.success('Record updated.'),
          error: () => this.toast.error('Failed to update record.'),
        });
      }
      this.loadAll();
    });
  }

  editRecord(type: TaxImportType, row: TaxImportRecord, event: Event): void {
    event.stopPropagation();
    const ref = this.dialog.open(TaxImportEditDialogComponent, {
      width: '640px',
      data: { title: `Edit ${this.typeLabels[type]}`, fields: TAX_IMPORT_FIELD_CONFIGS[type], record: row },
    });
    ref.afterClosed().subscribe((changes: Record<string, unknown> | undefined) => {
      if (!changes) return;
      this.importService.update(type, row.id, changes).subscribe({
        next: () => {
          this.toast.success('Record updated.');
          this.loadAll();
        },
        error: () => this.toast.error('Failed to update record.'),
      });
    });
  }

  deleteRecord(type: TaxImportType, row: TaxImportRecord, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({
        title: 'Delete record',
        message: `Are you sure you want to delete this ${this.typeLabels[type]} record? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.importService.delete(type, row.id).subscribe(() => {
          this.toast.success('Record deleted.');
          this.loadAll();
        });
      });
  }
}
