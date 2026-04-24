import { CommonModule } from '@angular/common';
import { Component, HostListener } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-landing-component',
  imports: [CommonModule, RouterModule, CommonModule,ReactiveFormsModule,FormsModule],
  templateUrl: './landing-component.html',
  styleUrl: './landing-component.scss',
})
export class LandingComponent {
  isScrolled = false;
  mobileMenuOpen = false;
  contactLoading = false;
  contactName = '';
  contactEmail = '';
  contactPhone = '';
  contactCompany = '';
  contactMessage = '';

  solutions = [
    { icon: 'assignment_turned_in', title: 'Complaint Management', description: 'Track, assign, and resolve customer complaints with real-time updates and SLA monitoring.' },
    { icon: 'engineering', title: 'Technician Management', description: 'Manage field technicians, track locations, and optimize daily schedules.' },
    { icon: 'inventory_2', title: 'Inventory Management', description: 'Track spare parts, manage stock levels, and automate reordering.' },
    { icon: 'analytics', title: 'Analytics & Reports', description: 'Real-time dashboards, SLA compliance reports, and performance metrics.' },
    { icon: 'warranty', title: 'Warranty Management', description: 'Track product warranties, manage returns, and automate claims.' },
    { icon: 'support_agent', title: 'Customer Portal', description: 'Self-service portal for customers to track complaints and raise requests.' }
  ];

  @HostListener('window:scroll')
  onScroll() { this.isScrolled = window.scrollY > 50; }

  scrollToContact() { document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }); }

  submitContact() {
    this.contactLoading = true;
    setTimeout(() => {
      this.contactLoading = false;
      alert('Thank you! We will contact you shortly.');
      this.contactName = this.contactEmail = this.contactPhone = this.contactCompany = this.contactMessage = '';
    }, 1000);
  }
}
