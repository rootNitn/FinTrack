import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { startWith } from 'rxjs';
import type { EChartsCoreOption } from 'echarts/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent } from '../../../shared/components/data-table/data-table.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ChartCardComponent } from '../../../shared/components/chart-card/chart-card.component';
import { getCalculatorBySlug } from '../calculators.data';
import { CalculatorDefinition, CalculatorResult } from '../calculators.model';
import { formatCompactCurrency, formatCurrency } from '../calculators.util';
import { CHART_PALETTE, gradientFill } from '../../../shared/charts/chart-style.util';

@Component({
  selector: 'app-calculator-detail',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatButtonModule,
    PageHeaderComponent,
    DataTableComponent,
    EmptyStateComponent,
    ChartCardComponent,
  ],
  templateUrl: './calculator-detail.component.html',
  styleUrl: './calculator-detail.component.scss',
})
export class CalculatorDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly definition = signal<CalculatorDefinition | null>(null);
  readonly result = signal<CalculatorResult | null>(null);
  form = this.fb.nonNullable.group({});

  readonly chartOptions = computed<EChartsCoreOption | null>(() => {
    const chart = this.result()?.chart;
    if (!chart) return null;

    if (chart.type === 'pie') {
      const pieData = (chart.pieData ?? []).map((d, i) => ({
        ...d,
        itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length], borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      }));
      return {
        tooltip: { trigger: 'item', valueFormatter: (v: unknown) => formatCurrency(v as number) },
        legend: { bottom: 0 },
        series: [
          {
            type: 'pie',
            radius: ['48%', '72%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
            label: { formatter: '{b}\n{d}%' },
            emphasis: { scale: true, scaleSize: 6 },
            data: pieData,
          },
        ],
      };
    }

    const series = chart.series ?? [];
    const multi = series.length > 1;
    return {
      tooltip: { trigger: 'axis', valueFormatter: (v: unknown) => formatCurrency(v as number) },
      legend: multi ? { bottom: 0 } : undefined,
      grid: { left: 8, right: 16, top: 16, bottom: multi ? 32 : 8, containLabel: true },
      xAxis: { type: 'category', data: chart.categories ?? [], boundaryGap: chart.type === 'bar' },
      yAxis: { type: 'value', axisLabel: { formatter: (v: number) => formatCompactCurrency(v) } },
      color: CHART_PALETTE,
      series: series.map((s, i) => {
        const color = CHART_PALETTE[i % CHART_PALETTE.length];
        return {
          name: s.name,
          type: chart.type,
          smooth: chart.type === 'line',
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: chart.type === 'line' ? { width: 3, color } : undefined,
          itemStyle: chart.type === 'bar' ? { color, borderRadius: chart.stacked ? 0 : [6, 6, 0, 0] } : { color },
          areaStyle: chart.type === 'line' ? { color: gradientFill(color) } : undefined,
          stack: chart.stacked ? 'total' : undefined,
          data: s.data,
        };
      }),
    };
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    const def = getCalculatorBySlug(slug) ?? null;
    this.definition.set(def);
    if (!def) return;

    const group: Record<string, unknown[]> = {};
    for (const field of def.fields) {
      group[field.key] = [field.default];
    }
    this.form = this.fb.nonNullable.group(group);

    this.form.valueChanges
      .pipe(startWith(this.form.getRawValue()), takeUntilDestroyed(this.destroyRef))
      .subscribe((values) => {
        this.result.set(def.compute(values as Record<string, number>));
      });
  }
}
