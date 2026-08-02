import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { ReportsService } from '../reports.service';
import {
  ExpenseReport,
  ExpenseReportRow,
  GoalReport,
  GoalReportRow,
  InvestmentReport,
  InvestmentReportRow,
  PeriodReport,
  REPORT_TYPES,
  Report,
  ReportQuery,
  ReportType,
} from '../reports.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value);
}

function date(value: string): string {
  return new Date(value).toLocaleDateString();
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const QUARTERS = [
  { value: 1, label: 'Q1 (Jan - Mar)' },
  { value: 2, label: 'Q2 (Apr - Jun)' },
  { value: 3, label: 'Q3 (Jul - Sep)' },
  { value: 4, label: 'Q4 (Oct - Dec)' },
];

@Component({
  selector: 'app-report-view',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './report-view.component.html',
  styleUrl: './report-view.component.scss',
})
export class ReportViewComponent {
  private readonly fb = inject(FormBuilder);
  private readonly reportsService = inject(ReportsService);
  private readonly toast = inject(ToastService);

  readonly reportTypes = REPORT_TYPES;
  readonly months = MONTHS;
  readonly quarters = QUARTERS;
  readonly years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  readonly loading = signal(false);
  readonly exporting = signal(false);
  readonly report = signal<Report | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: 'monthly' as ReportType,
    month: new Date().getMonth() + 1,
    quarter: Math.floor(new Date().getMonth() / 3) + 1,
    year: new Date().getFullYear(),
  });

  readonly investmentColumns: DataTableColumn<InvestmentReportRow>[] = [
    { key: 'name', header: 'Name', sortable: true },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'principalAmount', header: 'Invested', sortable: true, cell: (row) => currency(row.principalAmount) },
    { key: 'currentValue', header: 'Current Value', sortable: true, cell: (row) => currency(row.currentValue) },
    { key: 'profit', header: 'Profit', sortable: true, cell: (row) => currency(row.profit) },
    { key: 'roiPercent', header: 'ROI %', sortable: true, cell: (row) => `${row.roiPercent}%` },
    { key: 'status', header: 'Status', sortable: true },
  ];

  readonly expenseColumns: DataTableColumn<ExpenseReportRow>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => date(row.date) },
    { key: 'category', header: 'Category', sortable: true },
    { key: 'amount', header: 'Amount', sortable: true, cell: (row) => currency(row.amount) },
  ];

  readonly goalColumns: DataTableColumn<GoalReportRow>[] = [
    { key: 'name', header: 'Goal', sortable: true },
    { key: 'type', header: 'Type', sortable: true },
    { key: 'targetAmount', header: 'Target', sortable: true, cell: (row) => currency(row.targetAmount) },
    { key: 'currentAmount', header: 'Saved', sortable: true, cell: (row) => currency(row.currentAmount) },
    { key: 'progressPercent', header: 'Progress', sortable: true, cell: (row) => `${row.progressPercent}%` },
    { key: 'deadline', header: 'Deadline', sortable: true, cell: (row) => date(row.deadline) },
  ];

  readonly currentType = computed(() => this.report()?.type ?? null);

  formatCurrency = currency;

  private buildQuery(): ReportQuery {
    const { type, month, quarter, year } = this.form.getRawValue();
    const query: ReportQuery = { type };
    if (type === 'monthly') {
      query.month = month;
      query.year = year;
    } else if (type === 'quarterly') {
      query.quarter = quarter;
      query.year = year;
    } else if (type === 'yearly' || type === 'expense') {
      query.year = year;
    }
    return query;
  }

  generate(): void {
    this.loading.set(true);
    this.reportsService.generate(this.buildQuery()).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  export(format: 'excel' | 'csv' | 'pdf'): void {
    if (!this.report()) return;
    this.exporting.set(true);
    const query = this.buildQuery();
    const request$ =
      format === 'excel'
        ? this.reportsService.exportExcel(query)
        : format === 'csv'
          ? this.reportsService.exportCsv(query)
          : this.reportsService.exportPdf(query);

    const extension = format === 'excel' ? 'xlsx' : format;
    request$.subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(blob, `${query.type}-report.${extension}`);
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error('Failed to export report.');
      },
    });
  }

  asPeriodReport(report: Report): PeriodReport {
    return report as PeriodReport;
  }

  asInvestmentReport(report: Report): InvestmentReport {
    return report as InvestmentReport;
  }

  asExpenseReport(report: Report): ExpenseReport {
    return report as ExpenseReport;
  }

  asGoalReport(report: Report): GoalReport {
    return report as GoalReport;
  }
}
