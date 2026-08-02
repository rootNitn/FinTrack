import { Injectable, signal } from '@angular/core';
import { TaxCapitalGains } from '../tax.model';

/**
 * Tiny cross-route bridge so the standalone Capital Gains Calculator (`/tax/capital-gains`) can
 * hand computed totals over to the main Tax Calculator's (`/tax/calculator`) Capital Gains tab
 * without a shared parent component. `tax-calculator.component.ts` reads+clears this on init.
 */
@Injectable({ providedIn: 'root' })
export class CapitalGainsBridgeService {
  readonly pendingTotals = signal<TaxCapitalGains | null>(null);

  send(totals: TaxCapitalGains): void {
    this.pendingTotals.set(totals);
  }

  consume(): TaxCapitalGains | null {
    const value = this.pendingTotals();
    this.pendingTotals.set(null);
    return value;
  }
}
