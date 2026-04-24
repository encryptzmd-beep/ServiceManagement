import {
  Component,
  inject,
  OnInit,
  signal,

} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { TechnicianScheduleBoard, TechnicianScheduleBoardItem } from '../../Models/ApiModels';


@Component({
  selector: 'app-daily-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './daily-schedule-component.html',
  styleUrls: ['./daily-schedule-component.scss'],
})
export class DailyScheduleComponent implements OnInit {
 private api = inject(ApiService);

  selectedDate = new Date().toISOString().substring(0, 10);
locationNames = signal<Record<string, string>>({});
  loading = signal(false);
  technicians = signal<TechnicianScheduleBoard[]>([]);
  statusFilter = '';

  timeSlots = [
    { key: 'morning', label: 'Morning' },
    { key: 'afternoon', label: 'Afternoon' },
    { key: 'evening', label: 'Evening' }
  ];

  ngOnInit(): void {
    this.loadBoard();
  }

  loadBoard(): void {
  this.loading.set(true);
this.locationNames.set({});

  this.api.getScheduleBoardReport(this.selectedDate).subscribe({
    next: (res: any) => {
      const data = res?.data || [];
      this.technicians.set(data);

      // Fetch readable location names
      data.forEach((tech: TechnicianScheduleBoard) => {
        tech.items.forEach((item: TechnicianScheduleBoardItem) => {
          if (
            item.latitude &&
            item.longitude &&
            item.complaintNumber
          ) {
            this.getLocationName(
              item.latitude,
              item.longitude,
              item.complaintNumber
            );
          }
        });
      });

      this.loading.set(false);
    },
    error: () => {
      this.technicians.set([]);
      this.loading.set(false);
    }
  });
}
getCardClass(item: TechnicianScheduleBoardItem): string {
  if (item.isFree) return 'free';
  if (item.statusId === 3) return 'completed';
  if (item.statusId === 2) return 'progress';
  if (item.isFuture) return 'future';
  return 'scheduled';
}

 getItemsForSlot(
  items: TechnicianScheduleBoardItem[],
  slot: string
): TechnicianScheduleBoardItem[] {

  let data = items.filter(x => x.timeSlot === slot);

  if (this.statusFilter) {
    data = data.filter(x => x.statusId === +this.statusFilter);
  }

  return data.sort((a, b) =>
    (a.startTime || '').localeCompare(b.startTime || '')
  );
}

  prevDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() - 1);
    this.selectedDate = d.toISOString().substring(0, 10);
    this.loadBoard();
  }

  nextDay(): void {
    const d = new Date(this.selectedDate);
    d.setDate(d.getDate() + 1);
    this.selectedDate = d.toISOString().substring(0, 10);
    this.loadBoard();
  }
getLocationName(lat: number, lng: number, key: string | number): void {
  const mapKey = String(key);

  if (this.locationNames()[mapKey]) return;

  fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
  )
    .then(res => res.json())
    .then(data => {
      this.locationNames.update(current => ({
        ...current,
        [mapKey]: data.display_name || 'Unknown location'
      }));
    })
    .catch(() => {
      this.locationNames.update(current => ({
        ...current,
        [mapKey]: 'Unable to fetch location'
      }));
    });
}
}
