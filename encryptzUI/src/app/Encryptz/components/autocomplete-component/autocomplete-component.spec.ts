import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { AutocompleteComponent, AutocompleteOption } from './autocomplete-component';

@Component({
  standalone: true,
  imports: [FormsModule, AutocompleteComponent],
  template: `<app-autocomplete name="job" [(ngModel)]="chosen" [options]="options()" noneLabel="None" />`,
})
class HostComponent {
  chosen: number | null = 2;
  options = signal<AutocompleteOption<number>[]>([
    { value: 1, label: 'Accountant', sub: 'Ernakulam · Full-time' },
    { value: 2, label: 'HR Manager', sub: 'Edappally · Full-time' },
    { value: 3, label: 'Site Supervisor', sub: 'Chalakudy · On-site' },
    { value: 4, label: 'Senior Accountant', sub: 'Kochi · Hybrid' },
  ]);
}

describe('AutocompleteComponent', () => {
  const create = async () => {
    TestBed.configureTestingModule({ imports: [HostComponent] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const ac = fixture.debugElement.children[0].componentInstance as AutocompleteComponent<number>;
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    return { fixture, ac, input, host: fixture.componentInstance };
  };
  const type = (fixture: any, input: HTMLInputElement, text: string) => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  const labels = (fixture: any) => [...fixture.nativeElement.querySelectorAll('.ac-list li .ac-label')].map((l: any) => l.textContent.trim());
  const key = (input: HTMLInputElement, k: string) => input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  afterEach(() => TestBed.resetTestingModule());

  it('shows the label of the choice it was given', async () => {
    const { ac } = await create();
    expect(ac.chosen()?.label).toBe('HR Manager');
  });

  it('narrows the list as one types: every word, in the label or the second line, any case', async () => {
    const { fixture, input } = await create();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(labels(fixture)).toEqual(['None', 'Accountant', 'HR Manager', 'Site Supervisor', 'Senior Accountant']);

    type(fixture, input, 'accountant');
    expect(labels(fixture)).toEqual(['Accountant', 'Senior Accountant']);

    type(fixture, input, 'ACCOUNTANT kochi');
    expect(labels(fixture)).toEqual(['Senior Accountant']);

    type(fixture, input, 'pilot');
    expect(fixture.nativeElement.querySelector('.ac-empty').textContent).toContain('Nothing matches');
  });

  it('picks with the arrow keys and Enter, and tells the form', async () => {
    const { fixture, input, host } = await create();
    type(fixture, input, 'site');
    key(input, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(host.chosen).toBe(3);

    input.dispatchEvent(new Event('focus'));
    type(fixture, input, 'acc');
    key(input, 'ArrowDown');
    key(input, 'Enter');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.chosen).toBe(4);
  });

  it('offers "nothing" when it is a choice, and clears to nothing', async () => {
    const { fixture, input, host, ac } = await create();
    input.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.ac-list li.none') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.chosen).toBeNull();

    ac.pick(1);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.ac-clear') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(host.chosen).toBeNull();
  });

  it('shows at most 50 choices of a long list and says how many more there are', async () => {
    const { fixture, input, host } = await create();
    host.options.set(Array.from({ length: 1200 }, (_, i) => ({ value: i, label: `Job ${i}`, sub: 'Kochi' })));
    fixture.detectChanges();
    input.dispatchEvent(new Event('focus'));
    type(fixture, input, 'job');

    expect(labels(fixture).length).toBe(50);
    expect(fixture.nativeElement.querySelector('.ac-more').textContent).toContain('1150 more');
  });
});
