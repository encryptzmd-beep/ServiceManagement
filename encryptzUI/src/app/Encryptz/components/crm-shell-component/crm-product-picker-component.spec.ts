import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CrmService } from '../../Services/crm-service';
import { CrmProductPickerComponent } from './crm-product-picker-component';

describe('CrmProductPickerComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const prod = (id: number, name: string, mrp = 100, category = 'Treadmill') =>
    ({ productMasterId: id, productName: name, productCode: 'P' + id, brand: 'Cosco', model: 'M' + id, category, mrp, warrantyMonths: 12 });
  let crm: any;

  const create = (category = '', productMasterId: number | null = null, productName = '') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [CrmProductPickerComponent], providers: [{ provide: CrmService, useValue: crm }] });
    const f = TestBed.createComponent(CrmProductPickerComponent);
    f.componentRef.setInput('category', category);
    f.componentRef.setInput('productMasterId', productMasterId);
    f.componentRef.setInput('productName', productName);
    f.detectChanges();
    return f;
  };
  const el = (f: any) => f.nativeElement as HTMLElement;
  const box = (f: any) => el(f).querySelector('.pp-product input') as HTMLInputElement;
  const opts = (f: any, sel: string) =>
    Array.from(el(f).querySelectorAll(`${sel} option`)).map(o => (o as HTMLOptionElement).textContent!.trim());
  const rows = (f: any) => Array.from(el(f).querySelectorAll('.pp-results [role="option"]')) as HTMLElement[];
  const type = (f: any, text: string) => {
    const i = box(f);
    i.dispatchEvent(new Event('focus'));
    i.value = text;
    i.dispatchEvent(new Event('input'));
    f.detectChanges();
  };
  const key = (f: any, k: string) => { box(f).dispatchEvent(new KeyboardEvent('keydown', { key: k })); f.detectChanges(); };

  beforeEach(() => {
    crm = {
      productCategories: () => ok(['Inverter', 'Treadmill']),
      searchProducts: vi.fn((t?: string, c?: string) =>
        ok(c === 'Treadmill' ? [prod(9, 'T-10C', 45000), prod(10, 'T-20', 1250.5)]
          : [prod(21, 'Inverter 900VA', 7800, 'Inverter')])),
    };
  });

  it('lists the categories from the product master', () => {
    const f = create();
    expect(opts(f, '.pp-category')).toEqual(expect.arrayContaining(['Inverter', 'Treadmill']));
  });

  it('opens the products of the chosen category with their rate', () => {
    const f = create('Treadmill');
    expect(crm.searchProducts).toHaveBeenCalledWith(undefined, 'Treadmill', 100);
    type(f, '');
    const r = rows(f);
    expect(r.map(x => x.querySelector('.pp-name')!.textContent!.trim())).toEqual(['T-10C', 'T-20']);
    expect(r[0].querySelector('.pp-rate')!.textContent!.trim()).toBe('₹45,000.00');
    expect(r[1].querySelector('.pp-rate')!.textContent!.trim()).toBe('₹1,250.50');
    expect(r[0].querySelector('.pp-meta')!.textContent).toContain('P9');
  });

  it('filters the category products as you type', () => {
    const f = create('Treadmill');
    type(f, 't-2');
    expect(rows(f).map(x => x.querySelector('.pp-name')!.textContent!.trim())).toEqual(['T-20']);
  });

  it('shows every product as soon as the box opens, with no category and nothing typed', () => {
    const f = create();
    type(f, '');
    expect(crm.searchProducts).toHaveBeenCalledWith(undefined, undefined, 100);
    expect(rows(f).map(x => x.querySelector('.pp-name')!.textContent!.trim())).toEqual(['Inverter 900VA']);
  });

  it('filters the whole list from the first letter', () => {
    const f = create();
    type(f, 'i');
    expect(rows(f).length).toBe(1);
    type(f, 'zzz');
    expect(rows(f).length).toBe(0);
  });

  it('asks the server when there are more products than the list holds', () => {
    crm.searchProducts = vi.fn((t?: string) => ok(t ? [prod(500, 'Rare inverter')] : Array.from({ length: 100 }, (_, i) => prod(i + 1, 'P' + i))));
    const f = create();
    type(f, 'r');
    expect(crm.searchProducts).toHaveBeenCalledWith('r', undefined, 20);
    expect(rows(f).map(x => x.querySelector('.pp-name')!.textContent!.trim())).toEqual(['Rare inverter']);
  });

  it('picking a product fills its category when none is chosen', () => {
    const f = create();
    const cat = vi.fn(); const id = vi.fn(); const picked = vi.fn();
    f.componentInstance.categoryChange.subscribe(cat);
    f.componentInstance.productMasterIdChange.subscribe(id);
    f.componentInstance.productPicked.subscribe(picked);
    type(f, 'inv');
    rows(f)[0].dispatchEvent(new MouseEvent('mousedown'));
    f.detectChanges();
    expect(cat).toHaveBeenCalledWith('Inverter');
    expect(id).toHaveBeenCalledWith(21);
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ productMasterId: 21, mrp: 7800 }));
    // the form takes the outputs back as inputs
    f.componentRef.setInput('productMasterId', 21);
    f.detectChanges();
    expect(box(f).value).toBe('Inverter 900VA');
    expect(rows(f).length).toBe(0);
  });

  it('arrow keys and Enter choose a product, Escape closes', () => {
    const f = create('Treadmill');
    const picked = vi.fn();
    f.componentInstance.productPicked.subscribe(picked);
    type(f, '');
    key(f, 'ArrowDown');
    key(f, 'ArrowDown');
    expect(rows(f)[1].getAttribute('aria-selected')).toBe('true');
    key(f, 'Enter');
    expect(picked).toHaveBeenCalledWith(expect.objectContaining({ productMasterId: 10 }));
    type(f, '');
    key(f, 'Escape');
    expect(rows(f).length).toBe(0);
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

  it('clearing the box clears the product', () => {
    const f = create('Treadmill', 9);
    const prodOut = vi.fn();
    f.componentInstance.productMasterIdChange.subscribe(prodOut);
    type(f, '');
    expect(prodOut).toHaveBeenCalledWith(null);
  });

  it('shows the name of the current product, even one not in the list', () => {
    expect(box(create('Treadmill', 9)).value).toBe('T-10C');
    expect(box(create('Treadmill', 77, 'Old model X')).value).toBe('Old model X');
  });

  it('says so when nothing matches', () => {
    const f = create('Treadmill');
    type(f, 'zzz');
    expect(el(f).textContent).toContain('No product matches');
  });

  it('shows a cue when exactly 100 products come back', () => {
    crm.searchProducts = vi.fn(() => ok(Array.from({ length: 100 }, (_, i) => prod(i + 1, 'P' + i))));
    const f = create('Treadmill');
    expect(el(f).textContent).toContain('Showing the first 100 products');
  });

  it('says so when the products cannot be loaded', () => {
    crm.searchProducts = vi.fn(() => of({ success: false, message: 'x', data: null }));
    const f = create('Treadmill');
    expect(el(f).textContent).toContain('The products could not be loaded');
  });

  it('keeps an old category that is not in the list', () => {
    const f = create('Gym bike');
    expect(opts(f, '.pp-category')).toContain('Gym bike');
  });
});
