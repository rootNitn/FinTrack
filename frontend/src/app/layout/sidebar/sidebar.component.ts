import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { filter } from 'rxjs';
import { Capacitor } from '@capacitor/core';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
}

interface NavGroup {
  label: string;
  icon: string;
  /** Route for the group header itself, if it links to a page (e.g. a section landing/overview page). */
  route?: string;
  adminOnly?: boolean;
  children: NavItem[];
}

type NavEntry = ({ kind: 'item' } & NavItem) | ({ kind: 'group' } & NavGroup);

/**
 * Ordered sidebar entries. Navigation is grouped by user intent so the sidebar stays scannable
 * without reducing the readable label size or hiding any route from the user.
 */
const NAV_ENTRIES: NavEntry[] = [
  { kind: 'item', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  {
    kind: 'group',
    label: 'Finance',
    icon: 'payments',
    children: [
      { label: 'Transactions', icon: 'receipt_long', route: '/transactions' },
      { label: 'Expenses', icon: 'payments', route: '/expenses' },
      { label: 'Income', icon: 'attach_money', route: '/income' },
      { label: 'Bank Accounts', icon: 'account_balance', route: '/banks' },
      { label: 'Credit Cards', icon: 'credit_card', route: '/credit-cards' },
      { label: 'Business Finance', icon: 'storefront', route: '/business' },
      { label: 'Reports', icon: 'bar_chart', route: '/reports' },
    ],
  },
  {
    kind: 'group',
    label: 'Wealth',
    icon: 'trending_up',
    route: '/investments',
    children: [
      { label: 'Portfolio', icon: 'trending_up', route: '/investments' },
      { label: 'Stocks', icon: 'show_chart', route: '/stocks' },
      { label: 'Crypto', icon: 'currency_bitcoin', route: '/crypto' },
      { label: 'Mutual Funds', icon: 'donut_small', route: '/mutual-funds' },
      { label: 'FD Calculator', icon: 'savings', route: '/fd/calculator' },
      { label: 'FD Portfolio', icon: 'account_balance_wallet', route: '/fd/portfolio' },
      { label: 'Compare Investments', icon: 'balance', route: '/investment-comparison' },
    ],
  },
  {
    kind: 'group',
    label: 'Planning',
    icon: 'event_note',
    children: [
      { label: 'Goals', icon: 'flag', route: '/goals' },
      { label: 'Upcoming Bills', icon: 'event', route: '/upcoming-bills' },
      { label: 'Calendar', icon: 'calendar_month', route: '/calendar' },
      { label: 'Family Members', icon: 'group', route: '/family-members' },
      { label: 'Calculators', icon: 'calculate', route: '/calculators' },
    ],
  },
  {
    kind: 'group',
    label: 'Health',
    icon: 'monitor_heart',
    route: '/health',
    children: [
      { label: 'Body Metrics', icon: 'monitor_weight', route: '/health/body-metrics' },
      { label: 'Vitals', icon: 'ecg_heart', route: '/health/vitals' },
      { label: 'Workouts', icon: 'fitness_center', route: '/health/workouts' },
      { label: 'Medications', icon: 'medication', route: '/health/medications' },
      { label: 'Appointments', icon: 'event_available', route: '/health/appointments' },
      { label: 'Health Goals', icon: 'flag', route: '/health/goals' },
      { label: 'Health Reports', icon: 'science', route: '/health/reports' },
    ],
  },
  {
    kind: 'group',
    label: 'Tax',
    icon: 'request_quote',
    route: '/tax',
    children: [
      { label: 'Tax Calculator', icon: 'calculate', route: '/tax/calculator' },
      { label: 'Tax Filing Workspace', icon: 'rocket_launch', route: '/tax/workspace' },
      { label: 'Capital Gains', icon: 'trending_up', route: '/tax/capital-gains' },
      { label: 'Advance Tax', icon: 'event_available', route: '/tax/advance-tax' },
      { label: 'Tax Saving Planner', icon: 'savings', route: '/tax/planner' },
      { label: 'Tax Reports', icon: 'summarize', route: '/tax/reports' },
      { label: 'Documents', icon: 'description', route: '/tax/documents' },
      { label: 'Document Imports', icon: 'file_upload', route: '/tax/imports' },
    ],
  },
  {
    kind: 'group',
    label: 'Workspace',
    icon: 'insights',
    children: [
      { label: 'AI Features', icon: 'smart_toy', route: '/ai-insights' },
      { label: 'Financial Health', icon: 'health_and_safety', route: '/financial-health' },
      { label: 'Financial Level', icon: 'trending_up', route: '/financial-level' },
      { label: 'Analytics', icon: 'query_stats', route: '/analytics' },
      { label: 'Notifications', icon: 'notifications', route: '/notifications' },
      { label: 'Help Desk', icon: 'support_agent', route: '/support-tickets' },
      { label: 'Settings', icon: 'settings', route: '/settings' },
    ],
  },
  {
    kind: 'group',
    label: 'Admin',
    icon: 'admin_panel_settings',
    adminOnly: true,
    children: [
      { label: 'General Admin', icon: 'admin_panel_settings', route: '/admin' },
      { label: 'FD Admin', icon: 'account_balance', route: '/fd/admin' },
      { label: 'Tax Admin', icon: 'request_quote', route: '/tax/admin' },
      { label: 'Support Tickets', icon: 'support_agent', route: '/support-tickets/admin' },
    ],
  },
];

@Component({
  selector: 'app-sidebar',
  imports: [CommonModule, RouterLink, RouterLinkActive, MatIconModule, MatListModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent {
  readonly collapsed = input(false);
  readonly isAdmin = input(false);
  @Output() navigate = new EventEmitter<void>();

  readonly navEntries: NavEntry[] = Capacitor.isNativePlatform() ? [
    { kind: 'item', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    { kind: 'item', label: 'Health', icon: 'monitor_heart', route: '/health' },
    { kind: 'item', label: 'Settings', icon: 'settings', route: '/settings' },
  ] : NAV_ENTRIES;

  /** Labels of groups currently expanded. A group auto-expands when one of its children is active. */
  readonly expandedGroups = new Set<string>();

  constructor(private readonly router: Router) {
    this.syncExpandedGroupFromUrl(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.syncExpandedGroupFromUrl(event.urlAfterRedirects));
  }

  toggleGroup(label: string): void {
    if (this.expandedGroups.has(label)) {
      this.expandedGroups.delete(label);
    } else {
      this.expandedGroups.clear();
      this.expandedGroups.add(label);
    }
  }

  isGroupExpanded(label: string): boolean {
    return this.expandedGroups.has(label);
  }

  private syncExpandedGroupFromUrl(url: string): void {
    this.expandedGroups.clear();
    for (const entry of this.navEntries) {
      if (entry.kind === 'group' && entry.children.some((child) => url === child.route || url.startsWith(`${child.route}/`))) {
        this.expandedGroups.add(entry.label);
      }
    }
  }
}
