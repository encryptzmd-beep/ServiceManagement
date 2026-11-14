using System.Text.RegularExpressions;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common
{
    /// <summary>
    /// What a self-registration must hold before an account is made. Returns the sentence the
    /// person is shown, or null when the entry is fine. The register page checks the same rules.
    /// </summary>
    public static class RegistrationRules
    {
        public const int MinPasswordLength = 6;

        private static readonly Regex Email = new(@"^[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""'.]{2,}\z", RegexOptions.CultureInvariant);
        private static readonly Regex Phone = new(@"^\+?[0-9 ()\-]+\z", RegexOptions.CultureInvariant);
        private static readonly Regex Aadhaar = new(@"^\d{12}\z", RegexOptions.CultureInvariant);

        /// <summary>Trims the entry in place and returns the first problem, or null.</summary>
        public static string? Problem(SelfRegisterDto? dto)
        {
            if (dto == null) return "Fill in the form";

            dto.FullName = (dto.FullName ?? "").Trim();
            dto.Email = (dto.Email ?? "").Trim();
            dto.MobileNumber = (dto.MobileNumber ?? "").Trim();
            dto.AadhaarNumber = (dto.AadhaarNumber ?? "").Trim();

            if (dto.FullName.Length == 0) return "Enter your full name";
            if (dto.FullName.Length > 100) return "The name is longer than 100 characters";
            if (!IsEmail(dto.Email)) return "Enter a valid e-mail address";
            if (!IsMobile(dto.MobileNumber)) return "Enter a valid mobile number (10 digits)";
            if ((dto.Password ?? "").Length < MinPasswordLength) return $"The password must be at least {MinPasswordLength} characters";
            if (dto.AadhaarNumber.Length > 0 && !Aadhaar.IsMatch(dto.AadhaarNumber)) return "The Aadhaar number must be 12 digits";
            return null;
        }

        public static bool IsEmail(string? email)
            => !string.IsNullOrEmpty(email) && email.Length <= 256 && Email.IsMatch(email);

        /// <summary>Digits, spaces, brackets, dashes and a leading +; 10 to 15 digits in all.</summary>
        public static bool IsMobile(string? mobile)
        {
            if (string.IsNullOrEmpty(mobile) || !Phone.IsMatch(mobile)) return false;
            var digits = mobile.Count(char.IsDigit);
            return digits >= 10 && digits <= 15;
        }
    }
}
