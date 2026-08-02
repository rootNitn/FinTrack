import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { NavbarComponent } from '../navbar/navbar.component';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { LoadingService } from '../../core/services/loading.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/settings.service';
import { currencyCode } from '../../shared/utils/currency.util';

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterOutlet, MatSidenavModule, MatProgressBarModule, NavbarComponent, SidebarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly settingsService = inject(SettingsService);
  readonly loading = inject(LoadingService);

  private readonly mobileQuery = window.matchMedia('(max-width: 768px)');
  readonly isMobile = signal(this.mobileQuery.matches);
  readonly sidebarOpen = signal(!this.mobileQuery.matches);
  readonly isAdmin = this.authService.isAdmin;

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
