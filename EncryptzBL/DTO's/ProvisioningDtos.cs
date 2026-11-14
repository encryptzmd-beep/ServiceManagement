namespace EncryptzBL.DTO_s
{
    /// <summary>What a user sends to create a company. Who creates it comes from the token.</summary>
    public class CreateCompanyRequest
    {
        public string? CompanyName { get; set; }
        public string? CompanyCode { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? PhoneNumber { get; set; }
        /// <summary>Name of the first branch; "Head Office" when empty.</summary>
        public string? FirstBranchName { get; set; }
    }

    public class CompanyCreatedDto
    {
        public int CompanyId { get; set; }
        /// <summary>Provisioning: the database is being set up in the background.</summary>
        public string ProvisionStatus { get; set; } = "Provisioning";
    }

    /// <summary>Whether the user may create a company now, for the Create Company button.</summary>
    public class CompanyCreationStateDto
    {
        public bool CanCreate { get; set; }
        public int Created { get; set; }
        public int Limit { get; set; }
        /// <summary>Why not, when CanCreate is false. Empty otherwise.</summary>
        public string Message { get; set; } = "";
    }
}
