export interface ReportColumn<T> {
  key: keyof T & string;
  title: string;
  kind?: 'text' | 'number' | 'money' | 'percent' | 'date' | 'datetime';
}

export interface ReportExport<T> {
  key: string;
  title: string;
  filters: string;
  columns: ReportColumn<T>[];
  rows: T[];
  companyName: string;
  fileName: string;
}

/** Indian lakh/crore grouping. */
const MONEY_FMT = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
const PERCENT_FMT = '0.0"%"';

export function exportFileName(key: string, from?: string, to?: string, today: Date = new Date()): string {
  if (from && to) return `CRM-${key}-${from}-${to}.xlsx`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `CRM-${key}-${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}.xlsx`;
}

function sheetName(title: string): string {
  const clean = title.replace(/[\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return clean || 'Report';
}

function cellValue(v: unknown, kind?: string): unknown {
  if (v === null || v === undefined) return '';
  if (kind === 'number' || kind === 'money' || kind === 'percent') {
    const n = Number(v);
    return Number.isNaN(n) ? v : n;
  }
  return v;
}

export async function exportExcel<T>(
  r: ReportExport<T>,
  load: () => Promise<any> = () => import('exceljs')
): Promise<void> {
  const mod = await load();
  const Workbook = (mod.default ?? mod).Workbook ?? mod.Workbook;
  const wb = new Workbook();
  const ws = wb.addWorksheet(sheetName(r.title));

  ws.columns = r.columns.map(c => {
    const longest = r.rows.reduce(
      (m, row) => Math.max(m, String((row as any)[c.key] ?? '').length),
      c.title.length
    );
    const col: any = { header: c.title, key: c.key, width: Math.min(Math.max(longest + 2, 8), 60) };
    if (c.kind === 'money') col.style = { numFmt: MONEY_FMT };
    else if (c.kind === 'percent') col.style = { numFmt: PERCENT_FMT };
    return col;
  });

  for (const row of r.rows) {
    const out: Record<string, unknown> = {};
    for (const c of r.columns) out[c.key] = cellValue((row as any)[c.key], c.kind);
    ws.addRow(out);
  }

  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = r.fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function display(v: unknown, kind?: string): string {
  if (v === null || v === undefined || v === '') return '';
  if (kind === 'money') {
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (kind === 'percent') {
    const n = Number(v);
    return Number.isNaN(n) ? String(v) : n.toFixed(1) + '%';
  }
  return String(v);
}

export function printReportHtml<T>(r: ReportExport<T>, printedOn: Date): string {
  const wide = r.columns.length > 6;
  const right = (k?: string) => k === 'money' || k === 'number' || k === 'percent';
  const head = r.columns.map(c => `<th${right(c.kind) ? ' class="r"' : ''}>${esc(c.title)}</th>`).join('');
  const body = r.rows.map(row =>
    '<tr>' + r.columns.map(c =>
      `<td${right(c.kind) ? ' class="r"' : ''}>${esc(display((row as any)[c.key], c.kind))}</td>`
    ).join('') + '</tr>'
  ).join('\n');
  const printed = printedOn.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${esc(r.title)}</title>
<style>
@page { ${wide ? 'size: A4 landscape; ' : ''}margin: 10mm 8mm; }
* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Arial, sans-serif; font-size: 9pt; color: #111827; margin: 0; }
.co { font-size: 10pt; font-weight: 700; color: #1e1b4b; }
.rt { font-size: 13pt; font-weight: 700; margin: 2px 0; }
.fl { font-size: 8pt; color: #4b5563; margin-bottom: 8px; }
table { width: 100%; border-collapse: collapse; }
th { background: #1e1b4b; color: #fff; padding: 5px; text-align: left; }
td { padding: 4px 5px; border-bottom: 1px solid #e5e7eb; word-break: break-word; }
.r { text-align: right; }
tbody tr:nth-child(even) { background: #f8fafc; }
.pf { margin-top: 8px; font-size: 7pt; color: #9ca3af; text-align: right; }
</style>
</head>
<body>
<div class="co">${esc(r.companyName)}</div>
<div class="rt">${esc(r.title)}</div>
<div class="fl">${esc(r.filters)}</div>
<table>
<thead><tr>${head}</tr></thead>
<tbody>
${body}
</tbody>
</table>
<div class="pf">Printed on ${esc(printed)}</div>
</body>
</html>`;
}

export function openPrint(html: string): void {
  const win = window.open('', '_blank', 'width=1400,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
    win.focus();
    // printed from here: the popup inherits the page CSP, which blocks inline scripts
    win.onafterprint = () => win.close();
    setTimeout(() => win.print(), 300);
  }
}
