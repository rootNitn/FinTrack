import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { EChartsCoreOption } from 'echarts/core';

@Component({
  selector: 'app-chart-card',
  imports: [CommonModule, NgxEchartsDirective],
  templateUrl: './chart-card.component.html',
  styleUrl: './chart-card.component.scss'
})
export class ChartCardComponent {
  readonly title = input.required<string>();
  readonly options = input<EChartsCoreOption | null>(null);
  readonly loading = input(false);
  readonly height = input('320px');
  readonly chartClick = output<unknown>();
}
