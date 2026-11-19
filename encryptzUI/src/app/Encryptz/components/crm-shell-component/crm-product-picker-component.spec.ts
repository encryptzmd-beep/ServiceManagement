import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmProductPickerComponent } from './crm-product-picker-component';

describe('CrmProductPickerComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const prod = (id: number, name: string) => ({ productMasterId: id, productName: name, productCode: 'P' + id, mrp: 100, warrantyMonths: 12 });
  let crm: any;

  const create = (category = '', productMasterId: number | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CrmProductPickerComponent], providers: [{ provide: CrmService, useValue: crm }] });
    const f = TestBed.createComponent(CrmProductPickerComponent);
    f.componentRef.setInput('category', category);
    f.componentRef.setInput('productMasterId', productMasterId);
    f.detectChanges();
    return f;
  };
  const opts = (f: any, sel: string) =>
    Array.from((f.nativeElement as HTMLElement).querySelectorAll(`${sel} option`)).map(o => (o as HTMLOptionElement).textContent!.trim());

  beforeEach(() => {
    crm = {
      productCategories: () => ok(['Inverter', 'Treadmill']),
      searchProducts: vi.fn((_t?: string, c?: string) => ok(c === 'Treadmill' ? [prod(9, 'T-10C'), prod(10, 'T-20')] : [])),
    };
  });

  it('lists the categories from the product master', () => {
    const f = create();
    expect(opts(f, '.pp-category')).toEqual(expect.arrayContaining(['Inverter', 'Treadmill']));
  });

  it('lists the products of the chosen category', () => {
    const f = create('Treadmill');
    expect(crm.searchProducts).toHaveBeenCalledWith(undefined, 'Treadmill', 100);
    expect(opts(f, '.pp-product')).toEqual(expect.arrayContaining(['T-10C', 'T-20']));
  });

  it('changing the category clears the product', () => {
    const f = create('Treadmill', 9);
    const cat = vi.fn();
    const prodOut = vi.fn();
    f.componentInstance.categoryChange.subscribe(cat);
    f.componentInstance.productMasterIdChange.subscribe(prodOut);
    f.componentInstance.chooseCategory('Inverter');
    expect(cat).toHaveBeenCalledWith('Inverter');
    expect(prodOut).toHaveBeenCalledWith(null);
  });

  it('reports the chosen product with its details', () => {
    const f = create('Treadmill');
    const picked = vi.fn();
    f.componentInstance.productPicked.subscribe(picked);
    f.componentInstance.chooseProduct('10');
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ productMasterId: 10, productName: 'T-20' }));
  });

  it('shows a cue when exactly 100 products come back', () => {
    crm.searchProducts = vi.fn(() => ok(Array.from({ length: 100 }, (_, i) => prod(i + 1, 'P' + i))));
    const f = create('Treadmill');
    expect(f.nativeElement.textContent).toContain('Showing the first 100 products');
  });

  it('says so when the products cannot be loaded', () => {
    crm.searchProducts = vi.fn(() => of({ success: false, message: 'x', data: null }));
    const f = create('Treadmill');
    expect(f.nativeElement.textContent).toContain('The products could not be loaded');
  });

  it('keeps an old category that is not in the list', () => {
    const f = create('Gym bike');
    expect(opts(f, '.pp-category')).toContain('Gym bike');
  });
});
