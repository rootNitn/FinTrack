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
import { WORKOUT_TYPES, WorkoutLog } from '../health.model';
import { WorkoutsService } from '../workouts.service';

export interface WorkoutFormDialogData {
  log?: WorkoutLog;
}

@Component({
  selector: 'app-workout-form',
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
  templateUrl: './workout-form.component.html',
})
export class WorkoutFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly workoutsService = inject(WorkoutsService);
  private readonly dialogRef = inject(MatDialogRef<WorkoutFormComponent>);
  readonly data = inject<WorkoutFormDialogData>(MAT_DIALOG_DATA);

  readonly workoutTypes = WORKOUT_TYPES;
  readonly isEdit = !!this.data?.log;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    type: [this.data?.log?.type ?? 'CARDIO', [Validators.required]],
    name: [this.data?.log?.name ?? ''],
    durationMinutes: [this.data?.log?.durationMinutes ?? null, [Validators.required, Validators.min(1)]],
    caloriesBurned: [this.data?.log?.caloriesBurned ?? null],
    distanceKm: [this.data?.log?.distanceKm ?? null],
    notes: [this.data?.log?.notes ?? ''],
    date: [this.data?.log ? new Date(this.data.log.date) : new Date(), [Validators.required]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      type: raw.type,
      name: raw.name || undefined,
      durationMinutes: Number(raw.durationMinutes),
      caloriesBurned: raw.caloriesBurned != null ? Number(raw.caloriesBurned) : undefined,
      distanceKm: raw.distanceKm != null ? Number(raw.distanceKm) : undefined,
      notes: raw.notes || undefined,
      date: (raw.date as Date).toISOString(),
    };

    const request = this.isEdit ? this.workoutsService.update(this.data.log!.id, payload) : this.workoutsService.create(payload);

    request.subscribe({
      next: (log) => {
        this.submitting.set(false);
        this.dialogRef.close(log);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save workout log.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
