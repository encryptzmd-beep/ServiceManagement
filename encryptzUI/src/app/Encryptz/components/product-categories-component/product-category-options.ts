/** A row of the category / sub category master (GET ProductMaster/categories). */
export interface ProductCategory {
  categoryId: number;
  parentId: number | null;
  name: string;
  isActive: boolean;
  productCount: number;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const keep = (names: string[], current: string) => {
  const c = (current ?? '').trim();
  return c && !names.some(n => same(n, c)) ? [c, ...names] : names;
};

/** The active categories for a select; a product's own category stays even when it is not (or no longer) in the list. */
export function categoryOptions(list: ProductCategory[], current: string): string[] {
  const names = list.filter(c => c.parentId == null && c.isActive).map(c => c.name).sort((a, b) => a.localeCompare(b));
  return keep(names, current);
}

/** The active sub categories of the chosen category; the product's own one stays. */
export function subCategoryOptions(list: ProductCategory[], category: string, current: string): string[] {
  const parent = list.find(c => c.parentId == null && same(c.name, category ?? ''));
  const names = parent
    ? list.filter(c => c.parentId === parent.categoryId && c.isActive).map(c => c.name).sort((a, b) => a.localeCompare(b))
    : [];
  return keep(names, current);
}
