import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { AppointmentFormValue, DoctorAppointment } from './health.model';

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/health/appointments';

  list(upcomingOnly?: boolean): Observable<DoctorAppointment[]> {
    return this.api.get<DoctorAppointment[]>(this.basePath, upcomingOnly ? { upcomingOnly: true } : undefined);
  }

  getById(id: string): Observable<DoctorAppointment> {
    return this.api.get<DoctorAppointment>(`${this.basePath}/${id}`);
  }

  create(payload: AppointmentFormValue): Observable<DoctorAppointment> {
    return this.api.post<DoctorAppointment>(this.basePath, payload);
  }

  update(id: string, payload: Partial<AppointmentFormValue>): Observable<DoctorAppointment> {
    return this.api.patch<DoctorAppointment>(`${this.basePath}/${id}`, payload);
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${id}`);
  }
}
