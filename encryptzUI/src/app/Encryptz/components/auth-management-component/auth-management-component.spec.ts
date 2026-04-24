import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AuthManagementComponent } from './auth-management-component';

describe('AuthManagementComponent', () => {
  let component: AuthManagementComponent;
  let fixture: ComponentFixture<AuthManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AuthManagementComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthManagementComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
