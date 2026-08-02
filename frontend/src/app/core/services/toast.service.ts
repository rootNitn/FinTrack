import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

const DEFAULT_DURATION_MS = 4000;

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  success(message: string): void {
    this.show(message, 'toast-success');
  }

  error(message: string): void {
    this.show(message, 'toast-error');
  }

  info(message: string): void {
    this.show(message, 'toast-info');
  }

  private show(message: string, panelClass: string): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: DEFAULT_DURATION_MS,
      horizontalPosition: 'end',
      verticalPosition: 'top',
      panelClass,
    });
  }
}
