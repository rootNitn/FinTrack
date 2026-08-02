import { CommonModule } from '@angular/common';
import { Component, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { CALCULATORS } from '../calculators.data';
import { CalculatorDefinition } from '../calculators.model';

interface CalculatorGroup {
  category: string;
  items: CalculatorDefinition[];
}

@Component({
  selector: 'app-calculator-list',
  imports: [CommonModule, RouterLink, MatIconModule, PageHeaderComponent],
  templateUrl: './calculator-list.component.html',
  styleUrl: './calculator-list.component.scss',
})
export class CalculatorListComponent {
  readonly groups = computed<CalculatorGroup[]>(() => {
    const byCategory = new Map<string, CalculatorDefinition[]>();
    for (const calc of CALCULATORS) {
      const list = byCategory.get(calc.category) ?? [];
      list.push(calc);
      byCategory.set(calc.category, list);
    }
    return Array.from(byCategory.entries()).map(([category, items]) => ({ category, items }));
  });
}
