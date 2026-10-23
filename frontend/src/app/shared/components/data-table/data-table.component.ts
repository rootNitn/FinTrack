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
import { MatCheckboxModule } from '@angular/material/checkbox';
import { SkeletonLoaderComponent } from '../skeleton-loader/skeleton-loader.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';

export interface DataTableColumn<T = any> {
  key: string;
  header: string;
  sortable?: boolean;
  cell?: (row: T) => string;
  /** Optional per-row icon (Material icon name + background color) rendered before the cell text. */
  icon?: (row: T) => { name: string; color: string } | null;
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
    MatCheckboxModule,
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
  @Input() set searchValue(value: string) {
    this.searchTerm.set(value ?? '');
    if (!this.serverSide) this.dataSource.filter = (value ?? '').trim().toLowerCase();
  }
  @Input() serverSide = false;
  @Input() totalCount = 0;
  @Input() pageSize = 10;
  @Input() pageSizeOptions = [5, 10, 25, 50];
  @Input() emptyTitle = 'No records found';
  @Input() emptyMessage: string | null = null;
  @Input() emptyActionLabel: string | null = null;
  @Input() rowActionsTemplate: TemplateRef<{ $implicit: T }> | null = null;

  /** Opt-in row-selection (checkbox column). When enabled, listen to (selectionChange) for the current selected rows. */
  @Input() selectable = false;
  /** Extracts a stable unique key per row for tracking selection (defaults to `row.id`). */
  @Input() rowKey: (row: T) => string = (row: T) => String((row as unknown as { id: unknown }).id);

  @ContentChild('rowActions') rowActionsContentTemplate?: TemplateRef<{ $implicit: T }>;

  @Output() rowClick = new EventEmitter<T>();
  @Output() page = new EventEmitter<PageEvent>();
  @Output() sortChange = new EventEmitter<{ active: string; direction: 'asc' | 'desc' | '' }>();
  @Output() searchChange = new EventEmitter<string>();
  /** Emits the full set of currently-selected row objects (persists across pages) whenever selection changes. */
  @Output() selectionChange = new EventEmitter<T[]>();
  @Output() emptyAction = new EventEmitter<void>();

  @ViewChild(MatPaginator) paginator?: MatPaginator;
  @ViewChild(MatSort) sort?: MatSort;

  readonly dataSource = new MatTableDataSource<T>([]);
  readonly searchTerm = signal('');
  private readonly selectedMap = signal<Map<string, T>>(new Map());

  get displayedColumns(): string[] {
    const keys = this.columns.map((c) => c.key);
    const withSelect = this.selectable ? ['select', ...keys] : keys;
    return this.rowActionsContentTemplate ? [...withSelect, 'actions'] : withSelect;
  }

  isRowSelected(row: T): boolean {
    return this.selectedMap().has(this.rowKey(row));
  }

  toggleRow(row: T): void {
    const map = new Map(this.selectedMap());
    const key = this.rowKey(row);
    if (map.has(key)) map.delete(key);
    else map.set(key, row);
    this.selectedMap.set(map);
    this.selectionChange.emit([...map.values()]);
  }

  get allOnPageSelected(): boolean {
    const rows = this.dataSource.data;
    return rows.length > 0 && rows.every((r) => this.selectedMap().has(this.rowKey(r)));
  }

  get someOnPageSelected(): boolean {
    const rows = this.dataSource.data;
    return !this.allOnPageSelected && rows.some((r) => this.selectedMap().has(this.rowKey(r)));
  }

  toggleAllOnPage(): void {
    const map = new Map(this.selectedMap());
    const rows = this.dataSource.data;
    const selectAll = !this.allOnPageSelected;
    for (const r of rows) {
      const key = this.rowKey(r);
      if (selectAll) map.set(key, r);
      else map.delete(key);
    }
    this.selectedMap.set(map);
    this.selectionChange.emit([...map.values()]);
  }

  /** Clears the current selection — call after a bulk action (e.g. bulk delete) completes. */
  clearSelection(): void {
    this.selectedMap.set(new Map());
    this.selectionChange.emit([]);
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
