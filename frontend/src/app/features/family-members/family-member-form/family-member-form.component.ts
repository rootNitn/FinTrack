import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FAMILY_MEMBER_RELATIONS, FamilyMember } from '../family-members.model';
import { FamilyMembersService } from '../family-members.service';

export interface FamilyMemberFormDialogData {
  member?: FamilyMember;
}

const DEFAULT_COLORS = ['#4f46e5', '#0ea5e9', '#16a34a', '#f59e0b', '#ec4899', '#8b5cf6'];

@Component({
  selector: 'app-family-member-form',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './family-member-form.component.html',
  styleUrl: './family-member-form.component.scss',
})
export class FamilyMemberFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly familyMembersService = inject(FamilyMembersService);
  private readonly dialogRef = inject(MatDialogRef<FamilyMemberFormComponent>);
  readonly data = inject<FamilyMemberFormDialogData>(MAT_DIALOG_DATA);

  readonly relations = FAMILY_MEMBER_RELATIONS;
  readonly colors = DEFAULT_COLORS;
  readonly isEdit = !!this.data?.member;
  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    name: [this.data?.member?.name ?? '', [Validators.required, Validators.maxLength(100)]],
    relation: [this.data?.member?.relation ?? ''],
    color: [this.data?.member?.color ?? DEFAULT_COLORS[0]],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name,
      ...(raw.relation ? { relation: raw.relation } : {}),
      ...(raw.color ? { color: raw.color } : {}),
    };

    const request = this.isEdit
      ? this.familyMembersService.update(this.data.member!.id, payload)
      : this.familyMembersService.create(payload);

    request.subscribe({
      next: (member) => {
        this.submitting.set(false);
        this.dialogRef.close(member);
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err?.error?.message ?? 'Failed to save family member.');
      },
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }
}
