import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-list-filter-bar',
  imports: [CommonModule, MatButtonModule, MatIconModule],
  templateUrl: './list-filter-bar.component.html',
  styleUrl: './list-filter-bar.component.scss',
})
export class ListFilterBarComponent {
  @Input() activeFiltersCount = 0;
  @Input() label = 'Filters';
  @Output() clearFilters = new EventEmitter<void>();
}
