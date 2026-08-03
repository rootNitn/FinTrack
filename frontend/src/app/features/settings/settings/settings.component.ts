import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ThemeService } from '../../../core/services/theme.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { SettingsService } from '../settings.service';
import { currencyCode } from '../../../shared/utils/currency.util';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD'];

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly settingsService = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly theme = inject(ThemeService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  readonly currencies = CURRENCIES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly downloading = signal(false);
  readonly restoring = signal(false);

  readonly form = this.fb.nonNullable.group({
    currency: ['INR'],
    darkMode: [false],
    largeExpenseThreshold: [10000],
    notificationPreferences: this.fb.nonNullable.group({
      fdMaturity: [true],
      sipReminder: [true],
      goalAchievement: [true],
      monthlySummary: [true],
      largeExpenseAlert: [true],
      fdRateChange: [true],
      higherFdRateAvailable: [true],
      fdRenewalReminder: [true],
      ccPaymentDue: [true],
      emiDue: [true],
      budgetExceeded: [true],
      insuranceRenewal: [true],
      birthdayReminder: [true],
    }),
  });

  ngOnInit(): void {
    this.settingsService.get().subscribe({
      next: (settings) => {
        this.form.patchValue({
          currency: settings.currency,
          darkMode: settings.theme === 'dark',
          largeExpenseThreshold: settings.largeExpenseThreshold,
          notificationPreferences: settings.notificationPreferences,
        });
        currencyCode.set(settings.currency);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const { currency, darkMode, largeExpenseThreshold, notificationPreferences } = this.form.getRawValue();
    const theme = darkMode ? 'dark' : 'light';

    this.settingsService
      .update({ currency, theme, largeExpenseThreshold, notificationPreferences })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.theme.set(theme);
          currencyCode.set(currency);
          this.toast.success('Settings saved.');
        },
        error: () => this.saving.set(false),
      });
  }

  downloadBackup(): void {
    this.downloading.set(true);
    this.settingsService.downloadBackup().subscribe({
      next: (blob) => {
        this.downloading.set(false);
        downloadBlob(blob, 'finance-tracker-backup.json');
      },
      error: () => this.downloading.set(false),
    });
  }

  onRestoreFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.confirmDialog
      .open({
        title: 'Restore from backup?',
        message:
          'This will permanently replace your existing expenses, income, investments, goals, budgets, FDs, credit cards and family members with the contents of this backup file. This cannot be undone.',
        confirmLabel: 'Restore',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) {
          input.value = '';
          return;
        }
        this.restoreFromFile(file, input);
      });
  }

  private restoreFromFile(file: File, input: HTMLInputElement): void {
    const reader = new FileReader();
    reader.onload = () => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(reader.result as string);
      } catch {
        this.toast.error('Invalid backup file — not valid JSON.');
        input.value = '';
        return;
      }

      this.restoring.set(true);
      this.settingsService.restoreBackup(parsed).subscribe({
        next: () => {
          this.restoring.set(false);
          input.value = '';
          this.toast.success('Backup restored successfully. Reloading...');
          setTimeout(() => window.location.reload(), 1200);
        },
        error: () => {
          this.restoring.set(false);
          input.value = '';
        },
      });
    };
    reader.readAsText(file);
  }
}
