// components/product-view/product-view.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { ProductMasterDTO } from '../../Models/ApiModels';


@Component({
  selector: 'app-product-view',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close.emit()">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header" [style.background]="product?.isActive ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 'linear-gradient(135deg, #868f96 0%, #596164 100%)'">
          <h3>
            📄 Product Details
          </h3>
          <button class="modal-close" (click)="close.emit()">✕</button>
        </div>

        <div class="modal-body">
          <div class="info-section">
            <h4>📋 Basic Information</h4>
            <div class="info-grid">
              <div><label>Product Code:</label> <strong>{{product?.productCode}}</strong></div>
              <div><label>Product Name:</label> <strong>{{product?.productName}}</strong></div>
              <div><label>Model:</label> {{product?.model || '-'}}</div>
              <div><label>Brand:</label> {{product?.brand || '-'}}</div>
            </div>
          </div>

          <div class="info-section">
            <h4>📁 Category</h4>
            <div class="info-grid">
              <div><label>Category:</label>
                <span class="badge badge-info">{{product?.category || '-'}}</span>
              </div>
              <div><label>Sub Category:</label>
                <span class="badge badge-primary">{{product?.subCategory || '-'}}</span>
              </div>
            </div>
          </div>

          <div class="info-section">
            <h4>💰 Pricing</h4>
            <div class="info-grid">
              <div><label>MRP:</label> <strong style="color: #28a745;">{{formatCurrency(product?.mrp)}}</strong></div>
              <div><label>Organization:</label>
                <span class="chip" [class.chip-primary]="product?.org === 'SOFPL'" [class.chip-accent]="product?.org === 'NFPL'">
                  {{product?.org}}
                </span>
              </div>
              <div><label>Price Change Status:</label> {{product?.priceChangeStatus || 'No Change'}}</div>
              <div><label>Price Effective Date:</label> {{priceEffectiveDate}}</div>
            </div>
          </div>

          <div class="info-section">
            <h4>✅ Warranty & Status</h4>
            <div class="info-grid">
              <div><label>Warranty:</label> {{product?.warrantyMonths ? product?.warrantyMonths + ' months' : '-'}}</div>
              <div><label>Status:</label>
                <span class="badge" [class.badge-success]="product?.isActive" [class.badge-danger]="!product?.isActive">
                  {{product?.isActive ? 'Active' : 'Inactive'}}
                </span>
              </div>
            </div>
          </div>

          <div class="info-section" *ngIf="product?.description">
            <h4>📄 Description</h4>
            <p style="line-height: 1.6; color: #555;">{{product?.description}}</p>
          </div>

          <div class="info-section">
            <h4>⏰ System Information</h4>
            <div class="info-grid">
              <div><label>Created Date:</label>  {{formattedCreatedDate}}</div>
              <div><label>Last Updated:</label> {{formattedUpdatedDate}}</div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn btn-primary" (click)="close.emit()">Close</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .info-section {
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 1px solid #e9ecef;
    }
    .info-section:last-child {
      border-bottom: none;
    }
    .info-section h4 {
      margin: 0 0 16px 0;
      color: #333;
      font-size: 16px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .info-grid div label {
      display: block;
      font-size: 12px;
      color: #666;
      margin-bottom: 4px;
    }
    @media (max-width: 600px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }
    * {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background: #f5f7fa;
  color: #333;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

/* Card Styles */
.card {
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.card-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 24px;
  font-weight: 500;
  margin: 0;
}

.card-body {
  padding: 24px;
}

/* Button Styles */
.btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-danger {
  background: #dc3545;
  color: white;
}

.btn-danger:hover {
  background: #c82333;
}

.btn-secondary {
  background: #6c757d;
  color: white;
}

.btn-secondary:hover {
  background: #5a6268;
}

.btn-outline {
  background: transparent;
  border: 1px solid #ddd;
  color: #666;
}

.btn-outline:hover {
  background: #f8f9fa;
}

.btn-sm {
  padding: 4px 12px;
  font-size: 12px;
}

.btn-group {
  display: flex;
  gap: 8px;
}

/* Form Styles */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: #333;
}

.form-control {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.3s ease;
}

.form-control:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-control.error {
  border-color: #dc3545;
}

.error-message {
  color: #dc3545;
  font-size: 12px;
  margin-top: 4px;
}

.form-row {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.form-row .form-group {
  flex: 1;
  margin-bottom: 0;
}

/* Table Styles */
.table-container {
  overflow-x: auto;
  margin-top: 20px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th {
  text-align: left;
  padding: 12px 16px;
  background: #f8f9fa;
  font-weight: 600;
  color: #495057;
  border-bottom: 2px solid #dee2e6;
  cursor: pointer;
  user-select: none;
}

th:hover {
  background: #e9ecef;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid #e9ecef;
}

tr:hover {
  background: #f8f9fa;
}

tr.inactive {
  background: #fff3f3;
  opacity: 0.7;
}

/* Filter Section */
.filters-section {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 24px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  align-items: flex-end;
}

.filter-group {
  flex: 1;
  min-width: 200px;
}

.filter-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 500;
  color: #666;
}

.filter-group input,
.filter-group select {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
}

/* Pagination */
.pagination {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #e9ecef;
}

.pagination button {
  padding: 6px 12px;
  border: 1px solid #ddd;
  background: white;
  border-radius: 4px;
  cursor: pointer;
}

.pagination button:hover:not(:disabled) {
  background: #f8f9fa;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination .page-info {
  font-size: 14px;
  color: #666;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 90vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.modal-header h3 {
  margin: 0;
  font-size: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.modal-close {
  background: none;
  border: none;
  color: white;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.modal-footer {
  padding: 16px 24px;
  border-top: 1px solid #e9ecef;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* Tabs */
.tabs {
  display: flex;
  border-bottom: 2px solid #e9ecef;
  margin-bottom: 24px;
}

.tab {
  padding: 12px 24px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  transition: all 0.3s ease;
}

.tab:hover {
  color: #667eea;
}

.tab.active {
  color: #667eea;
  border-bottom: 2px solid #667eea;
  margin-bottom: -2px;
}

.tab-content {
  display: none;
}

.tab-content.active {
  display: block;
}

/* Badges & Chips */
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
}

.badge-primary {
  background: #e3f2fd;
  color: #1976d2;
}

.badge-success {
  background: #d4edda;
  color: #155724;
}

.badge-danger {
  background: #f8d7da;
  color: #721c24;
}

.badge-warning {
  background: #fff3cd;
  color: #856404;
}

.badge-info {
  background: #d1ecf1;
  color: #0c5460;
}

.chip {
  display: inline-flex;
  align-items: center;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 12px;
  font-weight: 500;
}

.chip-primary {
  background: #e3f2fd;
  color: #1976d2;
}

.chip-accent {
  background: #f3e5f5;
  color: #7b1fa2;
}

/* Loading Spinner */
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
  gap: 16px;
}

/* Bulk Actions Bar */
.bulk-actions-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #e3f2fd;
  border-radius: 8px;
  margin-bottom: 20px;
}

.selected-info {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #1976d2;
  font-weight: 500;
}

.bulk-actions {
  display: flex;
  gap: 12px;
}

/* Checkbox */
.checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

/* Responsive */
@media (max-width: 768px) {
  .container {
    padding: 12px;
  }

  .form-row {
    flex-direction: column;
    gap: 16px;
  }

  .filters-section {
    flex-direction: column;
  }

  .filter-group {
    width: 100%;
  }

  .modal {
    width: 95%;
    margin: 10px;
  }
}

  `]
})
export class ProductViewComponent {
  @Input() product: ProductMasterDTO | null = null;
  @Output() close = new EventEmitter<void>();

  formatCurrency(value: number | undefined): string {
    if (!value) return '-';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }
  // In your component
get formattedCreatedDate(): string {
  if (!this.product?.createdDate) return '-';
  return new DatePipe('en-US').transform(this.product.createdDate, 'medium') || '-';
}

get formattedUpdatedDate(): string {
  if (!this.product?.updatedDate) return '-';
  return new DatePipe('en-US').transform(this.product.updatedDate, 'medium') || '-';
}
get priceEffectiveDate(): string {
  if (!this.product?.priceEffectiveDate) return '-';
  return new DatePipe('en-US').transform(this.product.priceEffectiveDate, 'medium') || '-';
}

}
