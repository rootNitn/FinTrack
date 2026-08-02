import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
  { label: 'Investments', icon: 'trending_up', route: '/investments' },
  { label: 'Transactions', icon: 'receipt_long', route: '/transactions' },
  { label: 'Expenses', icon: 'payments', route: '/expenses' },
  { label: 'Income', icon: 'attach_money', route: '/income' },
  { label: 'Bank Accounts', icon: 'account_balance', route: '/banks' },
  { label: 'Credit Cards', icon: 'credit_card', route: '/credit-cards' },
  { label: 'Fixed Deposits', icon: 'savings', route: '/fd/calculator' },
  { label: 'FD Portfolio', icon: 'account_balance_wallet', route: '/fd/portfolio' },
  { label: 'Goals', icon: 'flag', route: '/goals' },
  { label: 'Calculators', icon: 'calculate', route: '/calculators' },
  { label: 'Income Tax', icon: 'request_quote', route: '/tax' },
  { label: 'Tax Calculator', icon: 'calculate', route: '/tax/calculator' },
  { label: 'Capital Gains', icon: 'trending_up', route: '/tax/capital-gains' },
  { label: 'Advance Tax', icon: 'event_available', route: '/tax/advance-tax' },
  { label: 'Tax Saving Planner', icon: 'savings', route: '/tax/planner' },
  { label: 'Tax Filing Workspace', icon: 'rocket_launch', route: '/tax/workspace' },
  { label: 'Tax Reports', icon: 'summarize', route: '/tax/reports' },
  { label: 'Tax History', icon: 'history', route: '/tax/history' },
  { label: 'Tax Documents', icon: 'description', route: '/tax/documents' },
  { label: 'Document Imports', icon: 'file_upload', route: '/tax/imports' },
  { label: 'Compare Investments', icon: 'balance', route: '/investment-comparison' },
  { label: 'AI Features', icon: 'smart_toy', route: '/ai-insights' },
  { label: 'Analytics', icon: 'query_stats', route: '/analytics' },
  { label: 'Reports', icon: 'bar_chart', route: '/reports' },
  { label: 'Upcoming Bills', icon: 'event', route: '/upcoming-bills' },
  { label: 'Notifications', icon: 'notifications', route: '/notifications' },
  { label: 'Settings', icon: 'settings', route: '/settings' },
  { label: 'Admin', icon: 'admin_panel_settings', route: '/admin', adminOnly: true },
  { label: 'FD Admin', icon: 'account_balance', route: '/fd/admin', adminOnly: true },
  { label: 'Tax Admin', icon: 'request_quote', route: '/tax/admin', adminOnly: true },
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

  readonly navItems = NAV_ITEMS;

}
