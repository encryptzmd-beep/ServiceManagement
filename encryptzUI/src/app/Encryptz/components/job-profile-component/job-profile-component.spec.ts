import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { JobAlertsService } from '../../Services/job-alerts-service';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobsService } from '../../Services/jobs-service';
import { JobProfileComponent } from './job-profile-component';

describe('JobProfileComponent', () => {
  const page = () => ({
    profile: { fullName: 'Leo Joseph', headline: 'Accountant, 5 years', summary: 'About me', city: 'Kochi', contactEmail: 'leo@example.com', contactPhone: '', dateOfBirth: null, isVisible: false },
    experience: [{ experienceId: 1, organisation: 'Acme', title: 'Clerk', startMonth: '2019-04-01T00:00:00', endMonth: null, description: 'd' }],
    education: [{ educationId: 2, institution: 'MG University', course: 'B.Com', fieldOfStudy: 'Finance', startYear: 2012, endYear: 2015 }],
    skills: [
      { skillId: 3, skillName: 'Tally', rating: 5, level: 'Expert', subSkills: [{ name: 'GST', rating: 4 }], evidenceUrl: 'https://youtube.com/watch?v=abc' },
      { skillId: 4, skillName: 'Typing', rating: 2, level: 'Beginner', subSkills: [], evidenceUrl: 'javascript:alert(1)' },
    ],
    certificates: [{ certificateId: 5, title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15T00:00:00', status: 'Uploaded', fileId: 9, fileName: 'c.pdf', sizeBytes: 2048 }],
    resume: { fileId: 8, fileName: 'cv.pdf', sizeBytes: 1048576, uploadedAt: '2026-10-13T10:00:00' },
    completeness: 90,
  });

  let api: any;
  let alerts: { unread: ReturnType<typeof signal<number>>; refresh: () => void; refreshed: number };
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobProfileComponent],
      providers: [
        provideRouter([]),
        { provide: JobsService, useValue: api },
        { provide: JobAlertsService, useValue: alerts },
        { provide: AuthService, useValue: {
          userName: () => 'Leo Joseph',
          currentUser: () => ({ userId: 11, fullName: 'Leo Joseph', individualId: 'EZ-7K4M-2P9Q-XD3Q' }),
        } },
      ],
    });
    const fixture = TestBed.createComponent(JobProfileComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const ok = (data: any = true, message = 'Saved') => of({ success: true, message, data });
  const refused = (message: string) => of({ success: false, message, data: null });

  beforeEach(() => {
    alerts = { unread: signal(0), refreshed: 0, refresh: () => { alerts.refreshed++; } };
    calls = [];
    api = {
      getPage: () => { calls.push(['getPage']); return of({ success: true, message: '', data: page() }); },
      saveProfile: (p: any) => { calls.push(['saveProfile', p]); return ok(); },
      setVisible: (on: boolean) => { calls.push(['setVisible', on]); return ok(true, 'Employers can find your profile'); },
      getShare: () => { calls.push(['getShare']); return ok({ isOn: false, code: '' }); },
      setShare: (on: boolean) => { calls.push(['setShare', on]); return ok({ isOn: on, code: 'abcdefghij' }, on ? 'Your profile link is on' : 'The link is off'); },
      saveExperience: (e: any) => { calls.push(['saveExperience', e]); return ok(1); },
      deleteExperience: (id: number) => { calls.push(['deleteExperience', id]); return ok(); },
      saveEducation: (e: any) => { calls.push(['saveEducation', e]); return ok(2); },
      deleteEducation: (id: number) => { calls.push(['deleteEducation', id]); return ok(); },
      saveSkill: (s: any) => { calls.push(['saveSkill', s]); return ok(3); },
      deleteSkill: (id: number) => { calls.push(['deleteSkill', id]); return ok(); },
      suggestSkills: (q: string) => { calls.push(['suggestSkills', q]); return of({ success: true, message: '', data: ['Tally', 'Tally Prime'] }); },
      catalogSubSkills: (s: string) => { calls.push(['catalogSubSkills', s]); return of({ success: true, message: '', data: ['GST', 'Payroll', 'Inventory'] }); },
      saveCertificate: (c: any, file: any) => { calls.push(['saveCertificate', c, file]); return ok(5); },
      deleteCertificate: (id: number) => { calls.push(['deleteCertificate', id]); return ok(); },
      saveResume: (file: any) => { calls.push(['saveResume', file]); return ok(8); },
      deleteResume: () => { calls.push(['deleteResume']); return ok(); },
      downloadFile: (id: number) => { calls.push(['downloadFile', id]); return of(new Blob(['x'])); },
      getPhoto: () => { calls.push(['getPhoto']); return of(null); },
      getProfileViews: () => { calls.push(['getProfileViews']); return of({ success: true, message: '', data: [] }); },
      savePhoto: (file: any) => { calls.push(['savePhoto', file]); return ok(7, 'Photo saved'); },
      deletePhoto: () => { calls.push(['deletePhoto']); return ok(true, 'Photo removed'); },
    };
    // the test browser has no object URLs
    (URL as any).createObjectURL = () => 'blob:test-photo';
    (URL as any).revokeObjectURL = () => {};
    if (typeof window.print !== 'function') (window as any).print = () => {};
  });

  // ── job preferences ───────────────────────────────────────────────────────

  const withPreferences = () => of({ success: true, message: '', data: {
    ...page(),
    preferences: { jobs: ['Site Engineer', 'Quantity Surveyor'], locations: ['Kochi'], workModes: ['Remote', 'Hybrid'], expectedCtc: 600000 },
  } });

  it('shows what the person is looking for, the CTC as a yearly amount in rupees', () => {
    api.getPage = withPreferences;
    const t = text(create());

    expect(t).toContain('Job preferences');
    expect(t).toContain('Site Engineer');
    expect(t).toContain('Quantity Surveyor');
    expect(t).toContain('Kochi');
    expect(t).toContain('Remote');
    expect(t).toContain('₹6,00,000 per year');
  });

  it('saves the interests and hobbies: comma-separated entries are added once, what is left in a box is taken', () => {
    api.saveInterests = (i: any) => { calls.push(['saveInterests', i]); return ok(true, 'Interests and hobbies saved'); };
    api.getPage = () => of({ success: true, message: '', data: { ...page(), interests: { interests: ['Travel'], hobbies: [] } } });
    const fixture = create();
    const c = fixture.componentInstance;
    expect(text(fixture)).toContain('Interests & hobbies');
    expect(text(fixture)).toContain('Travel');

    c.openInterests();
    const m = c.dialog()!.model;
    m.interestInput = 'Photography, travel';
    c.addPreference('interests');
    m.hobbyInput = 'Cricket';                    // left in the box: taken on save
    c.save();

    expect(calls.find(x => x[0] === 'saveInterests')![1]).toEqual({ interests: ['Travel', 'Photography'], hobbies: ['Cricket'] });
    expect(c.dialog()).toBeNull();
  });

  it('shows each social link as the logo of its platform, and only https links', () => {
    api.getPage = () => of({ success: true, message: '', data: { ...page(), socialLinks: [
      { platform: 'LinkedIn', url: 'https://www.linkedin.com/in/leo' },
      { platform: 'Website', url: 'https://leo.dev' },
      { platform: 'GitHub', url: 'javascript:alert(1)' },
    ] } });
    const fixture = create();
    const icons = Array.from(fixture.nativeElement.querySelectorAll('a.jp-social')) as HTMLAnchorElement[];

    expect(icons.map(a => a.getAttribute('href'))).toEqual(['https://www.linkedin.com/in/leo', 'https://leo.dev']);
    expect(icons[0].querySelector('svg path')).not.toBeNull();
    expect(icons[0].getAttribute('target')).toBe('_blank');
    expect(icons[1].textContent).toContain('language');
  });

  it('saves the social links: an address without https is completed, a bad one or a repeat is refused', () => {
    api.saveSocialLinks = (urls: string[]) => { calls.push(['saveSocialLinks', urls]); return ok(true, 'Social links saved'); };
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSocialLinks();
    const m = c.dialog()!.model;
    m.linkInput = 'linkedin.com/in/leo';
    c.addSocialLink();
    m.linkInput = 'http://github.com/leo';
    c.addSocialLink();
    expect(m.links).toEqual(['https://linkedin.com/in/leo', 'https://github.com/leo']);
    expect(c.platformOf(m.links[1])).toBe('GitHub');

    m.linkInput = 'https://LINKEDIN.com/in/leo';
    c.addSocialLink();
    expect(c.formError()).toBe('This link is in the list already');

    m.linkInput = 'javascript:alert(1)';
    c.addSocialLink();
    expect(c.formError()).toContain('Enter the full address');

    m.linkInput = '';
    c.removeSocialLink(0);
    c.save();
    expect(calls.find(x => x[0] === 'saveSocialLinks')![1]).toEqual(['https://github.com/leo']);
  });

  it('works out the age from the date of birth, counting the birthday', () => {
    const c = create().componentInstance;
    const today = new Date(2026, 9, 23);   // 23 Oct 2026

    expect(c.ageOf('1996-10-23T00:00:00', today)).toBe(30);
    expect(c.ageOf('1996-10-24', today)).toBe(29);
    expect(c.ageOf(null, today)).toBeNull();
    expect(c.ageOf('2030-01-01', today)).toBeNull();
  });

  it('adds up the experience: overlapping months count once, a current job runs to this month', () => {
    const c = create().componentInstance;
    const today = new Date(2026, 9, 23);   // Oct 2026
    const row = (start: string, end: string | null) =>
      ({ experienceId: 0, organisation: 'A', title: 'T', startMonth: start, endMonth: end, description: '' });

    expect(c.experienceLabel([row('2024-04-01', '2024-06-01')], today)).toBe('3 mos');
    expect(c.experienceLabel([row('2020-01-01', '2021-12-01'), row('2021-06-01', '2022-12-01')], today)).toBe('3 yrs');
    expect(c.experienceLabel([row('2025-10-01', null)], today)).toBe('1 yr 1 mo');
    expect(c.experienceLabel([], today)).toBe('');
  });

  it('shows the age and the experience under the headline', () => {
    api.getPage = () => of({ success: true, message: '', data: { ...page(), profile: { ...page().profile, dateOfBirth: '1990-01-15T00:00:00' } } });
    const t = text(create());

    expect(t).toMatch(/\d+ years old/);
    expect(t).toMatch(/\d+ yrs?( \d+ mos?)? experience/);
  });

  it('asks for the preferences when there are none (also from an API that sends none)', () => {
    expect(text(create())).toContain('Say which jobs, places and working modes you prefer');
  });

  it('saves the preferences: typed entries are added once, modes are switched, the CTC is a number', () => {
    api.savePreferences = (p: any) => { calls.push(['savePreferences', p]); return ok(true, 'Preferences saved'); };
    api.getPage = withPreferences;
    const fixture = create();
    const c = fixture.componentInstance;

    c.openPreferences();
    const m = c.dialog()!.model;
    m.jobInput = ' Estimator, site engineer ';
    c.addPreference('jobs');
    c.removePreference('jobs', 1);              // Quantity Surveyor
    m.locationInput = 'Thrissur';               // left in the box: taken on save
    c.toggleWorkMode('Remote');                 // off
    c.toggleWorkMode('On-site');                // on
    m.expectedCtc = '750000';
    c.save();

    expect(calls.find(x => x[0] === 'savePreferences')![1]).toEqual({
      jobs: ['Site Engineer', 'Estimator'], locations: ['Kochi', 'Thrissur'], workModes: ['Hybrid', 'On-site'], expectedCtc: 750000,
    });
    expect(c.dialog()).toBeNull();
  });

  it('sends no CTC when the box is empty, and refuses one that is not a positive whole number', () => {
    api.savePreferences = (p: any) => { calls.push(['savePreferences', p]); return ok(); };
    const fixture = create();
    const c = fixture.componentInstance;

    c.openPreferences();
    c.dialog()!.model.expectedCtc = '-5';
    c.save();
    expect(c.formError()).toBe('Enter the expected CTC as a yearly amount');
    expect(calls.some(x => x[0] === 'savePreferences')).toBe(false);

    c.dialog()!.model.expectedCtc = '';
    c.save();
    expect(calls.find(x => x[0] === 'savePreferences')![1].expectedCtc).toBeNull();
  });

  it('takes at most 10 preferred jobs', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openPreferences();
    c.dialog()!.model.jobInput = Array.from({ length: 11 }, (_, i) => `Job ${i + 1}`).join(',');
    c.addPreference('jobs');

    expect(c.dialog()!.model.jobs.length).toBe(10);
    expect(c.formError()).toBe('Choose at most 10 preferred jobs');
  });

  it('keeps a dialog open when the person clicks beside it: what is typed is not lost', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openProfile();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.jp-overlay') as HTMLElement).click();
    fixture.detectChanges();

    expect(c.dialog()).not.toBeNull();

    (fixture.nativeElement.querySelector('.jp-close') as HTMLElement).click();
    expect(c.dialog()).toBeNull();
  });

  // ── date of birth and verification ────────────────────────────────────────

  it('does not save a profile without a date of birth', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openProfile();
    c.dialog()!.model.dateOfBirth = '';
    c.save();

    expect(c.formError()).toBe('Enter your date of birth');
    expect(calls.some(x => x[0] === 'saveProfile')).toBe(false);
  });

  it('names the state of each certificate', () => {
    const c = create().componentInstance;

    expect(c.certificateLabel({ status: 'Uploaded', fileId: 9 })).toBe('Waiting for verification');
    expect(c.certificateLabel({ status: 'Uploaded', fileId: 0 })).toBe('Uploaded by you');
    expect(c.certificateLabel({ status: 'Verified', fileId: 9 })).toBe('Verified');
    expect(c.certificateLabel({ status: 'Rejected', fileId: 9 })).toBe('Not verified');
  });

  // ── who viewed the profile ────────────────────────────────────────────────

  it('shows which company opened the profile or the resume, for which job', () => {
    api.getProfileViews = () => of({ success: true, message: '', data: [
      { companyName: 'Hamster A/C', postingTitle: 'Accountant', profileViews: 2, resumeViews: 1, lastViewedAt: '2020-01-15T10:00:00' },
      { companyName: 'Felix', postingTitle: 'Clerk', profileViews: 1, resumeViews: 0, lastViewedAt: '2020-01-10T10:00:00' },
    ] });
    const card = create().nativeElement.querySelector('.jp-views') as HTMLElement;
    const t = card.textContent!.replace(/\s+/g, ' ');

    expect(t).toContain('Who viewed your profile');
    expect(t).toContain('Hamster A/C');
    expect(t).toContain('Accountant · profile and resume · 15 Jan 2020');
    expect(t).toContain('Clerk · profile · 10 Jan 2020');
  });

  it('says nobody looked yet, and hides the card when the list cannot be read', () => {
    expect(text(create())).toContain('No company has opened your profile yet');

    api.getProfileViews = () => throwError(() => ({ status: 0 }));
    const fixture = create();
    expect(fixture.nativeElement.querySelector('.jp-views')).toBeNull();
    expect(text(fixture)).toContain('Experience');
  });

  it('asks for skill suggestions once the typing stops, not for every letter', () => {
    vi.useFakeTimers();
    try {
      const c = create().componentInstance;
      c.suggest('ta');
      c.suggest('tal');
      c.suggest('tall');
      expect(calls.some(x => x[0] === 'suggestSkills')).toBe(false);

      vi.advanceTimersByTime(400);
      expect(calls.filter(x => x[0] === 'suggestSkills')).toEqual([['suggestSkills', 'tall']]);
      expect(c.suggestions()).toEqual(['Tally', 'Tally Prime']);

      c.suggest('t');
      vi.advanceTimersByTime(400);
      expect(c.suggestions()).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  // ── photo ─────────────────────────────────────────────────────────────────

  it('shows the photo instead of the initials when there is one', () => {
    api.getPhoto = () => of(new Blob(['x'], { type: 'image/png' }));
    const fixture = create();
    const img = fixture.nativeElement.querySelector('.jp-avatar img') as HTMLImageElement;

    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('blob:test-photo');
    expect(fixture.nativeElement.querySelector('.jp-avatar').textContent.trim()).toBe('');
  });

  it('uploads a photo and reads it again', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const file = new File([new Uint8Array(10)], 'me.jpg');

    c.uploadPhoto(file);

    expect(calls).toContainEqual(['savePhoto', file]);
    expect(calls.filter(x => x[0] === 'getPhoto').length).toBe(2);
    expect(c.photoError()).toBe('');
  });

  it('refuses a photo of another type or above 2 MB before it is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.uploadPhoto(new File([new Uint8Array(10)], 'me.pdf'));
    expect(c.photoError()).toBe('A photo must be a JPG or PNG file');

    c.uploadPhoto(new File([new Uint8Array(2 * 1024 * 1024 + 1)], 'me.png'));
    expect(c.photoError()).toBe('The photo is larger than 2 MB');

    expect(calls.some(x => x[0] === 'savePhoto')).toBe(false);
  });

  it('shows what the API says when it refuses a photo', () => {
    api.savePhoto = () => refused('The content of the file does not match its type');
    const fixture = create();

    fixture.componentInstance.uploadPhoto(new File([new Uint8Array(10)], 'me.jpg'));
    fixture.detectChanges();

    expect(text(fixture)).toContain('The content of the file does not match its type');
  });

  it('removes the photo only after the person confirmed, and shows the initials again', () => {
    api.getPhoto = () => of(new Blob(['x'], { type: 'image/png' }));
    const fixture = create();
    const c = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    c.removePhoto();
    expect(calls.some(x => x[0] === 'deletePhoto')).toBe(false);

    confirmSpy.mockReturnValue(true);
    c.removePhoto();
    fixture.detectChanges();

    expect(calls).toContainEqual(['deletePhoto']);
    expect(fixture.nativeElement.querySelector('.jp-avatar img')).toBeNull();
    expect(fixture.nativeElement.querySelector('.jp-avatar').textContent.trim()).toBe('LJ');
    confirmSpy.mockRestore();
  });

  // ── resume from the profile ───────────────────────────────────────────────

  it('has a resume of the profile for printing: one column, standard headings, plain text', () => {
    const fixture = create();
    const cv = fixture.nativeElement.querySelector('.jp-cv') as HTMLElement;
    const t = cv.textContent!.replace(/\s+/g, ' ');

    expect(cv.querySelector('h1')!.textContent!.trim()).toBe('Leo Joseph');
    expect(Array.from(cv.querySelectorAll('h2')).map(h => h.textContent!.trim()))
      .toEqual(['Professional Summary', 'Work Experience', 'Education', 'Skills', 'Certifications']);
    expect(t).toContain('Accountant, 5 years');
    expect(t).toContain('Kochi | leo@example.com');
    expect(t).toContain('Clerk');
    expect(t).toContain('Acme');
    expect(t).toContain('Apr 2019 – Present');
    expect(t).toContain('B.Com, Finance');
    expect(t).toContain('Tally (5/5: GST 4/5); Typing (2/5)');
    expect(t).toContain('Tally Prime');
    // nothing a resume reader cannot parse or should not see
    expect(cv.querySelector('img, table, a, button')).toBeNull();
    expect(t).not.toContain('Uploaded by you');
  });

  it('leaves a section without rows out of the resume', () => {
    api.getPage = () => of({ success: true, message: '', data: { ...page(), experience: [], certificates: [] } });
    const fixture = create();
    const headings = Array.from(fixture.nativeElement.querySelectorAll('.jp-cv h2')).map((h: any) => h.textContent.trim());

    expect(headings).toEqual(['Professional Summary', 'Education', 'Skills']);
  });

  it('prints the resume under the name of the person, and puts the page title back', () => {
    const fixture = create();
    const before = document.title;
    let titleWhilePrinting = '';
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => { titleWhilePrinting = document.title; });

    fixture.componentInstance.downloadResume();

    expect(printSpy).toHaveBeenCalledTimes(1);
    expect(titleWhilePrinting).toBe('Leo Joseph - Resume');
    expect(document.title).toBe(before);
    printSpy.mockRestore();
  });

  it('does not print a resume without a name', () => {
    api.getPage = () => of({ success: true, message: '', data: { ...page(), profile: { ...page().profile, fullName: '' } } });
    const fixture = create();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    fixture.componentInstance.downloadResume();

    expect(printSpy).not.toHaveBeenCalled();
    expect(fixture.componentInstance.toast()!.text).toBe('Add your name to the profile first');
    printSpy.mockRestore();
  });

  it('shows the application name, the person and the Individual ID in the shell', () => {
    const fixture = create();

    expect(text(fixture)).toContain('Job Portal');
    expect(text(fixture)).toContain('Leo Joseph');
    expect(text(fixture)).toContain('EZ-7K4M-2P9Q-XD3Q');
    expect(text(fixture)).toContain('Back to companies');
  });

  it('shows every section with the rows of the profile', () => {
    const fixture = create();
    const t = text(fixture);

    for (const heading of ['Profile', 'Experience', 'Education', 'Skills', 'Certificates', 'Resume'])
      expect(t).toContain(heading);

    expect(t).toContain('Accountant, 5 years');
    expect(t).toContain('Acme');
    expect(t).toContain('Apr 2019');
    expect(t).toContain('Present');
    expect(t).toContain('MG University');
    expect(t).toContain('2012');
    expect(t).toContain('Tally');
    expect(t).toContain('Tally Prime');
    expect(t).toContain('Waiting for verification');
    expect(t).toContain('cv.pdf');
    expect(t).toContain('1.0 MB');
    expect(t).toContain('90%');
  });

  it('has the side menu of Job Portal: every page opens', () => {
    const fixture = create();
    const items = Array.from(fixture.nativeElement.querySelectorAll('.ps-nav-item')) as HTMLElement[];
    const label = (e: HTMLElement) => e.querySelector('.ps-nav-label')!.textContent!.trim();

    expect(items.map(label)).toEqual(['My profile', 'Search jobs', 'My applications', 'Saved jobs', 'Messages', 'Notifications']);
    expect(items.map(e => e.getAttribute('href')))
      .toEqual(['/apps/jobs', '/apps/jobs/search', '/apps/jobs/applications', '/apps/jobs/saved', '/apps/jobs/messages', '/apps/jobs/notifications']);
    expect(fixture.nativeElement.textContent).not.toContain('Soon');
  });

  it('shows the initials of the name where a picture would be', () => {
    const fixture = create();

    expect(fixture.nativeElement.querySelector('.jp-avatar').textContent.trim()).toBe('LJ');
    expect(fixture.componentInstance.initials('  anu  ')).toBe('A');
    expect(fixture.componentInstance.initials('')).toBe('');
  });

  it('turns only an https evidence link into a link', () => {
    const fixture = create();
    const links = Array.from(fixture.nativeElement.querySelectorAll('a.jp-evidence')) as HTMLAnchorElement[];

    expect(links.length).toBe(1);
    expect(links[0].getAttribute('href')).toBe('https://youtube.com/watch?v=abc');
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer');
    expect(fixture.nativeElement.innerHTML).not.toContain('javascript:');
  });

  it('switches visibility through the API and shows the new state', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.toggleVisible(true);
    fixture.detectChanges();

    expect(calls).toContainEqual(['setVisible', true]);
    expect(c.page()!.profile.isVisible).toBe(true);
    expect(c.visibleError()).toBe('');
  });

  it('keeps the switch off and says why when visibility is refused', () => {
    api.setVisible = () => refused('Add your name and a headline before you switch this on');
    const fixture = create();
    const c = fixture.componentInstance;

    c.toggleVisible(true);
    fixture.detectChanges();

    expect(c.page()!.profile.isVisible).toBe(false);
    expect(text(fixture)).toContain('Add your name and a headline before you switch this on');
    expect((fixture.nativeElement.querySelector('.jp-switch input') as HTMLInputElement).checked).toBe(false);
  });

  it('saves the profile, closes the dialog and reads the page again', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openProfile();
    c.dialog()!.model.headline = 'Senior Accountant';
    c.dialog()!.model.dateOfBirth = '1990-05-01';
    c.save();

    const sent = calls.find(x => x[0] === 'saveProfile')![1];
    expect(sent.headline).toBe('Senior Accountant');
    expect(sent.dateOfBirth).toBe('1990-05-01');
    expect(sent.isVisible).toBeUndefined();
    expect(c.dialog()).toBeNull();
    expect(calls.filter(x => x[0] === 'getPage').length).toBe(2);
  });

  it('keeps the dialog open and shows the message when a save is refused', () => {
    api.saveExperience = () => refused('The end cannot be before the start');
    const fixture = create();
    const c = fixture.componentInstance;

    c.openExperience();
    c.dialog()!.model.organisation = 'Acme';
    c.dialog()!.model.title = 'Clerk';
    c.dialog()!.model.startMonth = '2019-04';
    c.dialog()!.model.endMonth = '2019-03';
    c.save();
    fixture.detectChanges();

    expect(c.dialog()).not.toBeNull();
    expect(c.formError()).toBe('The end cannot be before the start');
    expect(text(fixture)).toContain('The end cannot be before the start');
  });

  it('sends an experience by month, and no end for a current job', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openExperience();
    Object.assign(c.dialog()!.model, { organisation: 'Acme', title: 'Clerk', startMonth: '2019-04', current: true, endMonth: '2020-01' });
    c.save();

    const sent = calls.find(x => x[0] === 'saveExperience')![1];
    expect(sent.startMonth).toBe('2019-04-01');
    expect(sent.endMonth).toBeNull();
    expect(sent.experienceId).toBe(0);
  });

  it('opens an existing experience with its months filled in', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openExperience(c.page()!.experience[0]);

    expect(c.dialog()!.model.startMonth).toBe('2019-04');
    expect(c.dialog()!.model.current).toBe(true);
    expect(c.dialog()!.model.experienceId).toBe(1);
  });

  it('does not send an entry whose required fields are empty', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openEducation();
    c.save();
    expect(c.formError()).toBe('Enter the institution and the course');

    c.closeDialog();
    c.openSkill();
    c.save();
    expect(c.formError()).toBe('Enter the skill');

    c.closeDialog();
    c.openCertificate();
    c.save();
    expect(c.formError()).toBe('Enter the title of the certificate');

    expect(calls.some(x => ['saveEducation', 'saveSkill', 'saveCertificate'].includes(x[0]))).toBe(false);
  });

  it('needs a rating out of 5 for the skill and for every sub-skill', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill();
    const m = c.dialog()!.model;
    m.skillName = 'Tally';
    c.save();
    expect(c.formError()).toBe('Rate the skill from 1 to 5');

    m.rating = 4;
    c.addSubSkill(m, 'GST');
    c.save();
    expect(c.formError()).toBe('Rate every sub-skill from 1 to 5');
    expect(calls.some(x => x[0] === 'saveSkill')).toBe(false);

    m.subSkills[0].rating = 3;
    c.save();
    expect(calls.find(x => x[0] === 'saveSkill')![1]).toEqual(
      { skillId: 0, skillName: 'Tally', rating: 3, evidenceUrl: '', subSkills: [{ name: 'GST', rating: 3 }] });
  });

  it('takes the overall rating of a skill from the average of its sub-skills', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill();
    const m = c.dialog()!.model;
    m.skillName = 'Accounting';
    m.rating = 1;                                   // a rating typed before the sub-skills is not used
    c.addSubSkill(m, 'GST');
    c.addSubSkill(m, 'Payroll');
    c.addSubSkill(m, 'TDS');
    m.subSkills[0].rating = 4;
    m.subSkills[1].rating = 3;
    m.subSkills[2].rating = 3;

    expect(c.overallOf(m)).toBe(3.3);
    c.save();
    expect(calls.find(x => x[0] === 'saveSkill')![1].rating).toBe(3);
  });

  it('offers the sub-skills of the catalogue that are not in the list yet', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill(c.page()!.skills[0]);
    const m = c.dialog()!.model;
    expect(calls.filter(x => x[0] === 'catalogSubSkills')).toEqual([['catalogSubSkills', 'Tally']]);
    expect(c.catalogChips(m)).toEqual(['Payroll', 'Inventory']);

    c.addSubSkill(m, 'payroll');
    expect(c.catalogChips(m)).toEqual(['Inventory']);
    c.addSubSkill(m, 'GST');
    expect(c.formError()).toBe('This sub-skill is in the list already');
  });

  it('refuses a skill link that is not https before it is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill();
    Object.assign(c.dialog()!.model, { skillName: 'Singing', rating: 5, evidenceUrl: 'http://youtube.com/x' });
    c.save();

    expect(c.formError()).toBe('The link must start with https://');
    expect(calls.some(x => x[0] === 'saveSkill')).toBe(false);
  });

  it('refuses a file that is too large or of another type before it is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.uploadResume(new File([new Uint8Array(10)], 'cv.exe'));
    expect(c.resumeError()).toBe('A resume must be a PDF, DOC or DOCX file');

    c.uploadResume(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'cv.pdf'));
    expect(c.resumeError()).toBe('The file is larger than 5 MB');

    expect(calls.some(x => x[0] === 'saveResume')).toBe(false);

    c.uploadResume(new File([new Uint8Array(10)], 'cv.pdf'));
    expect(calls.some(x => x[0] === 'saveResume')).toBe(true);
    expect(c.resumeError()).toBe('');
  });

  it('shows what the API says when it refuses a resume', () => {
    api.saveResume = () => refused('The content of the file does not match its type');
    const fixture = create();
    const c = fixture.componentInstance;

    c.uploadResume(new File([new Uint8Array(10)], 'cv.pdf'));
    fixture.detectChanges();

    expect(text(fixture)).toContain('The content of the file does not match its type');
  });

  it('sends a certificate with its file', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const file = new File([new Uint8Array(10)], 'c.pdf');

    c.openCertificate();
    Object.assign(c.dialog()!.model, { title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15' });
    c.dialog()!.file = file;
    c.save();

    const call = calls.find(x => x[0] === 'saveCertificate')!;
    expect(call[1]).toEqual({ certificateId: 0, title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15' });
    expect(call[2]).toBe(file);
  });

  it('removes a row only after the person confirmed', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    c.remove('skill', 3, 'Tally');
    expect(calls.some(x => x[0] === 'deleteSkill')).toBe(false);

    confirmSpy.mockReturnValue(true);
    c.remove('skill', 3, 'Tally');
    expect(calls).toContainEqual(['deleteSkill', 3]);
    expect(calls.filter(x => x[0] === 'getPage').length).toBe(2);

    confirmSpy.mockRestore();
  });

  it('says so when the application is not available, and offers the way back', () => {
    api.getPage = () => refused('This application is not available right now');
    const fixture = create();

    expect(text(fixture)).toContain('This application is not available right now');
    expect(text(fixture)).toContain('Back to companies');
    expect(fixture.nativeElement.querySelector('.jp-section')).toBeNull();
  });

  it('says so when the API cannot be reached', () => {
    api.getPage = () => throwError(() => ({ status: 0 }));
    const fixture = create();

    expect(text(fixture)).toContain('Job Portal could not be loaded. Please try again.');
  });

  it('starts an empty profile with a hint instead of empty lists', () => {
    api.getPage = () => of({ success: true, message: '', data: {
      profile: { fullName: '', headline: '', summary: '', city: '', contactEmail: '', contactPhone: '', dateOfBirth: null, isVisible: false },
      experience: [], education: [], skills: [], certificates: [], resume: null, completeness: 0,
    } });
    const fixture = create();
    const t = text(fixture);

    expect(t).toContain('0%');
    expect(t).toContain('Add your name and a headline');
    expect(t).toContain('No experience added yet');
    expect(t).toContain('No resume uploaded yet');
  });

  // ── after the review ──────────────────────────────────────────────────────

  it('reads the page again when the answer to an upload is lost: the file may have been stored', () => {
    api.saveResume = () => throwError(() => ({ status: 0 }));
    const fixture = create();
    const c = fixture.componentInstance;

    c.uploadResume(new File([new Uint8Array(10)], 'cv.pdf'));

    expect(c.resumeError()).toBe('Could not upload the file. Please try again');
    expect(calls.filter(x => x[0] === 'getPage').length).toBe(2);
  });

  it('reads the page again when the answer to a save is lost, and keeps the dialog', () => {
    api.saveCertificate = () => throwError(() => ({ status: 0 }));
    const fixture = create();
    const c = fixture.componentInstance;

    c.openCertificate();
    c.dialog()!.model.title = 'Tally Prime';
    c.save();

    expect(c.dialog()).not.toBeNull();
    expect(c.formError()).toBe('Could not save. Please try again');
    expect(calls.filter(x => x[0] === 'getPage').length).toBe(2);
  });

  it('asks for the month as YYYY-MM where the browser gives a plain text box', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openExperience();
    Object.assign(c.dialog()!.model, { organisation: 'Acme', title: 'Clerk', startMonth: '04/2019' });
    c.save();
    expect(c.formError()).toBe('Enter the start month as YYYY-MM, for example 2019-04');

    Object.assign(c.dialog()!.model, { startMonth: '2019-04', endMonth: '2020-13' });
    c.save();
    expect(c.formError()).toBe('Enter the end month as YYYY-MM, for example 2019-04');

    expect(calls.some(x => x[0] === 'saveExperience')).toBe(false);
  });

  it('does not close the dialog while its save is on the way', () => {
    const pending = new Subject<any>();
    api.saveSkill = () => pending;
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill();
    Object.assign(c.dialog()!.model, { skillName: 'Singing', rating: 5 });
    c.save();
    c.closeDialog();

    expect(c.dialog()).not.toBeNull();
    expect(c.saving()).toBe(true);

    pending.next({ success: true, message: 'Skill added', data: 3 });
    expect(c.dialog()).toBeNull();
  });

  it('puts the real checkbox back when switching visibility on is refused', () => {
    api.setVisible = () => refused('Add your name and a headline before you switch this on');
    const fixture = create();
    const box = fixture.nativeElement.querySelector('.jp-switch input') as HTMLInputElement;

    box.checked = true;                          // what a click does before the handler runs
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(calls.map(x => x[0]).sort()).toEqual(['getPage', 'getPhoto', 'getProfileViews', 'getShare']);   // only the first reads: setVisible is replaced above
    expect(box.checked).toBe(false);
    expect(text(fixture)).toContain('Add your name and a headline before you switch this on');
  });
});
