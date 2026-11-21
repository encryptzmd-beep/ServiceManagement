import { HttpClient } from '@angular/common/http';
import { Injectable, Injector, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../Auth/auth-service';

export type RightKind = 'create' | 'edit' | 'delete' | 'save';

interface RightRow { path: string; canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean; }
interface ModuleRights { fullAccess: boolean; rows: Record<string, RightRow>; }

export const normalizeMenuPath = (path: string) => (path || '').trim().replace(/^\/+|\/+$/g, '').toLowerCase();

export function moduleOfMenu(path: string): string {
  const p = normalizeMenuPath(path);
  if (p === 'crm' || p.startsWith('crm/')) return 'CRM';
  if (p === 'consultancy' || p.startsWith('consultancy/')) return 'JOBCONSULTANCY';
  return 'SERVICE';
}

/** A missing row or a right not ticked is no access. 'save' is for a form that is new or existing: the API checks which. */
export function rowAllows(row: RightRow | undefined, right: RightKind): boolean {
  if (!row?.canView) return false;
  switch (right) {
    case 'create': return row.canCreate;
    case 'edit': return row.canEdit;
    case 'delete': return row.canDelete;
    default: return row.canCreate || row.canEdit;
  }
}

/** A Storekeeper issues spare and repaired parts on the Despatch screen (its Sales tab is not shown to them). */
export const storekeeperMayIssue = (role: string | null | undefined, right: RightKind, menuPath: string) =>
  role === 'Storekeeper' && (right === 'create' || right === 'edit') && normalizeMenuPath(menuPath) === 'sales/despatch';

/**
 * What the signed-in person may do, read from the API per module. It only decides what the
 * screens enable; the API checks every change again (MenuRightFilter).
 */
@Injectable({ providedIn: 'root' })
export class RightsService {
  private http = inject(HttpClient, { optional: true });
  private injector = inject(Injector);
  private authRead = false;
  private authService: AuthService | null = null;

  /** Read when first needed: a component test may have no session to build it from (the API still checks). */
  private get auth(): AuthService | null {
    if (!this.authRead) {
      this.authRead = true;
      try { this.authService = this.http ? this.injector.get(AuthService, null) : null; } catch { this.authService = null; }
    }
    return this.authService;
  }
  private router = inject(Router, { optional: true });

  private loaded = signal<Record<string, ModuleRights>>({});
  private asked = new Set<string>();

  can(right: RightKind, menuPath: string, allowTechnician = false): boolean {
    // the screens of the customer portal have their own login
    if (this.router?.url?.startsWith('/customer')) return true;
    const role = typeof this.auth?.userRole === 'function' ? this.auth.userRole() : null;
    if (!this.http || role === null) return true;     // no API here (a component test)
    if (role === 'Admin' || role === 'CompanyAdmin' || role === 'Customer') return true;
    if (allowTechnician && role === 'Technician') return true;
    if (storekeeperMayIssue(role, right, menuPath)) return true;

    const module = moduleOfMenu(menuPath);
    const key = `${this.auth?.selectedCompanyId?.() ?? 0}:${module}`;
    const rights = this.loaded()[key];
    if (!rights) { this.load(key, module); return false; }
    return rights.fullAccess || rowAllows(rights.rows[normalizeMenuPath(menuPath)], right);
  }

  private load(key: string, module: string): void {
    if (this.asked.has(key)) return;
    this.asked.add(key);
    const keep = (value: ModuleRights) => this.loaded.update(all => ({ ...all, [key]: value }));
    queueMicrotask(() => {
      this.http!.get<{ success: boolean; data?: { fullAccess: boolean; items: RightRow[] } }>(
        `${environment.apiUrl}/api/menu-rights`, { params: { module } },
      ).subscribe({
        next: res => {
          const rows: Record<string, RightRow> = {};
          for (const item of res?.data?.items ?? []) rows[normalizeMenuPath(item.path)] = item;
          keep({ fullAccess: !!res?.data?.fullAccess, rows });
        },
        error: () => { this.asked.delete(key); keep({ fullAccess: false, rows: {} }); },
      });
    });
  }
}
