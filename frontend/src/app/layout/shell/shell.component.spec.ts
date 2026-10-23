/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../features/settings/settings.service';

import { ShellComponent } from './shell.component';

describe('ShellComponent', () => {
  let component: ShellComponent;
  let fixture: ComponentFixture<ShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AuthService, useValue: { isAdmin: () => false, currentUser: () => null, planTier: () => 'FREE', logout: () => of({}) } },
        { provide: SettingsService, useValue: { get: () => of({ currency: 'INR' }) } },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(ShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('toggles Finance and More destination panels', () => {
    component.toggleMobileMenu('finance');
    expect(component.mobileMenu()).toBe('finance');

    component.toggleMobileMenu('more');
    expect(component.mobileMenu()).toBe('more');

    component.toggleMobileMenu('more');
    expect(component.mobileMenu()).toBeNull();
  });

  it('highlights nested routes and closes the destination panel', () => {
    component.activeUrl.set('/credit-cards/123');
    component.toggleMobileMenu('finance');

    expect(component.isFinanceActive()).toBeTrue();
    expect(component.isMoreActive()).toBeFalse();

    component.closeMobileMenu();
    expect(component.mobileMenu()).toBeNull();
  });
});
