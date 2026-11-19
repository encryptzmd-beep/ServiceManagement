import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ProductService } from '../../Services/product-service';
import { ProductCategoriesComponent } from './product-categories-component';

describe('ProductCategoriesComponent', () => {
  const ok = (data: any) => of({ success: true, message: '', data });
  const tree = [
    { categoryId: 1, parentId: null, name: 'Air Conditioner', isActive: true, productCount: 3 },
    { categoryId: 2, parentId: 1, name: 'Split', isActive: true, productCount: 2 },
    { categoryId: 4, parentId: null, name: 'Inverter', isActive: false, productCount: 0 },
  ];
  let svc: any;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ProductCategoriesComponent],
      providers: [{ provide: ProductService, useValue: svc }, provideRouter([])],
    });
    const f = TestBed.createComponent(ProductCategoriesComponent);
    f.detectChanges();
    return f;
  };
  const el = (f: any) => f.nativeElement as HTMLElement;
  const type = (f: any, sel: string, v: string) => { const i = el(f).querySelector(sel) as HTMLInputElement; i.value = v; i.dispatchEvent(new Event('input')); f.detectChanges(); };
  const submit = (f: any, sel: string) => { (el(f).querySelector(sel) as HTMLFormElement).dispatchEvent(new Event('submit')); f.detectChanges(); };

  beforeEach(() => {
    svc = { getCategories: vi.fn(() => ok(tree)), saveCategory: vi.fn(() => ok(9)) };
  });

  it('lists the categories with their product counts and shows the sub categories of the first', () => {
    const f = create();
    const cats = Array.from(el(f).querySelectorAll('.pc-cats .pc-row')).map(r => r.textContent!.replace(/\s+/g, ' ').trim());
    expect(cats[0]).toContain('Air Conditioner');
    expect(cats[0]).toContain('3');
    expect(cats[1]).toContain('Inactive');
    expect(el(f).querySelector('.pc-subs')!.textContent).toContain('Split');
  });

  it('adds a category', () => {
    const f = create();
    type(f, '[name="newCategory"]', ' Water Purifier ');
    submit(f, '.pc-add-cat');
    expect(svc.saveCategory).toHaveBeenCalledWith({ categoryId: 0, parentId: null, name: 'Water Purifier', isActive: true });
  });

  it('adds a sub category to the chosen category', () => {
    const f = create();
    type(f, '[name="newSub"]', 'Window');
    submit(f, '.pc-add-sub');
    expect(svc.saveCategory).toHaveBeenCalledWith({ categoryId: 0, parentId: 1, name: 'Window', isActive: true });
  });

  it('renames a category', () => {
    const f = create();
    (el(f).querySelector('.pc-cats .pc-row [data-act="rename"]') as HTMLButtonElement).click();
    f.detectChanges();
    type(f, '.pc-cats [name="rename"]', 'AC');
    submit(f, '.pc-cats .pc-rename');
    expect(svc.saveCategory).toHaveBeenCalledWith({ categoryId: 1, parentId: null, name: 'AC', isActive: true });
  });

  it('activates and deactivates', () => {
    const f = create();
    (el(f).querySelectorAll('.pc-cats .pc-row [data-act="toggle"]')[1] as HTMLButtonElement).click();
    expect(svc.saveCategory).toHaveBeenCalledWith({ categoryId: 4, parentId: null, name: 'Inverter', isActive: true });
  });

  it('shows the refusal of the server', () => {
    svc.saveCategory = vi.fn(() => throwError(() => ({ error: { message: 'This name is already in the list' } })));
    const f = create();
    type(f, '[name="newCategory"]', 'Inverter');
    submit(f, '.pc-add-cat');
    expect(el(f).textContent).toContain('This name is already in the list');
  });

  it('says so when the master is not set up', () => {
    svc.getCategories = vi.fn(() => throwError(() => ({ error: { message: 'The category master is not set up in this company yet' } })));
    const f = create();
    expect(el(f).textContent).toContain('The category master is not set up in this company yet');
  });
});
