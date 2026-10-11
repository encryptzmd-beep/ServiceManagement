import { ModuleState } from '../Models/ApiModels';

/**
 * Where a staff session is on the way into the application:
 * login -> company -> module -> branch -> ready.
 * Pure functions only: the guard, the selector screens and the redirects all ask here,
 * so they cannot disagree.
 */
export type ScopeStep = 'login' | 'company' | 'module' | 'branch' | 'ready';

/** What a page needs: only a company (administration, profile) or the full scope (business pages). */
export type ScopeNeed = 'company' | 'full';

export interface ScopeState {
  loggedIn: boolean;
  companyId: number | null;
  moduleKey: string | null;
  locationId: number | null;
}

export function nextScopeStep(state: ScopeState, need: ScopeNeed = 'full'): ScopeStep {
  if (!state.loggedIn) return 'login';
  if (!state.companyId) return 'company';
  if (need === 'company') return 'ready';
  if (!state.moduleKey) return 'module';
  if (!state.locationId) return 'branch';
  return 'ready';
}

export function routeForStep(step: ScopeStep): string {
  switch (step) {
    case 'login': return '/login';
    case 'company': return '/select-company';
    case 'module': return '/select-module';
    case 'branch': return '/select-branch';
    default: return '/';
  }
}

/** Why a module card is disabled ('' when it can be opened). */
export function moduleCaption(state: ModuleState): string {
  switch (state) {
    case 'NotSubscribed': return 'Not subscribed';
    case 'NoAccess': return 'Ask your administrator';
    default: return '';
  }
}

/**
 * Module of a stored session. A session scoped by the previous UI has a tenant key and a
 * branch but no module: it was the Service module, the only one that existed.
 */
export function legacyModuleKey(
  user: { projectKey?: string; locationId?: number; moduleKey?: string } | null,
): string | null {
  if (!user) return null;
  if (user.moduleKey) return user.moduleKey;
  return user.projectKey && user.locationId ? 'SERVICE' : null;
}

/** One branch is entered without asking; none is a dead end the screen must explain. */
export function branchDecision(count: number): 'none' | 'auto' | 'choose' {
  if (count <= 0) return 'none';
  return count === 1 ? 'auto' : 'choose';
}

/** First page of the Service module for a role. */
export function landingRouteForRole(role: string): string {
  switch (role) {
    case 'Technician': return '/technicians/work-orders';
    case 'Storekeeper': return '/spare-parts';
    default: return '/complaints/dashboard';
  }
}
