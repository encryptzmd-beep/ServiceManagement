namespace EncryptzBL.DTO_s
{
    // ── Users & Roles of a company (outside the modules) ──

    /// <summary>What the signed-in person may do on the Users &amp; Roles screen.</summary>
    public class CompanyAccessMeDto
    {
        public bool CanManage { get; set; }
        /// <summary>May give or take "Can manage users &amp; roles": the tenant admin only.</summary>
        public bool CanGrant { get; set; }
    }

    public class CompanyAccessMenuDto
    {
        public int MenuId { get; set; }
        public string MenuName { get; set; } = "";
        public string GroupName { get; set; } = "";
    }

    public class CompanyAccessModuleDto
    {
        public string ModuleKey { get; set; } = "";
        public string ModuleName { get; set; } = "";
        public string Icon { get; set; } = "";
        public List<CompanyAccessMenuDto> Menus { get; set; } = new();
    }

    public class CompanyRoleMenuDto
    {
        public int MenuId { get; set; }
        public bool CanView { get; set; }
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
    }

    public class CompanyRoleDto
    {
        public int CompanyRoleId { get; set; }
        public string RoleName { get; set; } = "";
        public string Description { get; set; } = "";
        public string AccessLevel { get; set; } = "";
        public int UserCount { get; set; }
        public List<string> ModuleKeys { get; set; } = new();
        public List<CompanyRoleMenuDto> Menus { get; set; } = new();
    }

    public class CompanyAccessUserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string MobileNumber { get; set; } = "";
        public string RoleInCompany { get; set; } = "";
        public bool IsActive { get; set; }
        public bool IsTenantAdmin { get; set; }
        public bool CanManage { get; set; }
        public List<int> RoleIds { get; set; } = new();
        public List<string> ModuleKeys { get; set; } = new();
        public bool AllBranches { get; set; }
        public List<int> LocationIds { get; set; } = new();
    }

    public class CompanyAccessBranchDto
    {
        public int LocationId { get; set; }
        public string LocationName { get; set; } = "";
    }

    public class CompanyAccessOverviewDto
    {
        public int ActorUserId { get; set; }
        public bool CanGrant { get; set; }
        /// <summary>Why branches cannot be set right now ('' when they can).</summary>
        public string BranchNote { get; set; } = "";
        public List<CompanyAccessModuleDto> Modules { get; set; } = new();
        public List<CompanyRoleDto> Roles { get; set; } = new();
        public List<CompanyAccessUserDto> Users { get; set; } = new();
        public List<CompanyAccessBranchDto> Branches { get; set; } = new();
    }

    public class SaveCompanyRoleRequest
    {
        public int CompanyRoleId { get; set; }
        public string? RoleName { get; set; }
        public string? Description { get; set; }
        public string? AccessLevel { get; set; }
        public List<string>? ModuleKeys { get; set; }
        public List<CompanyRoleMenuDto>? Menus { get; set; }
    }

    public class SaveCompanyUserRequest
    {
        public int UserId { get; set; }
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? MobileNumber { get; set; }
        /// <summary>Only for a person who has no account yet.</summary>
        public string? Password { get; set; }
        public bool IsActive { get; set; } = true;
        public List<int>? RoleIds { get; set; }
        /// <summary>Null leaves the member's branches as they are.</summary>
        public List<int>? LocationIds { get; set; }
        public bool CanManage { get; set; }
    }

    public class SetCompanyManagerRequest
    {
        public int UserId { get; set; }
        public bool Enabled { get; set; }
    }
}
