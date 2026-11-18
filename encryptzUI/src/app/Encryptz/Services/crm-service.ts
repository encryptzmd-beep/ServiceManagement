import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, PagedResult } from '../Models/ApiModels';
import {
  ConversionReportFilter, ConvertPreviewDto, ConvertRequestDto, ConvertResultDto, CrmConversionRowDto,
  CrmDashboardDto, CrmFollowUpReportRowDto, CrmMasterDto, CrmMasterKind, CrmMe, CrmMemberDto, CrmMemberListDto,
  CrmProductDto, FollowUpReportFilter, FollowUpSaveDto, LeadDetailDto, LeadFilterDto, LeadListDto, LeadSaveDto,
  LinkOrderDto, QuotationDto, QuotationSaveDto, ReassignDto, StatusChangeDto,
} from '../Models/CrmModels';

/** CRM Lead Management. One method per action of CrmController; company, branch and person come from the token. */
@Injectable({ providedIn: 'root' })
export class CrmService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/crm`;

  /** Query parameters without the empty values. */
  private params(source: object): HttpParams {
    let p = new HttpParams();
    for (const [key, value] of Object.entries(source)) {
      if (value !== undefined && value !== null && value !== '') p = p.set(key, String(value));
    }
    return p;
  }

  me(): Observable<ApiResponse<CrmMe>> {
    return this.http.get<ApiResponse<CrmMe>>(`${this.base}/me`);
  }

  getLeads(filter: LeadFilterDto = {}): Observable<ApiResponse<PagedResult<LeadListDto>>> {
    return this.http.get<ApiResponse<PagedResult<LeadListDto>>>(`${this.base}/leads`, { params: this.params(filter) });
  }

  getLead(id: number): Observable<ApiResponse<LeadDetailDto>> {
    return this.http.get<ApiResponse<LeadDetailDto>>(`${this.base}/leads/${id}`);
  }

  saveLead(dto: LeadSaveDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads`, dto);
  }

  changeStatus(id: number, dto: StatusChangeDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads/${id}/status`, dto);
  }

  reassign(id: number, dto: ReassignDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads/${id}/reassign`, dto);
  }

  addFollowUp(id: number, dto: FollowUpSaveDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads/${id}/follow-ups`, dto);
  }

  previewConvert(id: number, quotationId: number): Observable<ApiResponse<ConvertPreviewDto>> {
    return this.http.get<ApiResponse<ConvertPreviewDto>>(`${this.base}/leads/${id}/convert-preview`,
      { params: this.params({ quotationId }) });
  }

  convert(id: number, dto: ConvertRequestDto): Observable<ApiResponse<ConvertResultDto>> {
    return this.http.post<ApiResponse<ConvertResultDto>>(`${this.base}/leads/${id}/convert`, dto);
  }

  linkOrder(id: number, dto: LinkOrderDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads/${id}/link-order`, dto);
  }

  /** A manager frees the convert marker of a lead flagged for a check of the sales orders. */
  cancelConvert(id: number): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/leads/${id}/cancel-convert`, {});
  }

  saveQuotation(dto: QuotationSaveDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/quotations`, dto);
  }

  getQuotation(id: number): Observable<ApiResponse<QuotationDto>> {
    return this.http.get<ApiResponse<QuotationDto>>(`${this.base}/quotations/${id}`);
  }

  reviseQuotation(id: number): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/quotations/${id}/revise`, {});
  }

  setQuotationStatus(id: number, status: string): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/quotations/${id}/status`, { status });
  }

  searchProducts(term?: string): Observable<ApiResponse<CrmProductDto[]>> {
    return this.http.get<ApiResponse<CrmProductDto[]>>(`${this.base}/products`, { params: this.params({ term }) });
  }

  getMasters(kind: CrmMasterKind | string): Observable<ApiResponse<CrmMasterDto[]>> {
    return this.http.get<ApiResponse<CrmMasterDto[]>>(`${this.base}/masters/${kind}`);
  }

  saveMaster(kind: CrmMasterKind | string, dto: CrmMasterDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/masters/${kind}`, dto);
  }

  getMembers(): Observable<ApiResponse<CrmMemberListDto>> {
    return this.http.get<ApiResponse<CrmMemberListDto>>(`${this.base}/members`);
  }

  saveMember(dto: CrmMemberDto): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.base}/members`, dto);
  }

  getDashboard(): Observable<ApiResponse<CrmDashboardDto>> {
    return this.http.get<ApiResponse<CrmDashboardDto>>(`${this.base}/dashboard`);
  }

  followUpReport(filter: FollowUpReportFilter = {}): Observable<ApiResponse<CrmFollowUpReportRowDto[]>> {
    return this.http.get<ApiResponse<CrmFollowUpReportRowDto[]>>(`${this.base}/reports/follow-ups`,
      { params: this.params(filter) });
  }

  conversionReport(filter: ConversionReportFilter = {}): Observable<ApiResponse<CrmConversionRowDto[]>> {
    return this.http.get<ApiResponse<CrmConversionRowDto[]>>(`${this.base}/reports/conversion`,
      { params: this.params(filter) });
  }
}
