// components/product-list/product-list.component.ts
import { Component, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductFormComponent } from '../product-form-component/product-form-component';
import { ProductViewComponent } from '../product-view-component/product-view-component';
import { ProductService } from '../../Services/product-service';
import { ProductMasterDTO, DropdownData, ProductMaster } from '../../Models/ApiModels';

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, FormsModule, ProductFormComponent, ProductViewComponent],
  templateUrl: './product-list-component.html',
  styleUrls: ['./product-list-component.scss']
})
export class ProductListComponent implements OnInit {

  // ✅ Signals
  products = signal<ProductMasterDTO[]>([]);
  loading = signal(false);
  totalCount = signal(0);

  currentPage = signal(1);
  pageSize = signal(20);
  searchTerm = signal('');
  selectedCategory = signal('');
  selectedSubCategory = signal('');
  sortColumn = signal('ProductMasterId');
  sortDirection = signal<'ASC' | 'DESC'>('DESC');

  selectedProducts = signal<Set<number>>(new Set());

  dropdownData = signal<DropdownData>({
    categories: [],
    subCategories: [],
    brands: [],
    orgs: []
  });

  showFormModal = signal(false);
  showViewModal = signal(false);
  selectedProduct = signal<ProductMasterDTO | null>(null);
  isEditMode = signal(false);
  toastVisible = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error'>('success');
  confirmVisible = signal(false);
  confirmMessage = signal('');
  private confirmAction: (() => void) | null = null;
  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  pageSizeOptions = [10, 20, 50, 100];

  constructor(private productService: ProductService) {
    // ✅ Effect to reload when page/pageSize changes
    effect(() => {
      // Triggered when currentPage or pageSize changes
      const page = this.currentPage();
      const size = this.pageSize();
      if (page && size) {
        this.loadProducts();
      }
    });
  }

  ngOnInit() {
    this.loadProducts();
    this.loadDropdowns();
  }

  // ✅ COMPUTED
  totalPages = computed(() => {
    const total = this.totalCount();
    const size = this.pageSize();
    return total > 0 ? Math.ceil(total / size) : 1;
  });

  selectedCount = computed(() => this.selectedProducts().size);

  isAllSelected = computed(() =>
    this.products().length > 0 &&
    this.selectedProducts().size === this.products().length
  );

  isSomeSelected = computed(() =>
    this.selectedProducts().size > 0 && !this.isAllSelected()
  );

  hasActiveFilters = computed(() =>
    !!this.searchTerm() || !!this.selectedCategory() || !!this.selectedSubCategory()
  );

  // ✅ Helper computed for pagination display
  visiblePages = computed(() => {
    const totalPages = this.totalPages();
    const current = this.currentPage();
    const maxVisible = 5;
    let start = Math.max(1, current - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    const pages: number[] = [];
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  });

  // ✅ METHODS

  loadProducts() {
    this.loading.set(true);

    const request = {
      pageNumber: this.currentPage(),
      pageSize: this.pageSize(),
      sortColumn: this.sortColumn(),
      sortDirection: this.sortDirection(),
      searchTerm: this.searchTerm() || undefined,
      category: this.selectedCategory() || undefined,
      subCategory: this.selectedSubCategory() || undefined
    };

    this.productService.getAllProducts(request).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.products.set(res.data.items || []);
          this.totalCount.set(res.data.totalCount || 0);
          // Don't reset currentPage if it's the same
          if (res.data.currentPage) {
            this.currentPage.set(res.data.currentPage);
          }
          this.selectedProducts.set(new Set());
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading products:', err);
        this.loading.set(false);
        this.showToast('Error loading products', 'error');
      }
    });
  }

  loadDropdowns() {
    this.productService.getDropdowns().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.dropdownData.set(res.data);
        }
      },
      error: (err) => {
        console.error('Error loading dropdowns:', err);
      }
    });
  }

  applyFilter() {
    this.currentPage.set(1);
    this.loadProducts();
  }

  resetFilters() {
    this.searchTerm.set('');
    this.selectedCategory.set('');
    this.selectedSubCategory.set('');
    this.currentPage.set(1);
    this.loadProducts();
  }

  sortData(column: string) {
    if (this.sortColumn() === column) {
      this.sortDirection.set(this.sortDirection() === 'ASC' ? 'DESC' : 'ASC');
    } else {
      this.sortColumn.set(column);
      this.sortDirection.set('ASC');
    }
    this.loadProducts();
  }

  onPageChange(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      // loadProducts will be triggered by effect
    }
  }

  onPageSizeChange(event: Event) {
    const value = +(event.target as HTMLSelectElement).value;
    this.pageSize.set(value);
    this.currentPage.set(1);
    // loadProducts will be triggered by effect
  }

  toggleSelection(id: number) {
    const set = new Set(this.selectedProducts());
    set.has(id) ? set.delete(id) : set.add(id);
    this.selectedProducts.set(set);
  }

  toggleAllSelection() {
    if (this.isAllSelected()) {
      this.selectedProducts.set(new Set());
    } else {
      this.selectedProducts.set(new Set(this.products().map(p => p.productMasterId)));
    }
  }

  // ✅ Bulk Operations
  bulkDelete() {
    const count = this.selectedCount();
    if (count === 0) return;

    this.openConfirm(`Are you sure you want to delete ${count} selected product(s)?`, () => {
      this.loading.set(true);
      const ids = Array.from(this.selectedProducts());

      this.productService.bulkDeleteProducts(ids).subscribe({
        next: (response) => {
          if (response.success) {
            this.showToast(response.message || 'Products deleted successfully', 'success');
            this.selectedProducts.set(new Set());
            this.loadProducts();
          } else {
            this.showToast(response.message || 'Bulk delete failed', 'error');
            this.loading.set(false);
          }
        },
        error: (error) => {
          console.error('Error in bulk delete:', error);
          this.showToast('Error performing bulk delete', 'error');
          this.loading.set(false);
        }
      });
    });
  }

  bulkUpdateStatus(isActive: boolean) {
    const count = this.selectedCount();
    if (count === 0) return;

    const action = isActive ? 'activate' : 'deactivate';
    this.openConfirm(`Are you sure you want to ${action} ${count} selected product(s)?`, () => {
      this.loading.set(true);
      const ids = Array.from(this.selectedProducts());

      this.productService.bulkUpdateStatus(ids, isActive).subscribe({
        next: (response) => {
          if (response.success) {
            this.showToast(response.message || `Products ${action}d successfully`, 'success');
            this.selectedProducts.set(new Set());
            this.loadProducts();
          } else {
            this.showToast(response.message || `Bulk ${action} failed`, 'error');
            this.loading.set(false);
          }
        },
        error: (error) => {
          console.error(`Error in bulk ${action}:`, error);
          this.showToast(`Error performing bulk ${action}`, 'error');
          this.loading.set(false);
        }
      });
    });
  }

  openProductForm(product?: ProductMasterDTO) {
    this.selectedProduct.set(product || null);
    this.isEditMode.set(!!product);
    this.showFormModal.set(true);
  }

  closeFormModal(result: boolean | { refresh?: boolean; message?: string; type?: 'success' | 'error' } = false) {
    this.showFormModal.set(false);
    this.selectedProduct.set(null);

    const refresh = typeof result === 'boolean' ? result : !!result.refresh;
    const message = typeof result === 'object' ? result.message : '';
    const type = typeof result === 'object' && result.type ? result.type : 'success';

    if (message) {
      this.showToast(message, type);
    }

    if (refresh) {
      this.loadProducts();
    }
  }

  viewProduct(product: ProductMasterDTO) {
    this.selectedProduct.set(product);
    this.showViewModal.set(true);
  }

  closeViewModal() {
    this.showViewModal.set(false);
    this.selectedProduct.set(null);
  }

  deleteProduct(product: ProductMasterDTO) {
    this.openConfirm(`Are you sure you want to delete product "${product.productCode} - ${product.productName}"?`, () => {
      this.loading.set(true);

      this.productService.deleteProduct(product.productMasterId).subscribe({
        next: (response) => {
          if (response.success) {
            this.showToast('Product deleted successfully', 'success');
            this.loadProducts();
          } else {
            this.showToast(response.message || 'Delete failed', 'error');
            this.loading.set(false);
          }
        },
        error: (error) => {
          console.error('Error deleting product:', error);
          this.showToast('Error deleting product', 'error');
          this.loading.set(false);
        }
      });
    });
  }

  showToast(message: string, type: 'success' | 'error' = 'success') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastVisible.set(true);

    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
    }

    this.toastTimeoutId = setTimeout(() => {
      this.toastVisible.set(false);
      this.toastTimeoutId = null;
    }, 3500);
  }

  hideToast() {
    this.toastVisible.set(false);
    if (this.toastTimeoutId) {
      clearTimeout(this.toastTimeoutId);
      this.toastTimeoutId = null;
    }
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

  formatCurrency(value: number) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value);
  }

  getSortIcon(column: string) {
    if (this.sortColumn() !== column) return '↕️';
    return this.sortDirection() === 'ASC' ? '↑' : '↓';
  }

  // ✅ For template binding
  getSelectedCount(): number {
    return this.selectedCount();
  }

  getTotalPages(): number {
    return this.totalPages();
  }

  getVisiblePages(): number[] {
    return this.visiblePages();
  }
}
