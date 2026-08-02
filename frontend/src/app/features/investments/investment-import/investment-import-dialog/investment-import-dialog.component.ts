import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { downloadBlob } from '../../../../shared/utils/file-download.util';
import { ToastService } from '../../../../core/services/toast.service';
import { InvestmentImportService } from '../investment-import.service';
import { INVESTMENT_CATEGORIES, INVESTMENT_CATEGORY_LABELS, InvestmentCategory } from '../../investments.model';
import {
  GENERIC_CSV_PROVIDER_KEY,
  ImportColumnsResponse,
  ImportCommitResponse,
  ImportParseResponse,
  ImportPreviewRow,
  ImportStage,
} from '../investment-import.model';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const STEPS: { key: ImportStage; label: string }[] = [
  { key: 'uploading', label: 'Uploading' },
  { key: 'reading', label: 'Reading' },
  { key: 'validating', label: 'Validating' },
  { key: 'importing', label: 'Importing' },
  { key: 'completed', label: 'Completed' },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

@Component({
  selector: 'app-investment-import-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatCheckboxModule,
  ],
  templateUrl: './investment-import-dialog.component.html',
  styleUrl: './investment-import-dialog.component.scss',
})
export class InvestmentImportDialogComponent {
  private readonly importService = inject(InvestmentImportService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly dialogRef = inject(MatDialogRef<InvestmentImportDialogComponent>);

  readonly steps = STEPS;
  readonly categories = INVESTMENT_CATEGORIES;
  readonly categoryLabels = INVESTMENT_CATEGORY_LABELS;

  readonly stage = signal<ImportStage>('idle');
  readonly dragOver = signal(false);
  readonly selectedFile = signal<File | null>(null);
  readonly uploadPercent = signal(0);
  readonly errorMessage = signal<string | null>(null);

  readonly parseResult = signal<ImportParseResponse | null>(null);
  readonly selection = signal<Record<number, boolean>>({});

  readonly committing = signal(false);
  readonly commitResult = signal<ImportCommitResponse | null>(null);

  readonly mappingColumns = signal<ImportColumnsResponse | null>(null);
  readonly mappingLoading = signal(false);
  readonly mappingForm = this.fb.nonNullable.group({
    name: [''],
    purchaseDate: [''],
    amount: [''],
    transactionType: [''],
    units: [''],
    purchaseNav: [''],
    symbol: [''],
    category: ['' as InvestmentCategory | ''],
  });

  readonly selectedCount = computed(() => Object.values(this.selection()).filter(Boolean).length);

  readonly selectedTotalAmount = computed(() => {
    const result = this.parseResult();
    if (!result) return 0;
    const sel = this.selection();
    return Number(
      result.rows
        .filter((r) => sel[r.rowNumber])
        .reduce((sum, r) => sum + (r.amount ?? 0), 0)
        .toFixed(2)
    );
  });

  readonly allSelected = computed(() => {
    const result = this.parseResult();
    if (!result || result.rows.length === 0) return false;
    return result.rows.every((r) => this.selection()[r.rowNumber]);
  });

  /** Which panel of the dialog to render: drag-drop zone, progress stepper, column mapping, row-selection preview, or final result. */
  readonly view = computed<'upload' | 'progress' | 'mapping' | 'preview' | 'result'>(() => {
    if (this.commitResult()) return 'result';
    if (this.stage() === 'importing') return 'progress';
    if (this.parseResult()) return 'preview';
    if (this.mappingColumns()) return 'mapping';
    if (this.stage() === 'uploading' || this.stage() === 'reading' || this.stage() === 'validating') return 'progress';
    return 'upload';
  });

  currentStepIndex(): number {
    return this.steps.findIndex((s) => s.key === this.stage());
  }

  fileSizeLabel(): string {
    const file = this.selectedFile();
    return file ? formatFileSize(file.size) : '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) this.handleFile(file);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.handleFile(file);
    input.value = '';
  }

  private handleFile(file: File): void {
    const lowerName = file.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      this.errorMessage.set('Only .xlsx, .xls and .csv files are supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      this.errorMessage.set('File is too large. Maximum size is 5 MB.');
      return;
    }

    this.errorMessage.set(null);
    this.selectedFile.set(file);
    this.startUpload(file);
  }

  private startUpload(file: File): void {
    this.stage.set('uploading');
    this.uploadPercent.set(0);

    this.importService.parse(file).subscribe({
      next: (event) => {
        if (event.type === 'progress') {
          this.uploadPercent.set(event.percent);
          if (event.percent >= 100) this.stage.set('reading');
        } else {
          this.stage.set('validating');
          window.setTimeout(() => this.onParsed(event.result), 350);
        }
      },
      error: (err) => {
        if (err?.error?.errors?.code === 'UNRECOGNIZED_FORMAT') {
          this.startColumnMapping(file);
          return;
        }
        this.errorMessage.set(err?.error?.message ?? 'Failed to read the uploaded file.');
        this.stage.set('idle');
        this.selectedFile.set(null);
      },
    });
  }

  /** Called when auto-detection can't recognize the file's format — fetches its columns to drive a manual mapping UI. */
  private startColumnMapping(file: File): void {
    this.mappingLoading.set(true);
    this.importService.columns(file).subscribe({
      next: (columns) => {
        this.mappingLoading.set(false);
        this.mappingColumns.set(columns);
        this.stage.set('idle');
      },
      error: (err) => {
        this.mappingLoading.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Could not read columns from the uploaded file.');
        this.stage.set('idle');
        this.selectedFile.set(null);
      },
    });
  }

  confirmMapping(): void {
    const file = this.selectedFile();
    if (!file) return;
    const raw = this.mappingForm.getRawValue();
    if (!raw.name || !raw.purchaseDate || !raw.amount || !raw.category) {
      this.toast.error('Name, Date, Amount and Category are required.');
      return;
    }

    this.stage.set('validating');
    this.importService
      .parseMapped(file, {
        name: raw.name,
        purchaseDate: raw.purchaseDate,
        amount: raw.amount,
        transactionType: raw.transactionType || null,
        units: raw.units || null,
        purchaseNav: raw.purchaseNav || null,
        symbol: raw.symbol || null,
      })
      .subscribe({
        next: (result) => {
          this.onParsed(result);
        },
        error: (err) => {
          this.stage.set('idle');
          this.toast.error(err?.error?.message ?? 'Failed to parse the file with the selected mapping.');
        },
      });
  }

  cancelMapping(): void {
    this.mappingColumns.set(null);
    this.selectedFile.set(null);
    this.mappingForm.reset();
  }

  private onParsed(result: ImportParseResponse): void {
    this.parseResult.set(result);
    const initialSelection: Record<number, boolean> = {};
    for (const row of result.rows) {
      initialSelection[row.rowNumber] = row.isValid && !row.isDuplicate;
    }
    this.selection.set(initialSelection);
    this.stage.set('idle');
  }

  isSelected(row: ImportPreviewRow): boolean {
    return !!this.selection()[row.rowNumber];
  }

  toggleRow(row: ImportPreviewRow): void {
    this.selection.update((sel) => ({ ...sel, [row.rowNumber]: !sel[row.rowNumber] }));
  }

  toggleAll(): void {
    const result = this.parseResult();
    if (!result) return;
    const nextValue = !this.allSelected();
    const next: Record<number, boolean> = {};
    for (const row of result.rows) next[row.rowNumber] = nextValue;
    this.selection.set(next);
  }

  rowStatusLabel(row: ImportPreviewRow): string {
    if (!row.isValid) return row.issues.join(', ');
    if (row.isDuplicate) return 'Duplicate — already imported';
    return 'Ready to import';
  }

  importSelected(): void {
    const result = this.parseResult();
    if (!result) return;
    const sel = this.selection();
    const rows = result.rows.filter((r) => sel[r.rowNumber]);
    if (rows.length === 0) return;

    this.stage.set('importing');
    this.committing.set(true);

    const category = this.mappingForm.getRawValue().category;
    this.importService
      .commit({
        fileName: result.fileName,
        provider: result.provider,
        rows,
        ...(result.provider === GENERIC_CSV_PROVIDER_KEY && category ? { category } : {}),
      })
      .subscribe({
        next: (response) => {
          this.committing.set(false);
          this.commitResult.set(response);
          this.stage.set('completed');
        },
        error: (err) => {
          this.committing.set(false);
          this.stage.set('idle');
          this.toast.error(err?.error?.message ?? 'Import failed.');
        },
      });
  }

  downloadFailedRows(): void {
    const result = this.commitResult();
    if (!result || result.failedRows.length === 0) return;
    this.importService.exportFailedRows(result.failedRows).subscribe((blob) => downloadBlob(blob, 'failed-import-rows.xlsx'));
  }

  startOver(): void {
    this.stage.set('idle');
    this.selectedFile.set(null);
    this.parseResult.set(null);
    this.selection.set({});
    this.commitResult.set(null);
    this.errorMessage.set(null);
    this.mappingColumns.set(null);
    this.mappingForm.reset();
  }

  close(): void {
    const result = this.commitResult();
    this.dialogRef.close(result && result.imported > 0 ? { imported: result.imported } : undefined);
  }
}
