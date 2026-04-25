using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public interface IAuthService
    {
        Task<ApiResponse<string>> GenerateOtp(string mobileNumber);
        Task<ApiResponse<LoginResponseDto>> ValidateOtp(string mobileNumber, string otpCode);
        Task<ApiResponse<LoginResponseDto>> Login(string email, string password);
        Task<ApiResponse> Register(RegisterDto dto);
        Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordRequestDto dto);
        Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordRequestDto dto);
        Task<ApiResponse<string>> ChangePasswordAsync(ChangePasswordRequestDto dto);
        Task<List<MenuDto>> GetMenusByRole(int roleId);
        // management
        Task<ApiResponse<List<UserDto>>> GetUsers();
        Task<ApiResponse<object>> SaveUser(SaveUserRequest req);
        Task<ApiResponse<List<RoleDto>>> GetRoles();
        Task<ApiResponse<object>> SaveRole(SaveRoleRequest req);
        Task<ApiResponse<List<MenuAccessDto>>> GetMenuAccess(int roleId);
        Task<ApiResponse<string>> SaveMenuAccessBulk(SaveMenuAccessBulkRequest req);
        Task<ApiResponse<ExtendedLoginResponseDto>> SelfRegister(SelfRegisterDto dto);
        Task<ApiResponse<ExtendedLoginResponseDto>> LoginWithCompanies(string email, string password);
        Task<ApiResponse<LoginResponseDto>> SelectCompany(int userId, int companyId);
        Task<ApiResponse<List<CompanyResponseDto>>> GetUserCompanies(int userId);
        Task<ApiResponse<InvitationResponseDto>> InviteUser(int companyId, string email, string roleInCompany, int invitedBy, string remarks = null);
        Task<ApiResponse<SelectCompanyResponseDto>> AcceptInvitation(Guid token, int userId);
        Task<ApiResponse<bool>> RejectInvitation(int invitationId, int userId);
        Task<ApiResponse<List<InvitationResponseDto>>> GetPendingInvitations(string email);
        Task<ApiResponse<CheckUserExistsResponseDto>> CheckUserExists(string email);
        Task<ApiResponse<List<CompanyUserResponseDto>>> GetCompanyUsers(int companyId);
        Task<ApiResponse<List<string>>> GetAvailableRoles();
        Task<ApiResponse<string>> CreateCompany(string companyName, string companyCode, int createdBy, object address = null); // Disabled for now

        // Customer Portal Methods
        Task<ApiResponse<CustomerLoginResponseDto>> CustomerRegister(CustomerRegisterDto dto);
        Task<ApiResponse<CustomerLoginResponseDto>> CustomerLogin(string email, string password);
        Task<ApiResponse<CustomerDashboardDto>> GetCustomerDashboard(int customerPortalId);
        Task<ApiResponse<List<CompanyUserDetailDto>>> GetCompanyUsersWithDetails(int companyId);
        Task<ApiResponse<bool>> UpdateUserRoleInCompany(int companyId, int userId, string newRole, int updatedBy);
        Task<ApiResponse<bool>> RemoveUserFromCompany(int companyId, int userId, int removedBy);
        Task<ApiResponse<List<InvitationDetailDto>>> GetPendingInvitationsForCompany(int companyId);
        Task<ApiResponse<bool>> CancelInvitation(int invitationId, int cancelledBy);
        Task<ApiResponse<JoinRequestDto>> CreateJoinRequest(int userId, int companyId, string requestedRole, string remarks = null);
        Task<ApiResponse<List<JoinRequestDto>>> GetPendingJoinRequests(int companyId);
        Task<ApiResponse<bool>> ApproveJoinRequest(int requestId, int companyId, int reviewedBy);
        Task<ApiResponse<bool>> RejectJoinRequest(int requestId, int companyId, int reviewedBy, string reason = null);
        Task<ApiResponse<List<CompanyInfoDto>>> GetAllCompaniesForUser(int userId);
        Task<ApiResponse<List<MyJoinRequestDto>>> GetMyJoinRequests(int userId);
        Task<ApiResponse<bool>> CancelJoinRequest(int requestId, int userId);
        Task<ApiResponse<List<UserDto>>> SearchUsers(string searchTerm);
    }
}
