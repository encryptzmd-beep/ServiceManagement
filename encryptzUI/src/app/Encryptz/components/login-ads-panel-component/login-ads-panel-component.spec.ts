import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PlatformService } from '../../Services/platform-service';
import { DialogService } from '../../Services/dialog-service';
import { LoginAdsPanelComponent, MAX_AD_IMAGE_BYTES, adStatus, showsText } from './login-ads-panel-component';

describe('showsText', () => {
  it('reads the four shapes', () => {
    expect(showsText({ showFrom: null, showUntil: null })).toBe('Always');
    expect(showsText({ showFrom: '2026-10-01', showUntil: null })).toBe('From 1 Oct 2026');
    expect(showsText({ showFrom: null, showUntil: '2026-10-31T00:00:00' })).toBe('Until 31 Oct 2026');
    expect(showsText({ showFrom: '2026-10-01', showUntil: '2026-10-31' })).toBe('1 Oct 2026 – 31 Oct 2026');
  });

  it('calls a slide whose last day has passed Ended', () => {
    expect(adStatus({ isActive: true, showUntil: '2026-10-27' }, '2026-10-28')).toBe('Ended');
    expect(adStatus({ isActive: true, showUntil: '2026-10-28' }, '2026-10-28')).toBe('Active');
    expect(adStatus({ isActive: false, showUntil: null }, '2026-10-28')).toBe('Hidden');
  });
});

describe('LoginAdsPanelComponent', () => {
  const ad = (id: number, order: number) => ({ loginAdId: id, sortOrder: order, tag: '', title: 'Slide ' + id, body: '', buttonText: '', linkUrl: '', showFrom: null, showUntil: null, isActive: true, imageVersion: 1 });
  let api: any;
  let confirmAnswer: boolean;

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginAdsPanelComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmAnswer), alert: () => Promise.resolve(), state: () => null } },
      ],
    });
    const fixture = TestBed.createComponent(LoginAdsPanelComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    confirmAnswer = false;
    api = {
      getLoginAds: vi.fn(() => of({ success: true, data: [ad(1, 1), ad(2, 2), ad(3, 3)] })),
      loginAdImage: vi.fn(() => of(new Blob())),
      saveLoginAd: vi.fn(() => of({ success: true, data: 4 })),
      setLoginAdActive: vi.fn(() => of({ success: true, data: true })),
      reorderLoginAds: vi.fn(() => of({ success: true, data: true })),
      deleteLoginAd: vi.fn(() => of({ success: true, data: true })),
    };
  });

  it('moves a slide down and saves the whole order', () => {
    const c = create().componentInstance;
    c.move(0, 1);
    expect(api.reorderLoginAds).toHaveBeenCalledWith([2, 1, 3]);
  });

  it('refuses a new slide without an image before calling the API', () => {
    const c = create().componentInstance;
    c.openNew();
    c.save();
    expect(c.formError()).toBe('Choose an image');
    expect(api.saveLoginAd).not.toHaveBeenCalled();
  });

  it('refuses an image over 2 MB before calling the API', () => {
    const c = create().componentInstance;
    c.openNew();
    const big = new File([new Uint8Array(MAX_AD_IMAGE_BYTES + 1)], 'a.png', { type: 'image/png' });
    c.pickFile({ target: { files: [big], value: 'a.png' } } as any);
    expect(c.formError()).toBe('The image is larger than 2 MB');
    c.save();
    expect(api.saveLoginAd).not.toHaveBeenCalled();
  });

  it('saves with the file', () => {
    const c = create().componentInstance;
    c.openNew();
    const file = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });
    c.pickFile({ target: { files: [file], value: 'a.png' } } as any);
    c.save();
    expect(api.saveLoginAd).toHaveBeenCalledWith(expect.objectContaining({ loginAdId: 0 }), file);
  });

  it('asks before deleting', async () => {
    const c = create().componentInstance;
    await c.remove(ad(1, 1));
    expect(api.deleteLoginAd).not.toHaveBeenCalled();
    confirmAnswer = true;
    await c.remove(ad(1, 1));
    expect(api.deleteLoginAd).toHaveBeenCalledWith(1);
  });
});
