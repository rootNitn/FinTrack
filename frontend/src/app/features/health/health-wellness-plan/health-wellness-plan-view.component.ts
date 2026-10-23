import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { SkeletonLoaderComponent } from '../../../shared/components/skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { HealthReportsService } from '../health-reports.service';
import { HealthAiImproveResponse, HealthWellnessPlan } from '../health.model';
import { HealthWellnessDraftStoreService } from './health-wellness-draft-store.service';
import { formatDateTime } from '../../../shared/utils/date.util';

@Component({
  selector: 'app-health-wellness-plan-view',
  imports: [
    CommonModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './health-wellness-plan-view.component.html',
})
export class HealthWellnessPlanViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly healthReportsService = inject(HealthReportsService);
  private readonly draftStore = inject(HealthWellnessDraftStoreService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly refreshing = signal(false);
  readonly notFound = signal(false);
  readonly plan = signal<HealthWellnessPlan | null>(null);
  readonly draftContent = signal<HealthAiImproveResponse | null>(null);
  readonly draftReportId = signal<string | undefined>(undefined);

  readonly content = computed(() => this.plan()?.content ?? this.draftContent());
  readonly isSaved = computed(() => !!this.plan());
  readonly subtitle = computed(() => {
    const plan = this.plan();
    return plan ? `Saved ${formatDateTime(plan.createdAt)}` : 'Not saved yet — save it to revisit or print later.';
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id === 'new') {
      const draft = this.draftStore.take();
      if (!draft) {
        this.notFound.set(true);
        return;
      }
      this.draftContent.set(draft.content);
      this.draftReportId.set(draft.request.reportId);
      return;
    }

    if (!id) {
      this.notFound.set(true);
      return;
    }

    this.loading.set(true);
    this.healthReportsService.getWellnessPlan(id).subscribe({
      next: (plan) => {
        this.loading.set(false);
        this.plan.set(plan);
      },
      error: () => {
        this.loading.set(false);
        this.notFound.set(true);
      },
    });
  }

  save(): void {
    const content = this.draftContent();
    if (!content || this.saving()) return;

    this.saving.set(true);
    this.healthReportsService
      .saveWellnessPlan({ reportId: this.draftReportId(), content })
      .subscribe({
        next: (plan) => {
          this.saving.set(false);
          this.toast.success('Wellness plan saved.');
          this.router.navigate(['/health/wellness-plan', plan.id], { replaceUrl: true });
        },
        error: () => {
          this.saving.set(false);
          this.toast.error('Failed to save the wellness plan. Please try again.');
        },
      });
  }

  deletePlan(): void {
    const plan = this.plan();
    if (!plan) return;
    this.confirmDialog
      .open({ title: 'Delete wellness plan', message: 'Delete this saved wellness plan? This cannot be undone.', confirmLabel: 'Delete', danger: true })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.healthReportsService.removeWellnessPlan(plan.id).subscribe(() => {
          this.toast.success('Wellness plan deleted.');
          this.router.navigate(['/health/reports']);
        });
      });
  }

  refresh(): void {
    const plan = this.plan();
    if (!plan || this.refreshing()) return;

    this.refreshing.set(true);
    this.healthReportsService.regenerateWellnessPlan(plan.id).subscribe({
      next: (updated) => {
        this.refreshing.set(false);
        this.plan.set(updated);
        this.toast.success('Wellness plan refreshed.');
      },
      error: () => {
        this.refreshing.set(false);
        this.toast.error('Failed to refresh the wellness plan. Please try again.');
      },
    });
  }

  print(): void {
    window.print();
  }
}
