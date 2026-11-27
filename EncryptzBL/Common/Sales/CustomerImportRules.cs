using EncryptzBL.DTO_s;

namespace EncryptzBL.Common.Sales
{
    /// <summary>
    /// The bulk customer upload. One customer per party: a row is the same party as a customer of the master, or as
    /// an earlier row of the file, when the mobile (10 digits) or the GSTIN is the same. A row that matches an existing
    /// customer overwrites the stored values wherever the file has a value.
    /// </summary>
    public static class CustomerImportRules
    {
        public const int MaxRows = 1000;
        public const string New = "New";
        public const string Update = "Update";
        public const string Error = "Error";

        /// <summary>What is wrong with the row itself, or null.</summary>
        public static string? RowProblem(CustomerImportRowDto r)
        {
            if (string.IsNullOrWhiteSpace(r.CustomerName)) return "Customer name is required";
            if ((r.CustomerName?.Trim().Length ?? 0) > 150) return "Customer name is longer than 150 characters";
            if (SalesInputRules.NormalizeMobile(r.MobileNumber) == null) return "Mobile must be a valid 10-digit number";
            if ((r.AlternatePhone?.Trim().Length ?? 0) > 15) return "Alternate phone is longer than 15 characters";
            if (!SalesInputRules.IsEmailOrBlank(r.Email)) return "E-mail is not valid";
            if (!SalesInputRules.IsPinOrBlank(r.PinCode)) return "PIN code must be 6 digits";
            if (!SalesInputRules.IsGstinOrBlank(r.GSTIN)) return "GSTIN must be 15 characters, e.g. 32ABCDE1234F1Z5";
            if ((r.Address?.Trim().Length ?? 0) > 500) return "Address is longer than 500 characters";
            return null;
        }

        /// <summary>
        /// For each row, the earlier row of the file that is the same party (same mobile or GSTIN), or null.
        /// Rows with a problem of their own take no part.
        /// </summary>
        public static Dictionary<int, int> SamePartyInFile(IReadOnlyList<CustomerImportRowDto> rows)
        {
            var byMobile = new Dictionary<string, int>();
            var byGstin = new Dictionary<string, int>();
            var earlier = new Dictionary<int, int>();
            foreach (var r in rows)
            {
                if (RowProblem(r) != null) continue;
                var mobile = SalesInputRules.NormalizeMobile(r.MobileNumber)!;
                var gstin = SalesInputRules.CleanGstin(r.GSTIN);
                if (byMobile.TryGetValue(mobile, out var m)) earlier[r.RowNumber] = m;
                else if (gstin != null && byGstin.TryGetValue(gstin, out var g)) earlier[r.RowNumber] = g;
                else
                {
                    byMobile[mobile] = r.RowNumber;
                    if (gstin != null) byGstin[gstin] = r.RowNumber;
                }
            }
            return earlier;
        }

        /// <summary>
        /// The existing customer a row updates, from the customers that are the same party: the mobile match, else the
        /// GSTIN match. When the mobile is one customer's and the GSTIN another's, the row cannot be placed (problem).
        /// </summary>
        public static (int? CustomerId, string? Problem) Existing(IReadOnlyList<CustomerMatchDto> matches)
        {
            var byMobile = matches.FirstOrDefault(m => m.MatchedOn == "Mobile");
            var byGstin = matches.FirstOrDefault(m => m.MatchedOn == "GSTIN");
            if (byMobile != null && byGstin != null && byMobile.CustomerId != byGstin.CustomerId)
                return (null, $"The mobile is {byMobile.CustomerName}'s and the GSTIN is {byGstin.CustomerName}'s");
            return ((byMobile ?? byGstin)?.CustomerId, null);
        }
    }
}
