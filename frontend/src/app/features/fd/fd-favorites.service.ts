import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiBaseService } from '../../core/services/api-base.service';
import { FdFavorite } from './fd.model';

@Injectable({ providedIn: 'root' })
export class FdFavoritesService {
  private readonly api = inject(ApiBaseService);
  private readonly basePath = '/fd/favorites';

  list(): Observable<FdFavorite[]> {
    return this.api.get<FdFavorite[]>(this.basePath);
  }

  add(bankId: string): Observable<FdFavorite> {
    return this.api.post<FdFavorite>(this.basePath, { bankId });
  }

  remove(bankId: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`${this.basePath}/${bankId}`);
  }
}
