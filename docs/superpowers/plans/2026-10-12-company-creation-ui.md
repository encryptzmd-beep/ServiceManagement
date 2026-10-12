# Company Creation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user creates a company from the company screen, watches its database being set up, retries a failed set-up, and a platform administrator manages the database servers and the platform settings from Platform Admin.

**Architecture:** The API exists (Plan 3a). The company step of the existing selector component gains a Create Company form, status badges, Retry and polling while a company is being set up; small pure helpers hold the rules so they are tested without a component. Platform Admin gains two tabs (Database Servers, Settings) and shows each company's database state.

**Tech Stack:** Angular 21 (standalone components, signals, `@if/@for`), RxJS, Vitest through `ng test`.

**Spec:** `docs/superpowers/specs/2026-10-11-saas-tenancy-design.md` (section 8 items 1, 2, 7; section 5.4; section 10)

**Plan series:** 1, 2, 2b, 3a done — **3b (this plan)** — 2c (customer portal without the project picker; removal of the "project" layer) — 4 (branch access)

## Global Constraints

- UI only. No file outside `encryptzUI/` changes, no `.sql` file, no C# file.
- The SQL Server and the API configured for this project are LIVE: never run `ng serve`, never start the API, never open `EncryptzAPI/appsettings.json`.
- Run UI commands from `D:\Encryptz\ServiceManagement\encryptzUI`: `npx ng test --watch=false --include "<glob>"` (5-minute timeout, never watch mode), `npx ng build`. Five old placeholder specs fail for reasons that predate this work (`app.spec.ts`, `add-user-component`, `customer-login-component`, `customer-register-component`, `landing-component`): leave them. Baseline: 128 tests pass, 5 fail.
- API contract (do not guess other names): `GET api/auth/company-creation` → `{ success, data: { canCreate, created, limit, message } }`; `POST api/auth/create-company` body `{ companyName, companyCode, address, city, phoneNumber, firstBranchName }` → `{ success, message, data: { companyId, provisionStatus } }`; `POST api/auth/companies/{companyId}/retry-provision` → `{ success, message, data }`; both POSTs can answer HTTP 429 with an empty body. `GET api/auth/user-companies` items carry `provisionStatus` (`None | Provisioning | Ready | Failed`) and `isCreator`. Platform (header `X-Platform-Token`, as the existing calls): `GET api/platform/db-servers`, `POST api/platform/db-servers/save`, `POST api/platform/db-servers/test`, `GET api/platform/settings`, `POST api/platform/settings/save` body `{ settingKey, settingValue }`; `GET api/platform/companies` items carry `provisionStatus, provisionError, databaseName` (the last two are empty for anyone who is not a platform administrator).
- A password is never shown, never pre-filled and never kept in a signal after the dialog closes. The server list shows only "password stored / missing".
- Text shown to users never contains a server name, a database name or an error detail, except in Platform Admin for a platform administrator.
- A company that is being set up or whose set-up failed cannot be entered from the company screen.
- Polling stops when nothing is being set up, when the screen is left, and after 25 minutes.
- Visible words: "Branch" (never "Location"), "Company database" (never "Project").
- Match the surrounding code style. Do not reformat files you touch; keep their line endings.

## Review Focus

1. A user double-clicks Create, or clicks Retry twice: only one request may go out, and the button shows it is busy. Pinned in Task 2.
2. The user leaves the company screen (selects another company, logs out) while polling: polling must stop and a late answer must not navigate or overwrite anything. Pinned in Task 2.
3. HTTP 429 on create or retry (empty body): the user sees "Too many attempts. Please try again later.", not a blank or a stack. Pinned in Task 1.
4. A company whose set-up failed and was created by someone else: no Retry button, a clear text instead. A company being set up: not enterable by click or keyboard. Pinned in Task 2.
5. A platform administrator edits a server without retyping the password: the request carries no password; the typed password of the previous dialog is gone when the dialog is opened again. Pinned in Task 3.

## File Structure

| File | Responsibility |
|---|---|
| `encryptzUI/src/app/Encryptz/Auth/company-creation.ts` (new) + `.spec.ts` | Pure rules: form validation, code suggestion, status label, polling decision, error text |
| `encryptzUI/src/app/Encryptz/Auth/auth-service.ts` | `getCompanyCreation`, `createCompany`, `retryProvision`; `Company.isCreator` |
| `encryptzUI/src/app/Encryptz/Auth/auth-service.creation.spec.ts` (new) | Tests of those calls |
| `encryptzUI/src/app/Encryptz/Services/company-service.ts` | Remove the dead `createCompany` |
| `encryptzUI/src/app/Encryptz/components/company-selector-component/*` | Create form, status, Retry, polling, empty state |
| `encryptzUI/src/app/Encryptz/components/login-component/login-component.ts` | Always go to the company screen after login |
| `encryptzUI/src/app/Encryptz/components/no-company-component/*` | "Back to companies" |
| `encryptzUI/src/app/Encryptz/Services/platform-service.ts` | Server and setting calls and types |
| `encryptzUI/src/app/Encryptz/components/platform-admin-component/*` | Database Servers tab, Settings tab, database state of companies |

---

### Task 1: Rules and API calls for creating a company

**Files:**
- Create: `encryptzUI/src/app/Encryptz/Auth/company-creation.ts`, `company-creation.spec.ts`
- Create: `encryptzUI/src/app/Encryptz/Auth/auth-service.creation.spec.ts`
- Modify: `encryptzUI/src/app/Encryptz/Auth/auth-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/Services/company-service.ts` (remove `createCompany`; check with grep that nothing calls it)

**Interfaces:**
- Produces (from `company-creation.ts`): `NewCompanyForm`, `CompanyCreationState`, `emptyCompanyForm()`, `suggestCompanyCode(name)`, `validateNewCompany(form)`, `anyProvisioning(companies)`, `provisionLabel(status)`, `canEnter(status)`, `requestErrorMessage(err, fallback)`, `POLL_MS = 5000`, `POLL_LIMIT_MS = 25 * 60 * 1000`.
- Produces (on `AuthService`): `getCompanyCreation(): Observable<ApiResponse<CompanyCreationState>>`, `createCompany(form: NewCompanyForm): Observable<ApiResponse<{ companyId: number; provisionStatus: string }>>`, `retryProvision(companyId: number): Observable<ApiResponse<boolean>>`; `Company.isCreator?: boolean`.

- [ ] **Step 1: Write the failing tests**

Create `company-creation.spec.ts`:

```ts
import {
  anyProvisioning, canEnter, emptyCompanyForm, provisionLabel, requestErrorMessage,
  suggestCompanyCode, validateNewCompany, POLL_LIMIT_MS, POLL_MS,
} from './company-creation';

describe('company creation rules', () => {
  const form = (over: Partial<ReturnType<typeof emptyCompanyForm>> = {}) =>
    ({ ...emptyCompanyForm(), companyName: 'Hamster A/C', companyCode: 'HAM1', ...over });

  it('starts with an empty form', () => {
    expect(emptyCompanyForm()).toEqual({ companyName: '', companyCode: '', firstBranchName: '', address: '', city: '', phoneNumber: '' });
  });

  it.each([
    ['Hamster A/C', 'HAMSTERA'],
    ['  felix fitness (demo) ', 'FELIXFIT'],
    ['A1', 'A1'],
    ['കമ്പനി', ''],
    ['A', ''],
    ['', ''],
  ])('suggests a code for %j', (name, code) => {
    expect(suggestCompanyCode(name)).toBe(code);
  });

  it('accepts a complete form', () => {
    expect(validateNewCompany(form())).toBe('');
    expect(validateNewCompany(form({ companyCode: ' ab-1_x ' }))).toBe('');
  });

  it.each(['', ' ', 'A'])('needs a company name of two characters or more (%j)', name => {
    expect(validateNewCompany(form({ companyName: name }))).toBe('Enter the company name');
  });

  it.each(['', 'A', 'AB CD', "AB'CD", '-ABCD', 'ÄBCD', 'ABCDEFGHIJKLMNOPQRSTU'])('refuses the company code %j', code => {
    expect(validateNewCompany(form({ companyCode: code })))
      .toBe('The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit');
  });

  it('refuses text that is longer than the server stores', () => {
    expect(validateNewCompany(form({ companyName: 'a'.repeat(201) }))).toBe('One of the values is too long');
    expect(validateNewCompany(form({ firstBranchName: 'b'.repeat(201) }))).toBe('One of the values is too long');
    expect(validateNewCompany(form({ address: 'c'.repeat(401) }))).toBe('One of the values is too long');
    expect(validateNewCompany(form({ city: 'd'.repeat(101) }))).toBe('One of the values is too long');
    expect(validateNewCompany(form({ phoneNumber: '1'.repeat(31) }))).toBe('One of the values is too long');
  });

  it('knows when something is still being set up', () => {
    expect(anyProvisioning([{ provisionStatus: 'Ready' }, { provisionStatus: 'Provisioning' }] as any)).toBe(true);
    expect(anyProvisioning([{ provisionStatus: 'Ready' }, { provisionStatus: 'Failed' }, {}] as any)).toBe(false);
    expect(anyProvisioning([])).toBe(false);
  });

  it.each([
    ['Provisioning', 'Setting up…'],
    ['Failed', 'Setup failed'],
    ['None', 'No database yet'],
    ['Ready', ''],
    [undefined, ''],
  ])('labels the status %j', (status, text) => {
    expect(provisionLabel(status as any)).toBe(text);
  });

  it('lets a user enter only a company that is not being set up and did not fail', () => {
    expect(canEnter('Ready')).toBe(true);
    expect(canEnter(undefined)).toBe(true);
    expect(canEnter('None')).toBe(true);   // an administrator attaches its database from Administration
    expect(canEnter('Provisioning')).toBe(false);
    expect(canEnter('Failed')).toBe(false);
  });

  it('explains a rate limit, a server message, and anything else', () => {
    expect(requestErrorMessage({ status: 429 }, 'x')).toBe('Too many attempts. Please try again later.');
    expect(requestErrorMessage({ status: 400, error: { message: 'This company code is already in use' } }, 'x'))
      .toBe('This company code is already in use');
    expect(requestErrorMessage({ status: 500, error: 'boom <html>' }, 'Could not create the company')).toBe('Could not create the company');
    expect(requestErrorMessage(undefined, 'Could not create the company')).toBe('Could not create the company');
  });

  it('polls every five seconds for at most 25 minutes', () => {
    expect(POLL_MS).toBe(5000);
    expect(POLL_LIMIT_MS).toBe(25 * 60 * 1000);
  });
});
```

Create `auth-service.creation.spec.ts` (look at the existing `auth-service.scope.spec.ts` in the same folder first and build the service the same way — same providers, same `HttpTestingController` set-up, same way of reading `apiUrl`):

```ts
// use the set-up of auth-service.scope.spec.ts (providers, HttpTestingController, afterEach verify)
describe('AuthService company creation', () => {
  // let service: AuthService; let http: HttpTestingController;  -- as in auth-service.scope.spec.ts

  it('asks whether the user may create a company', () => {
    let answer: any;
    service.getCompanyCreation().subscribe(res => (answer = res));

    const req = http.expectOne(r => r.url.endsWith('/api/auth/company-creation'));
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: '', data: { canCreate: true, created: 0, limit: 1, message: '' } });

    expect(answer.data.canCreate).toBe(true);
  });

  it('creates a company with trimmed values and an upper-case code, and never sends who creates it', () => {
    service.createCompany({ companyName: '  Hamster A/C ', companyCode: ' ham1 ', firstBranchName: ' Main ', address: '', city: ' Kochi ', phoneNumber: '' }).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/create-company'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ companyName: 'Hamster A/C', companyCode: 'HAM1', firstBranchName: 'Main', address: '', city: 'Kochi', phoneNumber: '' });
    req.flush({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } });
  });

  it('retries the set-up of one company', () => {
    service.retryProvision(9).subscribe();

    const req = http.expectOne(r => r.url.endsWith('/api/auth/companies/9/retry-provision'));
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, message: 'ok', data: true });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/company-creation.spec.ts" --include "src/app/Encryptz/Auth/auth-service.creation.spec.ts" 2>&1 | tail -20`
Expected: build errors (`./company-creation` not found; `getCompanyCreation` does not exist).

- [ ] **Step 3: Rules**

Create `company-creation.ts`:

```ts
/** What a user types to create a company. */
export interface NewCompanyForm {
  companyName: string;
  companyCode: string;
  firstBranchName: string;
  address: string;
  city: string;
  phoneNumber: string;
}

/** Whether the user may create a company now (GET auth/company-creation). */
export interface CompanyCreationState {
  canCreate: boolean;
  created: number;
  limit: number;
  /** Why not, when canCreate is false. */
  message: string;
}

/** How often the company list is asked again while a company is being set up. */
export const POLL_MS = 5000;
/** A set-up is given up by the server long before this; then the list says so. */
export const POLL_LIMIT_MS = 25 * 60 * 1000;

const CODE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;

export function emptyCompanyForm(): NewCompanyForm {
  return { companyName: '', companyCode: '', firstBranchName: '', address: '', city: '', phoneNumber: '' };
}

/** A code made from the plain letters and digits of the name ('' when there are fewer than two). */
export function suggestCompanyCode(name: string): string {
  const plain = (name ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return plain.length < 2 ? '' : plain.slice(0, 8);
}

/** '' when the form can be sent. The server checks again; the texts are the same. */
export function validateNewCompany(form: NewCompanyForm): string {
  if ((form.companyName ?? '').trim().length < 2) return 'Enter the company name';

  const code = (form.companyCode ?? '').trim();
  // only plain letters may become A-Z
  if (!/^[\x00-\x7F]*$/.test(code) || !CODE.test(code.toUpperCase()))
    return 'The company code must be 2 to 20 letters, digits, - or _ and start with a letter or digit';

  const tooLong = (value: string, max: number) => (value ?? '').trim().length > max;
  if (tooLong(form.companyName, 200) || tooLong(form.firstBranchName, 200) || tooLong(form.address, 400)
      || tooLong(form.city, 100) || tooLong(form.phoneNumber, 30))
    return 'One of the values is too long';

  return '';
}

export function anyProvisioning(companies: { provisionStatus?: string }[]): boolean {
  return (companies ?? []).some(c => c.provisionStatus === 'Provisioning');
}

/** Text of a company whose database is not ready ('' when it is). */
export function provisionLabel(status: string | undefined): string {
  switch (status) {
    case 'Provisioning': return 'Setting up…';
    case 'Failed': return 'Setup failed';
    case 'None': return 'No database yet';
    default: return '';
  }
}

/** A company that is being set up, or whose set-up failed, cannot be entered. */
export function canEnter(status: string | undefined): boolean {
  return status !== 'Provisioning' && status !== 'Failed';
}

/** What to tell the user when a create / retry request failed. */
export function requestErrorMessage(err: any, fallback: string): string {
  if (err?.status === 429) return 'Too many attempts. Please try again later.';
  const message = err?.error?.message;
  return typeof message === 'string' && message.trim() ? message : fallback;
}
```

- [ ] **Step 4: Service calls**

In `auth-service.ts`: add `isCreator?: boolean;` to the `Company` interface (comment: "The user created this company and may retry a failed set-up."), import `CompanyCreationState, NewCompanyForm` from `./company-creation`, and add next to `getUserCompanies`:

```ts
  /** Whether the user may create a company now, and why not. */
  getCompanyCreation(): Observable<ApiResponse<CompanyCreationState>> {
    return this.http.get<ApiResponse<CompanyCreationState>>(`${this.apiUrl}/company-creation`);
  }

  /** Who creates it comes from the token: nothing about the user is sent. */
  createCompany(form: NewCompanyForm): Observable<ApiResponse<{ companyId: number; provisionStatus: string }>> {
    const text = (value: string) => (value ?? '').trim();
    return this.http.post<ApiResponse<{ companyId: number; provisionStatus: string }>>(`${this.apiUrl}/create-company`, {
      companyName: text(form.companyName),
      companyCode: text(form.companyCode).toUpperCase(),
      firstBranchName: text(form.firstBranchName),
      address: text(form.address),
      city: text(form.city),
      phoneNumber: text(form.phoneNumber),
    });
  }

  retryProvision(companyId: number): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.apiUrl}/companies/${companyId}/retry-provision`, {});
  }
```

Use the same base URL field the neighbouring methods use (`this.apiUrl` in `getUserCompanies`). In `company-service.ts` delete the `createCompany` method and its comment after `grep -rn "createCompany" src/app --include=*.ts --include=*.html` shows no caller outside `auth-service` and the new specs.

- [ ] **Step 5: Run to verify it passes**

Run: `npx ng test --watch=false --include "src/app/Encryptz/Auth/**/*.spec.ts" 2>&1 | tail -15` — all pass.
Run: `npx ng build 2>&1 | tail -6` — no errors.

- [ ] **Step 6: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Auth encryptzUI/src/app/Encryptz/Services/company-service.ts
git commit -m "Add the rules and API calls for creating a company from the UI"
```

---

### Task 2: Create Company, status, Retry and polling on the company screen

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/components/company-selector-component/company-selector-component.ts`, `.html`, `.scss`, `.spec.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/login-component/login-component.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/no-company-component/no-company-component.ts`, `.html`

**Interfaces:**
- Consumes: everything Task 1 produces; existing `AuthService.getUserCompanies()`, `selectCompany()`, `companies()`.
- Produces on the component: `creation = signal<CompanyCreationState | null>(null)`, `showCreate = signal(false)`, `createForm: NewCompanyForm`, `createError = signal('')`, `creating = signal(false)`, `retrying = signal<number | null>(null)`, `polling = signal(false)`, `pollStopped = signal(false)`; methods `openCreate()`, `closeCreate()`, `onNameTyped()`, `onCodeTyped()`, `submitCreate()`, `retry(company, event?)`, `pollOnce()`, `openInvitations()`.

Behaviour of the company step:

1. The list is always read from the API when the step opens (statuses change on the server). While the answer is on its way, the list kept from login is shown. If the request fails and a kept list exists, the kept list stays and no error is shown; if nothing is kept, the existing error text is shown.
2. `getCompanyCreation()` is read together with the list. The **Create Company** button is under the list (and in the empty state). It is disabled when `creation()` is null or `canCreate` is false; when `canCreate` is false the reason (`creation().message`) is shown next to it.
3. The form replaces the list inside the same card (`showCreate`). Fields: Company name\*, Company code\*, First branch (placeholder "Head Office"), City, Phone, Address. Typing the name fills the code with `suggestCompanyCode` until the user types in the code field. Submit: `validateNewCompany` → `createCompany` → on success close the form, reload list and state, start polling. Errors are shown inside the form (`requestErrorMessage(err, 'Could not create the company')` for HTTP errors; `res.message` for a refusal). While the request runs the button is disabled and reads "Creating…"; a second submit does nothing.
4. A company row: `provisionLabel` badge as today. A row with `canEnter(status) === false` is not enterable (click and keyboard do nothing, `aria-disabled="true"`, class `disabled`, `tabindex="-1"`). A Failed row of a creator (`isCreator`) has a **Retry** button; a Failed row of someone else shows "Ask the person who created this company to retry." Retry: one request at a time per company (`retrying()` holds the company id; the button reads "Retrying…"), then reload and poll; an error or refusal is shown in `error()`.
5. Polling: while `anyProvisioning(companies())`, every `POLL_MS` the list (and the creation state) is read again, without the loading spinner. It stops when nothing is being set up, when the component is destroyed, when the user enters a company, and after `POLL_LIMIT_MS` (then `pollStopped` is true and the text "Still setting up. Come back in a few minutes." is shown with a **Refresh** button that calls `reload()`). A late answer after the component was destroyed changes nothing.
6. Empty state (no company): "You are not in a company yet." with the Create Company button (same rule as in 2) and a button **Invitations and join requests** that goes to `/no-company`. The old text "Please contact your administrator…" and the "Go to Login" button go away (logging out stays where the card already offers it).
7. After login the user always lands on `/select-company` (also with no company). The `/no-company` screen gets a **Back to companies** button that goes to `/select-company`.

- [ ] **Step 1: Write the failing tests**

In `company-selector-component.spec.ts`: the default `auth` stub of `beforeEach` must keep the existing tests meaningful now that the list is always read from the API: change `getUserCompanies: () => of([])` to return the same one-company list as `companies()`, and add to the stub `getCompanyCreation: () => of({ success: true, message: '', data: { canCreate: true, created: 0, limit: 1, message: '' } })`, `createCompany: (...)`, `retryProvision: (...)` as the new tests need. Do not change any existing assertion. If an existing test relied on `getUserCompanies` returning `[]` (the "after a reload" case), keep its own override.

Append this `describe` (it has its own stub so it does not depend on the first one):

```ts
describe('CompanySelectorComponent company creation', () => {
  const company = (id: number, status: string, isCreator = false) =>
    ({ companyId: id, companyName: 'Co ' + id, companyCode: 'C' + id, roleInCompany: 'Admin', isLinked: false, provisionStatus: status, isCreator });
  const state = (canCreate: boolean, message = '') => ({ success: true, message: '', data: { canCreate, created: canCreate ? 0 : 1, limit: 1, message } });

  let auth: any;
  let calls: any[][];
  let list: any[];
  let navigated: any[][];

  const create = () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { data: { stage: 'company' }, queryParamMap: { get: () => null } } } },
      ],
    });
    navigated = [];
    const router = TestBed.inject(Router);
    router.navigate = ((commands: any[], extras?: any) => { navigated.push(extras ? [commands, extras] : [commands]); return Promise.resolve(true); }) as any;
    const fixture = TestBed.createComponent(CompanySelectorComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => fixture.nativeElement.textContent as string;
  const button = (fixture: any, label: string) =>
    (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find(b => b.textContent?.trim().startsWith(label));

  beforeEach(() => {
    localStorage.clear();
    calls = [];
    list = [company(2, 'Ready')];
    auth = {
      userId: () => 5,
      userRole: () => 'Admin',
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin: false }),
      companies: () => [],
      selectedModuleKey: () => null,
      scopeState: () => ({ loggedIn: true, companyId: null, moduleKey: null, locationId: null }),
      getUserCompanies: () => { calls.push(['getUserCompanies']); return of(list); },
      getCompanyCreation: () => { calls.push(['getCompanyCreation']); return of(state(true)); },
      createCompany: (form: any) => { calls.push(['createCompany', form]); list = [...list, company(9, 'Provisioning', true)]; return of({ success: true, message: 'ok', data: { companyId: 9, provisionStatus: 'Provisioning' } }); },
      retryProvision: (id: number) => { calls.push(['retryProvision', id]); return of({ success: true, message: 'ok', data: true }); },
      selectCompany: (id: number) => { calls.push(['selectCompany', id]); return of({ success: true, message: '', data: { role: 'Admin' } }); },
      logout: () => {},
    };
  });

  it('reads the list and the creation state from the API when the step opens', () => {
    create();
    expect(calls).toContainEqual(['getUserCompanies']);
    expect(calls).toContainEqual(['getCompanyCreation']);
  });

  it('keeps the list from login when the API cannot be reached', () => {
    auth.companies = () => [company(2, 'Ready')];
    auth.getUserCompanies = () => throwError(() => new Error('offline'));
    const fixture = create();

    expect(fixture.nativeElement.querySelectorAll('.company-item').length).toBe(1);
    expect(fixture.componentInstance.error()).toBe('');
  });

  it('offers Create Company and opens the form', () => {
    const fixture = create();
    const btn = button(fixture, 'Create Company')!;
    expect(btn.disabled).toBe(false);

    btn.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.showCreate()).toBe(true);
    expect(fixture.nativeElement.querySelector('.create-form')).not.toBeNull();
  });

  it('disables Create Company with the reason when the limit is reached', () => {
    auth.getCompanyCreation = () => of(state(false, 'You can create 1 company. You have reached the limit.'));
    const fixture = create();

    expect(button(fixture, 'Create Company')!.disabled).toBe(true);
    expect(text(fixture)).toContain('You have reached the limit');
  });

  it('shows the empty state with Create Company and the way to invitations', () => {
    list = [];
    const fixture = create();

    expect(text(fixture)).toContain('You are not in a company yet');
    expect(button(fixture, 'Create Company')).toBeDefined();
    button(fixture, 'Invitations and join requests')!.click();
    expect(navigated).toContainEqual([['/no-company']]);
  });

  it('suggests the code from the name until the code is typed by hand', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();

    c.createForm.companyName = 'Hamster A/C';
    c.onNameTyped();
    expect(c.createForm.companyCode).toBe('HAMSTERA');

    c.createForm.companyCode = 'HAM';
    c.onCodeTyped();
    c.createForm.companyName = 'Hamster Cooling';
    c.onNameTyped();
    expect(c.createForm.companyCode).toBe('HAM');
  });

  it('does not send an incomplete form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'A';
    c.submitCreate();

    expect(c.createError()).toBe('Enter the company name');
    expect(calls.some(x => x[0] === 'createCompany')).toBe(false);
  });

  it('creates the company, closes the form, shows it as setting up and starts polling', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'createCompany').length).toBe(1);
    expect(c.showCreate()).toBe(false);
    expect(text(fixture)).toContain('Setting up…');
    expect(c.polling()).toBe(true);
  });

  it('sends only one request when Create is pressed twice', () => {
    const pending = new Subject<any>();
    auth.createCompany = (form: any) => { calls.push(['createCompany', form]); return pending; };
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    c.submitCreate();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'createCompany').length).toBe(1);
    expect(button(fixture, 'Creating')!.disabled).toBe(true);
  });

  it('shows why the server refused, inside the form', () => {
    auth.createCompany = () => of({ success: false, message: 'This company code is already in use', data: null });
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();
    fixture.detectChanges();

    expect(c.showCreate()).toBe(true);
    expect(text(fixture)).toContain('This company code is already in use');
  });

  it('explains a rate limit', () => {
    auth.createCompany = () => throwError(() => ({ status: 429 }));
    const fixture = create();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.companyName = 'New Co';
    c.createForm.companyCode = 'NEW1';
    c.submitCreate();

    expect(c.createError()).toBe('Too many attempts. Please try again later.');
  });

  it('does not let a company that is being set up or failed be entered', () => {
    list = [company(3, 'Provisioning', true), company(4, 'Failed', true)];
    const fixture = create();
    const rows = fixture.nativeElement.querySelectorAll('.company-item') as NodeListOf<HTMLElement>;

    rows[0].click();
    rows[1].click();
    rows[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(calls.some(x => x[0] === 'selectCompany')).toBe(false);
    expect(rows[0].getAttribute('aria-disabled')).toBe('true');
    expect(rows[0].getAttribute('tabindex')).toBe('-1');
  });

  it('still enters a ready company', () => {
    const fixture = create();
    (fixture.nativeElement.querySelector('.company-item') as HTMLElement).click();
    expect(calls).toContainEqual(['selectCompany', 2]);
  });

  it('offers Retry to the creator of a failed company only', () => {
    list = [company(4, 'Failed', true), company(5, 'Failed', false)];
    const fixture = create();
    const rows = fixture.nativeElement.querySelectorAll('.company-item') as NodeListOf<HTMLElement>;

    expect(rows[0].querySelector('.retry-btn')).not.toBeNull();
    expect(rows[1].querySelector('.retry-btn')).toBeNull();
    expect(rows[1].textContent).toContain('Ask the person who created this company to retry');
  });

  it('retries once, then reloads and polls', () => {
    list = [company(4, 'Failed', true)];
    const pending = new Subject<any>();
    auth.retryProvision = (id: number) => { calls.push(['retryProvision', id]); return pending; };
    const fixture = create();
    const c = fixture.componentInstance;

    c.retry(list[0]);
    c.retry(list[0]);
    expect(calls.filter(x => x[0] === 'retryProvision')).toEqual([['retryProvision', 4]]);

    list = [company(4, 'Provisioning', true)];
    const before = calls.filter(x => x[0] === 'getUserCompanies').length;
    pending.next({ success: true, message: 'ok', data: true });
    pending.complete();
    fixture.detectChanges();

    expect(calls.filter(x => x[0] === 'getUserCompanies').length).toBe(before + 1);
    expect(c.retrying()).toBeNull();
    expect(c.polling()).toBe(true);
  });

  it('shows why a retry was refused', () => {
    list = [company(4, 'Failed', true)];
    auth.retryProvision = () => of({ success: false, message: 'The earlier set-up is still being cleaned up. Try again in a few minutes.', data: false });
    const fixture = create();
    fixture.componentInstance.retry(list[0]);
    fixture.detectChanges();

    expect(text(fixture)).toContain('still being cleaned up');
  });

  it('stops polling when nothing is being set up any more', () => {
    list = [company(3, 'Provisioning', true)];
    const fixture = create();
    const c = fixture.componentInstance;
    expect(c.polling()).toBe(true);

    list = [company(3, 'Ready', true)];
    c.pollOnce();
    fixture.detectChanges();

    expect(c.polling()).toBe(false);
    expect(text(fixture)).not.toContain('Setting up…');
  });

  it('asks again on the timer while a company is being set up, and not after the screen is left', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const count = () => calls.filter(x => x[0] === 'getUserCompanies').length;
      const first = count();

      vi.advanceTimersByTime(5000);
      expect(count()).toBe(first + 1);

      fixture.destroy();
      vi.advanceTimersByTime(20000);
      expect(count()).toBe(first + 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores a late answer after the screen was left', () => {
    list = [company(3, 'Provisioning', true)];
    const late = new Subject<any[]>();
    const fixture = create();
    const c = fixture.componentInstance;
    auth.getUserCompanies = () => late;
    c.pollOnce();
    fixture.destroy();

    late.next([company(3, 'Ready', true)]);

    expect(c.companies()[0].provisionStatus).toBe('Provisioning');
  });

  it('gives up polling after the limit and offers Refresh', () => {
    vi.useFakeTimers();
    try {
      list = [company(3, 'Provisioning', true)];
      const fixture = create();
      const c = fixture.componentInstance;

      vi.advanceTimersByTime(25 * 60 * 1000 + 5000);
      fixture.detectChanges();

      expect(c.polling()).toBe(false);
      expect(c.pollStopped()).toBe(true);
      expect(text(fixture)).toContain('Still setting up. Come back in a few minutes.');
      expect(button(fixture, 'Refresh')).toBeDefined();
    } finally {
      vi.useRealTimers();
    }
  });
});
```

Add `Subject` to the rxjs import of the spec file.

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/Encryptz/components/company-selector-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: build errors (`showCreate`, `submitCreate`, `pollOnce` … do not exist).

- [ ] **Step 3: Component**

In `company-selector-component.ts`:

(a) Imports: add `DestroyRef` to the `@angular/core` import; `Subscription, interval` from `rxjs`; `takeUntilDestroyed` from `@angular/core/rxjs-interop`; from `'../../Auth/company-creation'`: `anyProvisioning, canEnter, CompanyCreationState, emptyCompanyForm, NewCompanyForm, POLL_LIMIT_MS, POLL_MS, provisionLabel, requestErrorMessage, suggestCompanyCode, validateNewCompany`.

(b) Members (after `entering`):

```ts
  private destroyRef = inject(DestroyRef);

  // ── creating a company ────────────────────────────────────────────
  /** Whether this user may create a company now (null = not known yet). */
  creation = signal<CompanyCreationState | null>(null);
  showCreate = signal(false);
  createForm: NewCompanyForm = emptyCompanyForm();
  createError = signal('');
  creating = signal(false);
  /** The code follows the name until the user types a code. */
  private codeTyped = false;
  /** Company whose set-up is being retried (null = none). */
  retrying = signal<number | null>(null);

  // ── watching a set-up ─────────────────────────────────────────────
  polling = signal(false);
  /** Polling ran out of time while a company was still being set up. */
  pollStopped = signal(false);
  private pollSub?: Subscription;
  private pollStarted = 0;
  private gone = false;
```

In the constructor or as a field initialiser register the clean-up once: `constructor() { this.destroyRef.onDestroy(() => { this.gone = true; this.stopPolling(); }); }` (the class has no constructor today: add one).

(c) Replace `loadCompanies()` and `companyStatus()` and extend `selectCompany()`:

```ts
  loadCompanies() {
    // what login kept is shown at once; the API has the current statuses
    let kept = this.auth.companies();
    if (kept.length === 0) {
      try {
        const temp = localStorage.getItem('temp_login');
        if (temp) kept = JSON.parse(temp).companies || [];
      } catch { kept = []; }
    }

    this.companies.set(kept);
    this.loading.set(kept.length === 0);
    this.refreshCompanies(() => {
      if (kept.length === 0) this.error.set('Could not load your companies. Please try again.');
    });
  }

  /** Reads the list and the creation state again, without the spinner. */
  private refreshCompanies(onError?: () => void): void {
    this.auth.getUserCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (list) => {
        if (this.gone) return;
        this.loading.set(false);
        this.companies.set(list);
        this.watchSetUps();
      },
      error: () => {
        if (this.gone) return;
        this.loading.set(false);
        onError?.();
      }
    });

    this.auth.getCompanyCreation().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => { if (!this.gone) this.creation.set(res.success ? res.data ?? null : null); },
      error: () => { if (!this.gone) this.creation.set(null); }
    });
  }

  selectCompany(company: Company) {
    if (!canEnter(company.provisionStatus)) return;
    this.stopPolling();
    // … the existing body of selectCompany follows unchanged …
  }

  /** Text of a company whose database is not ready ('' when it is). */
  companyStatus(company: Company): string {
    return provisionLabel(company.provisionStatus);
  }

  enterable(company: Company): boolean {
    return canEnter(company.provisionStatus);
  }
```

(Keep the existing body of `selectCompany` after the two new first lines.)

(d) Add this block after the company step:

```ts
  // ── creating a company ────────────────────────────────────────────

  openCreate(): void {
    if (!this.creation()?.canCreate) return;
    this.createForm = emptyCompanyForm();
    this.codeTyped = false;
    this.createError.set('');
    this.showCreate.set(true);
  }

  closeCreate(): void {
    this.showCreate.set(false);
    this.createError.set('');
  }

  onNameTyped(): void {
    if (!this.codeTyped) this.createForm.companyCode = suggestCompanyCode(this.createForm.companyName);
  }

  onCodeTyped(): void {
    this.codeTyped = true;
  }

  submitCreate(): void {
    if (this.creating()) return;

    const problem = validateNewCompany(this.createForm);
    if (problem) { this.createError.set(problem); return; }

    this.createError.set('');
    this.creating.set(true);
    this.auth.createCompany(this.createForm).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.creating.set(false);
        if (!res.success) { this.createError.set(res.message || 'Could not create the company'); return; }
        this.showCreate.set(false);
        this.error.set('');
        this.refreshCompanies();
      },
      error: (err) => {
        this.creating.set(false);
        this.createError.set(requestErrorMessage(err, 'Could not create the company'));
      }
    });
  }

  /** Retry of a failed set-up: by the user who created the company. */
  retry(company: Company, event?: Event): void {
    event?.stopPropagation();
    if (this.retrying() !== null) return;

    this.error.set('');
    this.retrying.set(company.companyId);
    this.auth.retryProvision(company.companyId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => {
        this.retrying.set(null);
        if (!res.success) { this.error.set(res.message || 'Could not retry the set-up'); return; }
        this.refreshCompanies();
      },
      error: (err) => {
        this.retrying.set(null);
        this.error.set(requestErrorMessage(err, 'Could not retry the set-up'));
      }
    });
  }

  openInvitations(): void {
    this.router.navigate(['/no-company']);
  }

  // ── watching a set-up ─────────────────────────────────────────────

  /** Starts or stops asking again, depending on whether a company is being set up. */
  private watchSetUps(): void {
    if (!anyProvisioning(this.companies())) { this.stopPolling(); return; }
    if (this.pollSub) return;

    this.pollStopped.set(false);
    this.pollStarted = Date.now();
    this.polling.set(true);
    this.pollSub = interval(POLL_MS).subscribe(() => {
      if (Date.now() - this.pollStarted >= POLL_LIMIT_MS) {
        this.stopPolling();
        this.pollStopped.set(true);
        return;
      }
      this.pollOnce();
    });
  }

  /** One round of asking again (also called by the timer). */
  pollOnce(): void {
    if (this.gone) return;
    this.refreshCompanies();
  }

  private stopPolling(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
    this.polling.set(false);
  }
```

`reload()` (the existing Retry-of-loading button) for the company stage must also clear `pollStopped`: add `this.pollStopped.set(false);` at its start.

Note on the error condition of the existing template: the company list is rendered with `!loading() && stage() === 'company' && companies().length > 0`; keep it rendering when `error()` holds a retry refusal (the error text is shown where the card already shows `error()`).

- [ ] **Step 4: Template and styles**

In `company-selector-component.html`, company step only (leave the module and branch steps alone):

(a) Replace the empty-state block of the company step with:

```html
        @if (!loading() && !error() && stage() === 'company' && companies().length === 0 && !showCreate()) {
          <div class="empty-state">
            <span class="material-icons">business</span>
            <p>You are not in a company yet.</p>
            <p class="small">Create your own company, or join one you were invited to.</p>
            <button class="btn-signin create-company-btn" (click)="openCreate()" [disabled]="!creation()?.canCreate">Create Company</button>
            @if (creation() && !creation()!.canCreate) {
              <p class="small create-reason">{{ creation()!.message }}</p>
            }
            <button class="link-back" (click)="openInvitations()">
              <span class="material-icons">mail</span> Invitations and join requests
            </button>
          </div>
        }
```

(b) Replace the company list block with (the row keeps its classes; the new parts are the disabled state, the failed texts and the footer):

```html
        @if (!loading() && stage() === 'company' && companies().length > 0 && !showCreate()) {
          <div class="company-list">
            @for (company of companies(); track company.companyId) {
              <div class="company-item" [class.disabled]="!enterable(company)"
                   [attr.aria-disabled]="!enterable(company)" (click)="selectCompany(company)"
                   role="button" [attr.tabindex]="enterable(company) ? 0 : -1"
                   (keydown.enter)="selectCompany(company)" (keydown.space)="selectCompany(company); $event.preventDefault()">
                <div class="company-avatar">
                  <span class="material-icons">apartment</span>
                </div>
                <div class="company-info">
                  <h3>{{ company.companyName }}</h3>
                  <p class="company-code">{{ company.companyCode }}</p>
                  <span class="role-badge" [class]="getRoleClass(company.roleInCompany)">
                    {{ company.roleInCompany }}
                  </span>
                  @if (companyStatus(company)) {
                    <span class="status-badge">{{ companyStatus(company) }}</span>
                  }
                  @if (company.provisionStatus === 'Failed') {
                    @if (company.isCreator) {
                      <button class="retry-btn" (click)="retry(company, $event)" [disabled]="retrying() !== null">
                        {{ retrying() === company.companyId ? 'Retrying…' : 'Retry' }}
                      </button>
                    } @else {
                      <p class="small">Ask the person who created this company to retry.</p>
                    }
                  }
                </div>
                @if (enterable(company)) {
                  <span class="material-icons arrow">chevron_right</span>
                } @else if (company.provisionStatus === 'Provisioning') {
                  <span class="material-icons arrow">hourglass_top</span>
                } @else {
                  <span class="material-icons arrow">error_outline</span>
                }
              </div>
            }
          </div>

          @if (pollStopped()) {
            <div class="scope-step">
              <p class="small">Still setting up. Come back in a few minutes.</p>
              <button class="link-back" (click)="reload()">Refresh</button>
            </div>
          }

          <div class="scope-step">
            <button class="btn-signin create-company-btn" (click)="openCreate()" [disabled]="!creation()?.canCreate">Create Company</button>
            @if (creation() && !creation()!.canCreate) {
              <p class="small create-reason">{{ creation()!.message }}</p>
            }
          </div>
        }
```

(c) Add the form directly after it:

```html
        <!-- STEP 1b: CREATE A COMPANY -->
        @if (stage() === 'company' && showCreate()) {
          <form class="create-form" (ngSubmit)="submitCreate()">
            <label>Company name *
              <input class="form-input" name="companyName" [(ngModel)]="createForm.companyName" (ngModelChange)="onNameTyped()" maxlength="200" autocomplete="organization" />
            </label>
            <label>Company code *
              <input class="form-input" name="companyCode" [(ngModel)]="createForm.companyCode" (input)="onCodeTyped()" maxlength="20" placeholder="e.g. ACME" />
              <small>Your customers type this code to reach your portal. Letters, digits, - and _.</small>
            </label>
            <label>First branch
              <input class="form-input" name="firstBranchName" [(ngModel)]="createForm.firstBranchName" maxlength="200" placeholder="Head Office" />
            </label>
            <label>City
              <input class="form-input" name="city" [(ngModel)]="createForm.city" maxlength="100" />
            </label>
            <label>Phone
              <input class="form-input" name="phoneNumber" [(ngModel)]="createForm.phoneNumber" maxlength="30" />
            </label>
            <label>Address
              <input class="form-input" name="address" [(ngModel)]="createForm.address" maxlength="400" />
            </label>

            @if (createError()) { <div class="error-msg">{{ createError() }}</div> }

            <button class="btn-signin" type="submit" [disabled]="creating()">{{ creating() ? 'Creating…' : 'Create Company' }}</button>
            <button class="link-back" type="button" (click)="closeCreate()" [disabled]="creating()">
              <span class="material-icons">chevron_left</span> Back to companies
            </button>
            <p class="small">Setting up a new company takes a few minutes. You can stay on the next screen or come back later.</p>
          </form>
        }
```

Before writing, read how the card shows `error()` and the change-password form's inputs in this file, and reuse their classes (`error-msg` and the input class that form uses) so the new form looks like the rest of the card; keep the class names the tests query: `company-item`, `create-form`, `retry-btn`, `create-company-btn`.

(d) Append to `company-selector-component.scss`:

```scss
/* a company that cannot be entered yet (being set up / set-up failed) */
.company-item.disabled { cursor: default; opacity: 0.75; }
.company-item .retry-btn {
  margin-top: 6px;
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid currentColor;
  background: transparent;
  cursor: pointer;
}
.company-item .retry-btn[disabled] { cursor: not-allowed; opacity: 0.6; }

/* create a company */
.create-form { display: flex; flex-direction: column; gap: 10px; }
.create-form label { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.create-form small { opacity: 0.7; }
.create-reason { margin-top: 6px; }
```

- [ ] **Step 5: Login and the invitations screen**

In `login-component.ts` the three places that choose between `/no-company` and `/select-company` (around lines 62-72, 138-146 and 150) all navigate to `/select-company` now; remove the branching and keep the comment "The company list is always shown … it is where a user creates or joins a company".

In `no-company-component.ts` add `backToCompanies(): void { this.router.navigate(['/select-company']); }` and in its template, next to the existing logout / change-password controls of the card, a button `<button class="link-back" (click)="backToCompanies()"><span class="material-icons">chevron_left</span> Back to companies</button>` (use the button class this template already uses for secondary actions).

- [ ] **Step 6: Run to verify it passes**

```bash
npx ng test --watch=false --include "src/app/Encryptz/components/company-selector-component/**/*.spec.ts" 2>&1 | tail -25
npx ng build 2>&1 | tail -6
npx ng test --watch=false 2>&1 | grep -E "Test Files|Tests |FAIL" | sort -u
```

Expected: the selector spec passes (its earlier tests plus every new one); the build has no errors; the whole suite fails only in the 5 old placeholder specs. If a login-component or route spec asserted the `/no-company` redirect after login, update that assertion to `/select-company` and say so.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/components/company-selector-component encryptzUI/src/app/Encryptz/components/login-component encryptzUI/src/app/Encryptz/components/no-company-component
git commit -m "Create a company from the company screen and follow its set-up"
```

---

### Task 3: Database servers, settings and database state in Platform Admin

**Files:**
- Modify: `encryptzUI/src/app/Encryptz/Services/platform-service.ts`
- Modify: `encryptzUI/src/app/Encryptz/components/platform-admin-component/platform-admin-component.ts`, `.html`, `.scss`, `.spec.ts`

**Interfaces:**
- Consumes: `AuthService.retryProvision` (Task 1); the platform endpoints of the Global Constraints; the component's existing members (`tab`, `setTab`, `isPlatformAdmin`, `formError`, `saving`, `testing`, `testResult`, `notify`, `message`, `isLocked`, `fail`, `closeForms`, `relock`, `loadCompanies`).
- Produces in `platform-service.ts`: `interface DbServer { dbServerId: number; serverName: string; adminUser: string; extraOptions: string; isDefault: boolean; isActive: boolean; createdAt?: string; hasPassword: boolean; companyCount: number; }`, `interface DbServerForm { dbServerId: number; serverName: string; adminUser: string; adminPassword: string; extraOptions: string; isDefault: boolean; isActive: boolean; }`, `interface PlatformSetting { settingKey: string; settingValue: string; updatedAt?: string; updatedByName: string; }`; `PlatformCompany` gains `provisionStatus?: string; provisionError?: string; databaseName?: string;`; methods `getDbServers()`, `saveDbServer(form)`, `testDbServer(form)`, `getSettings()`, `saveSetting(settingKey, settingValue)`.
- Produces on the component: tab ids `'servers'` and `'settings'`; `servers = signal<DbServer[]>([])`, `settings = signal<PlatformSetting[]>([])`, `serverForm: DbServerForm | null`, `settingDraft: Record<string, string>`, `newServer()`, `editServer(s)`, `saveServer()`, `testServer()`, `saveSetting(key)`, `retryCompany(c)`, `companyDatabase(c)`.

Behaviour:

1. Tabs "Database Servers" and "Settings" exist only for a platform administrator (not rendered otherwise; `setTab('servers')` by a non-platform user does nothing).
2. Database Servers: table (Server, Login, Options, Default, Status, Companies, Password, action). Password column: "Stored" or "Missing", never a value. "+ New Server" and "Edit" open a dialog: Server\*, Login\*, Password (\* for a new server; on an edit the placeholder is "leave empty to keep the current one" and the field starts EMPTY every time the dialog opens), Options, "Default for new companies", "Active". "Test connection" calls `testDbServer` with what is typed and shows the answer's message (`pa-test` box, `ok` when `connected && schemaReady`, `warn` when connected only, `bad` otherwise). Save sends `adminPassword` as typed (empty string on an edit without retyping). After a save the dialog closes, the form object is dropped (so the password is gone) and the list reloads. A note in the dialog: "This login creates each new company's database and is then used to connect to it. It needs the dbcreator role. Options may not set the server, database, login or password."
3. Settings: one row per setting the API returns, with a label and help text per key — `MaxCompaniesPerUser`: "Companies a user may create" / "0 switches company creation off for everyone but platform administrators."; `TenantLookupSourceDb`: "Lookup source database" / "Leave empty (recommended): new companies start with the built-in defaults. Never name a live company's database: its print header and running numbers would be copied." — an input and a Save button per row; a refusal of the server is shown next to the row; unknown keys are listed read-only.
4. Companies tab: a "Database" column: status text (`Ready`, `Setting up…`, `Setup failed`, `No database`) and, for a platform administrator, the database name under it and the failure reason under a failed one. A failed company without a database name gets a **Retry** button (calls `AuthService.retryProvision`, one at a time, then reloads the companies; the server's refusal is shown in the toast). 429 → "Too many attempts. Please try again later."
5. The wording rule of the existing test still holds: the Module Access tab shows neither "Project" nor "Location".

- [ ] **Step 1: Write the failing tests**

Append a new `describe` to `platform-admin-component.spec.ts` (read the file's existing set-up first and reuse its style; the `AuthService` stub needs `retryProvision`):

```ts
describe('PlatformAdminComponent servers, settings and database state', () => {
  const server = (id: number, over: any = {}) => ({ dbServerId: id, serverName: 'sql-' + id, adminUser: 'creator', extraOptions: '', isDefault: id === 1, isActive: true, hasPassword: true, companyCount: 2, ...over });
  const companyRow = (id: number, over: any = {}) => ({ companyId: id, companyName: 'Co ' + id, companyCode: 'C' + id, address: '', city: '', phoneNumber: '', isActive: true, projectCount: 1, userCount: 1, provisionStatus: 'Ready', provisionError: '', databaseName: '', ...over });

  let api: any;
  let auth: any;
  let calls: any[][];

  const create = (isPlatformAdmin = true) => {
    TestBed.resetTestingModule();
    auth = {
      currentUser: () => ({ userId: 5, fullName: 'A', role: 'Admin', isPlatformAdmin }),
      selectedCompanyId: () => 2,
      retryProvision: (id: number) => { calls.push(['retryProvision', id]); return of({ success: true, message: 'The database is being set up.', data: true }); },
      ...auth,
    };
    TestBed.configureTestingModule({
      imports: [PlatformAdminComponent],
      providers: [{ provide: PlatformService, useValue: api }, { provide: AuthService, useValue: auth }],
    });
    const fixture = TestBed.createComponent(PlatformAdminComponent);
    fixture.detectChanges();
    return fixture;
  };

  const text = (fixture: any) => fixture.nativeElement.textContent as string;
  const tabs = (fixture: any) => (Array.from(fixture.nativeElement.querySelectorAll('.pa-tabs button')) as HTMLButtonElement[]).map(b => b.textContent?.trim());

  beforeEach(() => {
    calls = [];
    auth = {};
    api = {
      isUnlocked: () => of({ success: true, unlocked: true }),
      getCompanies: () => { calls.push(['getCompanies']); return of({ success: true, message: '', data: [companyRow(2)] }); },
      getProjects: () => of({ success: true, message: '', data: [] }),
      getDbServers: () => { calls.push(['getDbServers']); return of({ success: true, message: '', data: [server(1), server(2, { hasPassword: false, isActive: false })] }); },
      saveDbServer: (form: any) => { calls.push(['saveDbServer', { ...form }]); return of({ success: true, message: 'Server saved', data: 3 }); },
      testDbServer: (form: any) => { calls.push(['testDbServer', { ...form }]); return of({ success: true, message: 'Connected. This login can create databases', data: { connected: true, schemaReady: true, locationCount: 0, message: 'Connected. This login can create databases' } }); },
      getSettings: () => { calls.push(['getSettings']); return of({ success: true, message: '', data: [
        { settingKey: 'MaxCompaniesPerUser', settingValue: '1', updatedByName: '' },
        { settingKey: 'TenantLookupSourceDb', settingValue: '', updatedByName: '' },
      ] }); },
      saveSetting: (key: string, value: string) => { calls.push(['saveSetting', key, value]); return of({ success: true, message: 'Setting saved', data: true }); },
      lock: () => {},
    };
  });

  it('shows the two tabs to a platform administrator only', () => {
    expect(tabs(create(true))).toEqual(expect.arrayContaining(['Database Servers', 'Settings']));

    const other = create(false);
    expect(tabs(other)).not.toContain('Database Servers');
    expect(tabs(other)).not.toContain('Settings');
    other.componentInstance.setTab('servers' as any);
    expect(calls.some(c => c[0] === 'getDbServers')).toBe(false);
  });

  it('lists the servers without any password', () => {
    const fixture = create();
    fixture.componentInstance.setTab('servers' as any);
    fixture.detectChanges();

    expect(calls).toContainEqual(['getDbServers']);
    expect(text(fixture)).toContain('sql-1');
    expect(text(fixture)).toContain('Stored');
    expect(text(fixture)).toContain('Missing');
    expect(fixture.nativeElement.querySelectorAll('input[type=password]').length).toBe(0);
  });

  it('opens an edit with an empty password every time', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);

    c.editServer(server(1) as any);
    c.serverForm!.adminPassword = 'typed-secret';
    c.closeForms();
    expect(c.serverForm).toBeNull();

    c.editServer(server(1) as any);
    expect(c.serverForm!.adminPassword).toBe('');
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('input[type=password]') as HTMLInputElement;
    expect(box.value).toBe('');
    expect(box.placeholder).toContain('leave empty to keep');
  });

  it('saves an edit without a password when none was typed, then forgets the form', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.editServer(server(1) as any);
    c.serverForm!.extraOptions = 'Encrypt=True';
    c.saveServer();

    const sent = calls.find(x => x[0] === 'saveDbServer')![1];
    expect(sent.adminPassword).toBe('');
    expect(sent.extraOptions).toBe('Encrypt=True');
    expect(c.serverForm).toBeNull();
    expect(calls.filter(x => x[0] === 'getDbServers').length).toBe(2);
  });

  it('needs server, login and, for a new server, the password', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.newServer();
    c.serverForm!.serverName = 'sql-9';
    c.serverForm!.adminUser = 'creator';
    c.saveServer();

    expect(c.formError()).toBe('Enter the password');
    expect(calls.some(x => x[0] === 'saveDbServer')).toBe(false);
  });

  it('shows why the server refused a save and keeps the dialog', () => {
    api.saveDbServer = () => of({ success: false, message: 'The options must not set the server, database, login or password', data: 0 });
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.editServer(server(1) as any);
    c.saveServer();
    fixture.detectChanges();

    expect(c.serverForm).not.toBeNull();
    expect(text(fixture)).toContain('The options must not set the server');
  });

  it('tests the connection with what is typed and shows the answer', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('servers' as any);
    c.newServer();
    c.serverForm!.serverName = 'sql-9';
    c.serverForm!.adminUser = 'creator';
    c.serverForm!.adminPassword = 'pw';
    c.testServer();
    fixture.detectChanges();

    expect(calls.find(x => x[0] === 'testDbServer')![1].serverName).toBe('sql-9');
    expect(text(fixture)).toContain('This login can create databases');
  });

  it('lists the settings with their help and saves one', () => {
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('settings' as any);
    fixture.detectChanges();

    expect(text(fixture)).toContain('Companies a user may create');
    expect(text(fixture)).toContain('Never name a live company');

    c.settingDraft['MaxCompaniesPerUser'] = '3';
    c.saveSetting('MaxCompaniesPerUser');
    expect(calls).toContainEqual(['saveSetting', 'MaxCompaniesPerUser', '3']);
  });

  it('shows a refused setting next to its row and keeps what was typed', () => {
    api.saveSetting = () => of({ success: false, message: 'Enter a number from 0 to 100', data: false });
    const fixture = create();
    const c = fixture.componentInstance;
    c.setTab('settings' as any);
    c.settingDraft['MaxCompaniesPerUser'] = 'many';
    c.saveSetting('MaxCompaniesPerUser');
    fixture.detectChanges();

    expect(text(fixture)).toContain('Enter a number from 0 to 100');
    expect(c.settingDraft['MaxCompaniesPerUser']).toBe('many');
  });

  it('shows the database state of each company, with the reason for a platform administrator', () => {
    api.getCompanies = () => of({ success: true, message: '', data: [
      companyRow(2, { databaseName: 'EncryptzTenant_000002' }),
      companyRow(3, { provisionStatus: 'Provisioning' }),
      companyRow(4, { provisionStatus: 'Failed', provisionError: 'Tenant script batch 12 of 1468 failed' }),
      companyRow(5, { provisionStatus: 'None' }),
    ] });
    const fixture = create();

    expect(text(fixture)).toContain('EncryptzTenant_000002');
    expect(text(fixture)).toContain('Setting up…');
    expect(text(fixture)).toContain('Setup failed');
    expect(text(fixture)).toContain('Tenant script batch 12 of 1468 failed');
    expect(text(fixture)).toContain('No database');
  });

  it('retries a failed set-up once and reloads the companies', () => {
    const pending = new Subject<any>();
    auth = { retryProvision: (id: number) => { calls.push(['retryProvision', id]); return pending; } };
    api.getCompanies = () => { calls.push(['getCompanies']); return of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed' })] }); };
    const fixture = create();
    const c = fixture.componentInstance;
    const row = c.companies()[0];

    c.retryCompany(row);
    c.retryCompany(row);
    expect(calls.filter(x => x[0] === 'retryProvision')).toEqual([['retryProvision', 4]]);

    const before = calls.filter(x => x[0] === 'getCompanies').length;
    pending.next({ success: true, message: 'The database is being set up.', data: true });
    pending.complete();
    expect(calls.filter(x => x[0] === 'getCompanies').length).toBe(before + 1);
  });

  it('explains a rate limit on retry', () => {
    auth = { retryProvision: () => throwError(() => ({ status: 429 })) };
    api.getCompanies = () => of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed' })] });
    const fixture = create();
    fixture.componentInstance.retryCompany(fixture.componentInstance.companies()[0]);
    fixture.detectChanges();

    expect(text(fixture)).toContain('Too many attempts. Please try again later.');
  });

  it('offers no Retry for a failed company that has a database', () => {
    api.getCompanies = () => of({ success: true, message: '', data: [companyRow(4, { provisionStatus: 'Failed', databaseName: 'HandAttachedDb' })] });
    const fixture = create();
    const buttons = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).map(b => b.textContent?.trim());

    expect(buttons).not.toContain('Retry');
  });
});
```

Add `Subject, throwError` to the rxjs import of the spec if they are not there.

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25`
Expected: build errors (`serverForm`, `saveServer`, `settingDraft`, `retryCompany` … do not exist).

- [ ] **Step 3: Service**

In `platform-service.ts` add the three interfaces of the Interfaces block after `CompanyModule`, the three optional fields to `PlatformCompany`, and after `setModuleAccess`:

```ts
  // ── database servers + platform settings (platform administrators) ────────

  getDbServers(): Observable<ApiResponse<DbServer[]>> {
    return this.http.get<ApiResponse<DbServer[]>>(`${this.api}/db-servers`, { headers: this.headers });
  }

  /** An empty adminPassword on an edit keeps the stored one. */
  saveDbServer(form: DbServerForm): Observable<ApiResponse<number>> {
    return this.http.post<ApiResponse<number>>(`${this.api}/db-servers/save`, form, { headers: this.headers });
  }

  testDbServer(form: DbServerForm): Observable<ApiResponse<ConnectionTestResult>> {
    return this.http.post<ApiResponse<ConnectionTestResult>>(`${this.api}/db-servers/test`, form, { headers: this.headers });
  }

  getSettings(): Observable<ApiResponse<PlatformSetting[]>> {
    return this.http.get<ApiResponse<PlatformSetting[]>>(`${this.api}/settings`, { headers: this.headers });
  }

  saveSetting(settingKey: string, settingValue: string): Observable<ApiResponse<boolean>> {
    return this.http.post<ApiResponse<boolean>>(`${this.api}/settings/save`, { settingKey, settingValue }, { headers: this.headers });
  }
```

- [ ] **Step 4: Component**

In `platform-admin-component.ts` (read it fully first; follow how the menus tab loads its data and how the project dialog saves and tests):

(a) `Tab` type gains `'servers' | 'settings'`. Imports: `DbServer, DbServerForm, PlatformSetting` from the service; `requestErrorMessage, provisionLabel` from `'../../Auth/company-creation'`.

(b) Members:

```ts
  servers = signal<DbServer[]>([]);
  settings = signal<PlatformSetting[]>([]);
  /** Server dialog (null = closed). Dropped on close so a typed password does not stay in memory. */
  serverForm: DbServerForm | null = null;
  /** What is typed per setting key. */
  settingDraft: Record<string, string> = {};
  settingError = signal<Record<string, string>>({});
  /** Company whose set-up is being retried (null = none). */
  retryingCompany = signal<number | null>(null);

  readonly settingHelp: Record<string, { label: string; help: string }> = {
    MaxCompaniesPerUser: {
      label: 'Companies a user may create',
      help: '0 switches company creation off for everyone but platform administrators.',
    },
    TenantLookupSourceDb: {
      label: 'Lookup source database',
      help: 'Leave empty (recommended): new companies start with the built-in defaults. Never name a live company\'s database: its print header and running numbers would be copied.',
    },
  };
```

(c) In `setTab`: at its start `if ((tab === 'servers' || tab === 'settings') && !this.isPlatformAdmin()) return;`, and after `this.tab.set(tab)`: `if (tab === 'servers') this.loadServers(); if (tab === 'settings') this.loadSettings();`.

(d) Methods (place them before the menu section):

```ts
  // ── database servers ──────────────────────────────────────────────────────

  loadServers(): void {
    this.api.getDbServers().subscribe({
      next: res => { if (res.success) this.servers.set(res.data ?? []); else this.notify(res.message, false); },
      error: err => this.fail(err, 'Could not load the database servers'),
    });
  }

  newServer(): void {
    this.formError.set('');
    this.testResult.set(null);
    this.serverForm = { dbServerId: 0, serverName: '', adminUser: '', adminPassword: '', extraOptions: '', isDefault: this.servers().length === 0, isActive: true };
  }

  editServer(server: DbServer): void {
    this.formError.set('');
    this.testResult.set(null);
    // the password is never known here: the field starts empty each time
    this.serverForm = {
      dbServerId: server.dbServerId, serverName: server.serverName, adminUser: server.adminUser,
      adminPassword: '', extraOptions: server.extraOptions ?? '', isDefault: server.isDefault, isActive: server.isActive,
    };
  }

  private serverProblem(form: DbServerForm): string {
    if (!form.serverName.trim() || !form.adminUser.trim()) return 'Server and login are required';
    if (!form.dbServerId && !form.adminPassword) return 'Enter the password';
    return '';
  }

  saveServer(): void {
    const form = this.serverForm;
    if (!form || this.saving()) return;

    const problem = this.serverProblem(form);
    if (problem) { this.formError.set(problem); return; }

    this.formError.set('');
    this.saving.set(true);
    this.api.saveDbServer(form).subscribe({
      next: res => {
        this.saving.set(false);
        if (!res.success) { this.formError.set(res.message); return; }
        this.serverForm = null;
        this.testResult.set(null);
        this.notify(res.message, true);
        this.loadServers();
      },
      error: err => this.failForm(err),
    });
  }

  testServer(): void {
    const form = this.serverForm;
    if (!form || this.testing()) return;
    if (!form.serverName.trim() || !form.adminUser.trim()) { this.formError.set('Server and login are required'); return; }

    this.formError.set('');
    this.testResult.set(null);
    this.testing.set(true);
    this.api.testDbServer(form).subscribe({
      next: res => {
        this.testing.set(false);
        if (res.success && res.data) this.testResult.set(res.data);
        else this.formError.set(res.message);
      },
      error: err => { if (this.isLocked(err)) return; this.testing.set(false); this.formError.set(this.message(err, 'Connection test failed')); },
    });
  }

  // ── platform settings ─────────────────────────────────────────────────────

  loadSettings(): void {
    this.api.getSettings().subscribe({
      next: res => {
        if (!res.success) { this.notify(res.message, false); return; }
        const list = res.data ?? [];
        this.settings.set(list);
        this.settingDraft = Object.fromEntries(list.map(s => [s.settingKey, s.settingValue ?? '']));
        this.settingError.set({});
      },
      error: err => this.fail(err, 'Could not load the settings'),
    });
  }

  saveSetting(key: string): void {
    const value = this.settingDraft[key] ?? '';
    this.settingError.update(e => ({ ...e, [key]: '' }));
    this.api.saveSetting(key, value).subscribe({
      next: res => {
        if (!res.success) { this.settingError.update(e => ({ ...e, [key]: res.message })); return; }
        this.settings.update(list => list.map(s => s.settingKey === key ? { ...s, settingValue: value.trim() } : s));
        this.notify(res.message, true);
      },
      error: err => { if (this.isLocked(err)) return; this.settingError.update(e => ({ ...e, [key]: this.message(err, 'Could not save the setting') })); },
    });
  }

  // ── database state of a company ───────────────────────────────────────────

  companyDatabase(company: PlatformCompany): string {
    switch (company.provisionStatus) {
      case 'Ready': return 'Ready';
      case 'None': case undefined: case '': return 'No database';
      default: return provisionLabel(company.provisionStatus);
    }
  }

  /** Only a company that never got a database can be retried. */
  canRetry(company: PlatformCompany): boolean {
    return company.provisionStatus === 'Failed' && !company.databaseName;
  }

  retryCompany(company: PlatformCompany): void {
    if (this.retryingCompany() !== null) return;

    this.retryingCompany.set(company.companyId);
    this.auth.retryProvision(company.companyId).subscribe({
      next: res => {
        this.retryingCompany.set(null);
        this.notify(res.message, res.success);
        if (res.success) this.loadCompanies();
      },
      error: err => {
        this.retryingCompany.set(null);
        this.notify(requestErrorMessage(err, 'Could not retry the set-up'), false);
      },
    });
  }
```

(e) `closeForms()` also sets `this.serverForm = null;`. `relock()` also clears `servers`, `settings`, `settingDraft = {}`.

- [ ] **Step 5: Template and styles**

In `platform-admin-component.html`:

(a) Tabs: inside the existing `@if (isPlatformAdmin())` that holds the Menus tab button add, before it:

```html
      <button [class.active]="tab() === 'servers'" (click)="setTab('servers')">Database Servers</button>
      <button [class.active]="tab() === 'settings'" (click)="setTab('settings')">Settings</button>
```

(b) Companies table: add a header `<th>Database</th>` before the `Status` header and this cell before the status cell, and a Retry button first in the actions cell (adjust the `colspan` of the empty row by one):

```html
              <td>
                <span class="pa-status" [class.off]="c.provisionStatus !== 'Ready'">{{ companyDatabase(c) }}</span>
                @if (c.databaseName) { <div class="pa-sub"><code>{{ c.databaseName }}</code></div> }
                @if (c.provisionStatus === 'Failed' && c.provisionError) { <div class="pa-sub pa-warn">{{ c.provisionError }}</div> }
              </td>
```

```html
                @if (canRetry(c)) {
                  <button class="fx-action-btn" (click)="retryCompany(c)" [disabled]="retryingCompany() !== null">{{ retryingCompany() === c.companyId ? 'Retrying…' : 'Retry' }}</button>
                }
```

(c) Two new tab blocks, before the `<!-- ═══════════ MENUS ═══════════ -->` comment:

```html
  <!-- ═══════════ DATABASE SERVERS ═══════════ -->
  @if (tab() === 'servers' && isPlatformAdmin()) {
    <div class="fx-table-wrap">
      <div class="fx-table-toolbar">
        <div class="fx-toolbar-left">
          <span class="fx-table-title">Database servers</span>
          <span class="fx-table-count">{{ servers().length }}</span>
        </div>
        <div class="fx-toolbar-right">
          <button class="fx-btn-new" (click)="newServer()">+ New Server</button>
        </div>
      </div>

      <table class="fx-table">
        <thead>
          <tr><th>Server</th><th>Login</th><th>Options</th><th>Default</th><th>Status</th><th class="fx-num">Companies</th><th>Password</th><th></th></tr>
        </thead>
        <tbody>
          @for (s of servers(); track s.dbServerId) {
            <tr>
              <td><strong>{{ s.serverName }}</strong></td>
              <td>{{ s.adminUser }}</td>
              <td>{{ s.extraOptions || '—' }}</td>
              <td>{{ s.isDefault ? 'Default' : '—' }}</td>
              <td><span class="pa-status" [class.off]="!s.isActive">{{ s.isActive ? 'Active' : 'Inactive' }}</span></td>
              <td class="fx-num">{{ s.companyCount }}</td>
              <td>@if (s.hasPassword) { Stored } @else { <span class="pa-warn">Missing</span> }</td>
              <td class="pa-actions"><button class="fx-action-btn" (click)="editServer(s)">Edit</button></td>
            </tr>
          } @empty {
            <tr class="fx-empty-row"><td colspan="8">No server yet — nobody can create a company until an active default server exists</td></tr>
          }
        </tbody>
      </table>
      <div class="pa-hint">New company databases are created on the default server. A login with the dbcreator role can also alter and drop other databases on the same SQL Server: prefer a server that holds nothing else.</div>
    </div>
  }

  <!-- ═══════════ SETTINGS ═══════════ -->
  @if (tab() === 'settings' && isPlatformAdmin()) {
    <div class="fx-table-wrap">
      <div class="fx-table-toolbar">
        <div class="fx-toolbar-left"><span class="fx-table-title">Platform settings</span></div>
      </div>
      <table class="fx-table">
        <thead><tr><th>Setting</th><th>Value</th><th></th></tr></thead>
        <tbody>
          @for (s of settings(); track s.settingKey) {
            <tr>
              <td>
                <strong>{{ settingHelp[s.settingKey]?.label || s.settingKey }}</strong>
                <div class="pa-sub">{{ settingHelp[s.settingKey]?.help }}</div>
                @if (settingError()[s.settingKey]) { <div class="pa-error">{{ settingError()[s.settingKey] }}</div> }
              </td>
              <td>
                @if (settingHelp[s.settingKey]) {
                  <input class="form-input" [(ngModel)]="settingDraft[s.settingKey]" [attr.aria-label]="settingHelp[s.settingKey].label" />
                } @else {
                  {{ s.settingValue }}
                }
              </td>
              <td class="pa-actions">
                @if (settingHelp[s.settingKey]) { <button class="fx-action-btn" (click)="saveSetting(s.settingKey)">Save</button> }
              </td>
            </tr>
          } @empty {
            <tr class="fx-empty-row"><td colspan="3">No settings</td></tr>
          }
        </tbody>
      </table>
    </div>
  }
```

(d) The server dialog, before the `<!-- ═══════════ MENU DIALOG ═══════════ -->` comment:

```html
<!-- ═══════════ DATABASE SERVER DIALOG ═══════════ -->
@if (serverForm; as f) {
  <div class="modal-overlay" (click)="closeForms()">
    <div class="modal-content wide" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h2>{{ f.dbServerId ? 'Edit Database Server' : 'New Database Server' }}</h2>
        <button class="modal-close" aria-label="Close" (click)="closeForms()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid">
          <div class="form-group">
            <label>Server *</label>
            <input class="form-input" [(ngModel)]="f.serverName" placeholder="server name or IP" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Login *</label>
            <input class="form-input" [(ngModel)]="f.adminUser" autocomplete="off" />
          </div>
          <div class="form-group">
            <label>Password {{ f.dbServerId ? '' : '*' }}</label>
            <input class="form-input" type="password" [(ngModel)]="f.adminPassword" autocomplete="new-password"
                   [placeholder]="f.dbServerId ? 'leave empty to keep the current one' : ''" />
          </div>
          <div class="form-group">
            <label>Options</label>
            <input class="form-input" [(ngModel)]="f.extraOptions" placeholder="optional, e.g. Encrypt=True" />
          </div>
          <div class="form-group">
            <label class="pa-check"><input type="checkbox" [(ngModel)]="f.isDefault" /> Default for new companies</label>
          </div>
          <div class="form-group">
            <label class="pa-check"><input type="checkbox" [(ngModel)]="f.isActive" /> Active</label>
          </div>
        </div>
        <div class="form-note">This login creates each new company's database and is then used to connect to it. It needs the dbcreator role. Options may not set the server, database, login or password. Type the password again when you change the server or the login.</div>

        @if (testResult(); as t) {
          <div class="pa-test" [class.ok]="t.connected && t.schemaReady" [class.warn]="t.connected && !t.schemaReady" [class.bad]="!t.connected">{{ t.message }}</div>
        }
        @if (formError()) { <div class="pa-error">{{ formError() }}</div> }
      </div>
      <div class="modal-footer">
        <button class="btn-secondary pa-left" (click)="testServer()" [disabled]="testing()">{{ testing() ? 'Testing…' : 'Test connection' }}</button>
        <button class="btn-secondary" (click)="closeForms()">Cancel</button>
        <button class="fx-btn-navy" (click)="saveServer()" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save' }}</button>
      </div>
    </div>
  </div>
}
```

(e) Append to the component's `.scss`: `.pa-sub { font-size: 0.8rem; opacity: 0.75; margin-top: 2px; }`.

Check that the project dialog's `testResult` box is not shown by the server dialog's result and vice versa: both dialogs clear `testResult` when they open (the project dialog already does; the methods above do).

- [ ] **Step 6: Run to verify it passes**

```bash
npx ng test --watch=false --include "src/app/Encryptz/components/platform-admin-component/**/*.spec.ts" 2>&1 | tail -25
npx ng build 2>&1 | tail -6
npx ng test --watch=false 2>&1 | grep -E "Test Files|Tests |FAIL" | sort -u
```

Expected: the platform admin spec passes (the 32 earlier tests plus every new one); no build errors; the whole suite fails only in the 5 old placeholder specs. The earlier describes' `AuthService` stubs have no `retryProvision`: that is fine as long as nothing calls it there.

- [ ] **Step 7: Commit**

```bash
git add encryptzUI/src/app/Encryptz/Services/platform-service.ts encryptzUI/src/app/Encryptz/components/platform-admin-component
git commit -m "Manage database servers and platform settings and show each company's database state"
```

---

### Task 4: Verification with a running API (owner-gated)

Needs the API of Plan 3a running against copies and a server it may create databases on: the same gate as Plan 3a Task 9. **Stop here and ask the owner.** Until then report Tasks 1 to 3 as "implemented and unit-tested; not run against an API".

| # | Do | Expect |
|---|---|---|
| 1 | Log in as a user with no company | the company screen with "You are not in a company yet", Create Company disabled with "Company creation is not available right now" while no server exists |
| 2 | Platform Admin → Database Servers → New Server, Test connection, Save as default | "Connected. This login can create databases"; listed with Password "Stored" |
| 3 | Edit that server, change only Options, Save | saved without retyping the password; the password box was empty |
| 4 | Settings → set the company limit to `abc` | refused next to the row |
| 5 | Back on the company screen: Create Company, type a name | the code is suggested; Create → the company appears as "Setting up…", cannot be clicked; after some minutes it becomes enterable without a reload |
| 6 | Enter it | Modules → Branch (skipped when one) → dashboard |
| 7 | Create a second company | button disabled: "You can create 1 company. You have reached the limit." |
| 8 | Make a set-up fail (lookup source set to a missing database), create as another user | "Setup failed" with Retry for the creator; Platform Admin → Companies shows the reason to the platform administrator only |
| 9 | Fix the setting, press Retry (company screen, then again from Platform Admin on another failed one) | "Setting up…", then Ready |
| 10 | Press Create / Retry six times within an hour | "Too many attempts. Please try again later." |
| 11 | While a company is setting up, log out, or enter another company | no further requests to `user-companies` in the network tab |

Record the outcome in `EncryptzAPI/Database/MainDB/20_Company_Provisioning_README.md` under "Rehearsal" (that README is not frozen) and commit.

---

## Deferred

| Item | Plan |
|---|---|
| Full merge of the invitations / join-requests screen into the company screen (this plan links the two screens and makes the company screen the landing page) | 2c |
| HTTP 503 for one tenant whose database is unreachable (API) | 2c |
| Refusal text of `set-scope` for a Failed company ("still being set up"): the company screen now prevents entering such a company | 2c |
| Attach a database by hand from the Companies tab (it stays on the Company Databases tab) | 2c |
| Customer portal picker; removal of the "project" layer | 2c |
| Branch access | 4 |
