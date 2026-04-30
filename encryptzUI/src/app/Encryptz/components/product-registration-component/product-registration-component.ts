import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { Product, ProductCreate, ProductMaster } from '../../Models/ApiModels';

@Component({
  selector: 'app-product-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-registration-component.html',
  styleUrls: ['./product-registration-component.scss'],
})
export class ProductRegistrationComponent implements OnInit {
  private api = inject(ApiService);

  products = signal<Product[]>([]);
  productMasterList = signal<ProductMaster[]>([]);
  showForm = signal(false);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  // Edit Mode
  isEditMode = signal(false);
  editingProductId: number | null = null;

  // Confirmation dialog signals
  confirmVisible = signal(false);
  confirmMessage = signal('');
  confirmAction: (() => void) | null = null;

  // Autocomplete
  masterSearch = '';
  showMasterDropdown = false;
  selectedMaster: ProductMaster | null = null;

  form: ProductCreate = {
    productName: '', serialNumber: '', brand: '', model: '',
    purchaseDate: undefined, warrantyExpiryDate: undefined,
  };

  ngOnInit(): void {
    this.loadProducts();
    this.loadProductMaster();
    // Auto-create customer profile if not exists
    this.api.getOrCreateProfile().subscribe();
  }

  toggleForm(): void {
    if (this.showForm()) {
      this.showForm.set(false);
      this.isEditMode.set(false);
      this.editingProductId = null;
    } else {
      this.resetForm();
      this.showForm.set(true);
    }
  }

  loadProducts(): void {
    this.api.getProducts().subscribe({
      next: (res: any) => {
        if (res.data) this.products.set(res.data);
        else if (Array.isArray(res)) this.products.set(res);
      },
      error: () => this.errorMsg.set('Failed to load products'),
    });
  }

  loadProductMaster(search?: string): void {
  this.api.getProductMaster(search).subscribe({
    next: (res: any) => {
      if (Array.isArray(res.data)) {
        this.productMasterList.set(res.data);
      } else {
        this.productMasterList.set([]);
      }
    },
    error: () => {
      this.productMasterList.set([]);
    }
  });
}

  onMasterSearch(): void {
    this.showMasterDropdown = true;
    this.loadProductMaster(this.masterSearch);
  }

  selectMaster(m: ProductMaster): void {
    this.selectedMaster = m;
    this.form.productName = m.productName;
    this.form.brand = m.brand;
    this.form.model = m.model;
    this.masterSearch = m.productName;
    this.showMasterDropdown = false;

    // Auto-set warranty expiry based on master warranty months
    if (m.warrantyMonths && this.form.purchaseDate) {
      const d = new Date(this.form.purchaseDate);
      d.setMonth(d.getMonth() + m.warrantyMonths);
      this.form.warrantyExpiryDate = d.toISOString().split('T')[0];
    }
  }

  clearMaster(): void {
    this.selectedMaster = null;
    this.masterSearch = '';
    this.form.productName = '';
    this.form.brand = '';
    this.form.model = '';
  }

  onPurchaseDateChange(): void {
    if (this.selectedMaster?.warrantyMonths && this.form.purchaseDate) {
      const d = new Date(this.form.purchaseDate);
      d.setMonth(d.getMonth() + this.selectedMaster.warrantyMonths);
      this.form.warrantyExpiryDate = d.toISOString().split('T')[0];
    }
  }

  addProduct(): void {
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    const request = this.isEditMode() && this.editingProductId
      ? this.api.updateProduct(this.editingProductId, this.form)
      : this.api.addProduct(this.form);

    request.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.success) {
          this.successMsg.set(this.isEditMode() ? 'Product updated successfully!' : 'Product registered successfully!');
          this.loadProducts();
          setTimeout(() => {
            this.showForm.set(false);
            this.isEditMode.set(false);
            this.editingProductId = null;
            this.successMsg.set('');
          }, 1500);
        } else {
          this.errorMsg.set(res.message || 'Failed to save product');
        }
      },
      error: () => { this.saving.set(false); this.errorMsg.set('An error occurred.'); },
    });
  }

  editProduct(product: Product): void {
    this.isEditMode.set(true);
    this.editingProductId = product.productId;
    this.form = {
      productName: product.productName,
      serialNumber: product.serialNumber,
      brand: product.brand,
      model: product.model,
      purchaseDate: product.purchaseDate ? new Date(product.purchaseDate).toISOString().split('T')[0] : undefined,
      warrantyExpiryDate: product.warrantyExpiryDate ? new Date(product.warrantyExpiryDate).toISOString().split('T')[0] : undefined,
    };
    this.masterSearch = product.productName;
    this.showForm.set(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  deleteProduct(product: Product): void {
    this.openConfirm(
      `Are you sure you want to delete product "${product.productName}" (${product.serialNumber})?`,
      () => {
        this.api.deleteProduct(product.productId).subscribe({
          next: (res) => {
            if (res.success) {
              this.loadProducts();
            } else {
              this.errorMsg.set(res.message || 'Failed to delete product');
            }
          },
          error: () => this.errorMsg.set('Error deleting product'),
        });
      }
    );
  }

  openConfirm(message: string, action: () => void): void {
    this.confirmMessage.set(message);
    this.confirmAction = action;
    this.confirmVisible.set(true);
  }

  cancelConfirm(): void {
    this.confirmVisible.set(false);
    this.confirmMessage.set('');
    this.confirmAction = null;
  }

  proceedConfirm(): void {
    const action = this.confirmAction;
    this.cancelConfirm();
    if (action) {
      action();
    }
  }

  uploadImage(productId: number, event: Event, type: string): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      this.api.uploadProductImage(productId, file, type).subscribe({
        next: () => this.loadProducts(),
        error: () => this.errorMsg.set('Failed to upload image'),
      });
    }
  }

  isWarrantyActive(date: string | undefined): boolean {
    if (!date) return false;
    return new Date(date) > new Date();
  }

  private resetForm(): void {
    this.form = { productName: '', serialNumber: '', brand: '', model: '', purchaseDate: undefined, warrantyExpiryDate: undefined };
    this.selectedMaster = null;
    this.masterSearch = '';
    this.successMsg.set('');
    this.errorMsg.set('');
    this.isEditMode.set(false);
    this.editingProductId = null;
  }
}

