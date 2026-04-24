import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { DashboardStats, Complaint, ComplaintCustomer } from '../../Models/ApiModels';
import { CustomerAuthService } from '../../Services/customer-auth-service';


@Component({
  selector: 'app-customer-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="dashboard-stats">
      <!-- Stats Cards -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">📊</div>
          <div class="stat-info">
            <h3>{{ stats().totalComplaints }}</h3>
            <p>Total Complaints</p>
          </div>
        </div>

        <div class="stat-card warning">
          <div class="stat-icon">🔄</div>
          <div class="stat-info">
            <h3>{{ stats().activeComplaints }}</h3>
            <p>Active Complaints</p>
          </div>
        </div>

        <div class="stat-card success">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <h3>{{ stats().resolvedComplaints }}</h3>
            <p>Resolved Complaints</p>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📦</div>
          <div class="stat-info">
            <h3>{{ stats().totalProducts }}</h3>
            <p>Products</p>
          </div>
        </div>

        <div class="stat-card info">
          <div class="stat-icon">🔧</div>
          <div class="stat-info">
            <h3>{{ stats().activeWarrantyProducts }}</h3>
            <p>Under Warranty</p>
          </div>
        </div>

        <div class="stat-card danger">
          <div class="stat-icon">⚠️</div>
          <div class="stat-info">
            <h3>{{ stats().expiredWarrantyProducts }}</h3>
            <p>Warranty Expired</p>
          </div>
        </div>
      </div>

      <!-- Recent Complaints -->
      <div class="recent-section">
        <div class="section-header">
          <h2>Recent Complaints</h2>
          @if (authService.hasMenuAccess('/customer/complaints', 'view')) {
            <a routerLink="/customer/complaints" class="view-all">View All →</a>
          }
        </div>

        @if (recentComplaints().length === 0) {
          <div class="empty-state">
            <p>No complaints found.</p>
            @if (authService.hasMenuAccess('/customer/complaints/new', 'create')) {
              <a routerLink="/customer/complaints/new" class="btn-primary">Create New Complaint</a>
            }
          </div>
        } @else {
          <div class="complaints-list">
            @for (complaint of recentComplaints(); track complaint.complaintId) {
              <div class="complaint-item">
                <div class="complaint-header">
                  <span class="complaint-number">{{ complaint.complaintNumber }}</span>
                  <span class="complaint-status" [style.background]="complaint.statusColor">
                    {{ complaint.statusName }}
                  </span>
                </div>
                <div class="complaint-subject">{{ complaint.subject }}</div>
                <div class="complaint-meta">
                  <span>Priority: {{ complaint.priority }}</span>
                  <span>{{ getTimeAgo(complaint.createdAt) }}</span>
                  @if (complaint.assignedTechnicianName) {
                    <span>Technician: {{ complaint.assignedTechnicianName }}</span>
                  }
                </div>
                <a [routerLink]="['/customer/complaint', complaint.complaintId]" class="view-link">View Details →</a>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      transition: transform 0.2s;
    }

    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .stat-icon {
      font-size: 40px;
    }

    .stat-info h3 {
      font-size: 28px;
      margin: 0 0 4px 0;
      color: #333;
    }

    .stat-info p {
      margin: 0;
      color: #666;
      font-size: 14px;
    }

    .stat-card.warning .stat-info h3 { color: #ff9800; }
    .stat-card.success .stat-info h3 { color: #4caf50; }
    .stat-card.info .stat-info h3 { color: #2196f3; }
    .stat-card.danger .stat-info h3 { color: #f44336; }

    .recent-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      padding-bottom: 12px;
      border-bottom: 2px solid #f0f0f0;
    }

    .section-header h2 {
      margin: 0;
      font-size: 20px;
      color: #333;
    }

    .view-all {
      color: #667eea;
      text-decoration: none;
      font-size: 14px;
    }

    .complaints-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .complaint-item {
      padding: 16px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      transition: all 0.2s;
    }

    .complaint-item:hover {
      border-color: #667eea;
      box-shadow: 0 2px 8px rgba(102,126,234,0.1);
    }

    .complaint-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .complaint-number {
      font-weight: 600;
      color: #667eea;
      font-size: 14px;
    }

    .complaint-status {
      padding: 4px 12px;
      border-radius: 20px;
      color: white;
      font-size: 12px;
      font-weight: 500;
    }

    .complaint-subject {
      font-size: 16px;
      font-weight: 500;
      color: #333;
      margin-bottom: 8px;
    }

    .complaint-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: #999;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .view-link {
      color: #667eea;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
    }

    .empty-state {
      text-align: center;
      padding: 40px;
      color: #999;
    }

    .btn-primary {
      display: inline-block;
      margin-top: 12px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
    }

    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CustomerHomeComponent implements OnInit {
  authService = inject(CustomerAuthService);
  private http = inject(HttpClient);

  stats = signal<any>({
    totalComplaints: 0,
    activeComplaints: 0,
    resolvedComplaints: 0,
    totalProducts: 0,
    activeWarrantyProducts: 0,
    expiredWarrantyProducts: 0
  });

  recentComplaints = signal<ComplaintCustomer[]>([]);

  ngOnInit() {
    this.loadDashboardData();
  }

  loadDashboardData(): void {
    const customer = this.authService.currentCustomer();
    if (customer) {
      this.http.get(`/api/customer/dashboard/${customer.customerId}`)
        .subscribe({
          next: (data: any) => {
            this.stats.set(data.stats);
            this.recentComplaints.set(data.recentComplaints);
          },
          error: (err) => console.error('Error loading dashboard:', err)
        });
    }
  }

  getTimeAgo(date: string): string {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);

    const intervals = [
      { label: 'year', seconds: 31536000 },
      { label: 'month', seconds: 2592000 },
      { label: 'day', seconds: 86400 },
      { label: 'hour', seconds: 3600 },
      { label: 'minute', seconds: 60 }
    ];

    for (const interval of intervals) {
      const count = Math.floor(seconds / interval.seconds);
      if (count >= 1) {
        return `${count} ${interval.label}${count !== 1 ? 's' : ''} ago`;
      }
    }

    return 'just now';
  }
}
