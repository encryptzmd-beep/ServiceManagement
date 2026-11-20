import { Component, ElementRef, ViewChild, signal, AfterViewInit, OnInit, NgZone, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';
import { LeafletLoaderService } from '../../Services/leaflet-loader-service';
import { DialogService } from '../../Services/dialog-service';

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
                  placeholder="e.g., Not working, damaged part..."
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
                  <span class="material-icons">category</span>
                  Category
                </label>
                <select [(ngModel)]="category" name="category" class="input-field">
                  <option value="">Select category (optional)</option>
                  @for (c of categories(); track c) {
                    <option [value]="c">{{ c }}</option>
                  }
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
                  placeholder="Brand of the product"
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
                  placeholder="Model number, if you know it"
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
                  placeholder="What's the problem? (e.g., 'Not switching on', 'Display not working', 'Making noise')"
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
    /* Public quick complaint: a customer reports a fault from a phone, usually from an SMS link.
       Phone-first, light, one column; wider screens only centre the card. */
    :host {
      --qc-text: var(--fx-text-primary, #1a2332);
      --qc-muted: var(--fx-text-secondary, #5a6a7e);
      --qc-faint: var(--fx-text-muted, #8a9ab0);
      --qc-border: var(--fx-border, #e2e8f0);
      --qc-navy: var(--fx-brand-navy, #1B4A7A);
      --qc-red: var(--fx-brand-red, #D42B2B);
      display: block;
      font-family: var(--app-font);
      color: var(--qc-text);
    }

    .page-wrapper {
      min-height: 100vh;
      min-height: 100dvh;
      background: var(--fx-content-bg, #f5f7fa);
      padding: 16px 12px calc(32px + env(safe-area-inset-bottom));
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    @media (min-width: 600px) { .page-wrapper { padding: 40px 24px; } }

    .page-card {
      width: 100%;
      max-width: 520px;
      background: #fff;
      border: 1px solid var(--qc-border);
      border-radius: 12px;
      overflow: hidden;
    }

    .page-header { padding: 20px 16px 16px; border-bottom: 1px solid var(--qc-border); }
    .page-header h1 { font-size: 20px; font-weight: 700; margin: 0 0 2px; letter-spacing: -0.01em; }
    .page-header p { font-size: 14px; color: var(--qc-muted); margin: 0; }
    .header-icon { display: none; }
    @media (min-width: 600px) { .page-header { padding: 24px 24px 18px; } }

    .section { padding: 18px 16px; display: flex; flex-direction: column; gap: 14px; }
    .section + .section { border-top: 1px solid var(--qc-border); }
    @media (min-width: 600px) { .section { padding: 20px 24px; } }
    .section-title { font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--qc-faint); }
    .section-title .material-icons { display: none; }

    form { display: flex; flex-direction: column; gap: 14px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .form-field label { font-size: 14px; font-weight: 600; color: var(--qc-text); display: flex; align-items: baseline; gap: 4px; }
    .form-field label .material-icons { display: none; }
    .req { color: var(--qc-red); }
    .optional { font-weight: 400; color: var(--qc-faint); font-size: 13px; }

    .input-field, .textarea-field, .location-input {
      width: 100%;
      min-height: 46px;
      padding: 10px 12px;
      border: 1px solid var(--qc-border);
      border-radius: 8px;
      background: #fff;
      color: var(--qc-text);
      font: inherit;
      font-size: 16px;                 /* no zoom-on-focus on iOS */
      outline: none;
      transition: border-color .15s, box-shadow .15s;
    }
    .input-field::placeholder, .textarea-field::placeholder, .location-input::placeholder { color: var(--qc-faint); }
    .input-field:focus, .textarea-field:focus, .location-input:focus { border-color: var(--qc-navy); box-shadow: 0 0 0 3px rgba(27, 74, 122, .12); }
    .input-field:disabled, .input-field.readonly { background: #f8fafc; color: var(--qc-muted); }
    .textarea-field { min-height: 96px; resize: vertical; line-height: 1.45; }
    .form-field.error .input-field, .form-field.error .textarea-field { border-color: var(--qc-red); }

    .mobile-row { display: flex; gap: 8px; align-items: stretch; }
    .mobile-row .input-field { flex: 1; min-width: 0; }
    .change-btn {
      flex: none; display: inline-flex; align-items: center; gap: 4px;
      padding: 0 12px; min-height: 46px;
      border: 1px solid var(--qc-border); border-radius: 8px; background: #fff;
      color: var(--qc-navy); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .change-btn .material-icons { font-size: 16px; }

    .error-msg { display: flex; align-items: center; gap: 4px; font-size: 13px; color: var(--qc-red); }
    .error-msg .material-icons { font-size: 15px; }
    .lookup-status, .search-loading { display: flex; align-items: center; gap: 8px; font-size: 14px; color: var(--qc-muted); }
    .existing-badge {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 12px; border-radius: 8px;
      background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; font-size: 14px;
    }
    .existing-badge .material-icons { font-size: 18px; }

    .btn-continue, .btn-submit {
      width: 100%; min-height: 48px;
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      border: 0; border-radius: 8px;
      font: inherit; font-size: 16px; font-weight: 600; cursor: pointer;
      transition: background-color .15s;
    }
    .btn-continue .material-icons, .btn-submit .material-icons { font-size: 18px; }
    .btn-continue { background: var(--qc-navy); color: #fff; }
    .btn-continue:hover:not(:disabled) { background: #163d65; }
    .btn-submit { background: var(--qc-red); color: #fff; margin-top: 4px; }
    .btn-submit:hover:not(:disabled) { background: #b92222; }
    .btn-continue:disabled, .btn-submit:disabled { opacity: .5; cursor: not-allowed; }

    /* photo */
    .photo-btn-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .photo-btn {
      min-height: 64px;
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
      border: 1px dashed #cbd5e1; border-radius: 8px; background: #fff;
      color: var(--qc-text); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .photo-btn .material-icons { font-size: 22px; color: var(--qc-navy); }
    .photo-btn:hover { border-color: var(--qc-navy); background: #f8fafc; }
    .photo-hint { font-size: 12px; color: var(--qc-faint); margin: 0; }
    .photo-preview-box { position: relative; border-radius: 8px; overflow: hidden; border: 1px solid var(--qc-border); }
    .photo-preview-img { display: block; width: 100%; max-height: 260px; object-fit: cover; }
    .photo-preview-overlay { position: absolute; top: 8px; right: 8px; }
    .remove-photo-btn {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 6px 10px; min-height: 36px;
      border: 0; border-radius: 6px; background: rgba(15, 23, 42, .75); color: #fff;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
    }
    .remove-photo-btn .material-icons { font-size: 16px; }
    .photo-size-badge { position: absolute; left: 8px; bottom: 8px; padding: 2px 8px; border-radius: 4px; background: rgba(15, 23, 42, .75); color: #fff; font-size: 12px; }
    .progress-wrap { display: flex; flex-direction: column; gap: 6px; }
    .progress-label { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--qc-muted); }
    .progress-label .material-icons { font-size: 16px; }
    .progress-bar { height: 6px; border-radius: 3px; background: #eef2f7; overflow: hidden; }
    .progress-fill { height: 100%; background: var(--qc-navy); transition: width .2s; }

    /* location */
    .location-controls { display: flex; flex-direction: column; gap: 8px; }
    .search-box { position: relative; }
    .search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 18px; color: var(--qc-faint); pointer-events: none; }
    .search-box .location-input { padding-left: 38px; }
    .loc-btn-row { display: flex; gap: 8px; }
    .search-btn, .locate-btn {
      min-height: 44px;
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      border: 1px solid var(--qc-border); border-radius: 8px; background: #fff;
      color: var(--qc-navy); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .search-btn .material-icons, .locate-btn .material-icons { font-size: 18px; }
    .search-btn:hover, .locate-btn:hover { background: #f8fafc; }
    .search-btn { flex: 1; }
    .locate-btn { width: 44px; flex: none; }
    @media (min-width: 480px) {
      .location-controls { flex-direction: row; }
      .search-box { flex: 1; }
      .search-btn { flex: none; padding: 0 14px; }
    }
    .search-results { border: 1px solid var(--qc-border); border-radius: 8px; max-height: 240px; overflow-y: auto; }
    .result-item { display: flex; align-items: flex-start; gap: 8px; padding: 10px 12px; cursor: pointer; }
    .result-item + .result-item { border-top: 1px solid var(--qc-border); }
    .result-item:hover { background: #f8fafc; }
    .result-item .material-icons { font-size: 18px; color: var(--qc-faint); margin-top: 1px; }
    .result-detail { display: flex; flex-direction: column; min-width: 0; }
    .result-detail strong { font-size: 14px; font-weight: 600; }
    .result-detail small { font-size: 12px; color: var(--qc-muted); overflow-wrap: anywhere; }
    .mini-map { width: 100%; height: 200px; border-radius: 8px; border: 1px solid var(--qc-border); overflow: hidden; z-index: 0; }
    .location-selected { display: flex; align-items: flex-start; gap: 8px; font-size: 14px; color: var(--qc-muted); }
    .location-selected .material-icons { font-size: 18px; color: #16a34a; }
    .location-selected strong { color: var(--qc-text); margin-right: 4px; }

    /* spinners */
    .spinner, .spinner-small { border-radius: 50%; animation: spin .7s linear infinite; flex: none; }
    .spinner { width: 18px; height: 18px; border: 2px solid rgba(255, 255, 255, .45); border-top-color: #fff; }
    .spinner-small { width: 14px; height: 14px; border: 2px solid #cbd5e1; border-top-color: var(--qc-navy); }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* success */
    .success-toast {
      position: fixed; left: 12px; right: 12px; bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 1000;
      max-width: 480px; margin: 0 auto;
      display: flex; align-items: flex-start; gap: 10px;
      padding: 14px 16px; border-radius: 10px;
      background: #14532d; color: #fff;
      box-shadow: 0 8px 24px rgba(15, 23, 42, .18);
      animation: slideUp .25s ease-out;
    }
    .success-toast .material-icons { color: #86efac; }
    .success-toast strong { display: block; font-size: 15px; }
    .success-toast p { margin: 2px 0 0; font-size: 14px; color: #dcfce7; }
    @keyframes slideUp { from { transform: translateY(16px); opacity: 0; } to { transform: none; opacity: 1; } }
  `]
})
export class PublicQuickComplaintComponent implements OnInit, AfterViewInit {
  private dialog = inject(DialogService);
  /** Complaint categories of the tenant (configured per project, not hardcoded). */
  categories = signal<string[]>([]);

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

  private leaflet = inject(LeafletLoaderService);

  constructor(private apiService: ApiService, private ngZone: NgZone) {}

  ngOnInit(): void {
    this.apiService.getComplaintCategories().subscribe({
      next: (res: any) => this.categories.set(res?.data ?? []),
      error: () => this.categories.set([])
    });
  }

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
    setTimeout(() => this.leaflet.load().then(() => this.initMiniMap()).catch(() => {}), 150);
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
        else this.dialog.alert('No locations found. Try a different search term.');
      });
    } catch {
      this.ngZone.run(() => { this.isSearching.set(false); this.dialog.alert('Search failed. Please try again.'); });
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
    if (!navigator.geolocation) { this.dialog.alert('Geolocation not supported'); return; }
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
        this.dialog.alert(msg);
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
      this.ngZone.run(() => { this.uploadProgress.set(0); this.dialog.alert('Failed to read image. Try another photo.'); });
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
          this.dialog.alert(res.message || 'Failed to submit complaint.');
        }
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.loadingStatus.set('');
        this.dialog.alert('Failed to submit. Please check your connection and try again.');
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
    setTimeout(() => this.leaflet.load().then(() => this.initMiniMap()).catch(() => {}), 200);
  }
}
