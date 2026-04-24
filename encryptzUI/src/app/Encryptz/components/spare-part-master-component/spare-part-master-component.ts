// spare-part-master.component.ts

import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
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
    <div class="spare-master-container">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <h1>Spare Parts Master</h1>
          <p>Manage all spare parts inventory</p>
        </div>
        <div class="header-right">
          <button class="btn-add" (click)="openAddModal()">
            <span class="material-icons">add</span> Add New Part
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="search-box">
          <span class="material-icons">search</span>
          <input
            type="text"
            [(ngModel)]="filters.searchTerm"
            (input)="onSearch()"
            placeholder="Search by part name or number..."
          />
        </div>
        <div class="filter-group">
          <select [(ngModel)]="filters.isActive" (change)="loadData()">
            <option [value]="null">All Status</option>
            <option [value]="true">Active</option>
            <option [value]="false">Inactive</option>
          </select>
        </div>
        <div class="filter-group">
          <select [(ngModel)]="filters.sortBy" (change)="loadData()">
            <option value="SparePartId">ID</option>
            <option value="PartName">Part Name</option>
            <option value="StockQuantity">Stock</option>
            <option value="UnitPrice">Price</option>
          </select>
          <select [(ngModel)]="filters.sortOrder" (change)="loadData()">
            <option value="ASC">↑ Ascending</option>
            <option value="DESC">↓ Descending</option>
          </select>
        </div>
        <button class="btn-refresh" (click)="loadData()">
          <span class="material-icons">refresh</span>
        </button>
      </div>

      <!-- Bulk Actions -->
      @if (selectedIds().size > 0) {
        <div class="bulk-bar">
          <span>{{ selectedIds().size }} item(s) selected</span>
          <button class="btn-bulk-delete" (click)="bulkDelete()">
            <span class="material-icons">delete</span> Delete Selected
          </button>
          <button class="btn-clear" (click)="clearSelection()">
            Clear Selection
          </button>
        </div>
      }

      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-overlay">
          <div class="spinner"></div>
          <p>Loading spare parts...</p>
        </div>
      }

      <!-- Table -->
      @if (!loading()) {
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th class="checkbox-col">
                  <input
                    type="checkbox"
                    [checked]="isAllSelected()"
                    (change)="toggleSelectAll()"
                  />
                </th>
                <th>ID</th>
                <th>Part Name</th>
                <th>Part Number</th>
                <th>Stock Quantity</th>
                <th>Unit Price (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (item of spareParts(); track item.sparePartId) {
                <tr [class.selected]="selectedIds().has(item.sparePartId)">
                  <td class="checkbox-col">
                    <input
                      type="checkbox"
                      [checked]="selectedIds().has(item.sparePartId)"
                      (change)="toggleSelection(item.sparePartId)"
                    />
                  </td>
                  <td>{{ item.sparePartId }}</td>
                  <td class="part-name">{{ item.partName }}</td>
                  <td>{{ item.partNumber || '—' }}</td>
                  <td>
                    <span class="stock-badge" [class.low-stock]="item.stockQuantity < 5">
                      {{ item.stockQuantity }}
                    </span>
                  </td>
                  <td>{{ item.unitPrice | currency:'INR':'symbol':'1.0-0' }}</td>
                  <td>
                    <span class="status-badge" [class.active]="item.isActive" [class.inactive]="!item.isActive">
                      {{ item.isActive ? 'Active' : 'Inactive' }}
                    </span>
                  </td>
                  <td class="actions-cell">
                    <button class="btn-edit" (click)="openEditModal(item)" title="Edit">
                      <span class="material-icons">edit</span>
                    </button>
                    <button class="btn-delete" (click)="deleteItem(item.sparePartId)" title="Delete">
                      <span class="material-icons">delete</span>
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="empty-cell">
                    <span class="material-icons">inventory_2</span>
                    <p>No spare parts found</p>
                    <button class="btn-primary" (click)="openAddModal()">Add New Part</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- Pagination -->
      @if (totalPages() > 1) {
        <div class="pagination">
          <button
            class="page-btn"
            (click)="goToPage(currentPage() - 1)"
            [disabled]="currentPage() <= 1"
          >
            « Prev
          </button>
          <span class="page-info">
            Page {{ currentPage() }} of {{ totalPages() }}
          </span>
          <button
            class="page-btn"
            (click)="goToPage(currentPage() + 1)"
            [disabled]="currentPage() >= totalPages()"
          >
            Next »
          </button>
        </div>
      }
    </div>

    <!-- Add/Edit Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="closeModal()"></div>
      <div class="modal-container">
        <div class="modal-header">
          <h3>{{ isEditing() ? 'Edit Spare Part' : 'Add New Spare Part' }}</h3>
          <button class="modal-close" (click)="closeModal()">
            <span class="material-icons">close</span>
          </button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Part Name *</label>
            <input
              type="text"
              [(ngModel)]="formData.partName"
              class="form-control"
              placeholder="Enter part name"
            />
          </div>
          <div class="form-group">
            <label>Part Number</label>
            <input
              type="text"
              [(ngModel)]="formData.partNumber"
              class="form-control"
              placeholder="Enter part number (optional)"
            />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Stock Quantity</label>
              <input
                type="number"
                [(ngModel)]="formData.stockQuantity"
                class="form-control"
                min="0"
              />
            </div>
            <div class="form-group">
              <label>Unit Price (₹)</label>
              <input
                type="number"
                [(ngModel)]="formData.unitPrice"
                class="form-control"
                min="0"
                step="0.01"
              />
            </div>
          </div>
          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" [(ngModel)]="formData.isActive" />
              <span>Active</span>
            </label>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" (click)="closeModal()">Cancel</button>
          <button class="btn-save" (click)="saveItem()" [disabled]="saving()">
            @if (saving()) {
              <div class="mini-spinner"></div>
            }
            {{ isEditing() ? 'Update' : 'Create' }}
          </button>
        </div>
      </div>
    }

    <!-- Toast Notification -->
    @if (toastMessage()) {
      <div class="toast" [class.toast-error]="toastType() === 'error'">
        <span class="material-icons">{{ toastType() === 'success' ? 'check_circle' : 'error' }}</span>
        <span>{{ toastMessage() }}</span>
      </div>
    }
  `,
  styles: [`
    .spare-master-container {
      padding: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;

      h1 {
        font-size: 24px;
        font-weight: 700;
        color: #1a1a2e;
        margin: 0 0 4px;
      }

      p {
        font-size: 14px;
        color: #6b7280;
        margin: 0;
      }
    }

    .btn-add {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border: none;
      border-radius: 10px;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
      }

      .material-icons {
        font-size: 18px;
      }
    }

    .filters-bar {
      display: flex;
      gap: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
      align-items: center;

      .search-box {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 16px;
        background: #fff;
        border: 1.5px solid #e5e7eb;
        border-radius: 10px;
        flex: 1;
        min-width: 250px;

        .material-icons {
          color: #9ca3af;
          font-size: 20px;
        }

        input {
          flex: 1;
          border: none;
          outline: none;
          font-size: 14px;
        }

        &:focus-within {
          border-color: #6366f1;
        }
      }

      .filter-group {
        display: flex;
        gap: 8px;

        select {
          padding: 8px 12px;
          border: 1.5px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          background: #fff;
          cursor: pointer;
          outline: none;

          &:focus {
            border-color: #6366f1;
          }
        }
      }

      .btn-refresh {
        width: 38px;
        height: 38px;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          border-color: #6366f1;
          color: #6366f1;
        }
      }
    }

    .bulk-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      background: #fefce8;
      border: 1px solid #fef08a;
      border-radius: 10px;
      margin-bottom: 20px;

      span {
        font-size: 13px;
        font-weight: 600;
        color: #ca8a04;
      }

      .btn-bulk-delete {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        background: #fef2f2;
        border: none;
        border-radius: 6px;
        color: #dc2626;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;

        &:hover {
          background: #dc2626;
          color: #fff;
        }
      }

      .btn-clear {
        padding: 6px 12px;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;

        &:hover {
          border-color: #9ca3af;
        }
      }
    }

    .table-responsive {
      overflow-x: auto;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
      background: #fff;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;

      th {
        padding: 14px 16px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        background: #f8fafc;
        border-bottom: 1px solid #e5e7eb;
      }

      td {
        padding: 12px 16px;
        font-size: 13px;
        color: #374151;
        border-bottom: 1px solid #f3f4f6;
      }

      tr:hover {
        background: #f9fafb;
      }

      tr.selected {
        background: #eef2ff;
      }

      .checkbox-col {
        width: 40px;
        text-align: center;

        input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
      }

      .part-name {
        font-weight: 600;
        color: #1e293b;
      }

      .stock-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 12px;
        font-weight: 600;
        background: #ecfdf5;
        color: #059669;

        &.low-stock {
          background: #fef2f2;
          color: #dc2626;
        }
      }

      .status-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;

        &.active {
          background: #d1fae5;
          color: #059669;
        }

        &.inactive {
          background: #f3f4f6;
          color: #6b7280;
        }
      }

      .actions-cell {
        display: flex;
        gap: 8px;

        button {
          width: 30px;
          height: 30px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;

          .material-icons {
            font-size: 16px;
          }
        }

        .btn-edit {
          background: #eef2ff;
          color: #6366f1;

          &:hover {
            background: #6366f1;
            color: #fff;
          }
        }

        .btn-delete {
          background: #fef2f2;
          color: #dc2626;

          &:hover {
            background: #dc2626;
            color: #fff;
          }
        }
      }
    }

    .empty-cell {
      text-align: center;
      padding: 60px !important;
      color: #9ca3af;

      .material-icons {
        font-size: 48px;
        display: block;
        margin-bottom: 12px;
      }

      p {
        margin-bottom: 16px;
      }
    }

    .btn-primary {
      padding: 8px 16px;
      background: #6366f1;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;

      &:hover {
        background: #4f46e5;
      }
    }

    .pagination {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 16px;
      margin-top: 20px;
      padding: 16px;

      .page-btn {
        padding: 8px 16px;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        background: #fff;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;

        &:hover:not(:disabled) {
          border-color: #6366f1;
          color: #6366f1;
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .page-info {
        font-size: 13px;
        color: #6b7280;
      }
    }

    .loading-overlay {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 60px;
      background: #fff;
      border-radius: 12px;
      border: 1px solid #e5e7eb;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid #e5e7eb;
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
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

    /* Modal Styles */
    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 1000;
      backdrop-filter: blur(3px);
    }

    .modal-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-width: 90vw;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
      z-index: 1001;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 18px 20px;
      background: #f8fafc;
      border-bottom: 1px solid #e5e7eb;

      h3 {
        font-size: 16px;
        font-weight: 700;
        margin: 0;
      }

      .modal-close {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        border: none;
        background: #f3f4f6;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: #e5e7eb;
        }
      }
    }

    .modal-body {
      padding: 20px;
    }

    .form-group {
      margin-bottom: 16px;

      label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 6px;
      }

      .form-control {
        width: 100%;
        padding: 10px 12px;
        border: 1.5px solid #e5e7eb;
        border-radius: 8px;
        font-size: 13px;
        outline: none;

        &:focus {
          border-color: #6366f1;
        }
      }

      .checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;

        input {
          width: 16px;
          height: 16px;
          cursor: pointer;
        }

        span {
          font-size: 13px;
          font-weight: normal;
        }
      }
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #e5e7eb;

      button {
        padding: 8px 20px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
      }

      .btn-cancel {
        background: #fff;
        border: 1.5px solid #e5e7eb;

        &:hover {
          border-color: #9ca3af;
        }
      }

      .btn-save {
        background: #6366f1;
        border: none;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 8px;

        &:hover:not(:disabled) {
          background: #4f46e5;
        }

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
    }

    /* Toast */
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 20px;
      background: #10b981;
      color: #fff;
      border-radius: 10px;
      z-index: 1100;
      animation: slideIn 0.3s ease;

      &.toast-error {
        background: #ef4444;
      }

      .material-icons {
        font-size: 20px;
      }
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `]
})
export class SparePartMasterComponent implements OnInit {
  private api = inject(ApiService);

  // State
  loading = signal(false);
  saving = signal(false);
  spareParts = signal<SparePart[]>([]);
  selectedIds = signal<Set<number>>(new Set());

  // Pagination
  currentPage = signal(1);
  totalPages = signal(1);
  pageSize = 20;

  // Filters
  filters = {
    searchTerm: '',
    isActive: null as boolean | null,
    sortBy: 'SparePartId',
    sortOrder: 'DESC'
  };

  // Modal
  showModal = signal(false);
  isEditing = signal(false);
  formData: SparePart = {
    sparePartId: 0,
    partName: '',
    partNumber: '',
    stockQuantity: 0,
    unitPrice: 0,
    isActive: true
  };

  // Toast
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');

  ngOnInit() {
    this.loadData();
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
        error: (error) => {
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
        error: (error) => {
          this.saving.set(false);
          this.showToast('Error creating spare part', 'error');
        }
      });
    }
  }

  deleteItem(id: number) {
    if (confirm('Are you sure you want to delete this spare part?')) {
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
        error: (error) => {
          this.showToast('Error deleting spare part', 'error');
        }
      });
    }
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

    if (confirm(`Delete ${this.selectedIds().size} selected spare part(s)?`)) {
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
        error: (error) => {
          this.showToast('Error deleting items', 'error');
        }
      });
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
