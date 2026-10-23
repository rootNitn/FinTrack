import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PlanTier } from '../models/auth.model';

/** Restricts a route to users on `minPlan` or higher (FREE < PLUS < PRO); assumes authGuard
 * already ran. Redirects to the upgrade page (with the blocked path + required plan) instead of
 * silently bouncing to the dashboard, so the user understands why access was denied. */
export function planGuard(minPlan: PlanTier): CanActivateFn {
  return (_route, state) => {
    const authService = inject(AuthService);
    const router = inject(Router);

    if (authService.hasPlan(minPlan)) return true;

    return router.createUrlTree(['/billing/upgrade'], { queryParams: { required: minPlan, from: state.url } });
  };
}
