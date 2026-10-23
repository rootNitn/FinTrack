import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { Goal } from '../goals.model';
import { GoalsService } from '../goals.service';
import { GoalFormComponent } from '../goal-form/goal-form.component';
import { GoalContributeDialogComponent } from '../goal-contribute-dialog/goal-contribute-dialog.component';
import { GoalHistoryDialogComponent } from '../goal-history-dialog/goal-history-dialog.component';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { formatDate } from '../../../shared/utils/date.util';
import { FamilyMember } from '../../family-members/family-members.model';
import { FamilyMembersService } from '../../family-members/family-members.service';

function currency(value: number): string {
  return formatCurrency(value);
}

function date(value: string): string {
  return formatDate(value);
}

@Component({
  selector: 'app-goal-list',
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule, MatSelectModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './goal-list.component.html',
  styleUrl: './goal-list.component.scss',
})
export class GoalListComponent {
  private readonly goalsService = inject(GoalsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly familyMembersService = inject(FamilyMembersService);

  readonly loading = signal(true);
  readonly goals = signal<Goal[]>([]);
  readonly familyMembers = signal<FamilyMember[]>([]);
  readonly selectedFamilyMemberId = signal('');

  readonly columns: DataTableColumn<Goal>[] = [
    { key: 'name', header: 'Goal', sortable: true },
    { key: 'type', header: 'Type', sortable: true, cell: (row) => row.type.replace('_', ' ') },
    { key: 'targetAmount', header: 'Target', sortable: true, cell: (row) => currency(row.targetAmount) },
    { key: 'currentAmount', header: 'Saved', sortable: true, cell: (row) => currency(row.currentAmount) },
    { key: 'progressPercent', header: 'Progress', sortable: true, cell: (row) => `${row.progressPercent}%` },
    { key: 'deadline', header: 'Deadline', sortable: true, cell: (row) => date(row.deadline) },
    { key: 'projectedCompletionDate', header: 'Projected', sortable: true, cell: (row) => row.projectedCompletionDate ? date(row.projectedCompletionDate) : '-' },
    { key: 'requiredMonthlyContribution', header: 'Required / Month', sortable: true, cell: (row) => row.requiredMonthlyContribution ? currency(row.requiredMonthlyContribution) : '-' },
    { key: 'status', header: 'Status', sortable: true, cell: (row) => this.statusLabel(row.status) },
    { key: 'familyMemberName', header: 'Member', cell: (row) => row.familyMemberName ?? '-' },
  ];

  constructor() {
    this.load();
    this.familyMembersService.list().subscribe((members) => this.familyMembers.set(members));
  }

  load(): void {
    this.loading.set(true);
    this.goalsService.list(this.selectedFamilyMemberId() || undefined).subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFamilyMemberFilterChange(): void {
    this.load();
  }

  statusLabel(status: Goal['status']): string {
    return status ? status.replace('_', ' ') : '-';
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(GoalFormComponent, { width: '600px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Goal added.');
        this.load();
      }
    });
  }

  goalCurrency(value: number): string {
    return currency(value);
  }

  goalDate(value: string): string {
    return date(value);
  }

  openEditDialog(goal: Goal): void {
    const ref = this.dialog.open(GoalFormComponent, { width: '600px', data: { goal } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Goal updated.');
        this.load();
      }
    });
  }

  openContributeDialog(goal: Goal): void {
    const ref = this.dialog.open(GoalContributeDialogComponent, { width: '420px', data: { goal } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Contribution added.');
        this.load();
      }
    });
  }

  openHistoryDialog(goal: Goal): void {
    this.dialog.open(GoalHistoryDialogComponent, { width: '560px', maxWidth: '95vw', data: { goal } });
  }

  deleteGoal(goal: Goal): void {
    this.confirmDialog
      .open({
        title: 'Delete goal',
        message: `Are you sure you want to delete "${goal.name}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.goalsService.remove(goal.id).subscribe(() => {
          this.toast.success('Goal deleted.');
          this.load();
        });
      });
  }
}
