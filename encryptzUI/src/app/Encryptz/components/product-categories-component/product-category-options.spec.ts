import { describe, expect, it } from 'vitest';
import { categoryOptions, subCategoryOptions } from './product-category-options';

const list = [
  { categoryId: 1, parentId: null, name: 'Air Conditioner', isActive: true, productCount: 3 },
  { categoryId: 2, parentId: 1, name: 'Split', isActive: true, productCount: 2 },
  { categoryId: 3, parentId: 1, name: 'Window', isActive: false, productCount: 0 },
  { categoryId: 4, parentId: null, name: 'Inverter', isActive: true, productCount: 1 },
  { categoryId: 5, parentId: null, name: 'Old Stuff', isActive: false, productCount: 0 },
  { categoryId: 6, parentId: 4, name: 'Home', isActive: true, productCount: 1 },
];

describe('product category options', () => {
  it('lists the active categories, by name', () => {
    expect(categoryOptions(list, '')).toEqual(['Air Conditioner', 'Inverter']);
  });

  it('keeps the current category of a product even when it is inactive or not in the master', () => {
    expect(categoryOptions(list, 'Old Stuff')).toEqual(['Old Stuff', 'Air Conditioner', 'Inverter']);
    expect(categoryOptions(list, ' Gym ')).toEqual(['Gym', 'Air Conditioner', 'Inverter']);
  });

  it('lists the active sub categories of the chosen category', () => {
    expect(subCategoryOptions(list, 'Air Conditioner', '')).toEqual(['Split']);
    expect(subCategoryOptions(list, 'air conditioner', '')).toEqual(['Split']);
    expect(subCategoryOptions(list, '', '')).toEqual([]);
  });

  it('keeps the current sub category of a product', () => {
    expect(subCategoryOptions(list, 'Air Conditioner', 'Window')).toEqual(['Window', 'Split']);
  });
});
