namespace EncryptzBL.DTO_s
{
    // ── Platform administration (MainDB: companies, projects + their DB, access, menus) ──

    /// <summary>Who is calling a platform-admin operation (taken from the token, never from the body).</summary>
    public class PlatformActor
    {
        public int UserId { get; set; }
        public string UserName { get; set; } = "";
        /// <summary>Global role Admin: may manage every company.</summary>
        public bool IsPlatformAdmin { get; set; }
        /// <summary>Admin / CompanyAdmin of <see cref="CompanyId"/>.</summary>
        public bool IsCompanyAdmin { get; set; }
        public int CompanyId { get; set; }

        public bool CanManageCompany(int companyId)
            => IsPlatformAdmin || (IsCompanyAdmin && companyId > 0 && companyId == CompanyId);
    }

    public class PlatformOtpRequest
    {
        public string? Code { get; set; }
    }

    public class PlatformCompanyDto
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = "";
        public string CompanyCode { get; set; } = "";
        public string Address { get; set; } = "";
        public string City { get; set; } = "";
        public string PhoneNumber { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public int ProjectCount { get; set; }
        public int UserCount { get; set; }
    }

    public class PlatformProjectDto
    {
        public int ProjectId { get; set; }
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = "";
        public string ProjectName { get; set; } = "";
        public string ProjectKey { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public string ServerName { get; set; } = "";
        public string DatabaseName { get; set; } = "";
        public string DbUser { get; set; } = "";
        public string ExtraOptions { get; set; } = "";
        public bool HasPassword { get; set; }
        public bool ConnectionActive { get; set; }
        public int UserCount { get; set; }
    }

    public class SaveProjectRequest
    {
        public int ProjectId { get; set; }
        public int CompanyId { get; set; }
        public string ProjectName { get; set; } = "";
        public string ProjectKey { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public string ServerName { get; set; } = "";
        public string DatabaseName { get; set; } = "";
        public string DbUser { get; set; } = "";
        /// <summary>Plain password; empty on update keeps the stored one. Stored encrypted.</summary>
        public string? DbPassword { get; set; }
        public string? ExtraOptions { get; set; }
    }

    public class ConnectionTestResult
    {
        public bool Connected { get; set; }
        /// <summary>The project-DB scripts (locations, user sync) were run on that database.</summary>
        public bool SchemaReady { get; set; }
        public int LocationCount { get; set; }
        public string Message { get; set; } = "";
    }

    public class PlatformLocationDto
    {
        public int LocationId { get; set; }
        public string LocationName { get; set; } = "";
        public string LocationCode { get; set; } = "";
        public string Address { get; set; } = "";
        public string City { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
    }

    public class ProjectAccessDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string MobileNumber { get; set; } = "";
        public string RoleInCompany { get; set; } = "";
        public bool HasAccess { get; set; }
        public DateTime? GrantedAt { get; set; }
        public string GrantedByName { get; set; } = "";
    }

    public class SetProjectAccessRequest
    {
        public int UserId { get; set; }
        public bool HasAccess { get; set; }
    }

    public class PlatformMenuDto
    {
        public int MenuId { get; set; }
        public string MenuName { get; set; } = "";
        public string MenuPath { get; set; } = "";
        public string Icon { get; set; } = "";
        public int? ParentMenuId { get; set; }
        public string ParentMenuName { get; set; } = "";
        public int SortOrder { get; set; }
        public bool IsActive { get; set; } = true;
        public string Module { get; set; } = "";
        public int RoleCount { get; set; }
    }
}

namespace EncryptzBL.DTO_s
{
    // ── The logged-in user's own profile (MainDB) ──

    public class MyProfileDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string MobileNumber { get; set; } = "";
        public string AadhaarNumber { get; set; } = "";
        public string GlobalRole { get; set; } = "";
        public string RoleInCompany { get; set; } = "";
        public int CompanyId { get; set; }
        public string CompanyName { get; set; } = "";
        public string CompanyCode { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime? MemberSince { get; set; }
    }

    public class UpdateMyProfileDto
    {
        public string FullName { get; set; } = "";
        public string? MobileNumber { get; set; }
    }

    public class ChangeMyPasswordDto
    {
        public string OldPassword { get; set; } = "";
        public string NewPassword { get; set; } = "";
    }
}
