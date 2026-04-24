import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../Services/API/api-service';
import { WarrantyReturn } from '../../Models/ApiModels';

@Component({
  selector: 'app-warranty-tracking',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './warranty-tracking-component.html',
  styleUrls: ['./warranty-tracking-component.scss'],
})
export class WarrantyTrackingComponent implements OnInit {
  private api = inject(ApiService);
  returns = signal<WarrantyReturn[]>([]);
  ngOnInit() {
    this.api.getWarrantyReturns().subscribe((d) => this.returns.set(d));
  }
}
