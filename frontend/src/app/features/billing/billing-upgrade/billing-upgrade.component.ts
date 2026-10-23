import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { BillingService } from '../../../core/services/billing.service';
import { PlanTier } from '../../../core/models/auth.model';
import { BillingCycle, CreateOrderResponse } from '../../../core/models/billing.model';
import { PRICING_PLANS, PricingPlan, yearlySavingsPercent } from '../../landing/landing.config';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const RAZORPAY_CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

@Component({
  selector: 'app-billing-upgrade',
  imports: [CommonModule, MatIconModule, MatButtonModule, MatButtonToggleModule, MatProgressSpinnerModule, PageHeaderComponent],
  templateUrl: './billing-upgrade.component.html',
  styleUrl: './billing-upgrade.component.scss',
})
export class BillingUpgradeComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly billingService = inject(BillingService);

  readonly plans = PRICING_PLANS.filter((p) => p.id !== 'free');
  readonly billingCycle = signal<BillingCycle>('MONTHLY');
  readonly processingPlanId = signal<PricingPlan['id'] | null>(null);
  readonly requiredPlan = signal<PlanTier | null>(null);
  readonly currentPlan = this.authService.planTier;

  private returnTo = '/dashboard';

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    const required = params.get('required');
    if (required === 'PLUS' || required === 'PRO') this.requiredPlan.set(required);
    this.returnTo = params.get('from') || '/dashboard';
  }

  priceLabel(plan: PricingPlan): string {
    const amount = this.billingCycle() === 'YEARLY' ? plan.yearlyPrice : plan.monthlyPrice;
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  }

  periodLabel(): string {
    return this.billingCycle() === 'YEARLY' ? '/ year' : '/ month';
  }

  savingsLabel(plan: PricingPlan): string | null {
    if (this.billingCycle() !== 'YEARLY') return null;
    const percent = yearlySavingsPercent(plan);
    return percent ? `Save ${percent}% vs. monthly` : null;
  }

  isCurrentPlan(plan: PricingPlan): boolean {
    return this.currentPlan() === plan.id.toUpperCase();
  }

  upgrade(plan: PricingPlan): void {
    if (plan.id === 'free' || this.isCurrentPlan(plan)) return;
    this.processingPlanId.set(plan.id);

    this.billingService
      .createOrder({ planTier: plan.id.toUpperCase() as 'PLUS' | 'PRO', billingCycle: this.billingCycle() })
      .subscribe({
        next: (order) => this.openCheckout(order),
        error: (err) => {
          this.processingPlanId.set(null);
          this.toast.error(err?.error?.message ?? 'Could not start checkout. Please try again.');
        },
      });
  }

  private async openCheckout(order: CreateOrderResponse): Promise<void> {
    try {
      await this.loadRazorpayScript();
    } catch {
      this.processingPlanId.set(null);
      this.toast.error('Could not load the payment widget. Check your connection and try again.');
      return;
    }

    if (!window.Razorpay) {
      this.processingPlanId.set(null);
      this.toast.error('Payment widget unavailable. Please try again.');
      return;
    }

    const checkout = new window.Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: 'LifeTrack',
      description: `${order.planTier} plan — ${order.billingCycle === 'YEARLY' ? 'yearly' : 'monthly'}`,
      handler: (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) =>
        this.verifyPayment(response),
      modal: { ondismiss: () => this.processingPlanId.set(null) },
    });
    checkout.open();
  }

  private verifyPayment(response: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }): void {
    this.billingService.verifyPayment(response).subscribe({
      next: () => {
        this.authService.loadProfile().subscribe({
          next: () => {
            this.processingPlanId.set(null);
            this.toast.success('Plan upgraded! Enjoy your new features.');
            this.router.navigateByUrl(this.returnTo);
          },
        });
      },
      error: (err) => {
        this.processingPlanId.set(null);
        this.toast.error(err?.error?.message ?? 'Payment verification failed. Please contact support if you were charged.');
      },
    });
  }

  private loadRazorpayScript(): Promise<void> {
    if (window.Razorpay) return Promise.resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_CHECKOUT_SRC}"]`);
    if (existing) {
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject());
      });
    }
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = RAZORPAY_CHECKOUT_SRC;
      script.onload = () => resolve();
      script.onerror = () => reject();
      document.body.appendChild(script);
    });
  }
}
