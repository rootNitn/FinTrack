import { CommonModule } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { EChartsCoreOption } from 'echarts/core';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { CHART_PALETTE } from '../../../shared/charts/chart-style.util';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { TaxService } from '../tax.service';
import { DeductionApplied, RegimeResult, SlabTaxBreakdownRow, TaxCalculationInput, TaxComparisonResult, TaxRegime } from '../tax.model';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

interface ComparisonRow {
  label: string;
  old: number;
  new: number;
  betterRegime: TaxRegime | null;
}

@Component({
  selector: 'app-tax-result',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatTabsModule,
    MatButtonToggleModule,
    MatProgressSpinnerModule,
    KpiCardComponent,
    ChartCardComponent,
    DataTableComponent,
  ],
  templateUrl: './tax-result.component.html',
  styleUrl: './tax-result.component.scss',
})
export class TaxResultComponent {
  private readonly taxService = inject(TaxService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  readonly comparison = input.required<TaxComparisonResult>();
  readonly baseInput = input.required<TaxCalculationInput>();

  readonly currency = currency;
  readonly selectedRegimeTab = signal<TaxRegime>('NEW');
  readonly whatIfComparison = signal<TaxComparisonResult | null>(null);
  readonly whatIfCalculating = signal(false);
  readonly exportingPdf = signal(false);
  readonly exportingExcel = signal(false);

  readonly whatIfForm = this.fb.nonNullable.group({
    section80C: [0],
    section80CCD1B: [0],
    section80DSelf: [0],
    homeLoanInterest: [0],
    hraReceived: [0],
    rentPaid: [0],
  });

  readonly activeComparison = computed(() => this.whatIfComparison() ?? this.comparison());

  readonly breakdownColumns: DataTableColumn<SlabTaxBreakdownRow>[] = [
    { key: 'slabLabel', header: 'Income Slab' },
    { key: 'ratePercent', header: 'Rate', cell: (row) => `${row.ratePercent}%` },
    { key: 'taxableInThisSlab', header: 'Taxable Amount', cell: (row) => currency(row.taxableInThisSlab) },
    { key: 'taxForThisSlab', header: 'Tax', cell: (row) => currency(row.taxForThisSlab) },
  ];

  readonly deductionColumns: DataTableColumn<DeductionApplied>[] = [
    { key: 'label', header: 'Deduction' },
    { key: 'claimed', header: 'Claimed', cell: (row) => currency(row.claimed) },
    { key: 'allowed', header: 'Allowed', cell: (row) => currency(row.allowed) },
  ];

  readonly comparisonRows = computed<ComparisonRow[]>(() => {
    const c = this.activeComparison();
    const rows: [string, number, number][] = [
      ['Gross Total Income', c.old.incomeBreakdown.grossTotalIncome, c.new.incomeBreakdown.grossTotalIncome],
      ['Total Deductions', c.old.totalDeductions, c.new.totalDeductions],
      ['Taxable Income', c.old.taxableIncome, c.new.taxableIncome],
      ['Tax on Slab Income', c.old.taxOnSlabIncome, c.new.taxOnSlabIncome],
      ['Special Rate Tax (Capital Gains)', c.old.capitalGainsTax.totalSpecialRateTax, c.new.capitalGainsTax.totalSpecialRateTax],
      ['Rebate (Sec 87A)', c.old.rebateAmount, c.new.rebateAmount],
      ['Surcharge', c.old.surchargeAmount, c.new.surchargeAmount],
      ['Health & Education Cess', c.old.cessAmount, c.new.cessAmount],
      ['Total Tax Payable', c.old.totalTaxPayable, c.new.totalTaxPayable],
      ['Take-Home Income', c.old.takeHomeIncome, c.new.takeHomeIncome],
    ];
    return rows.map(([label, oldVal, newVal]) => ({
      label,
      old: oldVal,
      new: newVal,
      betterRegime: label === 'Take-Home Income' || label === 'Gross Total Income' ? null : oldVal === newVal ? null : oldVal < newVal ? 'OLD' : 'NEW',
    }));
  });

  readonly incomeDistributionChart = computed<EChartsCoreOption | null>(() => this.pieChartFor(this.selectedRegime()));
  readonly deductionDistributionChart = computed<EChartsCoreOption | null>(() => this.deductionPieChartFor(this.selectedRegime()));

  readonly oldVsNewBarChart = computed<EChartsCoreOption | null>(() => {
    const c = this.activeComparison();
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 70, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: ['Old Regime', 'New Regime'] },
      yAxis: { type: 'value' },
      series: [
        {
          type: 'bar',
          barWidth: '45%',
          data: [
            { value: c.old.totalTaxPayable, itemStyle: { color: CHART_PALETTE[0] } },
            { value: c.new.totalTaxPayable, itemStyle: { color: CHART_PALETTE[1] } },
          ],
        },
      ],
    };
  });

  readonly stackedComponentsChart = computed<EChartsCoreOption | null>(() => {
    const c = this.activeComparison();
    return {
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0 },
      grid: { left: 70, right: 16, top: 24, bottom: 48 },
      xAxis: { type: 'category', data: ['Old Regime', 'New Regime'] },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Tax on Slab Income',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: CHART_PALETTE[0] },
          data: [c.old.taxOnSlabIncome, c.new.taxOnSlabIncome],
        },
        {
          name: 'Capital Gains Tax',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: CHART_PALETTE[2] },
          data: [c.old.capitalGainsTax.totalSpecialRateTax, c.new.capitalGainsTax.totalSpecialRateTax],
        },
        {
          name: 'Surcharge',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: CHART_PALETTE[3] },
          data: [c.old.surchargeAmount, c.new.surchargeAmount],
        },
        {
          name: 'Cess',
          type: 'bar',
          stack: 'total',
          itemStyle: { color: CHART_PALETTE[4] },
          data: [c.old.cessAmount, c.new.cessAmount],
        },
      ],
    };
  });

  selectedRegime(): TaxRegime {
    return this.selectedRegimeTab();
  }

  regimeResult(regime: TaxRegime): RegimeResult {
    const c = this.activeComparison();
    return regime === 'OLD' ? c.old : c.new;
  }

  private pieChartFor(regime: TaxRegime): EChartsCoreOption {
    const r = this.regimeResult(regime);
    const income = r.incomeBreakdown;
    const data = [
      { name: 'Salary', value: income.salaryIncome },
      { name: 'House Property', value: Math.max(0, income.housePropertyIncome) },
      { name: 'Other Sources', value: income.otherSourcesIncome },
      { name: 'Business', value: income.businessIncome },
    ].filter((d) => d.value > 0);

    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: { borderRadius: 6, borderWidth: 2 },
          data: data.map((d, i) => ({ ...d, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })),
        },
      ],
    };
  }

  private deductionPieChartFor(regime: TaxRegime): EChartsCoreOption | null {
    const r = this.regimeResult(regime);
    const data = r.deductionsApplied.filter((d) => d.allowed > 0).map((d) => ({ name: d.label, value: d.allowed }));
    if (data.length === 0) return null;
    return {
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      series: [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          itemStyle: { borderRadius: 6, borderWidth: 2 },
          data: data.map((d, i) => ({ ...d, itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] } })),
        },
      ],
    };
  }

  runWhatIf(): void {
    this.whatIfCalculating.set(true);
    const overrides = this.whatIfForm.getRawValue();
    this.taxService.whatIf(this.baseInput(), overrides).subscribe({
      next: (result) => {
        this.whatIfComparison.set(result);
        this.whatIfCalculating.set(false);
      },
      error: () => {
        this.whatIfCalculating.set(false);
        this.toast.error('What-if calculation failed.');
      },
    });
  }

  resetWhatIf(): void {
    this.whatIfForm.reset({
      section80C: 0,
      section80CCD1B: 0,
      section80DSelf: 0,
      homeLoanInterest: 0,
      hraReceived: 0,
      rentPaid: 0,
    });
    this.whatIfComparison.set(null);
  }

  exportPdf(): void {
    this.exportingPdf.set(true);
    this.taxService.exportPdf(this.baseInput()).subscribe({
      next: (blob) => {
        downloadBlob(blob, `tax-calculation-${this.comparison().financialYearCode}.pdf`);
        this.exportingPdf.set(false);
      },
      error: () => {
        this.exportingPdf.set(false);
        this.toast.error('Failed to export PDF.');
      },
    });
  }

  exportExcel(): void {
    this.exportingExcel.set(true);
    this.taxService.exportExcel(this.baseInput()).subscribe({
      next: (blob) => {
        downloadBlob(blob, `tax-calculation-${this.comparison().financialYearCode}.xlsx`);
        this.exportingExcel.set(false);
      },
      error: () => {
        this.exportingExcel.set(false);
        this.toast.error('Failed to export Excel.');
      },
    });
  }

  print(): void {
    window.print();
  }
}
