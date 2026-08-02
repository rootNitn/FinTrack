import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { DataTableComponent, DataTableColumn } from '../../../shared/components/data-table/data-table.component';
import { ConfirmDialogService } from '../../../shared/components/confirm-dialog/confirm-dialog.service';
import { ToastService } from '../../../core/services/toast.service';
import { FamilyMember } from '../family-members.model';
import { FamilyMembersService } from '../family-members.service';
import { FamilyMemberFormComponent } from '../family-member-form/family-member-form.component';

@Component({
  selector: 'app-family-member-list',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule, PageHeaderComponent, DataTableComponent],
  templateUrl: './family-member-list.component.html',
  styleUrl: './family-member-list.component.scss',
})
export class FamilyMemberListComponent {
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly dialog = inject(MatDialog);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly members = signal<FamilyMember[]>([]);

  readonly columns: DataTableColumn<FamilyMember>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      cell: (row) => row.name,
    },
    { key: 'relation', header: 'Relation', cell: (row) => row.relation || '—' },
    { key: 'usageCount', header: 'Records tagged', cell: (row) => `${row.usageCount}` },
  ];

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.familyMembersService.list().subscribe({
      next: (members) => {
        this.members.set(members);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateDialog(): void {
    const ref = this.dialog.open(FamilyMemberFormComponent, { width: '480px', data: {} });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Family member added.');
        this.load();
      }
    });
  }

  openEditDialog(member: FamilyMember): void {
    const ref = this.dialog.open(FamilyMemberFormComponent, { width: '480px', data: { member } });
    ref.afterClosed().subscribe((result) => {
      if (result) {
        this.toast.success('Family member updated.');
        this.load();
      }
    });
  }

  deleteMember(member: FamilyMember): void {
    const usageWarning =
      member.usageCount > 0
        ? ` This member is tagged on ${member.usageCount} record${member.usageCount === 1 ? '' : 's'} — those records will keep their data but lose the tag.`
        : '';
    this.confirmDialog
      .open({
        title: 'Delete family member',
        message: `Are you sure you want to delete "${member.name}"?${usageWarning}`,
        confirmLabel: 'Delete',
        danger: true,
      })
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.familyMembersService.remove(member.id).subscribe(() => {
          this.toast.success('Family member deleted.');
          this.load();
        });
      });
  }
}
