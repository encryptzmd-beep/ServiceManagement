import { Injectable } from '@angular/core';

const LEAFLET_VERSION = '1.9.4';
const LEAFLET_JS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.js`;
const LEAFLET_CSS = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist/leaflet.css`;

/**
 * Loads Leaflet (the global `L`) the first time a map is needed. It used to be a
 * script tag in index.html, so every page paid for it — including the ones
 * without a map.
 *
 *   await this.leaflet.load();   // then use L
 */
@Injectable({ providedIn: 'root' })
export class LeafletLoaderService {
  private loading?: Promise<void>;

  load(): Promise<void> {
    if (typeof (window as any).L !== 'undefined') return Promise.resolve();

    this.loading ??= new Promise<void>((resolve, reject) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);

      const script = document.createElement('script');
      script.src = LEAFLET_JS;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        this.loading = undefined;   // a later call may retry (e.g. the network came back)
        css.remove();
        script.remove();
        reject(new Error('Leaflet could not be loaded'));
      };
      document.head.appendChild(script);
    });

    return this.loading;
  }
}
