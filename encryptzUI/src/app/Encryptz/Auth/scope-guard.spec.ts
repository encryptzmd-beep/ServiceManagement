import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from './auth-service';
import { scopeGuard } from './guard-guard';
import { ScopeState } from './scope-flow';

describe('scopeGuard', () => {
  const run = (scope: ScopeState, data: Record<string, unknown> = {}) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { scopeState: () => scope } }],
    });
    const route = { data } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => scopeGuard(route, {} as RouterStateSnapshot));
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  };

  const full: ScopeState = { loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9 };

  it('lets a fully scoped session into a business page', () => {
    expect(run(full)).toBe(true);
  });

  it('sends a session with only a company to the module screen', () => {
    expect(run({ ...full, moduleKey: null, locationId: null })).toBe('/select-module');
  });

  it('sends a session without a branch to the branch screen', () => {
    expect(run({ ...full, locationId: null })).toBe('/select-branch');
  });

  it('sends a session without a company to the company screen', () => {
    expect(run({ ...full, companyId: null })).toBe('/select-company');
  });

  it('sends a visitor to login', () => {
    expect(run({ ...full, loggedIn: false })).toBe('/login');
  });

  it('lets a session with only a company into a company-only page', () => {
    expect(run({ ...full, moduleKey: null, locationId: null }, { scope: 'company' })).toBe(true);
  });

  it('still asks for a company on a company-only page', () => {
    expect(run({ ...full, companyId: null }, { scope: 'company' })).toBe('/select-company');
  });
});
