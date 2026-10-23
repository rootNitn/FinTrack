import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss'
})
export class ProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly currentUser = this.authService.currentUser;
  readonly planTier = this.authService.planTier;
  readonly planExpiresAt = computed(() => this.currentUser()?.planExpiresAt ?? null);
  readonly submitting = signal(false);
  readonly editing = signal(false);

  readonly form = this.fb.nonNullable.group({
    name: [this.currentUser()?.name ?? '', [Validators.required, Validators.minLength(2)]],
    avatarUrl: [this.currentUser()?.avatarUrl ?? ''],
    dateOfBirth: [this.toDateInputValue(this.currentUser()?.dateOfBirth ?? null)],
  });

  private toDateInputValue(value: string | null): string {
    return value ? value.slice(0, 10) : '';
  }

  startEdit(): void {
    this.form.setValue({
      name: this.currentUser()?.name ?? '',
      avatarUrl: this.currentUser()?.avatarUrl ?? '',
      dateOfBirth: this.toDateInputValue(this.currentUser()?.dateOfBirth ?? null),
    });
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    const { name, avatarUrl, dateOfBirth } = this.form.getRawValue();
    this.authService.updateProfile({ name, avatarUrl: avatarUrl || null, dateOfBirth: dateOfBirth || null }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.editing.set(false);
        this.toast.success('Profile updated.');
      },
      error: () => this.submitting.set(false),
    });
  }

}
