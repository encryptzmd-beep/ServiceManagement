import { describe, expect, it } from 'vitest';
import { DEFAULT_PHOTO_CATEGORIES, photoCategoriesOf, photosStillNeeded, morePhotosHint } from './completion-photos';

const queued = (...status: string[]) => status.map(s => ({ status: s }));

describe('completion photos', () => {
  it('offers the photo categories from the settings', () => {
    expect(photoCategoriesOf({ minPhotos: 4, photoCategories: ['Front View', 'Fault Area'], photosUploaded: 0 }))
      .toEqual(['Front View', 'Fault Area']);
  });

  it('disables Complete until enough photos are added', () => {
    const rules = { minPhotos: 4, photoCategories: [], photosUploaded: 1 };
    expect(photosStillNeeded(rules, queued('pending', 'pending'), true)).toBe(1);
    expect(morePhotosHint(1)).toBe('Add 1 more photo');
    expect(morePhotosHint(3)).toBe('Add 3 more photos');
  });

  it('enables Complete when the photos are enough', () => {
    const rules = { minPhotos: 4, photoCategories: [], photosUploaded: 1 };
    expect(photosStillNeeded(rules, queued('pending', 'pending', 'pending'), true)).toBe(0);
  });

  it('does not count a photo whose upload failed', () => {
    const rules = { minPhotos: 2, photoCategories: [], photosUploaded: 0 };
    expect(photosStillNeeded(rules, queued('done', 'error'), true)).toBe(1);
  });

  it('completes as today when the rules cannot be loaded', () => {
    expect(photosStillNeeded(null, [], true)).toBe(0);
    expect(photoCategoriesOf(null)).toEqual(DEFAULT_PHOTO_CATEGORIES);
    expect(DEFAULT_PHOTO_CATEGORIES).toEqual(['Before', 'After', 'Part', 'Signature', 'Other']);
  });

  it('min 0 never blocks', () => {
    expect(photosStillNeeded({ minPhotos: 0, photoCategories: [], photosUploaded: 0 }, [], true)).toBe(0);
  });

  it('does not block the back office', () => {
    expect(photosStillNeeded({ minPhotos: 4, photoCategories: [], photosUploaded: 0 }, [], false)).toBe(0);
  });

  it('falls back to the defaults when the settings list is empty', () => {
    expect(photoCategoriesOf({ minPhotos: 1, photoCategories: [], photosUploaded: 0 })).toEqual(DEFAULT_PHOTO_CATEGORIES);
  });
});
