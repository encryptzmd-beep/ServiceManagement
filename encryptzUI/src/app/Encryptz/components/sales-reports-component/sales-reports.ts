import { DespatchListItem, SalesOrderListItem } from '../../Models/ApiModels';
import { ReportColumn } from '../crm-reports-component/crm-export';

export type SalesReportKey = 'register' | 'customers' | 'gst' | 'pending' | 'despatch' | 'modes';
export type SalesReportRow = Record<string, string | number | null>;

export interface SalesReportLink { key: SalesReportKey; label: string; icon: string; }

/** Keys are the URL (/sales/reports/<key>) and the sidebar rows of MainDB/34_Sales_Reports_Menus.sql. */
export const SALES_REPORTS: SalesReportLink[] = [
  { key: 'register', label: 'Sales register', icon: 'receipt_long' },
  { key: 'customers', label: 'Sales by customer', icon: 'groups' },
  { key: 'gst', label: 'GST summary', icon: 'account_balance' },
  { key: 'pending', label: 'Pending despatch', icon: 'pending_actions' },
  { key: 'despatch', label: 'Despatch register', icon: 'local_shipping' },
  { key: 'modes', label: 'Despatch by mode', icon: 'alt_route' },
];

export interface SalesReportData { orders: SalesOrderListItem[]; despatches: DespatchListItem[]; }

export interface SalesReportView {
  key: SalesReportKey;
  title: string;
  note: string;
  dated: boolean;
  stats: { label: string; value: string }[];
  columns: ReportColumn<SalesReportRow>[];
  rows: SalesReportRow[];
}

export const rupees = (v: number | null | undefined) => '₹' + Math.round(v ?? 0).toLocaleString('en-IN');

const day = (v: string | null | undefined) => (v ?? '').slice(0, 10);
const inRange = (v: string, from: string, to: string) => (!from || day(v) >= from) && (!to || day(v) <= to);
const sum = <T>(list: T[], pick: (x: T) => number | null | undefined) => list.reduce((s, x) => s + Number(pick(x) ?? 0), 0);
const tax = (o: SalesOrderListItem) => Number(o.cgst ?? 0) + Number(o.sgst ?? 0) + Number(o.igst ?? 0);
const taxable = (o: SalesOrderListItem) => Number(o.subTotal ?? 0) - Number(o.discountTotal ?? 0);

function parseDay(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v ?? '');
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function showDay(v: string | null | undefined): string {
  const d = parseDay(v ?? '');
  return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
}

function daysSince(v: string, today: Date): number {
  const d = parseDay(v);
  if (!d) return 0;
  return Math.max(0, Math.round((Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86_400_000));
}

function register(d: SalesReportData, from: string, to: string): SalesReportView {
  const list = d.orders.filter(o => inRange(o.orderDate, from, to)).sort((a, b) => day(b.orderDate).localeCompare(day(a.orderDate)) || b.salesOrderId - a.salesOrderId);
  const live = list.filter(o => o.status !== 'Cancelled');
  return {
    key: 'register', title: 'Sales register', note: 'Filtered by bill date. Totals leave out cancelled bills.', dated: true,
    stats: [
      { label: 'Bills', value: String(live.length) },
      { label: 'Sales value', value: rupees(sum(live, o => o.grandTotal)) },
      { label: 'GST', value: rupees(sum(live, tax)) },
      { label: 'Cancelled', value: String(list.length - live.length) },
    ],
    columns: [
      { key: 'bill', title: 'Bill No' }, { key: 'date', title: 'Date' }, { key: 'customer', title: 'Customer' }, { key: 'city', title: 'City' },
      { key: 'payment', title: 'Payment' }, { key: 'status', title: 'Status' }, { key: 'taxable', title: 'Taxable', kind: 'money' },
      { key: 'gst', title: 'GST', kind: 'money' }, { key: 'total', title: 'Total', kind: 'money' }, { key: 'despatch', title: 'Despatch No' },
    ],
    rows: list.map(o => ({
      bill: o.orderNo, date: showDay(o.orderDate), customer: o.customerName, city: o.city ?? '', payment: o.paymentMode ?? '',
      status: o.status, taxable: taxable(o), gst: tax(o), total: o.grandTotal, despatch: o.despatchNo ?? '',
    })),
  };
}

function customers(d: SalesReportData, from: string, to: string): SalesReportView {
  const live = d.orders.filter(o => o.status !== 'Cancelled' && inRange(o.orderDate, from, to));
  const groups = new Map<number, SalesOrderListItem[]>();
  for (const o of live) groups.set(o.customerId, [...(groups.get(o.customerId) ?? []), o]);
  const rows = [...groups.values()].map<SalesReportRow>(list => ({
    customer: list[0].customerName, mobile: list[0].customerMobile ?? '', city: list[0].city ?? '', bills: list.length,
    qty: sum(list, o => o.totalQty), value: sum(list, o => o.grandTotal),
    pending: list.filter(o => o.status === 'Billed').length,
    last: showDay(list.map(o => day(o.orderDate)).sort().at(-1)),
  })).sort((a, b) => Number(b['value']) - Number(a['value']));
  const total = sum(rows, r => Number(r['value']));
  return {
    key: 'customers', title: 'Sales by customer', note: 'Highest sales first, without cancelled bills.', dated: true,
    stats: [
      { label: 'Customers', value: String(rows.length) },
      { label: 'Sales value', value: rupees(total) },
      { label: 'Average per customer', value: rupees(rows.length ? total / rows.length : 0) },
      { label: 'Top customer', value: rows.length ? String(rows[0]['customer']) : '–' },
    ],
    columns: [
      { key: 'customer', title: 'Customer' }, { key: 'mobile', title: 'Mobile' }, { key: 'city', title: 'City' }, { key: 'bills', title: 'Bills', kind: 'number' },
      { key: 'qty', title: 'Qty', kind: 'number' }, { key: 'value', title: 'Sales value', kind: 'money' },
      { key: 'pending', title: 'Not despatched', kind: 'number' }, { key: 'last', title: 'Last bill' },
    ],
    rows,
  };
}

function gst(d: SalesReportData, from: string, to: string): SalesReportView {
  const live = d.orders.filter(o => o.status !== 'Cancelled' && inRange(o.orderDate, from, to));
  const groups = new Map<string, SalesOrderListItem[]>();
  for (const o of live) { const m = day(o.orderDate).slice(0, 7); groups.set(m, [...(groups.get(m) ?? []), o]); }
  const rows = [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0])).map<SalesReportRow>(([month, list]) => ({
    month: parseDay(month + '-01')?.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) ?? month,
    bills: list.length, taxable: sum(list, taxable), cgst: sum(list, o => o.cgst), sgst: sum(list, o => o.sgst), igst: sum(list, o => o.igst),
    tax: sum(list, tax), total: sum(list, o => o.grandTotal),
  }));
  return {
    key: 'gst', title: 'GST summary', note: 'By bill month, without cancelled bills. Check it against your filed returns.', dated: true,
    stats: [
      { label: 'Taxable value', value: rupees(sum(live, taxable)) },
      { label: 'CGST', value: rupees(sum(live, o => o.cgst)) },
      { label: 'SGST', value: rupees(sum(live, o => o.sgst)) },
      { label: 'IGST', value: rupees(sum(live, o => o.igst)) },
    ],
    columns: [
      { key: 'month', title: 'Month' }, { key: 'bills', title: 'Bills', kind: 'number' }, { key: 'taxable', title: 'Taxable', kind: 'money' },
      { key: 'cgst', title: 'CGST', kind: 'money' }, { key: 'sgst', title: 'SGST', kind: 'money' }, { key: 'igst', title: 'IGST', kind: 'money' },
      { key: 'tax', title: 'Total GST', kind: 'money' }, { key: 'total', title: 'Bill value', kind: 'money' },
    ],
    rows,
  };
}

function pending(d: SalesReportData, today: Date): SalesReportView {
  const list = d.orders.filter(o => o.status === 'Billed')
    .map(o => ({ o, age: daysSince(o.orderDate, today) })).sort((a, b) => b.age - a.age);
  return {
    key: 'pending', title: 'Pending despatch', note: 'Bills not despatched yet, the oldest first.', dated: false,
    stats: [
      { label: 'Bills waiting', value: String(list.length) },
      { label: 'Value', value: rupees(sum(list, x => x.o.grandTotal)) },
      { label: 'Over 3 days', value: String(list.filter(x => x.age > 3).length) },
      { label: 'Oldest', value: list.length ? `${list[0].age} days` : '–' },
    ],
    columns: [
      { key: 'bill', title: 'Bill No' }, { key: 'date', title: 'Date' }, { key: 'customer', title: 'Customer' }, { key: 'mobile', title: 'Mobile' },
      { key: 'city', title: 'City' }, { key: 'qty', title: 'Qty', kind: 'number' }, { key: 'total', title: 'Total', kind: 'money' }, { key: 'age', title: 'Days waiting', kind: 'number' },
    ],
    rows: list.map(({ o, age }) => ({
      bill: o.orderNo, date: showDay(o.orderDate), customer: o.customerName, mobile: o.customerMobile ?? '', city: o.city ?? '',
      qty: o.totalQty ?? null, total: o.grandTotal, age,
    })),
  };
}

function despatch(d: SalesReportData, from: string, to: string): SalesReportView {
  const list = d.despatches.filter(x => inRange(x.despatchDate, from, to)).sort((a, b) => day(b.despatchDate).localeCompare(day(a.despatchDate)) || b.despatchId - a.despatchId);
  return {
    key: 'despatch', title: 'Despatch register', note: 'Filtered by despatch date.', dated: true,
    stats: [
      { label: 'Despatches', value: String(list.length) },
      { label: 'Units', value: String(sum(list, x => x.unitCount)) },
      { label: 'Bill value', value: rupees(sum(list, x => x.grandTotal)) },
      { label: 'No reference', value: String(list.filter(x => !x.trackingNo?.trim()).length) },
    ],
    columns: [
      { key: 'no', title: 'Despatch No' }, { key: 'date', title: 'Date' }, { key: 'bill', title: 'Bill No' }, { key: 'customer', title: 'Customer' },
      { key: 'mode', title: 'Mode' }, { key: 'reference', title: 'Reference' }, { key: 'carrier', title: 'Transporter' }, { key: 'vehicle', title: 'Vehicle' },
      { key: 'units', title: 'Units', kind: 'number' }, { key: 'value', title: 'Bill value', kind: 'money' }, { key: 'install', title: 'Installation' },
    ],
    rows: list.map(x => ({
      no: x.despatchNo, date: showDay(x.despatchDate), bill: x.orderNo, customer: x.customerName, mode: x.despatchMode ?? '', reference: x.trackingNo ?? '',
      carrier: x.transporterName ?? '', vehicle: x.vehicleNo ?? '', units: x.unitCount, value: x.grandTotal, install: x.installationStatus ?? '',
    })),
  };
}

function modes(d: SalesReportData, from: string, to: string): SalesReportView {
  const list = d.despatches.filter(x => inRange(x.despatchDate, from, to));
  const groups = new Map<string, DespatchListItem[]>();
  for (const x of list) { const m = x.despatchMode?.trim() || 'Not set'; groups.set(m, [...(groups.get(m) ?? []), x]); }
  const rows = [...groups.entries()].map<SalesReportRow>(([mode, g]) => ({
    mode, count: g.length, share: list.length ? Math.round((g.length / list.length) * 1000) / 10 : 0, units: sum(g, x => x.unitCount),
    value: sum(g, x => x.grandTotal), noRef: g.filter(x => !x.trackingNo?.trim()).length,
  })).sort((a, b) => Number(b['count']) - Number(a['count']));
  return {
    key: 'modes', title: 'Despatch by mode', note: 'Despatches made before the mode was recorded show as Not set.', dated: true,
    stats: [
      { label: 'Despatches', value: String(list.length) },
      { label: 'Modes used', value: String(rows.filter(r => r['mode'] !== 'Not set').length) },
      { label: 'Most used', value: rows.length ? String(rows[0]['mode']) : '–' },
      { label: 'No reference', value: String(sum(rows, r => Number(r['noRef']))) },
    ],
    columns: [
      { key: 'mode', title: 'Mode' }, { key: 'count', title: 'Despatches', kind: 'number' }, { key: 'share', title: 'Share', kind: 'percent' },
      { key: 'units', title: 'Units', kind: 'number' }, { key: 'value', title: 'Bill value', kind: 'money' }, { key: 'noRef', title: 'No reference', kind: 'number' },
    ],
    rows,
  };
}

export function buildSalesReport(key: SalesReportKey, data: SalesReportData, today: Date, from = '', to = ''): SalesReportView {
  switch (key) {
    case 'customers': return customers(data, from, to);
    case 'gst': return gst(data, from, to);
    case 'pending': return pending(data, today);
    case 'despatch': return despatch(data, from, to);
    case 'modes': return modes(data, from, to);
    default: return register(data, from, to);
  }
}
