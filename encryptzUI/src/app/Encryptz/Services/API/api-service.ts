import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../../environments/environment.development';
import * as M from '../../Models/ApiModels';
import { Observable } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';


@Injectable({ providedIn: 'root' })
export class ApiService {
  private api = environment.apiUrl + '/api';
  private auth = inject(AuthService);
  constructor(private http: HttpClient) {}

   get<T>(endpoint: string, params?: any): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
          httpParams = httpParams.set(key, params[key]);
        }
      });
    }
    return this.http.get<T>(`${this.api}/${endpoint}`, { params: httpParams });
  }

  updateRepairStatus(repairRequestId: number, status: string, notes?: string): Observable<any> {
    return this.http.patch(`${this.api}/RepairPart/request/${repairRequestId}/status`, { status, notes });
  }

 post<T>(endpoint: string, body: any): Observable<T> {
    return this.http.post<T>(`${this.api}/${endpoint}`, body);
  }

  put<T>(endpoint: string, body: any): Observable<T> {
    return this.http.put<T>(`${this.api}/${endpoint}`, body);
  }

  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.api}/${endpoint}`);
  }
  // --- Customer ---
  getProfile(): Observable<M.ApiResponse<M.Customer>> {
    return this.http.get<M.ApiResponse<M.Customer>>(`${this.api}/customer/profile`);
  }

  updateProfile(data: M.CustomerCreate): Observable<M.ApiResponse> {
    return this.http.put<M.ApiResponse>(`${this.api}/customer/profile`, data);
  }

  // getProducts(): Observable<M.ApiResponse<M.Product[]>> {
  //   return this.http.get<M.ApiResponse<M.Product[]>>(`${this.api}/customer/products`);
  // }

  // addProduct(data: M.ProductCreate): Observable<M.ApiResponse<number>> {
  //   return this.http.post<M.ApiResponse<number>>(`${this.api}/customer/products`, data);
  // }

  // uploadProductImage(productId: number, file: File, imageType: string): Observable<M.ApiResponse<string>> {
  //   const fd = new FormData();
  //   fd.append('file', file);
  //   fd.append('imageType', imageType);
  //   return this.http.post<M.ApiResponse<string>>(`${this.api}/customer/products/${productId}/images`, fd);
  // }

  // // --- Complaints ---
  // createComplaint(data: M.ComplaintCreate): Observable<M.ApiResponse<M.Complaint>> {
  //   return this.http.post<M.ApiResponse<M.Complaint>>(`${this.api}/complaint`, data);
  // }

  getComplaints(filter: M.ComplaintFilter): Observable<M.PagedResult<M.ComplaintListItem>> {
    let params = new HttpParams()
      .set('pageNumber', filter.pageNumber)
      .set('pageSize', filter.pageSize);
    if (filter.statusId) params = params.set('statusId', filter.statusId);
    if (filter.priority) params = params.set('priority', filter.priority);
    if (filter.fromDate) params = params.set('fromDate', filter.fromDate);
    if (filter.toDate) params = params.set('toDate', filter.toDate);
    return this.http.get<M.PagedResult<M.ComplaintListItem>>(`${this.api}/complaint`, { params });
  }

  getComplaint(id: number): Observable<M.ApiResponse<M.Complaint>> {
    return this.http.get<M.ApiResponse<M.Complaint>>(`${this.api}/complaint/${id}`);
  }

  updateComplaintStatus(id: number, statusId: number, remarks?: string): Observable<M.ApiResponse> {
    return this.http.put<M.ApiResponse>(`${this.api}/complaint/${id}/status`, { statusId, remarks });
  }

  confirmClosure(id: number): Observable<M.ApiResponse> {
    return this.http.post<M.ApiResponse>(`${this.api}/complaint/${id}/confirm-closure`, {});
  }

  // getMyComplaints(): Observable<M.Complaint[]> {
  //   return this.http.get<M.Complaint[]>(`${this.api}/complaint/my-complaints`);
  // }
 getMyComplaintsCustomerPortal(statusFilter?: number, page: number = 1, size: number = 10): Observable<M.PagedResponse<M.CustomerComplaint>> {
    return this.get<M.PagedResponse<M.CustomerComplaint>>('CustomerPortal/complaints', { statusFilter, page, size });
  }
  // uploadComplaintImage(complaintId: number, file: File): Observable<M.ApiResponse<string>> {
  //   const fd = new FormData();
  //   fd.append('file', file);
  //   return this.http.post<M.ApiResponse<string>>(`${this.api}/complaint/${complaintId}/images`, fd);
  // }

  // --- Technician ---
  // Angular service
getTechnicians(filter?: any): Observable<M.ApiResponse<M.PagedResponse<M.TechnicianListItem>>> {
  let params: any = {
    pageNumber: filter?.pageNumber || 1,
    pageSize: filter?.pageSize || 100
  };
  if (filter?.searchTerm) params.searchTerm = filter.searchTerm;
  if (filter?.statusFilter) params.statusFilter = filter.statusFilter;

  return this.http.get<M.ApiResponse<M.PagedResponse<M.TechnicianListItem>>>(`${this.api}/technician`, { params });
}

  getWorkOrders(technicianId: number): Observable<M.WorkOrder[]> {
    return this.http.get<M.WorkOrder[]>(`${this.api}/technician/${technicianId}/work-orders`);
  }

 updateServiceStatus(data: {
  AssignmentId: number;
  Status: string;
  remarks?: string;
  WorkDone?: string;
  PartsUsed?: string;
  CustomerFeedback?: string;
}): Observable<M.ApiResponse> {
  return this.http.post<M.ApiResponse>(`${this.api}/technician/update-status`, data);
}

  assignTechnician(data: M.AssignTechnician): Observable<M.ApiResponse<number>> {
    return this.http.post<M.ApiResponse<number>>(`${this.api}/technician/assign`, data);
  }

  getAuditLog(complaintId: number): Observable<M.AuditLog[]> {
    return this.http.get<M.AuditLog[]>(`${this.api}/technician/audit-log/${complaintId}`);
  }





  approveSpareRequest(id: number): Observable<M.ApiResponse> {
    return this.http.put<M.ApiResponse>(`${this.api}/technician/spare-requests/${id}/approve`, {});
  }

  // uploadServiceImage(techId: number, complaintId: number, file: File, imageType: string): Observable<M.ApiResponse<string>> {
  //   const fd = new FormData();
  //   fd.append('file', file);
  //   fd.append('complaintId', complaintId.toString());
  //   fd.append('imageType', imageType);
  //   return this.http.post<M.ApiResponse<string>>(`${this.api}/technician/${techId}/service-images`, fd);
  // }
uploadServiceImage(technicianId: number, formData: FormData): Observable<any> {
  return this.http.post(`${this.api}/technicians/${technicianId}/upload-image`, formData);
}

  // --- Warranty ---
  getWarrantyReturns(): Observable<M.WarrantyReturn[]> {
    return this.http.get<M.WarrantyReturn[]>(`${this.api}/warranty`);
  }

  createWarrantyReturn(data: { complaintId: number; sparePartId: number; oldPartSerialNumber?: string }): Observable<M.ApiResponse> {
    return this.http.post<M.ApiResponse>(`${this.api}/warranty`, data);
  }

//   // --- Tracking ---
//   checkIn(technicianId: number, data: { latitude: number; longitude: number; address?: string }): Observable<M.ApiResponse<number>> {
//     return this.http.post<M.ApiResponse<number>>(`${this.api}/Tracking/checkin`, data);
//   }

//   checkOut(technicianId: number, data: { latitude: number; longitude: number; address?: string }): Observable<M.ApiResponse> {
//     return this.http.post<M.ApiResponse>(`${this.api}/tracking/${technicianId}/checkout`, data);
//   }
// recordSiteArrival(
//   technicianId: number,
//   data: {
//     complaintId: number;
//     latitude: number;
//     longitude: number;
//     address?: string;
//   }
// ): Observable<M.ApiResponse> {
//   return this.http.post<M.ApiResponse>(
//     `${this.api}/tracking/${technicianId}/site-arrival`,
//     data
//   );
// }
//   getAttendance(technicianId?: number, fromDate?: string, toDate?: string): Observable<M.Attendance[]> {
//   let params = new HttpParams();

//   if (technicianId) params = params.set('technicianId', technicianId);
//   if (fromDate) params = params.set('fromDate', fromDate);
//   if (toDate) params = params.set('toDate', toDate);

//   return this.http.get<M.Attendance[]>(`${this.api}/tracking/attendance`, { params });
// }
  getGeoTrail(technicianId: number, date: string): Observable<M.GeoTrack[]> {
    return this.http.get<M.GeoTrack[]>(`${this.api}/tracking/${technicianId}/geo-trail`, { params: { date } });
  }

  // getTravelReport(from: string, to: string): Observable<M.TravelReport[]> {
  //   return this.http.get<M.TravelReport[]>(`${this.api}/tracking/travel-report`, { params: { from, to } });
  // }

  // --- Schedule ---
  createSchedule(data: M.ScheduleCreate): Observable<M.ApiResponse<M.Schedule>> {
    return this.http.post<M.ApiResponse<M.Schedule>>(`${this.api}/schedule`, data);
  }

  getTechnicianSchedule(technicianId: number, date?: string): Observable<M.Schedule[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<M.Schedule[]>(`${this.api}/schedule/technician/${technicianId}`, { params });
  }

  getScheduleConflicts(date?: string): Observable<M.Schedule[]> {
    let params = new HttpParams();
    if (date) params = params.set('date', date);
    return this.http.get<M.Schedule[]>(`${this.api}/schedule/conflicts`, { params });
  }

  getDailySchedule(date: string): Observable<M.Schedule[]> {
    return this.http.get<M.Schedule[]>(`${this.api}/schedule/daily/${date}`);
  }

  // --- Reports ---
  getDashboard(): Observable<M.DashboardSummary> {
    return this.http.get<M.DashboardSummary>(`${this.api}/report/dashboard`);
  }

 getSlaCompliance(fromDate: string, toDate: string) {
  return this.http.get(`${this.api}/report/sla-compliance`, {
    params: {
      startDate: fromDate,
      endDate: toDate
    }
  });
}

  getProductivityReport(from: string, to: string): Observable<M.ProductivityReport[]> {
  return this.http.get<M.ProductivityReport[]>(
    `${this.api}/report/productivity`,
    {
      params: {
        startDate: from,
        endDate: to
      }
    }
  );
}
   getStats(roleId?: number, technicianId?: number): Observable<M.DashboardResponse> {
    return this.get<M.DashboardResponse>('Dashboard/stats', { roleId, technicianId });
  }

  getChartData(days: number = 30): Observable<M.DashboardChartData> {
    return this.get<M.DashboardChartData>('Dashboard/charts', { days });
  }
 getAll(group?: string): Observable<M.SystemSetting[]> {
    return this.get<M.SystemSetting[]>('Settings', { group });
  }

  update(dto: M.SettingUpdateDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('Settings', dto);
  }

  bulkUpdate(settings: M.SettingUpdateDto[]): Observable<M.ApiResponse<string>> {
    return this.put<M.ApiResponse<string>>('Settings/bulk', { settings });
  }
//  logPosition(dto: M.TrackingLogDto): Observable<{ logId: number }> {
//     return this.post<{ logId: number }>('Tracking/log', dto);
//   }

  getLivePositions(): Observable<M.TechnicianLivePosition[]> {
    return this.get<M.TechnicianLivePosition[]>('Tracking/live');
  }

  getHistory(technicianId: number, date?: string): Observable<M.TrackingLogEntry[]> {
    return this.get<M.TrackingLogEntry[]>(`Tracking/history/${technicianId}`, { date });
  }
  getAllWarrantyReturn(filter: M.WarrantyReturnFilter): Observable<M.PagedResponse<M.WarrantyReturnListItem>> {
    return this.get<M.PagedResponse<M.WarrantyReturnListItem>>('WarrantyReturn', filter as any);
  }

  getById(id: number): Observable<M.WarrantyReturnListItem> {
    return this.get<M.WarrantyReturnListItem>(`WarrantyReturn/${id}`);
  }

  create(dto: M.WarrantyReturnCreateDto): Observable<M.ApiResponse<any>> {
    return this.post<M.ApiResponse<any>>('WarrantyReturn', dto);
  }

  updateStatus(dto: M.WarrantyReturnStatusDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('WarrantyReturn/status', dto);
  }
 getDaily(date?: string, technicianId?: number): Observable<M.ScheduleListItem[]> {
    return this.get<M.ScheduleListItem[]>('Schedule/daily', { date, technicianId });
  }

  createScheduleCreate(dto: M.ScheduleCreateDto): Observable<M.ApiResponse<number>> {
    return this.post<M.ApiResponse<number>>('Schedule', dto);
  }

  updateScheduleUpdate(dto: M.ScheduleUpdateDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('Schedule', dto);
  }

  detectConflicts(date?: string): Observable<M.ScheduleConflictItem[]> {
    return this.get<M.ScheduleConflictItem[]>('Schedule/conflicts', { date });
  }

  resolveConflict(dto: M.ConflictResolveDto): Observable<M.ApiResponse<number>> {
    return this.post<M.ApiResponse<number>>('Schedule/conflicts/resolve', dto);
  }

  getComplaintSummary(filter: M.ReportFilter): Observable<M.ComplaintSummaryReport[]> {
    return this.get<M.ComplaintSummaryReport[]>('Report/complaint-summary', filter as any);
  }

  getTechnicianPerformance(filter: M.ReportFilter): Observable<M.TechPerformanceReport[]> {
    return this.get<M.TechPerformanceReport[]>('Report/technician-performance', filter as any);
  }
trackComplaint(complaintNo: string): Observable<M.ComplaintTrackingDetail> {
    return this.get<M.ComplaintTrackingDetail>(`CustomerPortal/track/${complaintNo}`);
  }

  createRequest(dto: M.ServiceRequestCreateDto): Observable<M.ApiResponse<any>> {
    return this.post<M.ApiResponse<any>>('CustomerPortal/request', dto);
  }

   getAllTechnicianFilter(filter: M.TechnicianFilter): Observable<M.PagedResponse<M.TechnicianListItem>> {
    return this.get<M.PagedResponse<M.TechnicianListItem>>('Technician', filter as any);
  }

  getByIdTechnicianFilter(id: number): Observable<M.TechnicianDetail> {
    return this.get<M.TechnicianDetail>(`Technician/${id}`);
  }

  createTechnicianFilter(dto: M.TechnicianCreateDto): Observable<M.ApiResponse<number>> {
    return this.post<M.ApiResponse<number>>('Technician', dto);
  }

  updateTechnicianFilter(dto: M.TechnicianUpdateDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('Technician', dto);
  }

  deleteTechnicianFilter(id: number): Observable<M.ApiResponse<number>> {
    return this.delete<M.ApiResponse<number>>(`Technician/${id}`);
  }
  getAllWarranty(filter: M.WarrantyReturnFilter): Observable<M.PagedResponse<M.WarrantyReturnListItem>> {
    return this.get<M.PagedResponse<M.WarrantyReturnListItem>>('WarrantyReturn', filter as any);
  }

  getByIdWarranty(id: number): Observable<M.WarrantyReturnListItem> {
    return this.get<M.WarrantyReturnListItem>(`WarrantyReturn/${id}`);
  }

  createWarranty(dto: M.WarrantyReturnCreateDto): Observable<M.ApiResponse<any>> {
    return this.post<M.ApiResponse<any>>('WarrantyReturn', dto);
  }

  updateStatusWarranty(dto: M.WarrantyReturnStatusDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('WarrantyReturn/status', dto);
  }
  createTechnician(dto: M.TechnicianCreateDto): Observable<M.ApiResponse<number>> {
    return this.post<M.ApiResponse<number>>('Technician', dto);
  }
  getAllTechnician(filter: M.TechnicianFilter): Observable<M.PagedResponse<M.TechnicianListItem>> {
    return this.get<M.PagedResponse<M.TechnicianListItem>>('Technician', filter as any);
  }

  getByIdTechnician(id: number): Observable<M.TechnicianDetail> {
    return this.get<M.TechnicianDetail>(`Technician/${id}`);
  }

  updateTechnician(dto: M.TechnicianUpdateDto): Observable<M.ApiResponse<number>> {
    return this.put<M.ApiResponse<number>>('Technician', dto);
  }

  deleteTechnician(id: number): Observable<M.ApiResponse<number>> {
    return this.delete<M.ApiResponse<number>>(`Technician/${id}`);
  }
  completeAssignment(data: { assignmentId: number; remarks?: string }): Observable<M.ApiResponse<number>> {
  return this.http.post<M.ApiResponse<number>>(`${this.api}/technician/complete-assignment`, data);
}
getComplaintsLookup(search?: string): Observable<M.ComplaintLookup[]> {
  let params = new HttpParams();

  if (search) {
    params = params.set('search', search);
  }

  return this.http.get<M.ComplaintLookup[]>(
    `${this.api}/technician/complaints-lookup`,
    { params }
  );
}

getActiveAssignments(): Observable<M.ActiveAssignment[]> {
  return this.http.get<M.ActiveAssignment[]>(`${this.api}/technician/active-assignments`);
}

// ADD to api-service.ts

// Product Master (autocomplete)
getProductMaster(search?: string, category?: string): Observable<M.ProductMaster[]> {
  const params: any = {};
  if (search) params.search = search;
  if (category) params.category = category;
  return this.http.get<M.ProductMaster[]>(`${this.api}/customer/product-master`, { params });
}

// Customer Profile
getOrCreateProfile(): Observable<M.ApiResponse<any>> {
  return this.http.get<M.ApiResponse<any>>(`${this.api}/customer/my-profile`);
}

checkCustomerByMobile(mobile: string): Observable<M.ApiResponse<any>> {
  return this.http.get<M.ApiResponse<any>>(`${this.api}/customer/check-mobile/${mobile}`);
}

// Products
getProducts(): Observable<M.ApiResponse<M.Product[]>> {
  return this.http.get<M.ApiResponse<M.Product[]>>(`${this.api}/customer/products`);
}

addProduct(dto: M.ProductCreate): Observable<M.ApiResponse<number>> {
  return this.http.post<M.ApiResponse<number>>(`${this.api}/customer/products`, dto);
}

uploadProductImage(productId: number, file: File, imageType: string): Observable<any> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('imageType', imageType);
  return this.http.post(`${this.api}/customer/products/${productId}/images`, fd);
}

// Complaints
createComplaint(dto: M.ComplaintCreate): Observable<M.ApiResponse<any>> {
  return this.http.post<M.ApiResponse<any>>(`${this.api}/customer/complaints`, dto);
}

getMyComplaints(statusFilter?: number, page = 1, size = 10): Observable<any> {
  const params: any = { page, size };
  if (statusFilter) params.statusFilter = statusFilter;
  return this.http.get(`${this.api}/customer/my-complaints`, { params });
}

getComplaintDetail(id: number): Observable<M.ApiResponse<M.ComplaintDetail>> {
  return this.http.get<M.ApiResponse<M.ComplaintDetail>>(`${this.api}/customer/complaints/${id}`);
}

replyToComplaint(id: number, message: string): Observable<M.ApiResponse<number>> {
  return this.http.post<M.ApiResponse<number>>(`${this.api}/customer/complaints/${id}/reply`, { message });
}

uploadComplaintImage(complaintId: number, file: File): Observable<any> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('imageType', 'complaint');
  return this.http.post(`${this.api}/customer/complaints/${complaintId}/images`, fd);
}


// ─── 2. Add to api-service.ts ────────────────────────────────────────────────

unAssignTechnician(payload: UnAssignRequest): Observable<{ success: boolean; message: string }> {
  return this.http.post<{ success: boolean; message: string }>(
    `${this.api}/technician/unassign`,
    payload
  );
}
// Also add to api-service.ts:
getWorkOrderDetails(assignmentId: number): Observable<any> {
  return this.http.get<any>(`${this.api}/technician/work-order-details/${assignmentId}`);
}



getSpareParts(): Observable<any> {
  return this.http.get(`${this.api}/spare-parts`);
}

searchSpareParts(term: string): Observable<any> {
  const params = term?.trim()
    ? { params: { search: term } }
    : {};
  return this.http.get(`${this.api}/spare-parts`, params);
}

getSparePartRequests(technicianId?: number, complaintId?: number): Observable<any> {
  let params: any = {};
  if (technicianId) params.technicianId = technicianId;
  if (complaintId)  params.complaintId  = complaintId;
  return this.http.get(`${this.api}/spare-parts/requests`, { params });
}

createSpareRequest(payload: M.SparePartRequestCreate[]): Observable<M.ApiResponse<{ requestIds: number[] }>> {
  return this.http.post<M.ApiResponse<{ requestIds: number[] }>>(`${this.api}/spare-parts/requestspare`, payload);
}
requestSparePart(techId: number, payload: any): Observable<any> {
  return this.http.post(`${this.api}/spare-parts/request`,
    { ...payload, technicianId: techId });
}
getSpareDashboardSummary(): Observable<any> {
  return this.http.get(`${this.api}/spare-parts/dashboard-summary`);
}

getSpareAdminRequests(filter: any): Observable<any> {
  let params: any = { page: filter.page, pageSize: filter.pageSize };
  if (filter.status)       params.status       = filter.status;
  if (filter.urgencyLevel) params.urgencyLevel = filter.urgencyLevel;
  if (filter.complaintId)  params.complaintId  = filter.complaintId;
  return this.http.get(`${this.api}/spare-parts/admin`, { params });
}

getSpareByComplaint(complaintId: number): Observable<any> {
  return this.http.get(`${this.api}/spare-parts/by-complaint/${complaintId}`);
}

updateSpareStatus(requestId: number, status: string): Observable<any> {
  return this.http.patch(`${this.api}/spare-parts/request/${requestId}/status`, { status });
}

bulkUpdateSpareStatus(payload: { requestIds: number[]; status: string }): Observable<any> {
  return this.http.post(`${this.api}/spare-parts/bulk-status`, payload);
}


// ─── TRACKING — FIXED METHODS ────────────────────────────────────────────
  // Replace the existing tracking methods in your api-service.ts with these.

  // FIX 1: checkIn was ignoring technicianId — URL was hardcoded to /Tracking/checkin
  //        Now includes technicianId in route (requires controller fix below)
  // checkIn(technicianId: number, data: { latitude: number; longitude: number; address?: string | null }): Observable<M.ApiResponse<number>> {
  //   return this.http.post<M.ApiResponse<number>>(
  //     `${this.api}/tracking/${technicianId}/checkin`, data
  //   );
  // }

  // checkOut — already correct, no change needed
  checkOut(technicianId: number, data: { latitude: number; longitude: number; address?: string | null }): Observable<M.ApiResponse> {
    return this.http.post<M.ApiResponse>(
      `${this.api}/tracking/${technicianId}/checkout`, data
    );
  }

  // recordSiteArrival — already correct, no change needed
  recordSiteArrival(
    technicianId: number,
    data: { complaintId: number; latitude: number; longitude: number; address?: string | null }
  ): Observable<M.ApiResponse> {
    return this.http.post<M.ApiResponse>(
      `${this.api}/tracking/${technicianId}/site-arrival`, data
    );
  }

  // FIX 2: getAttendance return type was Observable<M.Attendance[]>
  //        but backend returns ApiResponse<List<AttendanceDto>>
  //        → changed to Observable<M.ApiResponse<M.Attendance[]>>
  // getAttendance(technicianId?: number, fromDate?: string, toDate?: string): Observable<M.ApiResponse<M.Attendance[]>> {
  //   let params = new HttpParams();
  //   if (technicianId) params = params.set('technicianId', technicianId);
  //   if (fromDate) params = params.set('fromDate', fromDate);
  //   if (toDate) params = params.set('toDate', toDate);

  //   return this.http.get<M.ApiResponse<M.Attendance[]>>(
  //     `${this.api}/tracking/attendance`, { params }
  //   );
  // }


  // ═══════════════════════════════════════════════════════════════════════
  // REPLACE these 3 tracking methods in your existing api-service.ts
  // ═══════════════════════════════════════════════════════════════════════

  // ─── FIX 1: checkIn — URL ignored technicianId ─────────────────────────
  // OLD: POST /Tracking/checkin (hardcoded, technicianId param unused)
  // NEW: POST /tracking/{technicianId}/checkin
  // (requires controller: [HttpPost("{technicianId}/checkin")])
  checkIn(
    technicianId: number,
    data: { latitude: number; longitude: number; address?: string | null }
  ): Observable<M.ApiResponse<number>> {
    return this.http.post<M.ApiResponse<number>>(
      `${this.api}/tracking/${technicianId}/checkin`, data
    );
  }
getScheduleBoardReport(date: string) {
  const companyId = this.auth.selectedCompanyId();

  return this.http.get<any>(
    `${environment.apiUrl}/api/Schedule/schedule-board`,
    {
      params: {
        companyId: companyId?.toString() ?? '',
        scheduleDate: date
      }
    }
  );
}
  // ─── FIX 2: getAttendance — wrong return type ─────────────────────────
  // OLD: Observable<M.Attendance[]>  (no ApiResponse wrapper)
  // NEW: Observable<M.ApiResponse<M.Attendance[]>>
  // Backend returns { success, message, data: [...] }
  getAttendance(
    technicianId?: number,
    fromDate?: string,
    toDate?: string
  ): Observable<M.ApiResponse<M.Attendance[]>> {
    let params = new HttpParams();
    if (technicianId) params = params.set('technicianId', technicianId);
    if (fromDate)     params = params.set('fromDate', fromDate);
    if (toDate)       params = params.set('toDate', toDate);

    return this.http.get<M.ApiResponse<M.Attendance[]>>(
      `${this.api}/tracking/attendance`, { params }
    );
  }

  // ─── FIX 3: getTravelReport — wrong param names + missing technicianId ─
  // OLD: params { from, to }    → controller expects { fromDate, toDate }
  //      no technicianId param  → controller accepts technicianId
  //      return type Attendance[] → should be ApiResponse<TravelReport[]>
  getTravelReport(
    fromDate?: string,
    toDate?: string,
    technicianId?: number
  ): Observable<M.ApiResponse<M.TravelReport[]>> {
    let params = new HttpParams();
    if (fromDate)     params = params.set('fromDate', fromDate);
    if (toDate)       params = params.set('toDate', toDate);
    if (technicianId) params = params.set('technicianId', technicianId.toString());

    return this.http.get<M.ApiResponse<M.TravelReport[]>>(
      `${this.api}/tracking/travel-report`, { params }
    );
  }
  logPosition(dto: {
  technicianId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  sessionId?: string;
}): Observable<any> {
  return this.post<any>('Tracking/log', dto);
}
submitQuickComplaint(formData: FormData): Observable<any> {
  return this.http.post(`${this.api}/Customer/quick-complaint`, formData);
}

// Services/API/api-service.ts - Add these methods
 manageComplaintDetails(params: any): Observable<any> {
    return this.http.post(`${this.api}/Dashboard/manage`, params);
  }

  // Get complete complaint details
  getCompleteComplaintDetails(complaintId: number): Observable<any> {
    // GET method is better for retrieving data
    return this.http.get(`${this.api}/Dashboard/${complaintId}`);
  }

  // Alternative GET using manage endpoint (not recommended but works)
  getCompleteComplaintDetailsViaManage(complaintId: number): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'GET',
      complaintId: complaintId,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Update Complaint Details
  updateComplaintDetails(complaintId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_COMPLAINT',
      complaintId: complaintId,
      userId: this.auth.currentUser()?.userId ?? 0,
      ...data
    });
  }

  // Update Customer Details - Only send the fields that are actually being updated
  updateCustomerDetails(customerId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_CUSTOMER',
      customerId: customerId,
      userId: this.auth.currentUser()?.userId ?? 0,
      customerName: data.customerName,
      customerEmail: data.customerEmail,
      customerMobile: data.customerMobile,
      alternatePhone: data.alternatePhone,
      customerAddress: data.customerAddress,
      city: data.city,
      state: data.state,
      pinCode: data.pinCode,
      landmark: data.landmark,
      customerLatitude: data.customerLatitude,
      customerLongitude: data.customerLongitude
    });
  }

  // Update Product Details
  updateProductDetails(productId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_PRODUCT',
      productId: productId,
      userId: this.auth.currentUser()?.userId ?? 0,
      productName: data.productName,
      serialNumber: data.serialNumber,
      productModelNumber: data.productModelNumber,
      productBrand: data.productBrand,
      productCategory: data.productCategory,
      purchaseDate: data.purchaseDate,
      warrantyExpiryDate: data.warrantyExpiryDate
    });
  }

  // Update Location Details
  updateLocationDetails(complaintId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_LOCATION',
      complaintId: complaintId,
      userId: this.auth.currentUser()?.userId ?? 0,
      latitude: data.latitude,
      longitude: data.longitude,
      locationAddress: data.locationAddress,
      locationName: data.locationName
    });
  }

  // Assign Technician
  assignTechnicianview(data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'ASSIGN_TECHNICIAN',
      userId: this.auth.currentUser()?.userId ?? 0,
      complaintId: data.complaintId,
      technicianId: data.technicianId,
      assignmentRole: data.assignmentRole,
      assignmentNotes: data.assignmentNotes,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime,
      estimatedDuration: data.estimatedDuration,
      priority: data.priority
    });
  }

  // Update Assignment
  updateAssignment(assignmentId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_ASSIGNMENT',
      assignmentId: assignmentId,
      userId: this.auth.currentUser()?.userId ?? 0,
      assignmentRole: data.assignmentRole,
      assignmentNotes: data.assignmentNotes,
      scheduledDate: data.scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime,
      estimatedDuration: data.estimatedDuration,
      priority: data.priority,
      workDone: data.workDone,
      partsUsed: data.partsUsed,
      completionRemarks: data.completionRemarks
    });
  }

  // Unassign Technician
  unassignTechnician(assignmentId: number): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UNASSIGN_TECHNICIAN',
      assignmentId: assignmentId,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Add Spare Part Request
  addSparePartRequest(data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'ADD_SPARE',
      userId: this.auth.currentUser()?.userId ?? 0,
      complaintId: data.complaintId,
      sparePartId: data.sparePartId,
      technicianId: data.technicianId,
      spareQuantity: data.spareQuantity || 1,
      spareUrgency: data.spareUrgency || 'Normal',
      spareRemarks: data.spareRemarks
    });
  }

  // Update Spare Part Request
  updateSparePartRequest(requestId: number, data: any): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_SPARE',
      spareRequestId: requestId,
      userId: this.auth.currentUser()?.userId ?? 0,
      spareQuantity: data.spareQuantity,
      spareUrgency: data.spareUrgency,
      spareRemarks: data.spareRemarks,
      spareStatus: data.spareStatus
    });
  }

  // Delete Spare Part Request
  deleteSparePartRequest(requestId: number): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'DELETE_SPARE',
      spareRequestId: requestId,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Add Comment
  addComment(complaintId: number, commentText: string, isInternal: boolean = false): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'ADD_COMMENT',
      complaintId: complaintId,
      commentText: commentText,
      isInternal: isInternal,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Update Comment
  updateComment(commentId: number, commentText: string): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'UPDATE_COMMENT',
      commentId: commentId,
      commentText: commentText,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Delete Comment
  deleteComment(commentId: number): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'DELETE_COMMENT',
      commentId: commentId,
      userId: this.auth.currentUser()?.userId ?? 0
    });
  }

  // Get Spare Parts Dropdown
  getSparePartsDropdown(): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'GET_SPARE_PARTS_DROPDOWN'
    });
  }

  // Get Technicians Dropdown
  getTechniciansDropdown(): Observable<any> {
    return this.manageComplaintDetails({
      operationType: 'GET_TECHNICIANS_DROPDOWN'
    });
  }
  createProductAndLink(complaintId: number, body: {
  productName?: string;
  serialNumber?: string;
  productModelNumber?: string;
  productBrand?: string;
  productCategory?: string;
  purchaseDate?: string | null;
  warrantyExpiryDate?: string | null;
}): Observable<any> {
  return this.http.post<any>(
    `${this.api}/api/Dashboard/complaints/${complaintId}/products`,
    body
  );
}



// Add to api-service.ts

// Spare Parts Master
getSparePartsmaster(params: any): Observable<any> {
  return this.http.get(`${this.api}/spare-parts/spare`, { params });
}

getSparePartById(id: number): Observable<any> {
  return this.http.get(`${this.api}/spare-parts/spare/${id}`);
}

createSparePart(data: any): Observable<any> {
  return this.http.post(`${this.api}/spare-parts`, data);
}

updateSparePart(id: number, data: any): Observable<any> {
  return this.http.put(`${this.api}/spare-parts/${id}`, data);
}

deleteSparePart(id: number): Observable<any> {
  return this.http.delete(`${this.api}/spare-parts/${id}`);
}

bulkDeleteSpareParts(ids: string): Observable<any> {
  return this.http.post(`${this.api}/spare-parts/spare/bulk-delete`, { ids });
}

getSparePartsDropdownmaster(): Observable<any> {
  return this.http.get(`${this.api}/spare-parts/spare/dropdown`);
}

createRepairPartRequest(dto: any): Observable<M.ApiResponse<any>> {
  return this.http.post<M.ApiResponse<any>>(`${this.api}/RepairPart/create`, dto);
}

uploadRepairImage(repairRequestId: number, file: File, imageType: string): Observable<any> {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('repairRequestId', repairRequestId.toString());
  fd.append('imageType', imageType);
  return this.http.post(`${this.api}/RepairPart/upload-image`, fd);
}

getRepairImagesByRequest(repairRequestId: number): Observable<M.ApiResponse<any[]>> {
  return this.http.get<M.ApiResponse<any[]>>(`${this.api}/RepairPart/request/${repairRequestId}/images`);
}

getRepairImageBase64(imageId: number): Observable<M.ApiResponse<string>> {
  return this.http.get<M.ApiResponse<string>>(`${this.api}/RepairPart/image/${imageId}`);
}







}



export interface UnAssignRequest {
  assignmentId: number;
  reason?: string;
}
