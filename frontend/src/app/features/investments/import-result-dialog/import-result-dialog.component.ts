import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { ImportResult } from '../investments.model';

@Component({
  selector: 'app-import-result-dialog',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  templateUrl: './import-result-dialog.component.html',
  styleUrl: './import-result-dialog.component.scss'
})
export class ImportResultDialogComponent {
  readonly dialogRef = inject(MatDialogRef<ImportResultDialogComponent>);
  readonly data = inject<ImportResult>(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }

}
