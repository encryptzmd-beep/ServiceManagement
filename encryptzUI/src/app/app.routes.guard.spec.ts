import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './Encryptz/Auth/auth-service';
import { ScopeState } from './Encryptz/Auth/scope-flow';
import { routes } from './app.routes';

describe('route guards with the real routes', () => {
  const full: ScopeState = { loggedIn: true, companyId: 1, moduleKey: 'SERVICE', locationId: 2 };
  const companyOnly: ScopeState = { loggedIn: true, companyId: 1, moduleKey: null, locationId: null };
  const loggedOut: ScopeState = { loggedIn: false, companyId: null, moduleKey: null, locationId: null };

  const urlAfter = async (state: ScopeState, target: string) => {
    const auth = {
      isLoggedIn: () => state.loggedIn,
      scopeState: () => state,
      userRole: () => 'Admin',
      hasAccess: () => true,
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter(routes), { provide: AuthService, useValue: auth }],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(target);
    return router.url;
  };

  it('sends a session with only a company from a business page to the module step', async () => {
    expect(await urlAfter(companyOnly, '/complaints/dashboard')).toBe('/select-module');
  });

  it('lets a session with only a company open a company-only page', async () => {
    expect(await urlAfter(companyOnly, '/profile')).toBe('/profile');
  });

  it('lets a fully scoped session reach a business page', async () => {
    expect(await urlAfter(full, '/complaints/dashboard')).toBe('/complaints/dashboard');
  });

  it('sends a logged-out visitor to the login page', async () => {
    expect(await urlAfter(loggedOut, '/complaints/dashboard')).toBe('/login');
  });
});
