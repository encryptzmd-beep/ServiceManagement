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
