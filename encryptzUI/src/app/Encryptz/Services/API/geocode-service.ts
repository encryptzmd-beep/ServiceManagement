import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, of, catchError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class GeocodeService {
  private cache = new Map<string, string>();

  constructor(private http: HttpClient) {}

  reverseGeocode(lat: number, lng: number): Observable<string> {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;

    // Return cached result
    if (this.cache.has(key)) return of(this.cache.get(key)!);

    return this.http.get<any>(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    ).pipe(
      map(res => {
        const a = res.address;
        // Build short readable address
        const parts = [
          a.road || a.neighbourhood || a.suburb || '',
          a.city || a.town || a.village || a.county || '',
          a.state || ''
        ].filter(Boolean);
        const name = parts.join(', ') || res.display_name || `${lat}, ${lng}`;
        this.cache.set(key, name);
        return name;
      }),
      catchError(() => of(`${lat.toFixed(5)}, ${lng.toFixed(5)}`))
    );
  }
}
