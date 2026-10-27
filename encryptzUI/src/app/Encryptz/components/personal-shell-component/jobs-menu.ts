import { PersonalMenuItem } from './personal-shell-component';

/** The side menu of Job Portal, the same on each of its pages; the number of unread notifications beside them. */
export function jobsMenu(unread = 0): PersonalMenuItem[] {
  return [
    { label: 'Dashboard', icon: 'dashboard', route: '/apps/jobs', exact: true },
    { label: 'My profile', icon: 'person', route: '/apps/jobs/profile' },
    { label: 'Search jobs', icon: 'search', route: '/apps/jobs/search' },
    { label: 'My applications', icon: 'assignment_turned_in', route: '/apps/jobs/applications' },
    { label: 'Saved jobs', icon: 'bookmark_border', route: '/apps/jobs/saved' },
    { label: 'Messages', icon: 'chat_bubble_outline', route: '/apps/jobs/messages' },
    { label: 'Notifications', icon: 'notifications_none', route: '/apps/jobs/notifications', badge: unread },
  ];
}

export const JOBS_MENU: PersonalMenuItem[] = jobsMenu();
