import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { TokenStorageService } from './token-storage.service';
import { AuthResponse } from '../models/auth.model';

describe('AuthService async session lifecycle', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let storage: jasmine.SpyObj<TokenStorageService>;
  const session: AuthResponse = {accessToken:'access',refreshToken:'refresh',user:{id:'test-user',email:'test@example.invalid',name:'Test',avatarUrl:null,dateOfBirth:null,role:'USER',isActive:true,createdAt:'2026-10-05T00:00:00Z',planTier:'FREE',planExpiresAt:null}};
  beforeEach(() => {
    storage = jasmine.createSpyObj('TokenStorage', ['getRefreshToken', 'setRefreshToken', 'setAccessToken', 'clear']);
    storage.getRefreshToken.and.returnValue('old-refresh');
    storage.setRefreshToken.and.resolveTo(); storage.clear.and.resolveTo();
    TestBed.configureTestingModule({providers:[provideHttpClient(),provideHttpClientTesting(),AuthService,{provide:TokenStorageService,useValue:storage}]});
    auth = TestBed.inject(AuthService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('shares concurrent refresh requests and persists before publishing a session', async () => {
    const first = firstValueFrom(auth.refresh());
    const second = firstValueFrom(auth.refresh());
    const request = http.expectOne(req => req.url.endsWith('/auth/refresh'));
    request.flush({success:true,data:session});
    await Promise.all([first,second]);
    expect(storage.setRefreshToken).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBeTrue();
  });
  it('does not authenticate if secure credential saving fails', async () => {
    storage.setRefreshToken.and.callFake(async () => { throw new Error('vault unavailable'); });
    const login = firstValueFrom(auth.login({email:'test@example.invalid',password:'Test@1234'}));
    http.expectOne(req => req.url.endsWith('/auth/login')).flush({success:true,data:session});
    await expectAsync(login).toBeRejected();
    expect(auth.isAuthenticated()).toBeFalse();
  });
  it('clears local credentials even when logout is offline', async () => {
    const logout = firstValueFrom(auth.logout());
    await Promise.resolve();
    http.expectOne(req => req.url.endsWith('/auth/logout')).error(new ProgressEvent('offline'));
    await logout;
    expect(storage.clear).toHaveBeenCalledTimes(1);
    expect(auth.isAuthenticated()).toBeFalse();
  });
  it('does not restore a stale refresh response after logout', async () => {
    const refresh = firstValueFrom(auth.refresh());
    const refreshRequest = http.expectOne(req => req.url.endsWith('/auth/refresh'));
    const logout = firstValueFrom(auth.logout());
    await Promise.resolve();
    http.expectOne(req => req.url.endsWith('/auth/logout')).flush({success:true,data:{}});
    await logout;
    refreshRequest.flush({success:true,data:session});
    await expectAsync(refresh).toBeRejected();
    expect(storage.setRefreshToken).not.toHaveBeenCalled();
    expect(auth.isAuthenticated()).toBeFalse();
  });
});