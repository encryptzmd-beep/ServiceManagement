// src/app/modules/schedule/components/conflict-view/conflict-view.component.ts
import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../Services/API/api-service';
import { Schedule } from '../../Models/ApiModels';

@Component({
  selector: 'app-conflict-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './conflict-view-component.html',
  styleUrls: ['./conflict-view-component.scss'],
})
export class ConflictViewComponent implements OnInit {
  private api = inject(ApiService);
  conflicts = signal<Schedule[]>([]);
  ngOnInit() {
    this.api.getScheduleConflicts().subscribe((d) => this.conflicts.set(d));
  }
}
