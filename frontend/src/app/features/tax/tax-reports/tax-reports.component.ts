import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { TaxService } from '../tax.service';
import { TaxReportsService } from './tax-reports.service';
import { TAX_REPORT_TYPES, TaxReportTable, TaxReportType } from './tax-reports.model';
import { TaxFinancialYearSummary } from '../tax.model';

@Component({
  selector: 'app-tax-reports',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './tax-reports.component.html',
})
export class TaxReportsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly reportsService = inject(TaxReportsService);
  private readonly toast = inject(ToastService);

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly loading = signal(false);
  readonly exportingExcel = signal(false);
  readonly exportingPdf = signal(false);
  readonly report = signal<TaxReportTable | null>(null);
  readonly reportTypes = TAX_REPORT_TYPES;

  readonly form = this.fb.nonNullable.group({
    financialYearCode: ['', Validators.required],
    reportType: ['TAX_SUMMARY' as TaxReportType, Validators.required],
  });

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.form.controls.financialYearCode.setValue(defaultYear.code);
      },
    });
  }

  generate(): void {
    if (this.form.invalid) return;
    const { financialYearCode, reportType } = this.form.getRawValue();
    this.loading.set(true);
    this.reportsService.getReport(financialYearCode, reportType).subscribe({
      next: (report) => {
        this.report.set(report);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to generate report');
      },
    });
  }

  exportExcel(): void {
    const { financialYearCode, reportType } = this.form.getRawValue();
    this.exportingExcel.set(true);
    this.reportsService.exportExcel(financialYearCode, reportType).subscribe({
      next: (blob) => {
        downloadBlob(blob, `${reportType.toLowerCase()}-${financialYearCode}.xlsx`);
        this.exportingExcel.set(false);
      },
      error: () => {
        this.exportingExcel.set(false);
        this.toast.error('Failed to export Excel');
      },
    });
  }

  exportPdf(): void {
    const { financialYearCode, reportType } = this.form.getRawValue();
    this.exportingPdf.set(true);
    this.reportsService.exportPdf(financialYearCode, reportType).subscribe({
      next: (blob) => {
        downloadBlob(blob, `${reportType.toLowerCase()}-${financialYearCode}.pdf`);
        this.exportingPdf.set(false);
      },
      error: () => {
        this.exportingPdf.set(false);
        this.toast.error('Failed to export PDF');
      },
    });
  }
}
