import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { IncomeService } from '../income.service';
import { IncomeSourceGrowthPotential, IncomeSourceMode, IncomeSourceStability } from '../income-source.model';
import { IncomeSourceProfile } from '../income-source.model';

export interface IncomeSourceFormDialogData {
  source?: IncomeSourceProfile;
}

@Component({
  selector: 'app-income-source-form',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDatepickerModule, MatNativeDateModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatProgressSpinnerModule, MatSelectModule],
  templateUrl: './income-source-form.component.html',
})
export class IncomeSourceFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly incomeService = inject(IncomeService);
  private readonly dialogRef = inject(MatDialogRef<IncomeSourceFormComponent>);
  readonly data = inject<IncomeSourceFormDialogData>(MAT_DIALOG_DATA, { optional: true });
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly modes: IncomeSourceMode[] = ['ACTIVE', 'SEMI_PASSIVE', 'PASSIVE'];
  readonly stabilities: IncomeSourceStability[] = ['LOW', 'MEDIUM', 'HIGH', 'VARIABLE'];
  readonly growthOptions: IncomeSourceGrowthPotential[] = ['LOW', 'MEDIUM', 'HIGH'];
  readonly isEdit = !!this.data?.source;
  readonly form = this.fb.nonNullable.group({
    name: [this.data?.source?.name ?? '', [Validators.required, Validators.maxLength(120)]],
    type: [this.data?.source?.type ?? 'SIDE_BUSINESS', [Validators.required]],
    incomeMode: [this.data?.source?.incomeMode ?? 'ACTIVE' as IncomeSourceMode, Validators.required],
    monthlyAverageAmount: [this.data?.source?.monthlyAverageAmount ?? null as number | null, [Validators.required, Validators.min(0)]],
    frequency: [this.data?.source?.frequency ?? 'MONTHLY', Validators.required],
    stability: [this.data?.source?.stability ?? 'MEDIUM' as IncomeSourceStability, Validators.required],
    growthPotential: [this.data?.source?.growthPotential ?? 'HIGH' as IncomeSourceGrowthPotential, Validators.required],
    startDate: [this.data?.source?.startDate ? new Date(this.data.source.startDate) : new Date(), Validators.required],
    endDate: [this.data?.source?.endDate ? new Date(this.data.source.endDate) : null as Date | null],
    notes: [this.data?.source?.notes ?? ''],
  });

  submit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name.trim(), type: raw.type.trim(), incomeMode: raw.incomeMode,
      monthlyAverageAmount: Number(raw.monthlyAverageAmount), frequency: raw.frequency,
      stability: raw.stability, growthPotential: raw.growthPotential,
      startDate: (raw.startDate as Date).toISOString(),
      endDate: raw.endDate ? (raw.endDate as Date).toISOString() : null,
      isActive: true, notes: raw.notes || null,
    };
    const request = this.isEdit
      ? this.incomeService.updateSource(this.data!.source!.id, payload)
      : this.incomeService.createSource(payload);
    request.subscribe({
      next: (source) => { this.submitting.set(false); this.dialogRef.close(source); },
      error: (err) => { this.submitting.set(false); this.errorMessage.set(err?.error?.message ?? 'Failed to save income source.'); },
    });
  }

  cancel(): void { this.dialogRef.close(); }
}
