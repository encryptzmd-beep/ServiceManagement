import { Component, ElementRef, ViewChild, signal, AfterViewInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

declare var L: any;

@Component({
  selector: 'app-public-quick-complaint',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-wrapper">
      <div class="page-card">

        <!-- Header -->
        <div class="page-header">
          <div class="header-icon">
            <span class="material-icons">flash_on</span>
          </div>
          <div>
            <h1>Quick Complaint</h1>
            <p>Report an equipment issue in seconds</p>
          </div>
        </div>

        <!-- ── PHASE 1: Identity ─────────────────────────────────────────── -->
        <div class="section identity-section">
          <div class="section-title">
            <span class="material-icons">person</span>
            Your Details
          </div>

          <!-- Mobile number -->
          <div class="form-field" [class.error]="mobileTouched && !isValidMobile()">
            <label>
              <span class="material-icons">phone</span>
              Mobile Number <span class="req">*</span>
            </label>
            <div class="mobile-row">
              <input
                type="tel"
                [(ngModel)]="mobile"
                name="mobile"
                maxlength="10"
                placeholder="10-digit mobile number"
                class="input-field"
                (blur)="onMobileBlur()"
                (input)="onMobileInput()"
                inputmode="numeric"
                [disabled]="identityConfirmed()"
              />
              @if (identityConfirmed()) {
                <button class="change-btn" type="button" (click)="resetIdentity()">
                  <span class="material-icons">edit</span>
                  Change
                </button>
              }
            </div>
            @if (mobileTouched && !isValidMobile()) {
              <div class="error-msg">
                <span class="material-icons">error_outline</span>
                Enter a valid 10-digit number
              </div>
            }
          </div>

          <!-- Lookup spinner -->
          @if (isLooking()) {
            <div class="lookup-status">
              <span class="spinner-small"></span>
              Checking mobile number...
            </div>
          }

          <!-- Existing customer badge -->
          @if (isExistingCustomer() && !isLooking()) {
            <div class="existing-badge">
              <span class="material-icons">verified</span>
              Existing customer found — details pre-filled
            </div>
          }

          <!-- Name field -->
          @if (showIdentityFields()) {
            <div class="form-field" [class.error]="nameTouched && !name.trim()">
              <label>
                <span class="material-icons">badge</span>
                Full Name <span class="req">*</span>
              </label>
              <input
                type="text"
                [(ngModel)]="name"
                name="name"
                placeholder="Your full name"
                class="input-field"
                [readonly]="isExistingCustomer()"
                [class.readonly]="isExistingCustomer()"
                (blur)="nameTouched = true"
              />
              @if (nameTouched && !name.trim()) {
                <div class="error-msg">
                  <span class="material-icons">error_outline</span>
                  Name is required
                </div>
              }
            </div>

            <!-- Email field -->
            <div class="form-field">
              <label>
                <span class="material-icons">email</span>
                Email @if (!isExistingCustomer()) { <span class="optional">(optional)</span> }
              </label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="you@example.com"
                class="input-field"
                [readonly]="isExistingCustomer()"
                [class.readonly]="isExistingCustomer()"
                inputmode="email"
              />
            </div>

            @if (!identityConfirmed()) {
              <button
                class="btn-continue"
                type="button"
                (click)="confirmIdentity()"
                [disabled]="!isValidMobile() || !name.trim()"
              >
                <span class="material-icons">arrow_downward</span>
                Continue to Complaint
              </button>
            }
          }
        </div>

        <!-- ── PHASE 2: Complaint Form (accordion) ─────────────────────── -->
        @if (identityConfirmed()) {
          <div class="section complaint-section">
            <div class="section-title">
              <span class="material-icons">report_problem</span>
              Complaint Details
            </div>

            <form (ngSubmit)="submit()" #complaintForm="ngForm">

              <!-- Subject -->
              <div class="form-field" [class.error]="subjectTouched && !subject.trim()">
                <label>
                  <span class="material-icons">title</span>
                  Subject <span class="req">*</span>
                </label>
                <input
                  type="text"
                  [(ngModel)]="subject"
                  name="subject"
                  required
                  placeholder="e.g., Treadmill not working, Dumbbell damaged..."
                  class="input-field"
                  (blur)="subjectTouched = true"
                />
                @if (subjectTouched && !subject.trim()) {
                  <div class="error-msg">
                    <span class="material-icons">error_outline</span>
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
                <select [(ngModel)]="category" name="category" class="input-field">
                  <option value="">Select category (optional)</option>
                  <option value="Treadmill">Treadmill</option>
                  <option value="Elliptical">Elliptical Trainer</option>
                  <option value="Exercise Bike">Exercise Bike</option>
                  <option value="Rowing Machine">Rowing Machine</option>
                  <option value="Weight Bench">Weight Bench</option>
                  <option value="Dumbbells">Dumbbells</option>
                  <option value="Barbell">Barbell</option>
                  <option value="Pull Up Bar">Pull Up Bar</option>
                  <option value="Cable Machine">Cable Machine</option>
                  <option value="Leg Press">Leg Press</option>
                  <option value="Smith Machine">Smith Machine</option>
                  <option value="Cross Trainer">Cross Trainer</option>
                  <option value="Yoga Mat">Yoga Mat</option>
                  <option value="Kettlebell">Kettlebell</option>
                  <option value="Other Gym Equipment">Other Gym Equipment</option>
                </select>
              </div>

              <!-- Brand -->
              <div class="form-field">
                <label>
                  <span class="material-icons">branding_watermark</span>
                  Brand Name
                </label>
                <input
                  type="text"
                  [(ngModel)]="brandName"
                  name="brandName"
                  placeholder="e.g., NordicTrack, Bowflex, Life Fitness..."
                  class="input-field"
                />
              </div>

              <!-- Model -->
              <div class="form-field">
                <label>
                  <span class="material-icons">qr_code</span>
                  Model Number
                </label>
                <input
                  type="text"
                  [(ngModel)]="modelNumber"
                  name="modelNumber"
                  placeholder="e.g., T-9.5, 1750, RW900..."
                  class="input-field"
                />
              </div>

              <!-- Description -->
              <div class="form-field">
                <label>
                  <span class="material-icons">description</span>
                  Describe the issue
                </label>
                <textarea
                  [(ngModel)]="description"
                  name="description"
                  rows="3"
                  placeholder="What's the problem? (e.g., 'Belt slipping', 'Display not working', 'Making noise')"
                  class="textarea-field"
                ></textarea>
              </div>

              <!-- Photo Upload -->
              <div class="form-field">
                <label>
                  <span class="material-icons">photo_camera</span>
                  Photo <span class="optional">(optional)</span>
                </label>

                @if (uploadProgress() > 0 && uploadProgress() < 100) {
                  <div class="progress-wrap">
                    <div class="progress-label">
                      <span class="material-icons spin">autorenew</span>
                      Compressing... {{ uploadProgress() }}%
                    </div>
                    <div class="progress-bar">
                      <div class="progress-fill" [style.width.%]="uploadProgress()"></div>
                    </div>
                  </div>
                }

                @if (!photoPreview()) {
                  <div class="photo-btn-row">
                    <button type="button" class="photo-btn camera-btn" (click)="cameraInput.click()">
                      <span class="material-icons">photo_camera</span>
                      <span>Take Photo</span>
                    </button>
                    <button type="button" class="photo-btn gallery-btn" (click)="galleryInput.click()">
                      <span class="material-icons">photo_library</span>
                      <span>Choose Photo</span>
                    </button>
                  </div>
                  <input #cameraInput type="file" accept="image/*" capture="environment" (change)="onPhotoSelected($event)" hidden />
                  <input #galleryInput type="file" accept="image/*" (change)="onPhotoSelected($event)" hidden />
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
                    @if (photoSizeLabel()) {
                      <div class="photo-size-badge">{{ photoSizeLabel() }}</div>
                    }
                  </div>
                }
              </div>

              <!-- Location -->
              <div class="form-field location-field">
                <label>
                  <span class="material-icons">location_on</span>
                  Service Location <span class="optional">(optional)</span>
                </label>

                <div class="location-controls">
                  <div class="search-box">
                    <span class="material-icons search-icon">search</span>
                    <input
                      type="text"
                      [(ngModel)]="locationQuery"
                      name="locationQuery"
                      placeholder="Search city, area, or address..."
                      class="location-input"
                      (keyup.enter)="searchLocation()"
                      autocomplete="off"
                    />
                  </div>
                  <div class="loc-btn-row">
                    <button type="button" class="search-btn" (click)="searchLocation()">
                      <span class="material-icons">search</span>
                      Search
                    </button>
                    <button type="button" class="locate-btn" (click)="getCurrentLocation()" title="Use my location">
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
                  <div class="search-results">
                    @for (r of searchResults(); track r.place_id) {
                      <div class="result-item" (click)="selectLocation(r)">
                        <span class="material-icons">place</span>
                        <div class="result-detail">
                          <strong>{{ r.display_name.split(',')[0] }}</strong>
                          <small>{{ shortAddress(r.display_name) }}</small>
                        </div>
                      </div>
                    }
                  </div>
                }

                <div #miniMap class="mini-map"></div>

                @if (latitude && longitude) {
                  <div class="location-selected">
                    <span class="material-icons">check_circle</span>
                    <div>
                      <strong>Selected:</strong>
                      <span>{{ locationName || 'Location selected' }}</span>
                    </div>
                  </div>
                }
              </div>

              <!-- Submit -->
              <button
                type="submit"
                class="btn-submit"
                [disabled]="isSubmitting() || !subject.trim() || (uploadProgress() > 0 && uploadProgress() < 100)"
              >
                @if (isSubmitting()) {
                  <span class="spinner"></span>
                  {{ loadingStatus() || 'Submitting...' }}
                } @else {
                  <span class="material-icons">send</span>
                  Submit Complaint
                }
              </button>

            </form>
          </div>
        }

        <!-- Footer link -->
        <!-- <div class="page-footer">
          Already have an account?
          <a href="/customer/login">Login here</a>
        </div> -->

      </div>
    </div>

    <!-- Success Toast -->
    @if (showSuccess()) {
      <div class="success-toast">
        <span class="material-icons">check_circle</span>
        <div>
          <strong>Complaint Submitted!</strong>
          <p>{{ successMessage() }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    /* ─── Page layout ─────────────────────────────────────────────────────── */
    .page-wrapper {
      min-height: 100dvh;
      background: linear-gradient(135deg, #0d1b2a 0%, #1a2d44 60%, #0f2235 100%);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 16px 16px 40px;
      box-sizing: border-box;
    }

    .page-card {
      width: 100%;
      max-width: 540px;
      background: #fff;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 48px rgba(0,0,0,0.35);
    }

    /* ─── Header ──────────────────────────────────────────────────────────── */
    .page-header {
      padding: 24px 20px;
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;
      display: flex;
      align-items: center;
      gap: 16px;

      h1 { margin: 0; font-size: 22px; font-weight: 700; }
      p  { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    }

    .header-icon {
      width: 52px;
      height: 52px;
      background: rgba(255,255,255,0.2);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;

      .material-icons { font-size: 30px; }
    }

    /* ─── Sections ────────────────────────────────────────────────────────── */
    .section {
      padding: 20px;
      border-bottom: 1px solid #f0f0f0;

      &:last-of-type { border-bottom: none; }
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 700;
      color: #1a1a1a;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;

      .material-icons { font-size: 18px; color: #ff4d1e; }
    }

    /* ─── Form fields ─────────────────────────────────────────────────────── */
    .form-field {
      margin-bottom: 16px;

      label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 600;
        color: #444;
        margin-bottom: 8px;

        .material-icons { font-size: 16px; color: #ff4d1e; }
      }

      &.error .input-field {
        border-color: #ff4d1e;
        background: #fff5f0;
      }
    }

    .req { color: #ff4d1e; font-weight: 700; }
    .optional { color: #aaa; font-weight: 400; font-size: 11px; }

    .input-field, .textarea-field {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid #e5e5e5;
      border-radius: 12px;
      font-size: 16px;
      font-family: inherit;
      background: white;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
      -webkit-appearance: none;

      &:focus {
        outline: none;
        border-color: #ff4d1e;
        box-shadow: 0 0 0 3px rgba(255,77,30,0.1);
      }

      &.readonly {
        background: #f7f7f7;
        color: #555;
        cursor: default;
      }

      &:disabled {
        background: #f7f7f7;
        color: #888;
        cursor: not-allowed;
      }
    }

    select.input-field {
      cursor: pointer;
    }

    .textarea-field {
      resize: vertical;
      min-height: 90px;
    }

    .error-msg {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #ff4d1e;
      margin-top: 5px;

      .material-icons { font-size: 14px; }
    }

    /* ─── Mobile row ──────────────────────────────────────────────────────── */
    .mobile-row {
      display: flex;
      gap: 8px;
      align-items: center;

      .input-field { flex: 1; }
    }

    .change-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 10px 14px;
      border: 1.5px solid #e5e5e5;
      border-radius: 12px;
      background: white;
      font-size: 13px;
      font-weight: 600;
      color: #666;
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;

      &:hover { border-color: #ff4d1e; color: #ff4d1e; }
      .material-icons { font-size: 16px; }
    }

    /* ─── Lookup status ───────────────────────────────────────────────────── */
    .lookup-status {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #f9f9f9;
      border-radius: 10px;
      font-size: 13px;
      color: #666;
      margin-bottom: 12px;
    }

    .existing-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #f0fdf4;
      border: 1px solid #86efac;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      color: #15803d;
      margin-bottom: 12px;

      .material-icons { font-size: 18px; color: #22c55e; }
    }

    /* ─── Continue button ─────────────────────────────────────────────────── */
    .btn-continue {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 4px;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;
      min-height: 48px;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 4px 14px rgba(255,77,30,0.35);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .material-icons { font-size: 20px; }
    }

    /* ─── Photo upload ────────────────────────────────────────────────────── */
    .photo-btn-row {
      display: flex;
      gap: 10px;
      margin-bottom: 6px;
    }

    .photo-btn {
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
      font-size: 13px;
      font-weight: 600;
      color: #555;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;

      .material-icons { font-size: 26px; }

      &:hover, &:active { border-color: #ff4d1e; background: #fff5f0; color: #ff4d1e; }
    }

    .camera-btn .material-icons { color: #ff4d1e; }
    .gallery-btn .material-icons { color: #6366f1; }

    .photo-hint {
      font-size: 11px;
      color: #aaa;
      text-align: center;
      margin: 4px 0 0;
    }

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

    /* ─── Progress ────────────────────────────────────────────────────────── */
    .progress-wrap { margin-bottom: 10px; }

    .progress-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #ff4d1e;
      margin-bottom: 6px;

      .material-icons { font-size: 16px; }
    }

    .progress-bar {
      height: 8px;
      background: #f0f0f0;
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff6b35, #ff4d1e);
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    /* ─── Location ────────────────────────────────────────────────────────── */
    .location-field { position: relative; }

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

    .loc-btn-row {
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

    .search-loading {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #f9f9f9;
      border-radius: 10px;
      font-size: 13px;
      color: #666;
      margin-bottom: 8px;
    }

    .search-results {
      background: white;
      border: 1px solid #e5e5e5;
      border-radius: 12px;
      max-height: 200px;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      margin-bottom: 8px;

      .result-item {
        padding: 12px 14px;
        display: flex;
        gap: 10px;
        cursor: pointer;
        border-bottom: 1px solid #f5f5f5;
        transition: background 0.15s;
        -webkit-tap-highlight-color: transparent;

        &:hover { background: #fff5f0; }
        &:last-child { border-bottom: none; }

        .material-icons { color: #ff4d1e; font-size: 20px; flex-shrink: 0; margin-top: 2px; }

        .result-detail {
          flex: 1; min-width: 0;
          strong { display: block; font-size: 14px; color: #1a1a1a; margin-bottom: 2px; }
          small  { font-size: 11px; color: #888; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        }
      }
    }

    .mini-map {
      width: 100%;
      height: 180px;
      border-radius: 12px;
      overflow: hidden;
      border: 1.5px solid #e5e5e5;
      background: #f5f5f5;
    }

    .location-selected {
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

    /* ─── Submit button ───────────────────────────────────────────────────── */
    .btn-submit {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #ff6b35, #ff4d1e);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin-top: 8px;
      transition: all 0.2s;
      -webkit-tap-highlight-color: transparent;
      min-height: 52px;

      &:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 18px rgba(255,77,30,0.4);
      }

      &:disabled { opacity: 0.55; cursor: not-allowed; }
      .material-icons { font-size: 22px; }
    }

    /* ─── Footer ──────────────────────────────────────────────────────────── */
    .page-footer {
      padding: 20px;
      text-align: center;
      font-size: 13px;
      color: #888;

      a { color: #ff4d1e; font-weight: 600; text-decoration: none; }
      a:hover { text-decoration: underline; }
    }

    /* ─── Spinners ────────────────────────────────────────────────────────── */
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

    /* ─── Success toast ───────────────────────────────────────────────────── */
    .success-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 14px 20px;
      border-radius: 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      z-index: 3000;
      animation: slideUp 0.3s ease;
      box-shadow: 0 6px 20px rgba(16,185,129,0.4);
      max-width: calc(100vw - 32px);

      .material-icons { font-size: 24px; flex-shrink: 0; }
      strong { display: block; font-size: 15px; }
      p { margin: 2px 0 0; font-size: 12px; opacity: 0.9; }
    }

    /* ─── Animations ──────────────────────────────────────────────────────── */
    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes slideUp {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to   { opacity: 1; transform: translate(-50%, 0); }
    }

    .spin { animation: spin 1s linear infinite; }

    /* ─── Responsive tweaks ───────────────────────────────────────────────── */
    @media (min-width: 600px) {
      .page-wrapper { padding: 32px 16px 48px; align-items: center; }
      .section { padding: 24px; }
      .page-header { padding: 28px 24px; h1 { font-size: 26px; } }
    }
  `]
})
export class PublicQuickComplaintComponent implements AfterViewInit {
  @ViewChild('miniMap') miniMapContainer!: ElementRef;

  // Identity state
  mobile = '';
  name = '';
  email = '';
  mobileTouched = false;
  nameTouched = false;

  isLooking       = signal(false);
  isExistingCustomer = signal(false);
  identityConfirmed  = signal(false);
  showIdentityFields = signal(false);

  // Complaint state
  subject     = '';
  category    = '';
  brandName   = '';
  modelNumber = '';
  description = '';
  subjectTouched = false;

  // Photo
  photoPreview   = signal<string | null>(null);
  photoSizeLabel = signal('');
  uploadProgress = signal(0);
  private compressedBase64: string | null = null;
  private selectedPhoto: File | null = null;

  // Location
  locationQuery   = '';
  locationName    = '';
  latitude: number | null = null;
  longitude: number | null = null;
  searchResults   = signal<any[]>([]);
  isSearching     = signal(false);
  private map: any;
  private marker: any;
  private readonly DEFAULT_LAT = 9.9312;
  private readonly DEFAULT_LNG = 76.2673;

  // Submit state
  isSubmitting  = signal(false);
  loadingStatus = signal('');
  showSuccess   = signal(false);
  successMessage = signal('');

  constructor(private apiService: ApiService, private ngZone: NgZone) {}

  ngAfterViewInit(): void {}

  // ─── Identity logic ───────────────────────────────────────────────────────

  isValidMobile(): boolean {
    return /^\d{10}$/.test(this.mobile);
  }

  onMobileInput(): void {
    this.mobile = this.mobile.replace(/\D/g, '').slice(0, 10);
    if (this.isValidMobile() && !this.identityConfirmed()) {
      this.lookupMobile();
    } else if (!this.isValidMobile()) {
      this.showIdentityFields.set(false);
      this.isExistingCustomer.set(false);
      this.name = '';
      this.email = '';
    }
  }

  onMobileBlur(): void {
    this.mobileTouched = true;
    if (this.isValidMobile() && !this.identityConfirmed()) {
      this.lookupMobile();
    }
  }

  private lookupMobile(): void {
    if (this.isLooking()) return;
    this.isLooking.set(true);
    this.showIdentityFields.set(false);
    this.isExistingCustomer.set(false);
    this.name = '';
    this.email = '';

    this.apiService.checkCustomerByMobile(this.mobile).subscribe({
      next: (res) => {
        this.isLooking.set(false);
        if (res.success && res.data) {
          this.isExistingCustomer.set(true);
          this.name  = res.data.customerName || res.data.fullName || '';
          this.email = res.data.email || '';
        }
        this.showIdentityFields.set(true);
      },
      error: () => {
        this.isLooking.set(false);
        this.isExistingCustomer.set(false);
        this.showIdentityFields.set(true);
      }
    });
  }

  confirmIdentity(): void {
    this.nameTouched = true;
    if (!this.isValidMobile() || !this.name.trim()) return;
    this.identityConfirmed.set(true);
    setTimeout(() => this.initMiniMap(), 150);
  }

  resetIdentity(): void {
    this.identityConfirmed.set(false);
    this.showIdentityFields.set(false);
    this.isExistingCustomer.set(false);
    this.mobileTouched = false;
    this.nameTouched = false;
    this.name = '';
    this.email = '';
    if (this.map) { this.map.remove(); this.map = null; }
  }

  // ─── Map ──────────────────────────────────────────────────────────────────

  initMiniMap(): void {
    if (!this.miniMapContainer?.nativeElement) return;
    if (this.map) this.map.remove();

    this.map = L.map(this.miniMapContainer.nativeElement).setView([this.DEFAULT_LAT, this.DEFAULT_LNG], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    const icon = L.icon({
      iconUrl:   'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize:  [25, 41], iconAnchor: [12, 41]
    });

    this.marker = L.marker([this.DEFAULT_LAT, this.DEFAULT_LNG], { draggable: true, icon }).addTo(this.map);
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

  // ─── Location search ──────────────────────────────────────────────────────

  async searchLocation(): Promise<void> {
    if (!this.locationQuery || this.locationQuery.trim().length < 2) return;
    this.isSearching.set(true);
    this.searchResults.set([]);

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(this.locationQuery)}&limit=10&addressdetails=1&countrycodes=IN`;
    try {
      const data = await this.fetchWithRetry(url);
      this.ngZone.run(() => {
        this.isSearching.set(false);
        if (data?.length > 0) this.searchResults.set(data);
        else alert('No locations found. Try a different search term.');
      });
    } catch {
      this.ngZone.run(() => { this.isSearching.set(false); alert('Search failed. Please try again.'); });
    }
  }

  private async fetchWithRetry(url: string, retries = 3): Promise<any> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'FelixServiceApp/1.0' } });
        if (res.status === 429) { await new Promise(r => setTimeout(r, (i + 1) * 2000)); continue; }
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
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
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
        let msg = 'Unable to get location. ';
        if (err.code === err.PERMISSION_DENIED) msg += 'Please allow location access.';
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  updateLocation(lat: number, lng: number, address?: string): void {
    this.latitude  = lat;
    this.longitude = lng;
    if (address) {
      this.locationName = address.split(',')[0];
    } else {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18`)
        .then(r => r.json())
        .then(data => {
          if (data.display_name) this.ngZone.run(() => { this.locationName = data.display_name.split(',')[0]; });
        })
        .catch(() => {});
    }
  }

  shortAddress(full: string): string {
    const parts = full.split(',');
    return parts.length >= 3 ? parts.slice(0, 3).join(', ').trim() : full.substring(0, 60);
  }

  // ─── Photo ────────────────────────────────────────────────────────────────

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.[0]) return;
    const file = input.files[0];
    this.selectedPhoto = file;

    const reader = new FileReader();
    reader.onload = () => this.ngZone.run(() => this.photoPreview.set(reader.result as string));
    reader.readAsDataURL(file);
    this.compressImage(file);
    input.value = '';
  }

  private compressImage(file: File): void {
    this.uploadProgress.set(10);
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      this.ngZone.run(() => this.uploadProgress.set(30));
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
      this.ngZone.run(() => this.uploadProgress.set(70));

      let base64 = canvas.toDataURL('image/jpeg', 0.8);
      if (base64.length > 1_400_000) base64 = canvas.toDataURL('image/jpeg', 0.6);
      URL.revokeObjectURL(objectUrl);

      this.ngZone.run(() => {
        this.compressedBase64 = base64;
        const kb = Math.round((base64.length * 0.75) / 1024);
        this.photoSizeLabel.set(kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
        this.uploadProgress.set(100);
        setTimeout(() => this.ngZone.run(() => this.uploadProgress.set(0)), 800);
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      this.ngZone.run(() => { this.uploadProgress.set(0); alert('Failed to read image. Try another photo.'); });
    };
    img.src = objectUrl;
  }

  removePhoto(): void {
    this.selectedPhoto    = null;
    this.compressedBase64 = null;
    this.photoPreview.set(null);
    this.photoSizeLabel.set('');
    this.uploadProgress.set(0);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  submit(): void {
    this.subjectTouched = true;
    if (!this.subject.trim()) return;

    this.isSubmitting.set(true);
    this.loadingStatus.set('Preparing...');

    const payload: any = {
      mobileNumber: this.mobile,
      fullName:     this.name,
      email:        this.email || undefined,
      subject:      this.subject,
      category:     this.category    || undefined,
      brandName:    this.brandName   || undefined,
      modelNumber:  this.modelNumber || undefined,
      description:  this.description || undefined,
      latitude:     this.latitude,
      longitude:    this.longitude,
      locationName: this.locationName || undefined
    };

    if (this.compressedBase64 && this.selectedPhoto) {
      payload.imageBase64 = this.compressedBase64;
      payload.imageName   = this.selectedPhoto.name;
      payload.contentType = 'image/jpeg';
      this.loadingStatus.set('Uploading...');
    }

    this.apiService.submitPublicQuickComplaint(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.loadingStatus.set('');
        if (res.success) {
          const num = res.data?.complaintNumber || '';
          this.successMessage.set(num ? `Complaint #${num} registered successfully.` : 'Your complaint has been registered.');
          this.showSuccess.set(true);
          setTimeout(() => this.showSuccess.set(false), 5000);
          this.resetComplaintOnly();
        } else {
          alert(res.message || 'Failed to submit complaint.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loadingStatus.set('');
        alert('Failed to submit. Please check your connection and try again.');
      }
    });
  }

  private resetComplaintOnly(): void {
    this.subject = ''; this.category = ''; this.brandName = '';
    this.modelNumber = ''; this.description = '';
    this.subjectTouched = false;
    this.locationQuery = ''; this.locationName = '';
    this.latitude = null; this.longitude = null;
    this.searchResults.set([]);
    this.removePhoto();
    if (this.map) { this.map.remove(); this.map = null; }
    // Re-init map after brief delay so the form is still visible
    setTimeout(() => this.initMiniMap(), 200);
  }
}
