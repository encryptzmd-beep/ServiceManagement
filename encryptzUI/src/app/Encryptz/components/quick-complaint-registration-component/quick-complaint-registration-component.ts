import { Component, ElementRef, EventEmitter, Output, ViewChild, signal, AfterViewInit, NgZone } from '@angular/core';
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
      <div class="modal-overlay" (click)="closeModal()">
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

              <!-- SUBJECT -->
              <div class="form-field" [class.error]="subjectTouched && !complaintData.subject">
                <label>
                  <span class="material-icons">title</span>
                  Subject <span class="required">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="complaintData.subject"
                  name="subject"
                  required
                  placeholder="e.g., Treadmill not working, Dumbbell damaged..."
                  class="input-field"
                  (blur)="subjectTouched = true"
                />
                @if (subjectTouched && !complaintData.subject) {
                  <div class="error-message">
                    <span class="material-icons" style="font-size:14px">error_outline</span>
                    Subject is required
                  </div>
                }
              </div>

              <!-- Category -->
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

              <!-- Brand Name -->
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

              <!-- Model Number -->
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
                  rows="3"
                  placeholder="What's the problem? (e.g., 'Belt slipping', 'Display not working', 'Making noise')"
                  class="textarea-field"
                ></textarea>
              </div>

              <!-- PHOTO UPLOAD — Mobile-first with camera support -->
              <div class="form-field">
                <label>
                  <span class="material-icons">photo_camera</span>
                  Photo (Optional)
                </label>

                <!-- Upload progress bar -->
                @if (uploadProgress() > 0 && uploadProgress() < 100) {
                  <div class="upload-progress-wrap">
                    <div class="upload-progress-label">
                      <span class="material-icons spin" style="font-size:16px;color:#ff4d1e">autorenew</span>
                      Compressing & uploading... {{ uploadProgress() }}%
                    </div>
                    <div class="upload-progress-bar">
                      <div class="upload-progress-fill" [style.width.%]="uploadProgress()"></div>
                    </div>
                  </div>
                }

                @if (!photoPreview()) {
                  <!-- Mobile-aware photo buttons -->
                  <div class="photo-btn-row">
                    <!-- Camera capture (mobile opens camera directly) -->
                    <button type="button" class="photo-action-btn camera-btn" (click)="cameraInput.click()">
                      <span class="material-icons">photo_camera</span>
                      <span>Take Photo</span>
                    </button>
                    <!-- Gallery picker -->
                    <button type="button" class="photo-action-btn gallery-btn" (click)="galleryInput.click()">
                      <span class="material-icons">photo_library</span>
                      <span>Choose Photo</span>
                    </button>
                  </div>

                  <!-- Hidden: camera capture input -->
                  <input
                    #cameraInput
                    type="file"
                    accept="image/*"
                    capture="environment"
                    (change)="onPhotoSelected($event)"
                    hidden
                  />
                  <!-- Hidden: gallery picker input (NO capture attr = shows gallery on mobile) -->
                  <input
                    #galleryInput
                    type="file"
                    accept="image/*"
                    (change)="onPhotoSelected($event)"
                    hidden
                  />

                  <p class="photo-hint">No size limit — large photos are auto-compressed</p>
                } @else {
                  <div class="photo-preview-box">
                    <img [src]="photoPreview()" alt="Preview" class="photo-preview-img" />
                    <div class="photo-preview-overlay">
                      <button type="button" class="remove-photo-btn" (click)="removePhoto()">
                        <span class="material-icons">delete</span>
                        Remove
                      </button>
                    </div>
                    @if (photoFileSizeLabel()) {
                      <div class="photo-size-badge">{{ photoFileSizeLabel() }}</div>
                    }
                  </div>
                }
              </div>

              <!-- LOCATION -->
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
                      autocomplete="off"
                    />
                  </div>
                  <div class="location-btn-row">
                    <button type="button" class="search-btn" (click)="searchLocation()">
                      <span class="material-icons">search</span>
                      Search
                    </button>
                    <button type="button" class="locate-btn" (click)="getCurrentLocation()" title="Use my current location">
                      <span class="material-icons">my_location</span>
                    </button>
                  </div>
                </div>

                @if (isSearching()) {
                  <div class="search-loading">
                    <span class="spinner-small"></span>
                    Searching locations...
                  </div>
                }

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

                @if (complaintData.latitude && complaintData.longitude) {
                  <div class="selected-location-mini">
                    <span class="material-icons">check_circle</span>
                    <div>
                      <strong>Selected:</strong>
                      <span>{{ complaintData.locationName || 'Location selected' }}</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Action Buttons -->
              <div class="modal-actions">
                <button type="button" class="btn-secondary" (click)="closeModal()">
                  Cancel
                </button>
                <button
                  type="submit"
                  class="btn-primary"
                  [disabled]="isSubmitting() || !complaintData.subject || uploadProgress() > 0 && uploadProgress() < 100"
                >
                  @if (isSubmitting()) {
                    <span class="spinner"></span>
                    {{ loadingStatus() || 'Submitting...' }}
                  } @else {
                    <span class="material-icons">send</span>
                    Submit Complaint
                  }
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
    /* ===== BUTTON ===== */
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
      -webkit-tap-highlight-color: transparent;

      &:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(255, 77, 30, 0.4);
      }

      &.floating {
        position: fixed;
        bottom: 80px;
        right: 16px;
        z-index: 1000;
        padding: 14px 20px;
        font-size: 15px;
      }

      .material-icons { font-size: 20px; }
    }

    /* ===== OVERLAY ===== */
    .modal-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(4px);
      z-index: 2000;
      display: flex;
      align-items: flex-end;       /* mobile: slide from bottom */
      justify-content: center;
      animation: fadeIn 0.2s ease;
      padding: 0;
    }

    /* ===== MODAL CONTAINER ===== */
    .modal-container {
      cursor: default;
      background: white;
      border-radius: 24px 24px 0 0;   /* mobile: rounded top only */
      width: 100%;
      max-width: 100%;
      max-height: 95dvh;              /* use dvh for mobile browser chrome */
      height: 95dvh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: slideUpModal 0.35s cubic-bezier(0.34, 1.2, 0.64, 1);
      box-shadow: 0 -4px 40px rgba(0,0,0,0.25);
    }

    /* Desktop: centered card */
    @media (min-width: 640px) {
      .modal-overlay {
        align-items: center;
        padding: 16px;
      }
      .modal-container {
        border-radius: 24px;
        width: 90%;
        max-width: 560px;
        height: auto;
        max-height: 90vh;
        animation: slideUp 0.3s ease;
      }
    }

    /* ===== HEADER ===== */
    .modal-header {
      padding: 16px 20px;
      background: linear-gradient(135deg, #fff5f0, #fff);
      border-bottom: 1px solid #f0f0f0;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;

      /* Drag handle hint on mobile */
      &::before {
        content: '';
        position: absolute;
        top: 8px;
        left: 50%;
        transform: translateX(-50%);
        width: 40px;
        height: 4px;
        background: #ddd;
        border-radius: 2px;
      }
    }

    .header-icon {
      width: 44px;
      height: 44px;
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .material-icons { color: white; font-size: 24px; }
    }

    .header-text {
      flex: 1;
      h2 { margin: 0; font-size: 18px; font-weight: 700; color: #1a1a1a; }
      p  { margin: 2px 0 0; font-size: 12px; color: #888; }
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
      flex-shrink: 0;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.2s;

      &:hover { background: #e0e0e0; }
      .material-icons { font-size: 20px; color: #666; }
    }

    /* ===== BODY ===== */
    .modal-body {
      padding: 16px 16px 24px;
      overflow-y: auto;
      flex: 1;
      -webkit-overflow-scrolling: touch;

      /* iOS rubber-band scrolling fix */
      overscroll-behavior: contain;
    }

    @media (min-width: 640px) {
      .modal-body { padding: 24px; }
    }

    /* ===== FORM FIELDS ===== */
    .form-field {
      margin-bottom: 18px;

      label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        color: #333;
        margin-bottom: 8px;

        .material-icons { font-size: 17px; color: #ff4d1e; }
        .required       { color: #ff4d1e; }
      }

      &.error .input-field {
        border-color: #ff4d1e;
        background: #fff5f0;
      }
    }

    .location-field { position: relative; }

    .error-message {
      font-size: 12px;
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
      font-size: 16px;   /* 16px prevents iOS auto-zoom on focus */
      font-family: inherit;
      transition: all 0.2s;
      box-sizing: border-box;
      background: white;
      -webkit-appearance: none;

      &:focus {
        outline: none;
        border-color: #ff4d1e;
        box-shadow: 0 0 0 3px rgba(255,77,30,0.1);
      }
    }

    .textarea-field {
      resize: vertical;
      min-height: 90px;
    }

    /* ===== PHOTO UPLOAD — mobile-first ===== */
    .photo-btn-row {
      display: flex;
      gap: 10px;
    }

    .photo-action-btn {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 16px 12px;
      border: 2px dashed #e5e5e5;
      border-radius: 14px;
      background: #fafafa;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 13px;
      font-weight: 600;
      color: #555;
      -webkit-tap-highlight-color: transparent;

      .material-icons { font-size: 28px; }

      &:hover, &:active {
        border-color: #ff4d1e;
        background: #fff5f0;
        color: #ff4d1e;
      }
    }

    .camera-btn .material-icons { color: #ff4d1e; }
    .gallery-btn .material-icons { color: #6366f1; }

    .photo-hint {
      font-size: 11px;
      color: #aaa;
      text-align: center;
      margin: 8px 0 0;
    }

    /* Photo preview */
    .photo-preview-box {
      position: relative;
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid #e5e5e5;
    }

    .photo-preview-img {
      width: 100%;
      max-height: 220px;
      object-fit: cover;
      display: block;
    }

    .photo-preview-overlay {
      position: absolute;
      bottom: 0; left: 0; right: 0;
      padding: 12px;
      background: linear-gradient(transparent, rgba(0,0,0,0.6));
      display: flex;
      justify-content: flex-end;
    }

    .remove-photo-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
      background: rgba(255,255,255,0.9);
      border: none;
      border-radius: 20px;
      font-size: 13px;
      font-weight: 600;
      color: #e53e3e;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;

      .material-icons { font-size: 16px; }
    }

    .photo-size-badge {
      position: absolute;
      top: 8px; left: 8px;
      background: rgba(0,0,0,0.6);
      color: white;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 10px;
    }

    /* ===== UPLOAD PROGRESS ===== */
    .upload-progress-wrap {
      margin-bottom: 10px;
    }

    .upload-progress-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #ff4d1e;
      margin-bottom: 6px;
    }

    .upload-progress-bar {
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .upload-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff6b35, #ff4d1e);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* Spin animation */
    .spin {
      animation: spin 1s linear infinite;
    }

    /* ===== LOCATION CONTROLS ===== */
    .location-controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 10px;
    }

    .search-box {
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
        padding: 12px 12px 12px 40px;
        border: 1.5px solid #e5e5e5;
        border-radius: 12px;
        font-size: 16px;
        box-sizing: border-box;
        background: white;
        -webkit-appearance: none;

        &:focus {
          outline: none;
          border-color: #ff4d1e;
        }
      }
    }

    .location-btn-row {
      display: flex;
      gap: 8px;
    }

    .search-btn {
      flex: 1;
      padding: 12px;
      border: 1.5px solid #e5e5e5;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;

      &:hover { border-color: #ff4d1e; background: #fff5f0; color: #ff4d1e; }
      .material-icons { font-size: 18px; }
    }

    .locate-btn {
      padding: 12px 16px;
      border: 1.5px solid #e5e5e5;
      border-radius: 12px;
      background: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;

      &:hover { border-color: #ff4d1e; background: #fff5f0; color: #ff4d1e; }
      .material-icons { font-size: 22px; }
    }

    .search-results-dropdown {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      max-height: 200px;
      overflow-y: auto;
      z-index: 100;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
      margin-bottom: 8px;

      .result-item {
        padding: 12px 14px;
        display: flex;
        gap: 10px;
        cursor: pointer;
        border-bottom: 1px solid #f5f5f5;
        transition: background 0.15s;
        -webkit-tap-highlight-color: transparent;

        &:hover, &:active { background: #fff5f0; }
        &:last-child { border-bottom: none; }

        .material-icons { color: #ff4d1e; font-size: 20px; flex-shrink: 0; margin-top: 2px; }

        .result-details {
          flex: 1; min-width: 0;
          strong { display: block; font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }
          small  { font-size: 11px; color: #888; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
      }
    }

    .search-loading {
      padding: 10px 12px;
      background: #f9f9f9;
      border-radius: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }

    .mini-map {
      width: 100%;
      height: 180px;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid #e5e5e5;
      background: #f5f5f5;
    }

    .selected-location-mini {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #f0f9ff;
      border-radius: 10px;
      margin-top: 10px;
      font-size: 13px;

      .material-icons { font-size: 18px; color: #10b981; flex-shrink: 0; }
      div { flex: 1; }
      strong { font-weight: 600; color: #1a1a1a; margin-right: 6px; }
      span   { color: #555; }
    }

    /* ===== ACTIONS ===== */
    .modal-actions {
      display: flex;
      gap: 10px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }

    .btn-primary, .btn-secondary {
      flex: 1;
      padding: 14px 12px;
      border-radius: 12px;
      font-weight: 600;
      font-size: 15px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: none;
      -webkit-tap-highlight-color: transparent;
      /* min touch target */
      min-height: 48px;
    }

    .btn-primary {
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;

      .material-icons { font-size: 20px; }

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(255,77,30,0.35);
      }

      &:active:not(:disabled) { transform: translateY(0); }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-secondary {
      background: #f5f5f5;
      color: #666;

      &:hover  { background: #e8e8e8; }
      &:active { background: #ddd; }
    }

    /* ===== SPINNERS ===== */
    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    .spinner-small {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.1);
      border-top-color: #ff4d1e;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* ===== SUCCESS TOAST ===== */
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
      font-weight: 600;
      z-index: 3000;
      animation: slideUp 0.3s ease;
      box-shadow: 0 4px 16px rgba(16,185,129,0.4);
      white-space: nowrap;

      .material-icons { font-size: 20px; }
    }

    /* ===== ANIMATIONS ===== */
    @keyframes fadeIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }

    @keyframes slideUpModal {
      from { transform: translateY(100%); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class QuickComplaintRegistrationComponent implements AfterViewInit {
  @ViewChild('miniMap') miniMapContainer!: ElementRef;
  @Output() complaintSubmitted = new EventEmitter<any>();

  isOpen        = signal(false);
  isSubmitting  = signal(false);
  showSuccess   = signal(false);
  successMessage= signal('');
  loadingStatus = signal('');
  searchResults = signal<any[]>([]);
  isSearching   = signal(false);
  photoPreview  = signal<string | null>(null);
  uploadProgress= signal(0);            // 0–100 for progress bar
  photoFileSizeLabel = signal<string>('');

  locationQuery   = '';
  subjectTouched  = false;

  complaintData: QuickComplaintData = this.emptyComplaint();

  private selectedPhoto: File | null = null;
  private compressedBase64: string | null = null;   // holds the final base64
  private map: any;
  private marker: any;
  private readonly DEFAULT_LAT = 9.9312;
  private readonly DEFAULT_LNG = 76.2673;

  position: 'floating' | 'inline' = 'floating';

  constructor(private apiService: ApiService, private ngZone: NgZone) {}

  ngAfterViewInit(): void {}

  private emptyComplaint(): QuickComplaintData {
    return {
      subject: '', category: '', brandName: '', modelNumber: '',
      description: '', latitude: null, longitude: null, locationName: ''
    };
  }

  // ─── Modal Open / Close ──────────────────────────────────────────────────

  openModal(): void {
    this.isOpen.set(true);
    this.subjectTouched = false;
    setTimeout(() => this.initMiniMap(), 150);
  }

  closeModal(): void {
    this.isOpen.set(false);
    if (this.map) { this.map.remove(); this.map = null; }
    this.resetForm();
  }

  resetForm(): void {
    this.complaintData    = this.emptyComplaint();
    this.locationQuery    = '';
    this.selectedPhoto    = null;
    this.compressedBase64 = null;
    this.photoPreview.set(null);
    this.photoFileSizeLabel.set('');
    this.searchResults.set([]);
    this.subjectTouched   = false;
    this.uploadProgress.set(0);
  }

  // ─── Map ─────────────────────────────────────────────────────────────────

  initMiniMap(): void {
    if (!this.miniMapContainer?.nativeElement) return;
    if (this.map) this.map.remove();

    this.map = L.map(this.miniMapContainer.nativeElement).setView([this.DEFAULT_LAT, this.DEFAULT_LNG], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const markerIcon = L.icon({
      iconUrl:    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl:  'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize:   [25, 41],
      iconAnchor: [12, 41]
    });

    this.marker = L.marker([this.DEFAULT_LAT, this.DEFAULT_LNG], { draggable: true, icon: markerIcon }).addTo(this.map);

    this.marker.on('dragend', (e: any) => {
      const { lat, lng } = e.target.getLatLng();
      this.updateLocation(lat, lng);
    });

    this.map.on('click', (e: any) => {
      const { lat, lng } = e.latlng;
      this.marker.setLatLng([lat, lng]);
      this.updateLocation(lat, lng);
    });
  }

  // ─── Location Search ─────────────────────────────────────────────────────

  async searchLocation(): Promise<void> {
    if (!this.locationQuery || this.locationQuery.trim().length < 2) return;

    this.isSearching.set(true);
    this.searchResults.set([]);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.locationQuery)}&limit=10&addressdetails=1&countrycodes=IN`;

    try {
      const data = await this.fetchWithRetry(url);
      this.ngZone.run(() => {
        this.isSearching.set(false);
        if (data?.length > 0) {
          this.searchResults.set(data);
        } else {
          alert('No locations found. Try a different search term.');
        }
      });
    } catch {
      this.ngZone.run(() => {
        this.isSearching.set(false);
        alert('Search failed. Please try again.');
      });
    }
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'FelixServiceApp/1.0' } });
        if (res.status === 429) {
          await new Promise(r => setTimeout(r, (i + 1) * 2000));
          continue;
        }
        return await res.json();
      } catch (err) {
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  selectLocation(result: any): void {
    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);
    if (this.map && this.marker) {
      this.map.setView([lat, lng], 16);
      this.marker.setLatLng([lat, lng]);
      this.updateLocation(lat, lng, result.display_name);
    }
    this.locationQuery = result.display_name.split(',')[0];
    this.searchResults.set([]);
  }

  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        this.ngZone.run(() => {
          if (this.map && this.marker) {
            this.map.setView([lat, lng], 16);
            this.marker.setLatLng([lat, lng]);
            this.updateLocation(lat, lng);
          }
          this.locationQuery = 'Current Location';
          this.searchResults.set([]);
        });
      },
      (err) => {
        let msg = 'Unable to get your location. ';
        if (err.code === err.PERMISSION_DENIED)    msg += 'Please allow location access.';
        else if (err.code === err.POSITION_UNAVAILABLE) msg += 'Location unavailable.';
        else if (err.code === err.TIMEOUT)         msg += 'Request timed out.';
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  updateLocation(lat: number, lng: number, address?: string): void {
    this.complaintData.latitude  = lat;
    this.complaintData.longitude = lng;
    if (address) {
      this.complaintData.locationName = address.split(',')[0];
    } else {
      this.reverseGeocode(lat, lng);
    }
  }

  reverseGeocode(lat: number, lng: number): void {
    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
      .then(r => r.json())
      .then(data => {
        if (data.display_name) {
          this.ngZone.run(() => {
            this.complaintData.locationName = data.display_name.split(',')[0];
          });
        }
      })
      .catch(() => {});
  }

  getShortAddress(full: string): string {
    const parts = full.split(',');
    return parts.length >= 3 ? parts.slice(0, 3).join(', ').trim() : full.substring(0, 60);
  }

  // ─── Photo Selection — with compression & progress ───────────────────────

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;

    const file = input.files[0];
    this.selectedPhoto = file;

    // Show a preview immediately from the original
    const previewReader = new FileReader();
    previewReader.onload = () => {
      this.ngZone.run(() => this.photoPreview.set(previewReader.result as string));
    };
    previewReader.readAsDataURL(file);

    // Compress asynchronously and show progress
    this.compressImage(file);

    // Reset input so same file can be selected again
    input.value = '';
  }

  private compressImage(file: File): void {
    this.uploadProgress.set(10);

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      this.ngZone.run(() => this.uploadProgress.set(30));

      const MAX_W = 1280;
      const MAX_H = 1280;
      let { width, height } = img;

      if (width > MAX_W || height > MAX_H) {
        const ratio = Math.min(MAX_W / width, MAX_H / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      this.ngZone.run(() => this.uploadProgress.set(70));

      // Try quality 0.8 first; if still > 1 MB try 0.6
      let quality = 0.8;
      let base64  = canvas.toDataURL('image/jpeg', quality);

      if (base64.length > 1_400_000) {          // ~ 1 MB base64
        base64 = canvas.toDataURL('image/jpeg', 0.6);
      }

      URL.revokeObjectURL(objectUrl);

      this.ngZone.run(() => {
        this.compressedBase64 = base64;
        const kb = Math.round((base64.length * 0.75) / 1024);
        this.photoFileSizeLabel.set(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
        this.uploadProgress.set(100);
        // Reset progress bar after short delay
        setTimeout(() => this.ngZone.run(() => this.uploadProgress.set(0)), 800);
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      this.ngZone.run(() => {
        this.uploadProgress.set(0);
        alert('Failed to read the image. Please try another photo.');
      });
    };

    img.src = objectUrl;
  }

  removePhoto(): void {
    this.selectedPhoto    = null;
    this.compressedBase64 = null;
    this.photoPreview.set(null);
    this.photoFileSizeLabel.set('');
    this.uploadProgress.set(0);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  submitQuickComplaint(): void {
    if (!this.complaintData.subject) {
      this.subjectTouched = true;
      return;
    }

    this.isSubmitting.set(true);
    this.loadingStatus.set('Preparing...');

    const payload: any = {
      subject:      this.complaintData.subject,
      category:     this.complaintData.category     || '',
      brandName:    this.complaintData.brandName     || '',
      modelNumber:  this.complaintData.modelNumber   || '',
      description:  this.complaintData.description   || '',
      latitude:     this.complaintData.latitude,
      longitude:    this.complaintData.longitude,
      locationName: this.complaintData.locationName
    };

    if (this.compressedBase64 && this.selectedPhoto) {
      payload.imageBase64  = this.compressedBase64;
      payload.imageName    = this.selectedPhoto.name;
      payload.contentType  = 'image/jpeg';
      this.loadingStatus.set('Uploading...');
    }

    this.apiService.submitQuickComplaint(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.loadingStatus.set('');
        if (res.success) {
          this.showSuccessToast('Complaint submitted successfully!');
          this.complaintSubmitted.emit(res);
          setTimeout(() => this.closeModal(), 2000);
        } else {
          alert(res.message || 'Failed to submit complaint');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loadingStatus.set('');
        console.error('Submission error:', err);
        alert('Failed to submit. Please check your network and try again.');
      }
    });
  }

  showSuccessToast(message: string): void {
    this.successMessage.set(message);
    this.showSuccess.set(true);
    setTimeout(() => this.showSuccess.set(false), 3500);
  }
}

// ─── Interface ───────────────────────────────────────────────────────────────

export interface QuickComplaintData {
  subject:      string;
  category:     string;
  brandName:    string;
  modelNumber:  string;
  description:  string;
  latitude:     number | null;
  longitude:    number | null;
  locationName: string;
}
