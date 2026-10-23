import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ThemeService } from '../../../core/services/theme.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { SettingsService } from '../settings.service';
import { currencyCode } from '../../../shared/utils/currency.util';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { AuthService } from '../../../core/services/auth.service';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'JPY', 'SGD'];
const COUNTRIES: { code: string; name: string }[] = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'CA', name: 'Canada' },
  { code: 'SG', name: 'Singapore' },
  { code: 'OTHER', name: 'Other' },
];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

interface NotificationGroup {
  label: string;
  controls: string[];
}

const NOTIFICATION_GROUPS: NotificationGroup[] = [
  {
    label: 'Finance',
    controls: ['largeExpenseAlert', 'budgetExceeded', 'ccPaymentDue', 'emiDue', 'monthlySummary', 'insuranceRenewal'],
  },
  {
    label: 'Investments',
    controls: ['fdMaturity', 'sipReminder', 'goalAchievement', 'fdRateChange', 'higherFdRateAvailable', 'fdRenewalReminder'],
  },
  {
    label: 'Health',
    controls: ['birthdayReminder', 'medicationReminder', 'appointmentReminder', 'healthGoalAchievement'],
  },
];

const NOTIFICATION_LABELS: Record<string, string> = {
  fdMaturity: 'FD maturity reminders',
  sipReminder: 'SIP reminders',
  goalAchievement: 'Goal achievement alerts',
  monthlySummary: 'Monthly summary reports',
  largeExpenseAlert: 'Large expense alerts',
  fdRateChange: 'FD rate change alerts',
  higherFdRateAvailable: 'Higher FD rate available',
  fdRenewalReminder: 'FD renewal reminders',
  ccPaymentDue: 'Credit card payment due',
  emiDue: 'EMI due reminders',
  budgetExceeded: 'Budget exceeded alerts',
  insuranceRenewal: 'Insurance renewal reminders',
  birthdayReminder: 'Birthday reminders',
  medicationReminder: 'Medication reminders',
  appointmentReminder: 'Doctor appointment reminders',
  healthGoalAchievement: 'Health goal achievement alerts',
};

@Component({
  selector: 'app-settings',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
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
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly currencies = CURRENCIES;
  readonly countries = COUNTRIES;
  readonly monthNames = MONTH_NAMES;
  readonly notificationGroups = NOTIFICATION_GROUPS;
  readonly notificationLabels = NOTIFICATION_LABELS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly downloading = signal(false);
  readonly restoring = signal(false);
  readonly deleting = signal(false);
  readonly deletePassword = signal('');
  readonly deleteConfirmText = signal('');

  // Two-factor authentication (TOTP) state.
  readonly twoFactorEnabled = signal(false);
  readonly twoFactorSetup = signal<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string } | null>(null);
  readonly twoFactorCode = signal('');
  readonly twoFactorBackupCodes = signal<string[] | null>(null);
  readonly twoFactorDisablePassword = signal('');
  readonly twoFactorBusy = signal(false);

  readonly form = this.fb.nonNullable.group({
    currency: ['INR'],
    darkMode: [false],
    largeExpenseThreshold: [10000],
    country: ['IN'],
    financialYearStartMonth: [4],
    aiChatEnabled: [true],
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
      medicationReminder: [true],
      appointmentReminder: [true],
      healthGoalAchievement: [true],
    }),
  });

  ngOnInit(): void {
    this.settingsService.get().subscribe({
      next: (settings) => {
        this.form.patchValue({
          currency: settings.currency,
          darkMode: settings.theme === 'dark',
          largeExpenseThreshold: settings.largeExpenseThreshold,
          country: settings.country,
          financialYearStartMonth: settings.financialYearStartMonth,
          aiChatEnabled: settings.aiChatEnabled,
          notificationPreferences: settings.notificationPreferences,
        });
        currencyCode.set(settings.currency);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.authService.getTwoFactorStatus().subscribe({
      next: (status) => this.twoFactorEnabled.set(status.enabled),
      error: () => {},
    });
  }

  /** India's fiscal year is fixed at April by law (matches the Tax module) — only unlocked once the user picks a non-India country. */
  isFinancialYearEditable(): boolean {
    return this.form.controls.country.value !== 'IN';
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const { currency, darkMode, largeExpenseThreshold, country, financialYearStartMonth, aiChatEnabled, notificationPreferences } =
      this.form.getRawValue();
    const theme = darkMode ? 'dark' : 'light';

    this.settingsService
      .update({ currency, theme, largeExpenseThreshold, country, financialYearStartMonth, aiChatEnabled, notificationPreferences })
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

  setAllNotifications(value: boolean): void {
    const group = this.form.controls.notificationPreferences;
    for (const key of Object.keys(group.controls)) {
      group.get(key)?.setValue(value);
    }
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

  /** Step 1: generates a new secret + QR code (not enabled yet until confirmed). */
  startTwoFactorSetup(): void {
    this.twoFactorBusy.set(true);
    this.authService.setupTwoFactor().subscribe({
      next: (result) => {
        this.twoFactorBusy.set(false);
        this.twoFactorSetup.set(result);
        this.twoFactorBackupCodes.set(null);
      },
      error: (err) => {
        this.twoFactorBusy.set(false);
        this.toast.error(err?.error?.message ?? 'Failed to start 2FA setup.');
      },
    });
  }

  /** Step 2: confirms the code from the authenticator app and turns 2FA on. */
  confirmTwoFactorEnable(): void {
    if (!this.twoFactorCode().trim()) return;
    this.twoFactorBusy.set(true);
    this.authService.enableTwoFactor(this.twoFactorCode().trim()).subscribe({
      next: (result) => {
        this.twoFactorBusy.set(false);
        this.twoFactorEnabled.set(true);
        this.twoFactorSetup.set(null);
        this.twoFactorCode.set('');
        this.twoFactorBackupCodes.set(result.backupCodes);
        this.toast.success('Two-factor authentication enabled.');
      },
      error: (err) => {
        this.twoFactorBusy.set(false);
        this.toast.error(err?.error?.message ?? 'Invalid code.');
      },
    });
  }

  cancelTwoFactorSetup(): void {
    this.twoFactorSetup.set(null);
    this.twoFactorCode.set('');
  }

  disableTwoFactor(): void {
    if (!this.twoFactorDisablePassword()) {
      this.toast.error('Enter your password to disable two-factor authentication.');
      return;
    }
    this.confirmDialog
      .open({
        title: 'Disable two-factor authentication?',
        message: 'This will remove the extra login step for your account. You can re-enable it any time.',
        confirmLabel: 'Disable 2FA',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.twoFactorBusy.set(true);
        this.authService.disableTwoFactor({ password: this.twoFactorDisablePassword() }).subscribe({
          next: () => {
            this.twoFactorBusy.set(false);
            this.twoFactorEnabled.set(false);
            this.twoFactorDisablePassword.set('');
            this.twoFactorBackupCodes.set(null);
            this.toast.success('Two-factor authentication disabled.');
          },
          error: (err) => {
            this.twoFactorBusy.set(false);
            this.toast.error(err?.error?.message ?? 'Failed to disable 2FA.');
          },
        });
      });
  }

  deleteAccount(): void {
    if (this.deleteConfirmText().trim() !== 'DELETE') {
      this.toast.error('Type "DELETE" exactly to confirm.');
      return;
    }

    this.confirmDialog
      .open({
        title: 'Delete your account?',
        message:
          'This permanently deletes your account and ALL of your data — expenses, income, investments, goals, budgets, FDs, credit cards, everything. This cannot be undone.',
        confirmLabel: 'Delete my account',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;

        this.deleting.set(true);
        this.authService
          .deleteAccount({ password: this.deletePassword() || undefined, confirmation: 'DELETE' })
          .subscribe({
            next: () => {
              this.deleting.set(false);
              this.toast.success('Your account has been deleted.');
              this.router.navigateByUrl('/login');
            },
            error: (err) => {
              this.deleting.set(false);
              this.toast.error(err?.error?.message ?? 'Failed to delete account.');
            },
          });
      });
  }
}
