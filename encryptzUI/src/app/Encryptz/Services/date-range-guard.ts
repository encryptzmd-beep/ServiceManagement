export const DATE_RANGE_MESSAGE = 'To date cannot be before From date';

export const isReversedRange = (from: string, to: string) => !!from && !!to && from > to;

/**
 * Filters mark their dates with data-range="from" / "to". When they are the wrong way round the
 * To date turns red and says why, instead of the list just coming back empty.
 */
export function installDateRangeGuard(doc: Document): void {
  doc.addEventListener('change', event => {
    const field = event.target as HTMLInputElement | null;
    const side = field?.getAttribute?.('data-range');
    if (!field || !side) return;

    let box: HTMLElement | null = field.parentElement;
    while (box && !(box.querySelector('[data-range="from"]') && box.querySelector('[data-range="to"]'))) box = box.parentElement;
    if (!box) return;
    const from = box.querySelector<HTMLInputElement>('[data-range="from"]')!;
    const to = box.querySelector<HTMLInputElement>('[data-range="to"]')!;

    const reversed = isReversedRange(from.value, to.value);
    to.setCustomValidity(reversed ? DATE_RANGE_MESSAGE : '');
    to.classList.toggle('date-range-bad', reversed);
    to.title = reversed ? DATE_RANGE_MESSAGE : to.title === DATE_RANGE_MESSAGE ? '' : to.title;
    if (reversed) to.reportValidity();
  });
}
