import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth-service';

describe('AuthService scope', () => {
  let http: HttpTestingController;

  const create = (): AuthService => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    return TestBed.inject(AuthService);
  };

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('has no scope for a fresh browser', () => {
    const auth = create();
    expect(auth.scopeState()).toEqual({ loggedIn: false, companyId: null, moduleKey: null, locationId: null });
  });

  it('keeps a session that the previous UI scoped', () => {
    localStorage.setItem('encryptz_token', 't');
    localStorage.setItem('encryptz_user', JSON.stringify({
      token: 't', fullName: 'A', role: 'Technician', userId: 5, menus: [],
      companyId: 1, projectId: 1, projectKey: 'C001-P001', locationId: 2,
    }));
    localStorage.setItem('selected_company_id', '1');
    localStorage.setItem('selected_location_id', '2');

    const auth = create();

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 1, moduleKey: 'SERVICE', locationId: 2 });
  });

  it('asks the API for the modules of the selected company', () => {
    const auth = create();
    let names: string[] = [];
    auth.getModules().subscribe(res => names = (res.data || []).map(m => m.moduleName));

    const req = http.expectOne(r => r.url.endsWith('/api/auth/modules'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: [{ moduleId: 1, moduleKey: 'SERVICE', moduleName: 'Service Management', description: '', icon: 'build', sortOrder: 1, state: 'Available' }] });

    expect(names).toEqual(['Service Management']);
  });

  it('asks for the branches of a module', () => {
    const auth = create();
    auth.getBranches('SERVICE').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/locations'));
    expect(req.request.params.get('moduleKey')).toBe('SERVICE');
    req.flush({ success: true, message: '', data: [] });
  });

  it('stores the module and the branch when the scope is set', () => {
    localStorage.setItem('selected_company_id', '2');
    const auth = create();

    auth.setScope('SERVICE', 9, 'Elankulam').subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/set-scope'));
    expect(req.request.body).toEqual({ companyId: 2, moduleKey: 'SERVICE', locationId: 9 });
    req.flush({ success: true, message: '', data: {
      token: 'scoped', fullName: 'A', role: 'Admin', userId: 5, menus: [],
      companyId: 2, projectId: 2, projectKey: 'C002-P001', moduleKey: 'SERVICE', locationId: 9,
    } });

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 2, moduleKey: 'SERVICE', locationId: 9 });
    expect(auth.selectedLocationName()).toBe('Elankulam');
    expect(localStorage.getItem('encryptz_token')).toBe('scoped');
    expect(localStorage.getItem('selected_module_key')).toBe('SERVICE');
  });

  it('does not store anything when the scope is refused', () => {
    localStorage.setItem('selected_company_id', '2');
    const auth = create();

    auth.setScope('SERVICE', 9).subscribe();
    http.expectOne(r => r.url.endsWith('/api/auth/set-scope'))
      .flush({ success: false, message: 'You don\'t have access to this module. Ask your administrator', data: null });

    expect(auth.selectedModuleKey()).toBeNull();
    expect(localStorage.getItem('selected_module_key')).toBeNull();
  });

  it('forgets the module and the branch when another company is selected', () => {
    localStorage.setItem('encryptz_token', 't');
    localStorage.setItem('encryptz_user', JSON.stringify({ token: 't', fullName: 'A', role: 'Admin', userId: 5, menus: [] }));
    localStorage.setItem('selected_company_id', '1');
    localStorage.setItem('selected_module_key', 'SERVICE');
    localStorage.setItem('selected_location_id', '2');
    localStorage.setItem('selected_location_name', 'Main');
    const auth = create();

    auth.selectCompany(2).subscribe();
    http.expectOne(r => r.url.endsWith('/api/auth/select-company')).flush({ success: true, message: '', data: {
      token: 'company', fullName: 'A', role: 'Admin', userId: 5, menus: [],
      companyId: 2, projectId: 0, projectKey: '', moduleKey: '', locationId: 0,
    } });

    expect(auth.scopeState()).toEqual({ loggedIn: true, companyId: 2, moduleKey: null, locationId: null });
    expect(auth.selectedLocationName()).toBe('');
    expect(localStorage.getItem('selected_module_key')).toBeNull();
    expect(localStorage.getItem('selected_location_id')).toBeNull();
  });

  it('clears the scope on logout', () => {
    localStorage.setItem('selected_module_key', 'SERVICE');
    localStorage.setItem('selected_location_name', 'Main');
    const auth = create();

    auth.clearSession();

    expect(localStorage.getItem('selected_module_key')).toBeNull();
    expect(localStorage.getItem('selected_location_name')).toBeNull();
    expect(auth.selectedModuleKey()).toBeNull();
  });
});
