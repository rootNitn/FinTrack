import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OnboardingTourService {
  private readonly restartRequestSignal = signal(0);
  readonly restartRequest = this.restartRequestSignal.asReadonly();

  restart(): void {
    this.restartRequestSignal.update((request) => request + 1);
  }
}
