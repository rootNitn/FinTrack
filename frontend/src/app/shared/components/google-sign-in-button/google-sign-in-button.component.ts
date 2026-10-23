import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, EventEmitter, Output, ViewChild, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { SocialLogin } from '@capgo/capacitor-social-login';
import { environment } from '../../../../environments/environment';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: { credential: string }) => void }): void;
          renderButton(parent: HTMLElement, options: Record<string, unknown>): void;
        };
      };
    };
  }
}

// Google blocks its web Identity Services sign-in flow inside embedded WebViews
// ("disallowed_useragent"), so the packaged Android app must use the native Credential Manager
// flow instead — same backend /auth/google-login endpoint, same emitted ID token either way.
let nativeGoogleInitialized = false;

/** Renders "Sign in with Google" (web: Google Identity Services; native: Credential Manager) and emits the ID token on success. */
@Component({
  selector: 'app-google-sign-in-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (isNative) {
      @if (clientId) {
        <button
          type="button"
          class="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-black/80 shadow-sm disabled:opacity-60 dark:border-white/10 dark:bg-white"
          [disabled]="signingIn()"
          (click)="signInNative()"
        >
          <img src="/icons/google-g.svg" alt="" class="h-5 w-5" />
          {{ signingIn() ? 'Signing in…' : 'Continue with Google' }}
        </button>
        @if (nativeError()) {
          <p class="mt-1 text-center text-xs text-red-600">{{ nativeError() }}</p>
        }
      }
    } @else {
      @if (clientId) {
        <div #buttonContainer class="flex w-full justify-center"></div>
      }
    }
  `,
})
export class GoogleSignInButtonComponent implements AfterViewInit {
  @ViewChild('buttonContainer') buttonContainer?: ElementRef<HTMLDivElement>;
  @Output() credential = new EventEmitter<string>();

  readonly clientId = environment.googleClientId;
  readonly isNative = Capacitor.isNativePlatform();
  readonly signingIn = signal(false);
  readonly nativeError = signal<string | null>(null);

  ngAfterViewInit(): void {
    if (!this.clientId) return;

    if (this.isNative) {
      if (!nativeGoogleInitialized) {
        nativeGoogleInitialized = true;
        void SocialLogin.initialize({ google: { webClientId: this.clientId } });
      }
      return;
    }

    if (!this.buttonContainer) return;

    // GSI script is loaded async in index.html — poll briefly until it's ready.
    const tryInit = () => {
      if (!window.google) {
        setTimeout(tryInit, 100);
        return;
      }
      window.google.accounts.id.initialize({
        client_id: this.clientId,
        callback: (response) => this.credential.emit(response.credential),
      });
      window.google.accounts.id.renderButton(this.buttonContainer!.nativeElement, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        width: 320,
      });
    };
    tryInit();
  }

  async signInNative(): Promise<void> {
    this.nativeError.set(null);
    this.signingIn.set(true);
    try {
      // Default scopes (email/profile/openid) already cover what the ID token needs — passing
      // custom `scopes` here would require MainActivity to implement a plugin-specific interface.
      const { result } = await SocialLogin.login({ provider: 'google', options: {} });
      const idToken = 'idToken' in result ? result.idToken : null;
      if (!idToken) throw new Error('Google did not return an ID token');
      this.credential.emit(idToken);
    } catch (error) {
      this.nativeError.set(error instanceof Error ? error.message : 'Google sign-in failed. Please try again.');
    } finally {
      this.signingIn.set(false);
    }
  }
}

