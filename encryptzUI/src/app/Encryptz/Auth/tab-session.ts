/** What belongs to one browser tab: its token (issued for one module), company, branch and menus. */
const TAB_KEYS = [
  'encryptz_token', 'encryptz_user', 'encryptz_menus',
  'selected_company_id', 'selected_company_role', 'selected_project_key', 'selected_project_id',
  'selected_location_id', 'selected_module_key', 'selected_location_name',
];
const isTabKey = (key: string) => TAB_KEYS.includes(key);

const userIdOf = (json: string | null): unknown => {
  try { return json ? JSON.parse(json)?.userId ?? null : null; } catch { return null; }
};

/**
 * Each tab keeps its own module and screens. The tab reads its own copy (sessionStorage); every
 * write also goes to localStorage, so a NEW tab starts from the last choice. Logging out, or
 * another person logging in, still reaches every tab (see the storage listener of AuthService).
 */
export const tabSession = {
  /** On start: a tab with no copy takes the shared session; a copy of a session that ended is dropped. */
  start(): void {
    const shared = localStorage.getItem('encryptz_token');
    const own = sessionStorage.getItem('encryptz_token');
    const sameUser = userIdOf(localStorage.getItem('encryptz_user')) === userIdOf(sessionStorage.getItem('encryptz_user'));
    if (own && shared && sameUser) return;
    this.forgetTab();
    for (const key of TAB_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) sessionStorage.setItem(key, value);
    }
  },

  forgetTab(): void {
    for (const key of TAB_KEYS) sessionStorage.removeItem(key);
  },

  getItem(key: string): string | null {
    return isTabKey(key) ? sessionStorage.getItem(key) : localStorage.getItem(key);
  },

  setItem(key: string, value: string): void {
    if (isTabKey(key)) sessionStorage.setItem(key, value);
    localStorage.setItem(key, value);
  },

  removeItem(key: string): void {
    if (isTabKey(key)) sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  },

  userIdOf,
};
