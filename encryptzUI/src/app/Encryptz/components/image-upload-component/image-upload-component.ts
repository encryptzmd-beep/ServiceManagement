
// ============================================================
// image-upload-component.ts  (full component)
// ============================================================

import { Component, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { debounceTime, Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../Services/API/api-service';
import { HttpClient } from '@angular/common/http';
import {environment} from '../../../../../src/environments/environment.development'


interface UploadItem {
  file: File;
  preview: string;
  type: string;
  status: 'pending' | 'uploading' | 'done' | 'error';
  path?: string;
  error?: string;
}

@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './image-upload-component.html',
  styleUrls: ['./image-upload-component.scss'],
})
export class ImageUploadComponent {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  private _destroyRef = inject(DestroyRef);
  private techSearchSubject = new Subject<string>();

  // Technician autocomplete
  techSearch        = '';
  techResults       = signal<any[]>([]);
  showTechDropdown  = false;
  selectedTech      = signal<any>(null);
  techId            = 0;
  techSearchLoading = signal(false);

  complaintId = 0;
  imageType   = 'Before';
  items       = signal<UploadItem[]>([]);
  uploading   = signal(false);
  msg         = signal('');
  msgErr      = signal(false);
  isDragOver  = false;

  // Uploaded images list
  uploaded    = signal<any[]>([]);
  previewItem = signal<UploadItem | null>(null);

  imageTypes = ['Before', 'After', 'Part', 'Other'];

  constructor() {
    this.techSearchSubject.pipe(
      debounceTime(300),
      takeUntilDestroyed(this._destroyRef)
    ).subscribe(term => {
      if (!term.trim()) { this.techResults.set([]); return; }
      this.techSearchLoading.set(true);
      this.api.getTechnicians({ searchTerm: term, pageNumber: 1, pageSize: 10 } as any).subscribe({
        next: (d: any) => { this.techResults.set(d.items || d || []); this.techSearchLoading.set(false); },
        error: () => { this.techResults.set([]); this.techSearchLoading.set(false); }
      });
    });
  }

  onTechSearch(): void { this.showTechDropdown = true; this.techSearchSubject.next(this.techSearch); }
  selectTech(t: any): void {
    this.selectedTech.set(t); this.techId = t.technicianId;
    this.techSearch = t.fullName; this.showTechDropdown = false; this.techResults.set([]);
  }
  clearTech(): void {
    this.selectedTech.set(null); this.techId = 0;
    this.techSearch = ''; this.techResults.set([]); this.showTechDropdown = false;
  }
  getTechAvailClass(s: number): string { return s === 1 ? 'av' : s === 2 ? 'busy' : 'leave'; }
  getTechAvailLabel(s: number): string { return s === 1 ? 'Available' : s === 2 ? 'Busy' : 'On Leave'; }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) this.addFiles(Array.from(input.files));
    input.value = '';
  }

  onDrop(event: DragEvent): void {
    event.preventDefault(); this.isDragOver = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.addFiles(files);
  }

  onDragOver(event: DragEvent): void { event.preventDefault(); this.isDragOver = true; }
  onDragLeave(): void { this.isDragOver = false; }

  private addFiles(files: File[]): void {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    const newItems: UploadItem[] = files
      .filter(f => allowed.includes(f.type))
      .map(f => ({
        file: f,
        preview: URL.createObjectURL(f),
        type: this.imageType,
        status: 'pending' as const
      }));
    this.items.update(list => [...list, ...newItems]);
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  async uploadAll(): Promise<void> {
    const pending = this.items().filter(i => i.status === 'pending');
    if (!pending.length || !this.complaintId || !this.techId) {
      this.show('Please fill complaint ID and select a technician', true);
      return;
    }
    this.uploading.set(true);
    this.msg.set('');

    for (let i = 0; i < this.items().length; i++) {
      const item = this.items()[i];
      if (item.status !== 'pending') continue;

      this.items.update(list => {
        const copy = [...list];
        copy[i] = { ...copy[i], status: 'uploading' };
        return copy;
      });

      try {
        const fd = new FormData();
        fd.append('file',         item.file);
        fd.append('complaintId',  String(this.complaintId));
        fd.append('technicianId', String(this.techId));
        fd.append('imageType',    item.type);

        const res: any = await this.http
          .post(`${environment.apiUrl}/service-images/upload`, fd)
          .toPromise();

        this.items.update(list => {
          const copy = [...list];
          copy[i] = { ...copy[i], status: res.success ? 'done' : 'error', path: res.imagePath, error: res.message };
          return copy;
        });
      } catch {
        this.items.update(list => {
          const copy = [...list];
          copy[i] = { ...copy[i], status: 'error', error: 'Upload failed' };
          return copy;
        });
      }
    }

    this.uploading.set(false);
    const doneCount = this.items().filter(i => i.status === 'done').length;
    if (doneCount > 0) this.show(`${doneCount} image(s) uploaded successfully`, false);
  }

  clearDone(): void {
    this.items.update(list => list.filter(i => i.status !== 'done'));
  }

  openPreview(item: UploadItem): void { this.previewItem.set(item); }
  closePreview(): void { this.previewItem.set(null); }

  get pendingCount(): number { return this.items().filter(i => i.status === 'pending').length; }
  get doneCount(): number    { return this.items().filter(i => i.status === 'done').length; }

  private show(m: string, err: boolean): void {
    this.msg.set(m); this.msgErr.set(err);
    if (!err) setTimeout(() => this.msg.set(''), 3000);
  }
}
