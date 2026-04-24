import { Component, ElementRef, EventEmitter, Output, ViewChild, signal, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

declare var L: any;

@Component({
  selector: 'app-quick-complaint-registration',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Quick Complaint Button -->
    <button class="quick-complaint-btn" (click)="openModal()" [class.floating]="position === 'floating'">
      <span class="material-icons">flash_on</span>
      <span>Quick Complaint</span>
    </button>

    <!-- Modal Overlay -->
    @if (isOpen()) {

      <div class="modal-overlay" >
        <div class="modal-container" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="header-icon">
              <span class="material-icons">flash_on</span>
            </div>
            <div class="header-text">
              <h2>Quick Complaint</h2>
              <p>Report an issue in seconds</p>
            </div>
            <button class="close-btn" (click)="closeModal()">
              <span class="material-icons">close</span>
            </button>
          </div>

          <div class="modal-body">
            <form (ngSubmit)="submitQuickComplaint()" #quickForm="ngForm">
              <!-- SUBJECT - MANDATORY FIELD -->
              <div class="form-field" [class.error]="subjectTouched && !complaintData.subject">
                <label>
                  <span class="material-icons">title</span>
                  Subject <span class="required">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="complaintData.subject"
                  name="subject"
                  #subjectInput="ngModel"
                  required
                  placeholder="e.g., Treadmill not working, Dumbbell damaged..."
                  class="input-field"
                  (blur)="subjectTouched = true"
                />
                @if (subjectTouched && !complaintData.subject) {
                  <div class="error-message">Subject is required</div>
                }
              </div>

              <!-- Category - Gym & Fitness Only -->
              <div class="form-field">
                <label>
                  <span class="material-icons">fitness_center</span>
                  Category
                </label>
                <select [(ngModel)]="complaintData.category" name="category" class="input-field">
                  <option value="">Select category (optional)</option>
                  <option value="Treadmill">🏃 Treadmill</option>
                  <option value="Elliptical">🔄 Elliptical Trainer</option>
                  <option value="Exercise Bike">🚲 Exercise Bike</option>
                  <option value="Rowing Machine">🚣 Rowing Machine</option>
                  <option value="Weight Bench">🏋️ Weight Bench</option>
                  <option value="Dumbbells">💪 Dumbbells</option>
                  <option value="Barbell">🏋️ Barbell</option>
                  <option value="Pull Up Bar">📊 Pull Up Bar</option>
                  <option value="Cable Machine">🔗 Cable Machine</option>
                  <option value="Leg Press">🦵 Leg Press</option>
                  <option value="Smith Machine">⚙️ Smith Machine</option>
                  <option value="Cross Trainer">🎯 Cross Trainer</option>
                  <option value="Yoga Mat">🧘 Yoga Mat</option>
                  <option value="Kettlebell">🔔 Kettlebell</option>
                  <option value="Other Gym Equipment">🏋️ Other Gym Equipment</option>
                </select>
              </div>

              <!-- Brand Name (Optional) -->
              <div class="form-field">
                <label>
                  <span class="material-icons">branding_watermark</span>
                  Brand Name
                </label>
                <input
                  type="text"
                  [(ngModel)]="complaintData.brandName"
                  name="brandName"
                  placeholder="e.g., NordicTrack, Bowflex, Life Fitness..."
                  class="input-field"
                />
              </div>

              <!-- Model Number (Optional) -->
              <div class="form-field">
                <label>
                  <span class="material-icons">qr_code</span>
                  Model Number
                </label>
                <input
                  type="text"
                  [(ngModel)]="complaintData.modelNumber"
                  name="modelNumber"
                  placeholder="e.g., T-9.5, 1750, RW900..."
                  class="input-field"
                />
              </div>

              <!-- Complaint Details -->
              <div class="form-field">
                <label>
                  <span class="material-icons">description</span>
                  Describe the issue
                </label>
                <textarea
                  [(ngModel)]="complaintData.description"
                  name="description"
                  rows="4"
                  placeholder="What's the problem? (e.g., 'Belt slipping', 'Display not working', 'Making noise')"
                  class="textarea-field"
                ></textarea>
              </div>

              <!-- Photo Upload (Optional) -->
              <div class="form-field">
                <label>
                  <span class="material-icons">photo_camera</span>
                  Photo (Optional)
                </label>
                <div class="photo-upload" (click)="photoInput.click()">
                  @if (!photoPreview()) {
                    <div class="upload-placeholder">
                      <span class="material-icons">add_a_photo</span>
                      <span>Tap to add photo</span>
                      <small>JPG, PNG up to 5MB</small>
                    </div>
                  } @else {
                    <div class="photo-preview">
                      <img [src]="photoPreview()" alt="Preview" />
                      <button type="button" class="remove-photo" (click)="removePhoto(); $event.stopPropagation()">
                        <span class="material-icons">close</span>
                      </button>
                    </div>
                  }
                  <input
                    #photoInput
                    type="file"
                    accept="image/*"
                    (change)="onPhotoSelected($event)"
                    hidden
                  />
                </div>
              </div>

              <!-- LOCATION SECTION - FIXED -->
              <div class="form-field location-field">
                <label>
                  <span class="material-icons">location_on</span>
                  Service Location
                </label>

                <div class="location-controls">
                  <div class="search-box">
                    <span class="material-icons search-icon">search</span>
                    <input
                      #locationInput
                      type="text"
                      [(ngModel)]="locationQuery"
                      name="locationQuery"
                      placeholder="Search city, area, or address..."
                      class="location-input"
                      (keyup.enter)="searchLocation()"
                    />
                  </div>
                  <button type="button" class="search-btn" (click)="searchLocation()">
                    <span class="material-icons">search</span>
                    Search
                  </button>
                  <button type="button" class="locate-btn" (click)="getCurrentLocation()" title="Use my current location">
                    <span class="material-icons">my_location</span>
                  </button>
                </div>

                <!-- Search Results Dropdown -->
                @if (searchResults().length > 0) {
                  <div class="search-results-dropdown">
                    @for (result of searchResults(); track result.place_id) {
                      <div class="result-item" (click)="selectLocation(result)">
                        <span class="material-icons">place</span>
                        <div class="result-details">
                          <strong>{{ result.display_name.split(',')[0] }}</strong>
                          <small>{{ getShortAddress(result.display_name) }}</small>
                        </div>
                      </div>
                    }
                  </div>
                }

                <!-- Mini Map -->
                <div #miniMap class="mini-map"></div>

                <!-- Selected Location Display -->
                @if (complaintData.latitude && complaintData.longitude) {
                  <div class="selected-location-mini">
                    <span class="material-icons">check_circle</span>
                    <div>
                      <strong>Selected Location:</strong>
                      <span>{{ complaintData.locationName || 'Location selected' }}</span>
                    </div>
                  </div>
                }

                <!-- Loading Indicator for Search -->
                @if (isSearching()) {
                  <div class="search-loading">
                    <span class="spinner-small"></span>
                    Searching locations...
                  </div>
                }
              </div>

              <!-- Action Buttons -->
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">
                  Cancel
                </button>
                <button type="submit" class="btn-primary" [disabled]="isSubmitting() || !complaintData.subject">
                  @if (isSubmitting()) {
                    <span class="spinner"></span>
                  }
                  {{ isSubmitting() ? 'Submitting...' : 'Submit Quick Complaint' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- Success Toast -->
    @if (showSuccess()) {
      <div class="success-toast">
        <span class="material-icons">check_circle</span>
        <span>{{ successMessage() }}</span>
      </div>
    }
  `,
  styles: [`
    .quick-complaint-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 20px;
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;
      border: none;
      border-radius: 50px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 2px 8px rgba(255, 77, 30, 0.3);

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(255, 77, 30, 0.4);
      }

      &.floating {
        position: fixed;

        right: 24px;
        z-index: 1000;
        padding: 14px 24px;
        font-size: 16px;
      }

      .material-icons {
        font-size: 20px;
      }
    }

  .modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s ease;
  cursor: pointer; // This shows it's clickable
}

    .modal-container {
       cursor: default;
      background: white;
      border-radius: 24px;
      width: 90%;
      max-width: 550px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    }

    .modal-header {
      padding: 20px 24px;
      background: linear-gradient(135deg, #fff5f0, #fff);
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      gap: 16px;

      .header-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, #ff6b35, #ff4d1e);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;

        .material-icons {
          color: white;
          font-size: 28px;
        }
      }

      .header-text {
        flex: 1;

        h2 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1a1a1a;
        }

        p {
          margin: 4px 0 0;
          font-size: 12px;
          color: #666;
        }
      }

      .close-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: none;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s;

        &:hover {
          background: #e0e0e0;
        }

        .material-icons {
          font-size: 20px;
          color: #666;
        }
      }
    }

    .modal-body {
      padding: 24px;
      overflow-y: auto;
      flex: 1;
    }

    .form-field {
      margin-bottom: 20px;

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;

        .material-icons {
          font-size: 18px;
          color: #ff4d1e;
        }

        .required {
          color: #ff4d1e;
          font-size: 14px;
        }
      }

      &.error {
        .input-field {
          border-color: #ff4d1e;
          background: #fff5f0;
        }
      }
    }

    .location-field {
      position: relative;
    }

    .error-message {
      font-size: 11px;
      color: #ff4d1e;
      margin-top: 5px;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .input-field, .textarea-field {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid #e5e5e5;
      border-radius: 12px;
      font-size: 14px;
      font-family: inherit;
      transition: all 0.2s;

      &:focus {
        outline: none;
        border-color: #ff4d1e;
        box-shadow: 0 0 0 3px rgba(255, 77, 30, 0.1);
      }
    }

    .textarea-field {
      resize: vertical;
      min-height: 100px;
    }

    .photo-upload {
      border: 2px dashed #e5e5e5;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      overflow: hidden;

      &:hover {
        border-color: #ff4d1e;
        background: #fff5f0;
      }
    }

    .upload-placeholder {
      padding: 32px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      .material-icons {
        font-size: 48px;
        color: #999;
      }

      span {
        font-size: 14px;
        color: #666;
      }

      small {
        font-size: 11px;
        color: #999;
      }
    }

    .photo-preview {
      position: relative;
      width: 100%;
      height: 200px;

      img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .remove-photo {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: rgba(0, 0, 0, 0.8);
        }

        .material-icons {
          color: white;
          font-size: 18px;
        }
      }
    }

    .location-controls {
      display: flex;
      gap: 8px;
      margin-bottom: 12px;

      .search-box {
        flex: 2;
        position: relative;

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 18px;
          color: #999;
          pointer-events: none;
        }

        .location-input {
          width: 100%;
          padding: 10px 12px 10px 38px;
          border: 1.5px solid #e5e5e5;
          border-radius: 12px;
          font-size: 14px;

          &:focus {
            outline: none;
            border-color: #ff4d1e;
          }
        }
      }

      .search-btn, .locate-btn {
        padding: 0 16px;
        border: 1.5px solid #e5e5e5;
        border-radius: 12px;
        background: white;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 6px;
        font-weight: 500;

        &:hover {
          border-color: #ff4d1e;
          background: #fff5f0;
          color: #ff4d1e;
        }

        .material-icons {
          font-size: 18px;
        }
      }

      .search-btn {
        flex: 1;
        justify-content: center;
      }

      .locate-btn {
        padding: 0 14px;
      }
    }

    .search-results-dropdown {
      position: absolute;
      top: 100px;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      max-height: 250px;
      overflow-y: auto;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-top: 4px;

      .result-item {
        padding: 12px 16px;
        display: flex;
        gap: 12px;
        cursor: pointer;
        border-bottom: 1px solid #f0f0f0;
        transition: background 0.2s;

        &:hover {
          background: #fff5f0;
        }

        &:last-child {
          border-bottom: none;
        }

        .material-icons {
          color: #ff4d1e;
          font-size: 20px;
          flex-shrink: 0;
        }

        .result-details {
          flex: 1;
          min-width: 0;

          strong {
            display: block;
            font-size: 14px;
            color: #1a1a1a;
            margin-bottom: 2px;
          }

          small {
            font-size: 11px;
            color: #666;
            display: block;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }
        }
      }
    }

    .search-loading {
      padding: 12px;
      text-align: center;
      background: #f5f5f5;
      border-radius: 12px;
      margin-top: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
    }

    .mini-map {
      width: 100%;
      height: 200px;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid #e5e5e5;
      margin-top: 12px;
      background: #f5f5f5;
    }

    .selected-location-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #f0f9ff;
      border-radius: 10px;
      margin-top: 12px;
      font-size: 13px;

      .material-icons {
        font-size: 18px;
        color: #10b981;
        flex-shrink: 0;
      }

      div {
        flex: 1;

        strong {
          font-weight: 600;
          color: #1a1a1a;
          margin-right: 8px;
        }

        span {
          color: #555;
        }
      }
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
      padding-top: 20px;
      border-top: 1px solid #f0f0f0;
    }

    .btn-primary, .btn-secondary {
      flex: 1;
      padding: 12px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;
      border: none;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(255, 77, 30, 0.3);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-secondary {
      background: #f5f5f5;
      border: none;
      color: #666;

      &:hover {
        background: #e5e5e5;
      }
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0, 0, 0, 0.1);
      border-top-color: #ff4d1e;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .success-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 50px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      z-index: 2001;
      animation: slideUp 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

      .material-icons {
        font-size: 18px;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class QuickComplaintRegistrationComponent implements AfterViewInit {
  @ViewChild('miniMap') miniMapContainer!: ElementRef;
  @Output() complaintSubmitted = new EventEmitter<any>();

  isOpen = signal(false);
  isSubmitting = signal(false);
  showSuccess = signal(false);
  successMessage = signal('');
  searchResults = signal<any[]>([]);
  isSearching = signal(false);
  photoPreview = signal<string | null>(null);
  locationQuery = '';
  subjectTouched = false;

  complaintData: QuickComplaintData = {
    subject: '',
    category: '',
    brandName: '',
    modelNumber: '',
    description: '',
    latitude: null,
    longitude: null,
    locationName: ''
  };

  private selectedPhoto: File | null = null;
  private map: any;
  private marker: any;
  private readonly DEFAULT_LAT = 9.9312;
  private readonly DEFAULT_LNG = 76.2673;

  position: 'floating' | 'inline' = 'floating';

  constructor(private apiService: ApiService) {}

  ngAfterViewInit(): void {
    // Map will be initialized when modal opens
  }

  openModal(): void {
    this.isOpen.set(true);
    this.subjectTouched = false;
    setTimeout(() => {
      this.initMiniMap();
    }, 100);
  }

  // closeModal(): void {
  //   this.isOpen.set(false);
  //   if (this.map) {
  //     this.map.remove();
  //     this.map = null;
  //   }
  //   this.resetForm();
  // }

  resetForm(): void {
    this.complaintData = {
      subject: '',
      category: '',
      brandName: '',
      modelNumber: '',
      description: '',
      latitude: null,
      longitude: null,
      locationName: ''
    };
    this.locationQuery = '';
    this.selectedPhoto = null;
    this.photoPreview.set(null);
    this.searchResults.set([]);
    this.subjectTouched = false;
  }

  initMiniMap(): void {
    if (!this.miniMapContainer?.nativeElement) return;

    if (this.map) {
      this.map.remove();
    }

    this.map = L.map(this.miniMapContainer.nativeElement).setView([this.DEFAULT_LAT, this.DEFAULT_LNG], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const markerIcon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41]
    });

    this.marker = L.marker([this.DEFAULT_LAT, this.DEFAULT_LNG], {
      draggable: true,
      icon: markerIcon
    }).addTo(this.map);

    this.marker.on('dragend', (event: any) => {
      const pos = event.target.getLatLng();
      this.updateLocation(pos.lat, pos.lng);
    });

    this.map.on('click', (event: any) => {
      const { lat, lng } = event.latlng;
      this.marker.setLatLng([lat, lng]);
      this.updateLocation(lat, lng);
    });
  }

 async searchLocation(): Promise<void> {
  if (!this.locationQuery || this.locationQuery.trim().length < 2) {
    alert('Please enter at least 2 characters to search');
    return;
  }

  this.isSearching.set(true);
  this.searchResults.set([]);

  const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.locationQuery)}&limit=10&addressdetails=1&countrycodes=IN`;

  try {
    const data = await this.fetchWithRetry(searchUrl);
    this.isSearching.set(false);

    if (data && data.length > 0) {
      this.searchResults.set(data);
    } else {
      alert('No locations found. Try a different search term.');
    }
  } catch (error) {
    console.error('Search error:', error);
    this.isSearching.set(false);
    alert('Search failed. Please try again in a few moments.');
  }
}
private async fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'YourAppName/1.0'
        }
      });

      if (response.status === 429) {
        const waitTime = (i + 1) * 2000; // Wait 2s, 4s, 6s
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}
  selectLocation(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    console.log('Selected location:', { lat, lng, name: result.display_name });

    if (this.map && this.marker) {
      this.map.setView([lat, lng], 16);
      this.marker.setLatLng([lat, lng]);
      this.updateLocation(lat, lng, result.display_name);
    }

    // Update search input with the selected location name
    this.locationQuery = result.display_name.split(',')[0];

    // Clear search results
    this.searchResults.set([]);
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    // Show loading on button
    const locateBtn = document.querySelector('.locate-btn');
    const originalContent = locateBtn?.innerHTML;
    if (locateBtn) {
      locateBtn.innerHTML = '<span class="spinner-small"></span>';
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        console.log('Current location:', { lat, lng });

        // Reset button
        if (locateBtn) {
          locateBtn.innerHTML = originalContent || '<span class="material-icons">my_location</span>';
        }

        if (this.map && this.marker) {
          this.map.setView([lat, lng], 16);
          this.marker.setLatLng([lat, lng]);
          this.updateLocation(lat, lng);
        }

        this.locationQuery = 'Current Location';

        // Clear any existing search results
        this.searchResults.set([]);
      },
      (error) => {
        // Reset button
        if (locateBtn) {
          locateBtn.innerHTML = originalContent || '<span class="material-icons">my_location</span>';
        }

        console.error('Geolocation error:', error);
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

  updateLocation(lat: number, lng: number, address?: string): void {
    this.complaintData.latitude = lat;
    this.complaintData.longitude = lng;

    if (address) {
      const shortName = address.split(',')[0];
      this.complaintData.locationName = shortName;
      console.log('Location updated with address:', shortName);
    } else {
      this.reverseGeocode(lat, lng);
    }
  }

  reverseGeocode(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
      .then(res => res.json())
      .then(data => {
        if (data.display_name) {
          this.complaintData.locationName = data.display_name.split(',')[0];
          console.log('Reverse geocoded location:', this.complaintData.locationName);
        }
      })
      .catch(error => console.warn('Reverse geocoding error:', error));
  }

  getShortAddress(fullAddress: string): string {
    const parts = fullAddress.split(',');
    if (parts.length >= 3) {
      return parts.slice(0, 3).join(',').trim();
    }
    return fullAddress.substring(0, 60);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }
      this.selectedPhoto = file;
      const reader = new FileReader();
      reader.onload = () => this.photoPreview.set(reader.result as string);
      reader.readAsDataURL(this.selectedPhoto);
    }
  }

  removePhoto(): void {
    this.selectedPhoto = null;
    this.photoPreview.set(null);
  }

 // In your Angular component
submitQuickComplaint(): void {
    if (!this.complaintData.subject) {
        this.subjectTouched = true;
        return;
    }

    this.isSubmitting.set(true);

    // Prepare the request object
    const requestData: any = {
        subject: this.complaintData.subject,
        category: this.complaintData.category || '',
        brandName: this.complaintData.brandName || '',
        modelNumber: this.complaintData.modelNumber || '',
        description: this.complaintData.description || '',
        latitude: this.complaintData.latitude,
        longitude: this.complaintData.longitude,
        locationName: this.complaintData.locationName
    };

    // If there's a photo, convert to Base64
    if (this.selectedPhoto) {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            requestData.imageBase64 = base64String;
            requestData.imageName = this.selectedPhoto!.name;
            requestData.contentType = this.selectedPhoto!.type;

            // Send the request
            this.apiService.submitQuickComplaint(requestData).subscribe({
                next: (response) => {
                    this.isSubmitting.set(false);
                    if (response.success) {
                        this.showSuccessToast('Complaint submitted successfully!');
                        this.complaintSubmitted.emit(response);
                        setTimeout(() => this.closeModal(), 2000);
                    } else {
                     //   this.errorMsg.set(response.message || 'Failed to submit complaint');
                    }
                },
                error: (error) => {
                    this.isSubmitting.set(false);
                    console.error('Submission error:', error);
                    //this.errorMsg.set('Failed to submit complaint. Please try again.');
                }
            });
        };
        reader.readAsDataURL(this.selectedPhoto);
    } else {
        // Send without image
        this.apiService.submitQuickComplaint(requestData).subscribe({
            next: (response) => {
                this.isSubmitting.set(false);
                if (response.success) {
                    this.showSuccessToast('Complaint submitted successfully!');
                    this.complaintSubmitted.emit(response);
                    setTimeout(() => this.closeModal(), 2000);
                } else {
                    //this.errorMsg.set(response.message || 'Failed to submit complaint');
                }
            },
            error: (error) => {
                this.isSubmitting.set(false);
                console.error('Submission error:', error);
              //  this.errorMsg.set('Failed to submit complaint. Please try again.');
            }
        });
    }
}

private sendComplaint(data: any): void {
    this.apiService.submitQuickComplaint(data).subscribe({
        next: (response) => {
            this.isSubmitting.set(false);
            this.showSuccessToast('Complaint submitted successfully!');
            this.complaintSubmitted.emit(response);
            setTimeout(() => this.closeModal(), 2000);
        },
        error: (error) => {
            this.isSubmitting.set(false);
            console.error('Submission error:', error);
            alert('Failed to submit complaint. Please try again.');
        }
    });
}
  showSuccessToast(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3000);
  }
  closeModal(): void {
  this.isOpen.set(false);
  if (this.map) {
    this.map.remove();
    this.map = null;
  }
  this.resetForm();
}
}

export interface QuickComplaintData {
  subject: string;
  category: string;
  brandName: string;
  modelNumber: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
}
