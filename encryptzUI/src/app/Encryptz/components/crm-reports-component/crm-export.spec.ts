import { describe, it, expect, vi } from 'vitest';
import { exportExcel, exportFileName, printReportHtml, ReportExport } from './crm-export';

interface Row { name: string; amount: number; rate: number }

function report(over: Partial<ReportExport<Row>> = {}): ReportExport<Row> {
  return {
    key: 'sales', title: 'Sales report', filters: 'All', companyName: 'Acme',
    fileName: 'CRM-sales.xlsx',
    columns: [
      { key: 'name', title: 'Name' },
      { key: 'amount', title: 'Amount', kind: 'money' },
      { key: 'rate', title: 'Rate', kind: 'percent' },
    ],
    rows: [{ name: 'E2E TEST ജോസഫ് മാത്യു', amount: 1234.5, rate: 12.5 }],
    ...over,
  };
}

function fakeLoad() {
  const state: any = { rows: [], sheetName: '', ws: null, header: { font: null }, written: false };
  const ws: any = {
    columns: [], views: [],
    addRow: (v: any) => { state.rows.push(v); return {}; },
    getRow: () => state.header,
  };
  state.ws = ws;
  class Workbook {
    addWorksheet(name: string) { state.sheetName = name; return ws; }
    xlsx = { writeBuffer: async () => { state.written = true; return new ArrayBuffer(4); } };
  }
  return { state, load: (async () => ({ default: { Workbook }, Workbook })) as any };
}

describe('crm-export', () => {
  it('builds the file name with range', () => {
    expect(exportFileName('sales', '2026-01-01', '2026-01-31')).toBe('CRM-sales-2026-01-01-2026-01-31.xlsx');
  });

  it('builds the file name for a snapshot', () => {
    expect(exportFileName('pipeline', undefined, undefined, new Date(2026, 10, 5))).toBe('CRM-pipeline-2026-11-05.xlsx');
  });

  async function run(r: ReportExport<Row>) {
    const f = fakeLoad();
    (URL as any).createObjectURL = vi.fn(() => 'blob:x');
    (URL as any).revokeObjectURL = vi.fn();
    await exportExcel(r, f.load);
    return f.state;
  }

  it('keeps unicode text in cells', async () => {
    const s = await run(report());
    expect(s.rows[0]['name']).toBe('E2E TEST ജോസഫ് മാത്യു');
    expect(s.written).toBe(true);
    expect(s.header.font.bold).toBe(true);
    expect(s.ws.views[0].state).toBe('frozen');
  });

  it('formats money columns', async () => {
    const s = await run(report());
    expect(s.ws.columns[1].style.numFmt).toBe('[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00');
    expect(s.ws.columns[2].style.numFmt).toBe('0.0"%"');
    expect(s.ws.columns[0].style?.numFmt).toBeUndefined();
  });

  it('limits and cleans the sheet name', async () => {
    const s = await run(report({ title: 'A/B:C*D?[E]' + 'x'.repeat(40) }));
    expect(s.sheetName.length).toBeLessThanOrEqual(31);
    expect(s.sheetName).not.toMatch(/[\/?*\[\]:]/);
  });

  it('print page declares utf-8', () => {
    const h = printReportHtml(report(), new Date());
    expect(h).toContain('<meta charset="utf-8">');
    expect(h).toContain('ജോസഫ്');
    expect(h).toContain('Printed on');
  });

  it('print page escapes html', () => {
    const h = printReportHtml(report({ rows: [{ name: '<b>x</b> & "q" \'s\'', amount: 1, rate: 1 }] }), new Date());
    expect(h).toContain('&lt;b&gt;x&lt;/b&gt; &amp; &quot;q&quot; &#39;s&#39;');
    expect(h).not.toContain('<b>x</b>');
  });

  it('print page is landscape for wide tables', () => {
    const cols = Array.from({ length: 7 }, (_, i) => ({ key: 'name' as const, title: 'C' + i }));
    expect(printReportHtml(report({ columns: cols }), new Date())).toContain('@page { size: A4 landscape');
    expect(printReportHtml(report(), new Date())).not.toContain('landscape');
  });
});
