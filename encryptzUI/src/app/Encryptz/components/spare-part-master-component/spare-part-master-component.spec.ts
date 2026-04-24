import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SparePartMasterComponent } from './spare-part-master-component';

describe('SparePartMasterComponent', () => {
  let component: SparePartMasterComponent;
  let fixture: ComponentFixture<SparePartMasterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SparePartMasterComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SparePartMasterComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
