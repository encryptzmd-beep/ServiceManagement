import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../Services/API/api-service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-component.html',
  styleUrls: ['./profile-component.scss'],
})
export class ProfileComponent implements OnInit {
  private api = inject(ApiService);
isFetchingLocation = false;
  form: any = {
    fullName: '',
    email: '',
    mobileNumber: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    alternatePhone: '',
    landmark: '',
    latitude: null,
    longitude: null
  };

  originalForm: any = {};
  loading = signal(true);
  saving = signal(false);
  msg = signal('');
  error = signal('');
  errorMsg = signal('');

  ngOnInit() {
    this.loadProfile();
  }

  loadProfile(): void {
    this.loading.set(true);
    this.error.set('');

    this.api.getProfile().subscribe({
      next: (res) => {
        if (res.success && res.data) {
          // Map the response to form fields
          this.form = {
            fullName: res.data.fullName || '',
            email: res.data.email || '',
            mobileNumber: res.data.mobileNumber || '',
            address: res.data.address || '',
            city: res.data.city || '',
            state: res.data.state || '',
            pinCode: res.data.pinCode || '',
            alternatePhone: res.data.alternatePhone || '',
            landmark: res.data.landmark || '',
            latitude: res.data.latitude || null,
            longitude: res.data.longitude || null
          };
          // Store original for reset
          this.originalForm = { ...this.form };
        } else {
          this.error.set(res.message || 'Failed to load profile');
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Error loading profile');
        console.error('Error loading profile:', err);
      }
    });
  }
showLocationPopup = false;
showMapInputPopup = false;

toast = {
  show: false,
  type: 'success',
  message: ''
};
  save(): void {
    this.saving.set(true);
    this.msg.set('');
    this.errorMsg.set('');

    // Prepare data for update (only send changed fields)
    const updateData = {
      fullName: this.form.fullName,
      email: this.form.email,
      address: this.form.address,
      city: this.form.city,
      state: this.form.state,
      pinCode: this.form.pinCode,
      alternatePhone: this.form.alternatePhone,
      landmark: this.form.landmark,
      latitude: this.form.latitude,
      longitude: this.form.longitude,
      customerName : this.form.fullName
    };

    this.api.updateProfile(updateData).subscribe({
      next: (res) => {
        this.saving.set(false);
        if (res.success) {
          this.msg.set(res.message || 'Profile updated successfully');
          this.originalForm = { ...this.form };
          // Clear success message after 3 seconds
          setTimeout(() => this.msg.set(''), 3000);
        } else {
          this.errorMsg.set(res.message || 'Failed to update profile');
        }
      },
      error: (err) => {
        this.saving.set(false);
        this.errorMsg.set(err.error?.message || 'Error updating profile');
        console.error('Error updating profile:', err);
      }
    });
  }

  resetForm(): void {
    this.form = { ...this.originalForm };
    this.msg.set('');
    this.errorMsg.set('');
  }

openMapSelector(): void {
  this.showLocationPopup = true;
}

useCurrentLocation(): void {
  this.showLocationPopup = false;

  if (!navigator.geolocation) {
    this.showToast('warning', 'Geolocation is not supported by your browser');
    return;
  }

  this.isFetchingLocation = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      this.isFetchingLocation = false;

      this.form.latitude = Number(position.coords.latitude.toFixed(6));
      this.form.longitude = Number(position.coords.longitude.toFixed(6));

      this.showToast('success', 'Current location fetched successfully');
    },
    (error) => {
      this.isFetchingLocation = false;

      let message = 'Unable to fetch current location';

      if (error.code === error.TIMEOUT) {
        message = 'Location request timed out. Please try again.';
      } else if (error.code === error.PERMISSION_DENIED) {
        message = 'Location permission denied.';
      }

      this.showToast('error', message);
    },
    {
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000
    }
  );
}
selectFromMap(): void {
  this.showLocationPopup = false;
  this.showMapInputPopup = true;

  window.open('https://www.google.com/maps', '_blank');
}

saveMapCoordinates(latInput: string, lngInput: string): void {
  if (!latInput || !lngInput) {
    this.showToast('warning', 'Please enter both latitude and longitude');
    return;
  }

  this.form.latitude = parseFloat(latInput);
  this.form.longitude = parseFloat(lngInput);

  this.showMapInputPopup = false;
  this.showToast('success', 'Location selected from Google Maps');
}

showToast(type: 'success' | 'error' | 'warning', message: string): void {
  this.toast = {
    show: true,
    type,
    message
  };

  setTimeout(() => {
    this.toast.show = false;
  }, 3000);
}
  // Helper method to detect location (optional)
  detectLocation(): void {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.form.latitude = position.coords.latitude;
          this.form.longitude = position.coords.longitude;
          this.msg.set('Location detected successfully');
          setTimeout(() => this.msg.set(''), 3000);
        },
        (error) => {
          this.errorMsg.set('Unable to detect location. Please enable GPS.');
          setTimeout(() => this.errorMsg.set(''), 3000);
        }
      );
    } else {
      this.errorMsg.set('Geolocation is not supported by this browser');
    }
  }
}
