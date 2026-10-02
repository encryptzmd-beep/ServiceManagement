import { Component, signal } from '@angular/core';
import { TechnicianLivePosition, TrackingLogEntry } from '../../Models/ApiModels';
import { ApiService } from '../../Services/API/api-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-tracking-component',
  imports: [CommonModule,FormsModule],
  templateUrl: './tracking-component.html',
  styleUrl: './tracking-component.scss',
})
export class TrackingComponent {
  positions = signal<TechnicianLivePosition[]>([]);
  historyData = signal<TrackingLogEntry[]>([]);
  loading = signal(true);
  histLoading = signal(false);
  tab = 'live';
  lastRefresh: Date|null = null;
  histTechId = 0;
  histTechName = '';
  histDate = new Date().toISOString().split('T')[0];

  constructor(private svc: ApiService) {}
  ngOnInit() { this.loadLive(); }

  loadLive() {
    this.loading.set(true);
    this.svc.getLivePositions().subscribe({
      next: (d:any) => { this.positions.set(d.data); this.loading.set(false); this.lastRefresh=new Date(); },
      error: () => { this.positions.set([]); this.loading.set(false); this.lastRefresh=new Date(); }
    });
  }

  viewHistory(id:number, name:string) { this.histTechId=id; this.histTechName=name; this.tab='history'; this.loadHistory(); }

  loadHistory() {
    if (!this.histTechId) return;
    this.histLoading.set(true);
    this.svc.getHistory(this.histTechId, this.histDate).subscribe({
      next: d => { this.historyData.set(d); this.histLoading.set(false); },
      error: () => { this.historyData.set([]); this.histLoading.set(false); }
    });
  }

  getColor(n:string):string { const c=['#4f46e5','#7c3aed','#ec4899','#f59e0b','#10b981','#06b6d4']; return c[n.charCodeAt(0)%c.length]; }
  getInit(n:string):string { return n.split(' ').map(x=>x[0]).join('').substring(0,2).toUpperCase(); }
  getAvailColor(s:number):string { return {1:'#10b981',2:'#f59e0b',3:'#6366f1',4:'#ef4444'}[s]||'#6b7280'; }
  getAvailLabel(s:number):string { return {1:'Available',2:'On Job',3:'On Leave',4:'Inactive'}[s]||'Unknown'; }


}
