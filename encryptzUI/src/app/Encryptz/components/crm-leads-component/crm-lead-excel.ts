import { LeadExportRowDto, LeadImportRowDto } from '../../Models/CrmModels';

export const MAX_IMPORT_ROWS = 1000;

/** The columns of the import template. Contact Name and Mobile are required. */
export const IMPORT_COLUMNS: { title: string; key: Exclude<keyof LeadImportRowDto, 'rowNumber'> }[] = [
  { title: 'Contact Name', key: 'contactName' },
  { title: 'Mobile', key: 'mobile' },
  { title: 'Email', key: 'email' },
  { title: 'Address', key: 'address' },
  { title: 'City', key: 'city' },
  { title: 'State', key: 'state' },
  { title: 'Pin Code', key: 'pinCode' },
  { title: 'Landmark', key: 'landmark' },
  { title: 'Product Category', key: 'productCategory' },
  { title: 'Requirement', key: 'modelRequirement' },
  { title: 'Priority', key: 'priority' },
  { title: 'Remarks', key: 'remarks' },
];

const EXPORT_COLUMNS: { title: string; key: keyof LeadExportRowDto }[] = [
  { title: 'Lead No', key: 'leadNo' }, { title: 'Lead Date', key: 'leadDate' }, { title: 'Contact Name', key: 'contactName' },
  { title: 'Mobile', key: 'mobile' }, { title: 'Email', key: 'email' }, { title: 'Address', key: 'address' }, { title: 'City', key: 'city' },
  { title: 'State', key: 'state' }, { title: 'Pin Code', key: 'pinCode' }, { title: 'Landmark', key: 'landmark' },
  { title: 'Source', key: 'sourceName' }, { title: 'Product Category', key: 'productCategory' }, { title: 'Products', key: 'products' },
  { title: 'Requirement', key: 'modelRequirement' }, { title: 'Estimated Qty', key: 'estimatedQty' },
  { title: 'Expected Purchase', key: 'expectedPurchaseDate' }, { title: 'Owner', key: 'ownerName' }, { title: 'Priority', key: 'priority' },
  { title: 'Status', key: 'status' }, { title: 'Remarks', key: 'remarks' },
];

export const workbook = async () => {
  const mod: any = await import('exceljs');
  const Workbook = (mod.default ?? mod).Workbook ?? mod.Workbook;
  return new Workbook();
};

export async function download(wb: any, fileName: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Every value is written as text, so a cell that starts with = never runs as a formula. */
const asText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 10) : text;
};

export function addSheet(wb: any, name: string, titles: string[], rows: string[][]): void {
  const ws = wb.addWorksheet(name);
  ws.columns = titles.map((title, i) => ({
    header: title,
    width: Math.min(40, Math.max(title.length + 2, ...rows.map(r => r[i].length + 2))),
    style: { numFmt: '@' },
  }));
  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

export async function downloadLeadTemplate(): Promise<void> {
  const wb = await workbook();
  addSheet(wb, 'Leads', IMPORT_COLUMNS.map(c => c.title), []);
  await download(wb, 'Lead-import-template.xlsx');
}

export async function writeLeadsExcel(rows: LeadExportRowDto[], today: string): Promise<void> {
  const wb = await workbook();
  addSheet(wb, 'Leads', EXPORT_COLUMNS.map(c => c.title), rows.map(r => EXPORT_COLUMNS.map(c => asText(r[c.key]))));
  await download(wb, `Leads-${today}.xlsx`);
}

/** The text of a cell, whatever Excel stored in it (a mobile is often a number). */
export function cellText(value: any): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if (Array.isArray(value.richText)) return value.richText.map((x: any) => x.text).join('').trim();
    if ('text' in value) return String(value.text ?? '').trim();
    if ('result' in value) return cellText(value.result);
    return '';
  }
  return String(value).trim();
}

export interface LeadFileRead { rows: LeadImportRowDto[]; problem: string; }

/** Pure, so it can be tested: the first row is the header, in any column order. */
export function rowsFromSheet(sheet: any[][]): LeadFileRead {
  const header = (sheet[0] ?? []).map(h => cellText(h).toLowerCase());
  const at = new Map(IMPORT_COLUMNS.map(c => [c.key, header.indexOf(c.title.toLowerCase())]));
  if (at.get('contactName')! < 0 || at.get('mobile')! < 0) {
    return { rows: [], problem: 'Use the template: the Contact Name and Mobile columns are missing' };
  }
  const rows: LeadImportRowDto[] = [];
  sheet.slice(1).forEach((cells, i) => {
    const row: LeadImportRowDto = { rowNumber: i + 2 };
    let any = false;
    for (const c of IMPORT_COLUMNS) {
      const index = at.get(c.key)!;
      const text = index >= 0 ? cellText(cells?.[index]) : '';
      if (text) any = true;
      row[c.key] = text;
    }
    if (any) rows.push(row);
  });
  if (!rows.length) return { rows, problem: 'The file has no leads' };
  if (rows.length > MAX_IMPORT_ROWS) return { rows: [], problem: `Import at most ${MAX_IMPORT_ROWS} leads at a time` };
  return { rows, problem: '' };
}

export async function readLeadsExcel(file: File): Promise<LeadFileRead> {
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
    return rowsFromSheet(sheet);
  } catch {
    return { rows: [], problem: 'This file could not be read. Use an .xlsx file' };
  }
}
