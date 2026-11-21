
// components/product-form/product-form.component.ts
import { ChangeDetectorRef, Component, ElementRef, Input, Output, EventEmitter, OnInit, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductCategory, categoryOptions, subCategoryOptions } from '../product-categories-component/product-category-options';
import { ProductMasterDTO, ProductMasterRequest } from '../../Models/ApiModels';
import { Observable } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { ProductService } from '../../Services/product-service';
import { ToastService } from '../../Services/toast-service';
import { AppRightDirective } from '../shared/app-right/app-right';

/** What the form tells its page when it closes; a saved product comes with it. */
export type ProductFormResult = boolean | { refresh?: boolean; message?: string; type?: 'success' | 'error'; product?: ProductMasterDTO };

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [CommonModule, FormsModule, AppRightDirective],
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
          <button type="button" class="modal-close" (click)="close.emit(false)" aria-label="Close">×</button>
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
                <span class="material-icons tab-icon" aria-hidden="true">{{ tab.icon }}</span>
                <span>{{ tab.name }}</span>
              </button>
            </div>

            <div class="form-banner error-banner" *ngIf="submitError">
              {{ submitError }}
            </div>

            <div class="tab-panels">
              <div class="tab-content" [class.active]="activeTab === 'details'">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pf-code">Product Code *</label>
                    <input id="pf-code" type="text" class="form-control" [(ngModel)]="formData.productCode" name="productCode" required #code="ngModel">
                    <div class="error-message" *ngIf="code.touched && code.errors?.['required']">Product code is required</div>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="pf-name">Product Name *</label>
                    <input id="pf-name" type="text" class="form-control" [(ngModel)]="formData.productName" name="productName" required #name="ngModel">
                    <div class="error-message" *ngIf="name.touched && name.errors?.['required']">Product name is required</div>
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pf-brand">Brand</label>
                    <input id="pf-brand" type="text" class="form-control" [(ngModel)]="formData.brand" name="brand">
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="pf-model">Model</label>
                    <input id="pf-model" type="text" class="form-control" [(ngModel)]="formData.model" name="model">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <div class="label-line">
                      <label class="form-label" for="pf-category">Category</label>
                      <button type="button" class="new-link" appRight="edit" appRightMenu="/products" (click)="openQuickAdd('category')">
                        <span class="material-icons" aria-hidden="true">add</span>New
                      </button>
                    </div>
                    <select id="pf-category" class="form-control" [ngModel]="formData.category" (ngModelChange)="chooseCategory($event)" name="category">
                      <option value="">Select category</option>
                      <option *ngFor="let c of categoryChoices()" [value]="c">{{ c }}</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <div class="label-line">
                      <label class="form-label" for="pf-sub">Sub Category</label>
                      <button type="button" class="new-link" appRight="edit" appRightMenu="/products" [disabled]="!formData.category"
                        [title]="formData.category ? 'Add a sub category' : 'Choose the category first'" (click)="openQuickAdd('sub')">
                        <span class="material-icons" aria-hidden="true">add</span>New
                      </button>
                    </div>
                    <select id="pf-sub" class="form-control" [(ngModel)]="formData.subCategory" name="subCategory" [disabled]="!formData.category">
                      <option value="">{{ formData.category ? 'Select sub category' : 'Choose the category first' }}</option>
                      <option *ngFor="let s of subCategoryChoices()" [value]="s">{{ s }}</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="pf-description">Description</label>
                  <textarea id="pf-description" class="form-control" rows="3" [(ngModel)]="formData.description" name="description"></textarea>
                </div>

                <label class="active-line">
                  <input type="checkbox" [(ngModel)]="formData.isActive" name="isActive">
                  <span>Active product</span>
                </label>
              </div>

              <div class="tab-content" [class.active]="activeTab === 'pricing'">
                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pf-mrp">MRP (INR)</label>
                    <input id="pf-mrp" type="number" min="0" class="form-control" [(ngModel)]="formData.mrp" name="mrp">
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="pf-warranty">Warranty (Months)</label>
                    <input id="pf-warranty" type="number" min="0" class="form-control" [(ngModel)]="formData.warrantyMonths" name="warrantyMonths">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pf-price-status">Price Change Status</label>
                    <select id="pf-price-status" class="form-control" [(ngModel)]="formData.priceChangeStatus" name="priceChangeStatus">
                      <option value="">No Change</option>
                      <option value="Changed">Changed</option>
                      <option value="New">New</option>
                    </select>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="pf-price-date">Price Effective Date</label>
                    <input id="pf-price-date" type="date" class="form-control" [(ngModel)]="formData.priceEffectiveDate" name="priceEffectiveDate">
                  </div>
                </div>

                <div class="form-row">
                  <div class="form-group">
                    <label class="form-label" for="pf-org">Organization</label>
                    <input id="pf-org" type="text" class="form-control" [(ngModel)]="formData.org" name="org" maxlength="50" placeholder="Organization / business unit (optional)">
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-outline" (click)="close.emit(false)">Cancel</button>
          <button type="button" class="btn btn-primary" (click)="onSubmit()" [disabled]="isSubmitting">
            <span *ngIf="isSubmitting" class="spinner"></span>
            {{ isEditMode ? 'Update Product' : 'Create Product' }}
          </button>
        </div>
      </div>

      <!-- on top of the product form, which stays open with what was typed -->
      <div class="qa-overlay" *ngIf="quickAdd() as q" (click)="$event.stopPropagation()">
        <div class="qa-box" role="dialog" aria-modal="true" aria-labelledby="qa-title" (keydown.escape)="closeQuickAdd()">
          <div class="qa-head">
            <h4 id="qa-title">{{ q.level === 'sub' ? 'New Sub Category' : 'New Category' }}</h4>
            <button type="button" class="qa-close" aria-label="Close" (click)="closeQuickAdd()">
              <span class="material-icons" aria-hidden="true">close</span>
            </button>
          </div>
          <div class="qa-body">
            <p class="qa-note" *ngIf="q.note">{{ q.note }}</p>
            <div class="form-group" *ngIf="q.level === 'sub'">
              <span class="form-label">Category</span>
              <div class="qa-parent">{{ q.parentName }}</div>
            </div>
            <div class="form-group">
              <label class="form-label" for="qa-name">{{ q.level === 'sub' ? 'Sub Category Name *' : 'Category Name *' }}</label>
              <input #qaName id="qa-name" type="text" class="form-control" maxlength="100" autocomplete="off"
                [value]="qaText()" (input)="qaText.set($any($event.target).value); qaError.set('')"
                (keydown.enter)="$event.preventDefault(); saveQuickAdd()">
              <div class="error-message" role="alert" *ngIf="qaError()">{{ qaError() }}</div>
            </div>
          </div>
          <div class="qa-foot">
            <button type="button" class="btn btn-outline" (click)="closeQuickAdd()" [disabled]="qaSaving()">Cancel</button>
            <button type="button" class="btn btn-primary" (click)="saveQuickAdd()" [disabled]="qaSaving()">
              <span *ngIf="qaSaving()" class="spinner"></span>
              Save
            </button>
          </div>
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
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(2px);
    }

    .modal {
      width: min(820px, 96vw);
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
      background: #0f172a;
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
      font-size: 18px;
      line-height: 1;
    }

    .label-line {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
    }

    .new-link {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 0 4px;
      border: none;
      border-radius: 4px;
      background: none;
      color: #1B4A7A;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      .material-icons { font-size: 15px; }
      &:hover:not(:disabled) { background: #e8eef5; }
      &:disabled { color: #94a3b8; cursor: not-allowed; }
    }

    .qa-overlay {
      position: fixed;
      inset: 0;
      z-index: 1100;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(15, 23, 42, 0.45);
    }

    .qa-box {
      width: min(420px, 100%);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border-radius: 12px;
      background: #fff;
    }

    .qa-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid #e2e8f0;
      h4 { margin: 0; font-size: 16px; font-weight: 600; color: #1a2332; }
    }

    .qa-close {
      width: 30px;
      height: 30px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: none;
      border-radius: 6px;
      background: none;
      color: #64748b;
      cursor: pointer;
      &:hover { background: #f1f5f9; }
    }

    .qa-body {
      display: flex;
      flex-direction: column;
      gap: 14px;
      padding: 16px 18px;
    }

    .qa-note {
      margin: 0;
      padding: 9px 11px;
      border-radius: 8px;
      background: #eef3f8;
      color: #1B4A7A;
      font-size: 12.5px;
      line-height: 1.4;
    }

    .qa-parent {
      min-height: 40px;
      display: flex;
      align-items: center;
      padding: 0 12px;
      border-radius: 10px;
      background: #f5f7fa;
      color: #1a2332;
      font-size: 14px;
      overflow-wrap: anywhere;
    }

    .qa-foot {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 18px;
      border-top: 1px solid #e2e8f0;
    }

    /* both tabs share one cell, so the window keeps its height when switching */
    .tab-panels {
      display: grid;
    }

    .tab-content {
      grid-area: 1 / 1;
      min-width: 0;
      visibility: hidden;
    }

    .tab-content.active {
      visibility: visible;
    }

    .active-line {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 14px;
      color: #1a2332;
      font-size: 14px;
      cursor: pointer;
    }

    .active-line input {
      width: 16px;
      height: 16px;
      margin: 0;
      accent-color: #1B4A7A;
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
      min-height: 78px;
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

    @media (max-width: 640px) {
      .modal {
        width: 100%;
        max-height: 100vh;
        border-radius: 0;
      }

      .form-row {
        grid-template-columns: 1fr;
      }

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
  private changes = inject(ChangeDetectorRef);
  @Input() product: ProductMasterDTO | null = null;
  @Input() isEditMode = false;
  /** Which module's API this page may use; CRM can only add. */
  @Input() source: 'service' | 'crm' = 'service';
  /** A new product starts in this category. */
  @Input() initialCategory = '';
  /** A new product starts with the name typed in the search. */
  @Input() initialName = '';
  @Output() close = new EventEmitter<ProductFormResult>();
  private readonly crm = inject(CrmService);

  formData: ProductMasterRequest = {
    productCode: '',
    productName: '',
    brand: '',
    category: '',
    subCategory: '',
    model: '',
    description: '',
    mrp: 0,
    org: '',
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
  activeTab = 'details';
  submitError = '';
  tabs = [
    { id: 'details', name: 'Product Details', icon: 'inventory_2' },
    { id: 'pricing', name: 'Price & Warranty', icon: 'payments' }
  ];

  constructor(private productService: ProductService) {}

  private readCategories() {
    return this.source === 'crm' ? this.crm.productCategoryMaster() : this.productService.getCategories();
  }

  private writeCategory(dto: { categoryId: number; parentId: number | null; name: string; isActive: boolean }) {
    return this.source === 'crm' ? this.crm.addProductCategory(dto) : this.productService.saveCategory(dto);
  }

  // ── category master (Products › Manage categories) ──
  categoryMaster = signal<ProductCategory[]>([]);
  /** formData is a plain object: the selects ask for their options with its current values. */
  categoryChoices(): string[] { return categoryOptions(this.categoryMaster(), this.formData.category ?? ''); }
  subCategoryChoices(): string[] {
    return subCategoryOptions(this.categoryMaster(), this.formData.category ?? '', this.formData.subCategory ?? '');
  }
  /** A new category: its sub category no longer applies. */
  chooseCategory(value: string): void {
    if ((value ?? '') !== (this.formData.category ?? '')) this.formData.subCategory = '';
    this.formData.category = value ?? '';
  }

  // ── a new category or sub category, without leaving the product form ──
  private readonly toasts = inject(ToastService);
  quickAdd = signal<{ level: 'category' | 'sub'; parentId: number | null; parentName: string; note: string } | null>(null);
  qaText = signal('');
  qaError = signal('');
  qaSaving = signal(false);

  @ViewChild('qaName') set qaNameInput(input: ElementRef<HTMLInputElement> | undefined) {
    input?.nativeElement.focus();
  }

  openQuickAdd(level: 'category' | 'sub'): void {
    this.qaError.set('');
    this.qaText.set('');
    if (level === 'category') {
      this.quickAdd.set({ level, parentId: null, parentName: '', note: '' });
      return;
    }
    const chosen = (this.formData.category ?? '').trim();
    if (!chosen) return;
    const parent = this.categoryMaster().find(c => c.parentId == null && c.name.trim().toLowerCase() === chosen.toLowerCase());
    if (parent) {
      this.quickAdd.set({ level, parentId: parent.categoryId, parentName: parent.name, note: '' });
    } else {
      // an older product's category that is not in the master yet
      this.qaText.set(chosen);
      this.quickAdd.set({ level: 'category', parentId: null, parentName: '', note: 'This category is not in the list yet. Save it first, then add the sub category.' });
    }
  }

  closeQuickAdd(): void {
    if (!this.qaSaving()) this.quickAdd.set(null);
  }

  saveQuickAdd(): void {
    const q = this.quickAdd();
    if (!q || this.qaSaving()) return;
    const name = this.qaText().trim();
    if (!name) { this.qaError.set('Enter the name'); return; }

    this.qaSaving.set(true);
    this.qaError.set('');
    this.writeCategory({ categoryId: 0, parentId: q.parentId, name, isActive: true }).subscribe({
      next: r => {
        if (!r?.success) {
          this.qaSaving.set(false);
          this.qaError.set(r?.message || 'The category could not be saved');
          return;
        }
        if (!r.data) {
          this.qaSaving.set(false);
          this.qaError.set('The category could not be saved');
          return;
        }
        const saved: ProductCategory = { categoryId: r.data, parentId: q.parentId, name, isActive: true, productCount: 0 };
        this.readCategories().subscribe({
          next: list => this.finishQuickAdd(q.level, saved, list?.success ? list.data ?? [] : [...this.categoryMaster(), saved]),
          error: () => this.finishQuickAdd(q.level, saved, [...this.categoryMaster(), saved]),
        });
      },
      error: e => {
        this.qaSaving.set(false);
        this.qaError.set(e?.error?.message || 'The category could not be saved');
      },
    });
  }

  /** The list is fresh: the new name is chosen in its dropdown and the popup closes. */
  private finishQuickAdd(level: 'category' | 'sub', saved: ProductCategory, list: ProductCategory[]): void {
    const master = list.some(c => c.categoryId === saved.categoryId) ? list : [...list, saved];
    this.categoryMaster.set(master);
    if (level === 'category') this.chooseCategory(saved.name);
    else this.formData.subCategory = saved.name;
    this.qaSaving.set(false);
    this.quickAdd.set(null);
    this.toasts.flash(`${level === 'category' ? 'Category' : 'Sub category'} ${saved.name} added`);
    this.changes.markForCheck();
  }

  ngOnInit(): void {
    this.readCategories().subscribe({
      next: r => this.categoryMaster.set(r?.success ? r.data ?? [] : []),
      error: () => this.categoryMaster.set([]),
    });
    if (!this.isEditMode && this.initialCategory) this.formData.category = this.initialCategory;
    if (!this.isEditMode && this.initialName) this.formData.productName = this.initialName;
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
    if (!this.formData.productCode?.trim() || !this.formData.productName?.trim()) {
      this.activeTab = 'details';
      this.submitError = 'Please fill all required fields before saving.';
      return;
    }
    if (Number(this.formData.mrp ?? 0) < 0) { this.activeTab = 'pricing'; this.submitError = 'MRP cannot be negative'; return; }
    if (Number(this.formData.warrantyMonths ?? 0) < 0) { this.activeTab = 'pricing'; this.submitError = 'Warranty months cannot be negative'; return; }

    this.submitError = '';
    this.isSubmitting = true;
    const request = { ...this.formData };

    const apiCall: Observable<{ success: boolean; message?: string; data?: unknown }> = this.isEditMode && this.product
      ? this.productService.updateProduct(this.product.productMasterId, request)
      : this.source === 'crm' ? this.crm.createProduct(request) : this.productService.createProduct(request);

    apiCall.subscribe({
      next: (response) => {
        if (response.success) {
          this.close.emit({
            refresh: true,
            message: this.isEditMode ? 'Product updated successfully' : 'Product created successfully',
            type: 'success',
            product: response.data as ProductMasterDTO | undefined
          });
        } else {
          this.submitError = response.message || 'Operation failed';
        }
        this.isSubmitting = false;
        this.changes.markForCheck();     // plain fields: the answer of the API must still show
      },
      error: (error) => {
        console.error('Error saving product:', error);
        this.submitError = error.error?.message || 'Error saving product';
        this.isSubmitting = false;
        this.changes.markForCheck();
      }
    });
  }
}
