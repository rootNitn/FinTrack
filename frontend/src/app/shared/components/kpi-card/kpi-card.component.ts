import { CommonModule } from '@angular/common';
import { Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

export type KpiTrend = 'up' | 'down' | 'neutral';

@Component({
  selector: 'app-kpi-card',
  imports: [CommonModule, MatIconModule],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss'
})
export class KpiCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input<string>('trending_up');
  readonly trend = input<KpiTrend>('neutral');
  readonly trendLabel = input<string | null>(null);
  readonly loading = input(false);
}
