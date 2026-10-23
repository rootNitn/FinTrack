import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { TokenStorageService } from '../services/token-storage.service';

const AUTH_FREE_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/forgot-password', '/auth/reset-password'];

function isAuthFreePath(url: string): boolean {
  return AUTH_FREE_PATHS.some((path) => url.includes(path));
}

/**
 * Attaches the in-memory access token to outgoing API requests, and on a 401
 * (expired access token) attempts a single silent refresh + retry before
 * giving up and forcing a re-login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenStorage = inject(TokenStorageService);
  const authService = inject(AuthService);
  const router = inject(Router);

  const accessToken = tokenStorage.getAccessToken();
  const isApiRequest = req.url.includes('/api/v1');
  const authReq =
    isApiRequest && accessToken && !isAuthFreePath(req.url)
      ? req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } })
      : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiRequest &&
        !isAuthFreePath(req.url) &&
        authService.hasRefreshToken()
      ) {
        return authService.refresh().pipe(
          switchMap((auth) => {
            const retriedReq = req.clone({ setHeaders: { Authorization: `Bearer ${auth.accessToken}` } });
            return next(retriedReq);
          }),
          catchError(async refreshError => {
            await authService.invalidateSession();
            await router.navigate(['/auth/login']);
            throw refreshError;
          })
        );
      }
      return throwError(() => error);
    })
  );
};
