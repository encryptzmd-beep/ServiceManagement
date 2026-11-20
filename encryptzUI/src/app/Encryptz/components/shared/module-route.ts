import { landingRouteForRole } from '../../Auth/scope-flow';
import { ModuleDto } from '../../Models/ApiModels';

/**
 * Applications whose pages need no branch (their data belongs to the whole company):
 * opening one goes straight to its first page.
 */
export const MODULE_HOME: Record<string, string> = {
  JOBCONSULTANCY: '/consultancy/dashboard',
};

/** Where opening a module goes: its first page, or the branch step of the module. */
export function moduleRoute(module: Pick<ModuleDto, 'moduleKey'>): { commands: string[]; queryParams?: Record<string, string> } {
  const home = MODULE_HOME[(module.moduleKey || '').toUpperCase()];
  return home ? { commands: [home] } : { commands: ['/select-branch'], queryParams: { module: module.moduleKey } };
}

/** The first page of a module once its branch is entered (the role decides it for the Service module). */
export function moduleLanding(moduleKey: string, role: string): string {
  return (moduleKey || '').toUpperCase() === 'CRM' ? '/crm/dashboard' : landingRouteForRole(role);
}
