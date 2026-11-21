import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tabSession } from './tab-session';

const memoryStorage = () => {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
};

describe('tabSession', () => {
  let shared: ReturnType<typeof memoryStorage>;
  let tab: ReturnType<typeof memoryStorage>;
  const user = (userId: number) => JSON.stringify({ userId });

  beforeEach(() => {
    shared = memoryStorage();
    tab = memoryStorage();
    vi.stubGlobal('localStorage', shared);
    vi.stubGlobal('sessionStorage', tab);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a new tab starts from the last choice', () => {
    shared.setItem('encryptz_token', 'service');
    shared.setItem('encryptz_user', user(5));
    shared.setItem('selected_module_key', 'SERVICE');
    tabSession.start();
    expect(tabSession.getItem('encryptz_token')).toBe('service');
    expect(tabSession.getItem('selected_module_key')).toBe('SERVICE');
  });

  it('a tab keeps its module when another tab switches', () => {
    shared.setItem('encryptz_token', 'service');
    shared.setItem('encryptz_user', user(5));
    shared.setItem('selected_module_key', 'SERVICE');
    tabSession.start();
    shared.setItem('encryptz_token', 'crm');
    shared.setItem('selected_module_key', 'CRM');
    tabSession.start();
    expect(tabSession.getItem('encryptz_token')).toBe('service');
    expect(tabSession.getItem('selected_module_key')).toBe('SERVICE');
  });

  it('a write reaches this tab and the next new tab', () => {
    tabSession.setItem('selected_module_key', 'CRM');
    expect(tab.getItem('selected_module_key')).toBe('CRM');
    expect(shared.getItem('selected_module_key')).toBe('CRM');
  });

  it('drops the copy of a session that was logged out', () => {
    tab.setItem('encryptz_token', 'old');
    tab.setItem('encryptz_user', user(5));
    tabSession.start();
    expect(tabSession.getItem('encryptz_token')).toBeNull();
  });

  it('drops the copy of another person', () => {
    tab.setItem('encryptz_token', 'old');
    tab.setItem('encryptz_user', user(5));
    shared.setItem('encryptz_token', 'new');
    shared.setItem('encryptz_user', user(9));
    tabSession.start();
    expect(tabSession.getItem('encryptz_token')).toBe('new');
  });

  it('leaves keys that are not per tab in localStorage', () => {
    tabSession.setItem('temp_login', 'x');
    expect(tab.getItem('temp_login')).toBeNull();
    expect(tabSession.getItem('temp_login')).toBe('x');
  });
});
