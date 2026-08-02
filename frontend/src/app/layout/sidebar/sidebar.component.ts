import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { filter } from 'rxjs';

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
 * Ordered sidebar entries. Related routes (e.g. the ~10 tax sub-pages, the 2 FD pages, the
 * 3 admin-only pages) are collapsed into a single expandable group to cut down on clutter,
 * while still keeping every route reachable and in its original relative position.
 */
const NAV_ENTRIES: NavEntry[] = [
  { kind: 'item', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  {
    kind: 'group',
    label: 'Investments',
    icon: 'trending_up',
    route: '/investments',
    children: [
      { label: 'Portfolio', icon: 'trending_up', route: '/investments' },
      { label: 'Compare Investments', icon: 'balance', route: '/investment-comparison' },
    ],
  },
  { kind: 'item', label: 'Mutual Funds', icon: 'donut_small', route: '/mutual-funds' },
  { kind: 'item', label: 'Transactions', icon: 'receipt_long', route: '/transactions' },
  { kind: 'item', label: 'Expenses', icon: 'payments', route: '/expenses' },
  { kind: 'item', label: 'Income', icon: 'attach_money', route: '/income' },
  { kind: 'item', label: 'Bank Accounts', icon: 'account_balance', route: '/banks' },
  { kind: 'item', label: 'Credit Cards', icon: 'credit_card', route: '/credit-cards' },
  {
    kind: 'group',
    label: 'Fixed Deposits',
    icon: 'savings',
    children: [
      { label: 'FD Calculator', icon: 'savings', route: '/fd/calculator' },
      { label: 'FD Portfolio', icon: 'account_balance_wallet', route: '/fd/portfolio' },
    ],
  },
  { kind: 'item', label: 'Goals', icon: 'flag', route: '/goals' },
  { kind: 'item', label: 'Family Members', icon: 'group', route: '/family-members' },
  { kind: 'item', label: 'Calculators', icon: 'calculate', route: '/calculators' },
  {
    kind: 'group',
    label: 'Income Tax',
    icon: 'request_quote',
    route: '/tax',
    children: [
      { label: 'Tax Calculator', icon: 'calculate', route: '/tax/calculator' },
      { label: 'Capital Gains', icon: 'trending_up', route: '/tax/capital-gains' },
      { label: 'Advance Tax', icon: 'event_available', route: '/tax/advance-tax' },
      { label: 'Tax Saving Planner', icon: 'savings', route: '/tax/planner' },
      { label: 'Tax Filing Workspace', icon: 'rocket_launch', route: '/tax/workspace' },
      { label: 'Tax Reports', icon: 'summarize', route: '/tax/reports' },
      { label: 'Tax History', icon: 'history', route: '/tax/history' },
      { label: 'Tax Documents', icon: 'description', route: '/tax/documents' },
      { label: 'Document Imports', icon: 'file_upload', route: '/tax/imports' },
    ],
  },
  { kind: 'item', label: 'AI Features', icon: 'smart_toy', route: '/ai-insights' },
  { kind: 'item', label: 'Analytics', icon: 'query_stats', route: '/analytics' },
  { kind: 'item', label: 'Reports', icon: 'bar_chart', route: '/reports' },
  { kind: 'item', label: 'Upcoming Bills', icon: 'event', route: '/upcoming-bills' },
  { kind: 'item', label: 'Notifications', icon: 'notifications', route: '/notifications' },
  { kind: 'item', label: 'Settings', icon: 'settings', route: '/settings' },
  {
    kind: 'group',
    label: 'Admin',
    icon: 'admin_panel_settings',
    adminOnly: true,
    children: [
      { label: 'General Admin', icon: 'admin_panel_settings', route: '/admin' },
      { label: 'FD Admin', icon: 'account_balance', route: '/fd/admin' },
      { label: 'Tax Admin', icon: 'request_quote', route: '/tax/admin' },
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

  readonly navEntries = NAV_ENTRIES;

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
      this.expandedGroups.add(label);
    }
  }

  isGroupExpanded(label: string): boolean {
    return this.expandedGroups.has(label);
  }

  private syncExpandedGroupFromUrl(url: string): void {
    for (const entry of this.navEntries) {
      if (entry.kind === 'group' && entry.children.some((child) => url.startsWith(child.route))) {
        this.expandedGroups.add(entry.label);
      }
    }
  }
}
