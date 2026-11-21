import { ProductFormComponent, ProductFormResult } from '../product-form-component/product-form-component';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CrmProductDto } from '../../Models/CrmModels';
import { CrmService } from '../../Services/crm-service';
import { RightsService } from '../../Services/rights-service';
import { amount } from './crm-ui';

/** The most products one category shows; the API allows up to 100. */
export const PRODUCT_LIMIT = 100;
/** The most products a search over every category shows. */
export const SEARCH_LIMIT = 20;
/** Letters needed before searching every category. */
export const MIN_SEARCH = 2;

/**
 * Category select (an optional filter) and a product autocomplete over the product master, each row with
 * its rate (MRP). Changing the category clears the product; picking a product with no category chosen fills
 * the category from the product. A category or product that is no longer in the master (an old lead) is kept.
 */
@Component({
  selector: 'app-crm-product-picker',
  imports: [ProductFormComponent],
  standalone: true,
  templateUrl: './crm-product-picker-component.html',
  styleUrls: ['./crm-pages.scss', './crm-product-picker-component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CrmProductPickerComponent {
  private crm = inject(CrmService);
  private rights = inject(RightsService);
  private static seq = 0;
  readonly listId = `pp-list-${++CrmProductPickerComponent.seq}`;
  readonly amount = amount;

  category = input<string | null | undefined>('');
  productMasterId = input<number | null | undefined>(null);
  /** The name of the current product, to show it when the list of its category does not hold it. */
  productName = input<string | null | undefined>('');

  categoryChange = output<string>();
  productMasterIdChange = output<number | null>();
  /** The whole product, for a caller that fills a price or a warranty from it. */
  productPicked = output<CrmProductDto>();

  private master = signal<string[]>([]);
  /** The chosen category's products. */
  products = signal<CrmProductDto[]>([]);
  /** The category's products could not be read. */
  loadFailed = signal(false);
  readonly limit = PRODUCT_LIMIT;

  /** What the user typed; null while not typing (the box then shows the chosen product). */
  query = signal<string | null>(null);
  open = signal(false);
  active = signal(-1);
  searching = signal(false);
  /** Results of a search over every category (no category chosen). */
  private found = signal<CrmProductDto[]>([]);
  private picked = signal<CrmProductDto | null>(null);

  readonly categories = computed(() => {
    const own = (this.category() ?? '').trim();
    const list = this.master();
    return own && !list.includes(own) ? [own, ...list] : list;
  });

  private readonly hasCategory = computed(() => !!(this.category() ?? '').trim());

  readonly selectedName = computed(() => {
    const id = this.productMasterId();
    if (!id) return '';
    return this.products().find(p => p.productMasterId === id)?.productName
      ?? (this.picked()?.productMasterId === id ? this.picked()!.productName : null)
      ?? (this.productName() ?? '').trim();
  });

  readonly displayValue = computed(() => this.query() ?? this.selectedName());

  readonly results = computed(() => {
    if (!this.hasCategory()) return this.found();
    const q = (this.query() ?? '').trim().toLowerCase();
    if (!q) return this.products();
    return this.products().filter(p =>
      [p.productName, p.productCode, p.model, p.brand].some(v => (v ?? '').toLowerCase().includes(q)));
  });

  readonly showList = computed(() => this.open() && this.results().length > 0);

  /** No category and fewer letters than a search needs: say how to start. */
  readonly showHint = computed(() =>
    this.open() && !this.hasCategory() && !this.productMasterId() && (this.query() ?? '').trim().length < MIN_SEARCH);

  /** Exposed for the template's hint text. */
  readonly minSearch = MIN_SEARCH;

  readonly showNone = computed(() => {
    const q = (this.query() ?? '').trim();
    return this.open() && !this.searching() && this.results().length === 0 && !!q
      && (this.hasCategory() || q.length >= MIN_SEARCH);
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

  newProduct = signal(false);
  newProductName = signal('');
  /** Adding a product needs the Create right of the Products menu. */
  readonly canCreate = computed(() => this.rights.can('create', '/products'));
  readonly panelOpen = computed(() => this.open()
    && (this.canCreate() || this.showList() || this.showNone() || this.searching() || this.showHint()));

  startNew(): void {
    this.newProductName.set((this.query() ?? '').trim());
    this.open.set(false);
    this.newProduct.set(true);
  }

  /** A product made in the popup is chosen, with its own category. */
  closeNewProduct(result: ProductFormResult): void {
    this.newProduct.set(false);
    if (typeof result !== 'object' || !result.product) return;
    const x = result.product;
    const p: CrmProductDto = {
      productMasterId: x.productMasterId, productCode: x.productCode, productName: x.productName,
      brand: x.brand ?? '', model: x.model ?? '', category: x.category ?? '',
      mrp: Number(x.mrp ?? 0), warrantyMonths: Number(x.warrantyMonths ?? 0),
    };
    this.crm.productCategories().subscribe({
      next: res => { if (res.success) this.master.set(res.data ?? []); }, error: () => {},
    });
    const current = (this.category() ?? '').trim();
    if (p.category.trim() === current) {
      if (current) this.products.update(list => [p, ...list.filter(y => y.productMasterId !== p.productMasterId)]);
    } else {
      this.categoryChange.emit(p.category);
    }
    this.picked.set(p);
    this.productMasterIdChange.emit(p.productMasterId);
    this.productPicked.emit(p);
    this.query.set(null);
  }

  meta(p: CrmProductDto): string {
    return [p.productCode, p.brand, p.model].filter(v => !!(v ?? '').trim()).join(' · ');
  }

  chooseCategory(value: string): void {
    this.categoryChange.emit(value);
    this.productMasterIdChange.emit(null);
    this.query.set(null);
  }

  onFocus(): void {
    this.open.set(true);
    this.active.set(-1);
  }

  onBlur(): void {
    this.open.set(false);
    this.query.set(null);
  }

  onInput(text: string): void {
    this.query.set(text);
    this.open.set(true);
    this.active.set(-1);
    if (!text.trim() && this.productMasterId()) this.productMasterIdChange.emit(null);
    if (this.hasCategory()) return;

    const term = text.trim();
    if (term.length < MIN_SEARCH) { this.found.set([]); this.searching.set(false); return; }
    this.searching.set(true);
    this.crm.searchProducts(term, undefined, SEARCH_LIMIT).subscribe({
      next: res => {
        if ((this.query() ?? '').trim() !== term) return;   // an older answer
        this.searching.set(false);
        this.found.set(res.success ? res.data ?? [] : []);
      },
      error: () => { this.searching.set(false); this.found.set([]); },
    });
  }

  onKey(e: KeyboardEvent): void {
    const list = this.results();
    const count = list.length + (this.canCreate() ? 1 : 0);
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.open.set(true);
        if (count) this.active.set((this.active() + 1) % count);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (count) this.active.set(this.active() <= 0 ? count - 1 : this.active() - 1);
        break;
      case 'Enter':
        if (this.open() && this.canCreate() && this.active() === list.length) { e.preventDefault(); this.startNew(); }
        else if (this.open() && this.active() >= 0 && list[this.active()]) { e.preventDefault(); this.pick(list[this.active()]); }
        break;
      case 'Escape':
        this.open.set(false);
        break;
    }
  }

  pick(p: CrmProductDto): void {
    if (!this.hasCategory() && (p.category ?? '').trim()) this.categoryChange.emit(p.category);
    this.picked.set(p);
    this.productMasterIdChange.emit(p.productMasterId);
    this.productPicked.emit(p);
    this.query.set(null);
    this.open.set(false);
    this.active.set(-1);
  }
}
