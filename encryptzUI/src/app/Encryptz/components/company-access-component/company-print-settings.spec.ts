import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CompanyAccessApi } from './company-access';
import { CompanyPrintSettingsComponent } from './company-print-settings';

describe('CompanyPrintSettingsComponent', () => {
  const setup = () => {
    const savePrintSettings = vi.fn(() => of({ success: true, message: '', data: true }));
    TestBed.configureTestingModule({
      imports: [CompanyPrintSettingsComponent],
      providers: [{ provide: CompanyAccessApi, useValue: {
        printSettings: () => of({ success: true, message: '', data: { 'Print.BankName': 'Old bank', 'Print.CompanyLogo': 'data:image/png;base64,AAAA' } }),
        savePrintSettings,
      } }],
    });
    const fixture = TestBed.createComponent(CompanyPrintSettingsComponent);
    fixture.detectChanges();
    return { fixture, savePrintSettings };
  };

  it('offers the logo and the seal', () => {
    const text = (setup().fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('Company logo');
    expect(text).toContain('Seal and signature');
  });

  it('sends only what changed, and nothing after it is saved', () => {
    const { fixture, savePrintSettings } = setup();
    const c = fixture.componentInstance;
    expect(c.dirty()).toBe(false);
    c.set('Print.BankName', 'New bank');
    c.save();
    expect(savePrintSettings).toHaveBeenCalledWith({ 'Print.BankName': 'New bank' });
    expect(c.dirty()).toBe(false);
  });
});
