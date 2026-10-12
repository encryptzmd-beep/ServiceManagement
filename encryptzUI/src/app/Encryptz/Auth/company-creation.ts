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
