import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { formatCurrency } from '../../../shared/utils/currency.util';
import { IncomeService } from '../income.service';
import { IncomeSourceFormComponent } from '../income-source-form/income-source-form.component';
import { IncomeSourceProfile } from '../income-source.model';

@Component({
  selector: 'app-income-source-manager',
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
  templateUrl: './income-source-manager.component.html',
})
export class IncomeSourceManagerComponent {
  private readonly incomeService = inject(IncomeService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);
  private readonly dialogRef = inject(MatDialogRef<IncomeSourceManagerComponent>);
  readonly loading = signal(true);
  readonly sources = signal<IncomeSourceProfile[]>([]);

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.incomeService.listSources().subscribe({ next: (sources) => { this.sources.set(sources); this.loading.set(false); }, error: () => this.loading.set(false) });
  }

  money(value: number): string { return formatCurrency(value, { maximumFractionDigits: 0 }); }

  add(): void {
    const ref = this.dialog.open(IncomeSourceFormComponent, { width: '680px' });
    ref.afterClosed().subscribe((result) => { if (result) { this.toast.success('Income source added.'); this.load(); } });
  }

  edit(source: IncomeSourceProfile): void {
    const ref = this.dialog.open(IncomeSourceFormComponent, { width: '680px', data: { source } });
    ref.afterClosed().subscribe((result) => { if (result) { this.toast.success('Income source updated.'); this.load(); } });
  }

  remove(source: IncomeSourceProfile): void {
    this.confirmDialog.open({ title: 'Delete income source', message: `Delete ${source.name}? Its existing income records will not be deleted.`, confirmLabel: 'Delete', danger: true }).subscribe((confirmed) => {
      if (!confirmed) return;
      this.incomeService.removeSource(source.id).subscribe(() => { this.toast.success('Income source deleted.'); this.load(); });
    });
  }

  close(): void { this.dialogRef.close(); }
}
