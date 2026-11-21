// CRM Lead Management: shapes of api/crm/... (System.Text.Json camelCase), mirroring EncryptzBL CrmDtos.
// Dates travel as ISO strings.

export const LEAD_STATUSES = ['New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation', 'Converted', 'Lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export type LeadPriority = 'Low' | 'Medium' | 'High';
export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Superseded' | 'Cancelled';
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
  productMasterId?: number | null;
  modelRequirement?: string | null;
  estimatedQty?: number | null;
  expectedPurchaseDate?: string | null;
  ownerUserId?: number | null;
  priority?: string | null;
  remarks?: string | null;
  /** The products of the lead, first one first; left out to keep them as they are. */
  products?: LeadProductDto[];
}

export interface LeadDataAccessDto {
  isAdmin: boolean; canImport: boolean; canExport: boolean; importApproved: boolean; exportApproved: boolean;
  importPending: boolean; exportPending: boolean; pendingCount: number;
}

export interface LeadDataRequestRowDto {
  requestId: number; requestType: 'Import' | 'Export'; requestedBy: number; requestedByName: string; requestedAt: string; note: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Used'; decidedByName: string; decidedAt?: string | null; decisionNote: string; usedAt?: string | null;
}

export interface LeadExportRowDto {
  leadNo: string; leadDate: string; contactName: string; mobile: string; email: string; address: string; city: string; state: string;
  pinCode: string; landmark: string; sourceName: string; productCategory: string; products: string; modelRequirement: string;
  estimatedQty?: number | null; expectedPurchaseDate?: string | null; ownerName: string; priority: string; status: string; remarks: string;
}

export interface LeadImportRowDto {
  rowNumber: number; contactName?: string; mobile?: string; email?: string; address?: string; city?: string; state?: string;
  pinCode?: string; landmark?: string; productCategory?: string; modelRequirement?: string; priority?: string; remarks?: string;
}

export interface LeadImportResultDto {
  created: number; skipped: number; failed: number;
  problems: { rowNumber: number; contactName: string; message: string }[];
}

/** A product of a lead, with its quantity. */
export interface LeadProductDto {
  productMasterId: number;
  productCode: string;
  productName: string;
  brand: string;
  model: string;
  category: string;
  mrp: number;
  warrantyMonths: number;
  hsnSac?: string | null;
  qty: number;
}

/** One status tab of the lead list: how many leads have the status under the list's other filters. */
export interface LeadStatusCountDto { status: string; count: number; }

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
  products?: LeadProductDto[];
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
  productMasterId?: number | null;
  productName?: string | null;
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
  hsnSac?: string | null;
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
  comment?: string | null;
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

/* ── Board, quotation list and the new reports (Task 3 DTOs) ── */

/** One open lead on the board, with its latest quotation and one flag per attention rule. */
export interface CrmBoardCardDto {
  leadId: number;
  leadNo: string;
  contactName: string;
  city: string | null;
  status: string;
  priority: string;
  ownerUserId: number;
  ownerName: string;
  nextFollowUpAt: string | null;
  statusSince: string | null;
  daysInStage: number;
  quotationId: number | null;
  quotationNo: string | null;
  quotationStatus: string | null;
  quotationValue: number | null;
  quotationSentAt: string | null;
  isOverdue: boolean;
  isDueToday: boolean;
  isNewNotContacted: boolean;
  hasNoFollowUp: boolean;
  isQuotationWaiting: boolean;
  isStuck: boolean;
}

/** The counts per attention rule, plus the month figures. */
export interface CrmAttentionCountsDto {
  overdue: number;
  dueToday: number;
  newNotContacted: number;
  noFollowUp: number;
  quotationWaiting: number;
  stuck: number;
  openLeads: number;
  convertedThisMonth: number;
  lostThisMonth: number;
}

export interface CrmBoardDto {
  cards: CrmBoardCardDto[];
  counts: CrmAttentionCountsDto;
  /** True when more leads are open than the cards shown (at most 500). */
  truncated: boolean;
}

/** One row of the quotation list. */
export interface QuotationListRowDto {
  quotationId: number;
  quotationNo: string;
  revisionNo: number;
  quoteDate: string;
  leadId: number;
  leadNo: string;
  contactName: string;
  ownerName: string;
  status: string;
  grandTotal: number;
  sentAt: string | null;
  ageDays: number;
  totalCount: number;
}

export interface QuotationFilterDto {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export interface CrmPipelineRowDto {
  status: string;
  leads: number;
  quotationValue: number;
  avgDaysInStage: number;
}

export interface CrmSourceRowDto {
  sourceName: string;
  leads: number;
  converted: number;
  lost: number;
  openLeads: number;
  conversionPct: number;
  convertedValue: number;
}

export interface CrmTeamRowDto {
  ownerUserId: number;
  ownerName: string;
  leads: number;
  followUpsDone: number;
  overdueNow: number;
  converted: number;
  lost: number;
  convertedValue: number;
}

export interface CrmLostReasonRowDto {
  reasonName: string;
  leads: number;
  pctOfLost: number;
  valueLost: number;
}
