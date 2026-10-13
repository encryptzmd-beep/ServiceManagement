import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { JobsService } from '../../Services/jobs-service';
import { JobProfileComponent } from './job-profile-component';

describe('JobProfileComponent', () => {
  const page = () => ({
    profile: { fullName: 'Leo Joseph', headline: 'Accountant, 5 years', summary: 'About me', city: 'Kochi', contactEmail: 'leo@example.com', contactPhone: '', dateOfBirth: null, isVisible: false },
    experience: [{ experienceId: 1, organisation: 'Acme', title: 'Clerk', startMonth: '2019-04-01T00:00:00', endMonth: null, description: 'd' }],
    education: [{ educationId: 2, institution: 'MG University', course: 'B.Com', fieldOfStudy: 'Finance', startYear: 2012, endYear: 2015 }],
    skills: [
      { skillId: 3, skillName: 'Tally', level: 'Expert', evidenceUrl: 'https://youtube.com/watch?v=abc' },
      { skillId: 4, skillName: 'Typing', level: 'Beginner', evidenceUrl: 'javascript:alert(1)' },
    ],
    certificates: [{ certificateId: 5, title: 'Tally Prime', issuer: 'Institute', issuedOn: '2020-01-15T00:00:00', status: 'Uploaded', fileId: 9, fileName: 'c.pdf', sizeBytes: 2048 }],
    resume: { fileId: 8, fileName: 'cv.pdf', sizeBytes: 1048576, uploadedAt: '2026-10-13T10:00:00' },
    completeness: 90,
  });

  let api: any;
  let calls: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [JobProfileComponent],
      providers: [
        provideRouter([]),
        { provide: JobsService, useValue: api },
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
    calls = [];
    api = {
      getPage: () => { calls.push(['getPage']); return of({ success: true, message: '', data: page() }); },
      saveProfile: (p: any) => { calls.push(['saveProfile', p]); return ok(); },
      setVisible: (on: boolean) => { calls.push(['setVisible', on]); return ok(true, 'Employers can find your profile'); },
      saveExperience: (e: any) => { calls.push(['saveExperience', e]); return ok(1); },
      deleteExperience: (id: number) => { calls.push(['deleteExperience', id]); return ok(); },
      saveEducation: (e: any) => { calls.push(['saveEducation', e]); return ok(2); },
      deleteEducation: (id: number) => { calls.push(['deleteEducation', id]); return ok(); },
      saveSkill: (s: any) => { calls.push(['saveSkill', s]); return ok(3); },
      deleteSkill: (id: number) => { calls.push(['deleteSkill', id]); return ok(); },
      suggestSkills: (q: string) => { calls.push(['suggestSkills', q]); return of({ success: true, message: '', data: ['Tally', 'Tally Prime'] }); },
      saveCertificate: (c: any, file: any) => { calls.push(['saveCertificate', c, file]); return ok(5); },
      deleteCertificate: (id: number) => { calls.push(['deleteCertificate', id]); return ok(); },
      saveResume: (file: any) => { calls.push(['saveResume', file]); return ok(8); },
      deleteResume: () => { calls.push(['deleteResume']); return ok(); },
      downloadFile: (id: number) => { calls.push(['downloadFile', id]); return of(new Blob(['x'])); },
    };
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
    expect(t).toContain('Uploaded by you');
    expect(t).toContain('cv.pdf');
    expect(t).toContain('1.0 MB');
    expect(t).toContain('90%');
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

  it('refuses a skill link that is not https before it is sent', () => {
    const fixture = create();
    const c = fixture.componentInstance;

    c.openSkill();
    Object.assign(c.dialog()!.model, { skillName: 'Singing', level: 'Expert', evidenceUrl: 'http://youtube.com/x' });
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
});
