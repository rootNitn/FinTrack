import { Injectable, signal } from '@angular/core';

const REFRESH_TOKEN_KEY = 'pft.refreshToken';

/**
 * Access token is kept in-memory only (signal) to reduce XSS exfiltration risk.
 * Refresh token is persisted to localStorage so sessions survive a page reload;
 * documented tradeoff: an XSS could still read it, but it's opaque/short-lived-rotatable
 * and revocable server-side (RefreshToken table) if compromised.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly accessTokenSignal = signal<string | null>(null);
  readonly accessToken = this.accessTokenSignal.asReadonly();

  constructor() {
    // no eager read needed; refresh token is read lazily via getRefreshToken()
  }

  setAccessToken(token: string | null): void {
    this.accessTokenSignal.set(token);
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  setRefreshToken(token: string | null): void {
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  clear(): void {
    this.setAccessToken(null);
    this.setRefreshToken(null);
  }
}
