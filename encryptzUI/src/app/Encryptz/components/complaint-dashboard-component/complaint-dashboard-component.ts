import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { debounceTime, Subject } from 'rxjs';
import {
  ActiveAssignment, AuditLog, ComplaintFilter, ComplaintListItem,
  ComplaintLookup, DashboardChartData, DashboardResponse, Technician,
} from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { ComplaintDetailPopupComponent } from "../complaint-detail-popup-component/complaint-detail-popup-component";
import { Router } from '@angular/router';

interface TileConfig {
  key: string; label: string; statusId?: number;isSpare?: boolean;
  isSLA?: boolean; isWarranty?: boolean; isScheduled?: boolean; isActiveAssign?: boolean;
}

@Component({
  selector: 'app-complaint-dashboard-component',
  imports: [CommonModule, FormsModule, RouterModule, ComplaintDetailPopupComponent],
  templateUrl: './complaint-dashboard-component.html',
  styleUrl: './complaint-dashboard-component.scss',
})
export class ComplaintDashboardComponent implements OnInit {
  private api = inject(ApiService);
  private _destroyRef = inject(DestroyRef);
  readonly dashState = inject(DashboardStateService);

private router = inject(Router);
  loading = signal(true);
  dashboardData = signal<DashboardResponse | null>(null);
  chartData = signal<DashboardChartData | null>(null);
  chartDays = 30;


  activeTile = signal<TileConfig | null>(null);
  tileItems = signal<any[]>([]);
  tileLoading = signal(false);
  tileTotalPages = signal(1);
  tilePage = 1;
  readonly PAGE_SIZE = 7;
tilePrev(): void {
  if (this.tilePage > 1) {
    this.tilePage--;
    this.loadTile();
    this._scrollTileTop();
  }
}
tileNext(): void {
  if (this.tilePage < this.tileTotalPages()) {
    this.tilePage++;
    this.loadTile();
    this._scrollTileTop();
  }
}
private _scrollTileTop(): void {
  setTimeout(() => {
    document.querySelector('.tile-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 80);
}
  activeAssignments = signal<ActiveAssignment[]>([]);

  // Panel
  showPanel = signal(false);
  panelTab: 'assign' | 'complete' | 'audit' = 'assign';
  assignTarget = signal<any>(null);

  // Complaint autocomplete
  cSearch = '';
  cResults = signal<ComplaintLookup[]>([]);
  showCDropdown = false;
  selectedC = signal<ComplaintLookup | null>(null);
  private cSubject = new Subject<string>();

  // Technician
  technicians = signal<Technician[]>([]);
  techErr = signal(false);
  techSearch = signal('');
  techFilter: number | null = null;
  selectedTech = signal<number | null>(null);

  // Assign form
  aRole = 'Primary';
  aPriority = 'Medium';
  aNotes = '';
  assigning = signal(false);
  assignOk = signal('');
  assignErr = signal('');

  // Schedule
  sched = false;
  schedDate = '';
  schedSlot = '';
  schedStart = '';
  schedEnd = '';
  schedDur: number | null = null;
  today = new Date().toISOString().split('T')[0];

  // Complete
  aSearch = '';
  completeForm = { id: null as number | null, remarks: '' };
  completing = signal(false);
  completeOk = signal('');
  completeErr = signal('');

  // Audit
  auditCId: number | null = null;
  auditLogs = signal<AuditLog[]>([]);
  auditLoading = signal(false);

  readonly priorities = [
    { value: 'Low', color: '#10b981' }, { value: 'Medium', color: '#f59e0b' },
    { value: 'High', color: '#ef4444' }, { value: 'Critical', color: '#7c3aed' },
  ];
  readonly slots = [
    { value: 'morning', label: 'Morning', time: '9AM–12PM', icon: 'wb_sunny' },
    { value: 'afternoon', label: 'Afternoon', time: '12PM–4PM', icon: 'wb_cloudy' },
    { value: 'evening', label: 'Evening', time: '4PM–7PM', icon: 'nights_stay' },
  ];

  filteredTechs = computed(() => {
    let list = this.technicians();
    const t = this.techSearch().toLowerCase();
    if (t) list = list.filter((x: any) => x.fullName?.toLowerCase().includes(t) || x.specialization?.toLowerCase().includes(t) || x.mobileNumber?.includes(t));
    if (this.techFilter !== null) list = list.filter((x: any) => x.availabilityStatus === this.techFilter);
    return list;
  });

  filteredAssign = computed(() => {
    const t = this.aSearch.toLowerCase();
    if (!t) return this.activeAssignments();
    return this.activeAssignments().filter((a: any) => a.technicianName?.toLowerCase().includes(t) || a.complaintNumber?.toLowerCase().includes(t) || a.customerName?.toLowerCase().includes(t));
  });

  statCards = computed(() => {
    const s = this.dashboardData()?.stats;
    if (!s) return [];
    return [
      { key:'spare', label:'Spare Requests', value: this.spareSummary()?.pendingCount ?? 0,
  icon:'🔩', bg:'#fef9c3', accent:'#ca8a04', up:false, pct:0, isSpare:true },
      { key:'total',       label:'Total',             value:s.totalComplaints,            icon:'📋', bg:'#ede9fe', accent:'#7c3aed', up:true,  pct:12 },
      { key:'new',         label:'New',               value:s.newComplaints,              icon:'🆕', bg:'#dbeafe', accent:'#2563eb', up:true,  pct:8,  statusId:1 },
      { key:'inprogress',  label:'In Progress',       value:s.inProgressComplaints,       icon:'🔧', bg:'#fef3c7', accent:'#d97706', up:false, pct:3,  statusId:2 },
      { key:'resolved',    label:'Resolved',          value:s.resolvedComplaints,         icon:'✅', bg:'#d1fae5', accent:'#059669', up:true,  pct:15, statusId:3 },
      { key:'closed',      label:'Closed',            value:s.closedComplaints??0,        icon:'🔒', bg:'#f3f4f6', accent:'#6b7280', up:false, pct:2,  statusId:4 },
      { key:'sla',         label:'SLA Breached',      value:s.slaBreached,                icon:'⚠️', bg:'#fef2f2', accent:'#dc2626', up:false, pct:5,  isSLA:true },
      { key:'warranty',    label:'Warranty',          value:s.warrantyComplaints,         icon:'🛡️', bg:'#fce7f3', accent:'#be185d', up:true,  pct:2,  isWarranty:true },
      { key:'schedules',   label:'Today Schedules',   value:s.todaySchedules,             icon:'📅', bg:'#ccfbf1', accent:'#0d9488', up:true,  pct:10, isScheduled:true },
      { key:'assignments', label:'Active Assignments', value:this.activeAssignments().length, icon:'👷', bg:'#e0e7ff', accent:'#6366f1', up:true, pct:0, isActiveAssign:true },
    ];
  });

  statusItems = computed(() => {
    const s = this.dashboardData()?.stats;
    if (!s) return [];
    const total = s.totalComplaints || 1;
    return [
      { label:'New',         count:s.newComplaints,         pct:(s.newComplaints/total)*100,          color:'#7c3aed', statusId:1 },
      { label:'In Progress', count:s.inProgressComplaints,  pct:(s.inProgressComplaints/total)*100,   color:'#f59e0b', statusId:2 },
      { label:'Resolved',    count:s.resolvedComplaints,    pct:(s.resolvedComplaints/total)*100,     color:'#10b981', statusId:3 },
      { label:'Closed',      count:s.closedComplaints??0,   pct:((s.closedComplaints??0)/total)*100,  color:'#6b7280', statusId:4 },
      { label:'SLA Breach',  count:s.slaBreached,           pct:(s.slaBreached/total)*100,            color:'#ef4444' },
    ];
  });

  ngOnInit(): void {
    this.loadData();
    this.loadActiveAssignments();
    this.cSubject.pipe(debounceTime(300), takeUntilDestroyed(this._destroyRef)).subscribe(term => {
      if (!term.trim()) { this.cResults.set([]); return; }
      this.api.getComplaintsLookup(term).subscribe({
        next: (d: any) => this.cResults.set(Array.isArray(d) ? d : []),
        error: () => this.cResults.set([]),
      });
    });
  }

  loadData(): void {
    this.loadSpareSummary()
    this.loading.set(true);
    this.api.getStats().subscribe({
      next: d => { this.dashboardData.set(d); this.loading.set(false); },
      error: () => { this.loadDemoData(); this.loading.set(false); },
    });
    this.loadChartData();
  }

  loadChartData(): void {
    this.api.getChartData(this.chartDays).subscribe({
      next: d => this.chartData.set(d),
      error: () => this.chartData.set({ complaintsByDate:this.demoDates(), complaintsByStatus:[], complaintsByPriority:[] }),
    });
  }

  loadActiveAssignments(): void {
    this.api.getActiveAssignments().subscribe({
      next: (d: any) => this.activeAssignments.set(Array.isArray(d) ? d : []),
      error: () => this.activeAssignments.set([]),
    });
  }

  onTileClick(card: any): void {
    if (card.key === 'spare') { this.openSparePanel(); return; }
    if (this.activeTile()?.key === card.key) { this.activeTile.set(null); this.tileItems.set([]); return; }
    this.activeTile.set({ key:card.key, label:card.label, statusId:card.statusId, isSLA:card.isSLA, isWarranty:card.isWarranty, isScheduled:card.isScheduled, isActiveAssign:card.isActiveAssign });
    this.tilePage = 1;
    this.loadTile();
    this.dashState.openSidebar();
    setTimeout(() => document.querySelector('.tile-section')?.scrollIntoView({ behavior:'smooth', block:'start' }), 120);
  }

  onStatusBarClick(item: any): void {
    const c = this.statCards().find(x => x.statusId === item.statusId);
    if (c) this.onTileClick(c);
  }
  tileTotalCount = computed(() => {
  const tile = this.activeTile();
  if (!tile) return 0;
  return this._getTotalForTile(tile) ?? this.tileItems().length;
});
private _getTotalForTile(tile: TileConfig): number | null {
  const s = this.dashboardData()?.stats;
  if (!s) return null;

  switch (tile.key) {
    case 'total':       return s.totalComplaints ?? null;
    case 'new':         return s.newComplaints ?? null;
    case 'inprogress':  return s.inProgressComplaints ?? null;
    case 'resolved':    return s.resolvedComplaints ?? null;
    case 'closed':      return s.closedComplaints ?? null;
    case 'sla':         return s.slaBreached ?? null;
    case 'warranty':    return s.warrantyComplaints ?? null;
    case 'schedules':   return s.todaySchedules ?? null;
    case 'assignments': return this.activeAssignments().length;
    default:            return null;
  }
}
loadTile(): void {
  const tile = this.activeTile();
  if (!tile) return;
  this.tileLoading.set(true);

  const totalFromTile = this._getTotalForTile(tile);

  // ── SLA tile (client-side, full list) ──
  if (tile.isSLA) {
    const items = (this.dashboardData()?.slaBreaches ?? []) as any[];
    this.tileItems.set(items);
    const total = totalFromTile ?? items.length;
    this.tileTotalPages.set(Math.max(1, Math.ceil(total / this.PAGE_SIZE)));
    this.tileLoading.set(false);
    return;
  }

  // ── Active Assignments tile (client-side, full list) ──
  if (tile.isActiveAssign) {
    const items = this.activeAssignments() as any[];
    this.tileItems.set(items);
    const total = totalFromTile ?? items.length;
    this.tileTotalPages.set(Math.max(1, Math.ceil(total / this.PAGE_SIZE)));
    this.tileLoading.set(false);
    return;
  }

  // ── Server-side paginated tiles ──
  const f: ComplaintFilter = { pageNumber: this.tilePage, pageSize: this.PAGE_SIZE };
  if (tile.statusId) f.statusId = tile.statusId;

  this.api.getComplaints(f).subscribe({
    next: r => {
      const items = r.items ?? [];
      this.tileItems.set(items);

      // Source of truth for total count:
      // 1) stat card count (authoritative)
      // 2) server's totalCount
      // 3) server's totalPages * PAGE_SIZE
      // 4) fallback: current items length
      let totalRecords: number;
      if (totalFromTile !== null && totalFromTile > 0) {
        totalRecords = totalFromTile;
      } else if ((r as any).totalCount && (r as any).totalCount > 0) {
        totalRecords = (r as any).totalCount;
      } else if (r.totalPages && r.totalPages > 0) {
        totalRecords = r.totalPages * this.PAGE_SIZE;
      } else {
        totalRecords = items.length;
      }

      this.tileTotalPages.set(Math.max(1, Math.ceil(totalRecords / this.PAGE_SIZE)));

      // Safety: if user somehow landed on a page past the end, rewind
      if (this.tilePage > this.tileTotalPages()) {
        this.tilePage = this.tileTotalPages();
        // Re-fetch for the corrected page
        this.loadTile();
        return;
      }

      this.tileLoading.set(false);
    },
    error: () => { this.tileItems.set([]); this.tileLoading.set(false); },
  });
}

get pagedItems(): any[] {
  const items = this.tileItems();
  const tile = this.activeTile();

  // Client-side tiles hold the FULL list → slice here
  if (tile?.isSLA || tile?.isActiveAssign) {
    const s = (this.tilePage - 1) * this.PAGE_SIZE;
    return items.slice(s, s + this.PAGE_SIZE);
  }

  // Server-side tiles already return the correct page → show as-is
  return items;
}


  clearTile(): void { this.activeTile.set(null); this.tileItems.set([]); }
  isSLATile(): boolean { return !!this.activeTile()?.isSLA; }
  isAssignTile(): boolean { return !!this.activeTile()?.isActiveAssign; }

  // Panel
  openAssign(item: any, event?: Event): void {
    event?.stopPropagation();
    this.resetPanel();
    this.assignTarget.set(item);
    this.panelTab = 'assign';
    if (item?.complaintId) {
      const no = item.complaintNumber || item.complaintNo || '';
      this.cSearch = no ? `${no}${item.subject ? ' — '+item.subject : ''}` : '';
      this.selectedC.set({
        complaintId: item.complaintId, complaintNumber: no, subject: item.subject || '', customerName: item.customerName || '', customerPhone: item.customerPhone || '', customerPlace: item.customerPlace || '', priority: item.priority || '',
        statusId: 0
      });
      this.auditCId = item.complaintId;
    }
    this.showPanel.set(true);
    if (!this.technicians().length) this.loadTechs();
    if (!this.activeAssignments().length) this.loadActiveAssignments();
  }

  openBlankPanel(): void {
    this.resetPanel(); this.assignTarget.set(null);
    this.showPanel.set(true); this.panelTab = 'assign';
    if (!this.technicians().length) this.loadTechs();
    if (!this.activeAssignments().length) this.loadActiveAssignments();
  }

  closePanel(): void { this.showPanel.set(false); }

  private resetPanel(): void {
    this.selectedTech.set(null); this.aRole='Primary'; this.aPriority='Medium'; this.aNotes='';
    this.assignOk.set(''); this.assignErr.set(''); this.techSearch.set(''); this.techFilter=null;
    this.sched=false; this.schedDate=''; this.schedSlot=''; this.schedStart=''; this.schedEnd=''; this.schedDur=null;
    this.cSearch=''; this.selectedC.set(null); this.cResults.set([]); this.showCDropdown=false;
    this.completeOk.set(''); this.completeErr.set('');
  }

  onCSearch(): void { this.showCDropdown = true; this.cSubject.next(this.cSearch); }
  // selectC(c: ComplaintLookup): void { this.selectedC.set(c); this.cSearch=`${c.complaintNumber} — ${c.subject}`; this.showCDropdown=false; this.auditCId=c.complaintId; }
  // clearC(): void { this.selectedC.set(null); this.cSearch=''; this.cResults.set([]); this.showCDropdown=false; this.auditCId=null; }

  loadTechs(): void {
    this.techErr.set(false);
    this.api.getTechnicians().subscribe({
      next: (d: any) => this.technicians.set(d.items || d || []),
      error: () => this.techErr.set(true),
    });
  }

  selTech(id: number): void { this.selectedTech.set(this.selectedTech()===id ? null : id); }
  techLabel(s: number): string { return s===1?'Available':s===2?'Busy':'On Leave'; }
  techClass(s: number): string { return s===1?'av':s===2?'busy':'leave'; }



  selAssignment(a: any): void { this.completeForm={id:a.assignmentId, remarks:''}; this.auditCId=a.complaintId||null; }

  doComplete(): void {
    if (!this.completeForm.id) return;
    this.completing.set(true); this.completeOk.set(''); this.completeErr.set('');
    this.api.completeAssignment({ assignmentId:this.completeForm.id, remarks:this.completeForm.remarks }).subscribe({
      next: (r: any) => {
        this.completing.set(false);
        if (r.success) {
          this.completeOk.set(r.message||'Completed');
          this.loadActiveAssignments(); this.loadData();
          if (this.activeTile()) this.loadTile();
          if (this.auditCId) this.loadAuditLog();
          this.completeForm={id:null, remarks:''};
        } else { this.completeErr.set(r.message||'Failed'); }
      },
      error: () => { this.completing.set(false); this.completeErr.set('Error'); },
    });
  }

  quickComplete(a: any, event?: Event): void {
    event?.stopPropagation();
    this.completeForm={id:a.assignmentId, remarks:'Work completed'};
    this.panelTab='complete';
    if (!this.showPanel()) { this.openAssign(a); } else { this.panelTab='complete'; }
  }

  loadAuditLog(): void {
    if (!this.auditCId) return;
    this.auditLoading.set(true);
    this.api.getAuditLog(this.auditCId).subscribe({
      next: (d: any) => { this.auditLogs.set(Array.isArray(d)?d:d.data||[]); this.auditLoading.set(false); },
      error: () => { this.auditLogs.set([]); this.auditLoading.set(false); },
    });
  }

  getAuditIcon(a: string): string { return ({Created:'person_add',Modified:'edit',Removed:'person_remove',Completed:'check_circle'} as any)[a]||'history'; }
  isReassign(i: any): boolean { return !!(i?.technicianName); }

  getBarHeight(n: number): number { const mx=Math.max(...(this.chartData()?.complaintsByDate?.map(d=>d.count)||[1])); return Math.max(5,(n/mx)*100); }
  getBarColor(i: number): string { return ['#4f46e5','#7c3aed','#a78bfa','#6366f1','#818cf8','#4f46e5','#7c3aed'][i%7]; }
  getStatusClass(id: number): string { return ({1:'status-new',2:'status-progress',3:'status-resolved',4:'status-closed'} as any)[id]||'status-new'; }
  getStatusLabel(id: number): string { return ({1:'New',2:'In Progress',3:'Resolved',4:'Closed'} as any)[id]||'Unknown'; }
  getPriorityClass(id: number): string { return ({1:'priority-urgent',2:'priority-high',3:'priority-normal',4:'priority-low'} as any)[id]||'priority-normal'; }
  getPriorityLabel(id: number): string { return ({1:'Urgent',2:'High',3:'Normal',4:'Low'} as any)[id]||'Normal'; }

  private loadDemoData(): void {
    this.dashboardData.set({
      stats:{totalComplaints:248,newComplaints:42,inProgressComplaints:65,resolvedComplaints:112,closedComplaints:29,slaBreached:8,warrantyComplaints:34,availableTechnicians:12,todaySchedules:18,pendingReturns:6},
      recentComplaints:[
        {complaintId:1,complaintNo:'CMP-2026-0001',subject:'AC not cooling',createdDate:'2026-02-25',statusId:1,priorityId:1,customerName:'Raj Kumar',technicianName:''},
        {complaintId:2,complaintNo:'CMP-2026-0002',subject:'Washing machine',createdDate:'2026-02-24',statusId:2,priorityId:3,customerName:'Priya Sharma',technicianName:'Arun M'},
        {complaintId:3,complaintNo:'CMP-2026-0003',subject:'Fridge water leak',createdDate:'2026-02-23',statusId:3,priorityId:2,customerName:'Suresh V',technicianName:'Karthik R'},
      ],
      slaBreaches:[
        {complaintNo:'CMP-2026-0045',subject:'Motor failure',slaDeadline:'2026-02-20',hoursOverdue:168,customerName:'Lakshmi N'},
        {complaintNo:'CMP-2026-0052',subject:'Display broken',slaDeadline:'2026-02-22',hoursOverdue:120,customerName:'Mohan K'},
      ],
    });
  }

  private demoDates(): {date:string;count:number}[] {
    return Array.from({length:15},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(14-i));return{date:d.toISOString().split('T')[0],count:Math.floor(Math.random()*15)+3};});
  }


// --- new state signals (add alongside assigning/completing signals) ---
unAssigning = signal(false);
unAssignOk  = signal('');
unAssignErr = signal('');
unAssignTarget = signal<any>(null);
showUnAssignConfirm = signal(false);
unAssignReason = '';

// --- method: open confirm dialog ---
openUnAssign(assignment: any, event?: Event): void {
  event?.stopPropagation();
  this.unAssignTarget.set(assignment);
  this.unAssignReason = '';
  this.unAssignOk.set('');
  this.unAssignErr.set('');
  this.showUnAssignConfirm.set(true);
}

closeUnAssign(): void {
  this.showUnAssignConfirm.set(false);
  this.unAssignTarget.set(null);
}

doUnAssign(): void {
  const a = this.unAssignTarget();
  if (!a?.assignmentId) return;
  this.unAssigning.set(true);
  this.unAssignOk.set('');
  this.unAssignErr.set('');

  this.api.unAssignTechnician({ assignmentId: a.assignmentId, reason: this.unAssignReason }).subscribe({
    next: (r) => {
      this.unAssigning.set(false);
      if (r.success) {
        this.unAssignOk.set(r.message || 'Technician unassigned');
        this.loadActiveAssignments();
        this.loadData();
        if (this.activeTile()) this.loadTile();
        setTimeout(() => this.closeUnAssign(), 1400);
      } else {
        this.unAssignErr.set(r.message || 'Failed to unassign');
      }
    },
    error: (e: any) => {
      this.unAssigning.set(false);
      this.unAssignErr.set(e?.error?.message || 'An error occurred');
    },
  });
}
// ── Spare summary signal ──────────────────────────────────
spareSummary = signal<any>(null);

// ── Spare approval panel ──────────────────────────────────
showSparePanel    = signal(false);
spareRequests     = signal<any[]>([]);
spareLoading      = signal(false);
spareFilter       = { status: 'Requested', urgencyLevel: '', page: 1, pageSize: 10 };
spareTotalPages   = signal(1);
selectedSpareIds  = signal<Set<number>>(new Set());
spareActionMsg    = signal('');
spareActionErr    = signal(false);
spareActioning    = signal(false);

// ── ADD to statCards computed ─────────────────────────────
// Add this entry inside the statCards array:


// ── ADD to TileConfig interface ───────────────────────────
// isSpare?: boolean;


// ── ngOnInit / loadData ───────────────────────────────────
// Add after loadActiveAssignments():
loadSpareSummary(): void {
  this.api.getSpareDashboardSummary().subscribe({
    next: (r: any) => this.spareSummary.set(r?.data ?? r),
    error: () => {}
  });
}
// Call this.loadSpareSummary() inside loadData()


// ── Tile click override ───────────────────────────────────
// In onTileClick(), add before the existing logic:
// if (card.key === 'spare') { this.openSparePanel(); return; }


// ── Spare panel methods ───────────────────────────────────
openSparePanel(): void {
  this.showSparePanel.set(true);
  this.spareFilter = { status: 'Requested', urgencyLevel: '', page: 1, pageSize: 10 };
  this.selectedSpareIds.set(new Set());
  this.spareActionMsg.set('');
  this.loadSpareRequests();
}

closeSparePanel(): void {
  this.showSparePanel.set(false);
}

loadSpareRequests(): void {
  this.spareLoading.set(true);
  this.api.getSpareAdminRequests(this.spareFilter).subscribe({
    next: (r: any) => {
      const items = r?.data ?? (Array.isArray(r) ? r : []);
      this.spareRequests.set(items);
      const total = r?.totalCount ?? items.length;
      this.spareTotalPages.set(Math.ceil(total / this.spareFilter.pageSize) || 1);
      this.spareLoading.set(false);
    },
    error: () => { this.spareRequests.set([]); this.spareLoading.set(false); }
  });
}

sparePrev(): void { if (this.spareFilter.page > 1) { this.spareFilter.page--; this.loadSpareRequests(); } }
spareNext(): void { if (this.spareFilter.page < this.spareTotalPages()) { this.spareFilter.page++; this.loadSpareRequests(); } }

toggleSpareSelect(id: number): void {
  const s = new Set(this.selectedSpareIds());
  s.has(id) ? s.delete(id) : s.add(id);
  this.selectedSpareIds.set(s);
}

toggleSelectAll(): void {
  const all = this.spareRequests().map((r: any) => r.requestId);
  const s = this.selectedSpareIds();
  const allSelected = all.every((id: number) => s.has(id));
  this.selectedSpareIds.set(allSelected ? new Set() : new Set(all));
}

isAllSelected(): boolean {
  const all = this.spareRequests().map((r: any) => r.requestId);
  return all.length > 0 && all.every((id: number) => this.selectedSpareIds().has(id));
}



singleAction(requestId: number, status: string, event: Event): void {
  event.stopPropagation();
  this.spareActioning.set(true);
  this.api.updateSpareStatus(requestId, status).subscribe({
    next: (r: any) => {
      this.spareActioning.set(false);
      this.loadSpareRequests();
      this.loadSpareSummary();
    },
    error: () => this.spareActioning.set(false)
  });
}

getSpareStatusClass(s: string): string {
  return ({ requested:'s-requested', approved:'s-approved', dispatched:'s-dispatched', used:'s-used', rejected:'s-rejected' } as any)[s?.toLowerCase()] || 's-requested';
}

getUrgencyClass(u: string): string {
  return ({ normal:'u-normal', urgent:'u-urgent', critical:'u-critical' } as any)[u?.toLowerCase()] || 'u-normal';
}

// new signal
complaintSpares = signal<any[]>([]);
sparesLoading   = signal(false);



loadComplaintSpares(complaintId: number): void {
  this.sparesLoading.set(true);
  this.complaintSpares.set([]);
  this.api.getSpareByComplaint(complaintId).subscribe({
    next: (r: any) => {
      this.complaintSpares.set(r?.data ?? (Array.isArray(r) ? r : []));
      this.sparesLoading.set(false);
    },
    error: () => this.sparesLoading.set(false)
  });
}
// ══════════════════════════════════════════════════════════════════════════════
// FIX 1: MULTIPLE TECHNICIAN ASSIGNMENT PER COMPLAINT
// ══════════════════════════════════════════════════════════════════════════════
//
// ADD these new signals alongside existing ones in ComplaintDashboardComponent:

// Existing assignments for selected complaint (shows who's already assigned)
complaintAssignments = signal<any[]>([]);
complaintAssignLoading = signal(false);

// ── REPLACE selectC() ────────────────────────────────────────────────────
// Now also loads existing assignments for that complaint
selectC(c: ComplaintLookup): void {
  this.selectedC.set(c);
  this.cSearch = `${c.complaintNumber} — ${c.subject}`;
  this.showCDropdown = false;
  this.auditCId = c.complaintId;
  this.loadComplaintSpares(c.complaintId);
  this.loadComplaintAssignments(c.complaintId);  // ← NEW
}

// ── REPLACE clearC() ────────────────────────────────────────────────────
clearC(): void {
  this.selectedC.set(null);
  this.cSearch = '';
  this.cResults.set([]);
  this.showCDropdown = false;
  this.auditCId = null;
  this.complaintSpares.set([]);
  this.complaintAssignments.set([]);  // ← NEW
}

// ── NEW METHOD: Load existing assignments for complaint ──────────────────
loadComplaintAssignments(complaintId: number): void {
  this.complaintAssignLoading.set(true);
  this.complaintAssignments.set([]);
  // Reuse audit log or active assignments filtered by complaintId
  this.api.getActiveAssignments().subscribe({
    next: (d: any) => {
      const all = Array.isArray(d) ? d : d?.data ?? [];
      // Filter to only this complaint's assignments
      const filtered = all.filter((a: any) => a.complaintId === complaintId);
      this.complaintAssignments.set(filtered);
      this.complaintAssignLoading.set(false);
    },
    error: () => {
      this.complaintAssignments.set([]);
      this.complaintAssignLoading.set(false);
    },
  });
}

// ── REPLACE doAssign() ──────────────────────────────────────────────────
// After successful assignment, keeps panel open for next technician
doAssign(): void {
  const cid = this.selectedC()?.complaintId ?? this.assignTarget()?.complaintId;
  if (!cid || !this.selectedTech()) return;
  this.assigning.set(true);
  this.assignOk.set('');
  this.assignErr.set('');

  const p: any = {
    complaintId: cid,
    technicianId: this.selectedTech()!,
    assignmentRole: this.aRole,
    priority: this.aPriority,
    notes: this.aNotes,
  };

  // Schedule: only startTime + estimatedDuration, endTime auto-calculated
  if (this.sched) {
    p.scheduledDate = this.schedDate;
    p.startTime = this.schedStart;
    p.estimatedDuration = this.schedDur;
    p.timeSlot = this.schedSlot;
    // Auto-calculate endTime from startTime + duration
    if (this.schedStart && this.schedDur) {
      p.endTime = this.calcEndTime(this.schedStart, this.schedDur);
    }
  }

  this.api.assignTechnician(p).subscribe({
    next: (r: any) => {
      this.assigning.set(false);
      if (r.success) {
        const t = this.technicians().find(
          (x: any) => x.technicianId === this.selectedTech()
        );
        this.assignOk.set(
          `${(t as any)?.fullName || 'Technician'} assigned as ${this.aRole}`
        );
        this.loadData();
        this.loadActiveAssignments();
        if (this.auditCId) this.loadAuditLog();
        if (this.activeTile()) this.loadTile();

        // Reload complaint assignments to show the new one
        if (cid) this.loadComplaintAssignments(cid);

        // Reset for NEXT assignment (panel stays open)
        this.selectedTech.set(null);
        this.aRole = 'Supporting'; // next one defaults to Supporting
        this.aNotes = '';
        // Keep complaint selected, keep schedule fields intact
      } else {
        this.assignErr.set(r.message || 'Failed');
      }
    },
    error: (e: any) => {
      this.assigning.set(false);
      this.assignErr.set(e?.error?.message || 'Error');
    },
  });
}


// ══════════════════════════════════════════════════════════════════════════════
// FIX 2: SCHEDULE — ONLY START TIME + ESTIMATED DURATION, NO END TIME
// ══════════════════════════════════════════════════════════════════════════════
//
// ADD this helper method to the component:

calcEndTime(startTime: string, durationMin: number): string {
  if (!startTime || !durationMin) return '';
  const [h, m] = startTime.split(':').map(Number);
  const totalMin = h * 60 + m + durationMin;
  const endH = Math.floor(totalMin / 60) % 24;
  const endM = totalMin % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// REMOVE: schedEnd property is no longer needed in the form.
// The schedule section in the HTML template should remove the End Time field
// and auto-calculate it.


// ══════════════════════════════════════════════════════════════════════════════
// FIX 3: SPARE PARTS — DISPATCH ALL / BULK ACTION FIX
// ══════════════════════════════════════════════════════════════════════════════
//
// REPLACE bulkAction() — now validates that selected items are in the correct
// status before performing the action

bulkAction(targetStatus: string): void {
  const ids = Array.from(this.selectedSpareIds());
  if (ids.length === 0) {
    this.spareActionMsg.set('Select at least one request');
    this.spareActionErr.set(true);
    return;
  }

  // Filter IDs to only include items that can transition to targetStatus
  const validIds = this.getValidIdsForAction(ids, targetStatus);

  if (validIds.length === 0) {
    const statusNeeded = this.getRequiredStatusForAction(targetStatus);
    this.spareActionMsg.set(
      `No selected items can be ${targetStatus}. Items must be "${statusNeeded}" first.`
    );
    this.spareActionErr.set(true);
    return;
  }

  this.spareActioning.set(true);
  this.spareActionMsg.set('');

  this.api
    .bulkUpdateSpareStatus({ requestIds: validIds, status: targetStatus })
    .subscribe({
      next: (r: any) => {
        this.spareActioning.set(false);
        const skipped = ids.length - validIds.length;
        let msg = r.message || `${targetStatus} applied to ${validIds.length} items`;
        if (skipped > 0) {
          msg += ` (${skipped} skipped — wrong status)`;
        }
        this.spareActionMsg.set(msg);
        this.spareActionErr.set(!r.success);
        this.selectedSpareIds.set(new Set());
        this.loadSpareRequests();
        this.loadSpareSummary();
        if (r.success) setTimeout(() => this.spareActionMsg.set(''), 4000);
      },
      error: () => {
        this.spareActioning.set(false);
        this.spareActionMsg.set('Action failed');
        this.spareActionErr.set(true);
      },
    });
}

// NEW: Helper to filter valid IDs based on current status → target status
private getValidIdsForAction(ids: number[], targetStatus: string): number[] {
  const requests = this.spareRequests();
  return ids.filter((id) => {
    const req = requests.find((r: any) => r.requestId === id);
    if (!req) return false;
    const current = req.status?.toLowerCase();
    switch (targetStatus.toLowerCase()) {
      case 'approved':
        return current === 'requested';
      case 'rejected':
        return current === 'requested';
      case 'dispatched':
        return current === 'approved';
      case 'used':
        return current === 'dispatched';
      default:
        return false;
    }
  });
}

// NEW: Helper to show what status is required
private getRequiredStatusForAction(targetStatus: string): string {
  const map: Record<string, string> = {
    approved: 'Requested',
    rejected: 'Requested',
    dispatched: 'Approved',
    used: 'Dispatched',
  };
  return map[targetStatus.toLowerCase()] || 'valid';
}
// In complaint-dashboard-component.ts

showDetailPopup = signal(false);
selectedComplaintId = signal<number | null>(null);

openComplaintDetails(complaintId: number, event?: Event) {
  event?.stopPropagation();
  this.selectedComplaintId.set(complaintId);
  this.showDetailPopup.set(true);
}

closeDetailPopup() {
  this.showDetailPopup.set(false);
  this.selectedComplaintId.set(null);
}

handleRefresh() {
  // Refresh the dashboard data
  this.loadData();
  this.loadActiveAssignments();
  if (this.activeTile()) {
    this.loadTile();
  }
}
handleAssignFromPopup(ctx: any): void {
  this.closeDetailPopup();
  // Reuse existing openAssign which accepts a complaint-like object
  // and prefills the assign panel with complaint context
  this.openAssign({
    complaintId: ctx.complaintId,
    complaintNumber: ctx.complaintNumber,
    subject: ctx.subject,
    customerName: ctx.customerName,
    customerPhone: ctx.customerPhone,
    priority: ctx.priority
  });
}

/** Popup's "Reassign" button → same as assign, existing panel handles reassign flow */
handleReassignFromPopup(ctx: any): void {
  this.closeDetailPopup();
  this.openAssign(ctx);
}

/** Popup's "Unassign" button → close popup, open your existing unassign confirm dialog */
handleUnassignFromPopup(ctx: any): void {
  this.closeDetailPopup();
  // Your existing openUnAssign accepts an assignment object
  this.openUnAssign({
    assignmentId: ctx.AssignmentId ?? ctx.assignmentId,
    technicianName: ctx.TechnicianName ?? ctx.technicianName,
    assignmentRole: ctx.Role ?? ctx.assignmentRole,
    complaintNumber: ctx.complaintNumber,
    complaintSubject: ctx.complaintSubject,
    scheduledDate: ctx.ScheduledDate ?? ctx.scheduledDate,
    startTime: ctx.StartTime ?? ctx.startTime,
    endTime: ctx.EndTime ?? ctx.endTime
  });
}
 handleCustomerFromPopup(customerId: number): void {
  this.closeDetailPopup();
  // Adjust the route to whatever your customer details screen path is:
  this.router.navigate(['/customers', customerId]);
  // Common alternatives if your route differs:
  //   this.router.navigate(['/customer-details', customerId]);
  //   this.router.navigate(['/customer', customerId]);
}
}
