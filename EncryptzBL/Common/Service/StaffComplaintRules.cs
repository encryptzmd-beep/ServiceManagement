using EncryptzBL.DTO_s.EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Service
{
    /// <summary>Checks of a complaint office staff register for a customer (Register Complaint page).</summary>
    public static class StaffComplaintRules
    {
        public const string BadMobile = "Enter a valid 10-digit mobile number";
        public const string NoSubject = "Enter the subject";
        public const string NoName = "Enter the customer name";

        /// <summary>10 digits, after dropping spaces, dashes, +91 / 91 or a leading 0; otherwise null.</summary>
        public static string? NormaliseMobile(string? value)
        {
            var digits = new string((value ?? "").Where(char.IsDigit).ToArray());
            if (digits.Length == 12 && digits.StartsWith("91")) digits = digits[2..];
            else if (digits.Length == 11 && digits.StartsWith("0")) digits = digits[1..];
            return digits.Length == 10 ? digits : null;
        }

        public const string NotACustomer =
            "This mobile or email already belongs to a user account that is not a customer. Use another mobile, or leave the email empty";

        /// <summary>
        /// The 10 digits first, then the ways other screens may have stored the same mobile
        /// (the lookup is an exact match), so an existing customer is not created twice.
        /// </summary>
        public static string[] MobileVariants(string tenDigits)
            => new[] { tenDigits, "+91" + tenDigits, "91" + tenDigits, "0" + tenDigits, "+91 " + tenDigits };

        /// <summary>Clear words for the refusal of an existing user who is not a customer; other messages as they are.</summary>
        public static string RefusalOf(string? message)
            => message is "Could not create customer account" or "UserAlreadyExists"
                ? NotACustomer
                : (string.IsNullOrWhiteSpace(message) ? "The complaint could not be registered" : message);

        /// <summary>The first problem of the request, or null. A new customer needs a name.</summary>
        public static string? Problem(PublicQuickComplaintRequest_Dto dto, bool customerFound)
        {
            if (NormaliseMobile(dto?.MobileNumber) == null) return BadMobile;
            if (string.IsNullOrWhiteSpace(dto!.Subject)) return NoSubject;
            if (!customerFound && string.IsNullOrWhiteSpace(dto.FullName)) return NoName;
            return null;
        }
    }
}
