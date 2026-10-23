import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { WorkoutLog } from '../health.model';
import { WorkoutsService } from '../workouts.service';
import { WorkoutFormComponent } from '../workout-form/workout-form.component';
import { formatDate } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-workout-list',
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './workout-list.component.html',
})
export class WorkoutListComponent {
  private readonly workoutsService = inject(WorkoutsService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly logs = signal<WorkoutLog[]>([]);

  readonly columns: DataTableColumn<WorkoutLog>[] = [
    { key: 'date', header: 'Date', sortable: true, cell: (row) => formatDate(row.date) },
    { key: 'type', header: 'Type', sortable: true, cell: (row) => row.type.replaceAll('_', ' ') },
    { key: 'name', header: 'Name', cell: (row) => row.name ?? '-' },
    { key: 'durationMinutes', header: 'Duration (min)', sortable: true, cell: (row) => String(row.durationMinutes) },
    { key: 'caloriesBurned', header: 'Calories', cell: (row) => (row.caloriesBurned != null ? String(row.caloriesBurned) : '-') },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.workoutsService.list().subscribe({
      next: (logs) => {
        this.logs.set(logs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(WorkoutFormComponent, { width: '560px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Workout logged.');
        this.load();
      }
    });
  }

  openEditDialog(log: WorkoutLog): void {
    const ref = this.dialog.open(WorkoutFormComponent, { width: '560px', data: { log } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Workout updated.');
        this.load();
      }
    });
  }

  remove(log: WorkoutLog): void {
    this.confirmDialog
      .open({ title: 'Delete workout', message: 'Delete this workout log? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.workoutsService.remove(log.id).subscribe(() => {
          this.toast.success('Workout deleted.');
          this.load();
        });
      });
  }
}
