import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService, QueryParams } from '../../core/services/api-base.service';
import { PaginationMeta } from '../../core/models/api-response.model';
import {
  CreateTicketPayload,
  SupportTicket,
  TicketListParams,
  UpdateTicketAdminPayload,
} from './support-tickets.model';

@Injectable({ providedIn: 'root' })
export class SupportTicketsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/support-tickets';

  list(params: TicketListParams = {}): Observable<{ data: SupportTicket[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<SupportTicket[]>(this.basePath, params as QueryParams);
  }

  getById(id: string): Observable<SupportTicket> {
    return this.api.get<SupportTicket>(`${this.basePath}/${id}`);
  }

  create(payload: CreateTicketPayload): Observable<SupportTicket> {
    return this.api.post<SupportTicket>(this.basePath, payload);
  }

  // --- Admin ---

  listAll(params: TicketListParams = {}): Observable<{ data: SupportTicket[]; meta?: PaginationMeta }> {
    return this.api.getWithMeta<SupportTicket[]>(`${this.basePath}/admin`, params as QueryParams);
  }

  updateAdmin(id: string, payload: UpdateTicketAdminPayload): Observable<SupportTicket> {
    return this.api.patch<SupportTicket>(`${this.basePath}/admin/${id}`, payload);
  }
}
