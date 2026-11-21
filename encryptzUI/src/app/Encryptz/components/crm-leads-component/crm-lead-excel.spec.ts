import { describe, expect, it } from 'vitest';
import { cellText, MAX_IMPORT_ROWS, rowsFromSheet } from './crm-lead-excel';

describe('lead Excel file', () => {
  it('reads the rows by the header, in any column order', () => {
    const r = rowsFromSheet([['Mobile', 'City', 'Contact Name'], [9000011201, 'Kochi', 'Anand Krishnan']]);
    expect(r.problem).toBe('');
    expect(r.rows[0]).toEqual(expect.objectContaining({ rowNumber: 2, contactName: 'Anand Krishnan', mobile: '9000011201', city: 'Kochi' }));
  });

  it('skips empty rows and keeps the real row number', () => {
    const r = rowsFromSheet([['Contact Name', 'Mobile'], ['', ''], ['Meera Nair', '9000011202']]);
    expect(r.rows.length).toBe(1);
    expect(r.rows[0].rowNumber).toBe(3);
  });

  it('refuses a file without the required columns', () => {
    expect(rowsFromSheet([['Name', 'Phone'], ['A', '1']]).problem).toContain('template');
  });

  it('refuses too many rows', () => {
    const many = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => ['Lead ' + i, '90000' + i]);
    expect(rowsFromSheet([['Contact Name', 'Mobile'], ...many]).problem).toContain('at most');
  });

  it('reads what Excel stores in a cell', () => {
    expect(cellText(9000011201)).toBe('9000011201');
    expect(cellText({ richText: [{ text: 'Anand ' }, { text: 'K' }] })).toBe('Anand K');
    expect(cellText({ formula: 'A1', result: 'Kochi' })).toBe('Kochi');
    expect(cellText(null)).toBe('');
  });
});
