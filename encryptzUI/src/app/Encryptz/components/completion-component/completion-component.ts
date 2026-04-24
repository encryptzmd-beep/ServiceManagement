// src/app/modules/technician/components/completion/completion.component.ts
import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-completion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './completion-component.html',
  styleUrls: ['./completion-component.scss'],
})
export class CompletionComponent {
  private api = inject(ApiService);
  step = signal(1);
  assignmentId = 0;
  remarks = '';
  afterImage: File | null = null;
  submitting = signal(false);
  msg = signal('');
  complete() {
    this.submitting.set(true);
    this.api
      .updateServiceStatus({
        AssignmentId: this.assignmentId,
        Status: 'Completed',
        remarks: this.remarks,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.msg.set('Service completed!');
        },
        error: () => this.submitting.set(false),
      });
  }
}
