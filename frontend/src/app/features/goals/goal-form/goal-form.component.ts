import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { GOAL_TYPES, Goal } from '../goals.model';
import { GoalsService } from '../goals.service';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';

export interface GoalFormDialogData {
  goal?: Goal;
}

@Component({
  selector: 'app-goal-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatDatepickerModule,
    MatNativeDateModule,
  ],
  templateUrl: './goal-form.component.html',
  styleUrl: './goal-form.component.scss',
})
export class GoalFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly goalsService = inject(GoalsService);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly dialogRef = inject(MatDialogRef<GoalFormComponent>);
  readonly data = inject<GoalFormDialogData>(MAT_DIALOG_DATA);

  readonly goalTypes = GOAL_TYPES;
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly isEdit = !!this.data?.goal;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data?.goal?.name ?? '', [Validators.required, Validators.maxLength(150)]],
    type: [this.data?.goal?.type ?? 'CUSTOM', [Validators.required]],
    targetAmount: [this.data?.goal?.targetAmount ?? null, [Validators.required, Validators.min(1)]],
    currentAmount: [this.data?.goal?.currentAmount ?? 0, [Validators.required, Validators.min(0)]],
    deadline: [this.data?.goal ? new Date(this.data.goal.deadline) : null, [Validators.required]],
    icon: [this.data?.goal?.icon ?? ''],
    familyMemberId: [this.data?.goal?.familyMemberId ?? ''],
  });

  constructor() {
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      type: raw.type,
      targetAmount: Number(raw.targetAmount),
      currentAmount: Number(raw.currentAmount),
      deadline: new Date(raw.deadline as unknown as Date).toISOString(),
      ...(raw.icon ? { icon: raw.icon } : {}),
      familyMemberId: raw.familyMemberId || null,
    };

    const request = this.isEdit ? this.goalsService.update(this.data.goal!.id, payload) : this.goalsService.create(payload);

    request.subscribe({
      next: (goal) => {
        this.submitting.set(false);
        this.dialogRef.close(goal);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save goal.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
