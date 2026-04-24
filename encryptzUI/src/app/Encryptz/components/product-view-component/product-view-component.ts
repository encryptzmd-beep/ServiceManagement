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
        <div class="modal-header">
          <div class="modal-heading">
            <h3>Product Details</h3>
            <p>Review product master information, pricing, warranty, and system metadata</p>
          </div>
          <button class="modal-close" (click)="close.emit()" aria-label="Close">×</button>
        </div>

        <div class="modal-body">
          <div class="hero-card">
            <div>
              <div class="hero-label">Product</div>
              <div class="hero-title">{{ product?.productName || '-' }}</div>
              <div class="hero-meta">{{ product?.productCode || '-' }} <span *ngIf="product?.model">• {{ product?.model }}</span></div>
            </div>

            <div class="hero-status-wrap">
              <span class="status-badge" [class.active]="product?.isActive" [class.inactive]="!product?.isActive">
                <span class="status-dot" [class.dot-active]="product?.isActive" [class.dot-inactive]="!product?.isActive"></span>
                {{ product?.isActive ? 'Active' : 'Inactive' }}
              </span>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">Basic Information</div>
            <div class="detail-grid">
              <div class="detail-card">
                <div class="field-label">Product Code</div>
                <div class="field-value strong">{{ product?.productCode || '-' }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Product Name</div>
                <div class="field-value strong">{{ product?.productName || '-' }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Model</div>
                <div class="field-value">{{ product?.model || '-' }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Brand</div>
                <div class="field-value">{{ product?.brand || '-' }}</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">Category</div>
            <div class="detail-grid">
              <div class="detail-card">
                <div class="field-label">Category</div>
                <div class="field-value">
                  <span class="info-badge">{{ product?.category || '-' }}</span>
                </div>
              </div>
              <div class="detail-card">
                <div class="field-label">Sub Category</div>
                <div class="field-value">
                  <span class="sub-badge">{{ product?.subCategory || '-' }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">Pricing</div>
            <div class="detail-grid">
              <div class="detail-card">
                <div class="field-label">MRP</div>
                <div class="field-value price">{{ formatCurrency(product?.mrp) }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Organization</div>
                <div class="field-value">
                  <span class="org-chip" [class.org-primary]="product?.org === 'SOFPL'" [class.org-accent]="product?.org === 'NFPL'">
                    {{ product?.org || '-' }}
                  </span>
                </div>
              </div>
              <div class="detail-card">
                <div class="field-label">Price Change Status</div>
                <div class="field-value">{{ product?.priceChangeStatus || 'No Change' }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Price Effective Date</div>
                <div class="field-value">{{ priceEffectiveDate }}</div>
              </div>
            </div>
          </div>

          <div class="detail-section">
            <div class="section-title">Warranty & Status</div>
            <div class="detail-grid">
              <div class="detail-card">
                <div class="field-label">Warranty</div>
                <div class="field-value">{{ product?.warrantyMonths ? product?.warrantyMonths + ' months' : '-' }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Status</div>
                <div class="field-value">
                  <span class="status-badge" [class.active]="product?.isActive" [class.inactive]="!product?.isActive">
                    <span class="status-dot" [class.dot-active]="product?.isActive" [class.dot-inactive]="!product?.isActive"></span>
                    {{ product?.isActive ? 'Active' : 'Inactive' }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="detail-section" *ngIf="product?.description">
            <div class="section-title">Description</div>
            <div class="description-card">{{ product?.description }}</div>
          </div>

          <div class="detail-section">
            <div class="section-title">System Information</div>
            <div class="detail-grid">
              <div class="detail-card">
                <div class="field-label">Created Date</div>
                <div class="field-value">{{ formattedCreatedDate }}</div>
              </div>
              <div class="detail-card">
                <div class="field-label">Last Updated</div>
                <div class="field-value">{{ formattedUpdatedDate }}</div>
              </div>
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
      width: min(1040px, 96vw);
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

    .hero-card {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 20px;
      padding: 18px 20px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #f8fafc;
    }

    .hero-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8a9ab0;
    }

    .hero-title {
      margin-top: 4px;
      font-size: 22px;
      font-weight: 600;
      color: #1a2332;
      line-height: 1.2;
    }

    .hero-meta {
      margin-top: 6px;
      font-size: 13px;
      color: #5a6a7e;
    }

    .hero-status-wrap {
      flex-shrink: 0;
    }

    .detail-section {
      margin-bottom: 20px;
    }

    .detail-section:last-child {
      margin-bottom: 0;
    }

    .section-title {
      margin-bottom: 12px;
      font-size: 15px;
      font-weight: 600;
      color: #1a2332;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }

    .detail-card,
    .description-card {
      padding: 16px 18px;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      background: #fff;
    }

    .field-label {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #8a9ab0;
    }

    .field-value {
      margin-top: 8px;
      font-size: 15px;
      line-height: 1.45;
      color: #1a2332;
      word-break: break-word;
    }

    .field-value.strong {
      font-weight: 600;
    }

    .field-value.price {
      color: #2d7a38;
      font-weight: 600;
    }

    .info-badge,
    .sub-badge,
    .org-chip,
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 11px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 500;
    }

    .info-badge {
      background: #e8f1fb;
      color: #1b4a7a;
    }

    .sub-badge {
      background: #eef4ff;
      color: #365f94;
    }

    .org-chip {
      background: #f2f6fb;
      color: #1b4a7a;
    }

    .org-primary {
      background: #e8eef5;
      color: #1b4a7a;
    }

    .org-accent {
      background: #f2ebfb;
      color: #6d3ea2;
    }

    .status-badge.active {
      background: #edf7ee;
      color: #2d7a38;
    }

    .status-badge.inactive {
      background: #f9e8e8;
      color: #d42b2b;
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
      background: #d42b2b;
    }

    .description-card {
      font-size: 14px;
      line-height: 1.6;
      color: #5a6a7e;
      white-space: pre-wrap;
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

    .btn-primary:hover {
      background: #163a60;
    }

    @media (max-width: 900px) {
      .modal {
        width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .detail-grid {
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

      .hero-card {
        flex-direction: column;
      }

      .btn {
        width: 100%;
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
