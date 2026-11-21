namespace EncryptzBL.DTO_s
{
    public class ForgotPasswordRequestDto
    {
        public string Email { get; set; } = null!;
    }

    public class ResetPasswordRequestDto
    {
        public string Email { get; set; } = null!;
        public string OtpCode { get; set; } = null!;
        public string NewPassword { get; set; } = null!;
    }

    public class ChangePasswordRequestDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = null!;
        public string OldPassword { get; set; } = null!;
        public string NewPassword { get; set; } = null!;
    }
}
