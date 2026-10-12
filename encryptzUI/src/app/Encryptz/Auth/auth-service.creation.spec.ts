import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth-service';

describe('AuthService company creation', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  it('asks whether the user may create a company', () => {
    let answer: any;
    service.getCompanyCreation().subscribe(res => (answer = res));

    const req = http.expectOne(r => r.url.endsWith('/api/auth/company-creation'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { canCreate: true, created: 0, limit: 1, message: '' } });

    expect(answer.data.canCreate).toBe(true);
  });

  it('creates a company with trimmed values and an upper-case code, and never sends who creates it', () => {
    service.createCompany({ companyName: '  Hamster A/C ', companyCode: ' ham1 ', firstBranchName: ' Main ', address: '', city: ' Kochi ', phoneNumber: '' }).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/create-company'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ companyName: 'Hamster A/C', companyCode: 'HAM1', firstBranchName: 'Main', address: '', city: 'Kochi', phoneNumber: '' });
    req.flush({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } });
  });

  it('retries the set-up of one company', () => {
    service.retryProvision(9).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/companies/9/retry-provision'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'ok', data: true });
  });
});
