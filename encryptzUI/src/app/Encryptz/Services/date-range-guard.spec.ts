import { DATE_RANGE_MESSAGE, installDateRangeGuard, isReversedRange } from './date-range-guard';

describe('date range guard', () => {
  it('knows a reversed range', () => {
    expect(isReversedRange('2026-12-31', '2026-01-01')).toBe(true);
    expect(isReversedRange('2026-01-01', '2026-12-31')).toBe(false);
    expect(isReversedRange('', '2026-01-01')).toBe(false);
  });

  it('marks the To date and clears it again', () => {
    const box = document.createElement('div');
    box.innerHTML = '<input type="date" data-range="from" /><input type="date" data-range="to" />';
    document.body.appendChild(box);
    installDateRangeGuard(document);
    const [from, to] = Array.from(box.querySelectorAll('input'));

    from.value = '2026-12-31'; to.value = '2026-01-01';
    to.dispatchEvent(new Event('change', { bubbles: true }));
    expect(to.validationMessage).toBe(DATE_RANGE_MESSAGE);
    expect(to.classList.contains('date-range-bad')).toBe(true);

    to.value = '2027-01-01';
    to.dispatchEvent(new Event('change', { bubbles: true }));
    expect(to.validationMessage).toBe('');
    expect(to.classList.contains('date-range-bad')).toBe(false);
    box.remove();
  });
});
