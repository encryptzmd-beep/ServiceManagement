import { CustomerImportRow } from '../../Models/ApiModels';
import { addSheet, cellText, download, workbook } from '../crm-leads-component/crm-lead-excel';

export const MAX_CUSTOMER_ROWS = 1000;

/** The columns of the customer upload template. Customer Name and Mobile are required. */
export const CUSTOMER_COLUMNS: { title: string; key: Exclude<keyof CustomerImportRow, 'rowNumber'>; aliases?: string[] }[] = [
  { title: 'Customer Name', key: 'customerName', aliases: ['name', 'party name', 'party', 'customer'] },
  { title: 'Mobile', key: 'mobileNumber', aliases: ['mobile number', 'phone', 'phone number', 'contact number'] },
  { title: 'Alternate Phone', key: 'alternatePhone', aliases: ['alternate mobile', 'phone 2'] },
  { title: 'Email', key: 'email', aliases: ['e-mail', 'email id'] },
  { title: 'GSTIN', key: 'gstin', aliases: ['gst', 'gst no', 'gst number', 'gstin no'] },
  { title: 'Address', key: 'address' },
  { title: 'Landmark', key: 'landmark' },
  { title: 'City', key: 'city', aliases: ['place', 'town'] },
  { title: 'State', key: 'state' },
  { title: 'Pin Code', key: 'pinCode', aliases: ['pin', 'pincode', 'postal code'] },
];

export interface CustomerFileRead { rows: CustomerImportRow[]; problem: string; }

/** Pure, so it can be tested: the first row is the header, in any column order and with common other names. */
export function customerRowsFromSheet(sheet: any[][]): CustomerFileRead {
  const header = (sheet[0] ?? []).map(h => cellText(h).toLowerCase().replace(/\s+/g, ' ').trim());
  const at = new Map(CUSTOMER_COLUMNS.map(c => [c.key,
    header.findIndex(h => h === c.title.toLowerCase() || (c.aliases ?? []).includes(h))]));
  if (at.get('customerName')! < 0 || at.get('mobileNumber')! < 0) {
    return { rows: [], problem: 'Use the template: the Customer Name and Mobile columns are missing' };
  }
  const rows: CustomerImportRow[] = [];
  sheet.slice(1).forEach((cells, i) => {
    const row: CustomerImportRow = { rowNumber: i + 2 };
    let any = false;
    for (const c of CUSTOMER_COLUMNS) {
      const index = at.get(c.key)!;
      const text = index >= 0 ? cellText(cells?.[index]) : '';
      if (text) any = true;
      row[c.key] = text;
    }
    if (any) rows.push(row);
  });
  if (!rows.length) return { rows, problem: 'The file has no customers' };
  if (rows.length > MAX_CUSTOMER_ROWS) return { rows: [], problem: `Upload at most ${MAX_CUSTOMER_ROWS} customers at a time` };
  return { rows, problem: '' };
}

export async function downloadCustomerTemplate(): Promise<void> {
  const wb = await workbook();
  addSheet(wb, 'Customers', CUSTOMER_COLUMNS.map(c => c.title), []);
  await download(wb, 'Customer-upload-template.xlsx');
}

export async function readCustomersExcel(file: File): Promise<CustomerFileRead> {
  try {
    const wb = await workbook();
    await wb.xlsx.load(await file.arrayBuffer());
    const ws = wb.worksheets[0];
    if (!ws) return { rows: [], problem: 'The file has no sheet' };
    const sheet: any[][] = [];
    ws.eachRow({ includeEmpty: true }, (row: any, number: number) => {
      const cells: any[] = [];
      row.eachCell({ includeEmpty: true }, (cell: any, col: number) => { cells[col - 1] = cell.value; });
      sheet[number - 1] = cells;
    });
    return customerRowsFromSheet(sheet);
  } catch {
    return { rows: [], problem: 'This file could not be read. Use an .xlsx file' };
  }
}
