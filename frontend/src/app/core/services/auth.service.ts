import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiSuccessResponse } from '../models/api-response.model';
import { AuthResponse, AuthUser, ChangePasswordPayload, ForgotPasswordPayload, ForgotPasswordResponse, LoginPayload, RegisterPayload, ResetPasswordPayload, UpdateProfilePayload } from '../models/auth.model';
import { TokenStorageService } from './token-storage.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly baseUrl = environment.apiUrl;

  private readonly currentUserSignal = signal<AuthUser | null>(null);
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');

  login(payload: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/login`, payload)
      .pipe(
        tap((res) => this.applySession(res.data)),
        map((res) => res.data)
      );
  }

  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/register`, payload)
      .pipe(
        tap((res) => this.applySession(res.data)),
        map((res) => res.data)
      );
  }

  refresh(): Observable<AuthResponse> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    return this.http
      .post<ApiSuccessResponse<AuthResponse>>(`${this.baseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((res) => this.applySession(res.data)),
        map((res) => res.data)
      );
  }

  logout(): Observable<unknown> {
    const refreshToken = this.tokenStorage.getRefreshToken();
    return this.http
      .post<ApiSuccessResponse<unknown>>(`${this.baseUrl}/auth/logout`, { refreshToken })
      .pipe(tap(() => this.clearSession()));
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

  private applySession(auth: AuthResponse): void {
    this.tokenStorage.setAccessToken(auth.accessToken);
    this.tokenStorage.setRefreshToken(auth.refreshToken);
    this.currentUserSignal.set(auth.user);
  }

  private clearSession(): void {
    this.tokenStorage.clear();
    this.currentUserSignal.set(null);
  }
}
