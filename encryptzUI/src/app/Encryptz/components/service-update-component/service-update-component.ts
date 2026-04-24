import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-service-update',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './service-update-component.html',
  styleUrls: ['./service-update-component.scss'],
})
export class ServiceUpdateComponent {
  private api = inject(ApiService);
  assignmentId = 0;
  status = 'InProgress';
  remarks = '';
  saving = signal(false);
  msg = signal('');
  update() {
    this.saving.set(true);
    this.msg.set('');
    this.api
      .updateServiceStatus({
        AssignmentId: this.assignmentId,
        Status: this.status,
        remarks: this.remarks,
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          if (r.success) this.msg.set('Status updated!');
        },
        error: () => this.saving.set(false),
      });
  }
}
