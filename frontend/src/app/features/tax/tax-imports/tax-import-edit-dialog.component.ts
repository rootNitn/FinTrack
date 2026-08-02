import { CommonModule } from '@angular/common';
import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TaxImportFieldConfig, TaxImportRecord } from './tax-import.model';

export interface TaxImportEditDialogData {
  title: string;
  fields: TaxImportFieldConfig[];
  record: TaxImportRecord;
}

@Component({
  selector: 'app-tax-import-edit-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './tax-import-edit-dialog.component.html',
})
export class TaxImportEditDialogComponent {
  readonly dialogRef = inject(MatDialogRef<TaxImportEditDialogComponent>);
  private readonly fb = inject(FormBuilder);

  readonly fields: TaxImportFieldConfig[];
  readonly warnings: string[];
  readonly form;

  constructor(@Inject(MAT_DIALOG_DATA) public data: TaxImportEditDialogData) {
    this.fields = data.fields;
    this.warnings = data.record.validationWarnings ?? [];

    const controls: Record<string, unknown> = {};
    for (const field of this.fields) {
      const currentValue = data.record[field.key];
      if (field.type === 'number') {
        controls[field.key] = [
          typeof currentValue === 'number' ? currentValue : Number(currentValue ?? 0),
          [Validators.min(0)],
        ];
      } else {
        controls[field.key] = [typeof currentValue === 'string' ? currentValue : ''];
      }
    }
    this.form = this.fb.nonNullable.group(controls);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.getRawValue());
  }
}
