import { AttentionInput, ReportData, attentionItems, buildReport } from './consultancy-insights';

const today = new Date(2026, 10, 21);
const posting = (id: number, over: any = {}) => ({
  postingId: id, title: `Job ${id}`, city: 'Kochi', status: 'Open', applied: 0, shortlisted: 0, rejected: 0, hired: 0,
  closesOn: null, publishedAt: '2026-11-20', createdAt: '2026-11-20', ...over,
});
const placement = (id: number, over: any = {}) => ({
  placementId: id, candidateName: `Person ${id}`, jobTitle: 'Clerk', joinDate: '2026-11-15', feeAmount: 1000, feeStatus: 'Pending', notes: '', ...over,
});
const input = (over: Partial<AttentionInput> = {}): AttentionInput => ({
  postings: [], interviews: [], placements: [], suitable: {}, unreadMessages: 0, today, ...over,
});
const keys = (x: AttentionInput) => attentionItems(x).map(i => i.key);

describe('attentionItems', () => {
  it('is empty when nothing needs attention', () => {
    expect(attentionItems(input())).toEqual([]);
  });

  it('claims nothing about placements that could not be read', () => {
    expect(keys(input({ placements: null }))).toEqual([]);
  });

  it('counts a fee as overdue only after 30 days and only while unpaid', () => {
    const items = attentionItems(input({ placements: [
      placement(1, { joinDate: '2026-10-21' }),            // 31 days
      placement(2, { joinDate: '2026-10-22' }),            // 30 days
      placement(3, { joinDate: '2026-01-01', feeStatus: 'Paid' }),
    ] as any }));
    const fees = items.find(i => i.key === 'fees')!;
    expect(fees.title).toBe('₹1,000 in overdue fees');
    expect(fees.link).toBe('/consultancy/reports/fees');
  });

  it('finds jobs past closing, closing soon, returned, waiting and quiet', () => {
    const k = keys(input({ postings: [
      posting(1, { closesOn: '2026-11-20' }),
      posting(2, { closesOn: '2026-11-28', applied: 3 }),
      posting(3, { status: 'Draft', reviewNote: 'Add a salary' }),
      posting(4, { publishedAt: '2026-11-14' }),
    ] as any }));
    expect(k).toEqual(expect.arrayContaining(['expired', 'closing', 'returned', 'waiting', 'quiet']));
  });

  it('a single job opens that job', () => {
    const item = attentionItems(input({ postings: [posting(9, { closesOn: '2026-11-01' })] as any })).find(i => i.key === 'expired')!;
    expect(item.query).toEqual({ job: 9 });
  });

  it('puts the urgent items first', () => {
    const levels = attentionItems(input({
      unreadMessages: 2,
      postings: [posting(1, { closesOn: '2026-11-01' })] as any,
    })).map(i => i.level);
    expect(levels).toEqual(['high', 'medium']);
  });

  it('does not raise housekeeping items: a placement without a fee or a job without a client', () => {
    const k = keys(input({ postings: [posting(1)] as any, placements: [placement(1, { feeAmount: null })] as any }));
    expect(k).toEqual([]);
  });
});

describe('buildReport', () => {
  const data = (over: Partial<ReportData> = {}): ReportData => ({
    postings: [], postingClients: [], clients: [], placements: [], matchCounts: [], ownCandidates: [], ownTotal: 0, ...over,
  });

  it('job performance adds up the applicants and the hire rate', () => {
    const v = buildReport('jobs', data({ postings: [posting(1, { applied: 2, shortlisted: 1, rejected: 3, hired: 2 })] as any }), today);
    expect(v.rows[0]['received']).toBe(8);
    expect(v.rows[0]['hireRate']).toBe(25);
  });

  it('client performance splits paid and outstanding fees', () => {
    const v = buildReport('clients', data({
      clients: [{ clientId: 1, name: 'Acme', isActive: true }] as any,
      placements: [placement(1, { clientId: 1, feeStatus: 'Paid', feeAmount: 500 }), placement(2, { clientId: 1, feeStatus: 'Invoiced', feeAmount: 200 })] as any,
    }), today);
    expect(v.rows[0]['paid']).toBe(500);
    expect(v.rows[0]['outstanding']).toBe(200);
  });

  it('the placement register honours the dates, inclusive', () => {
    const placements = [placement(1, { joinDate: '2026-11-01' }), placement(2, { joinDate: '2026-11-10' }), placement(3, { joinDate: '2026-11-11' })] as any;
    expect(buildReport('placements', data({ placements }), today, '2026-11-01', '2026-11-10').rows.length).toBe(2);
  });

  it('fees outstanding leaves out paid and zero fees, oldest first', () => {
    const v = buildReport('fees', data({ placements: [
      placement(1, { joinDate: '2026-11-01' }), placement(2, { joinDate: '2026-01-01' }),
      placement(3, { feeStatus: 'Paid' }), placement(4, { feeAmount: 0 }),
    ] as any }), today);
    expect(v.rows.map(r => r['candidate'])).toEqual(['Person 2', 'Person 1']);
    expect(v.rows[0]['band']).toBe('Over 90 days');
  });

  it('the guarantee tracker leaves out ended guarantees, soonest first', () => {
    const v = buildReport('guarantees', data({ placements: [
      placement(1, { guaranteeUntil: '2026-12-30' }), placement(2, { guaranteeUntil: '2026-11-21' }), placement(3, { guaranteeUntil: '2026-11-20' }),
    ] as any }), today);
    expect(v.rows.map(r => r['candidate'])).toEqual(['Person 2', 'Person 1']);
    expect(v.rows[0]['left']).toBe(0);
  });

  it('candidate sources groups by source and says when it is partial', () => {
    const own = [{ source: 'Referral', stage: 'Placed' }, { source: 'Referral', stage: 'New' }, { source: '', stage: 'New' }] as any;
    const v = buildReport('sources', data({ ownCandidates: own, ownTotal: 5 }), today);
    expect(v.rows[0]).toMatchObject({ source: 'Referral', total: 2, placed: 1, placedRate: 50 });
    expect(v.rows[1]['source']).toBe('Not set');
    expect(v.note).toContain('first 3 of 5');
  });
});
