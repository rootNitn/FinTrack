import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HEALTH_GOAL_TYPES, HealthGoal } from '../health.model';
import { HealthGoalsService } from '../health-goals.service';

export interface HealthGoalFormDialogData {
  goal?: HealthGoal;
}

@Component({
  selector: 'app-health-goal-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './health-goal-form.component.html',
})
export class HealthGoalFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly healthGoalsService = inject(HealthGoalsService);
  private readonly dialogRef = inject(MatDialogRef<HealthGoalFormComponent>);
  readonly data = inject<HealthGoalFormDialogData>(MAT_DIALOG_DATA);

  readonly goalTypes = HEALTH_GOAL_TYPES;
  readonly isEdit = !!this.data?.goal;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: [this.data?.goal?.type ?? 'WEIGHT_TARGET', [Validators.required]],
    targetValue: [this.data?.goal?.targetValue ?? null, [Validators.required, Validators.min(0.01)]],
    deadline: [this.data?.goal?.deadline ? new Date(this.data.goal.deadline) : null],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    if (this.isEdit) {
      const payload = {
        targetValue: Number(raw.targetValue),
        deadline: raw.deadline ? (raw.deadline as Date).toISOString() : null,
      };
      this.healthGoalsService.update(this.data.goal!.id, payload).subscribe({
        next: (goal) => {
          this.submitting.set(false);
          this.dialogRef.close(goal);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Failed to save health goal.');
        },
      });
      return;
    }

    const payload = {
      type: raw.type,
      targetValue: Number(raw.targetValue),
      deadline: raw.deadline ? (raw.deadline as Date).toISOString() : null,
    };
    this.healthGoalsService.create(payload).subscribe({
      next: (goal) => {
        this.submitting.set(false);
        this.dialogRef.close(goal);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save health goal.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
