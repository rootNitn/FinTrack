import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { SESSION_VAULT, SessionVaultPlugin, TokenStorageService } from './token-storage.service';

describe('TokenStorageService native vault', () => {
  let storage: TokenStorageService;
  let vault: jasmine.SpyObj<SessionVaultPlugin>;
  let native: jasmine.Spy;
  beforeEach(() => {
    vault = jasmine.createSpyObj('SessionVault', ['readRefreshToken', 'writeRefreshToken', 'clear']);
    vault.readRefreshToken.and.resolveTo({ token: 'saved-token' });
    vault.writeRefreshToken.and.resolveTo();
    vault.clear.and.resolveTo();
    native = spyOn(Capacitor, 'isNativePlatform').and.returnValue(true);
    TestBed.configureTestingModule({ providers: [TokenStorageService, { provide: SESSION_VAULT, useValue: vault }] });
    storage = TestBed.inject(TokenStorageService);
    localStorage.removeItem('pft.refreshToken');
  });
  afterEach(() => localStorage.removeItem('pft.refreshToken'));
  it('loads native credentials without using WebView persistence', async () => {
    await storage.initialize();
    expect(storage.getRefreshToken()).toBe('saved-token');
    expect(localStorage.getItem('pft.refreshToken')).toBeNull();
  });
  it('does not publish a credential before secure persistence completes', async () => {
    let complete!: () => void;
    vault.writeRefreshToken.and.returnValue(new Promise<void>(resolve => { complete = resolve; }));
    const write = storage.setRefreshToken('rotated-token');
    expect(storage.getRefreshToken()).toBeNull();
    complete();
    await write;
    expect(storage.getRefreshToken()).toBe('rotated-token');
    expect(localStorage.getItem('pft.refreshToken')).toBeNull();
  });
  it('a failed native write does not publish the new credential', async () => {
    vault.writeRefreshToken.and.callFake(async () => { throw new Error('storage failed'); });
    await expectAsync(storage.setRefreshToken('unsaved')).toBeRejected();
    expect(storage.getRefreshToken()).toBeNull();
  });
  it('serializes clear after a pending write and does not resurrect memory state', async () => {
    let complete!: () => void;
    vault.writeRefreshToken.and.returnValue(new Promise<void>(resolve => { complete = resolve; }));
    const write = storage.setRefreshToken('pending');
    const clear = storage.clear();
    complete();
    await Promise.all([write, clear]);
    expect(vault.clear).toHaveBeenCalledTimes(1);
    expect(storage.getRefreshToken()).toBeNull();
    expect(storage.getAccessToken()).toBeNull();
  });
  it('keeps browser persistence unchanged', async () => {
    native.and.returnValue(false);
    await storage.setRefreshToken('browser-token');
    expect(localStorage.getItem('pft.refreshToken')).toBe('browser-token');
    expect(vault.writeRefreshToken).not.toHaveBeenCalled();
  });
});