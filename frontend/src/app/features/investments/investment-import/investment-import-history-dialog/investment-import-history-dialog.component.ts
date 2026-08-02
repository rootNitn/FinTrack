import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { InvestmentImportService } from '../investment-import.service';
import { ImportHistoryRecord } from '../investment-import.model';

@Component({
  selector: 'app-investment-import-history-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './investment-import-history-dialog.component.html',
  styleUrl: './investment-import-history-dialog.component.scss',
})
export class InvestmentImportHistoryDialogComponent {
  private readonly importService = inject(InvestmentImportService);
  readonly dialogRef = inject(MatDialogRef<InvestmentImportHistoryDialogComponent>);

  readonly loading = signal(true);
  readonly history = signal<ImportHistoryRecord[]>([]);

  constructor() {
    this.importService.history().subscribe({
      next: (records) => {
        this.history.set(records);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  close(): void {
    this.dialogRef.close();
  }
}
