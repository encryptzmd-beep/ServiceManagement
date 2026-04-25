// ============================================
// src/app/models/api.models.ts
// ============================================

// --- Common ---
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// --- Auth ---
export interface LoginRequest {
  email: string;
  password: string;
}

export interface OtpRequest {
  mobileNumber: string;
}

export interface OtpValidate {
  mobileNumber: string;
  otpCode: string;
}
export interface TechnicianScheduleBoardItem {
  scheduleId: number;
  complaintNumber: string;
  customerName: string;

  city: string;
  address: string;
  landmark: string;

  latitude?: number | null;
  longitude?: number | null;

  productName: string;

  startTime: string;
  endTime: string;

  statusId: number;
  statusName: string;

  timeSlot: 'morning' | 'afternoon' | 'evening';

  isFuture: boolean;
  isFree: boolean;
}

export interface TechnicianScheduleBoard {
  technicianId: number;
  technicianName: string;
  items: TechnicianScheduleBoardItem[];
}
export interface RegisterRequest {
  fullName: string;
  email: string;
  mobileNumber: string;
  password: string;
  roleId: number;
}

export interface LoginResponse {
  token: string;
  fullName: string;
  role: string;
  userId: number;
  technicianId: number;
  email:string;
  mobileNumber : string;
  menus: MenuItem[];
}

export interface MenuItem {
  menuId: number;
  menuName: string;
  menuPath: string | null;
  icon: string | null;
  sortOrder: number;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  children: MenuItem[];
}

// --- Customer ---
export interface Customer {
  customerId: number;
  customerName: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  alternatePhone?: string;
  mobileNumber: string;
  landmark : string
}

export interface CustomerCreate {
  customerName: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  alternatePhone?: string;
}

// --- Product ---
export interface Product {
  productId: number;
  productName: string;
  serialNumber: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  images: ProductImage[];
}

export interface ProductCreate {
  productName: string;
  serialNumber: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
}

export interface ProductImage {
  imageId: number;
  imageType: string;
  imagePath: string;
  uploadedAt: string;
}

// --- Complaint ---
export interface Complaint {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  description?: string;
  priority: string;
  statusName: string;
  statusColor?: string;
  customerName: string;
  productName: string;
  serialNumber: string;
  slaDeadline?: string;
  isSLABreached: boolean;
  isCustomerConfirmed: boolean;
  createdAt: string;
  updatedAt: string;
  images: ComplaintImage[];
  timeline: ComplaintTimeline[];
  assignments: TechnicianAssignment[];
}

export interface ComplaintListItem {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  priority: string;
  statusName: string;
  statusColor?: string;
  customerName: string;
  productName: string;
  slaDeadline?: string;
  isSLABreached: boolean;
  createdAt: string;
  totalCount: number;
  AssignedTechnicians: string;
  technicianName :string
}

export interface ComplaintCreate {
  latitude: any;
  longitude: any;
  locationAddress: any;
  pickedLocation: string;
  productId: number;
  subject: string;
  description?: string;
  priority: string;
}

export interface ComplaintFilter {
  statusId?: number;
  priority?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber: number;
  pageSize: number;
}

export interface ComplaintImage {
  imageId: number;
  imagePath: string;
  uploadedAt: string;
}

export interface ComplaintTimeline {
  timelineId: number;
  statusName: string;
  statusColor?: string;
  remarks?: string;
  actionByName?: string;
  actionAt: string;
}

// --- Technician ---
export interface Technician {
  technicianId: number;
  fullName: string;
  email?: string;
  mobileNumber: string;
  specialization?: string;
  isAvailable: boolean;
  isActive: boolean;
  availabilityStatus: number;    // ← change from boolean to number (1=Available, 2=Busy, 3=Leave)
  rating: number;                // ← add
  totalCompletedJobs: number;    // ← add
}

export interface TechnicianAssignment {
  assignmentId: number;
  technicianId: number;
  technicianName: string;
  assignmentRole: string;
  status: string;
  assignedAt: string;
  completedAt?: string;
}
export interface ComplaintLookup {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  customerName: string;
  customerPhone: string;
  customerPlace: string;
  priority: string;
  statusId: number;
}

export interface ActiveAssignmentdto {
  assignmentId: number;
  complaintId: number;
  complaintNumber: string;
  complaintSubject: string;
  technicianName: string;
  assignmentRole: string;
  status: string;
  assignedAt: string;
  customerName: string;
  customerPhone: string;
}


// REPLACE in ApiModels.ts

export interface AssignTechnician {
  complaintId: number;
  technicianId: number;
  assignmentRole: string;
  priority?: string;
  notes?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  timeSlot?: string;
}

export interface ActiveAssignment {
  assignmentId: number;
  complaintId: number;
  complaintNumber: string;
  complaintSubject: string;
  technicianName: string;
  assignmentRole: string;
  status: string;
  assignedAt: string;
  customerName: string;
  customerPhone: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
  priority?: string;
}

export interface AuditLog {
  auditId: number;
  action: string;
  oldTechnician?: string;
  newTechnician?: string;
  oldRole?: string;
  newRole?: string;
  changedByName?: string;
  changedAt: string;
  remarks?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
}

export interface CompleteAssignment {
  assignmentId: number;
  remarks?: string;
}

export interface WorkOrder {
  assignmentId: number;
  complaintId: number;
  complaintNumber: string;
  subject: string;
  customerName: string;
  customerAddress: string | null;
  customerPhone: string | null;
  productName: string;
  assignmentRole: string;
  status: string;
  assignedAt: string;
  // ── add these ──
  scheduledDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  priority?: string | null;
  notes?: string | null;
}

export interface WorkOrderResponse {
  success: boolean;
  data: WorkOrder[];
}

export interface AuditLog {
  auditId: number;
  action: string;
  oldTechnician?: string;
  newTechnician?: string;
  oldRole?: string;
  newRole?: string;
  changedByName?: string;
  changedAt: string;
  remarks?: string;
}

// --- Spare Parts ---
export interface SparePart {
  sparePartId: number;
  partName: string;
  partNumber?: string;
  stockQuantity: number;
  unitPrice?: number;
}

export interface SparePartRequest {
  requestId: number;
  partName: string;
  quantity: number;
  status: string;
  requestedAt: string;
  approvedByName?: string;
  approvedAt?: string;
  complaintId : number;
}

export interface SparePartRequestCreate {
  complaintId: number;
  technicianId: number;
  sparePartId?: number | null;
  quantity: number;
  urgencyLevel?: string;
  remarks?: string | null;
  customPartName?: string | null;
  customPartNumber?: string | null;
}

// --- Warranty ---
export interface WarrantyReturn {
  returnId: number;
  complaintId: number;
  complaintNumber: string;
  partName: string;
  oldPartSerialNumber?: string;
  returnStatus: string;
  createdAt: string;
}

// --- Tracking ---
export interface Attendance {
  attendanceId: number;
  technicianName: string;
  checkInTime?: string;
  checkInAddress?: string;
  checkOutTime?: string;
  checkOutAddress?: string;
  totalWorkHours?: number;
  attendanceDate: string;
}

export interface GeoTrack {
  trackingId: number;
  latitude: number;
  longitude: number;
  address?: string;
  eventType: string;
  recordedAt: string;
}

export interface TravelReport {
  technicianName: string;
  travelDate: string;
  totalDistanceKm: number;
  serviceVisits: number;
}

// --- Schedule ---
export interface Schedule {
  scheduleId: number;
  technicianId: number;
  technicianName: string;
  complaintId: number;
  complaintNumber: string;
  subject: string;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
  status: string;
  hasConflict: boolean;
}

export interface ScheduleCreate {
  technicianId: number;
  complaintId: number;
  scheduledDate: string;
  timeSlotStart: string;
  timeSlotEnd: string;
}

// --- Reports ---
export interface DashboardSummary {
  totalComplaints: number;
  openComplaints: number;
  closedToday: number;
  slaBreached: number;
  activeTechnicians: number;
  avgResolutionHours: number;
}

export interface SLAReport {
  totalComplaints: number;
  withinSLA: number;
  slaBreached: number;
  slaCompliancePercent: number;
  byPriority: SLAByPriority[];
}

export interface SLAByPriority {
  priority: string;
  total: number;
  withinSLA: number;
  breached: number;
}

export interface ProductivityReport {
  technicianName: string;
  totalAssignments: number;
  completed: number;
  totalWorkHours: number;
  totalDistanceKm: number;
  sparePartsUsed: number;
}

// --- Complaint Statuses ---
export const COMPLAINT_STATUSES = [
  { id: 1, name: 'New', color: '#3B82F6' },
  { id: 2, name: 'Assigned', color: '#8B5CF6' },
  { id: 3, name: 'InProgress', color: '#F59E0B' },
  { id: 4, name: 'PartsRequested', color: '#EF4444' },
  { id: 5, name: 'WorkCompleted', color: '#10B981' },
  { id: 6, name: 'PendingConfirmation', color: '#6366F1' },
  { id: 7, name: 'Closed', color: '#6B7280' },
  { id: 8, name: 'Reopened', color: '#DC2626' },
];

export const PRIORITIES = ['Low',  'High'];

export const ROLES = [
  { id: 1, name: 'Admin' },
  { id: 2, name: 'ServiceManager' },
  { id: 3, name: 'Technician' },
  { id: 4, name: 'Customer' },
];
export interface SlaData {
  priority: string;
  total: number;
  withinSla: number;
  breached: number;
  compliancePercent: number;
  avgResolutionHours: number;
  slaTargetHours: number;
}
export interface TechProductivity {
  technicianId: number;
  technicianName: string;
  specialization: string;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  completionRate: number;
  totalWorkHours: number;
  avgResolutionHours: number;
  totalDistanceKm: number;
  sparePartsUsed: number;
  customerRating: number;
}


// ============================================
// models/dashboard.model.ts
// ============================================
export interface DashboardStats {
  totalComplaints: number;
  newComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  closedComplaints: number;
  slaBreached: number;
  warrantyComplaints: number;
  availableTechnicians: number;
  todaySchedules: number;
  pendingReturns: number;

  activeComplaints?: number;
  totalProducts?: number;
  activeWarrantyProducts?: number;
  expiredWarrantyProducts?: number;
}

export interface RecentComplaint {
  complaintId: number;
  complaintNo: string;
  subject: string;
  createdDate: string;
  statusId: number;
  priorityId: number;
  customerName: string;
  technicianName: string;
}

export interface SLABreachItem {
  complaintNo: string;
  subject: string;
  slaDeadline: string;
  hoursOverdue: number;
  customerName: string;
}

export interface DashboardResponse {
  stats: DashboardStats;
  recentComplaints: RecentComplaint[];
  slaBreaches: SLABreachItem[];
}

export interface ChartDataPoint {
  date: string;
  count: number;
}

export interface StatusCount {
  statusId: number;
  count: number;
}

export interface DashboardChartData {
  complaintsByDate: ChartDataPoint[];
  complaintsByStatus: StatusCount[];
  complaintsByPriority: StatusCount[];
}

// ============================================
// models/technician.model.ts
// ============================================
export interface TechnicianListItem {
  profileId: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  employeeCode: string;
  specialization: string;
  experienceYears: number;
  availabilityStatus: number;
  rating: number;
  totalCompletedJobs: number;
  maxDailyAssignments: number;
  joinDate: string;
  isActive: boolean;
  currentLatitude: number | null;
  currentLongitude: number | null;
  lastLocationUpdate: string | null;
  todayAssignments: number;
  activeComplaints: number;
  totalCount: number;
}

export interface TechnicianDetail extends TechnicianListItem {
  profileImage: string;
  certificationDetails: string;
  totalAssigned: number;
  totalResolved: number;
  avgResolutionHours: number | null;
  skills: TechnicianSkill[];
  recentSchedules: ScheduleListItem[];
}

export interface TechnicianSkill {
  skillId: number;
  technicianProfileId: number;
  skillName: string;
  proficiencyLevel: number;
  certifiedDate: string | null;
  expiryDate: string | null;
}

export interface TechnicianCreateDto {
  fullName: string;
  email?: string;
  mobileNumber: string;
  specialization: string;
  experienceYears: number;
  certificationDetails?: string;
  maxDailyAssignments: number;
  joinDate?: string;
}

export interface TechnicianUpdateDto {
  profileId: number;
  specialization: string;
  experienceYears: number;
  certificationDetails: string;
  maxDailyAssignments: number;
  availabilityStatus: number;
}

export interface TechnicianFilter {
  searchTerm?: string;
  statusFilter?: number;
  pageNumber: number;
  pageSize: number;
  sortBy: string;
  sortDir: string;
}

// ============================================
// models/warranty-return.model.ts
// ============================================
export interface WarrantyReturnListItem {
  returnId: number;
  returnNo: string;
  complaintId: number;
  complaintNo: string;
  complaintSubject: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  productId: number;
  productSerialNo: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  returnReason: string;
  returnType: number;
  statusId: number;
  approvedBy: number | null;
  approvedDate: string | null;
  pickupDate: string | null;
  pickupAddress: string;
  trackingNumber: string;
  resolutionNotes: string;
  refundAmount: number | null;
  createdDate: string;
  totalCount: number;
}

export interface WarrantyReturnCreateDto {
  complaintId: number;
  customerId: number;
  productId: number;
  productSerialNo: string;
  warrantyStartDate: string;
  warrantyEndDate: string;
  returnReason: string;
  returnType: number;
  pickupAddress: string;
}

export interface WarrantyReturnStatusDto {
  returnId: number;
  statusId: number;
  resolutionNotes?: string;
  trackingNumber?: string;
  refundAmount?: number;
}

export interface WarrantyReturnFilter {
  searchTerm?: string;
  statusFilter?: number;
  returnTypeFilter?: number;
  pageNumber: number;
  pageSize: number;
}

// ============================================
// models/schedule.model.ts
// ============================================
export interface ScheduleListItem {
  scheduleId: number;
  technicianId: number;
  technicianName: string;
  employeeCode: string;
  specialization: string;
  complaintId: number | null;
  complaintNo: string;
  complaintSubject: string;
  priorityId: number | null;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  taskType: number;
  priorityLevel: number;
  statusId: number;
  customerAddress: string;
  customerName: string;
  customerPhone: string;
  estimatedDuration: number;
  actualDuration: number | null;
  notes: string;
}

export interface ScheduleCreateDto {
  technicianId: number;
  complaintId?: number;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  taskType: number;
  priorityLevel: number;
  customerAddress?: string;
  customerLatitude?: number;
  customerLongitude?: number;
  estimatedDuration: number;
  notes?: string;
}

export interface ScheduleUpdateDto {
  scheduleId: number;
  scheduleDate: string;
  startTime: string;
  endTime: string;
  taskType: number;
  priorityLevel: number;
  statusId: number;
  notes?: string;
}

export interface ScheduleConflictItem {
  conflictId: number;
  schedule1Id: number;
  schedule2Id: number;
  technicianId: number;
  technicianName: string;
  employeeCode: string;
  conflictDate: string;
  conflictType: number;
  severity: number;
  schedule1Start: string;
  schedule1End: string;
  schedule1Type: number;
  schedule2Start: string;
  schedule2End: string;
  schedule2Type: number;
  complaint1No: string;
  complaint2No: string;
  isResolved: boolean;
}

export interface ConflictResolveDto {
  conflictId: number;
  resolution: string;
}

// ============================================
// models/tracking.model.ts
// ============================================
export interface TechnicianLivePosition {
  technicianId: number;
  fullName: string;
  employeeCode: string;
  specialization: string;
  currentLatitude: number;
  currentLongitude: number;
  lastLocationUpdate: string;
  availabilityStatus: number;
  currentComplaint: string;
}

export interface TrackingLogEntry {
  logId: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  batteryLevel: number;
  logTime: string;
}

export interface TrackingLogDto {
  technicianId: number;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  batteryLevel?: number;
  sessionId: string | null | undefined;
}

// ============================================
// models/customer-portal.model.ts
// ============================================
export interface CustomerComplaint {
  complaintId: number;
  complaintNo: string;
  subject: string;
  description: string;
  statusId: number;
  priorityId: number;
  createdDate: string;
  resolvedDate: string | null;
  closedDate: string | null;
  isWarranty: boolean;
  technicianName: string;
  technicianPhone: string;
  totalCount: number;
}

export interface ComplaintTrackingDetail {
  complaintId: number;
  complaintNo: string;
  subject: string;
  description: string;
  statusId: number;
  customerName: string;
  technicianName: string;
  createdDate: string;
  assignedDate: string | null;
  resolvedDate: string | null;
  statusHistory: StatusHistoryItem[];
}

export interface StatusHistoryItem {
  historyId: number;
  oldStatusId: number;
  newStatusId: number;
  changedByName: string;
  changedDate: string;
  remarks: string;
}

export interface ServiceRequestCreateDto {
  productId?: number;
  requestType: number;
  subject: string;
  description: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
}

// ============================================
// models/report.model.ts
// ============================================
export interface ComplaintSummaryReport {
  reportDate: string;
  statusId: number;
  priorityId: number;
  complaintCount: number;
  warrantyCount: number;
  slaBreached: number;
  avgResolutionHours: number | null;
}

export interface TechPerformanceReport {
  userId: number;
  fullName: string;
  employeeCode: string;
  specialization: string;
  totalAssigned: number;
  resolved: number;
  closed: number;
  slaBreached: number;
  avgResolutionHours: number | null;
  rating: number;
}

export interface ReportFilter {
  startDate: string;
  endDate: string;
  statusId?: number;
  priorityId?: number;
  technicianId?: number;
}

// ============================================
// models/settings.model.ts
// ============================================
export interface SystemSetting {
  settingId: number;
  settingKey: string;
  settingValue: string;
  settingGroup: string;
  dataType: string;
  description: string;
  isEditable: boolean;
  modifiedDate: string;
}

export interface SettingUpdateDto {
  settingId: number;
  settingValue: string;
}

// ============================================
// models/common.model.ts
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T | undefined;
  totalCount?: number;
}

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  pageNumber: number;
  pageSize: number;
  totalPages: number;
}

// ADD to ApiModels.ts

export interface ProductMaster {
  productCode: any;
  subCategory: any;
  mrp: any;
  org: any;
  priceChangeStatus: any;
  priceEffectiveDate: any;
  isActive: any;
  productMasterId: number;
  productName: string;
  brand: string;
  category: string;
  model: string;
  description?: string;
  warrantyMonths: number;
}

export interface Product {
  productId: number;
  productName: string;
  serialNumber: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  images: ProductImage[];
}

export interface ProductImage {
  imageId: number;
  productId: number;
  imageType: string;
  imagePath: string;
  uploadedAt: string;
}

export interface ProductCreate {
  productName: string;
  serialNumber: string;
  brand?: string;
  model?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
}

export interface ComplaintCreate {
  productId: number;
  subject: string;
  description?: string;
  priority: string;
}

export interface CustomerComplaintList {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  description?: string;
  priority: string;
  statusId: number;
  slaDeadline?: string;
  createdAt: string;
  updatedAt: string;
  productName: string;
  serialNumber: string;
  brand?: string;
  technicianName?: string;
  technicianPhone?: string;
  assignmentRole?: string;
  assignmentStatus?: string;
  assignedAt?: string;
  totalCount: number;
}

export interface ComplaintDetail {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  description?: string;
  priority: string;
  statusId: number;
  slaDeadline?: string;
  createdAt: string;
  isCustomerConfirmed: boolean;
  productName: string;
  serialNumber: string;
  brand?: string;
  customerName: string;
  mobileNumber: string;
  city?: string;
  technicians: AssignedTech[];
  timeline: TimelineItem[];
}

export interface AssignedTech {
  assignmentId: number;
  assignmentRole: string;
  status: string;
  assignedAt: string;
  completedAt?: string;
  technicianName: string;
  technicianPhone: string;
  specialization: string;
  rating: number;
}

export interface TimelineItem {
  auditId: number;
  action: string;
  remarks?: string;
  changedAt: string;
  changedByName?: string;
  technicianName?: string;
  newRole?: string;
}
// Encryptz/Models/company-models.ts

export interface CompanyUserDetailDto {
  companyUserId: number;
  userId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  roleInCompany: string;
  assignedAt: string;
  assignedBy: string;
  isActive: boolean;
}

export interface InvitationDetailDto {
  invitationId: number;
  email: string;
  roleInCompany: string;
  status: string;
  expiresAt: string;
  createdAt: string;
  createdByName: string;
}

export interface JoinRequestDto {
  requestId: number;
  userId: number;
  userName: string;
  userEmail: string;
  mobileNumber: string;
  requestedRole: string;
  remarks?: string;
  requestedAt: string;
  status: string;
}

export interface CompanyInfoDto {
  companyId: number;
  companyName: string;
  companyCode: string;
  city?: string;
  userStatus: 'Member' | 'Requested' | 'Available';
}

export const STATUS_MAP: Record<number, { label: string; color: string }> = {
  1: { label: 'New', color: '#3b82f6' },
  2: { label: 'In Progress', color: '#f59e0b' },
  3: { label: 'Resolved', color: '#10b981' },
  4: { label: 'Closed', color: '#6b7280' },
  5: { label: 'Reopened', color: '#ef4444' },
};

// customer.model.ts
export interface Customer {
  userId: number;
  customerId: number;
  fullName: string;
  email: string;
  mobileNumber: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  latitude?: number;
  longitude?: number;
  roleId: number;
  roleName: string;
  isActive: boolean;
  companyId?: number;
}

export interface CustomerMenu {
  menuId: number;
  menuName: string;
  menuPath: string;
  icon: string;
  parentMenuId: number | null;
  sortOrder: number;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface LoginResponseCustomer {
  success: boolean;
  message?: string;
  customer?: Customer;
  menus?: CustomerMenu[];
  token?: string;
}

export interface RegisterResponse {
  success: boolean;
  message: string;
  userId?: number;
  customerId?: number;
}

// export interface DashboardStats {
//   totalComplaints: number;
//   activeComplaints: number;
//   resolvedComplaints: number;
//   totalProducts: number;
//   activeWarrantyProducts: number;
//   expiredWarrantyProducts: number;
// }

export interface ComplaintCustomer {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  description?: string;
  priority: string;
  statusId: number;
  statusName: string;
  statusColor: string;
  productId: number;
  productName: string;
  serialNumber: string;
  createdAt: string;
  updatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  assignedTechnicianName?: string;
 }

export interface Product {
  productId: number;
  productName: string;
  serialNumber: string;
  modelNumber?: string;
  brand?: string;
  category?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  isUnderWarranty: boolean;
  isActive: boolean;
}



// models/product.model.ts
export interface ProductMasterDTO {
  productMasterId: number;
  productCode: string;
  productName: string;
  brand: string;
  category: string;
  subCategory: string;
  model: string;
  description: string;
  mrp: number;
  org: string;
  priceChangeStatus: string;
  priceEffectiveDate: Date | string;
  warrantyMonths: number;
  isActive: boolean;
  createdDate: Date;
  updatedDate: Date;
}

export interface ProductMasterRequest {
  productMasterId?: number;
  productCode?: string;
  productName?: string;
  brand?: string;
  category?: string;
  subCategory?: string;
  model?: string;
  description?: string;
  mrp?: number;
  org?: string;
  priceChangeStatus?: string;
  priceEffectiveDate?: Date | string;
  warrantyMonths?: number;
  isActive?: boolean;
  searchTerm?: string;
  pageNumber: number;
  pageSize: number;
  sortColumn: string;
  sortDirection: string;
}


export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}

export interface DropdownItem {
  value: string;
  label: string;
}

export interface DropdownData {
  categories: DropdownItem[];
  subCategories: DropdownItem[];
  brands: DropdownItem[];
  orgs: DropdownItem[];
}

export interface BulkOperationDto {
  ids: number[];
}

export interface BulkUpdateStatusDto {
  ids: number[];
  isActive: boolean;
}
export interface QuickComplaintData {
  brandName: string;
  modelNumber: string;
  category: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
}
// Models/ComplaintDetailModels.ts

export interface ComplaintCompleteDetail {
  complaintId: number;
  complaintNumber: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt?: string;
  priority: string;
  priorityId: number;
  statusId: number;
  statusName: string;
  statusColor?: string;
  isSLABreached: boolean;
  slaDeadline?: string;
  contactNumber?: string;
  preferredDate?: string;
  preferredTimeSlot?: string;
  category?: string;
  brandName?: string;
  modelNumber?: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;

  customer: CustomerCompleteDetail;
  product: ProductCompleteDetail;
}

export interface CustomerCompleteDetail {
  customerId: number;
  customerName: string;
  email?: string;
  mobileNumber: string;
  alternatePhone?: string;
  address?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  landmark?: string;
}

export interface ProductCompleteDetail {
  productId: number;
  productName: string;
  serialNumber?: string;
  modelNumber?: string;
  brand?: string;
  productCategory?: string;
  purchaseDate?: string;
  warrantyExpiryDate?: string;
  warrantyStatus: string;
  images?: ProductImageDetail[];
}

export interface ProductImageDetail {
  id: number;
  url: string;
  imageType?: string;
  uploadedAt: string;
}

export interface AssignmentCompleteDetail {
  assignmentId: number;
  technicianId: number;
  technicianName: string;
  technicianPhone?: string;
  technicianEmail?: string;
  specialization?: string;
  employeeCode?: string;
  rating?: number;
  role: string;
  status: string;
  assignedAt: string;
  completedAt?: string;
  scheduledDate?: string;
  startTime?: string;
  endTime?: string;
  estimatedDuration?: number;
  timeSlot?: string;
  notes?: string;
  priority?: string;
  workDone?: string;
  partsUsed?: string;
  customerFeedback?: string;
  completionRemarks?: string;
  assignedByName?: string;
}

export interface SparePartCompleteDetail {
  requestId: number;
  sparePartId: number;
  partName: string;
  partNumber?: string;
  unitPrice?: number;
  quantity: number;
  status: string;
  urgencyLevel: string;
  requestedAt: string;
  approvedAt?: string;
  dispatchedAt?: string;
  remarks?: string;
  technicianName: string;
  approvedByName?: string;
}

export interface CommentCompleteDetail {
  commentId: number;
  comment: string;
  postedBy: string;
  postedByRole: string;
  postedAt: string;
  isInternal: boolean;
}

export interface ImageCompleteDetail {
  id: number;
  url: string;
  imageName?: string;
  contentType?: string;
  imageType: string;
  uploadedByName: string;
  uploadedAt: string;
}

export interface AddCommentRequest {
  complaintId: number;
  comment: string;
  isInternal?: boolean;
}

export interface AddCommentResponse {
  success: boolean;
  message: string;
  commentId?: number;
}
