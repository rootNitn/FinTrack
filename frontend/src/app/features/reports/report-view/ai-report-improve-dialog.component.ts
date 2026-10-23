import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { AiReportImproveResponse } from '../reports.service';
import { formatCurrency } from '../../../shared/utils/currency.util';

@Component({
  selector: 'app-ai-report-improve-dialog',
  standalone: true,
  imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatChipsModule, MatDialogModule],
  template: `
    <div class="p-6 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <span class="text-2xl">✨</span>
          <h2 class="text-xl font-semibold">AI Improvement Recommendations</h2>
        </div>
        <button mat-icon-button (click)="dialogRef.close()">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <!-- Overall Score -->
      <div class="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-lg">
        <div class="text-center mb-2">
          <div class="text-4xl font-bold text-primary">{{ data.overallScore }}%</div>
          <div class="text-sm text-gray-600 dark:text-gray-400">Improvement Potential Score</div>
        </div>
        <p class="text-gray-700 dark:text-gray-300 text-center">{{ data.summary }}</p>
      </div>

      <!-- Top Improvements -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="text-lg">🎯</span>
          Top Improvements
        </h3>
        <div class="space-y-3">
          <div
            *ngFor="let improvement of data.topImprovements"
            class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div class="flex items-start justify-between gap-3 mb-2">
              <div>
                <h4 class="font-medium">{{ improvement.title }}</h4>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {{ getCategoryEmoji(improvement.category) }} {{ improvement.category }}
                </p>
              </div>
              <mat-chip
                [ngClass]="'priority-' + improvement.priority.toLowerCase()"
                class="text-xs"
              >
                {{ improvement.priority }}
              </mat-chip>
            </div>

            <div class="grid grid-cols-1 gap-2 text-sm">
              <div>
                <span class="font-medium text-gray-700 dark:text-gray-300">Why it matters:</span>
                <p class="text-gray-600 dark:text-gray-400">{{ improvement.whyItMatters }}</p>
              </div>
              <div>
                <span class="font-medium text-gray-700 dark:text-gray-300">Current situation:</span>
                <p class="text-gray-600 dark:text-gray-400">{{ improvement.currentSituation }}</p>
              </div>
              <div>
                <span class="font-medium text-gray-700 dark:text-gray-300">Recommended action:</span>
                <p class="text-gray-600 dark:text-gray-400">{{ improvement.recommendedAction }}</p>
              </div>
              <div>
                <span class="font-medium text-gray-700 dark:text-gray-300">Expected benefit:</span>
                <p class="text-gray-600 dark:text-gray-400">{{ improvement.expectedBenefit }}</p>
              </div>
              @if (improvement.supportingDataLink || improvement.actionLink) {
                <div class="mt-2 flex flex-wrap gap-2">
                  @if (improvement.supportingDataLink) {
                    <a mat-stroked-button [routerLink]="improvement.supportingDataLink" (click)="dialogRef.close()">
                      <mat-icon>open_in_new</mat-icon>
                      View supporting data
                    </a>
                  }
                  @if (improvement.actionLink) {
                    <a mat-flat-button color="primary" [routerLink]="improvement.actionLink" (click)="dialogRef.close()">
                      <mat-icon>arrow_forward</mat-icon>
                      Take action
                    </a>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </div>

      <!-- Financial Improvements -->
      <div *ngIf="data.financialImprovements.length" class="mb-8">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="text-lg">💰</span>
          Financial Improvements
        </h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div *ngFor="let item of data.financialImprovements" class="border-l-2 border-green-500 pl-3 py-2">
            <p class="font-medium text-sm">{{ item.title }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-400">{{ item.recommendedAction }}</p>
          </div>
        </div>
      </div>

      <!-- Health Improvements -->
      <div *ngIf="data.healthImprovements.length" class="mb-8">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="text-lg">🏥</span>
          Health & Wellness Improvements
        </h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div *ngFor="let item of data.healthImprovements" class="border-l-2 border-red-500 pl-3 py-2">
            <p class="font-medium text-sm">{{ item.title }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-400">{{ item.recommendedAction }}</p>
          </div>
        </div>
      </div>

      <!-- Time Improvements -->
      <div *ngIf="data.timeImprovements.length" class="mb-8">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="text-lg">⏱️</span>
          Time Management Improvements
        </h3>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          <div *ngFor="let item of data.timeImprovements" class="border-l-2 border-amber-500 pl-3 py-2">
            <p class="font-medium text-sm">{{ item.title }}</p>
            <p class="text-xs text-gray-600 dark:text-gray-400">{{ item.recommendedAction }}</p>
          </div>
        </div>
      </div>

      <!-- 30-Day Plan -->
      <div class="mb-8">
        <h3 class="text-lg font-semibold mb-4 flex items-center gap-2">
          <span class="text-lg">📅</span>
          30-Day Action Plan
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
            <p class="font-medium text-sm mb-2">Week 1</p>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li *ngFor="let action of data.thirtyDayPlan.week1" class="flex gap-2">
                <span class="text-primary">•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
          <div class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
            <p class="font-medium text-sm mb-2">Week 2</p>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li *ngFor="let action of data.thirtyDayPlan.week2" class="flex gap-2">
                <span class="text-primary">•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
          <div class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
            <p class="font-medium text-sm mb-2">Week 3</p>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li *ngFor="let action of data.thirtyDayPlan.week3" class="flex gap-2">
                <span class="text-primary">•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
          <div class="border rounded-lg p-3 bg-gray-50 dark:bg-gray-900/50">
            <p class="font-medium text-sm mb-2">Week 4</p>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li *ngFor="let action of data.thirtyDayPlan.week4" class="flex gap-2">
                <span class="text-primary">•</span>
                <span>{{ action }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Final Recommendation -->
      <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-lg">
        <p class="font-semibold mb-2 text-amber-900 dark:text-amber-100">🏆 Most Important Action</p>
        <p class="text-amber-800 dark:text-amber-200">{{ data.finalRecommendation }}</p>
      </div>

      <p class="mb-4 text-xs text-gray-500 dark:text-gray-400">
        Rule-based recommendations generated from your recorded data — not financial advice. Review major decisions with a qualified advisor.
      </p>

      <!-- Action Buttons -->
      <div class="flex gap-2 justify-end">
        <button mat-stroked-button (click)="dialogRef.close()">Close</button>
      </div>
    </div>
  `,
  styles: [
    `
      ::ng-deep {
        .priority-high {
          @apply bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-300 dark:border-red-800;
        }
        .priority-medium {
          @apply bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-800;
        }
        .priority-low {
          @apply bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200 border-green-300 dark:border-green-800;
        }
      }
    `,
  ],
})
export class AiReportImproveDialogComponent {
  readonly dialogRef = inject(MatDialogRef<AiReportImproveDialogComponent>);
  readonly data = inject(MAT_DIALOG_DATA) as AiReportImproveResponse;

  getCategoryEmoji(category: string): string {
    switch (category) {
      case 'FINANCE':
        return '💰';
      case 'HEALTH':
        return '🏥';
      case 'TIME':
        return '⏱️';
      default:
        return '📌';
    }
  }
}
