import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { downloadBlob } from '../../../shared/utils/file-download.util';
import { TaxService } from '../tax.service';
import { TaxFinancialYearSummary } from '../tax.model';
import { TaxDocumentsService } from './tax-documents.service';
import { TAX_DOCUMENT_TYPE_LABELS, TaxDocumentType, UploadedDocumentSummary } from './tax-document.model';
import { formatDateTime } from '../../../shared/utils/date.util';

const DOCUMENT_TYPES: TaxDocumentType[] = ['SALARY_SLIP', 'FORM16', 'AIS', 'FORM26AS', 'CAPITAL_GAINS_STATEMENT', 'OTHER'];

@Component({
  selector: 'app-tax-documents',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatIconModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    PageHeaderComponent,
    DataTableComponent,
  ],
  templateUrl: './tax-documents.component.html',
  styleUrl: './tax-documents.component.scss',
})
export class TaxDocumentsComponent implements OnInit {
  private readonly taxService = inject(TaxService);
  private readonly documentsService = inject(TaxDocumentsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly documentTypes = DOCUMENT_TYPES;
  readonly typeLabels = TAX_DOCUMENT_TYPE_LABELS;

  readonly financialYears = signal<TaxFinancialYearSummary[]>([]);
  readonly documents = signal<UploadedDocumentSummary[]>([]);
  readonly loading = signal(true);
  readonly uploading = signal(false);
  readonly versionsFor = signal<UploadedDocumentSummary | null>(null);
  readonly versionRows = signal<UploadedDocumentSummary[]>([]);

  selectedFinancialYearCode = '';
  selectedDocumentType: TaxDocumentType = 'SALARY_SLIP';

  readonly columns: DataTableColumn<UploadedDocumentSummary>[] = [
    { key: 'documentType', header: 'Type', cell: (row) => this.typeLabels[row.documentType] },
    { key: 'financialYearCode', header: 'Financial Year' },
    { key: 'fileName', header: 'File Name' },
    { key: 'version', header: 'Version', cell: (row) => `v${row.version}` },
    { key: 'status', header: 'Status' },
    { key: 'createdAt', header: 'Uploaded On', cell: (row) => formatDateTime(row.createdAt) },
  ];

  readonly versionColumns: DataTableColumn<UploadedDocumentSummary>[] = [
    { key: 'version', header: 'Version', cell: (row) => `v${row.version}` },
    { key: 'fileName', header: 'File Name' },
    { key: 'createdAt', header: 'Uploaded On', cell: (row) => formatDateTime(row.createdAt) },
  ];

  ngOnInit(): void {
    this.taxService.listFinancialYears().subscribe({
      next: (years) => {
        this.financialYears.set(years);
        const defaultYear = years.find((y) => y.isDefault) ?? years[0];
        if (defaultYear) this.selectedFinancialYearCode = defaultYear.code;
        this.load();
      },
      error: () => this.load(),
    });
  }

  load(): void {
    this.loading.set(true);
    this.documentsService.list().subscribe({
      next: (docs) => {
        this.documents.set(docs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!this.selectedFinancialYearCode) {
      this.toast.error('Select a financial year before uploading.');
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.documentsService.upload(file, this.selectedDocumentType, this.selectedFinancialYearCode).subscribe({
      next: () => {
        this.uploading.set(false);
        this.toast.success('Document uploaded.');
        input.value = '';
        this.load();
      },
      error: (err) => {
        this.uploading.set(false);
        input.value = '';
        this.toast.error(err?.error?.message ?? 'Failed to upload document.');
      },
    });
  }

  preview(row: UploadedDocumentSummary, event: Event): void {
    event.stopPropagation();
    this.documentsService.preview(row.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error: () => this.toast.error('Failed to preview document.'),
    });
  }

  download(row: UploadedDocumentSummary, event: Event): void {
    event.stopPropagation();
    this.documentsService.download(row.id).subscribe({
      next: (blob) => downloadBlob(blob, row.fileName),
      error: () => this.toast.error('Failed to download document.'),
    });
  }

  showVersions(row: UploadedDocumentSummary, event: Event): void {
    event.stopPropagation();
    this.versionsFor.set(row);
    this.documentsService.versions(row.id).subscribe({
      next: (versions) => this.versionRows.set(versions),
      error: () => this.toast.error('Failed to load version history.'),
    });
  }

  closeVersions(): void {
    this.versionsFor.set(null);
    this.versionRows.set([]);
  }

  deleteDocument(row: UploadedDocumentSummary, event: Event): void {
    event.stopPropagation();
    this.confirmDialog
      .open({
        title: 'Delete document',
        message: `Are you sure you want to delete "${row.fileName}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.documentsService.delete(row.id).subscribe(() => {
          this.toast.success('Document deleted.');
          if (this.versionsFor()?.id === row.id) this.closeVersions();
          this.load();
        });
      });
  }
}
