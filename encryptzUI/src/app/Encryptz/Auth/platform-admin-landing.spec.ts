import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { AuthService } from './auth-service';
import { routes } from '../../app.routes';

/** A platform administrator signed in without a company, opening the site. */
describe('platform administrator landing', () => {
  const open = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        {
          provide: AuthService,
          useValue: {
            isLoggedIn: () => true,
            currentUser: signal({ isPlatformAdmin: true, role: 'Admin' }),
            userRole: () => 'Admin',
            hasAccess: () => false,
            selectedCompanyId: () => null,
            scopeState: () => ({ loggedIn: true, companyId: null, moduleKey: null, locationId: null }),
          },
        },
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl(url).catch(() => {});
    return router.url;
  };

  it('opens Platform Admin from the address of the site', async () => {
    expect(await open('/')).toBe('/settings/platform');
  });

  it('opens Platform Admin directly', async () => {
    expect(await open('/settings/platform')).toBe('/settings/platform');
  });
});
