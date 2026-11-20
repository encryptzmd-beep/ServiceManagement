import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { CrmService } from './crm-service';

describe('CrmService', () => {
  let service: CrmService;
  let http: HttpTestingController;
  const api = environment.apiUrl + '/api/crm';

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CrmService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the lead list with the filter as query parameters, leaving out the empty ones', () => {
    service.getLeads({ search: 'ravi', status: 'New,Contacted', ownerUserId: 4, sourceId: undefined, page: 2, pageSize: 25 }).subscribe();
    const req = http.expectOne(r => r.url === `${api}/leads`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('ravi');
    expect(req.request.params.get('status')).toBe('New,Contacted');
    expect(req.request.params.get('ownerUserId')).toBe('4');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('sourceId')).toBe(false);
    req.flush({ success: true, message: '', data: { items: [], totalCount: 0, pageNumber: 2, pageSize: 25, totalPages: 0 } });
  });

  it('posts the convert request to the lead', () => {
    service.convert(5, { quotationId: 9, customerId: null, orderDate: '2026-11-18', paymentMode: 'Cash' }).subscribe();
    const req = http.expectOne(`${api}/leads/5/convert`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.quotationId).toBe(9);
    req.flush({ success: true, message: '' });
  });

  it('asks who the caller is', () => {
    service.me().subscribe();
    const req = http.expectOne(`${api}/me`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { userId: 1, fullName: 'A', isManager: true } });
  });

  it('reaches every other route of the controller', () => {
    const calls: [() => any, string, string][] = [
      [() => service.getLead(3), 'GET', `${api}/leads/3`],
      [() => service.saveLead({} as any), 'POST', `${api}/leads`],
      [() => service.changeStatus(3, { status: 'Lost' }), 'POST', `${api}/leads/3/status`],
      [() => service.reassign(3, { ownerUserId: 2 }), 'POST', `${api}/leads/3/reassign`],
      [() => service.addFollowUp(3, {} as any), 'POST', `${api}/leads/3/follow-ups`],
      [() => service.linkOrder(3, { orderNo: 'SO-1' }), 'POST', `${api}/leads/3/link-order`],
      [() => service.saveQuotation({} as any), 'POST', `${api}/quotations`],
      [() => service.getQuotation(7), 'GET', `${api}/quotations/7`],
      [() => service.reviseQuotation(7), 'POST', `${api}/quotations/7/revise`],
      [() => service.setQuotationStatus(7, 'Sent'), 'POST', `${api}/quotations/7/status`],
      [() => service.getMasters('sources'), 'GET', `${api}/masters/sources`],
      [() => service.saveMaster('sources', { id: 0, name: 'x', sortOrder: 1, isActive: true }), 'POST', `${api}/masters/sources`],
      [() => service.getMembers(), 'GET', `${api}/members`],
      [() => service.saveMember({ userId: 1, fullName: 'A', isManager: false, isActive: true }), 'POST', `${api}/members`],
      [() => service.getDashboard(), 'GET', `${api}/dashboard`],
    ];
    for (const [call, method, url] of calls) {
      call().subscribe();
      const req = http.expectOne(url);
      expect(req.request.method).toBe(method);
      req.flush({ success: true, message: '' });
    }
  });

  it('sends the quotation id as a query parameter on the convert preview, and the term on the product search', () => {
    service.previewConvert(5, 9).subscribe();
    let req = http.expectOne(r => r.url === `${api}/leads/5/convert-preview`);
    expect(req.request.params.get('quotationId')).toBe('9');
    req.flush({ success: true, message: '' });

    service.searchProducts('fan').subscribe();
    req = http.expectOne(r => r.url === `${api}/products`);
    expect(req.request.params.get('term')).toBe('fan');
    req.flush({ success: true, message: '' });

    service.searchProducts(undefined, 'Treadmill').subscribe();
    req = http.expectOne(r => r.url === `${api}/products`);
    expect(req.request.params.has('term')).toBe(false);
    expect(req.request.params.get('category')).toBe('Treadmill');
    req.flush({ success: true, message: '' });

    service.searchProducts(undefined, 'Treadmill', 100).subscribe();
    req = http.expectOne(r => r.url === `${api}/products`);
    expect(req.request.params.get('top')).toBe('100');
    req.flush({ success: true, message: '' });

    service.productCategories().subscribe();
    http.expectOne(`${api}/product-categories`).flush({ success: true, message: '', data: [] });
  });

  it('reads the reports with their filters', () => {
    service.followUpReport({ from: '2026-11-01', to: '2026-11-18', ownerUserId: 3 }).subscribe();
    let req = http.expectOne(r => r.url === `${api}/reports/follow-ups`);
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.get('ownerUserId')).toBe('3');
    req.flush({ success: true, message: '' });

    service.conversionReport({ groupBy: 'source' }).subscribe();
    req = http.expectOne(r => r.url === `${api}/reports/conversion`);
    expect(req.request.params.get('groupBy')).toBe('source');
    expect(req.request.params.has('from')).toBe(false);
    req.flush({ success: true, message: '' });
  });

  it('reads the board, with the owner only when set', () => {
    service.getBoard(7).subscribe();
    let req = http.expectOne(r => r.url === `${api}/board`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('ownerUserId')).toBe('7');
    req.flush({ success: true, message: '' });

    service.getBoard().subscribe();
    req = http.expectOne(r => r.url === `${api}/board`);
    expect(req.request.params.has('ownerUserId')).toBe(false);
    req.flush({ success: true, message: '' });
  });

  it('reads the quotation list with the filter as query parameters', () => {
    service.getQuotations({ search: 'QT', page: 2 }).subscribe();
    const req = http.expectOne(r => r.url === `${api}/quotations`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('search')).toBe('QT');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ success: true, message: '', data: { items: [], totalCount: 0, pageNumber: 2, pageSize: 25, totalPages: 0 } });
  });

  it('reads the pipeline report, with the owner only when set', () => {
    service.pipelineReport(3).subscribe();
    let req = http.expectOne(r => r.url === `${api}/reports/pipeline`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('ownerUserId')).toBe('3');
    req.flush({ success: true, message: '' });

    service.pipelineReport().subscribe();
    req = http.expectOne(r => r.url === `${api}/reports/pipeline`);
    expect(req.request.params.keys().length).toBe(0);
    req.flush({ success: true, message: '' });
  });

  it('reads the sources report with its dates', () => {
    service.sourcesReport({ from: '2026-11-01' }).subscribe();
    const req = http.expectOne(r => r.url === `${api}/reports/sources`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('from')).toBe('2026-11-01');
    expect(req.request.params.has('to')).toBe(false);
    req.flush({ success: true, message: '' });
  });

  it('reads the team report with its filter', () => {
    service.teamReport({ from: '2026-11-01', to: '2026-11-18', ownerUserId: 4 }).subscribe();
    const req = http.expectOne(r => r.url === `${api}/reports/team`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('to')).toBe('2026-11-18');
    expect(req.request.params.get('ownerUserId')).toBe('4');
    req.flush({ success: true, message: '' });
  });

  it('reads the lost reasons report with its filter', () => {
    service.lostReasonsReport({ to: '2026-11-18' }).subscribe();
    const req = http.expectOne(r => r.url === `${api}/reports/lost-reasons`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('to')).toBe('2026-11-18');
    expect(req.request.params.has('ownerUserId')).toBe(false);
    req.flush({ success: true, message: '' });
  });
});
