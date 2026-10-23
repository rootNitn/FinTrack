import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, concatMap, catchError, finalize, from, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import {
  AuthResponse,
  AuthUser,
  ChangePasswordPayload,
  DeleteAccountPayload,
  ForgotPasswordPayload,
  ForgotPasswordResponse,
  GoogleLoginPayload,
  isTwoFactorRequired,
  LoginPayload,
  LoginResult,
  PlanTier,
  RegisterPayload,
  ResetPasswordPayload,
  TwoFactorDisablePayload,
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
  TwoFactorStatus,
  TwoFactorVerifyLoginPayload,
  UpdateProfilePayload,
} from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';
import { HealthBridgeService } from './health-bridge.service';

const PLAN_RANK: Record<PlanTier, number> = { FREE: 0, PLUS: 1, PRO: 2 };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly healthBridge = inject(HealthBridgeService);
  private readonly baseUrl = environment.apiUrl;
  private refreshInFlight: Observable<AuthResponse> | null = null;
  private sessionVersion = 0;

  private readonly currentUserSignal = signal<AuthUser | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');
  readonly planTier = computed<PlanTier>(() => this.currentUserSignal()?.planTier ?? 'FREE');

  /** True if the current user (or an ADMIN, who always passes) is on `minPlan` or higher. */
  hasPlan(minPlan: PlanTier): boolean {
    if (this.isAdmin()) return true;
    return PLAN_RANK[this.planTier()] >= PLAN_RANK[minPlan];
  }

  /** Returns either a full session (2FA off) or a `{ requiresTwoFactor, twoFactorToken }` challenge — only applies the session in the former case. */
  login(payload: LoginPayload): Observable<LoginResult> {
    const version = this.sessionVersion;
    return this.http.post<ApiSuccessResponse<LoginResult>>(`${this.baseUrl}/auth/login`, payload).pipe(
      concatMap(async res => {
        if (!isTwoFactorRequired(res.data)) await this.applySession(res.data, version);
        return res.data;
      })
    );
  }

  verifyTwoFactorLogin(payload: TwoFactorVerifyLoginPayload): Observable<AuthResponse> {
    const version = this.sessionVersion;
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/2fa/verify-login`, payload)
      .pipe(
        concatMap(async res => { await this.applySession(res.data, version); return res.data; })
      );
  }

  getTwoFactorStatus(): Observable<TwoFactorStatus> {
    return this.http.get<ApiSuccessResponse<TwoFactorStatus>>(`${this.baseUrl}/auth/2fa/status`).pipe(map((res) => res.data));
  }

  setupTwoFactor(): Observable<TwoFactorSetupResponse> {
    return this.http
      .post<ApiSuccessResponse<TwoFactorSetupResponse>>(`${this.baseUrl}/auth/2fa/setup`, {})
      .pipe(map((res) => res.data));
  }

  enableTwoFactor(code: string): Observable<TwoFactorEnableResponse> {
    return this.http
      .post<ApiSuccessResponse<TwoFactorEnableResponse>>(`${this.baseUrl}/auth/2fa/enable`, { code })
      .pipe(map((res) => res.data));
  }

  disableTwoFactor(payload: TwoFactorDisablePayload): Observable<{ message: string }> {
    return this.http
      .post<ApiSuccessResponse<{ message: string }>>(`${this.baseUrl}/auth/2fa/disable`, payload)
      .pipe(map((res) => res.data));
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    const version = this.sessionVersion;
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/register`, payload)
      .pipe(
        concatMap(async res => { await this.applySession(res.data, version); return res.data; })
      );
  }


  loginWithGoogle(payload: GoogleLoginPayload): Observable<AuthResponse> {
    const version = this.sessionVersion;
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/google-login`, payload)
      .pipe(
        concatMap(async res => { await this.applySession(res.data, version); return res.data; })
      );
  }

  refresh(): Observable<AuthResponse> {
    if (this.refreshInFlight) return this.refreshInFlight;
    if (this.healthBridge.available) {
      this.refreshInFlight = from(this.healthBridge.refreshSession(this.baseUrl)).pipe(
        concatMap(async auth => { await this.applySession(auth, this.sessionVersion, false); return auth; }),
        finalize(() => { this.refreshInFlight = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      return this.refreshInFlight;
    }
    const refreshToken = this.tokenStorage.getRefreshToken();
    const version = this.sessionVersion;
    this.refreshInFlight = this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        concatMap(async res => { await this.applySession(res.data, version); return res.data; }),
        finalize(() => { this.refreshInFlight = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    return this.refreshInFlight;
  }

  logout(): Observable<unknown> {
    this.sessionVersion++;
    const refreshToken = this.tokenStorage.getRefreshToken();
    return from(this.healthBridge.disconnectForLogout()).pipe(
      catchError(() => of(undefined)),
      concatMap(() => this.http
        .post<ApiSuccessResponse<unknown>>(`${this.baseUrl}/auth/logout`, { refreshToken })
        .pipe(catchError(() => of(null)))),
      concatMap(async res => { await this.clearSession(); return res; })
    );
  }

  loadProfile(): Observable<AuthUser> {
    return this.http
      .get<ApiSuccessResponse<AuthUser>>(`${this.baseUrl}/auth/profile`)
      .pipe(
        tap((res) => this.currentUserSignal.set(res.data)),
        map((res) => res.data)
      );
  }

  updateProfile(payload: UpdateProfilePayload): Observable<AuthUser> {
    return this.http
      .patch<ApiSuccessResponse<AuthUser>>(`${this.baseUrl}/auth/profile`, payload)
      .pipe(
        tap((res) => this.currentUserSignal.set(res.data)),
        map((res) => res.data)
      );
  }

  changePassword(payload: ChangePasswordPayload): Observable<unknown> {
    return this.http
      .post<ApiSuccessResponse<unknown>>(`${this.baseUrl}/auth/change-password`, payload)
      .pipe(map((res) => res.data));
  }

  deleteAccount(payload: DeleteAccountPayload): Observable<unknown> {
    return this.http
      .delete<ApiSuccessResponse<unknown>>(`${this.baseUrl}/auth/account`, { body: payload })
      .pipe(
        concatMap(async res => { this.sessionVersion++; await this.clearSession(); return res.data; })
      );
  }

  forgotPassword(payload: ForgotPasswordPayload): Observable<ForgotPasswordResponse> {
    return this.http
      .post<ApiSuccessResponse<ForgotPasswordResponse>>(`${this.baseUrl}/auth/forgot-password`, payload)
      .pipe(map((res) => res.data));
  }

  resetPassword(payload: ResetPasswordPayload): Observable<unknown> {
    return this.http
      .post<ApiSuccessResponse<unknown>>(`${this.baseUrl}/auth/reset-password`, payload)
      .pipe(map((res) => res.data));
  }

  /** Called on app bootstrap: if a refresh token exists, try to establish a session silently. */
  tryRestoreSession(): Observable<AuthResponse> {
    return this.refresh();
  }

  hasRefreshToken(): boolean {
    return !!this.tokenStorage.getRefreshToken();
  }

  async invalidateSession(): Promise<void> {
    this.sessionVersion++;
    await this.clearSession();
  }

  private async applySession(auth: AuthResponse, version: number, persistRefresh = true): Promise<void> {
    if (version !== this.sessionVersion) throw new Error('Session changed during authentication');
    if (persistRefresh) {
      try { await this.tokenStorage.setRefreshToken(auth.refreshToken); }
      catch (error) { this.tokenStorage.setAccessToken(null); this.currentUserSignal.set(null); throw error; }
    }
    if (version !== this.sessionVersion) throw new Error('Session changed during authentication');
    this.tokenStorage.setAccessToken(auth.accessToken);
    this.currentUserSignal.set(auth.user);
  }

  private async clearSession(): Promise<void> {
    this.currentUserSignal.set(null);
    if (this.healthBridge.available) await this.healthBridge.disconnectHealth().catch(() => undefined);
    await this.tokenStorage.clear();
  }
}
