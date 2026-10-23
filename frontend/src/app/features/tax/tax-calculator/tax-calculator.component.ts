import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { TaxService } from '../tax.service';
import { TaxResultComponent } from '../tax-result/tax-result.component';
import { TaxSaveDialogComponent } from '../tax-save-dialog/tax-save-dialog.component';
import { TaxImportService } from '../tax-imports/tax-import.service';
import { CapitalGainsBridgeService } from '../capital-gains/capital-gains-bridge.service';
import {
  DEDUCTION_SECTION_LABELS,
  INDIAN_STATES,
  TaxCalculationInput,
  TaxComparisonResult,
  TaxFinancialYearRuleSet,
  TaxFinancialYearSummary,
} from '../tax.model';

@Component({
  selector: 'app-tax-calculator',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatTabsModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    RouterLink,
    PageHeaderComponent,
    TaxResultComponent,
  ],
  templateUrl: './tax-calculator.component.html',
  styleUrl: './tax-calculator.component.scss',
})
export class TaxCalculatorComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly taxService = inject(TaxService);
  private readonly importService = inject(TaxImportService);
  private readonly capitalGainsBridge = inject(CapitalGainsBridgeService);
  private readonly toast = inject(ToastService);
  private readonly dialog = inject(MatDialog);

  readonly importing = signal(false);

  readonly states = INDIAN_STATES;
  readonly deductionLabels = DEDUCTION_SECTION_LABELS;

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly loadingYears = signal(true);
  readonly ruleSet = signal<TaxFinancialYearRuleSet | null>(null);
  readonly calculating = signal(false);
  readonly result = signal<TaxComparisonResult | null>(null);

  readonly form = this.fb.nonNullable.group({
    financialYearCode: ['', Validators.required],
    personal: this.fb.nonNullable.group({
      age: [30, [Validators.required, Validators.min(0), Validators.max(120)]],
      gender: ['MALE' as 'MALE' | 'FEMALE' | 'OTHER', Validators.required],
      residentialStatus: ['RESIDENT' as 'RESIDENT' | 'NON_RESIDENT' | 'RNOR', Validators.required],
      employmentType: ['SALARIED' as 'SALARIED' | 'SELF_EMPLOYED' | 'BUSINESS' | 'PENSIONER', Validators.required],
      state: ['Maharashtra', Validators.required],
    }),
    salary: this.fb.nonNullable.group({
      basicSalary: [0, [Validators.min(0)]],
      hraReceived: [0, [Validators.min(0)]],
      rentPaid: [0, [Validators.min(0)]],
      specialAllowance: [0, [Validators.min(0)]],
      bonus: [0, [Validators.min(0)]],
      commission: [0, [Validators.min(0)]],
      employerPf: [0, [Validators.min(0)]],
      employeePf: [0, [Validators.min(0)]],
      gratuity: [0, [Validators.min(0)]],
      leaveEncashment: [0, [Validators.min(0)]],
      otherAllowances: [0, [Validators.min(0)]],
      perquisites: [0, [Validators.min(0)]],
      professionalTax: [0, [Validators.min(0)]],
    }),
    houseProperty: this.fb.nonNullable.group({
      type: ['NONE' as 'SELF_OCCUPIED' | 'LET_OUT' | 'NONE', Validators.required],
      rentalIncome: [0, [Validators.min(0)]],
      municipalTaxes: [0, [Validators.min(0)]],
      homeLoanInterest: [0, [Validators.min(0)]],
    }),
    otherIncome: this.fb.nonNullable.group({
      savingsInterest: [0, [Validators.min(0)]],
      fdInterest: [0, [Validators.min(0)]],
      rdInterest: [0, [Validators.min(0)]],
      dividendIncome: [0, [Validators.min(0)]],
      familyPension: [0, [Validators.min(0)]],
      agricultureIncome: [0, [Validators.min(0)]],
      otherSourcesIncome: [0, [Validators.min(0)]],
    }),
    businessIncome: this.fb.nonNullable.group({
      businessProfit: [0, [Validators.min(0)]],
      professionalIncome: [0, [Validators.min(0)]],
      presumptiveIncome: [0, [Validators.min(0)]],
    }),
    capitalGains: this.fb.nonNullable.group({
      equityStcg: [0, [Validators.min(0)]],
      equityLtcg: [0, [Validators.min(0)]],
      debtStcg: [0, [Validators.min(0)]],
      debtLtcg: [0, [Validators.min(0)]],
      propertyGain: [0, [Validators.min(0)]],
      goldGain: [0, [Validators.min(0)]],
      cryptoIncome: [0, [Validators.min(0)]],
    }),
    deductions: this.fb.nonNullable.group({
      section80C: [0, [Validators.min(0)]],
      section80CCD1B: [0, [Validators.min(0)]],
      section80DSelf: [0, [Validators.min(0)]],
      isSelfOrFamilySenior: [false],
      section80DParents: [0, [Validators.min(0)]],
      isParentsSenior: [false],
      section80E: [0, [Validators.min(0)]],
      section80G: [0, [Validators.min(0)]],
      employerNpsContribution: [0, [Validators.min(0)]],
      otherDeductions: [0, [Validators.min(0)]],
    }),
  });

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        this.loadingYears.set(false);
        if (!years.length) {
          this.toast.error('No financial years are configured. Ask an administrator to initialize the tax rules.');
        }
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) {
          this.form.controls.financialYearCode.setValue(defaultYear.code);
          this.onFinancialYearChange(defaultYear.code);
        }
      },
      error: () => {
        this.loadingYears.set(false);
        this.toast.error('Financial years could not be loaded. Please reload the page and try again.');
      },
    });

    const pendingCapitalGains = this.capitalGainsBridge.consume();
    if (pendingCapitalGains) {
      this.form.controls.capitalGains.patchValue(pendingCapitalGains);
      this.toast.success('Capital gains totals imported from the Capital Gains Calculator');
    }
  }

  onFinancialYearChange(code: string): void {
    if (!code) return;
    this.taxService.getSlabs(code).subscribe({ next: (rules) => this.ruleSet.set(rules) });
  }

  isDeductionAllowedInNewRegime(code: string): boolean {
    return this.ruleSet()?.new.deductions[code]?.isAllowed ?? false;
  }

  importFromDocuments(): void {
    const financialYearCode = this.form.controls.financialYearCode.value;
    if (!financialYearCode) {
      this.toast.error('Select a financial year before importing.');
      return;
    }
    this.importing.set(true);
    forkJoin({
      salarySlips: this.importService.list('salary-slip', financialYearCode),
      ais: this.importService.list('ais', financialYearCode),
      form16: this.importService.list('form16', financialYearCode),
    }).subscribe({
      next: ({ salarySlips, ais, form16 }) => {
        this.importing.set(false);
        if (salarySlips.length === 0 && ais.length === 0 && form16.length === 0) {
          this.toast.error('No imported Salary Slip, Form 16 or AIS documents found for this financial year.');
          return;
        }
        if (ais.length > 0) {
          const latestAis = ais[0];
          const aisSalaryIncome = Number(latestAis['salaryIncome'] ?? 0);
          if (salarySlips.length === 0 && aisSalaryIncome > 0) {
            // AIS/TIS only reports a lump-sum Salary figure (no Basic/HRA/allowance breakup), so
            // use it as a best-effort Basic Salary when no Salary Slip is available. A Salary
            // Slip (patched below, if present) always overrides this with the real breakdown.
            this.form.controls.salary.patchValue({ basicSalary: aisSalaryIncome });
          }
          this.form.controls.otherIncome.patchValue({
            fdInterest: Number(latestAis['interestIncome'] ?? 0),
            dividendIncome: Number(latestAis['dividendIncome'] ?? 0),
          });
          this.form.controls.businessIncome.patchValue({
            businessProfit: Number(latestAis['businessIncome'] ?? 0),
          });
        }
        if (salarySlips.length > 0) {
          const latest = salarySlips[0];
          this.form.controls.salary.patchValue({
            basicSalary: Number(latest['basicSalary'] ?? 0),
            hraReceived: Number(latest['hra'] ?? 0),
            specialAllowance: Number(latest['specialAllowance'] ?? 0),
            bonus: Number(latest['bonus'] ?? 0),
            commission: Number(latest['commission'] ?? 0),
            employerPf: Number(latest['employerPf'] ?? 0),
            employeePf: Number(latest['employeePf'] ?? 0),
            professionalTax: Number(latest['professionalTax'] ?? 0),
            otherAllowances: Number(latest['otherAllowances'] ?? 0),
          });
        }
        if (form16.length > 0) {
          const latestForm16 = form16[0];
          if (salarySlips.length === 0) {
            // Form 16 only reports lump-sum Gross Salary/Professional Tax (no HRA/allowance
            // breakup) — use it as a best-effort fallback when no Salary Slip is available. A
            // Salary Slip (patched above, if present) always takes priority for the breakdown.
            const grossSalary = Number(latestForm16['grossSalary'] ?? 0);
            if (grossSalary > 0) {
              this.form.controls.salary.patchValue({ basicSalary: grossSalary });
            }
            this.form.controls.salary.patchValue({
              professionalTax: Number(latestForm16['professionalTax'] ?? 0),
            });
          }
          // Section 80CCD(2) — employer's contribution to NPS — is only ever reported on Form 16
          // (Salary Slips and AIS don't carry it), so always take it from Form 16 when present.
          this.form.controls.deductions.patchValue({
            employerNpsContribution: Number(latestForm16['employerNpsContribution'] ?? 0),
          });
        }
        if (salarySlips.length === 0 && ais.length > 0 && Number(ais[0]['salaryIncome'] ?? 0) > 0) {
          this.toast.success(
            'Form pre-filled from AIS. Basic Salary was set from AIS\'s lump-sum Salary figure — review and split it into HRA/allowances manually, or upload a Salary Slip for an accurate breakdown.',
          );
        } else {
          this.toast.success('Form pre-filled from imported documents. Please review before calculating.');
        }
      },
      error: () => {
        this.importing.set(false);
        this.toast.error('Failed to load imported documents.');
      },
    });
  }

  calculate(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error('Please fix the highlighted fields before calculating.');
      return;
    }
    this.calculating.set(true);
    const input = this.form.getRawValue() as TaxCalculationInput;
    this.taxService.calculate(input).subscribe({
      next: (comparison) => {
        this.result.set(comparison);
        this.calculating.set(false);
      },
      error: () => {
        this.calculating.set(false);
        this.toast.error('Failed to calculate tax. Please try again.');
      },
    });
  }

  currentInput(): TaxCalculationInput {
    return this.form.getRawValue() as TaxCalculationInput;
  }

  openSaveDialog(): void {
    const comparison = this.result();
    if (!comparison) return;
    const ref = this.dialog.open(TaxSaveDialogComponent, { width: '420px' });
    ref.afterClosed().subscribe((label: string | undefined) => {
      if (label === undefined) return;
      this.taxService
        .save({
          financialYearCode: comparison.financialYearCode,
          label: label || undefined,
          selectedRegime: comparison.recommendedRegime,
          inputs: this.currentInput(),
          result: comparison,
        })
        .subscribe({
          next: () => this.toast.success('Calculation saved to history.'),
          error: () => this.toast.error('Failed to save calculation.'),
        });
    });
  }
}
