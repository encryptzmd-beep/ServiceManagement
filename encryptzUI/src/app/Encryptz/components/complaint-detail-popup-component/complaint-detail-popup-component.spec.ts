import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComplaintDetailPopupComponent } from './complaint-detail-popup-component';

describe('ComplaintDetailPopupComponent', () => {
  let component: ComplaintDetailPopupComponent;
  let fixture: ComponentFixture<ComplaintDetailPopupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComplaintDetailPopupComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ComplaintDetailPopupComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
