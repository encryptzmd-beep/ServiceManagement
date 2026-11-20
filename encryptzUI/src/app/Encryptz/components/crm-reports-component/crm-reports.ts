/** The seven CRM reports in menu order. Keys are the URL (/crm/reports/<key>); the shell menu and the Reports page both read this. */
export type ReportKey = 'followups' | 'conversion' | 'pipeline' | 'sources' | 'team' | 'lost' | 'quotations';

export interface CrmReportLink { key: ReportKey; label: string; icon: string; }

export const CRM_REPORTS: CrmReportLink[] = [
  { key: 'followups', label: 'Leads & follow-ups', icon: 'event_note' },
  { key: 'conversion', label: 'Sales conversion', icon: 'trending_up' },
  { key: 'pipeline', label: 'Pipeline', icon: 'view_kanban' },
  { key: 'sources', label: 'Source performance', icon: 'campaign' },
  { key: 'team', label: 'Team performance', icon: 'groups' },
  { key: 'lost', label: 'Lost reasons', icon: 'thumb_down' },
  { key: 'quotations', label: 'Quotation register', icon: 'request_quote' },
];
