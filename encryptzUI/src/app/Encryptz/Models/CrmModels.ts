// CRM Lead Management: shapes of api/crm/... (System.Text.Json camelCase), mirroring EncryptzBL CrmDtos.
// Dates travel as ISO strings.

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation', 'Converted', 'Lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadPriority = 'Low' | 'Medium' | 'High';
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Superseded';
/** The two lists kept by api/crm/masters/{kind}. */
export type CrmMasterKind = 'sources' | 'lost-reasons';

export interface CrmMe { userId: number; fullName: string; isManager: boolean; }

export interface LeadSaveDto {
  leadId: number;
  leadDate: string;
  contactName: string;
  mobile: string;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  landmark?: string | null;
  leadSourceId?: number | null;
  productCategory?: string | null;
  modelRequirement?: string | null;
  estimatedQty?: number | null;
  expectedPurchaseDate?: string | null;
  ownerUserId?: number | null;
  priority?: string | null;
  remarks?: string | null;
}

export interface LeadListDto {
  leadId: number;
  leadNo: string;
  leadDate: string;
  contactName: string;
  mobile: string;
  email: string;
  city: string;
  sourceName: string;
  productCategory: string;
  ownerUserId: number;
  ownerName: string;
  priority: string;
  status: string;
  nextFollowUpAt?: string | null;
  orderNo?: string | null;
  totalCount: number;
}

export interface LeadHistoryDto {
  leadStatusHistoryId: number;
  fromStatus?: string | null;
  toStatus: string;
  changedBy: number;
  changedByName: string;
  changedAt: string;
  note: string;
}

export interface QuotationSummaryDto {
  quotationId: number;
  leadId: number;
  quotationNo: string;
  revisionNo: number;
  quoteDate: string;
  validUntil?: string | null;
  isInterState: boolean;
  taxableTotal: number;
  grandTotal: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  isLatest: boolean;
}

export interface FollowUpDto {
  followUpId: number;
  leadId: number;
  followUpAt: string;
  type: string;
  notes: string;
  nextFollowUpAt?: string | null;
  nextAction: string;
  userId: number;
  userName: string;
  remarks: string;
  createdAt: string;
}

export interface LeadDetailDto {
  leadId: number;
  leadNo: string;
  leadDate: string;
  contactName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  landmark: string;
  leadSourceId?: number | null;
  sourceName: string;
  productCategory: string;
  modelRequirement: string;
  estimatedQty?: number | null;
  expectedPurchaseDate?: string | null;
  ownerUserId: number;
  ownerName: string;
  priority: string;
  status: string;
  lostReasonId?: number | null;
  lostReasonName: string;
  lostAt?: string | null;
  orderNo?: string | null;
  lostNote: string;
  nextFollowUpAt?: string | null;
  customerId?: number | null;
  salesOrderId?: number | null;
  convertedAt?: string | null;
  /** The order call of a convert failed: a manager checks the sales orders, then links the order or cancels the convert. */
  convertNeedsCheck?: boolean;
  remarks: string;
  createdAt: string;
  followUps: FollowUpDto[];
  history: LeadHistoryDto[];
  quotations: QuotationSummaryDto[];
}

/** The lead list filters. Status may be several, comma separated. */
export interface LeadFilterDto {
  search?: string;
  status?: string;
  sourceId?: number;
  ownerUserId?: number;
  from?: string;
  to?: string;
  /** Today, Overdue or Pending; empty for all. */
  due?: string;
  closedFrom?: string;
  closedTo?: string;
  page?: number;
  pageSize?: number;
}

export interface FollowUpSaveDto {
  followUpAt: string;
  type: string;
  notes?: string | null;
  nextFollowUpAt?: string | null;
  nextAction?: string | null;
  remarks?: string | null;
}

export interface StatusChangeDto { status: string; lostReasonId?: number | null; note?: string | null; }
export interface ReassignDto { ownerUserId: number; }

export interface QuotationItemDto {
  quotationItemId: number;
  productMasterId?: number | null;
  productName: string;
  hsnSac?: string | null;
  qty: number;
  rate: number;
  discountAmount: number;
  gstPercent: number;
  warrantyMonths: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
  sortOrder: number;
}

export interface QuotationSaveDto {
  quotationId: number;
  leadId: number;
  quoteDate: string;
  validUntil?: string | null;
  isInterState: boolean;
  terms?: string | null;
  items: QuotationItemDto[];
}

export interface QuotationDto {
  quotationId: number;
  leadId: number;
  quotationNo: string;
  revisionNo: number;
  quoteDate: string;
  validUntil?: string | null;
  isInterState: boolean;
  subTotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  terms: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  isLatest: boolean;
  leadNo: string;
  contactName: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  leadStatus: string;
  items: QuotationItemDto[];
}

export interface CrmProductDto {
  productMasterId: number;
  productCode: string;
  productName: string;
  brand: string;
  model: string;
  category: string;
  mrp: number;
  warrantyMonths: number;
}

/** A lead source or a lost reason. */
export interface CrmMasterDto { id: number; name: string; sortOrder: number; isActive: boolean; }

export interface CrmMemberDto { userId: number; fullName: string; isManager: boolean; isActive: boolean; }
export interface CrmUserOptionDto { userId: number; fullName: string; email?: string | null; }
export interface CrmMemberListDto { members: CrmMemberDto[]; available: CrmUserOptionDto[]; }

/** A customer of the sales master that may be the same person as the lead. */
export interface SalesCustomerDto {
  customerId: number;
  customerName: string;
  mobileNumber: string;
  alternatePhone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  landmark?: string | null;
  gstin?: string | null;
  totalProducts: number;
}

export interface ConvertPreviewDto { matches: SalesCustomerDto[]; quotation: QuotationDto; }

export interface ConvertRequestDto {
  quotationId: number;
  customerId?: number | null;
  orderDate: string;
  paymentMode?: string | null;
}

export interface LinkOrderDto { orderNo: string; quotationId?: number | null; }
export interface ConvertResultDto { salesOrderId: number; orderNo: string; customerId: number; }

export interface CrmDueFollowUpDto {
  leadId: number;
  leadNo: string;
  contactName: string;
  mobile: string;
  status: string;
  priority: string;
  nextFollowUpAt?: string | null;
  nextAction: string;
  ownerUserId: number;
  ownerName: string;
  isOverdue: boolean;
}

export interface CrmDashboardDto {
  newLeads: number;
  followUpPending: number;
  todayFollowUps: number;
  overdue: number;
  qualified: number;
  quotationPending: number;
  convertedThisMonth: number;
  lostThisMonth: number;
  dueFollowUps: CrmDueFollowUpDto[];
}

/** Only the group columns of the grouping being read are filled. */
export interface CrmConversionRowDto {
  sourceName?: string | null;
  ownerUserId?: number | null;
  ownerName?: string | null;
  month?: string | null;
  leads: number;
  converted: number;
  conversionPct: number;
  convertedValue: number;
}

export interface CrmFollowUpReportRowDto {
  followUpId: number;
  followUpAt: string;
  type: string;
  notes: string;
  nextFollowUpAt?: string | null;
  nextAction: string;
  remarks: string;
  userId: number;
  userName: string;
  leadId: number;
  leadNo: string;
  contactName: string;
  mobile: string;
  city: string;
  leadStatus: string;
  ownerUserId: number;
  ownerName: string;
  sourceName: string;
}

export interface FollowUpReportFilter { from?: string; to?: string; ownerUserId?: number; }
export interface ConversionReportFilter { from?: string; to?: string; groupBy?: string; }
