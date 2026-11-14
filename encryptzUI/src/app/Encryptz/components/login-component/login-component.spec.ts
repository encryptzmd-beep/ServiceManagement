import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { LoginAdService } from '../../Services/login-ad-service';
import { LoginComponent } from './login-component';

describe('LoginComponent', () => {
  let signedIn: [string, string][];

  const create = async (ads: any[] = []) => {
    signedIn = [];
    try { localStorage.removeItem('encryptz_remember_email'); } catch {}
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: LoginAdService, useValue: { list: () => of({ success: true, message: '', data: ads }), imageUrl: () => '' } },
        {
          provide: AuthService,
          useValue: {
            clearSession: () => {},
            loginWithCompanies: (email: string, password: string) => {
              signedIn.push([email, password]);
              return of({ success: false, message: 'Wrong password' });
            },
          },
        },
      ],
    });
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  };
  const el = (f: any): HTMLElement => f.nativeElement;

  it('renders the design: heading, brand panel and tabs', async () => {
    const f = await create();
    expect(el(f).querySelector('h1')!.textContent).toContain('Welcome Back');
    expect(el(f).textContent).toContain('Login to your ENCRYPTZ account and continue your journey.');
    expect(el(f).querySelector('.hero')).not.toBeNull();
    expect(el(f).textContent).toContain('All in One Platform.');
    expect(el(f).querySelector('app-login-ad-slider')!.classList).toContain('is-hidden');
  });

  it('shows the ad slider instead of the brand panel when there are login ads', async () => {
    const f = await create([{ loginAdId: 1, tag: '', title: 'Ad', body: '', buttonText: '', linkUrl: '', imageVersion: 1 }]);
    f.detectChanges();
    expect(el(f).querySelector('.hero')).toBeNull();
    expect(el(f).querySelector('app-login-ad-slider')!.classList).not.toContain('is-hidden');
  });

  it('still signs in with email and password', async () => {
    const f = await create();
    const email = el(f).querySelector('#login-email') as HTMLInputElement;
    const password = el(f).querySelector('#login-password') as HTMLInputElement;
    email.value = 'a@b.com'; email.dispatchEvent(new Event('input'));
    password.value = 'secret'; password.dispatchEvent(new Event('input'));
    (el(f).querySelector('button[type="submit"]') as HTMLButtonElement).click();
    f.detectChanges();

    expect(signedIn).toEqual([['a@b.com', 'secret']]);
    expect(el(f).textContent).toContain('Wrong password');
  });

  it('still opens the forgot password dialog', async () => {
    const f = await create();
    (el(f).querySelector('.forgot-link') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).textContent).toContain('Reset Password');
  });

  it('links Create an account to /register', async () => {
    const f = await create();
    const link = Array.from(el(f).querySelectorAll('a')).find(a => a.textContent!.includes('Create an account'));
    expect(link?.getAttribute('href')).toBe('/register');
  });
});
