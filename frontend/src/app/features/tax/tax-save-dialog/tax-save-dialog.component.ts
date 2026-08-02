import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-tax-save-dialog',
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>Save Calculation</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="w-full">
        <mat-label>Label (optional)</mat-label>
        <input matInput [formControl]="label" placeholder="e.g. FY 2025-26 - Draft 1" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="dialogRef.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="dialogRef.close(label.value)">Save</button>
    </mat-dialog-actions>
  `,
})
export class TaxSaveDialogComponent {
  readonly dialogRef = inject(MatDialogRef<TaxSaveDialogComponent>);
  private readonly fb = inject(FormBuilder);
  readonly label = this.fb.nonNullable.control('');
}
