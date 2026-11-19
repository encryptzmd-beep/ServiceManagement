/** A dashboard tile as statCards() builds it (only what this file reads). */
export interface DashboardCard { key: string; label: string; value: number; [more: string]: any; }

export type AttentionTone = 'red' | 'orange' | 'amber' | 'blue';

export interface AttentionItem<C extends DashboardCard = DashboardCard> {
  card: C;
  tone: AttentionTone;
  icon: string;
  hint: string;
}

/** "Needs attention now", most urgent first (Hamster proposal §5.1 / §14). */
const RULES: { key: string; tone: AttentionTone; icon: string; hint: string }[] = [
  { key: 'sla',       tone: 'red',    icon: 'warning',          hint: 'SLA breached' },
  { key: 'new',       tone: 'orange', icon: 'fiber_new',        hint: 'New, waiting for a technician' },
  { key: 'hold',      tone: 'orange', icon: 'pause_circle',     hint: 'On hold' },
  { key: 'spare',     tone: 'amber',  icon: 'build_circle',     hint: 'Spare requests waiting' },
  { key: 'schedules', tone: 'blue',   icon: 'event',            hint: 'Visits scheduled today' },
];

export const ATTENTION_KEYS = RULES.map(r => r.key);

/** The attention items with a number above zero, in urgency order; empty when all is clear. */
export function attentionItems<C extends DashboardCard>(cards: C[]): AttentionItem<C>[] {
  const out: AttentionItem<C>[] = [];
  for (const r of RULES) {
    const card = cards.find(c => c.key === r.key);
    if (card && Number(card.value) > 0) out.push({ card, tone: r.tone, icon: r.icon, hint: r.hint });
  }
  return out;
}

/** The KPI tiles: every card that is not an attention item, in its own order. */
export function kpiCards<C extends DashboardCard>(cards: C[]): C[] {
  return cards.filter(c => !ATTENTION_KEYS.includes(c.key));
}
