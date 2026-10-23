import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Goal } from '../goals.model';
import { GoalsService } from '../goals.service';

export interface GoalContributeDialogData {
  goal: Goal;
}

@Component({
  selector: 'app-goal-contribute-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './goal-contribute-dialog.component.html',
  styleUrl: './goal-contribute-dialog.component.scss',
})
export class GoalContributeDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly goalsService = inject(GoalsService);
  private readonly dialogRef = inject(MatDialogRef<GoalContributeDialogComponent>);
  readonly data = inject<GoalContributeDialogData>(MAT_DIALOG_DATA);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    amount: [null as number | null, [Validators.required, Validators.min(1)]],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    note: [''],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const value = this.form.getRawValue();
    this.goalsService.addContribution(this.data.goal.id, Number(value.amount), value.date, value.note || undefined).subscribe({
      next: (goal) => {
        this.submitting.set(false);
        this.dialogRef.close(goal);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to add contribution.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
