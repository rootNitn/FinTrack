import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs/operators';
import { animate, group, query, style, transition, trigger } from '@angular/animations';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatIconModule } from '@angular/material/icon';
import { Capacitor } from '@capacitor/core';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { AiChatWidgetComponent } from '../../shared/components/ai-chat-widget/ai-chat-widget.component';
import { OnboardingTourComponent } from '../../shared/components/onboarding-tour/onboarding-tour.component';
import { LoadingService } from '../../core/services/loading.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/settings.service';
import { currencyCode } from '../../shared/utils/currency.util';

// Cross-fades between routed pages instead of the previous page instantly disappearing before
// the next one renders. The leaving view is taken out of layout flow (absolute) so it overlaps
// the entering view without affecting `main`'s scroll height during the brief transition.
const routeFadeAnimation = trigger('routeFade', [
  transition('* <=> *', [
    query(':enter, :leave', style({ width: '100%' }), { optional: true }),
    query(':leave', style({ position: 'absolute', opacity: 1 }), { optional: true }),
    query(':enter', style({ opacity: 0 }), { optional: true }),
    group([
      query(':leave', [animate('120ms ease-out', style({ opacity: 0 }))], { optional: true }),
      query(':enter', [animate('180ms 60ms ease-in', style({ opacity: 1 }))], { optional: true }),
    ]),
  ]),
]);

interface MobileNavLink {
  label: string;
  icon: string;
  route: string;
}

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, RouterLink, MatSidenavModule, MatProgressBarModule, MatIconModule, NavbarComponent, SidebarComponent, AiChatWidgetComponent, OnboardingTourComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  animations: [routeFadeAnimation],
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  private readonly router = inject(Router);
  readonly loading = inject(LoadingService);
  readonly isNative = Capacitor.isNativePlatform();
  readonly mobileMenu = signal<'finance' | 'more' | null>(null);
  readonly activeUrl = signal(this.router.url);

  private readonly mobileQuery = window.matchMedia('(max-width: 768px)');
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly sidebarOpen = signal(!this.mobileQuery.matches);
  readonly isAdmin = this.authService.isAdmin;

  // Unique-per-route key so the `routeFade` trigger fires on every navigation. Tracked via a
  // signal updated from Router NavigationEnd events (not a method called from the template on
  // every change-detection pass reading the outlet's live activatedRoute) — the latter caused an
  // NG0100 ExpressionChangedAfterItHasBeenCheckedError because the outlet activates mid-cycle,
  // right after the animation binding was first checked. Bug found via manual UI check, 2026-08-10.
  readonly routeAnimKey = signal('');
  readonly financeLinks: MobileNavLink[] = [
    { label: 'Expenses', icon: 'payments', route: '/expenses' },
    { label: 'Income', icon: 'attach_money', route: '/income' },
    { label: 'Transactions', icon: 'receipt_long', route: '/transactions' },
    { label: 'Bank accounts', icon: 'account_balance', route: '/banks' },
    { label: 'Cards', icon: 'credit_card', route: '/credit-cards' },
    { label: 'Fixed deposits', icon: 'savings', route: '/fd/portfolio' },
    { label: 'Mutual funds', icon: 'pie_chart', route: '/mutual-funds' },
    { label: 'Goals', icon: 'flag', route: '/goals' },
    { label: 'Investments', icon: 'trending_up', route: '/investments' },
  ];
  readonly moreLinks: MobileNavLink[] = [
    { label: 'Notifications', icon: 'notifications', route: '/notifications' },
    { label: 'Profile', icon: 'person', route: '/profile' },
    { label: 'Settings', icon: 'settings', route: '/settings' },
  ];

  constructor() {
    this.mobileQuery.addEventListener('change', (e) => {
      this.isMobile.set(e.matches);
      this.sidebarOpen.set(!e.matches);
    });

    // Seed the app-wide currency code once per session so every screen formats amounts
    // using the user's Settings > Currency preference instead of a hardcoded default.
    this.settingsService.get().subscribe({
      next: (settings) => currencyCode.set(settings.currency),
      error: () => undefined,
    });

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe((event) => {
      const url = (event as NavigationEnd).urlAfterRedirects;
      this.routeAnimKey.set(url);
      this.activeUrl.set(url);
      this.mobileMenu.set(null);
    });
  }

  toggleMobileMenu(menu: 'finance' | 'more'): void {
    this.mobileMenu.update((open) => open === menu ? null : menu);
  }

  closeMobileMenu(): void {
    this.mobileMenu.set(null);
  }

  isRouteActive(route: string): boolean {
    const url = this.activeUrl().split(/[?#]/, 1)[0];
    return url === route || url.startsWith(`${route}/`);
  }

  isFinanceActive(): boolean {
    return this.financeLinks.some((link) => this.isRouteActive(link.route));
  }

  isMoreActive(): boolean {
    return this.moreLinks.some((link) => this.isRouteActive(link.route));
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  onNavItemClick(): void {
    if (this.isMobile()) {
      this.sidebarOpen.set(false);
    }
  }

}
