// spare-part-master.component.ts

import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

export interface SparePart {
  sparePartId: number;
  partName: string;
  partNumber: string;
  stockQuantity: number;
  unitPrice: number;
  isActive: boolean;
  companyId?: number;
}

@Component({
  selector: 'app-spare-part-master',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="mgmt-page">
      <div class="page-header">
        <div>
          <div class="page-title">Spare Parts</div>
          <div class="page-sub">Manage spare parts inventory, stock levels, and pricing</div>
        </div>

        <button class="btn-new" (click)="openAddModal()">
          <span class="material-icons">add</span>
          Add New Part
        </button>
      </div>

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">Visible Parts</div>
          <div class="stat-val">{{ spareParts().length }}</div>
          <div class="stat-pill pill-blue">Current page</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Active</div>
          <div class="stat-val stat-active">{{ activeCount() }}</div>
          <div class="stat-pill pill-green">{{ spareParts().length ? activePercent() : 0 }}% active</div>
        </div>

        <div class="stat-card">
          <div class="stat-label">Selected</div>
          <div class="stat-val stat-inactive">{{ selectedIds().size }}</div>
          <div class="stat-pill" [class.pill-red]="selectedIds().size > 0" [class.pill-blue]="selectedIds().size === 0">
            {{ selectedIds().size > 0 ? 'Bulk action ready' : 'No selection' }}
          </div>
        </div>
      </div>

      <div class="tab-content">
        <div class="table-wrap">
          <div class="table-toolbar">
            <div class="toolbar-left">
              <span class="table-title">All Spare Parts</span>
              <span class="table-count">{{ spareParts().length }} items</span>
            </div>

            <div class="toolbar-right">
              <div class="search-box">
                <span class="material-icons">search</span>
                <input
                  type="text"
                  class="search-input-inline"
                  [(ngModel)]="filters.searchTerm"
                  (input)="onSearch()"
                  placeholder="Search by part name or number..." />
              </div>

              <select class="filter-select" [(ngModel)]="filters.isActive" (change)="loadData()">
                <option [ngValue]="null">All Status</option>
                <option [ngValue]="true">Active</option>
                <option [ngValue]="false">Inactive</option>
              </select>

              <select class="filter-select" [(ngModel)]="filters.sortBy" (change)="loadData()">
                <option value="SparePartId">ID</option>
                <option value="PartName">Part Name</option>
                <option value="StockQuantity">Stock</option>
                <option value="UnitPrice">Price</option>
              </select>

              <select class="filter-select" [(ngModel)]="filters.sortOrder" (change)="loadData()">
                <option value="ASC">Ascending</option>
                <option value="DESC">Descending</option>
              </select>

              <button class="action-square" (click)="loadData()" title="Refresh">
                <span class="material-icons">refresh</span>
              </button>
            </div>
          </div>

          @if (selectedIds().size > 0) {
            <div class="bulk-bar">
              <div class="selected-info">{{ selectedIds().size }} item(s) selected</div>

              <div class="bulk-actions">
                <button class="toolbar-btn danger-btn" (click)="bulkDelete()">
                  Delete Selected
                </button>
                <button class="toolbar-btn secondary-btn" (click)="clearSelection()">
                  Clear Selection
                </button>
              </div>
            </div>
          }

          @if (loading()) {
            <div class="loading-container">
              <div class="spinner"></div>
              <p>Loading spare parts...</p>
            </div>
          }

          @if (!loading()) {
            <div class="table-container">
              <table class="data-table styled-table">
                <thead>
                  <tr>
                    <th class="check-col">
                      <input
                        type="checkbox"
                        [checked]="isAllSelected()"
                        (change)="toggleSelectAll()" />
                    </th>
                    <th>ID</th>
                    <th>Part Name</th>
                    <th>Part Number</th>
                    <th>Stock Quantity</th>
                    <th>Unit Price</th>
                    <th>Status</th>
                    <th class="actions-col">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  @for (item of spareParts(); track item.sparePartId) {
                    <tr [class.row-selected]="selectedIds().has(item.sparePartId)">
                      <td class="check-col">
                        <input
                          type="checkbox"
                          [checked]="selectedIds().has(item.sparePartId)"
                          (change)="toggleSelection(item.sparePartId)" />
                      </td>
                      <td class="muted-cell">{{ item.sparePartId }}</td>
                      <td class="item-name">{{ item.partName }}</td>
                      <td class="muted-cell">{{ item.partNumber || '—' }}</td>
                      <td>
                        <span class="stock-badge" [class.low-stock]="item.stockQuantity < 5">
                          {{ item.stockQuantity }}
                        </span>
                      </td>
                      <td class="price-cell">{{ item.unitPrice | currency:'INR':'symbol':'1.0-0' }}</td>
                      <td>
                        <span class="status-badge" [class.active]="item.isActive" [class.inactive]="!item.isActive">
                          <span class="status-dot" [class.dot-active]="item.isActive" [class.dot-inactive]="!item.isActive"></span>
                          {{ item.isActive ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                      <td>
                        <div class="row-actions">
                          <button class="action-btn" (click)="openEditModal(item)" title="Edit">
                            <span class="material-icons">edit</span>
                          </button>
                          <button class="action-btn danger" (click)="deleteItem(item.sparePartId)" title="Delete">
                            <span class="material-icons">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="8" class="empty-row">
                        <div class="empty-state">
                          <div class="empty-title">No spare parts found</div>
                          <div class="empty-sub">Try changing the filters or add a new spare part to get started.</div>
                          <button class="toolbar-btn primary-btn empty-btn" (click)="openAddModal()">Add New Part</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (totalPages() > 1) {
            <div class="pagination-bar">
              <div class="pagination-left">
                <span class="pagination-info">Page {{ currentPage() }} of {{ totalPages() }}</span>
              </div>

              <div class="pagination-center">
                <button class="page-btn" (click)="goToPage(currentPage() - 1)" [disabled]="currentPage() <= 1">
                  Prev
                </button>
                <button class="page-btn" (click)="goToPage(currentPage() + 1)" [disabled]="currentPage() >= totalPages()">
                  Next
                </button>
              </div>
            </div>
          }
        </div>
      </div>
    </div>

    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal-card role-access-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-heading">
              <h3>{{ isEditing() ? 'Edit Spare Part' : 'Add New Spare Part' }}</h3>
              <p>{{ isEditing() ? 'Update inventory details and pricing' : 'Create a new spare part in the master catalog' }}</p>
            </div>

            <button class="close-btn" (click)="closeModal()" aria-label="Close">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="modal-body">
            <div class="role-form-grid">
              <div class="form-row vertical">
                <label>Part Name *</label>
                <input
                  type="text"
                  [(ngModel)]="formData.partName"
                  placeholder="Enter part name" />
              </div>

              <div class="form-row vertical">
                <label>Part Number</label>
                <input
                  type="text"
                  [(ngModel)]="formData.partNumber"
                  placeholder="Enter part number (optional)" />
              </div>
            </div>

            <div class="role-form-grid">
              <div class="form-row vertical">
                <label>Stock Quantity</label>
                <input
                  type="number"
                  [(ngModel)]="formData.stockQuantity"
                  min="0" />
              </div>

              <div class="form-row vertical">
                <label>Unit Price (INR)</label>
                <input
                  type="number"
                  [(ngModel)]="formData.unitPrice"
                  min="0"
                  step="0.01" />
              </div>
            </div>

            <div class="form-row checkbox-row active-row">
              <label class="checkbox-inline">
                <input type="checkbox" [(ngModel)]="formData.isActive" />
                Active Spare Part
              </label>
            </div>
          </div>

          <div class="modal-actions sticky-actions">
            <button class="btn-secondary" (click)="closeModal()">Cancel</button>
            <button class="btn-primary" (click)="saveItem()" [disabled]="saving()">
              @if (saving()) {
                <span class="mini-spinner"></span>
              }
              {{ isEditing() ? 'Update Part' : 'Create Part' }}
            </button>
          </div>
        </div>
      </div>
    }

    @if (toastMessage()) {
      <div class="toast-stack">
        <div class="app-toast" [class.toast-error]="toastType() === 'error'" [class.toast-success]="toastType() === 'success'">
          <div class="toast-icon">{{ toastType() === 'success' ? '✓' : '!' }}</div>
          <div class="toast-copy">
            <div class="toast-title">{{ toastType() === 'success' ? 'Success' : 'Something went wrong' }}</div>
            <div class="toast-message">{{ toastMessage() }}</div>
          </div>
        </div>
      </div>
    }

    @if (confirmVisible()) {
      <div class="confirm-overlay">
        <div class="confirm-dialog">
          <div class="confirm-header">
            <div class="confirm-title">Confirm Action</div>
            <button class="confirm-close" (click)="cancelConfirm()" aria-label="Close confirmation">
              <span class="material-icons">close</span>
            </button>
          </div>
          <div class="confirm-body">{{ confirmMessage() }}</div>
          <div class="confirm-actions">
            <button class="confirm-btn confirm-cancel-btn" (click)="cancelConfirm()">Cancel</button>
            <button class="confirm-btn confirm-danger-btn" (click)="proceedConfirm()">Confirm</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .mgmt-page {
      --brand-red: #d42b2b;
      --brand-red-light: #f9e8e8;
      --brand-navy: #1b4a7a;
      --brand-navy-light: #e8eef5;
      --brand-navy-mid: #4a7ab5;
      --content-bg: #f5f7fa;
      --text-primary: #1a2332;
      --text-secondary: #5a6a7e;
      --text-muted: #8a9ab0;
      --border: #e2e8f0;

      padding: 4px 0 20px;
      width: 100%;
      max-width: 100%;
      color: var(--text-primary);
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 22px;
    }

    .page-title {
      font-size: 22px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .page-sub {
      margin-top: 3px;
      font-size: 13px;
      color: var(--text-muted);
    }

    .btn-new,
    .toolbar-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      border: none;
      border-radius: 10px;
      padding: 10px 18px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .btn-new {
      background: var(--brand-red);
      color: #fff;
    }

    .btn-new:hover {
      background: #b82424;
    }

    .primary-btn,
    .btn-primary {
      background: #1b4a7a;
      color: #fff;
      border: none;
      border-radius: 8px;
      padding: 9px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .primary-btn:hover,
    .btn-primary:hover:not(:disabled) {
      background: #163a60;
    }

    .secondary-btn,
    .btn-secondary {
      background: #f5f7fa;
      color: #334155;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 9px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
    }

    .secondary-btn:hover,
    .btn-secondary:hover {
      background: #e8eef5;
    }

    .danger-btn {
      background: var(--brand-red);
      color: #fff;
    }

    .danger-btn:hover {
      background: #b82424;
    }

    .stats-row {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: #fff;
      border-radius: 12px;
      border: 1px solid var(--border);
      padding: 16px 18px;
    }

    .stat-label {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    .stat-val {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-primary);
      margin-top: 6px;
      line-height: 1;
    }

    .stat-active {
      color: #2d7a38;
    }

    .stat-inactive {
      color: var(--brand-red);
    }

    .stat-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11.5px;
      padding: 3px 9px;
      border-radius: 20px;
      margin-top: 8px;
      font-weight: 500;
    }

    .pill-green {
      background: #edf7ee;
      color: #2d7a38;
    }

    .pill-red {
      background: var(--brand-red-light);
      color: var(--brand-red);
    }

    .pill-blue {
      background: var(--brand-navy-light);
      color: var(--brand-navy);
    }

    .tab-content {
      margin-top: 8px;
    }

    .table-wrap {
      background: #fff;
      border-radius: 14px;
      border: 1px solid var(--border);
      overflow: hidden;
    }

    .table-toolbar {
      padding: 14px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border);
      gap: 12px;
      flex-wrap: wrap;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .toolbar-right {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .table-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .table-count {
      font-size: 12px;
      background: var(--brand-navy-light);
      color: var(--brand-navy);
      padding: 2px 9px;
      border-radius: 20px;
      font-weight: 500;
    }

    .search-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--content-bg);
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 6px 12px;
      font-size: 13px;
      color: var(--text-muted);
      width: 280px;
      transition: border-color 0.15s, background 0.15s;
    }

    .search-box:focus-within {
      background: #fff;
      border-color: var(--brand-navy-mid);
    }

    .search-input-inline {
      border: none;
      outline: none;
      background: transparent;
      width: 100%;
      font-size: 13px;
      color: var(--text-primary);
      padding: 3px 0;
    }

    .search-input-inline::placeholder {
      color: var(--text-muted);
    }

    .filter-select {
      border: 1px solid var(--border);
      border-radius: 9px;
      padding: 8px 14px;
      font-size: 13px;
      color: var(--text-secondary);
      background: #fff;
      cursor: pointer;
      min-width: 130px;
    }

    .filter-select:focus {
      outline: none;
      border-color: var(--brand-navy-mid);
    }

    .action-square {
      width: 38px;
      height: 38px;
      border: 1px solid var(--border);
      border-radius: 9px;
      background: #fff;
      color: var(--text-secondary);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s ease;
    }

    .action-square:hover {
      background: var(--brand-navy-light);
      border-color: var(--brand-navy-mid);
      color: var(--brand-navy);
    }

    .bulk-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: #f8fafc;
    }

    .selected-info {
      font-size: 13px;
      font-weight: 600;
      color: var(--brand-navy);
    }

    .bulk-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .loading-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px 20px;
      gap: 16px;
      color: var(--text-secondary);
    }

    .spinner {
      display: inline-block;
      width: 26px;
      height: 26px;
      border: 3px solid #e5e7eb;
      border-top-color: var(--brand-navy);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    .mini-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .table-container {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }

    .styled-table {
      font-size: 13.5px;
      background: #fff;
    }

    .styled-table thead tr {
      background: #f8fafc;
    }

    .styled-table thead th {
      background: #f8fafc;
      padding: 9px 18px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.07em;
      border-bottom: 1px solid var(--border);
    }

    .styled-table tbody td {
      padding: 10px 18px;
      color: var(--text-primary);
      border-bottom: 1px solid var(--border);
      vertical-align: middle;
      line-height: 1.3;
    }

    .styled-table tbody tr:last-child td {
      border-bottom: none;
    }

    .styled-table tbody tr:hover td {
      background: #fafbfe;
    }

    .row-selected td {
      background: #f4f8fd;
    }

    .check-col {
      width: 44px;
      text-align: center;
    }

    .check-col input {
      width: 16px;
      height: 16px;
      cursor: pointer;
    }

    .actions-col {
      width: 110px;
    }

    .muted-cell {
      color: var(--text-secondary);
    }

    .item-name {
      font-weight: 600;
      color: var(--text-primary);
    }

    .stock-badge {
      display: inline-flex;
      align-items: center;
      padding: 5px 11px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
      background: #edf7ee;
      color: #2d7a38;
    }

    .stock-badge.low-stock {
      background: var(--brand-red-light);
      color: var(--brand-red);
    }

    .price-cell {
      color: #2d7a38;
      font-weight: 600;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      padding: 5px 11px;
      border-radius: 20px;
    }

    .status-badge.active {
      background: #edf7ee;
      color: #2d7a38;
    }

    .status-badge.inactive {
      background: var(--brand-red-light);
      color: var(--brand-red);
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    .dot-active {
      background: #2d7a38;
    }

    .dot-inactive {
      background: var(--brand-red);
    }

    .row-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-btn {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #fff;
      color: var(--brand-navy);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.12s ease;
    }

    .action-btn:hover {
      background: var(--brand-navy-light);
      border-color: var(--brand-navy-mid);
    }

    .action-btn.danger {
      color: var(--brand-red);
    }

    .action-btn.danger:hover {
      background: var(--brand-red-light);
      border-color: #efb8b8;
    }

    .empty-row {
      text-align: center;
      padding: 0;
    }

    .empty-state {
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .empty-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .empty-sub {
      font-size: 13px;
      color: var(--text-muted);
    }

    .empty-btn {
      margin-top: 8px;
    }

    .pagination-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
      background: #fff;
    }

    .pagination-left,
    .pagination-center {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pagination-info {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .page-btn {
      min-width: 38px;
      height: 34px;
      padding: 0 12px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
      color: var(--text-secondary);
      font-size: 13px;
      cursor: pointer;
      transition: all 0.12s ease;
    }

    .page-btn:hover:not(:disabled) {
      background: #f8fafc;
      border-color: var(--brand-navy-mid);
      color: var(--brand-navy);
    }

    .page-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .role-access-modal {
      background: #fff;
      width: min(760px, 96vw);
      max-height: 92vh;
      border-radius: 16px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
    }

    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 18px 24px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #fff;
      flex-shrink: 0;
    }

    .modal-heading h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .modal-heading p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.8;
    }

    .close-btn {
      width: 34px;
      height: 34px;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .modal-body {
      padding: 20px 24px 18px;
      overflow-y: auto;
    }

    .role-form-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-row.vertical {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 0;
    }

    .form-row.vertical label,
    .checkbox-row label {
      font-size: 12px;
      color: #555;
      font-weight: 500;
    }

    .form-row.vertical input {
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
    }

    .form-row.vertical input:focus {
      border-color: transparent;
      outline: 2px solid #1976d2;
    }

    .checkbox-row {
      padding: 0;
      margin-bottom: 0;
    }

    .checkbox-inline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
    }

    .sticky-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e5e7eb;
      background: #fff;
      flex-shrink: 0;
    }

    .btn-primary:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .toast-stack {
      position: fixed;
      top: 84px;
      right: 24px;
      z-index: 1200;
    }

    .app-toast {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      min-width: 320px;
      max-width: 420px;
      padding: 14px 16px;
      border: 1px solid #d6e0ec;
      border-radius: 14px;
      background: #fff;
      box-shadow: 0 14px 32px rgba(15, 23, 42, 0.18);
    }

    .toast-success {
      border-color: #cfe5d3;
    }

    .toast-error {
      border-color: #f0c6c6;
    }

    .toast-icon {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border-radius: 999px;
      background: #e8eef5;
      color: var(--brand-navy);
      font-size: 14px;
      font-weight: 700;
    }

    .toast-error .toast-icon {
      background: var(--brand-red-light);
      color: var(--brand-red);
    }

    .toast-success .toast-icon {
      background: #edf7ee;
      color: #2d7a38;
    }

    .toast-copy {
      flex: 1;
    }

    .toast-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .toast-message {
      margin-top: 2px;
      font-size: 13px;
      color: var(--text-secondary);
      line-height: 1.35;
    }

    .confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 1250;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(2px);
    }

    .confirm-dialog {
      width: min(460px, 96vw);
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
      overflow: hidden;
    }

    .confirm-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 12px;
    }

    .confirm-title {
      font-size: 17px;
      font-weight: 600;
      color: #1a2332;
    }

    .confirm-close {
      width: 30px;
      height: 30px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: #8a9ab0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    .confirm-close:hover {
      background: #f5f7fa;
      color: #1a2332;
    }

    .confirm-body {
      padding: 0 20px 20px;
      font-size: 14px;
      color: #5a6a7e;
      line-height: 1.45;
    }

    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px 20px;
      border-top: 1px solid #e2e8f0;
      background: #fff;
    }

    .confirm-btn {
      min-width: 104px;
      min-height: 40px;
      padding: 0 18px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .confirm-cancel-btn {
      background: #f5f7fa;
      color: #334155;
      border-color: #e2e8f0;
    }

    .confirm-cancel-btn:hover {
      background: #e8eef5;
    }

    .confirm-danger-btn {
      background: #d42b2b;
      color: #fff;
      border-color: #d42b2b;
    }

    .confirm-danger-btn:hover {
      background: #b82424;
      border-color: #b82424;
    }

    @media (max-width: 1100px) {
      .stats-row {
        grid-template-columns: 1fr;
      }

      .toolbar-right {
        width: 100%;
      }

      .search-box {
        width: 100%;
      }
    }

    @media (max-width: 768px) {
      .page-header,
      .bulk-bar,
      .pagination-bar {
        flex-direction: column;
        align-items: stretch;
      }

      .toolbar-left,
      .toolbar-right,
      .pagination-left,
      .pagination-center {
        width: 100%;
      }

      .toolbar-btn,
      .btn-new,
      .filter-select,
      .page-btn {
        width: 100%;
      }

      .role-form-grid {
        grid-template-columns: 1fr;
      }

      .role-access-modal {
        width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .sticky-actions {
        flex-wrap: wrap;
      }

      .sticky-actions button {
        flex: 1 1 calc(50% - 6px);
      }
    }
  `]
})
export class SparePartMasterComponent implements OnInit {
  private api = inject(ApiService);

  loading = signal(false);
  saving = signal(false);
  spareParts = signal<SparePart[]>([]);
  selectedIds = signal<Set<number>>(new Set());

  currentPage = signal(1);
  totalPages = signal(1);
  pageSize = 20;

  filters = {
    searchTerm: '',
    isActive: null as boolean | null,
    sortBy: 'SparePartId',
    sortOrder: 'DESC'
  };

  showModal = signal(false);
  isEditing = signal(false);
  confirmVisible = signal(false);
  confirmMessage = signal('');
  formData: SparePart = {
    sparePartId: 0,
    partName: '',
    partNumber: '',
    stockQuantity: 0,
    unitPrice: 0,
    isActive: true
  };

  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  private confirmAction: (() => void) | null = null;

  ngOnInit() {
    this.loadData();
  }

  activeCount(): number {
    return this.spareParts().filter(item => item.isActive).length;
  }

  inactiveCount(): number {
    return this.spareParts().filter(item => !item.isActive).length;
  }

  activePercent(): number {
    const total = this.spareParts().length;
    if (!total) return 0;
    return Math.round((this.activeCount() / total) * 1000) / 10;
  }

  loadData() {
    this.loading.set(true);

    const params = {
      searchTerm: this.filters.searchTerm,
      pageNumber: this.currentPage(),
      pageSize: this.pageSize,
      sortBy: this.filters.sortBy,
      sortOrder: this.filters.sortOrder
    };

    this.api.getSparePartsmaster(params).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.spareParts.set(response.data.items || []);
          this.totalPages.set(response.data.totalPages || 1);
        } else {
          this.showToast(response.message, 'error');
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading spare parts:', error);
        this.showToast('Failed to load spare parts', 'error');
        this.loading.set(false);
      }
    });
  }

  onSearch() {
    this.currentPage.set(1);
    this.loadData();
  }

  goToPage(page: number) {
    this.currentPage.set(page);
    this.loadData();
  }

  openAddModal() {
    this.formData = {
      sparePartId: 0,
      partName: '',
      partNumber: '',
      stockQuantity: 0,
      unitPrice: 0,
      isActive: true
    };
    this.isEditing.set(false);
    this.showModal.set(true);
  }

  openEditModal(item: SparePart) {
    this.formData = { ...item };
    this.isEditing.set(true);
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
  }

  saveItem() {
    if (!this.formData.partName.trim()) {
      this.showToast('Part name is required', 'error');
      return;
    }

    this.saving.set(true);

    if (this.isEditing()) {
      this.api.updateSparePart(this.formData.sparePartId, this.formData).subscribe({
        next: (response: any) => {
          this.saving.set(false);
          if (response.success) {
            this.showToast('Spare part updated successfully', 'success');
            this.closeModal();
            this.loadData();
          } else {
            this.showToast(response.message || 'Update failed', 'error');
          }
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Error updating spare part', 'error');
        }
      });
    } else {
      this.api.createSparePart(this.formData).subscribe({
        next: (response: any) => {
          this.saving.set(false);
          if (response.success) {
            this.showToast('Spare part created successfully', 'success');
            this.closeModal();
            this.loadData();
          } else {
            this.showToast(response.message || 'Creation failed', 'error');
          }
        },
        error: () => {
          this.saving.set(false);
          this.showToast('Error creating spare part', 'error');
        }
      });
    }
  }

  deleteItem(id: number) {
    this.openConfirm('Are you sure you want to delete this spare part?', () => {
      this.api.deleteSparePart(id).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.showToast('Spare part deleted successfully', 'success');
            this.loadData();
            this.clearSelection();
          } else {
            this.showToast(response.message || 'Delete failed', 'error');
          }
        },
        error: () => {
          this.showToast('Error deleting spare part', 'error');
        }
      });
    });
  }

  toggleSelection(id: number) {
    const newSet = new Set(this.selectedIds());
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    this.selectedIds.set(newSet);
  }

  toggleSelectAll() {
    if (this.isAllSelected()) {
      this.selectedIds.set(new Set());
    } else {
      const allIds = this.spareParts().map(item => item.sparePartId);
      this.selectedIds.set(new Set(allIds));
    }
  }

  isAllSelected(): boolean {
    const items = this.spareParts();
    return items.length > 0 && items.every(item => this.selectedIds().has(item.sparePartId));
  }

  clearSelection() {
    this.selectedIds.set(new Set());
  }

  bulkDelete() {
    if (this.selectedIds().size === 0) {
      this.showToast('No items selected', 'error');
      return;
    }

    this.openConfirm(`Delete ${this.selectedIds().size} selected spare part(s)?`, () => {
      const ids = Array.from(this.selectedIds()).join(',');
      this.api.bulkDeleteSpareParts(ids).subscribe({
        next: (response: any) => {
          if (response.success) {
            this.showToast(response.message || 'Items deleted successfully', 'success');
            this.loadData();
            this.clearSelection();
          } else {
            this.showToast(response.message || 'Delete failed', 'error');
          }
        },
        error: () => {
          this.showToast('Error deleting items', 'error');
        }
      });
    });
  }

  openConfirm(message: string, action: () => void) {
    this.confirmMessage.set(message);
    this.confirmAction = action;
    this.confirmVisible.set(true);
  }

  cancelConfirm() {
    this.confirmVisible.set(false);
    this.confirmMessage.set('');
    this.confirmAction = null;
  }

  proceedConfirm() {
    const action = this.confirmAction;
    this.cancelConfirm();
    if (action) {
      action();
    }
  }

  showToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => {
      this.toastMessage.set('');
    }, 3000);
  }
}
