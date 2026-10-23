import { ApplicationConfig, provideZoneChangeDetection, isDevMode, provideAppInitializer, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TokenStorageService } from './core/services/token-storage.service';
import { AuthService } from './core/services/auth.service';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter } from '@angular/material/core';
import { provideEchartsCore } from 'ngx-echarts';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { provideServiceWorker } from '@angular/service-worker';
import { Capacitor } from '@capacitor/core';

const platformRoutes = Capacitor.isNativePlatform() ? [
  { path: '', pathMatch: 'full' as const, redirectTo: 'auth/login' },
  ...routes.filter(route => route.path === 'auth' || (route.path === '' && !!route.children?.some(child => child.path === 'dashboard'))).map(route => ({
    ...route,
    children: route.children?.filter(child => [
      '', 'dashboard', 'expenses', 'income', 'transactions', 'banks', 'credit-cards', 'credit-cards/:id',
      'goals', 'investments', 'fd/portfolio', 'mutual-funds', 'mutual-funds/:key', 'health', 'health/body-metrics', 'health/vitals', 'health/workouts',
    'health/medications', 'health/appointments', 'health/goals', 'notifications', 'settings', 'profile', 'change-password',
    ].includes(child.path ?? '')),
  })),
  { path: '**', redirectTo: 'dashboard' },
] : routes;

export const appConfig: ApplicationConfig = {
  providers: [
    provideAppInitializer(() => {
      const storage = inject(TokenStorageService);
      const auth = inject(AuthService);
      return storage.initialize().then(async () => {
        if (!Capacitor.isNativePlatform() || !auth.hasRefreshToken()) return;
        try { await firstValueFrom(auth.tryRestoreSession()); }
        catch (error: unknown) {
          const status = (error as { status?: number })?.status;
          if (status === 401 || status === 403) await storage.clear();
        }
      });
    }),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(platformRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' })),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideHttpClient(withInterceptors([loadingInterceptor, authInterceptor, errorInterceptor])),
    provideEchartsCore({ echarts: () => import('echarts') }), provideServiceWorker('ngsw-worker.js', {
            enabled: !isDevMode() && !Capacitor.isNativePlatform(),
            registrationStrategy: 'registerWhenStable:30000'
          }),
  ]
};
