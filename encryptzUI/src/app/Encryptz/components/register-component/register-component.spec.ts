import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../Auth/auth-service';
import { RegisterComponent } from './register-component';

describe('RegisterComponent invite link', () => {
  const create = (query: Record<string, string>) => {
    const selfRegister = vi.fn(() => of({ success: true, message: 'ok', data: { userId: 1 } }));
    TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { selfRegister } },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    const fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    return { fixture, selfRegister };
  };

  it('pre-fills the e-mail and sends the referral token', () => {
    const { fixture, selfRegister } = create({ ref: 'abc', email: 'f@x.com' });
    const c = fixture.componentInstance;
    expect(c.email).toBe('f@x.com');
    c.fullName = 'Friend'; c.mobileNumber = '9876543210'; c.password = 'secret1'; c.confirmPassword = 'secret1';
    c.register();
    expect(selfRegister).toHaveBeenCalledWith(expect.objectContaining({ referralToken: 'abc', email: 'f@x.com' }));
  });

  it('sends the inviter key of a shared link', () => {
    const { fixture, selfRegister } = create({ inv: 'K7M2QX9PLR4T' });
    const c = fixture.componentInstance;
    c.fullName = 'F'; c.email = 'f@x.com'; c.mobileNumber = '9876543210'; c.password = 'secret1'; c.confirmPassword = 'secret1';
    c.register();
    expect(selfRegister).toHaveBeenCalledWith(expect.objectContaining({ inviterKey: 'K7M2QX9PLR4T' }));
    expect((selfRegister.mock.calls[0] as any)[0].referralToken).toBeUndefined();
  });

  it('sends no token without a ref', () => {
    const { fixture, selfRegister } = create({});
    const c = fixture.componentInstance;
    c.fullName = 'F'; c.email = 'f@x.com'; c.mobileNumber = '9876543210'; c.password = 'secret1'; c.confirmPassword = 'secret1';
    c.register();
    expect((selfRegister.mock.calls[0] as any)[0].referralToken).toBeUndefined();
  });
});
