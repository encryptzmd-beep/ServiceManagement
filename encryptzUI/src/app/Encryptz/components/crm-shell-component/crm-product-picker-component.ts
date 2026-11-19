import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CrmProductDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';

/** The most products one category shows; the API allows up to 100. */
export const PRODUCT_LIMIT = 100;

/**
 * Category select and product select over the product master. Changing the category clears the product.
 * A category that is no longer in the master (an old lead) is kept as an option; so is a product not in the list.
 */
@Component({
  selector: 'app-crm-product-picker',
  standalone: true,
  templateUrl: './crm-product-picker-component.html',
  styleUrls: ['./crm-pages.scss', './crm-product-picker-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmProductPickerComponent {
  private crm = inject(CrmService);

  category = input<string | null | undefined>('');
  productMasterId = input<number | null | undefined>(null);
  /** The name of the current product, to show it when the list of its category does not hold it. */
  productName = input<string | null | undefined>('');

  categoryChange = output<string>();
  productMasterIdChange = output<number | null>();
  /** The whole product, for a caller that fills a price or a warranty from it. */
  productPicked = output<CrmProductDto>();

  private master = signal<string[]>([]);
  products = signal<CrmProductDto[]>([]);
  /** The category's products could not be read. */
  loadFailed = signal(false);
  readonly limit = PRODUCT_LIMIT;

  readonly categories = computed(() => {
    const own = (this.category() ?? '').trim();
    const list = this.master();
    return own && !list.includes(own) ? [own, ...list] : list;
  });

  readonly productOptions = computed(() => {
    const id = this.productMasterId();
    const list = this.products();
    const name = (this.productName() ?? '').trim();
    return id && name && !list.some(p => p.productMasterId === id)
      ? [{ productMasterId: id, productName: name } as CrmProductDto, ...list]
      : list;
  });

  constructor() {
    this.crm.productCategories().subscribe({
      next: res => this.master.set(res.success ? res.data ?? [] : []), error: () => {},
    });
    effect(() => {
      const category = (this.category() ?? '').trim();
      this.loadFailed.set(false);
      if (!category) { this.products.set([]); return; }
      this.crm.searchProducts(undefined, category, PRODUCT_LIMIT).subscribe({
        next: res => {
          if ((this.category() ?? '').trim() !== category) return;
          this.loadFailed.set(!res.success);
          this.products.set(res.success ? res.data ?? [] : []);
        },
        error: () => { this.products.set([]); this.loadFailed.set(true); },
      });
    });
  }

  chooseCategory(value: string): void {
    this.categoryChange.emit(value);
    this.productMasterIdChange.emit(null);
  }

  chooseProduct(value: string): void {
    const id = value ? Number(value) : null;
    this.productMasterIdChange.emit(id);
    const p = id ? this.products().find(x => x.productMasterId === id) : undefined;
    if (p) this.productPicked.emit(p);
  }
}
