/** Settings › Service Workflow as the complete dialog gets them (GET technician/completion-rules). */
export interface CompletionRules {
  minPhotos: number;
  photoCategories: string[];
  photosUploaded: number;
}

/** The photo types offered before the Service Workflow settings existed. */
export const DEFAULT_PHOTO_CATEGORIES = ['Before', 'After', 'Part', 'Signature', 'Other'];

export function photoCategoriesOf(rules: CompletionRules | null): string[] {
  return rules?.photoCategories?.length ? rules.photoCategories : DEFAULT_PHOTO_CATEGORIES;
}

/**
 * Photos still to add before Complete: the minimum less the photos already on the
 * complaint and the queued ones that did not fail. 0 when the rules are unknown
 * (the server still decides) or when the caller is not a technician.
 */
export function photosStillNeeded(
  rules: CompletionRules | null,
  queue: { status: string }[],
  technician: boolean
): number {
  if (!rules || !technician) return 0;
  const queued = queue.filter(q => q.status !== 'error').length;
  return Math.max(0, (rules.minPhotos ?? 0) - (rules.photosUploaded ?? 0) - queued);
}

export function morePhotosHint(n: number): string {
  return `Add ${n} more photo${n === 1 ? '' : 's'}`;
}
