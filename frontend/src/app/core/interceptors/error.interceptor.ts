import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ToastService } from '../services/toast.service';

/** Maps failed HTTP responses to a user-facing toast, then re-throws for local handling. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        // Let 401s on auth-refresh flow bubble silently; authInterceptor handles those.
        const message = extractMessage(error);
        if (error.status !== 401) {
          toast.error(message);
        }
      } else {
        toast.error('An unexpected error occurred.');
      }
      return throwError(() => error);
    })
  );
};

function extractMessage(error: HttpErrorResponse): string {
  const body = error.error;
  if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
    return body.message;
  }
  if (error.status === 0) {
    return 'Unable to reach the server. Please check your connection.';
  }
  return `Request failed (${error.status})`;
}
