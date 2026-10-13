import {
  branchDecision, landingRouteForRole, legacyModuleKey, moduleCaption,
  nextScopeStep, routeForStep, ScopeState,
} from './scope-flow';

const state = (over: Partial<ScopeState> = {}): ScopeState => ({
  loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9, ...over,
});

describe('nextScopeStep', () => {
  it('sends a visitor to login', () => {
    expect(nextScopeStep(state({ loggedIn: false }))).toBe('login');
    expect(nextScopeStep(state({ loggedIn: false }), 'company')).toBe('login');
  });

  it('asks for a company first', () => {
    expect(nextScopeStep(state({ companyId: null }))).toBe('company');
    expect(nextScopeStep(state({ companyId: 0 }))).toBe('company');
  });

  it('asks for a module once a company is chosen', () => {
    expect(nextScopeStep(state({ moduleKey: null, locationId: null }))).toBe('module');
    expect(nextScopeStep(state({ moduleKey: '', locationId: 9 }))).toBe('module');
  });

  it('asks for a branch once a module is chosen', () => {
    expect(nextScopeStep(state({ locationId: null }))).toBe('branch');
    expect(nextScopeStep(state({ locationId: 0 }))).toBe('branch');
  });

  it('is ready with company, module and branch', () => {
    expect(nextScopeStep(state())).toBe('ready');
  });

  it('needs only a company for a company-only page', () => {
    expect(nextScopeStep(state({ moduleKey: null, locationId: null }), 'company')).toBe('ready');
    expect(nextScopeStep(state({ companyId: null }), 'company')).toBe('company');
  });

  it('a page that needs no scope is ready for anyone who is logged in', () => {
    expect(nextScopeStep(state({ companyId: null, moduleKey: null, locationId: null }), 'none')).toBe('ready');
    expect(nextScopeStep(state({ loggedIn: false }), 'none')).toBe('login');
  });
});

describe('routeForStep', () => {
  it('maps each step to its route', () => {
    expect(routeForStep('login')).toBe('/login');
    expect(routeForStep('company')).toBe('/select-company');
    expect(routeForStep('module')).toBe('/select-module');
    expect(routeForStep('branch')).toBe('/select-branch');
  });
});

describe('moduleCaption', () => {
  it('explains why a module is disabled', () => {
    expect(moduleCaption('Available')).toBe('');
    expect(moduleCaption('NotSubscribed')).toBe('Not subscribed');
    expect(moduleCaption('NoAccess')).toBe('Ask your administrator');
  });
});

describe('legacyModuleKey', () => {
  it('treats a session scoped by the previous UI as the Service module', () => {
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 2 })).toBe('SERVICE');
  });

  it('keeps the module of a session scoped by this UI', () => {
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 2, moduleKey: 'SALES' })).toBe('SALES');
  });

  it('gives nothing for a session that was never scoped', () => {
    expect(legacyModuleKey(null)).toBeNull();
    expect(legacyModuleKey({})).toBeNull();
    expect(legacyModuleKey({ projectKey: '', locationId: 0 })).toBeNull();
    expect(legacyModuleKey({ projectKey: 'C001-P001', locationId: 0 })).toBeNull();
    expect(legacyModuleKey({ projectKey: '', locationId: 2 })).toBeNull();
  });
});

describe('branchDecision', () => {
  it('skips the screen for exactly one branch', () => {
    expect(branchDecision(1)).toBe('auto');
  });

  it('shows the list for several and a message for none', () => {
    expect(branchDecision(2)).toBe('choose');
    expect(branchDecision(7)).toBe('choose');
    expect(branchDecision(0)).toBe('none');
  });
});

describe('landingRouteForRole', () => {
  it('opens the work orders for a technician and spare parts for a storekeeper', () => {
    expect(landingRouteForRole('Technician')).toBe('/technicians/work-orders');
    expect(landingRouteForRole('Storekeeper')).toBe('/spare-parts');
  });

  it('opens the dashboard for everyone else', () => {
    expect(landingRouteForRole('Admin')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('CompanyAdmin')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('Manager')).toBe('/complaints/dashboard');
    expect(landingRouteForRole('')).toBe('/complaints/dashboard');
  });
});
