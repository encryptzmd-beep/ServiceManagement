import { PersonalMenuItem } from './personal-shell-component';

/** The side menu of Job Consultancy, the same on each of its pages. */
export const CONSULTANCY_MENU: PersonalMenuItem[] = [
  { label: 'Job postings', icon: 'work_outline', route: '/consultancy/postings' },
  { label: 'Candidates', icon: 'groups', route: '/consultancy/candidates' },
  { label: 'Clients', icon: 'handshake', route: '/consultancy/clients' },
  { label: 'Placements', icon: 'verified', route: '/consultancy/placements' },
];
