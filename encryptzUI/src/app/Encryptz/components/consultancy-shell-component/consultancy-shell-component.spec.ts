import { Component, input, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DashboardStateService } from '../../Services/dashboard-state-service';
import { MessageAlertsService } from '../../Services/message-alerts-service';
import { FooterComponent } from '../footer-component/footer-component';
import { HeaderComponent } from '../header-component/header-component';
import { ConsultancyShellComponent } from './consultancy-shell-component';

@Component({ selector: 'app-header', standalone: true, template: '<button class="hdr-toggle" (click)="toggleSidebar.emit()"></button><i class="hdr-key">{{ moduleKey() }}</i>' })
class HeaderStub { toggleSidebar = output<void>(); moduleKey = input<string | null>(null); }

@Component({ selector: 'app-footer', standalone: true, template: '' })
class FooterStub {}

@Component({ selector: 'app-blank', standalone: true, template: '' })
class Blank {}

describe('ConsultancyShellComponent', () => {
  const company = signal(0);
  let watched: string[];

  const create = () => {
    watched = [];
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ConsultancyShellComponent],
      providers: [
        provideRouter([{ path: '**', component: Blank }]),
        { provide: MessageAlertsService, useValue: { unread: { person: signal(0), company }, watch: (s: string) => watched.push(s) } },
      ],
    });
    TestBed.overrideComponent(ConsultancyShellComponent, {
      remove: { imports: [HeaderComponent, FooterComponent] },
      add: { imports: [HeaderStub, FooterStub] },
    });
    const fixture = TestBed.createComponent(ConsultancyShellComponent);
    fixture.detectChanges();
    return fixture;
  };
  const el = (f: ReturnType<typeof create>) => f.nativeElement as HTMLElement;

  beforeEach(() => company.set(0));

  it('has the CRM frame, and tells the header it is Job Consultancy', () => {
    const f = create();
    expect(el(f).querySelector('app-header')).not.toBeNull();
    expect(el(f).querySelector('app-footer')).not.toBeNull();
    expect(el(f).querySelector('aside.crm-side')).not.toBeNull();
    expect(el(f).querySelector('.hdr-key')!.textContent).toBe('JOBCONSULTANCY');
  });

  it('its side menu opens every page', () => {
    const f = create();
    const links = Array.from(el(f).querySelectorAll<HTMLAnchorElement>('.crm-side a.nav-item'));
    expect(links.map(a => a.querySelector('.nav-label')!.textContent!.trim()))
      .toEqual(['Dashboard', 'Job postings', 'Candidates', 'Messages', 'Clients', 'Placements']);
    expect(links.map(a => a.getAttribute('href'))).toEqual([
      '/consultancy/dashboard', '/consultancy/postings', '/consultancy/candidates',
      '/consultancy/messages', '/consultancy/clients', '/consultancy/placements',
    ]);
  });

  it('shows the unread messages beside Messages', () => {
    company.set(3);
    const f = create();
    expect(watched).toEqual(['company']);
    expect(el(f).querySelector('.cz-badge')!.textContent).toBe('3');
  });

  it('keeps Candidates marked on Our candidates', async () => {
    const f = create();
    await TestBed.inject(Router).navigateByUrl('/consultancy/our-candidates?add=1');
    f.detectChanges();
    expect(el(f).querySelector('.nav-item.active .nav-label')!.textContent).toBe('Candidates');
  });

  it('collapses with the header toggle', () => {
    const f = create();
    const dash = TestBed.inject(DashboardStateService);
    dash.openSidebar();
    f.detectChanges();
    (el(f).querySelector('.hdr-toggle') as HTMLButtonElement).click();
    f.detectChanges();
    expect(el(f).querySelector('.crm-side.collapsed')).not.toBeNull();
  });
});
