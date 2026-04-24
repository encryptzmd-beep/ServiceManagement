// src/app/modules/backoffice/components/dashboard/dashboard.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { DashboardSummary } from '../../Models/ApiModels';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dashboard-component.html',
  styleUrls: ['./dashboard-component.scss'],
})
export class DashboardComponent implements OnInit {
  private api = inject(ApiService);
  data = signal<DashboardSummary | null>(null);

  ngOnInit() {
    this.api.getDashboard().subscribe((d) => this.data.set(d));
  }
}
