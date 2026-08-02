import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ContentChild,
  EventEmitter,
  Input,
  Output,
  TemplateRef,
  ViewChild,
  signal,
} from '@angular/core';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => string;
}

/**
 * Generic sortable/paginated/filterable table.
 * - Client-side sort/filter/pagination when `serverSide` is false (default).
 * - Server-side mode: set `serverSide` true and `totalCount`; listen to (page)/(sortChange)/(searchChange)
 *   to trigger a backend refetch, and pass already-paged `rows` in.
 * - Per-row actions: project a <ng-template #rowActions let-row> into content.
 */
@Component({
  selector: 'app-data-table',
  imports: [
    CommonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    SkeletonLoaderComponent,
    EmptyStateComponent,
  ],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.scss'
})
export class DataTableComponent<T = any> implements AfterViewInit {
  @Input() columns: DataTableColumn<T>[] = [];
  @Input() set rows(value: T[]) {
    this.dataSource.data = value ?? [];
  }
  @Input() loading = false;
  @Input() searchable = true;
  @Input() serverSide = false;
  @Input() totalCount = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions = [5, 10, 25, 50];
  @Input() emptyTitle = 'No records found';
  @Input() emptyMessage: string | null = null;
  @Input() rowActionsTemplate: TemplateRef<{ $implicit: T }> | null = null;

  @ContentChild('rowActions') rowActionsContentTemplate?: TemplateRef<{ $implicit: T }>;

  @Output() rowClick = new EventEmitter<T>();
  @Output() page = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<{ active: string; direction: 'asc' | 'desc' | '' }>();
  @Output() searchChange = new EventEmitter<string>();

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  readonly dataSource = new MatTableDataSource<T>([]);
  readonly searchTerm = signal('');

  get displayedColumns(): string[] {
    const keys = this.columns.map((c) => c.key);
    return this.rowActionsContentTemplate ? [...keys, 'actions'] : keys;
  }

  ngAfterViewInit(): void {
    if (!this.serverSide) {
      if (this.paginator) this.dataSource.paginator = this.paginator;
      if (this.sort) this.dataSource.sort = this.sort;
    }
  }

  onSearchInput(value: string): void {
    this.searchTerm.set(value);
    if (this.serverSide) {
      this.searchChange.emit(value);
    } else {
      this.dataSource.filter = value.trim().toLowerCase();
    }
  }

  onPage(event: PageEvent): void {
    this.page.emit(event);
  }

  onSortChange(event: { active: string; direction: 'asc' | 'desc' | '' }): void {
    this.sortChange.emit(event);
  }

  cellValue(column: DataTableColumn<T>, row: T): string {
    if (column.cell) return column.cell(row);
    const value = (row as Record<string, unknown>)[column.key];
    return value === null || value === undefined ? '—' : String(value);
  }
}
