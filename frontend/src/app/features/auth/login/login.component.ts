import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { isTwoFactorRequired } from '../../../core/models/auth.model';
import { GoogleSignInButtonComponent } from '../../../shared/components/google-sign-in-button/google-sign-in-button.component';

@Component({
  selector: 'app-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    GoogleSignInButtonComponent,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly hidePassword = signal(true);

  // Set when the password step succeeds but the account has 2FA enabled — shows the code-entry step.
  readonly twoFactorToken = signal<string | null>(null);
  readonly twoFactorCode = signal('');

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe({
      next: (result) => {
        this.submitting.set(false);
        if (isTwoFactorRequired(result)) {
          this.twoFactorToken.set(result.twoFactorToken);
          return;
        }
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Login failed. Please check your credentials.');
      },
    });
  }

  submitTwoFactorCode(): void {
    const token = this.twoFactorToken();
    if (!token || !this.twoFactorCode().trim()) return;

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService
      .verifyTwoFactorLogin({ twoFactorToken: token, code: this.twoFactorCode().trim(), rememberMe: this.form.getRawValue().rememberMe })
      .subscribe({
        next: () => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (err) => {
          this.submitting.set(false);
          this.errorMessage.set(err?.error?.message ?? 'Invalid code. Please try again.');
        },
      });
  }

  cancelTwoFactor(): void {
    this.twoFactorToken.set(null);
    this.twoFactorCode.set('');
    this.errorMessage.set(null);
  }

  onGoogleCredential(idToken: string): void {
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.loginWithGoogle({ idToken }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Google sign-in failed. Please try again.');
      },
    });
  }

  demoLogin(): void {
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.login({
      email: 'demo@financetracker.local',
      password: 'Demo@1234',
    }).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Demo login failed. Please try again.');
      },
    });
  }

}
