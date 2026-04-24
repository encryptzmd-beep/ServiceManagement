import { Component, ElementRef, AfterViewInit, ViewChild, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../Services/API/api-service';
import { ComplaintCreate, PRIORITIES, Product } from '../../Models/ApiModels';
import { QuickComplaintRegistrationComponent } from "../quick-complaint-registration-component/quick-complaint-registration-component";

declare var L: any;

@Component({
  selector: 'app-complaint-registration',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, QuickComplaintRegistrationComponent],
  templateUrl: './complaint-registration-component.html',
  styleUrls: ['./complaint-registration-component.scss'],
})
export class ComplaintRegistrationComponent implements OnInit, AfterViewInit {
  @ViewChild('mapContainer') mapContainer!: ElementRef;
  @ViewChild('locationSearchInput') locationSearchInput!: ElementRef;

  private api = inject(ApiService);
  private router = inject(Router);

  products = signal<Product[]>([]);
  priorities = PRIORITIES;
  step = signal(1);
  saving = signal(false);
  successMsg = signal('');
  errorMsg = signal('');

  productSearch = '';
  searchResults: any[] = [];
  isSearching = false;
  searchQuery = '';

  form: ComplaintCreate = {
    productId: 0,
    subject: '',
    description: '',
    priority: 'Medium',
    latitude: null,
    longitude: null,
    locationAddress: '',
    pickedLocation: ''
  };

  files: File[] = [];

  private map: any;
  private marker: any;
  private searchTimeout: any;
  private mapInitialized = false;

  // Kochi coordinates (default location)
  private readonly KOCHI_LAT = 9.9312;
  private readonly KOCHI_LNG = 76.2673;

  ngOnInit(): void {
    this.api.getOrCreateProfile().subscribe();
    this.api.getProducts().subscribe({
      next: (res: any) => {
        if (res.data) this.products.set(res.data);
        else if (Array.isArray(res)) this.products.set(res);
      },
      error: () => {},
    });
  }

  ngAfterViewInit(): void {
    // Map will be initialized when step changes to 2
  }

  ngAfterViewChecked(): void {
    // Initialize map when step becomes 2 and map not initialized yet
    if (this.step() === 2 && !this.mapInitialized && this.mapContainer?.nativeElement) {
      console.log('Step 2 detected, initializing map with Kochi as default...');
      this.mapInitialized = true;
      setTimeout(() => {
        this.initMap();
      }, 200);
    }
  }

  goToStep(stepNumber: number): void {
    this.step.set(stepNumber);

    // Reset map initialized flag when going back to step 1
    if (stepNumber === 1) {
      this.mapInitialized = false;
    }

    // Re-initialize map when coming back to step 2
    if (stepNumber === 2) {
      this.mapInitialized = false;
    }
  }

  initMap(): void {
    console.log('initMap called');

    if (typeof L === 'undefined') {
      console.error('Leaflet (L) is not defined! Make sure Leaflet script is loaded in index.html');
      return;
    }

    if (!this.mapContainer || !this.mapContainer.nativeElement) {
      console.error('Map container not found!');
      return;
    }

    if (this.map) {
      console.log('Map already exists, removing old map...');
      this.map.remove();
      this.map = null;
      this.marker = null;
    }

    console.log('Creating new map with Kochi as default location...');

    try {
      // Use Kochi as default location
      this.map = L.map(this.mapContainer.nativeElement).setView([this.KOCHI_LAT, this.KOCHI_LNG], 13);

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(this.map);

      // Create custom marker icon
      const markerIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41]
      });

      // Set default marker at Kochi
      this.marker = L.marker([this.KOCHI_LAT, this.KOCHI_LNG], {
        draggable: true,
        icon: markerIcon
      }).addTo(this.map);

      // Set default location in form
      this.form.latitude = this.KOCHI_LAT;
      this.form.longitude = this.KOCHI_LNG;
      this.form.pickedLocation = 'Kochi, Kerala';

      // Get address for Kochi
      this.reverseGeocode(this.KOCHI_LAT, this.KOCHI_LNG);

      // Marker drag event
      this.marker.on('dragend', (event: any) => {
        const position = event.target.getLatLng();
        this.updateLocation(position.lat, position.lng);
      });

      // Map click event
      this.map.on('click', (event: any) => {
        const { lat, lng } = event.latlng;
        this.marker.setLatLng([lat, lng]);
        this.updateLocation(lat, lng);
      });

      // Force map to update size
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          console.log('Map size invalidated');
        }
      }, 100);

      console.log('Map initialized successfully with Kochi as default');

    } catch (error) {
      console.error('Error creating map:', error);
    }
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value;

    if (this.searchTimeout) {
      clearTimeout(this.searchTimeout);
    }

    if (this.searchQuery.length < 3) {
      this.searchResults = [];
      return;
    }

    this.searchTimeout = setTimeout(() => {
      this.searchLocation(this.searchQuery);
    }, 500);
  }

  searchLocation(query: string): void {
    if (!query || query.length < 3) return;

    this.isSearching = true;
    // Search in India primarily, but allow other locations if needed
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&countrycodes=IN`;
    // For worldwide search (remove country restriction):
    // const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1`;

    fetch(searchUrl)
      .then(response => response.json())
      .then(data => {
        this.searchResults = data;
        this.isSearching = false;
        console.log('Search results:', data);
      })
      .catch(error => {
        console.error('Search error:', error);
        this.isSearching = false;
        this.searchResults = [];
      });
  }

  selectSearchResult(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    // Get the display name for the location
    const displayName = result.display_name;
    const shortName = displayName.split(',')[0];

    console.log('Selected location:', { lat, lng, name: shortName });

    // Clear search results
    this.searchResults = [];

    // Update search input value
    if (this.locationSearchInput) {
      this.locationSearchInput.nativeElement.value = shortName;
    }

    // Clear search query
    this.searchQuery = '';

    // Move map and marker to selected location
    if (this.map && this.marker) {
      this.map.setView([lat, lng], 16);
      this.marker.setLatLng([lat, lng]);
      this.updateLocation(lat, lng, displayName);
    }
  }

  clearSearch(inputElement: HTMLInputElement): void {
    inputElement.value = '';
    this.searchQuery = '';
    this.searchResults = [];
  }

  updateLocation(lat: number, lng: number, address?: string): void {
    this.form.latitude = lat;
    this.form.longitude = lng;

    if (address) {
      this.form.locationAddress = address;
      this.form.pickedLocation = this.getShortAddress(address);
    } else {
      this.reverseGeocode(lat, lng);
    }

    console.log('Location updated:', {
      lat: this.form.latitude,
      lng: this.form.longitude,
      address: this.form.pickedLocation
    });
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    const locateBtn = document.querySelector('.btn-locate');
    if (locateBtn) {
      const originalHtml = locateBtn.innerHTML;
      locateBtn.innerHTML = '<span class="spinner-small"></span> Getting location...';
      (locateBtn as HTMLButtonElement).disabled = true;

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          if (this.map && this.marker) {
            this.map.setView([lat, lng], 15);
            this.marker.setLatLng([lat, lng]);
            this.updateLocation(lat, lng);
          }

          locateBtn.innerHTML = originalHtml;
          (locateBtn as HTMLButtonElement).disabled = false;

          // Show success message
          const successDiv = document.createElement('div');
          successDiv.className = 'location-toast';
          successDiv.innerHTML = '<span class="material-icons">check_circle</span> Location updated to your current position';
          document.body.appendChild(successDiv);
          setTimeout(() => successDiv.remove(), 3000);
        },
        (error) => {
          console.error('Geolocation error:', error);
          locateBtn.innerHTML = originalHtml;
          (locateBtn as HTMLButtonElement).disabled = false;

          let errorMessage = 'Unable to get your location. ';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please allow location access in your browser settings.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location information is unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.';
              break;
          }
          alert(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  }

  reverseGeocode(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`)
      .then(response => response.json())
      .then(data => {
        if (data.display_name) {
          this.form.locationAddress = data.display_name;
          this.form.pickedLocation = this.getShortAddress(data.display_name);
          console.log('Reverse geocoded address:', this.form.pickedLocation);
        }
      })
      .catch(error => console.warn('Reverse geocoding error:', error));
  }

  getShortAddress(fullAddress: string): string {
    const parts = fullAddress.split(',');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(',').trim();
    }
    if (parts.length >= 2) {
      return parts.slice(0, 2).join(',').trim();
    }
    return fullAddress.substring(0, 100);
  }

  filteredProducts(): Product[] {
    const term = this.productSearch?.toLowerCase() || '';
    if (!term) return this.products();
    return this.products().filter(
      (p) =>
        p.productName?.toLowerCase().includes(term) ||
        p.serialNumber?.toLowerCase().includes(term) ||
        p.brand?.toLowerCase().includes(term)
    );
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      const newFiles = Array.from(input.files);
      // Limit to 5 files
      if (this.files.length + newFiles.length > 5) {
        alert('Maximum 5 images allowed');
        return;
      }
      this.files = [...this.files, ...newFiles];
    }
  }

  isWarrantyActive(expiryDate: string | Date): boolean {
    if (!expiryDate) return false;
    const today = new Date();
    const expiry = new Date(expiryDate);
    today.setHours(0, 0, 0, 0);
    expiry.setHours(0, 0, 0, 0);
    return expiry >= today;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer?.files) {
      const newFiles = Array.from(event.dataTransfer.files);
      if (this.files.length + newFiles.length > 5) {
        alert('Maximum 5 images allowed');
        return;
      }
      this.files = [...this.files, ...newFiles];
    }
  }

  removeFile(index: number): void {
    this.files = this.files.filter((_, i) => i !== index);
  }

  getSelectedProductName(): string {
    const p = this.products().find((x) => x.productId === this.form.productId);
    return p ? p.productName + ' (' + p.serialNumber + ')' : 'Not selected';
  }

  getSelectedProduct(): Product | undefined {
    return this.products().find((x) => x.productId === this.form.productId);
  }

  getPriorityIcon(priority: string): string {
    const map: Record<string, string> = {
      Low: 'arrow_downward', Medium: 'remove',
      High: 'arrow_upward', Critical: 'priority_high',
    };
    return map[priority] || 'remove';
  }

  getSLAText(): string {
    const map: Record<string, string> = {
      Critical: 'Within 4 hours', High: 'Within 12 hours',
      Medium: 'Within 24 hours', Low: 'Within 48 hours',
    };
    return map[this.form.priority] || 'Within 24 hours';
  }

  submit(): void {
    // Validate location is selected
    if (!this.form.latitude || !this.form.longitude) {
      this.errorMsg.set('Please select a service location on the map');
      return;
    }

    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

    console.log('Submitting complaint:', this.form);
    console.log('Files to upload:', this.files.length);

    this.api.createComplaint(this.form).subscribe({
      next: (res: any) => {
        console.log('Complaint creation response:', res);
        this.saving.set(false);

        if (res.success && res.data) {
          const cmpId = res.data.complaintId || res.data.ComplaintId || res.data;
          const cmpNo = res.data.complaintNumber || res.data.ComplaintNumber;

          if (cmpId && this.files.length > 0) {
            console.log('Uploading images...');
            this.files.forEach((file) => {
              this.api.uploadComplaintImage(cmpId, file).subscribe({
                next: (uploadRes) => console.log('Image uploaded:', uploadRes),
                error: (uploadErr) => console.error('Image upload failed:', uploadErr)
              });
            });
          }

          this.successMsg.set('Complaint ' + cmpNo + ' registered successfully!');
          setTimeout(() => this.router.navigate(['/customer/complaints']), 2500);
        } else {
          this.errorMsg.set(res.message || 'Failed to register complaint');
        }
      },
      error: (err) => {
        console.error('Submit error:', err);
        this.saving.set(false);
        this.errorMsg.set('An error occurred. Please try again.');
      },
    });
  }
}
