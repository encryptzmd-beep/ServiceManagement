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
          <div class="modal-heading">
            <h3>{{ isEditMode ? 'Edit Product' : 'Add New Product' }}</h3>
            <p>
              {{
                isEditMode
                  ? 'Update product master details and pricing information'
                  : 'Create a new product in the master catalog'
              }}
            </p>
          </div>
          <button class="modal-close" (click)="close.emit(false)" aria-label="Close">×</button>
        </div>

        <div class="modal-body">
          <form #productForm="ngForm">
            <div class="tabs">
              <button
                *ngFor="let tab of tabs"
                type="button"
                class="tab"
                [class.active]="activeTab === tab.id"
                (click)="activeTab = tab.id">
                <span class="tab-icon">{{ tab.icon }}</span>
                <span>{{ tab.name }}</span>
              </button>
            </div>

            <div class="form-banner error-banner" *ngIf="submitError">
              {{ submitError }}
            </div>

            <div class="tab-content" [class.active]="activeTab === 'basic'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Product Code *</label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="formData.productCode"
                    name="productCode"
                    required
                    #code="ngModel">
                  <div class="error-message" *ngIf="code.touched && code.errors?.['required']">
                    Product code is required
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label">Product Name *</label>
                  <input
                    type="text"
                    class="form-control"
                    [(ngModel)]="formData.productName"
                    name="productName"
                    required
                    #name="ngModel">
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

            <div class="tab-content" [class.active]="activeTab === 'pricing'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">MRP (INR)</label>
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
                  <input
                    type="date"
                    class="form-control"
                    [(ngModel)]="formData.priceEffectiveDate"
                    name="priceEffectiveDate">
                </div>
              </div>
            </div>

            <div class="tab-content" [class.active]="activeTab === 'warranty'">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Warranty (Months)</label>
                  <input
                    type="number"
                    class="form-control"
                    [(ngModel)]="formData.warrantyMonths"
                    name="warrantyMonths">
                </div>

                <div class="form-group">
                  <label class="form-label">Status</label>
                  <label class="checkbox-label">
                    <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive">
                    <span>Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="tab-content" [class.active]="activeTab === 'description'">
              <div class="form-group">
                <label class="form-label">Description</label>
                <textarea
                  class="form-control"
                  rows="5"
                  [(ngModel)]="formData.description"
                  name="description"></textarea>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn btn-outline" (click)="close.emit(false)">Cancel</button>
          <button class="btn btn-primary" (click)="onSubmit()" [disabled]="isSubmitting">
            <span *ngIf="isSubmitting" class="spinner"></span>
            {{ isEditMode ? 'Update Product' : 'Create Product' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    * {
      box-sizing: border-box;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(2px);
    }

    .modal {
      width: min(1080px, 96vw);
      max-height: 92vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      background: #fff;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
    }

    .modal-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 18px 24px;
      background: linear-gradient(135deg, #0f172a, #1e293b);
      color: #fff;
    }

    .modal-heading h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      line-height: 1.2;
    }

    .modal-heading p {
      margin: 4px 0 0;
      font-size: 13px;
      color: rgba(255, 255, 255, 0.8);
    }

    .modal-close {
      width: 34px;
      height: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      border: none;
      border-radius: 8px;
      background: rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    .modal-close:hover {
      background: rgba(255, 255, 255, 0.22);
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 20px 24px 24px;
      background: #fff;
    }

    .tabs {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 22px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    }

    .tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 14px;
      border: 1px solid transparent;
      border-radius: 10px;
      background: transparent;
      color: #5a6a7e;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .tab:hover {
      background: #f8fafc;
      color: #1b4a7a;
    }

    .tab.active {
      background: #e8eef5;
      color: #1b4a7a;
      border-color: #d6e0ec;
    }

    .tab-icon {
      font-size: 14px;
      line-height: 1;
    }

    .tab-content {
      display: none;
    }

    .tab-content.active {
      display: block;
    }

    .form-row {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .form-label {
      font-size: 12px;
      font-weight: 600;
      color: #5a6a7e;
      letter-spacing: 0.02em;
    }

    .form-control {
      width: 100%;
      min-height: 42px;
      padding: 10px 12px;
      border: 1px solid #d8e0ea;
      border-radius: 10px;
      background: #fff;
      color: #1a2332;
      font-size: 14px;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
    }

    textarea.form-control {
      min-height: 132px;
      resize: vertical;
    }

    .form-control:focus {
      outline: none;
      border-color: #4a7ab5;
      box-shadow: 0 0 0 3px rgba(74, 122, 181, 0.12);
    }

    .error-message {
      font-size: 12px;
      color: #d42b2b;
    }

    .form-banner {
      margin-bottom: 16px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.35;
    }

    .error-banner {
      background: #fdf1f1;
      border: 1px solid #f3c9c9;
      color: #b42318;
    }

    .checkbox-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 42px;
      padding: 10px 12px;
      border: 1px solid #d8e0ea;
      border-radius: 10px;
      color: #1a2332;
      font-size: 14px;
    }

    .checkbox-label input {
      margin: 0;
    }

    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      padding: 16px 24px;
      border-top: 1px solid #e2e8f0;
      background: #fff;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 18px;
      border: 1px solid transparent;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }

    .btn-primary {
      background: #1b4a7a;
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      background: #163a60;
    }

    .btn-outline {
      background: #f5f7fa;
      border-color: #e2e8f0;
      color: #334155;
    }

    .btn-outline:hover:not(:disabled) {
      background: #e8eef5;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 900px) {
      .modal {
        width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .modal-overlay {
        padding: 0;
      }

      .modal-header,
      .modal-body,
      .modal-footer {
        padding-left: 16px;
        padding-right: 16px;
      }

      .modal-footer {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }
    }
  `]
})
export class ProductFormComponent implements OnInit {
  @Input() product: ProductMasterDTO | null = null;
  @Input() isEditMode = false;
  @Output() close = new EventEmitter<boolean | { refresh?: boolean; message?: string; type?: 'success' | 'error' }>();

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
  submitError = '';
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
      this.submitError = 'Please fill all required fields before saving.';
      return;
    }

    this.submitError = '';
    this.isSubmitting = true;
    const request = { ...this.formData };

    const apiCall = this.isEditMode && this.product
      ? this.productService.updateProduct(this.product.productMasterId, request)
      : this.productService.createProduct(request);

    apiCall.subscribe({
      next: (response) => {
        if (response.success) {
          this.close.emit({
            refresh: true,
            message: this.isEditMode ? 'Product updated successfully' : 'Product created successfully',
            type: 'success'
          });
        } else {
          this.submitError = response.message || 'Operation failed';
        }
        this.isSubmitting = false;
      },
      error: (error) => {
        console.error('Error saving product:', error);
        this.submitError = error.error?.message || 'Error saving product';
        this.isSubmitting = false;
      }
    });
  }
}
