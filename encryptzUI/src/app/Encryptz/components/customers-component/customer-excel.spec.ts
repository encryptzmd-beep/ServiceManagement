import { customerRowsFromSheet } from './customer-excel';
import { worthChecking } from '../shared/customer-match/customer-match-warning';

describe('customer upload file', () => {
  it('reads the template columns in any order', () => {
    const read = customerRowsFromSheet([
      ['Mobile', 'Customer Name', 'GSTIN', 'City'],
      [9846012345, 'ABC Enterprises', '32ABCDE1234F1Z5', 'Kochi'],
      [null, null, null, null],
      ['98950 11111', 'Meera Nair', '', 'Thrissur'],
    ]);
    expect(read.problem).toBe('');
    expect(read.rows.length).toBe(2);
    expect(read.rows[0]).toEqual(expect.objectContaining({ rowNumber: 2, customerName: 'ABC Enterprises', mobileNumber: '9846012345', gstin: '32ABCDE1234F1Z5', city: 'Kochi' }));
    expect(read.rows[1].rowNumber).toBe(4);
  });

  it('accepts the usual other names of a column', () => {
    const read = customerRowsFromSheet([['Party Name', 'Phone', 'GST No', 'Pincode'], ['ABC', '9846012345', '32ABCDE1234F1Z5', '682016']]);
    expect(read.rows[0]).toEqual(expect.objectContaining({ customerName: 'ABC', mobileNumber: '9846012345', gstin: '32ABCDE1234F1Z5', pinCode: '682016' }));
  });

  it('asks for the template when the name or mobile column is missing', () => {
    expect(customerRowsFromSheet([['Name only'], ['ABC']]).problem).toContain('Customer Name and Mobile');
    expect(customerRowsFromSheet([['Customer Name', 'Mobile']]).problem).toBe('The file has no customers');
  });

  it('looks for the same party once a full mobile or GSTIN is typed', () => {
    expect(worthChecking('98460', '')).toBe(false);
    expect(worthChecking('98460 12345', '')).toBe(true);
    expect(worthChecking('', '32ABCDE1234F1Z5')).toBe(true);
  });
});
