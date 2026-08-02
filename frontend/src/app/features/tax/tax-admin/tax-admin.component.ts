import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { TaxAdminService } from '../tax-admin.service';
import {
  TaxCapitalGainRuleAdmin,
  TaxCessRuleAdmin,
  TaxDeductionRuleAdmin,
  TaxFinancialYearAdmin,
  TaxFinancialYearDetail,
  TaxRebateRuleAdmin,
  TaxSlabAdmin,
  TaxSurchargeRuleAdmin,
  CostInflationIndexAdmin,
  TaxValidationRuleAdmin,
} from '../tax-admin.model';

@Component({
  selector: 'app-tax-admin',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatIconModule,
    MatTabsModule,
    MatTooltipModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './tax-admin.component.html',
  styleUrl: './tax-admin.component.scss',
})
export class TaxAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly adminService = inject(TaxAdminService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly financialYears = signal<TaxFinancialYearAdmin[]>([]);
  readonly selectedYear = signal<TaxFinancialYearDetail | null>(null);
  readonly editingYearId = signal<string | null>(null);

  readonly editingSlabId = signal<string | null>(null);
  readonly editingRebateId = signal<string | null>(null);
  readonly editingSurchargeId = signal<string | null>(null);
  readonly editingCessId = signal<string | null>(null);
  readonly editingDeductionId = signal<string | null>(null);

  readonly capitalGainRules = signal<TaxCapitalGainRuleAdmin[]>([]);
  readonly editingCapitalGainRuleId = signal<string | null>(null);
  readonly costInflationIndices = signal<CostInflationIndexAdmin[]>([]);
  readonly editingCiiId = signal<string | null>(null);
  readonly validationRules = signal<TaxValidationRuleAdmin[]>([]);
  readonly editingValidationRuleId = signal<string | null>(null);

  readonly yearColumns: DataTableColumn<TaxFinancialYearAdmin>[] = [
    { key: 'code', header: 'Code', sortable: true },
    { key: 'label', header: 'Label' },
    { key: 'assessmentYear', header: 'Assessment Year' },
    { key: 'isDefault', header: 'Default', cell: (row) => (row.isDefault ? 'Yes' : '—') },
    { key: 'isActive', header: 'Active', cell: (row) => (row.isActive ? 'Yes' : 'No') },
  ];

  readonly slabColumns: DataTableColumn<TaxSlabAdmin>[] = [
    { key: 'regime', header: 'Regime' },
    { key: 'ageCategory', header: 'Age Category' },
    { key: 'slabOrder', header: 'Order' },
    { key: 'minIncome', header: 'Min Income', cell: (row) => row.minIncome.toLocaleString('en-IN') },
    { key: 'maxIncome', header: 'Max Income', cell: (row) => (row.maxIncome === null ? 'No limit' : row.maxIncome.toLocaleString('en-IN')) },
    { key: 'ratePercent', header: 'Rate', cell: (row) => `${row.ratePercent}%` },
  ];

  readonly rebateColumns: DataTableColumn<TaxRebateRuleAdmin>[] = [
    { key: 'regime', header: 'Regime' },
    { key: 'thresholdIncome', header: 'Threshold Income', cell: (row) => row.thresholdIncome.toLocaleString('en-IN') },
    { key: 'maxRebateAmount', header: 'Max Rebate', cell: (row) => row.maxRebateAmount.toLocaleString('en-IN') },
    { key: 'marginalReliefEnabled', header: 'Marginal Relief', cell: (row) => (row.marginalReliefEnabled ? 'Yes' : 'No') },
  ];

  readonly surchargeColumns: DataTableColumn<TaxSurchargeRuleAdmin>[] = [
    { key: 'regime', header: 'Regime' },
    { key: 'slabOrder', header: 'Order' },
    { key: 'minIncome', header: 'Min Income', cell: (row) => row.minIncome.toLocaleString('en-IN') },
    { key: 'maxIncome', header: 'Max Income', cell: (row) => (row.maxIncome === null ? 'No limit' : row.maxIncome.toLocaleString('en-IN')) },
    { key: 'ratePercent', header: 'Rate', cell: (row) => `${row.ratePercent}%` },
    { key: 'marginalReliefEnabled', header: 'Marginal Relief', cell: (row) => (row.marginalReliefEnabled ? 'Yes' : 'No') },
  ];

  readonly cessColumns: DataTableColumn<TaxCessRuleAdmin>[] = [
    { key: 'label', header: 'Label' },
    { key: 'ratePercent', header: 'Rate', cell: (row) => `${row.ratePercent}%` },
  ];

  readonly deductionColumns: DataTableColumn<TaxDeductionRuleAdmin>[] = [
    { key: 'code', header: 'Code' },
    { key: 'regime', header: 'Regime' },
    { key: 'label', header: 'Label' },
    { key: 'maxLimit', header: 'Max Limit', cell: (row) => (row.maxLimit === null ? 'Unlimited' : row.maxLimit.toLocaleString('en-IN')) },
    { key: 'ratePercent', header: 'Rate', cell: (row) => (row.ratePercent === null ? '—' : `${row.ratePercent}%`) },
    { key: 'isAllowed', header: 'Allowed', cell: (row) => (row.isAllowed ? 'Yes' : 'No') },
  ];

  readonly capitalGainRuleColumns: DataTableColumn<TaxCapitalGainRuleAdmin>[] = [
    { key: 'assetType', header: 'Asset Type' },
    { key: 'termType', header: 'Term' },
    { key: 'ratePercent', header: 'Rate', cell: (row) => `${row.ratePercent}%` },
    {
      key: 'exemptionLimit',
      header: 'Exemption Limit',
      cell: (row) => (row.exemptionLimit === null ? 'None' : row.exemptionLimit.toLocaleString('en-IN')),
    },
    { key: 'indexationAllowed', header: 'Indexation', cell: (row) => (row.indexationAllowed ? 'Yes' : 'No') },
  ];

  readonly ciiColumns: DataTableColumn<CostInflationIndexAdmin>[] = [
    { key: 'year', header: 'Year' },
    { key: 'ciiValue', header: 'CII Value' },
  ];

  readonly validationRuleColumns: DataTableColumn<TaxValidationRuleAdmin>[] = [
    { key: 'documentType', header: 'Document Type' },
    { key: 'fieldName', header: 'Field' },
    { key: 'condition', header: 'Condition' },
    { key: 'tolerance', header: 'Tolerance', cell: (row) => row.tolerance.toLocaleString('en-IN') },
    { key: 'message', header: 'Message' },
    { key: 'isActive', header: 'Active', cell: (row) => (row.isActive ? 'Yes' : 'No') },
  ];

  readonly yearForm = this.fb.nonNullable.group({
    code: ['', Validators.required],
    label: ['', Validators.required],
    assessmentYear: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    isDefault: [false],
    isActive: [true],
  });

  readonly slabForm = this.fb.nonNullable.group({
    regime: ['OLD' as 'OLD' | 'NEW', Validators.required],
    ageCategory: ['GENERAL' as 'GENERAL' | 'SENIOR' | 'SUPER_SENIOR', Validators.required],
    slabOrder: [1, Validators.required],
    minIncome: [0, Validators.required],
    maxIncome: [null as number | null],
    ratePercent: [0, Validators.required],
  });

  readonly rebateForm = this.fb.nonNullable.group({
    regime: ['OLD' as 'OLD' | 'NEW', Validators.required],
    thresholdIncome: [0, Validators.required],
    maxRebateAmount: [0, Validators.required],
    marginalReliefEnabled: [true],
  });

  readonly surchargeForm = this.fb.nonNullable.group({
    regime: ['OLD' as 'OLD' | 'NEW', Validators.required],
    slabOrder: [1, Validators.required],
    minIncome: [0, Validators.required],
    maxIncome: [null as number | null],
    ratePercent: [0, Validators.required],
    marginalReliefEnabled: [true],
  });

  readonly cessForm = this.fb.nonNullable.group({
    label: ['Health & Education Cess', Validators.required],
    ratePercent: [4, Validators.required],
  });

  readonly deductionForm = this.fb.nonNullable.group({
    regime: ['OLD' as 'OLD' | 'NEW', Validators.required],
    code: ['', Validators.required],
    label: ['', Validators.required],
    maxLimit: [null as number | null],
    ratePercent: [null as number | null],
    isAllowed: [true],
  });

  readonly capitalGainRuleForm = this.fb.nonNullable.group({
    assetType: ['STOCK' as 'STOCK' | 'MUTUAL_FUND' | 'PROPERTY' | 'GOLD' | 'CRYPTO', Validators.required],
    termType: ['SHORT' as 'SHORT' | 'LONG', Validators.required],
    ratePercent: [0, Validators.required],
    exemptionLimit: [null as number | null],
    indexationAllowed: [false],
  });

  readonly ciiForm = this.fb.nonNullable.group({
    year: ['', Validators.required],
    ciiValue: [100, Validators.required],
  });

  readonly validationRuleForm = this.fb.nonNullable.group({
    documentType: ['SALARY_SLIP' as 'SALARY_SLIP' | 'FORM16' | 'AIS' | 'FORM26AS' | 'CAPITAL_GAINS_STATEMENT' | 'OTHER', Validators.required],
    fieldName: ['', Validators.required],
    condition: ['', Validators.required],
    tolerance: [1, Validators.required],
    message: ['', Validators.required],
    isActive: [true],
  });

  ngOnInit(): void {
    this.loadYears();
    this.loadCapitalGainRules();
    this.loadCostInflationIndices();
    this.loadValidationRules();
  }

  loadYears(): void {
    this.loading.set(true);
    this.adminService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  selectYear(year: TaxFinancialYearAdmin): void {
    this.adminService.getFinancialYear(year.id).subscribe((detail) => this.selectedYear.set(detail));
  }

  closeYearDetail(): void {
    this.selectedYear.set(null);
  }

  private refreshSelectedYear(): void {
    const year = this.selectedYear();
    if (!year) return;
    this.adminService.getFinancialYear(year.id).subscribe((detail) => this.selectedYear.set(detail));
  }

  // ── Financial Years ─────────────────────────────────────────────
  editYear(year: TaxFinancialYearAdmin): void {
    this.editingYearId.set(year.id);
    this.yearForm.patchValue({
      code: year.code,
      label: year.label,
      assessmentYear: year.assessmentYear,
      startDate: year.startDate.slice(0, 10),
      endDate: year.endDate.slice(0, 10),
      isDefault: year.isDefault,
      isActive: year.isActive,
    });
  }

  cancelYearEdit(): void {
    this.editingYearId.set(null);
    this.yearForm.reset({ code: '', label: '', assessmentYear: '', startDate: '', endDate: '', isDefault: false, isActive: true });
  }

  saveYear(): void {
    if (this.yearForm.invalid) return;
    const payload = this.yearForm.getRawValue();
    const editingId = this.editingYearId();
    const request = editingId ? this.adminService.updateFinancialYear(editingId, payload) : this.adminService.createFinancialYear(payload);
    request.subscribe({
      next: () => {
        this.toast.success(editingId ? 'Financial year updated.' : 'Financial year created.');
        this.cancelYearEdit();
        this.loadYears();
      },
      error: () => this.toast.error('Failed to save financial year.'),
    });
  }

  deleteYear(year: TaxFinancialYearAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({ title: 'Delete financial year', message: `Delete ${year.label}? This removes all its slabs and rules.`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.deleteFinancialYear(year.id).subscribe(() => {
          this.toast.success('Financial year deleted.');
          if (this.selectedYear()?.id === year.id) this.selectedYear.set(null);
          this.loadYears();
        });
      });
  }

  // ── Slabs ────────────────────────────────────────────────────────
  editSlab(row: TaxSlabAdmin): void {
    this.editingSlabId.set(row.id);
    this.slabForm.patchValue(row);
  }

  cancelSlabEdit(): void {
    this.editingSlabId.set(null);
    this.slabForm.reset({ regime: 'OLD', ageCategory: 'GENERAL', slabOrder: 1, minIncome: 0, maxIncome: null, ratePercent: 0 });
  }

  saveSlab(): void {
    const year = this.selectedYear();
    if (!year || this.slabForm.invalid) return;
    const payload = this.slabForm.getRawValue();
    const editingId = this.editingSlabId();
    const request = editingId ? this.adminService.updateSlab(editingId, payload) : this.adminService.createSlab({ ...payload, financialYearId: year.id });
    request.subscribe({
      next: () => {
        this.toast.success('Slab saved.');
        this.cancelSlabEdit();
        this.refreshSelectedYear();
      },
      error: () => this.toast.error('Failed to save slab.'),
    });
  }

  deleteSlab(row: TaxSlabAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog.open({ title: 'Delete slab', message: 'Delete this tax slab?', confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.adminService.deleteSlab(row.id).subscribe(() => {
        this.toast.success('Slab deleted.');
        this.refreshSelectedYear();
      });
    });
  }

  // ── Rebate Rules ─────────────────────────────────────────────────
  editRebate(row: TaxRebateRuleAdmin): void {
    this.editingRebateId.set(row.id);
    this.rebateForm.patchValue(row);
  }

  cancelRebateEdit(): void {
    this.editingRebateId.set(null);
    this.rebateForm.reset({ regime: 'OLD', thresholdIncome: 0, maxRebateAmount: 0, marginalReliefEnabled: true });
  }

  saveRebate(): void {
    const year = this.selectedYear();
    if (!year || this.rebateForm.invalid) return;
    const payload = this.rebateForm.getRawValue();
    const editingId = this.editingRebateId();
    const request = editingId ? this.adminService.updateRebateRule(editingId, payload) : this.adminService.createRebateRule({ ...payload, financialYearId: year.id });
    request.subscribe({
      next: () => {
        this.toast.success('Rebate rule saved.');
        this.cancelRebateEdit();
        this.refreshSelectedYear();
      },
      error: () => this.toast.error('Failed to save rebate rule.'),
    });
  }

  deleteRebate(row: TaxRebateRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog.open({ title: 'Delete rebate rule', message: 'Delete this rebate rule?', confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.adminService.deleteRebateRule(row.id).subscribe(() => {
        this.toast.success('Rebate rule deleted.');
        this.refreshSelectedYear();
      });
    });
  }

  // ── Surcharge Rules ──────────────────────────────────────────────
  editSurcharge(row: TaxSurchargeRuleAdmin): void {
    this.editingSurchargeId.set(row.id);
    this.surchargeForm.patchValue(row);
  }

  cancelSurchargeEdit(): void {
    this.editingSurchargeId.set(null);
    this.surchargeForm.reset({ regime: 'OLD', slabOrder: 1, minIncome: 0, maxIncome: null, ratePercent: 0, marginalReliefEnabled: true });
  }

  saveSurcharge(): void {
    const year = this.selectedYear();
    if (!year || this.surchargeForm.invalid) return;
    const payload = this.surchargeForm.getRawValue();
    const editingId = this.editingSurchargeId();
    const request = editingId
      ? this.adminService.updateSurchargeRule(editingId, payload)
      : this.adminService.createSurchargeRule({ ...payload, financialYearId: year.id });
    request.subscribe({
      next: () => {
        this.toast.success('Surcharge rule saved.');
        this.cancelSurchargeEdit();
        this.refreshSelectedYear();
      },
      error: () => this.toast.error('Failed to save surcharge rule.'),
    });
  }

  deleteSurcharge(row: TaxSurchargeRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog.open({ title: 'Delete surcharge rule', message: 'Delete this surcharge rule?', confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.adminService.deleteSurchargeRule(row.id).subscribe(() => {
        this.toast.success('Surcharge rule deleted.');
        this.refreshSelectedYear();
      });
    });
  }

  // ── Cess Rules ───────────────────────────────────────────────────
  editCess(row: TaxCessRuleAdmin): void {
    this.editingCessId.set(row.id);
    this.cessForm.patchValue(row);
  }

  cancelCessEdit(): void {
    this.editingCessId.set(null);
    this.cessForm.reset({ label: 'Health & Education Cess', ratePercent: 4 });
  }

  saveCess(): void {
    const year = this.selectedYear();
    if (!year || this.cessForm.invalid) return;
    const payload = this.cessForm.getRawValue();
    const editingId = this.editingCessId();
    const request = editingId ? this.adminService.updateCessRule(editingId, payload) : this.adminService.createCessRule({ ...payload, financialYearId: year.id });
    request.subscribe({
      next: () => {
        this.toast.success('Cess rule saved.');
        this.cancelCessEdit();
        this.refreshSelectedYear();
      },
      error: () => this.toast.error('Failed to save cess rule.'),
    });
  }

  deleteCess(row: TaxCessRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog.open({ title: 'Delete cess rule', message: 'Delete this cess rule?', confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.adminService.deleteCessRule(row.id).subscribe(() => {
        this.toast.success('Cess rule deleted.');
        this.refreshSelectedYear();
      });
    });
  }

  // ── Deduction Rules ──────────────────────────────────────────────
  editDeduction(row: TaxDeductionRuleAdmin): void {
    this.editingDeductionId.set(row.id);
    this.deductionForm.patchValue(row);
  }

  cancelDeductionEdit(): void {
    this.editingDeductionId.set(null);
    this.deductionForm.reset({ regime: 'OLD', code: '', label: '', maxLimit: null, ratePercent: null, isAllowed: true });
  }

  saveDeduction(): void {
    const year = this.selectedYear();
    if (!year || this.deductionForm.invalid) return;
    const payload = this.deductionForm.getRawValue();
    const editingId = this.editingDeductionId();
    const request = editingId
      ? this.adminService.updateDeductionRule(editingId, payload)
      : this.adminService.createDeductionRule({ ...payload, financialYearId: year.id });
    request.subscribe({
      next: () => {
        this.toast.success('Deduction rule saved.');
        this.cancelDeductionEdit();
        this.refreshSelectedYear();
      },
      error: () => this.toast.error('Failed to save deduction rule.'),
    });
  }

  deleteDeduction(row: TaxDeductionRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog.open({ title: 'Delete deduction rule', message: 'Delete this deduction rule?', confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.adminService.deleteDeductionRule(row.id).subscribe(() => {
        this.toast.success('Deduction rule deleted.');
        this.refreshSelectedYear();
      });
    });
  }

  // ── Capital Gain Rules ───────────────────────────────────────────
  loadCapitalGainRules(): void {
    this.adminService.listCapitalGainRules().subscribe((rows) => this.capitalGainRules.set(rows));
  }

  editCapitalGainRule(row: TaxCapitalGainRuleAdmin): void {
    this.editingCapitalGainRuleId.set(row.id);
    this.capitalGainRuleForm.patchValue(row);
  }

  cancelCapitalGainRuleEdit(): void {
    this.editingCapitalGainRuleId.set(null);
    this.capitalGainRuleForm.reset({ assetType: 'STOCK', termType: 'SHORT', ratePercent: 0, exemptionLimit: null, indexationAllowed: false });
  }

  saveCapitalGainRule(): void {
    if (this.capitalGainRuleForm.invalid) return;
    const payload = this.capitalGainRuleForm.getRawValue();
    const editingId = this.editingCapitalGainRuleId();
    const request = editingId
      ? this.adminService.updateCapitalGainRule(editingId, payload)
      : this.adminService.createCapitalGainRule(payload);
    request.subscribe({
      next: () => {
        this.toast.success('Capital gain rule saved.');
        this.cancelCapitalGainRuleEdit();
        this.loadCapitalGainRules();
      },
      error: () => this.toast.error('Failed to save capital gain rule.'),
    });
  }

  deleteCapitalGainRule(row: TaxCapitalGainRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({ title: 'Delete capital gain rule', message: 'Delete this capital gain rule?', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.deleteCapitalGainRule(row.id).subscribe(() => {
          this.toast.success('Capital gain rule deleted.');
          this.loadCapitalGainRules();
        });
      });
  }

  // ── Cost Inflation Index ─────────────────────────────────────────
  loadCostInflationIndices(): void {
    this.adminService.listCostInflationIndices().subscribe((rows) => this.costInflationIndices.set(rows));
  }

  editCii(row: CostInflationIndexAdmin): void {
    this.editingCiiId.set(row.id);
    this.ciiForm.patchValue(row);
  }

  cancelCiiEdit(): void {
    this.editingCiiId.set(null);
    this.ciiForm.reset({ year: '', ciiValue: 100 });
  }

  saveCii(): void {
    if (this.ciiForm.invalid) return;
    const payload = this.ciiForm.getRawValue();
    const editingId = this.editingCiiId();
    const request = editingId ? this.adminService.updateCostInflationIndex(editingId, payload) : this.adminService.createCostInflationIndex(payload);
    request.subscribe({
      next: () => {
        this.toast.success('Cost Inflation Index entry saved.');
        this.cancelCiiEdit();
        this.loadCostInflationIndices();
      },
      error: () => this.toast.error('Failed to save Cost Inflation Index entry.'),
    });
  }

  deleteCii(row: CostInflationIndexAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({ title: 'Delete CII entry', message: `Delete Cost Inflation Index entry for ${row.year}?`, confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.deleteCostInflationIndex(row.id).subscribe(() => {
          this.toast.success('Cost Inflation Index entry deleted.');
          this.loadCostInflationIndices();
        });
      });
  }

  // ── Validation Rules ─────────────────────────────────────────────
  loadValidationRules(): void {
    this.adminService.listValidationRules().subscribe((rows) => this.validationRules.set(rows));
  }

  editValidationRule(row: TaxValidationRuleAdmin): void {
    this.editingValidationRuleId.set(row.id);
    this.validationRuleForm.patchValue(row);
  }

  cancelValidationRuleEdit(): void {
    this.editingValidationRuleId.set(null);
    this.validationRuleForm.reset({ documentType: 'SALARY_SLIP', fieldName: '', condition: '', tolerance: 1, message: '', isActive: true });
  }

  saveValidationRule(): void {
    if (this.validationRuleForm.invalid) return;
    const payload = this.validationRuleForm.getRawValue();
    const editingId = this.editingValidationRuleId();
    const request = editingId
      ? this.adminService.updateValidationRule(editingId, payload)
      : this.adminService.createValidationRule(payload);
    request.subscribe({
      next: () => {
        this.toast.success('Validation rule saved.');
        this.cancelValidationRuleEdit();
        this.loadValidationRules();
      },
      error: () => this.toast.error('Failed to save validation rule.'),
    });
  }

  deleteValidationRule(row: TaxValidationRuleAdmin, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({ title: 'Delete validation rule', message: 'Delete this validation rule?', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.adminService.deleteValidationRule(row.id).subscribe(() => {
          this.toast.success('Validation rule deleted.');
          this.loadValidationRules();
        });
      });
  }
}
