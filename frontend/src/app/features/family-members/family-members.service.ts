import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FamilyMember, FamilyMemberFormValue } from './family-members.model';

@Injectable({ providedIn: 'root' })
export class FamilyMembersService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/family-members';

  list(): Observable<FamilyMember[]> {
    return this.api.get<FamilyMember[]>(this.basePath);
  }

  create(payload: FamilyMemberFormValue): Observable<FamilyMember> {
    return this.api.post<FamilyMember>(this.basePath, payload);
  }

  update(id: string, payload: Partial<FamilyMemberFormValue>): Observable<FamilyMember> {
    return this.api.patch<FamilyMember>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
