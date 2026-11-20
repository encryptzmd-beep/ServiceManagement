import { Component, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../Auth/auth-service';
import { CrmService } from '../../Services/crm-service';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { HeaderComponent } from '../header-component/header-component';
import { CrmShellComponent } from './crm-shell-component';

/** Stands in for the shared header (its bell and wallet chip call the API). */
@Component({ selector: 'app-header', standalone: true, template: '<button class="hdr-toggle" (click)="toggleSidebar.emit()"></button>' })
class HeaderStub { toggleSidebar = output<void>(); }

@Component({ selector: 'app-blank', standalone: true, template: '' })
class Blank {}

describe('CrmShellComponent', () => {
  const create = (isManager: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CrmShellComponent],
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: AuthService, useValue: {
          selectedCompanyId: () => 2, selectedLocationName: () => 'Main',
          companies: () => [{ companyId: 2, companyName: 'Hamster A/C' }] } },
        { provide: CrmService, useValue: { me: () => of({ success: true, message: '', data: { userId: 1, fullName: 'A', isManager } }) } },
      ],
    });
    TestBed.overrideComponent(CrmShellComponent, { remove: { imports: [HeaderComponent] }, add: { imports: [HeaderStub] } });
    const fixture = TestBed.createComponent(CrmShellComponent);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: ReturnType<typeof create>) => f.nativeElement as HTMLElement;

  it('renders the shared header and footer', () => {
    const f = create(false);
    expect(el(f).querySelector('app-header')).not.toBeNull();
    expect(el(f).querySelector('app-footer')).not.toBeNull();
    expect(el(f).querySelector('aside.crm-side')).not.toBeNull();
  });

  it('shows Quotations in the menu', () => {
    const f = create(false);
    const links = Array.from(el(f).querySelectorAll<HTMLAnchorElement>('.crm-side a.nav-item'));
    expect(links.map(a => a.getAttribute('href'))).toEqual(['/crm/dashboard', '/crm/leads', '/crm/quotations']);
    expect(el(f).querySelector('.crm-side')!.textContent).toContain('Quotations');
  });

  it('a manager sees Settings after Reports', () => {
    const f = create(true);
    const nodes = Array.from(el(f).querySelectorAll('.crm-side .nav-item'));
    const iReports = nodes.findIndex(n => n.classList.contains('nav-group-header'));
    const iSettings = nodes.findIndex(n => n.getAttribute('href') === '/crm/settings');
    expect(iReports).toBeGreaterThan(-1);
    expect(iSettings).toBeGreaterThan(iReports);
  });

  it('shows Settings only to a manager', () => {
    expect(el(create(true)).querySelector('.crm-side')!.textContent).toContain('Settings');
  });

  it('hides Settings for a non-manager', () => {
    expect(el(create(false)).querySelector('.crm-side')!.textContent).not.toContain('Settings');
  });

  it('collapses with the header toggle', () => {
    const f = create(false);
    const dash = TestBed.inject(DashboardStateService);
    dash.openSidebar();
    f.detectChanges();
    expect(el(f).querySelector('.crm-side.collapsed')).toBeNull();

    dash.toggleSidebar();
    f.detectChanges();
    expect(el(f).querySelector('.crm-side.collapsed')).not.toBeNull();

    (el(f).querySelector('.hdr-toggle') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.crm-side.collapsed')).toBeNull();
  });

  it('has no Back to workspace: the module switcher in the top bar replaces it', () => {
    const f = create(false);
    expect(el(f).querySelector('.crm-side .crm-back')).toBeNull();
    expect(el(f).querySelector('.crm-side')!.textContent).not.toContain('Back to workspace');
  });

  const group = (f: ReturnType<typeof create>) => el(f).querySelector('.crm-side button.nav-group-header') as HTMLButtonElement;
  const subLinks = (f: ReturnType<typeof create>) =>
    Array.from(el(f).querySelectorAll<HTMLAnchorElement>('.crm-side .nav-children a')).map(a => a.getAttribute('href'));

  it('Reports is a group with the seven report links in order', () => {
    const f = create(false);
    expect(group(f).textContent).toContain('Reports');
    group(f).click();
    f.detectChanges();
    expect(subLinks(f)).toEqual(['followups', 'conversion', 'pipeline', 'sources', 'team', 'lost', 'quotations'].map(k => '/crm/reports/' + k));
  });

  it('the reports group toggles open and closed', () => {
    const f = create(false);
    expect(group(f).getAttribute('aria-expanded')).toBe('false');
    group(f).click();
    f.detectChanges();
    expect(group(f).getAttribute('aria-expanded')).toBe('true');
    group(f).click();
    f.detectChanges();
    expect(group(f).getAttribute('aria-expanded')).toBe('false');
    expect(subLinks(f)).toEqual([]);
  });

  it('the reports group is open on a report url', async () => {
    const f = create(false);
    await TestBed.inject(Router).navigateByUrl('/crm/reports/team');
    f.detectChanges();
    expect(group(f).getAttribute('aria-expanded')).toBe('true');
    expect(group(f).classList).toContain('active');
    expect(subLinks(f).length).toBe(7);
  });

  it('a collapsed menu opens when the Reports icon is clicked', () => {
    const f = create(false);
    const dash = TestBed.inject(DashboardStateService);
    dash.closeSidebar();
    f.detectChanges();
    group(f).click();
    f.detectChanges();
    expect(dash.sidebarOpen()).toBe(true);
    expect(group(f).getAttribute('aria-expanded')).toBe('true');
  });
});
