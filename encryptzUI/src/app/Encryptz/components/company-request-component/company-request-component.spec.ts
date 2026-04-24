import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyRequestComponent } from './company-request-component';

describe('CompanyRequestComponent', () => {
  let component: CompanyRequestComponent;
  let fixture: ComponentFixture<CompanyRequestComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyRequestComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyRequestComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
