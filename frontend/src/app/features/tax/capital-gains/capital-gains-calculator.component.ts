import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { KpiCardComponent } from '../../../shared/components/kpi-card/kpi-card.component';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { CapitalGainsService } from './capital-gains.service';
import { CapitalGainsBridgeService } from './capital-gains-bridge.service';
import { CapitalGainAssetType, CapitalGainsCalculationResult } from './capital-gains.model';
import { TaxFinancialYearSummary } from '../tax.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

function currency(value: number): string {
  return formatCurrency(value, { maximumFractionDigits: 0 });
}

const ASSET_TYPES: { value: CapitalGainAssetType; label: string }[] = [
  { value: 'STOCK', label: 'Stocks / Equity Shares' },
  { value: 'MUTUAL_FUND', label: 'Mutual Funds' },
  { value: 'PROPERTY', label: 'Property' },
  { value: 'GOLD', label: 'Gold' },
  { value: 'CRYPTO', label: 'Crypto' },
];

@Component({
  selector: 'app-capital-gains-calculator',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    KpiCardComponent,
  ],
  templateUrl: './capital-gains-calculator.component.html',
})
export class CapitalGainsCalculatorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly capitalGainsService = inject(CapitalGainsService);
  private readonly bridge = inject(CapitalGainsBridgeService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly assetTypes = ASSET_TYPES;
  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly calculating = signal(false);
  readonly result = signal<CapitalGainsCalculationResult | null>(null);
  readonly currency = currency;

  readonly financialYearCode = this.fb.nonNullable.control('');
  readonly rows = this.fb.array([this.buildRow()]);

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.financialYearCode.setValue(defaultYear.code);
      },
    });
  }

  private buildRow() {
    return this.fb.nonNullable.group({
      assetType: ['STOCK' as CapitalGainAssetType, Validators.required],
      purchaseDate: ['', Validators.required],
      purchasePrice: [0, [Validators.required, Validators.min(0)]],
      saleDate: ['', Validators.required],
      salePrice: [0, [Validators.required, Validators.min(0)]],
      quantity: [1, [Validators.required, Validators.min(0)]],
      brokerage: [0, [Validators.min(0)]],
      stampDuty: [0, [Validators.min(0)]],
      transferCharges: [0, [Validators.min(0)]],
    });
  }

  get rowsArray(): FormArray {
    return this.rows;
  }

  addRow(): void {
    this.rows.push(this.buildRow());
  }

  removeRow(index: number): void {
    if (this.rows.length > 1) this.rows.removeAt(index);
  }

  calculate(): void {
    if (this.rows.invalid || !this.financialYearCode.value) return;
    this.calculating.set(true);
    this.capitalGainsService.calculate(this.financialYearCode.value, this.rows.getRawValue()).subscribe({
      next: (result) => {
        this.result.set(result);
        this.calculating.set(false);
        this.toast.success('Capital gains calculated and saved');
      },
      error: () => {
        this.toast.error('Failed to calculate capital gains');
        this.calculating.set(false);
      },
    });
  }

  sendToTaxCalculator(): void {
    const data = this.result();
    if (!data) return;

    // Maps the 5 asset types × 2 terms onto the main Tax Calculator's 7 Capital Gains fields.
    // STOCK is treated as the "equity" bucket and MUTUAL_FUND as the "debt" bucket (the main
    // calculator does not distinguish equity- vs debt-oriented funds); PROPERTY/GOLD/CRYPTO merge
    // both terms into a single field each, matching the main calculator's simpler model.
    const totals = { equityStcg: 0, equityLtcg: 0, debtStcg: 0, debtLtcg: 0, propertyGain: 0, goldGain: 0, cryptoIncome: 0 };
    for (const t of data.transactions) {
      const gain = Math.max(0, t.gainAmount);
      if (t.assetType === 'STOCK') {
        if (t.termType === 'SHORT') totals.equityStcg += gain;
        else totals.equityLtcg += gain;
      } else if (t.assetType === 'MUTUAL_FUND') {
        if (t.termType === 'SHORT') totals.debtStcg += gain;
        else totals.debtLtcg += gain;
      } else if (t.assetType === 'PROPERTY') {
        totals.propertyGain += gain;
      } else if (t.assetType === 'GOLD') {
        totals.goldGain += gain;
      } else if (t.assetType === 'CRYPTO') {
        totals.cryptoIncome += gain;
      }
    }

    this.bridge.send(totals);
    this.toast.success('Capital gains totals sent to the Tax Calculator');
    this.router.navigate(['/tax/calculator']);
  }
}
