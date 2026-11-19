import { describe, expect, it } from 'vitest';
import { ATTENTION_KEYS, attentionItems, kpiCards } from './attention';

const card = (key: string, value: number) => ({ key, label: key.toUpperCase(), value });
const all = (v: Record<string, number>) =>
  ['spare', 'total', 'new', 'inprogress', 'workcompleted', 'closed', 'sla', 'warranty', 'schedules', 'assignments', 'hold']
    .map(k => card(k, v[k] ?? 0));

describe('dashboard attention', () => {
  it('keeps only items that need attention', () => {
    const items = attentionItems(all({ sla: 3, new: 0, hold: 2, total: 50 }));
    expect(items.map(i => i.card.key)).toEqual(['sla', 'hold']);
    expect(items[0].card.value).toBe(3);
  });

  it('orders by urgency, most urgent first', () => {
    const items = attentionItems(all({ schedules: 6, spare: 4, hold: 2, new: 5, sla: 1 }));
    expect(items.map(i => i.card.key)).toEqual(['sla', 'new', 'hold', 'spare', 'schedules']);
    expect(items.map(i => i.tone)).toEqual(['red', 'orange', 'orange', 'amber', 'blue']);
    expect(items[1].hint).toBe('New, waiting for a technician');
  });

  it('is empty when all is clear', () => {
    expect(attentionItems(all({ total: 40, closed: 40 }))).toEqual([]);
  });

  it('the KPI tiles are the other cards, in their order', () => {
    expect(kpiCards(all({})).map(c => c.key)).toEqual(['total', 'inprogress', 'workcompleted', 'closed', 'warranty', 'assignments']);
    expect(ATTENTION_KEYS).toEqual(['sla', 'new', 'hold', 'spare', 'schedules']);
  });
});
