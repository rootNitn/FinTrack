import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Goal, GoalContribution } from '../goals.model';
import { GoalsService } from '../goals.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';

export interface GoalHistoryDialogData {
  goal: Goal;
}

@Component({
  selector: 'app-goal-history-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  templateUrl: './goal-history-dialog.component.html',
})
export class GoalHistoryDialogComponent {
  private readonly goalsService = inject(GoalsService);
  private readonly dialogRef = inject(MatDialogRef<GoalHistoryDialogComponent>);
  readonly data = inject<GoalHistoryDialogData>(MAT_DIALOG_DATA);
  readonly goal = signal(this.data.goal);
  readonly contributions = signal<GoalContribution[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly currency = formatCurrency;
  readonly date = formatDate;

  constructor() {
    this.goalsService.getById(this.data.goal.id).subscribe({
      next: (goal) => this.goal.set(goal),
      error: () => this.error.set('Unable to load goal details.'),
    });
    this.goalsService.contributions(this.data.goal.id).subscribe({
      next: (contributions) => this.contributions.set(contributions),
      error: () => {
        this.error.set('Unable to load contribution history.');
      },
      complete: () => this.loading.set(false),
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
