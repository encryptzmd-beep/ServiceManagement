import { CrmBoardCardDto } from '../../Models/CrmModels';
import { ATTENTION, BOARD_COLUMNS, badgesOf, boardHeight, columnValue, columnsOf } from './crm-board';

function boardCard(over: Partial<CrmBoardCardDto> = {}): CrmBoardCardDto {
  return {
    leadId: 1, leadNo: 'LD-0001', contactName: 'Ravi', city: 'Kochi', status: 'New', priority: 'Normal',
    ownerUserId: 1, ownerName: 'Anu', nextFollowUpAt: null, statusSince: null, daysInStage: 0,
    quotationId: null, quotationNo: null, quotationStatus: null, quotationValue: null, quotationSentAt: null,
    isOverdue: false, isDueToday: false, isNewNotContacted: false, hasNoFollowUp: false, isQuotationWaiting: false, isStuck: false,
    ...over,
  };
}

describe('crm-board helpers', () => {
  it('lists the five open columns and the six attention rules', () => {
    expect([...BOARD_COLUMNS]).toEqual(['New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation']);
    expect(ATTENTION.map(a => a.label)).toEqual([
      'Overdue follow-ups', "Today's follow-ups", 'New, not contacted', 'No next follow-up', 'Quotation waiting', 'Stuck in stage',
    ]);
    expect(ATTENTION.map(a => a.tone)).toEqual(['red', 'amber', 'amber', 'amber', 'amber', 'amber']);
  });

  it('columnsOf groups by status and drops closed', () => {
    const cols = columnsOf([
      boardCard({ leadId: 1, status: 'New' }),
      boardCard({ leadId: 2, status: 'Qualified' }),
      boardCard({ leadId: 3, status: 'Converted' }),
      boardCard({ leadId: 4, status: 'Lost' }),
      boardCard({ leadId: 5, status: 'New' }),
    ], null);
    expect(cols.New.map(c => c.leadId)).toEqual([1, 5]);
    expect(cols.Qualified.map(c => c.leadId)).toEqual([2]);
    expect(cols.Contacted).toEqual([]);
    expect(cols.Quotation).toEqual([]);
    expect(cols.Negotiation).toEqual([]);
    expect(Object.keys(cols)).toEqual([...BOARD_COLUMNS]);
  });

  it('filter keeps only flagged cards', () => {
    const cards = [
      boardCard({ leadId: 1, status: 'New', isOverdue: true }),
      boardCard({ leadId: 2, status: 'Contacted' }),
      boardCard({ leadId: 3, status: 'Contacted', isOverdue: true, isStuck: true }),
    ];
    const overdue = columnsOf(cards, 'overdue');
    expect(overdue.New.map(c => c.leadId)).toEqual([1]);
    expect(overdue.Contacted.map(c => c.leadId)).toEqual([3]);
    expect(columnsOf(cards, 'stuck').New).toEqual([]);
    expect(columnsOf(cards, 'stuck').Contacted.map(c => c.leadId)).toEqual([3]);
  });

  it('badgesOf puts overdue first in red', () => {
    const badges = badgesOf(boardCard({ isStuck: true, isQuotationWaiting: true, isOverdue: true }));
    expect(badges[0]).toEqual({ label: 'Overdue', tone: 'red' });
    expect(badges.slice(1).every(b => b.tone === 'amber')).toBe(true);
    expect(badges.length).toBe(3);
    expect(badgesOf(boardCard())).toEqual([]);
  });

  it('columnValue sums quotationValue ignoring null', () => {
    expect(columnValue([boardCard({ quotationValue: 1000 }), boardCard({ quotationValue: null }), boardCard({ quotationValue: 250.5 })]))
      .toBe(1250.5);
    expect(columnValue([])).toBe(0);
  });
});

describe('boardHeight', () => {
  it('fills what is left between the board top and the footer, minus the 24px margin', () => {
    expect(boardHeight(900, 300, 43)).toBe(900 - 300 - 43 - 24);
  });
  it('never goes below 360', () => {
    expect(boardHeight(600, 400, 43)).toBe(360);
  });
});
