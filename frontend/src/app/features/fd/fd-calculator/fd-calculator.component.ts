import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';
import { ToastService } from '../../../core/services/toast.service';
import { FdBanksService } from '../fd-banks.service';
import { FdCalculatorService } from '../fd-calculator.service';
import {
  FdBank,
  FdCalculationResult,
  FdInterestBreakdownRow,
  FD_COMPOUNDING_LABELS,
  FD_DEPOSIT_TYPE_LABELS,
  FdCompoundingFrequency,
  FdDepositType,
} from '../fd.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-fd-calculator',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
    PageHeaderComponent,
    KpiCardComponent,
    ChartCardComponent,
    DataTableComponent,
  ],
  templateUrl: './fd-calculator.component.html',
  styleUrl: './fd-calculator.component.scss',
})
export class FdCalculatorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly banksService = inject(FdBanksService);
  private readonly calculatorService = inject(FdCalculatorService);
  private readonly toast = inject(ToastService);

  readonly banks = signal<FdBank[]>([]);
  readonly banksLoading = signal(true);
  readonly calculating = signal(false);
  readonly result = signal<FdCalculationResult | null>(null);

  readonly depositTypeLabels = FD_DEPOSIT_TYPE_LABELS;
  readonly compoundingLabels = FD_COMPOUNDING_LABELS;
  readonly depositTypes = Object.keys(FD_DEPOSIT_TYPE_LABELS) as FdDepositType[];
  readonly compoundingOptions = Object.keys(FD_COMPOUNDING_LABELS) as FdCompoundingFrequency[];

  readonly form = this.fb.nonNullable.group({
    principal: [100000, [Validators.required, Validators.min(1)]],
    fdType: ['REGULAR' as 'REGULAR' | 'SENIOR', Validators.required],
    bankId: [''],
    interestRate: [7, [Validators.min(0.1), Validators.max(20)]],
    depositType: ['CUMULATIVE' as FdDepositType, Validators.required],
    tenureValue: [1, [Validators.required, Validators.min(1)]],
    tenureUnit: ['YEARS' as 'DAYS' | 'MONTHS' | 'YEARS', Validators.required],
    compounding: ['QUARTERLY' as FdCompoundingFrequency, Validators.required],
  });

  readonly usingBankRate = computed(() => !!this.form.value.bankId);

  readonly breakdownColumns: DataTableColumn<FdInterestBreakdownRow>[] = [
    { key: 'periodLabel', header: 'Period' },
    { key: 'openingBalance', header: 'Opening Balance', cell: (row) => currency(row.openingBalance) },
    { key: 'interestForPeriod', header: 'Interest', cell: (row) => currency(row.interestForPeriod) },
    { key: 'closingBalance', header: 'Closing Balance', cell: (row) => currency(row.closingBalance) },
  ];

  readonly chartOptions = computed<EChartsCoreOption | null>(() => {
    const result = this.result();
    if (!result || result.breakdown.length === 0) return null;
    return {
      tooltip: { trigger: 'axis' },
      grid: { left: 60, right: 16, top: 24, bottom: 32 },
      xAxis: { type: 'category', data: result.breakdown.map((r) => r.periodLabel) },
      yAxis: { type: 'value' },
      series: [
        {
          name: 'Balance',
          type: 'line',
          smooth: true,
          symbol: 'circle',
          areaStyle: { color: gradientFill(CHART_PALETTE[0]) },
          itemStyle: { color: CHART_PALETTE[0] },
          data: result.breakdown.map((r) => r.closingBalance),
        },
      ],
    };
  });

  ngOnInit(): void {
    this.banksService.list({ activeOnly: true }).subscribe({
      next: (banks) => {
        this.banks.set(banks);
        this.banksLoading.set(false);
      },
      error: () => this.banksLoading.set(false),
    });
    this.calculate();
  }

  calculate(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.calculating.set(true);
    this.calculatorService
      .calculate({
        principal: value.principal,
        fdType: value.fdType,
        bankId: value.bankId || undefined,
        interestRate: value.bankId ? undefined : value.interestRate,
        depositType: value.depositType,
        tenureValue: value.tenureValue,
        tenureUnit: value.tenureUnit,
        compounding: value.compounding,
      })
      .subscribe({
        next: (result) => {
          this.result.set(result);
          this.calculating.set(false);
        },
        error: (err) => {
          this.calculating.set(false);
          this.toast.error(err?.error?.error?.message ?? 'Could not calculate FD.');
        },
      });
  }

  currency(value: number): string {
    return currency(value);
  }

  formattedMaturityDate(): string {
    const result = this.result();
    return result ? new Date(result.maturityDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';
  }
}
