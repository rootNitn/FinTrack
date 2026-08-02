import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { FdComparisonRow } from '../fd.model';
import { formatCurrency } from '../../../shared/utils/currency.util';

export interface FdCompareDialogData {
  rows: FdComparisonRow[];
}

@Component({
  selector: 'app-fd-compare-dialog',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './fd-compare-dialog.component.html',
  styleUrl: './fd-compare-dialog.component.scss',
})
export class FdCompareDialogComponent {
  readonly rows: FdComparisonRow[];

  constructor(
    private readonly dialogRef: MatDialogRef<FdCompareDialogComponent>,
    @Inject(MAT_DIALOG_DATA) data: FdCompareDialogData
  ) {
    this.rows = data.rows;
  }

  currency(value: number): string {
    return formatCurrency(value, { maximumFractionDigits: 0 });
  }

  close(): void {
    this.dialogRef.close();
  }
}
