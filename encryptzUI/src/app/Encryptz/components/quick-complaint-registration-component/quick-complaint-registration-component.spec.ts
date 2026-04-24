import { ComponentFixture, TestBed } from '@angular/core/testing';

import { QuickComplaintRegistrationComponent } from './quick-complaint-registration-component';

describe('QuickComplaintRegistrationComponent', () => {
  let component: QuickComplaintRegistrationComponent;
  let fixture: ComponentFixture<QuickComplaintRegistrationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QuickComplaintRegistrationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QuickComplaintRegistrationComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
