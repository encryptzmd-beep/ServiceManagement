import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { PlatformService } from '../../Services/platform-service';
import { PlatformAdminComponent } from './platform-admin-component';

describe('PlatformAdminComponent administrators', () => {
  const company = { companyId: 2, companyName: 'Hamster A/C', companyCode: 'C002', address: '', city: '', phoneNumber: '', isActive: true, projectCount: 1, userCount: 3 };
  const leo = { userId: 11, fullName: 'Leo Joseph', email: 'leo@example.com', individualId: 'EZ-7K4M-2P9Q-XD3Q', roleInCompany: 'Admin', isCreator: true, assignedAt: '2026-10-13T10:00:00' };
  const anu = { userId: 12, fullName: 'Anu Thomas', email: 'anu@example.com', individualId: '', roleInCompany: 'Technician', isCreator: false, assignedAt: '2026-10-13T11:00:00' };
  const roles = ['Admin', 'Technician', 'Storekeeper', 'Manager'];

  let api: any;
  let calls: any[][];
  let members: any[];

  const create = (isPlatformAdmin: boolean) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [
        { provide: PlatformService, useValue: api },
        { provide: AuthService, useValue: {
          currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin }),
          selectedCompanyId: () => 2,
        } },
      ],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    return fixture;
  };

  const open = (fixture: any) => {
    fixture.componentInstance.openAdministrators(company);
    fixture.detectChanges();
  };

  const text = (fixture: any) => (fixture.nativeElement.textContent as string).replace(/\s+/g, ' ');
  const rows = (fixture: any) => Array.from(fixture.nativeElement.querySelectorAll('.pa-member-row')) as HTMLElement[];

  beforeEach(() => {
    calls = [];
    members = [leo, anu];
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => of({ success: true, message: '', data: [company] }),
      getProjects: () => of({ success: true, message: '', data: [] }),
      getCompanyMembers: (companyId: number) => { calls.push(['getCompanyMembers', companyId]); return of({ success: true, message: '', data: { members: members.map(m => ({ ...m })), roles } }); },
      setCompanyMemberRole: (companyId: number, memberId: number, roleName: string) => {
        calls.push(['setCompanyMemberRole', companyId, memberId, roleName]);
        members = members.map(m => (m.userId === memberId ? { ...m, roleInCompany: roleName } : m));
        return of({ success: true, message: 'Made administrator of the company', data: true });
      },
      addCompanyMember: (companyId: number, lookup: string, roleName: string) => { calls.push(['addCompanyMember', companyId, lookup, roleName]); return of({ success: true, message: 'Ravi is now an administrator of the company', data: 13 }); },
      lock: () => {},
    };
  });

  it('offers Administrators on a company row to a platform administrator only', () => {
    const labels = (f: any) => (Array.from(f.nativeElement.querySelectorAll('button')) as HTMLElement[]).map(b => b.textContent?.trim());

    expect(labels(create(true))).toContain('Administrators');
    expect(labels(create(false))).not.toContain('Administrators');
  });

  it('does not open for a company administrator', () => {
    const fixture = create(false);
    open(fixture);

    expect(fixture.componentInstance.membersCompany()).toBeNull();
    expect(calls.length).toBe(0);
  });

  it('lists the members with role, Individual ID and who created the company', () => {
    const fixture = create(true);
    open(fixture);

    expect(calls).toContainEqual(['getCompanyMembers', 2]);
    expect(rows(fixture).length).toBe(2);
    expect(rows(fixture)[0].textContent).toContain('Leo Joseph');
    expect(rows(fixture)[0].textContent).toContain('EZ-7K4M-2P9Q-XD3Q');
    expect(rows(fixture)[0].textContent).toContain('Creator');
    expect(rows(fixture)[1].textContent).not.toContain('Creator');
    expect((rows(fixture)[0].querySelector('select') as HTMLSelectElement).value).toBe('Admin');
    expect((rows(fixture)[1].querySelector('select') as HTMLSelectElement).value).toBe('Technician');
    expect(Array.from(rows(fixture)[1].querySelectorAll('option')).map((o: any) => o.value)).toEqual(roles);
  });

  it('changes a role through the API and shows the new list', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.changeMemberRole(c.companyMembers()[1], 'Admin');
    fixture.detectChanges();

    expect(calls).toContainEqual(['setCompanyMemberRole', 2, 12, 'Admin']);
    expect(calls.filter(x => x[0] === 'getCompanyMembers').length).toBe(2);
    expect((rows(fixture)[1].querySelector('select') as HTMLSelectElement).value).toBe('Admin');
  });

  it('does nothing when the same role is picked again', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.changeMemberRole(c.companyMembers()[0], 'Admin');

    expect(calls.some(x => x[0] === 'setCompanyMemberRole')).toBe(false);
  });

  it('shows the refusal and puts the role back when the last administrator would be taken away', () => {
    api.setCompanyMemberRole = () => of({ success: false, message: 'A company needs at least one administrator. Make someone else administrator first', data: false });
    const fixture = create(true);
    open(fixture);
    const select = rows(fixture)[0].querySelector('select') as HTMLSelectElement;

    select.value = 'Manager';                      // what picking an option does before the handler runs
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(text(fixture)).toContain('A company needs at least one administrator');
    expect((rows(fixture)[0].querySelector('select') as HTMLSelectElement).value).toBe('Admin');
  });

  it('adds a person by e-mail or Individual ID with the chosen role, administrator by default', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    expect(c.newMember.roleName).toBe('Admin');
    c.newMember.lookup = '  EZ-9AAA-2BBB-3CCC ';
    c.addMember();

    expect(calls).toContainEqual(['addCompanyMember', 2, 'EZ-9AAA-2BBB-3CCC', 'Admin']);
    expect(c.newMember.lookup).toBe('');
    expect(calls.filter(x => x[0] === 'getCompanyMembers').length).toBe(2);
  });

  it('does not send an empty lookup, and shows what the API says about an unknown person', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.addMember();
    expect(c.memberError()).toBe('Enter the e-mail address or the Individual ID of the person');
    expect(calls.some(x => x[0] === 'addCompanyMember')).toBe(false);

    api.addCompanyMember = () => of({ success: false, message: 'Nobody is registered with this e-mail or Individual ID', data: 0 });
    c.newMember.lookup = 'nobody@example.com';
    c.addMember();
    fixture.detectChanges();

    expect(text(fixture)).toContain('Nobody is registered with this e-mail or Individual ID');
    expect(c.newMember.lookup).toBe('nobody@example.com');
  });

  it('ignores a second change while one is on the way', () => {
    const pending = new Subject<any>();
    let sent = 0;
    api.setCompanyMemberRole = () => { sent++; return pending; };
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.changeMemberRole(c.companyMembers()[1], 'Admin');
    c.changeMemberRole(c.companyMembers()[1], 'Manager');

    expect(sent).toBe(1);
  });

  it('closes with the other dialogs and forgets the list', () => {
    const fixture = create(true);
    open(fixture);
    const c = fixture.componentInstance;

    c.closeForms();

    expect(c.membersCompany()).toBeNull();
    expect(c.companyMembers()).toEqual([]);
  });
});
