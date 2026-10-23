import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { HealthGoal } from '../health.model';
import { HealthGoalsService } from '../health-goals.service';
import { HealthGoalFormComponent } from '../health-goal-form/health-goal-form.component';

@Component({
  selector: 'app-health-goal-list',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    PageHeaderComponent,
    EmptyStateComponent,
    SkeletonLoaderComponent,
  ],
  templateUrl: './health-goal-list.component.html',
})
export class HealthGoalListComponent {
  private readonly healthGoalsService = inject(HealthGoalsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly goals = signal<HealthGoal[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.healthGoalsService.list().subscribe({
      next: (goals) => {
        this.goals.set(goals);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(HealthGoalFormComponent, { width: '480px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Health goal added.');
        this.load();
      }
    });
  }

  openEditDialog(goal: HealthGoal): void {
    const ref = this.dialog.open(HealthGoalFormComponent, { width: '480px', data: { goal } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Health goal updated.');
        this.load();
      }
    });
  }

  remove(goal: HealthGoal): void {
    this.confirmDialog
      .open({ title: 'Delete goal', message: 'Delete this health goal? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.healthGoalsService.remove(goal.id).subscribe(() => {
          this.toast.success('Health goal deleted.');
          this.load();
        });
      });
  }
}
