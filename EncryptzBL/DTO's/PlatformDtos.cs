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
        /// <summary>None | Provisioning | Ready | Failed.</summary>
        public string ProvisionStatus { get; set; } = "None";
        /// <summary>Why the set-up failed. Platform administrators only.</summary>
        public string ProvisionError { get; set; } = "";
        /// <summary>Platform administrators only.</summary>
        public string DatabaseName { get; set; } = "";

        /// <summary>
        /// Why a set-up failed and where the database is: platform administrators only
        /// (the error text can name servers and logins). The status stays visible.
        /// </summary>
        public static void HideDatabaseDetail(IEnumerable<PlatformCompanyDto> companies, bool isPlatformAdmin)
        {
            if (isPlatformAdmin)
                return;

            foreach (var company in companies)
            {
                company.ProvisionError = "";
                company.DatabaseName = "";
            }
        }
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

    /// <summary>One module of the catalogue as a company has it.</summary>
    public class CompanyModuleDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = "";
        public string ModuleName { get; set; } = "";
        public string Description { get; set; } = "";
        public string Icon { get; set; } = "";
        public int SortOrder { get; set; }
        public bool IsEnabled { get; set; }
        /// <summary>Members who can open it now (0 while it is switched off).</summary>
        public int UserCount { get; set; }
        /// <summary>False = "Coming soon": cannot be switched on. True when the database has no such column.</summary>
        public bool IsReleased { get; set; } = true;
        public string Family { get; set; } = "";
    }

    public class SetCompanyModuleRequest
    {
        public string ModuleKey { get; set; } = "";
        public bool IsEnabled { get; set; }
    }

    /// <summary>An application of the catalogue (a row of Modules), as the platform administrator sees it.</summary>
    public class ApplicationDto
    {
        public int ModuleId { get; set; }
        public string ModuleKey { get; set; } = "";
        public string ModuleName { get; set; } = "";
        public string Description { get; set; } = "";
        public string Icon { get; set; } = "";
        public string Family { get; set; } = "";
        /// <summary>Personal | Commercial</summary>
        public string AppType { get; set; } = "Commercial";
        /// <summary>Where the UI opens a personal application, for example /apps/jobs.</summary>
        public string RoutePath { get; set; } = "";
        public int SortOrder { get; set; }
        /// <summary>False = "Coming soon".</summary>
        public bool IsReleased { get; set; }
        public bool IsActive { get; set; } = true;
        /// <summary>Companies that have it switched on.</summary>
        public int CompanyCount { get; set; }
    }

    /// <summary>A branch of a company (a row of the company database's Locations).</summary>
    public class BranchDto
    {
        public int LocationId { get; set; }
        public string LocationName { get; set; } = "";
        public bool IsActive { get; set; } = true;
    }

    /// <summary>A member and the branches they may work in.</summary>
    public class BranchAccessUserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string RoleInCompany { get; set; } = "";
        /// <summary>Company administrators: every branch, not changeable per branch.</summary>
        public bool AllBranches { get; set; }
        public List<int> LocationIds { get; set; } = new();
    }

    public class BranchAccessDto
    {
        public List<BranchDto> Branches { get; set; } = new();
        public List<BranchAccessUserDto> Users { get; set; } = new();
    }

    public class SetBranchAccessRequest
    {
        public int UserId { get; set; }
        public int LocationId { get; set; }
        public bool HasAccess { get; set; }
    }

    /// <summary>A SQL server on which company databases are created. The password is never sent out.</summary>
    public class DbServerDto
    {
        public int DbServerId { get; set; }
        public string ServerName { get; set; } = "";
        public string AdminUser { get; set; } = "";
        public string ExtraOptions { get; set; } = "";
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
        public bool HasPassword { get; set; }
        public int CompanyCount { get; set; }
    }

    public class SaveDbServerRequest
    {
        public int DbServerId { get; set; }
        public string ServerName { get; set; } = "";
        public string AdminUser { get; set; } = "";
        /// <summary>Empty on an edit = keep the stored password.</summary>
        public string? AdminPassword { get; set; }
        public string? ExtraOptions { get; set; }
        public bool IsDefault { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class PlatformSettingDto
    {
        public string SettingKey { get; set; } = "";
        public string SettingValue { get; set; } = "";
        public DateTime UpdatedAt { get; set; }
        public string UpdatedByName { get; set; } = "";
    }

    public class SavePlatformSettingRequest
    {
        public string SettingKey { get; set; } = "";
        public string? SettingValue { get; set; }
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
        /// <summary>The user's lifelong ID as it is shown: EZ-XXXX-XXXX-XXXX ('' when the database has none).</summary>
        public string IndividualId { get; set; } = "";
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
