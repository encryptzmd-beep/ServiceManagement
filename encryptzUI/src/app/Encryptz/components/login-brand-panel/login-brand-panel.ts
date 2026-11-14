// Encryptz/components/login-brand-panel/login-brand-panel.ts
import { Component, signal } from '@angular/core';
import { LoginAdSliderComponent } from '../login-ad-slider/login-ad-slider';

/**
 * The left half of the sign-in and register pages: the Encryptz brand panel, or the
 * advertisement slider instead when Platform Admin › Login Ads has slides to show.
 */
@Component({
  selector: 'app-login-brand-panel',
  standalone: true,
  imports: [LoginAdSliderComponent],
  templateUrl: './login-brand-panel.html',
  styleUrls: ['./login-brand-panel.scss']
})
export class LoginBrandPanelComponent {
  hasAds = signal(false);

  readonly modules = [
    { icon: 'school', title: 'Education', sub: 'Learn & Grow', tone: 'blue' },
    { icon: 'work', title: 'Job Portal', sub: 'Find Opportunities', tone: 'red' },
    { icon: 'person', title: 'Personal Life', sub: 'Manage Better', tone: 'green' },
    { icon: 'apartment', title: 'Business', sub: 'Run & Automate', tone: 'violet' },
    { icon: 'campaign', title: 'Marketing', sub: 'Reach & Grow', tone: 'orange' },
    { icon: 'receipt_long', title: 'Accounts', sub: 'Simplify Finance', tone: 'amber' },
    { icon: 'verified_user', title: 'Statutory', sub: 'Stay Compliant', tone: 'cyan' },
    { icon: 'track_changes', title: 'Strategic Planning', sub: 'Plan for Future', tone: 'pink' },
  ];

  readonly stats = [
    { icon: 'groups', title: '10,000+', sub: 'Happy Users' },
    { icon: 'settings', title: 'Automated', sub: 'Workflows' },
    { icon: 'bar_chart', title: 'All-in-One', sub: 'Ecosystem' },
  ];
}
