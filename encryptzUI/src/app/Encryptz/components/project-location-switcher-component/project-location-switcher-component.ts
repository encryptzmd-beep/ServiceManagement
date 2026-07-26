import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../Auth/auth-service';
import { ProjectDto, LocationDto } from '../../Models/ApiModels';

/**
 * Compact in-app switcher for the active Project + Location within the selected
 * client/company. Selecting a location calls set-scope, which re-issues the token
 * so every subsequent API call is routed + filtered to that project/location.
 *
 * Drop <app-project-location-switcher /> into the header/toolbar.
 */
@Component({
  selector: 'app-project-location-switcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-location-switcher-component.html',
  styleUrl: './project-location-switcher-component.scss',
})
export class ProjectLocationSwitcherComponent implements OnInit {
  private auth = inject(AuthService);

  /** Emitted after the scope is applied (or skipped when no projects exist). */
  @Output() scopeApplied = new EventEmitter<void>();

  projects = signal<ProjectDto[]>([]);
  locations = signal<LocationDto[]>([]);

  selectedProjectId = signal<number | null>(null);
  selectedLocationId = signal<number | null>(null);

  loading = signal(false);
  loaded = signal(false);
  /** True while a single project+location is being auto-applied (skip the UI). */
  autoResolving = signal(false);
  error = signal('');

  ngOnInit(): void {
    const companyId = this.auth.selectedCompanyId() ?? this.auth.currentUser()?.companyId ?? 0;
    if (!companyId) return;

    this.loading.set(true);
    this.auth.getProjects(companyId).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.loaded.set(true);
        const list = res.data || [];
        this.projects.set(list);

        if (list.length === 1) {
          // Only ONE project -> auto-select it and try to auto-skip on a single location
          this.autoResolving.set(true);
          this.onProjectChange(list[0].projectId, true, true);
        } else {
          // preselect the current/stored project, else the first
          const current = this.auth.getStoredProjectId();
          const initial = current ?? (list.length ? list[0].projectId : null);
          if (initial) this.onProjectChange(initial, false);
        }
      },
      error: () => { this.loading.set(false); this.loaded.set(true); this.error.set('Failed to load projects'); }
    });
  }

  /** No projects configured for this client — let the user continue (legacy/unscoped). */
  continueWithoutScope(): void {
    this.scopeApplied.emit();
  }

  onProjectChange(projectId: number, applyFirstLocation = true, autoApplyIfSingle = false): void {
    this.selectedProjectId.set(projectId);
    this.locations.set([]);
    this.selectedLocationId.set(null);
    if (!projectId) { this.autoResolving.set(false); return; }

    this.loading.set(true);
    this.auth.getLocations(projectId).subscribe({
      next: (res) => {
        this.loading.set(false);
        const list = res.data || [];
        this.locations.set(list);

        // Single project + single location -> apply immediately, no waiting.
        if (autoApplyIfSingle && list.length === 1) {
          this.selectedLocationId.set(list[0].locationId);
          this.applyScope();
          return;
        }
        this.autoResolving.set(false);

        const storedLoc = this.auth.getStoredLocationId();
        const belongs = list.some(l => l.locationId === storedLoc);
        const initial = belongs ? storedLoc
                      : (applyFirstLocation && list.length ? list[0].locationId : null);
        if (initial) this.selectedLocationId.set(initial);
      },
      error: () => { this.loading.set(false); this.autoResolving.set(false); this.error.set('Failed to load locations'); }
    });
  }

  applyScope(): void {
    const projectId = this.selectedProjectId();
    const locationId = this.selectedLocationId();
    if (!projectId || !locationId) return;

    this.loading.set(true);
    this.error.set('');
    this.auth.setScope(projectId, locationId).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success) this.scopeApplied.emit();
        else this.error.set(res.message || 'Failed to switch scope');
      },
      error: () => { this.loading.set(false); this.error.set('Failed to switch scope'); }
    });
  }
}
