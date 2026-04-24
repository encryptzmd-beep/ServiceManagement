// components/product-form/product-form.component.ts
import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductMasterDTO, ProductMasterRequest } from '../../Models/ApiModels';
import { ProductService } from '../../Services/product-service';


@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay" (click)="close.emit(false)">
      <div class="modal" (click)="$event.stopPropagation()">
        <div class="modal-header">
          <h3>
            {{isEditMode ? '✏️ Edit Product' : '➕ Add New Product'}}
          </h3>
          <button class="modal-close" (click)="close.emit(false)">✕</button>
        </div>

        <div class="modal-body">
          <form #productForm="ngForm">
            <!-- Tabs -->
            <div class="tabs">
              <button *ngFor="let tab of tabs"
                      class="tab"
                      [class.active]="activeTab === tab.id"
                      (click)="activeTab = tab.id">
                {{tab.icon}} {{tab.name}}
              </button>
            </div>

            <!-- Basic Info Tab -->
            <div class="tab-content" [class.active]="activeTab === 'basic'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Product Code *</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.productCode"
                         name="productCode" required #code="ngModel">
                  <div class="error-message" *ngIf="code.touched && code.errors?.['required']">
                    Product code is required
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Product Name *</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.productName"
                         name="productName" required #name="ngModel">
                  <div class="error-message" *ngIf="name.touched && name.errors?.['required']">
                    Product name is required
                  </div>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Model</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.model" name="model">
                </div>
                <div class="form-group">
                  <label class="form-label">Brand</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.brand" name="brand">
                </div>
              </div>
            </div>

            <!-- Category Tab -->
            <div class="tab-content" [class.active]="activeTab === 'category'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Category</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.category" name="category">
                </div>
                <div class="form-group">
                  <label class="form-label">Sub Category</label>
                  <input type="text" class="form-control" [(ngModel)]="formData.subCategory" name="subCategory">
                </div>
              </div>
            </div>

            <!-- Pricing Tab -->
            <div class="tab-content" [class.active]="activeTab === 'pricing'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">MRP (₹)</label>
                  <input type="number" class="form-control" [(ngModel)]="formData.mrp" name="mrp">
                </div>
                <div class="form-group">
                  <label class="form-label">Organization</label>
                  <select class="form-control" [(ngModel)]="formData.org" name="org">
                    <option value="SOFPL">SOFPL</option>
                    <option value="NFPL">NFPL</option>
                  </select>
                </div>
              </div>

              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Price Change Status</label>
                  <select class="form-control" [(ngModel)]="formData.priceChangeStatus" name="priceChangeStatus">
                    <option value="">No Change</option>
                    <option value="Changed">Changed</option>
                    <option value="New">New</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">Price Effective Date</label>
                  <input type="date" class="form-control" [(ngModel)]="formData.priceEffectiveDate" name="priceEffectiveDate">
                </div>
              </div>
            </div>

            <!-- Warranty Tab -->
            <div class="tab-content" [class.active]="activeTab === 'warranty'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Warranty (Months)</label>
                  <input type="number" class="form-control" [(ngModel)]="formData.warrantyMonths" name="warrantyMonths">
                </div>
                <div class="form-group">
                  <label class="form-label">
                    <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive" style="margin-right: 8px;">
                    Active
                  </label>
                </div>
              </div>
            </div>

            <!-- Description Tab -->
            <div class="tab-content" [class.active]="activeTab === 'description'">
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea class="form-control" rows="5" [(ngModel)]="formData.description" name="description"></textarea>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" (click)="close.emit(false)">Cancel</button>
          <button class="btn btn-primary" (click)="onSubmit()" [disabled]="isSubmitting">
            <span *ngIf="isSubmitting" class="spinner" style="margin-right: 8px;"></span>
            {{isEditMode ? 'Update Product' : 'Create Product'}}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-body {
      max-height: 60vh;
      overflow-y: auto;
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
export class ProductFormComponent implements OnInit {
  @Input() product: ProductMasterDTO | null = null;
  @Input() isEditMode = false;
  @Output() close = new EventEmitter<boolean>();

  formData: ProductMasterRequest = {
    productCode: '',
    productName: '',
    brand: 'AEROFIT',
    category: '',
    subCategory: '',
    model: '',
    description: '',
    mrp: 0,
    org: 'SOFPL',
    priceChangeStatus: '',
    priceEffectiveDate: new Date(),
    warrantyMonths: 12,
    isActive: true,
    pageNumber: 1,
    pageSize: 20,
    sortColumn: 'ProductMasterId',
    sortDirection: 'DESC'
  };

  isSubmitting = false;
  activeTab = 'basic';
  tabs = [
    { id: 'basic', name: 'Basic Info', icon: '📝' },
    { id: 'category', name: 'Category', icon: '📁' },
    { id: 'pricing', name: 'Pricing', icon: '💰' },
    { id: 'warranty', name: 'Warranty', icon: '✅' },
    { id: 'description', name: 'Description', icon: '📄' }
  ];

  constructor(private productService: ProductService) {}

  ngOnInit(): void {
    if (this.isEditMode && this.product) {
      this.formData = {
        productCode: this.product.productCode,
        productName: this.product.productName,
        brand: this.product.brand,
        category: this.product.category,
        subCategory: this.product.subCategory,
        model: this.product.model,
        description: this.product.description,
        mrp: this.product.mrp,
        org: this.product.org,
        priceChangeStatus: this.product.priceChangeStatus,
        priceEffectiveDate: this.product.priceEffectiveDate,
        warrantyMonths: this.product.warrantyMonths,
        isActive: this.product.isActive,
        pageNumber: 1,
        pageSize: 20,
        sortColumn: 'ProductMasterId',
        sortDirection: 'DESC'
      };
    }
  }

  onSubmit(): void {
    if (!this.formData.productCode || !this.formData.productName) {
      alert('Please fill all required fields');
      return;
    }

    this.isSubmitting = true;
    const request = { ...this.formData };

    const apiCall = this.isEditMode && this.product
      ? this.productService.updateProduct(this.product.productMasterId, request)
      : this.productService.createProduct(request);

    apiCall.subscribe({
      next: (response) => {
        if (response.success) {
          alert(this.isEditMode ? 'Product updated successfully' : 'Product created successfully');
          this.close.emit(true);
        } else {
          alert(response.message || 'Operation failed');
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error saving product:', error);
        alert(error.error?.message || 'Error saving product');
        this.isSubmitting = false;
      }
    });
  }
}
