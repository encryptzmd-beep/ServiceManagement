// src/app/modules/backoffice/components/audit-log/audit-log.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { AuditLog } from '../../Models/ApiModels';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log-component.html',
  styleUrls: ['./audit-log-component.scss'],
})
export class AuditLogComponent {
  private api = inject(ApiService);
  logs = signal<AuditLog[]>([]);
  complaintId = 0;
  load() {
    if (this.complaintId) this.api.getAuditLog(this.complaintId).subscribe((d) => this.logs.set(d));
  }
}
