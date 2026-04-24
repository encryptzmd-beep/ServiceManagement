import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanySelectorComponent } from './company-selector-component';

describe('CompanySelectorComponent', () => {
  let component: CompanySelectorComponent;
  let fixture: ComponentFixture<CompanySelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanySelectorComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanySelectorComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
