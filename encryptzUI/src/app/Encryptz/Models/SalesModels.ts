// ============================================================
// SALES: Sales Order (bill) -> Despatch -> Installation -> Warranty
// (re-exported from ApiModels.ts, use `import * as M from '../../Models/ApiModels'`)
// ============================================================
export interface SalesCustomer {
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
  latitude?: number | null;
  longitude?: number | null;
  totalProducts?: number;
}

/** A customer that is the same party (same mobile or same GSTIN) as what is being entered. */
export interface CustomerMatch extends SalesCustomer { matchedOn: 'Mobile' | 'GSTIN' | string; }

/** A row of the Customers screen. */
export interface CustomerListItem extends SalesCustomer {
  totalOrders: number;
  totalComplaints: number;
  createdAt?: string | null;
  totalCount: number;
}

export interface CustomerImportRow {
  rowNumber: number;
  customerName?: string;
  mobileNumber?: string;
  alternatePhone?: string;
  email?: string;
  address?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pinCode?: string;
  gstin?: string;
}

export interface CustomerImportRowResult {
  rowNumber: number;
  customerName: string;
  mobileNumber: string;
  action: 'New' | 'Update' | 'Error' | string;
  customerId?: number | null;
  existingName?: string | null;
  message?: string | null;
}

export interface CustomerImportResult {
  applied: boolean;
  newCount: number;
  updateCount: number;
  errorCount: number;
  rows: CustomerImportRowResult[];
}

export interface SalesCustomerSave {
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
}

export interface SalesCustomerSaveResult {
  customerId: number;
  isNew: boolean;
  customer?: SalesCustomer | null;
}

export interface SalesOrderItemSave {
  salesOrderItemId: number;
  productMasterId?: number | null;
  productName: string;
  hsnSac?: string | null;
  qty: number;
  rate: number;
  discountAmount: number;
  gstPercent: number;
  warrantyMonths: number;
}

export interface SalesOrderSave {
  salesOrderId: number;
  orderDate: string;
  customerId: number;
  paymentMode?: string | null;
  paymentDueDate?: string | null;
  referenceNo?: string | null;
  contactNumber?: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  isInterState: boolean;
  notes?: string | null;
  terms?: string | null;
  warrantyText?: string | null;
  items: SalesOrderItemSave[];
}

export interface SalesOrderSaveResult {
  salesOrderId: number;
  orderNo: string;
}

export interface SalesOrderFilter {
  searchTerm?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber: number;
  pageSize: number;
}

export interface SalesOrderListItem {
  salesOrderId: number;
  orderNo: string;
  orderDate: string;
  status: string;
  paymentMode?: string | null;
  referenceNo?: string | null;
  customerId: number;
  customerName: string;
  customerMobile?: string | null;
  city?: string | null;
  subTotal: number;
  discountTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  lineCount: number;
  totalQty?: number | null;
  despatchId?: number | null;
  despatchNo?: string | null;
  despatchDate?: string | null;
  installationComplaintId?: number | null;
  installationComplaintNo?: string | null;
  installationStatus?: string | null;
  createdAt: string;
  totalCount: number;
}

export interface SalesOrderHeader {
  terms?: string | null;
  warrantyText?: string | null;
  salesOrderId: number;
  orderNo: string;
  orderDate: string;
  status: string;
  paymentMode?: string | null;
  paymentDueDate?: string | null;
  referenceNo?: string | null;
  customerId: number;
  customerName: string;
  customerMobile?: string | null;
  customerEmail?: string | null;
  contactNumber?: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  isInterState: boolean;
  notes?: string | null;
  subTotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  grandTotal: number;
  createdAt: string;
  updatedAt?: string | null;
}

export interface SalesOrderItem {
  productDescription?: string | null;
  mrp?: number | null;
  salesOrderItemId: number;
  salesOrderId: number;
  productMasterId?: number | null;
  productName: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  hsnSac?: string | null;
  qty: number;
  rate: number;
  discountAmount: number;
  gstPercent: number;
  taxableAmount: number;
  gstAmount: number;
  lineTotal: number;
  warrantyMonths: number;
  despatchedQty: number;
  serialNumbers?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
}

export interface DespatchSummary {
  despatchId: number;
  despatchNo: string;
  despatchDate: string;
  deliveryAddress?: string | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  trackingNo?: string | null;
  despatchMode?: string | null;
  referenceDate?: string | null;
  remarks?: string | null;
  status: string;
  installationComplaintId?: number | null;
  installationComplaintNo?: string | null;
  installationStatus?: string | null;
  installationStatusColor?: string | null;
  assignedTechnicians?: string | null;
  createdAt: string;
}

export interface SalesOrderDetail {
  order: SalesOrderHeader;
  items: SalesOrderItem[];
  despatches: DespatchSummary[];
}

export interface DespatchUnit {
  salesOrderItemId: number;
  serialNumber?: string | null;
}

export interface DespatchCreate {
  salesOrderId: number;
  despatchDate?: string | null;
  deliveryAddress?: string | null;
  contactPerson?: string | null;
  contactNumber?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  trackingNo?: string | null;
  despatchMode?: string | null;
  referenceDate?: string | null;
  remarks?: string | null;
  createInstallationComplaint: boolean;
  priority?: string | null;
  preferredDate?: string | null;
  units: DespatchUnit[];
}

/** How goods leave, and what the reference number of that mode is called. */
export const DESPATCH_MODES: { value: string; reference: string; carrier: boolean; vehicle: boolean }[] = [
  { value: 'Own Vehicle', reference: 'Trip / Gate Pass No', carrier: false, vehicle: true },
  { value: 'Road Transport', reference: 'LR No', carrier: true, vehicle: true },
  { value: 'Courier', reference: 'AWB / Docket No', carrier: true, vehicle: false },
  { value: 'Rail', reference: 'RR No', carrier: true, vehicle: false },
  { value: 'Air', reference: 'Air Waybill No', carrier: true, vehicle: false },
  { value: 'Sea', reference: 'Bill of Lading No', carrier: true, vehicle: false },
  { value: 'Hand Delivery', reference: 'Delivery Note No', carrier: false, vehicle: false },
  { value: 'Customer Pickup', reference: 'Gate Pass No', carrier: false, vehicle: true },
];

/** A spare part or repaired part in the single Despatch screen. */
export interface ServiceDespatchItem {
  sourceType: 'Spare' | 'Repair';
  sourceId: number;
  complaintId?: number | null;
  complaintNumber?: string | null;
  partName?: string | null;
  partReference?: string | null;
  quantity: number;
  urgencyLevel?: string | null;
  status?: string | null;
  technicianName?: string | null;
  customerName?: string | null;
  customerMobile?: string | null;
  readyAt?: string | null;
  serviceDespatchId?: number | null;
  despatchNo?: string | null;
  despatchDate?: string | null;
  despatchMode?: string | null;
  referenceNo?: string | null;
  referenceDate?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  remarks?: string | null;
  unitPrice?: number | null;
  stockQuantity?: number | null;
  requestNotes?: string | null;
  statusNotes?: string | null;
  requestedAt?: string | null;
  approvedAt?: string | null;
  approvedByName?: string | null;
  complaintSubject?: string | null;
  productName?: string | null;
  productSerial?: string | null;
  customerAddress?: string | null;
  customerCity?: string | null;
  technicianMobile?: string | null;
  despatchedAt?: string | null;
  despatchedByName?: string | null;
  addedLater?: boolean;
  totalCount?: number;
}

export interface ServiceDespatchFilter {
  stage: 'Pending' | 'Despatched';
  sourceType?: 'Spare' | 'Repair';
  searchTerm?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber: number;
  pageSize: number;
}

/** The missing mode and reference of an older sales despatch. */
export interface DespatchDetailsSave {
  despatchMode: string;
  referenceNo: string;
  referenceDate?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
}

export interface ServiceDespatchCreate {
  sourceType: 'Spare' | 'Repair';
  sourceId: number;
  despatchDate: string;
  despatchMode: string;
  referenceNo?: string | null;
  referenceDate?: string | null;
  transporterName?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  remarks?: string | null;
}

export const SALES_DOCUMENT_TYPES =['Invoice', 'E-Way Bill', 'Delivery Challan', 'LR / Consignment Note', 'Purchase Order', 'Other'];

/**
 * The steps of a sales order (as dbo.sp_SalesOrder_SetStatus): Sales Order → Sales Confirmed → Billed → Despatched.
 * Billed needs an Invoice PDF attached; a billed order is what the Despatch screen lists as pending.
 */
export const SALES_ORDER_STEPS = ['Sales Order', 'Sales Confirmed', 'Billed', 'Despatched'] as const;
export const SALES_ORDER_STATUSES = [...SALES_ORDER_STEPS, 'Cancelled'];
/** An order that can still be changed: it is not billed yet. */
export const isOpenSalesOrder = (status: string | null | undefined) => status === 'Sales Order' || status === 'Sales Confirmed';
/** The step a person may move the order to next, or null. */
export const nextSalesOrderStep = (status: string | null | undefined): 'Sales Confirmed' | 'Billed' | null =>
  status === 'Sales Order' ? 'Sales Confirmed' : status === 'Sales Confirmed' ? 'Billed' : null;
/** The document type that must be attached before an order is marked Billed. */
export const INVOICE_DOCUMENT_TYPE = 'Invoice';
/** Why a sales order is not at Despatch, or '' when it may be despatched. */
export const notDespatchableReason = (orderNo: string, status: string): string =>
  status === 'Billed' ? ''
    : isOpenSalesOrder(status) ? `Sales order ${orderNo} is not billed yet. Attach its invoice and mark it billed first.`
    : `Sales order ${orderNo} is ${status.toLowerCase()} and cannot be despatched.`;

/** A PDF attached to a bill, from the Sales Order or the Despatch screen. */
export interface SalesDocument {
  documentId: number;
  salesOrderId: number;
  despatchId?: number | null;
  despatchNo?: string | null;
  documentType: string;
  fileName: string;
  fileSize: number;
  uploadedAt: string;
  uploadedByName?: string | null;
}

export interface DespatchCreateResult {
  despatchId: number;
  despatchNo: string;
  complaintId?: number | null;
  complaintNumber?: string | null;
}

export interface DespatchFilter {
  searchTerm?: string;
  fromDate?: string;
  toDate?: string;
  pageNumber: number;
  pageSize: number;
}

export interface DespatchListItem {
  despatchId: number;
  despatchNo: string;
  despatchDate: string;
  status: string;
  transporterName?: string | null;
  vehicleNo?: string | null;
  trackingNo?: string | null;
  despatchMode?: string | null;
  referenceDate?: string | null;
  salesOrderId: number;
  orderNo: string;
  orderDate: string;
  grandTotal: number;
  customerId: number;
  customerName: string;
  customerMobile?: string | null;
  city?: string | null;
  unitCount: number;
  warrantyEndDate?: string | null;
  warrantyStatus?: string | null;
  installationComplaintId?: number | null;
  installationComplaintNo?: string | null;
  installationStatus?: string | null;
  installationStatusColor?: string | null;
  assignedTechnicians?: string | null;
  createdAt: string;
  totalCount: number;
}

export interface DespatchHeader extends DespatchSummary {
  salesOrderId: number;
  orderNo: string;
  orderDate: string;
  grandTotal: number;
  paymentMode?: string | null;
  customerId: number;
  customerName: string;
  customerMobile?: string | null;
  customerEmail?: string | null;
}

export interface DespatchUnitDetail {
  despatchItemId: number;
  salesOrderItemId: number;
  productId?: number | null;
  serialNumber: string;
  productName: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  hsnSac?: string | null;
  warrantyMonths: number;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  warrantyStatus?: string | null;
  warrantyDaysLeft?: number | null;
}

export interface DespatchDetail {
  despatch: DespatchHeader;
  units: DespatchUnitDetail[];
}

export interface WarrantyLookupItem {
  productId: number;
  productName: string;
  serialNumber: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  purchaseDate?: string | null;
  warrantyExpiryDate?: string | null;
  warrantyStatus: string;
  warrantyDaysLeft?: number | null;
  customerId: number;
  customerName: string;
  customerMobile?: string | null;
  city?: string | null;
  salesOrderId?: number | null;
  orderNo?: string | null;
  orderDate?: string | null;
  despatchId?: number | null;
  despatchNo?: string | null;
  despatchDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyMonths?: number | null;
  totalComplaints: number;
  openComplaints: number;
  lastComplaintNo?: string | null;
  lastComplaintStatus?: string | null;
  lastComplaintAt?: string | null;
  lastComplaintType?: string | null;
  totalCount: number;
}

export interface WarrantyLookupFilter {
  search?: string;
  customerId?: number;
  /** true = in warranty only, false = expired / no warranty only, undefined = all */
  onlyActive?: boolean;
  pageNumber: number;
  pageSize: number;
}

export const SALES_PAYMENT_MODES = ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Cheque', 'Credit'];
export const SALES_GST_RATES = [0, 5, 12, 18, 28];
export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/** A registered transporter (Despatch › Transporters). */
export interface TransporterDto {
  transporterId: number;
  transporterName: string;
  contactPerson: string;
  mobile: string;
  gstin: string;
  address: string;
  isActive: boolean;
}
export type TransporterSave = TransporterDto;
