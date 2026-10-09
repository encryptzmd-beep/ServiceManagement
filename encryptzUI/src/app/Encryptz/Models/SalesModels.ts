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
  referenceNo?: string | null;
  contactNumber?: string | null;
  gstin?: string | null;
  billingAddress?: string | null;
  city?: string | null;
  state?: string | null;
  pinCode?: string | null;
  isInterState: boolean;
  notes?: string | null;
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
  salesOrderId: number;
  orderNo: string;
  orderDate: string;
  status: string;
  paymentMode?: string | null;
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
  remarks?: string | null;
  createInstallationComplaint: boolean;
  priority?: string | null;
  preferredDate?: string | null;
  units: DespatchUnit[];
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
