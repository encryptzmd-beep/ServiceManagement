// src/app/modules/schedule/components/task-summary/task-summary.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-task-summary',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './task-summary-component.html',
  styleUrls: ['./task-summary-component.scss'],
})
export class TaskSummaryComponent {}
