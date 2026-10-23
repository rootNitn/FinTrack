import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

interface SearchItem {
  label: string;
  group: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, MatIconModule, MatButtonModule, MatMenuModule, MatBadgeModule, MatTooltipModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss'
})
export class NavbarComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  @Output() menuToggle = new EventEmitter<void>();
  readonly showMenuToggle = input(true);

  readonly currentUser = this.authService.currentUser;
  readonly planTier = this.authService.planTier;
  readonly unreadNotifications = 0;
  readonly searchOpen = signal(false);
  readonly searchQuery = signal('');
  readonly searchItems: SearchItem[] = [
    { label: 'Dashboard', group: 'Overview', route: '/dashboard', icon: 'dashboard' },
    { label: 'Transactions', group: 'Finance', route: '/transactions', icon: 'receipt_long' },
    { label: 'Expenses', group: 'Finance', route: '/expenses', icon: 'payments' },
    { label: 'Income', group: 'Finance', route: '/income', icon: 'attach_money' },
    { label: 'Bank Accounts', group: 'Finance', route: '/banks', icon: 'account_balance' },
    { label: 'Credit Cards', group: 'Finance', route: '/credit-cards', icon: 'credit_card' },
    { label: 'Business Finance', group: 'Finance', route: '/business', icon: 'storefront' },
    { label: 'Investments', group: 'Wealth', route: '/investments', icon: 'trending_up' },
    { label: 'Mutual Funds', group: 'Wealth', route: '/mutual-funds', icon: 'donut_small' },
    { label: 'Fixed Deposits', group: 'Wealth', route: '/fd/portfolio', icon: 'savings' },
    { label: 'Goals', group: 'Planning', route: '/goals', icon: 'flag' },
    { label: 'Upcoming Bills', group: 'Planning', route: '/upcoming-bills', icon: 'event' },
    { label: 'Calculators', group: 'Planning', route: '/calculators', icon: 'calculate' },
    { label: 'Health', group: 'Health', route: '/health', icon: 'monitor_heart' },
    { label: 'Tax Dashboard', group: 'Tax', route: '/tax', icon: 'request_quote' },
    { label: 'Tax Calculator', group: 'Tax', route: '/tax/calculator', icon: 'calculate' },
    { label: 'Analytics', group: 'Workspace', route: '/analytics', icon: 'query_stats' },
    { label: 'Financial Health', group: 'Workspace', route: '/financial-health', icon: 'health_and_safety' },
    { label: 'Notifications', group: 'Workspace', route: '/notifications', icon: 'notifications' },
    { label: 'Settings', group: 'Workspace', route: '/settings', icon: 'settings' },
    { label: 'Profile', group: 'More', route: '/profile', icon: 'person' },
  ].filter((item) => !Capacitor.isNativePlatform() || [
    '/dashboard', '/transactions', '/expenses', '/income', '/banks', '/credit-cards',
    '/investments', '/goals', '/health', '/notifications', '/profile', '/settings',
  ].includes(item.route));

  toggleTheme(): void {
    this.theme.toggle();
  }

  toggleSearch(): void {
    this.searchOpen.update((open) => !open);
    if (!this.searchOpen()) this.searchQuery.set('');
  }

  filteredSearchItems(): SearchItem[] {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.searchItems.slice(0, 6);
    return this.searchItems.filter((item) => `${item.label} ${item.group}`.toLowerCase().includes(query)).slice(0, 8);
  }

  goToSearchItem(item: SearchItem): void {
    this.router.navigate([item.route]);
    this.searchOpen.set(false);
    this.searchQuery.set('');
  }

  logout(): void {
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/auth/login']),
    });
  }

}
