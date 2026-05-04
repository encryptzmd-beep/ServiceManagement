import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditPaymentDialog } from './edit-payment-dialog';

describe('EditPaymentDialog', () => {
  let component: EditPaymentDialog;
  let fixture: ComponentFixture<EditPaymentDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditPaymentDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(EditPaymentDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
