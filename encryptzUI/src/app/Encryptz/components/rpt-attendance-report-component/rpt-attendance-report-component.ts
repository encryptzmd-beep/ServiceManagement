// src/app/modules/reports/components/attendance-report/attendance-report.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { Attendance } from '../../Models/ApiModels';

@Component({
  selector: 'app-rpt-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rpt-attendance-report-component.html',
  styleUrls: ['./rpt-attendance-report-component.scss'],
})
export class RptAttendanceReportComponent {
  private api = inject(ApiService);
  data = signal<Attendance[]>([]);
  from = '';
  to = '';
  load() {
   // this.api.getAttendance(undefined, this.from, this.to).subscribe((d) => this.data.set(d));
  }
}
