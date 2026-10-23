import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Capacitor, registerPlugin } from '@capacitor/core';

export interface SessionVaultPlugin {
  readRefreshToken(): Promise<{ token: string | null; reasonCode?: string }>;
  writeRefreshToken(options: { token: string }): Promise<void>;
  clear(): Promise<void>;
}
export const SESSION_VAULT = new InjectionToken<SessionVaultPlugin>('SessionVault', {
  providedIn: 'root', factory: () => registerPlugin<SessionVaultPlugin>('SessionVault'),
});

const REFRESH_TOKEN_KEY = 'pft.refreshToken';

/**
 * Access token is kept in-memory only (signal) to reduce XSS exfiltration risk.
 * Browser refresh tokens persist to localStorage; Android credentials use a Keystore-backed vault.
 * documented tradeoff: an XSS could still read it, but it's opaque/short-lived-rotatable
 * and revocable server-side (RefreshToken table) if compromised.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private readonly vault = inject(SESSION_VAULT);
  private readonly accessTokenSignal = signal<string | null>(null);
  private nativeRefreshToken: string | null = null;
  private pendingWrite: Promise<void> = Promise.resolve();
  private writeRevision = 0;
  readonly accessToken = this.accessTokenSignal.asReadonly();

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    try { this.nativeRefreshToken = (await this.vault.readRefreshToken()).token; }
    catch { this.nativeRefreshToken = null; }
  }

  setAccessToken(token: string | null): void {
    this.accessTokenSignal.set(token);
  }

  getAccessToken(): string | null {
    return this.accessTokenSignal();
  }

  async setRefreshToken(token: string | null): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      const revision = ++this.writeRevision;
      if (token === null) this.nativeRefreshToken = null;
      const operation = this.pendingWrite.catch(() => undefined).then(async () => {
        if (token) await this.vault.writeRefreshToken({ token });
        else await this.vault.clear();
        if (revision === this.writeRevision) this.nativeRefreshToken = token;
      });
      this.pendingWrite = operation;
      await operation;
      return;
    }
    if (token) {
      localStorage.setItem(REFRESH_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  }

  getRefreshToken(): string | null {
    if (Capacitor.isNativePlatform()) return this.nativeRefreshToken;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  async clear(): Promise<void> {
    this.setAccessToken(null);
    await this.setRefreshToken(null);
  }
}
