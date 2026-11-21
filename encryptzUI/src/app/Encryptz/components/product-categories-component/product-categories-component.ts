import { AppRightDirective } from '../shared/app-right/app-right';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductService } from '../../Services/product-service';
import { ProductCategory } from './product-category-options';

/** Products › Manage categories: the category / sub category master used by the product form and the CRM. */
@Component({
  selector: 'app-product-categories',
  standalone: true,
  imports: [AppRightDirective, RouterLink],
  templateUrl: './product-categories-component.html',
  styleUrl: './product-categories-component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCategoriesComponent {
  private products = inject(ProductService);

  list = signal<ProductCategory[]>([]);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  selectedId = signal<number | null>(null);
  newCategory = signal('');
  newSub = signal('');
  /** The row being renamed, and its new name. */
  renamingId = signal<number | null>(null);
  renameText = signal('');

  readonly categories = computed(() => this.list().filter(c => c.parentId == null).sort((a, b) => a.name.localeCompare(b.name)));
  readonly selected = computed(() => this.categories().find(c => c.categoryId === this.selectedId()) ?? this.categories()[0] ?? null);
  readonly subs = computed(() => {
    const s = this.selected();
    return s ? this.list().filter(c => c.parentId === s.categoryId).sort((a, b) => a.name.localeCompare(b.name)) : [];
  });

  constructor() { this.load(); }

  load(): void {
    this.loading.set(true);
    this.products.getCategories().subscribe({
      next: r => {
        this.loading.set(false);
        if (r?.success === false) { this.error.set(r.message || 'The categories could not be loaded'); return; }
        this.list.set(r?.data ?? []);
      },
      error: e => { this.loading.set(false); this.error.set(e?.error?.message || 'The categories could not be loaded'); },
    });
  }

  select(c: ProductCategory): void { this.selectedId.set(c.categoryId); this.renamingId.set(null); }

  private save(dto: { categoryId: number; parentId: number | null; name: string; isActive: boolean }, done?: () => void): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.products.saveCategory(dto).subscribe({
      next: r => {
        this.saving.set(false);
        if (r?.success === false) { this.error.set(r.message || 'The category could not be saved'); return; }
        done?.();
        this.load();
      },
      error: e => { this.saving.set(false); this.error.set(e?.error?.message || 'The category could not be saved'); },
    });
  }

  addCategory(event: Event): void {
    event.preventDefault();
    const name = this.newCategory().trim();
    if (!name) { this.error.set('Enter the name'); return; }
    this.save({ categoryId: 0, parentId: null, name, isActive: true }, () => this.newCategory.set(''));
  }

  addSub(event: Event): void {
    event.preventDefault();
    const name = this.newSub().trim();
    const parent = this.selected();
    if (!parent) return;
    if (!name) { this.error.set('Enter the name'); return; }
    this.save({ categoryId: 0, parentId: parent.categoryId, name, isActive: true }, () => this.newSub.set(''));
  }

  startRename(c: ProductCategory): void { this.renamingId.set(c.categoryId); this.renameText.set(c.name); }

  rename(event: Event, c: ProductCategory): void {
    event.preventDefault();
    const name = this.renameText().trim();
    if (!name) { this.error.set('Enter the name'); return; }
    if (name === c.name) { this.renamingId.set(null); return; }
    this.save({ categoryId: c.categoryId, parentId: c.parentId, name, isActive: c.isActive }, () => this.renamingId.set(null));
  }

  toggle(c: ProductCategory): void {
    this.save({ categoryId: c.categoryId, parentId: c.parentId, name: c.name, isActive: !c.isActive });
  }
}
