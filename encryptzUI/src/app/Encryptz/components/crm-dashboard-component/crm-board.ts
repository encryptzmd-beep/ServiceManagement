// The Kanban board of open leads: its columns, the attention rules and what a card shows. Pure, no Angular.
import { CrmAttentionCountsDto, CrmBoardCardDto } from '../../Models/CrmModels';

/** The open statuses, one column each. Converted and Lost leave the board. */
export const BOARD_COLUMNS = ['New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation'] as const;
export type BoardColumn = typeof BOARD_COLUMNS[number];

export type AttentionKey = 'overdue' | 'today' | 'newNotContacted' | 'noFollowUp' | 'quotationWaiting' | 'stuck';

export interface AttentionRule {
  key: AttentionKey;
  label: string;
  /** The card flag the server sets for this rule. */
  flag: keyof CrmBoardCardDto;
  /** The count of this rule in the board's counts. */
  count: keyof CrmAttentionCountsDto;
  tone: 'red' | 'amber';
  /** The short text of the badge on a card. */
  badge: string;
}

/** The attention strip, in its order. Overdue is red, the rest amber. */
export const ATTENTION: AttentionRule[] = [
  { key: 'overdue', label: 'Overdue follow-ups', flag: 'isOverdue', count: 'overdue', tone: 'red', badge: 'Overdue' },
  { key: 'today', label: "Today's follow-ups", flag: 'isDueToday', count: 'dueToday', tone: 'amber', badge: 'Today' },
  { key: 'newNotContacted', label: 'New, not contacted', flag: 'isNewNotContacted', count: 'newNotContacted', tone: 'amber', badge: 'Not contacted' },
  { key: 'noFollowUp', label: 'No next follow-up', flag: 'hasNoFollowUp', count: 'noFollowUp', tone: 'amber', badge: 'No follow-up' },
  { key: 'quotationWaiting', label: 'Quotation waiting', flag: 'isQuotationWaiting', count: 'quotationWaiting', tone: 'amber', badge: 'Quotation waiting' },
  { key: 'stuck', label: 'Stuck in stage', flag: 'isStuck', count: 'stuck', tone: 'amber', badge: 'Stuck' },
];

/** The cards of each open column, in the order given; with a filter, only the cards flagged for that rule. */
export function columnsOf(cards: CrmBoardCardDto[], filter: AttentionKey | null): Record<BoardColumn, CrmBoardCardDto[]> {
  const rule = filter ? ATTENTION.find(a => a.key === filter) : undefined;
  const cols = Object.fromEntries(BOARD_COLUMNS.map(c => [c, [] as CrmBoardCardDto[]])) as Record<BoardColumn, CrmBoardCardDto[]>;
  for (const card of cards) {
    const list = cols[card.status as BoardColumn];
    if (!list) continue;
    if (rule && !card[rule.flag]) continue;
    list.push(card);
  }
  return cols;
}

/** The total quotation value of the cards; a card without a quotation adds nothing. */
export function columnValue(cards: CrmBoardCardDto[]): number {
  return cards.reduce((sum, c) => sum + (c.quotationValue ?? 0), 0);
}

/** The badges of a card, in the strip's order (Overdue first). */
export function badgesOf(card: CrmBoardCardDto): { label: string; tone: 'red' | 'amber' }[] {
  return ATTENTION.filter(a => !!card[a.flag]).map(a => ({ label: a.badge, tone: a.tone }));
}

/** The board's height: what remains between its top and the footer, never under 360px. */
export function boardHeight(viewportHeight: number, boardTop: number, footerHeight: number): number {
  return Math.max(360, Math.round(viewportHeight - boardTop - footerHeight - 24));
}
