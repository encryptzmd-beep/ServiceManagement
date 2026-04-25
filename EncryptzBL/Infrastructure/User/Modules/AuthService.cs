using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Reflection;
using System.Security.Claims;
using System.Text;

namespace EncryptzBL.Infrastructure.User.Modules
{
    public class AuthService : BaseRepository, IAuthService
    {
        private readonly IConfiguration _config;
        private readonly IEmailService _emailService;

        public AuthService(DbHelper db, IConfiguration config, IEmailService emailService) : base(db)
        {
            _config = config;
            _emailService = emailService;
        }

        // ============================================
        // EXISTING METHODS (Keep as is)
        // ============================================

        public async Task<ApiResponse<string>> GenerateOtp(string mobileNumber)
        {
            var otp = new Random().Next(100000, 999999).ToString();

            var parameters = new[]
            {
                SqlParameterHelper.Input("@MobileNumber", mobileNumber),
                SqlParameterHelper.Input("@OtpCode", otp),
                SqlParameterHelper.Input("@ExpiresAt", DateTime.UtcNow.AddMinutes(5))
            };

            await ExecuteAsync("sp_Auth_GenerateOtp", parameters);

            return ApiResponse<string>.Ok(null, "OTP sent successfully");
        }

        public async Task<ApiResponse<LoginResponseDto>> ValidateOtp(string mobileNumber, string otpCode)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@MobileNumber", mobileNumber),
                SqlParameterHelper.Input("@OtpCode", otpCode)
            };

            var ds = await GetDataSetAsync("sp_Auth_ValidateOtp", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<LoginResponseDto>.Fail("Invalid or expired OTP");
            }

            var userRow = ds.Tables[0].Rows[0];

            var userId = Convert.ToInt32(userRow["UserId"]);
            var fullName = userRow["FullName"]?.ToString() ?? "";
            var role = userRow["Role"]?.ToString() ?? "";
            var email = userRow["Email"]?.ToString() ?? "";
            var mobile = userRow["MobileNumber"]?.ToString() ?? "";

            var token = GenerateJwtToken(userId, fullName, role, email, mobile);

            var menus = (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                ? ds.Tables[1].ToList<MenuDto>()
                : new List<MenuDto>();

            var response = new LoginResponseDto
            {
                Token = token,
                FullName = fullName,
                Role = role,
                UserId = userId,
                Menus = menus
            };

            return ApiResponse<LoginResponseDto>.Ok(response, "Login successful");
        }

        public async Task<ApiResponse<LoginResponseDto>> Login(string email, string password)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", email)
            };

            var ds = await GetDataSetAsync("sp_Auth_Login", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<LoginResponseDto>.Fail("Invalid credentials");
            }

            var row = ds.Tables[0].Rows[0];
            var passwordHash = row["PasswordHash"]?.ToString() ?? string.Empty;

            if (string.IsNullOrEmpty(passwordHash) || !BCrypt.Net.BCrypt.Verify(password, passwordHash))
            {
                return ApiResponse<LoginResponseDto>.Fail("Invalid credentials");
            }

            var userId = Convert.ToInt32(row["UserId"]);
            var fullName = row["FullName"]?.ToString() ?? "";
            var role = row["Role"]?.ToString() ?? "";
            var mobile = row["MobileNumber"]?.ToString() ?? "";
            int? technicianId = row["technicianId"] == DBNull.Value ? null : Convert.ToInt32(row["technicianId"]);

            var token = GenerateJwtToken(userId, fullName, role, email, mobile);

            var menus = (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                ? ds.Tables[1].ToList<MenuDto>()
                : new List<MenuDto>();

            var response = new LoginResponseDto
            {
                Token = token,
                FullName = fullName,
                Role = role,
                UserId = userId,
                technicianId = technicianId,
                Menus = menus,
                mobileNumber = mobile
            };

            return ApiResponse<LoginResponseDto>.Ok(response, "Login successful");
        }

        public async Task<ApiResponse> Register(RegisterDto dto)
        {
            var outputUserId = SqlParameterHelper.Output("@UserId", SqlDbType.Int);

            var parameters = new[]
            {
                SqlParameterHelper.Input("@FullName", dto.FullName),
                SqlParameterHelper.Input("@Email", dto.Email),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber),
                SqlParameterHelper.Input("@PasswordHash", BCrypt.Net.BCrypt.HashPassword(dto.Password)),
                SqlParameterHelper.Input("@RoleId", dto.RoleId),
                outputUserId
            };

            await ExecuteAsync("sp_Auth_Register", parameters);

            var newUserId = SqlParameterHelper.GetOutputValue<int>(outputUserId);

            if (newUserId <= 0)
            {
                return new ApiResponse(false, "Mobile number already registered");
            }

            return new ApiResponse(true, "Registration successful");
        }

        public async Task<ApiResponse<string>> ForgotPasswordAsync(ForgotPasswordRequestDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", dto.Email)
            };

            var ds = await GetDataSetAsync("sp_User_ForgotPassword", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<string>.Fail("Email not found");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<string>.Fail(row["Message"]?.ToString());
            }

            var otpCode = row["OtpCode"]?.ToString();
            
            // Send Email with OTP
            string subject = "Password Reset OTP - Encryptz";
            string body = $@"
                <h3>Password Reset Request</h3>
                <p>Hello,</p>
                <p>We received a request to reset your password. Use the following OTP to proceed:</p>
                <div style='font-size: 24px; font-weight: bold; color: #2563eb; padding: 10px; background: #f1f5f9; border-radius: 8px; display: inline-block;'>
                    {otpCode}
                </div>
                <p>This OTP is valid for 10 minutes. If you did not request this, please ignore this email.</p>
                <br/>
                <p>Regards,<br/>Encryptz Team</p>";

            try
            {
                await _emailService.SendEmailAsync(dto.Email, subject, body);
                return ApiResponse<string>.Ok(null, "OTP sent to email successfully");
            }
            catch (Exception ex)
            {
                // Log exception if needed
                return ApiResponse<string>.Fail("Failed to send email. Please try again later.");
            }
        }

        public async Task<ApiResponse<string>> ResetPasswordAsync(ResetPasswordRequestDto dto)
        {
            var newPasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);

            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", dto.Email),
                SqlParameterHelper.Input("@OtpCode", dto.OtpCode),
                SqlParameterHelper.Input("@NewPasswordHash", newPasswordHash)
            };

            var ds = await GetDataSetAsync("sp_User_ResetPassword", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<string>.Fail("Failed to reset password");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<string>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<string>.Ok(null, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<string>> ChangePasswordAsync(ChangePasswordRequestDto dto)
        {
            DataTable dt = null;
            if (dto.UserId > 0)
            {
                var parametersCheck = new[] { SqlParameterHelper.Input("@UserId", dto.UserId) };
                dt = await GetDataTableByQueryAsync("SELECT UserId, PasswordHash FROM Users WHERE UserId = @UserId", parametersCheck);
            }
            else if (!string.IsNullOrEmpty(dto.Username))
            {
                var parametersCheck = new[] { SqlParameterHelper.Input("@Username", dto.Username) };
                dt = await GetDataTableByQueryAsync("SELECT UserId, PasswordHash FROM Users WHERE Email = @Username OR MobileNumber = @Username", parametersCheck);
            }

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<string>.Fail("User not found");
            }
            
            var currentHash = dt.Rows[0]["PasswordHash"]?.ToString();
            dto.UserId = Convert.ToInt32(dt.Rows[0]["UserId"]);

            
            if (string.IsNullOrEmpty(currentHash) || !BCrypt.Net.BCrypt.Verify(dto.OldPassword, currentHash))
            {
                return ApiResponse<string>.Fail("Incorrect old password");
            }
            
            var newPasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", dto.UserId),
                SqlParameterHelper.Input("@NewPasswordHash", newPasswordHash)
            };

            var ds = await GetDataSetAsync("sp_User_ChangePassword", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<string>.Fail("Failed to change password");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<string>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<string>.Ok(null, row["Message"]?.ToString());
        }


        public async Task<List<MenuDto>> GetMenusByRole(int roleId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@RoleId", roleId)
            };

            var dt = await GetDataTableAsync("sp_Auth_GetMenusByRole", parameters);
            return dt?.ToList<MenuDto>() ?? new List<MenuDto>();
        }

        // ============================================
        // MANAGEMENT METHODS (Users, Roles, Menu Access)
        // ============================================

        public async Task<ApiResponse<List<UserDto>>> GetUsers()
        {
            var dt = await GetDataTableAsync("sp_Mgmt_GetUsers");

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<UserDto>>.Fail("No users found");

            var list = dt.Rows.Cast<DataRow>().Select(r => new UserDto
            {
                UserId = Convert.ToInt32(r["UserId"]),
                FullName = r["FullName"]?.ToString() ?? "",
                Email = r["Email"]?.ToString() ?? "",
                MobileNumber = r["MobileNumber"]?.ToString() ?? "",
                RoleId = Convert.ToInt32(r["RoleId"]),
                RoleName = r["RoleName"]?.ToString() ?? "",
                IsActive = Convert.ToBoolean(r["IsActive"]),
                CreatedAt = Convert.ToDateTime(r["CreatedAt"])
            }).ToList();

            return ApiResponse<List<UserDto>>.Ok(list, "Success");
        }

        public async Task<ApiResponse<object>> SaveUser(SaveUserRequest req)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", req.UserId ?? 0),
                SqlParameterHelper.Input("@FullName", req.FullName),
                SqlParameterHelper.Input("@Email", req.Email),
                SqlParameterHelper.Input("@MobileNumber", req.MobileNumber),
                SqlParameterHelper.Input("@RoleId", req.RoleId),
                SqlParameterHelper.Input("@IsActive", req.IsActive),
                SqlParameterHelper.Input("@PasswordHash",
                    string.IsNullOrEmpty(req.Password) ? (object)DBNull.Value : BCrypt.Net.BCrypt.HashPassword(req.Password))
            };

            var dt = await GetDataTableAsync("sp_Mgmt_SaveUser", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<object>.Fail("Save failed");

            var row = dt.Rows[0];
            return ApiResponse<object>.Ok(new
            {
                userId = Convert.ToInt32(row["UserId"]),
                status = row["Status"]?.ToString()
            }, "User saved successfully");
        }

        public async Task<ApiResponse<List<RoleDto>>> GetRoles()
        {
            var dt = await GetDataTableAsync("sp_Mgmt_GetRoles");

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<RoleDto>>.Fail("No roles found");

            var list = dt.Rows.Cast<DataRow>().Select(r => new RoleDto
            {
                RoleId = Convert.ToInt32(r["RoleId"]),
                RoleName = r["RoleName"]?.ToString() ?? "",
                Description = r["Description"]?.ToString(),
                IsActive = Convert.ToBoolean(r["IsActive"]),
                CreatedAt = Convert.ToDateTime(r["CreatedAt"])
            }).ToList();

            return ApiResponse<List<RoleDto>>.Ok(list, "Success");
        }

        public async Task<ApiResponse<object>> SaveRole(SaveRoleRequest req)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@RoleId", req.RoleId ?? 0),
                SqlParameterHelper.Input("@RoleName", req.RoleName),
                SqlParameterHelper.Input("@Description", (object?)req.Description ?? DBNull.Value),
                SqlParameterHelper.Input("@IsActive", req.IsActive)
            };

            var dt = await GetDataTableAsync("sp_Mgmt_SaveRole", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<object>.Fail("Save failed");

            var row = dt.Rows[0];
            return ApiResponse<object>.Ok(new
            {
                roleId = Convert.ToInt32(row["RoleId"]),
                status = row["Status"]?.ToString()
            }, "Role saved successfully");
        }

        public async Task<ApiResponse<List<MenuAccessDto>>> GetMenuAccess(int roleId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@RoleId", roleId)
            };

            var dt = await GetDataTableAsync("sp_Mgmt_GetMenuAccess", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<MenuAccessDto>>.Fail("No menu access found");

            var list = dt.Rows.Cast<DataRow>().Select(r => new MenuAccessDto
            {
                MenuId = Convert.ToInt32(r["MenuId"]),
                MenuName = r["MenuName"]?.ToString() ?? "",
                MenuPath = r["MenuPath"]?.ToString(),
                ParentMenuId = r["ParentMenuId"] == DBNull.Value ? null : Convert.ToInt32(r["ParentMenuId"]),
                SortOrder = Convert.ToInt32(r["SortOrder"]),
                CanView = Convert.ToBoolean(r["CanView"]),
                CanCreate = Convert.ToBoolean(r["CanCreate"]),
                CanEdit = Convert.ToBoolean(r["CanEdit"]),
                CanDelete = Convert.ToBoolean(r["CanDelete"]),
                HasAccess = Convert.ToBoolean(r["HasAccess"])
            }).ToList();

            return ApiResponse<List<MenuAccessDto>>.Ok(list, "Success");
        }

        public async Task<ApiResponse<string>> SaveMenuAccessBulk(SaveMenuAccessBulkRequest req)
        {
            var json = System.Text.Json.JsonSerializer.Serialize(req.Items.Select(i => new
            {
                menuId = i.MenuId,
                canView = i.CanView ? 1 : 0,
                canCreate = i.CanCreate ? 1 : 0,
                canEdit = i.CanEdit ? 1 : 0,
                canDelete = i.CanDelete ? 1 : 0
            }));

            var parameters = new[]
            {
                SqlParameterHelper.Input("@RoleId", req.RoleId),
                SqlParameterHelper.Input("@AccessJson", json)
            };

            await ExecuteAsync("sp_Mgmt_SaveMenuAccessBulk", parameters);

            return ApiResponse<string>.Ok(null, "Menu access updated successfully");
        }

        // ============================================
        // MULTI-COMPANY METHODS
        // ============================================

        public async Task<ApiResponse<ExtendedLoginResponseDto>> SelfRegister(SelfRegisterDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@FullName", dto.FullName),
                SqlParameterHelper.Input("@Email", dto.Email),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber),
                SqlParameterHelper.Input("@PasswordHash", BCrypt.Net.BCrypt.HashPassword(dto.Password)),
                SqlParameterHelper.Input("@AadhaarNumber", (object?)dto.AadhaarNumber ?? DBNull.Value)
            };

            var ds = await GetDataSetAsync("sp_User_SelfRegister", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<ExtendedLoginResponseDto>.Fail("Registration failed");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<ExtendedLoginResponseDto>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<ExtendedLoginResponseDto>.Ok(null, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<ExtendedLoginResponseDto>> LoginWithCompanies(string email, string password)
        {
            var loginResult = await Login(email, password);

            if (!loginResult.Success || loginResult.Data == null)
            {
                return ApiResponse<ExtendedLoginResponseDto>.Fail(loginResult.Message);
            }

            var companiesResult = await GetUserCompanies(loginResult.Data.UserId);

            var response = new ExtendedLoginResponseDto
            {
                Token = loginResult.Data.Token,
                FullName = loginResult.Data.FullName,
                Role = loginResult.Data.Role,
                UserId = loginResult.Data.UserId,
                technicianId = loginResult.Data.technicianId,
                mobileNumber = loginResult.Data.mobileNumber,
                Email = email,

                // keep empty until company selected
                Menus = new List<MenuDto>(),

                Companies = companiesResult.Data ?? new List<CompanyResponseDto>()
            };

            return ApiResponse<ExtendedLoginResponseDto>.Ok(response, "Login successful");
        }

        public async Task<ApiResponse<List<CompanyResponseDto>>> GetUserCompanies(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_User_GetCompanies", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<CompanyResponseDto>>.Ok(new List<CompanyResponseDto>(), "No companies found");
            }

            var companies = dt.Rows.Cast<DataRow>().Select(r => new CompanyResponseDto
            {
                CompanyId = Convert.ToInt32(r["CompanyId"]),
                CompanyName = r["CompanyName"]?.ToString() ?? "",
                CompanyCode = r["CompanyCode"]?.ToString() ?? "",
                Address = r["Address"]?.ToString(),
                City = r["City"]?.ToString(),
                PhoneNumber = r["PhoneNumber"]?.ToString(),
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? "",
                IsLinked = Convert.ToBoolean(r["IsLinked"])
            }).ToList();

            return ApiResponse<List<CompanyResponseDto>>.Ok(companies, "Success");
        }

        public async Task<ApiResponse<LoginResponseDto>> SelectCompany(int userId, int companyId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@CompanyId", companyId)
    };

            var dt = await GetDataTableAsync("sp_User_SelectCompany", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<LoginResponseDto>.Fail("You don't have access to this company");
            }

            var row = dt.Rows[0];

            var role = row["RoleInCompany"]?.ToString() ?? "User";
            var companyName = row["CompanyName"]?.ToString() ?? "";
            int technicianId = row["TechnicianId"] != DBNull.Value
     ? Convert.ToInt32(row["TechnicianId"])
     : 0;
            var userInfo = await GetUserById(userId);

            var token = GenerateJwtTokenWithCompany(
                userId,
                userInfo.FullName,
                role,
                userInfo.Email,
                userInfo.Mobile,
                companyId
            );

            var sessionParams = new[]
            {
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@AuthToken", token)
    };

            await ExecuteAsync("sp_User_UpdateSession", sessionParams);

            // NEW: Load menus for selected company + role
            var menuParams = new[]
            {
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@CompanyId", companyId)
    };

            var menuTable = await GetDataTableAsync("sp_User_GetMenusForCompany", menuParams);

            var menus = menuTable != null
                ? menuTable.ToList<MenuDto>()
                : new List<MenuDto>();

            var response = new LoginResponseDto
            {
                Token = token,
                FullName = userInfo.FullName,
                Role = role,
                UserId = userId,
                Email = userInfo.Email,
                technicianId = technicianId,
                mobileNumber = userInfo.Mobile,
                Menus = menus
            };

            return ApiResponse<LoginResponseDto>.Ok(response, "Company selected successfully");
        }

        public async Task<ApiResponse<InvitationResponseDto>> InviteUser(int companyId, string email, string roleInCompany, int invitedBy, string remarks = null)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@Email", email),
                SqlParameterHelper.Input("@RoleInCompany", roleInCompany),
                SqlParameterHelper.Input("@InvitedBy", invitedBy),
                SqlParameterHelper.Input("@Remarks", (object?)remarks ?? DBNull.Value)
            };

            var ds = await GetDataSetAsync("sp_Company_InviteUser", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<InvitationResponseDto>.Fail("Failed to send invitation");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<InvitationResponseDto>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<InvitationResponseDto>.Ok(new InvitationResponseDto
            {
                InvitationId = Convert.ToInt32(row["InvitationId"])
            }, row["Message"]?.ToString());
        }
        // AuthService.cs - ADD THIS METHOD

        public async Task<ApiResponse<bool>> RejectInvitation(int invitationId, int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@InvitationId", invitationId),
        SqlParameterHelper.Input("@UserId", userId)
    };

            var ds = await GetDataSetAsync("sp_Company_RejectInvitation", parameters);

            if (ds != null && ds.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0)
            {
                var row = ds.Tables[0].Rows[0];
                var success = Convert.ToInt32(row["Success"]) == 1;

                if (success)
                {
                    return ApiResponse<bool>.Ok(true, row["Message"]?.ToString());
                }
                return ApiResponse<bool>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<bool>.Fail("Failed to reject invitation");
        }
        public async Task<ApiResponse<SelectCompanyResponseDto>> AcceptInvitation(Guid token, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Token", token),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var ds = await GetDataSetAsync("sp_Company_AcceptInvitation", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<SelectCompanyResponseDto>.Fail("Failed to accept invitation");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<SelectCompanyResponseDto>.Fail(row["Message"]?.ToString());
            }

            var companyId = Convert.ToInt32(row["CompanyId"]);
            var role = row["RoleInCompany"]?.ToString() ?? "User";

            var userInfo = await GetUserById(userId);
            var newToken = GenerateJwtTokenWithCompany(userId, userInfo.FullName, role, userInfo.Email, userInfo.Mobile, companyId);

            var redirectUrl = role switch
            {
                "Admin" => "/admin/dashboard",
                "Technician" => "/technicians/work-orders",
                "Storekeeper" => "/store/inventory",
                "Manager" => "/manager/dashboard",
                _ => "/dashboard"
            };

            return ApiResponse<SelectCompanyResponseDto>.Ok(new SelectCompanyResponseDto
            {
                Token = newToken,
                Role = role,
                RedirectUrl = redirectUrl
            }, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<List<InvitationResponseDto>>> GetPendingInvitations(string email)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", email)
            };

            var dt = await GetDataTableAsync("sp_User_GetPendingInvitations", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<InvitationResponseDto>>.Ok(new List<InvitationResponseDto>(), "No pending invitations");
            }

            var invitations = dt.Rows.Cast<DataRow>().Select(r => new InvitationResponseDto
            {
                InvitationId = Convert.ToInt32(r["InvitationId"]),
                CompanyId = Convert.ToInt32(r["CompanyId"]),
                CompanyName = r["CompanyName"]?.ToString() ?? "",
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? "",
                Token = Guid.Parse(r["Token"]?.ToString()),
                ExpiresAt = Convert.ToDateTime(r["ExpiresAt"]),
                InvitedByName = r["InvitedByName"]?.ToString() ?? "System"
            }).ToList();

            return ApiResponse<List<InvitationResponseDto>>.Ok(invitations, "Success");
        }

        public async Task<ApiResponse<CheckUserExistsResponseDto>> CheckUserExists(string email)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", email)
            };

            var dt = await GetDataTableAsync("sp_User_CheckExists", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<CheckUserExistsResponseDto>.Ok(new CheckUserExistsResponseDto { Exists = false }, "User not found");
            }

            var row = dt.Rows[0];
            return ApiResponse<CheckUserExistsResponseDto>.Ok(new CheckUserExistsResponseDto
            {
                Exists = true,
                UserId = Convert.ToInt32(row["UserId"]),
                FullName = row["FullName"]?.ToString()
            }, "User found");
        }

        public async Task<ApiResponse<List<CompanyUserResponseDto>>> GetCompanyUsers(int companyId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId)
            };

            var dt = await GetDataTableAsync("sp_Company_GetUsers", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<CompanyUserResponseDto>>.Ok(new List<CompanyUserResponseDto>(), "No users found");
            }

            var users = dt.Rows.Cast<DataRow>().Select(r => new CompanyUserResponseDto
            {
                UserId = Convert.ToInt32(r["UserId"]),
                FullName = r["FullName"]?.ToString() ?? "",
                Email = r["Email"]?.ToString() ?? "",
                MobileNumber = r["MobileNumber"]?.ToString() ?? "",
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? "",
                AssignedAt = Convert.ToDateTime(r["AssignedAt"]),
                AssignedByName = r["AssignedByName"]?.ToString() ?? "System"
            }).ToList();

            return ApiResponse<List<CompanyUserResponseDto>>.Ok(users, "Success");
        }

        public async Task<ApiResponse<List<string>>> GetAvailableRoles()
        {
            var roles = new List<string> { "Admin", "Technician", "Storekeeper", "Manager" };
            return await Task.FromResult(ApiResponse<List<string>>.Ok(roles, "Success"));
        }

        public async Task<ApiResponse<string>> CreateCompany(string companyName, string companyCode, int createdBy, object address = null)
        {
            // Company creation is disabled as per requirement
            return await Task.FromResult(ApiResponse<string>.Fail("Company creation is currently disabled. Please contact support."));
        }

        // ============================================
        // CUSTOMER PORTAL METHODS
        // ============================================

        public async Task<ApiResponse<CustomerLoginResponseDto>> CustomerRegister(CustomerRegisterDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@FullName", dto.FullName),
                SqlParameterHelper.Input("@Email", dto.Email),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber),
                SqlParameterHelper.Input("@PasswordHash", BCrypt.Net.BCrypt.HashPassword(dto.Password)),
                SqlParameterHelper.Input("@Address", (object?)dto.Address ?? DBNull.Value),
                SqlParameterHelper.Input("@City", (object?)dto.City ?? DBNull.Value)
            };

            var ds = await GetDataSetAsync("sp_CustomerPortal_Register", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<CustomerLoginResponseDto>.Fail("Registration failed");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<CustomerLoginResponseDto>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<CustomerLoginResponseDto>.Ok(null, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<CustomerLoginResponseDto>> CustomerLogin(string email, string password)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Email", email)
            };

            var ds = await GetDataSetAsync("sp_CustomerPortal_Login", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<CustomerLoginResponseDto>.Fail("Invalid credentials");
            }

            var row = ds.Tables[0].Rows[0];
            var passwordHash = row["PasswordHash"]?.ToString() ?? string.Empty;

            if (!BCrypt.Net.BCrypt.Verify(password, passwordHash))
            {
                return ApiResponse<CustomerLoginResponseDto>.Fail("Invalid credentials");
            }

            var customerPortalId = Convert.ToInt32(row["CustomerPortalId"]);
            var fullName = row["FullName"]?.ToString() ?? "";
            var customerEmail = row["Email"]?.ToString() ?? "";

            var token = GenerateCustomerJwtToken(customerPortalId, customerEmail, fullName);

            return ApiResponse<CustomerLoginResponseDto>.Ok(new CustomerLoginResponseDto
            {
                CustomerPortalId = customerPortalId,
                FullName = fullName,
                Email = customerEmail,
                Token = token,
                RedirectUrl = "/customer-portal/dashboard"
            }, "Login successful");
        }

        public async Task<ApiResponse<CustomerDashboardDto>> GetCustomerDashboard(int customerPortalId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerPortalId", customerPortalId)
            };

            var ds = await GetDataSetAsync("sp_CustomerPortal_GetDashboard", parameters);

            if (ds == null || ds.Tables.Count == 0)
            {
                return ApiResponse<CustomerDashboardDto>.Fail("Failed to load dashboard");
            }

            var profile = new CustomerProfileDto();
            if (ds.Tables[0].Rows.Count > 0)
            {
                var row = ds.Tables[0].Rows[0];
                profile = new CustomerProfileDto
                {
                    CustomerPortalId = Convert.ToInt32(row["CustomerPortalId"]),
                    FullName = row["FullName"]?.ToString() ?? "",
                    Email = row["Email"]?.ToString() ?? "",
                    MobileNumber = row["MobileNumber"]?.ToString() ?? "",
                    Address = row["Address"]?.ToString(),
                    City = row["City"]?.ToString()
                };
            }

            var menus = new List<CustomerMenuDto>();
            if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
            {
                menus = ds.Tables[1].Rows.Cast<DataRow>().Select(r => new CustomerMenuDto
                {
                    MenuId = Convert.ToInt32(r["MenuId"]),
                    MenuName = r["MenuName"]?.ToString() ?? "",
                    MenuPath = r["MenuPath"]?.ToString() ?? "",
                    Icon = r["Icon"]?.ToString() ?? ""
                }).ToList();
            }

            return ApiResponse<CustomerDashboardDto>.Ok(new CustomerDashboardDto
            {
                Profile = profile,
                Menus = menus
            }, "Success");
        }

        // ============================================
        // PRIVATE HELPER METHODS
        // ============================================

        private string GenerateJwtToken(int userId, string fullName, string role, string email, string mobile)
        {
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                throw new Exception("JWT Key not configured in appsettings.json");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Email, email ?? ""),
                new Claim(ClaimTypes.MobilePhone, mobile ?? ""),
                new Claim(ClaimTypes.Role, role)
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(24),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateJwtTokenWithCompany(int userId, string fullName, string role, string email, string mobile, int companyId)
        {
            var jwtKey = _config["Jwt:Key"];
            if (string.IsNullOrEmpty(jwtKey))
                throw new Exception("JWT Key not configured");

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Email, email ?? ""),
                new Claim(ClaimTypes.MobilePhone, mobile ?? ""),
                new Claim(ClaimTypes.Role, role),
                new Claim("CompanyId", companyId.ToString())
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(24),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateCustomerJwtToken(int customerPortalId, string email, string fullName)
        {
            var jwtKey = _config["Jwt:Key"];
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

            var claims = new[]
            {
                new Claim("CustomerPortalId", customerPortalId.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Name, fullName),
                new Claim(ClaimTypes.Role, "Customer")
            };

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddDays(7),
                signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256)
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private async Task<(int UserId, string FullName, string Email, string Mobile, string Role)> GetUserById(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_GetUserById", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return (0, "", "", "", "");
            }

            var row = dt.Rows[0];
            return (
                Convert.ToInt32(row["UserId"]),
                row["FullName"]?.ToString() ?? "",
                row["Email"]?.ToString() ?? "",
                row["MobileNumber"]?.ToString() ?? "",
                row["RoleName"]?.ToString() ?? ""
            );
        }

        private async Task<string> GetUserName(int userId)
        {
            var user = await GetUserById(userId);
            return user.FullName;
        }

        private async Task<string> GetUserEmail(int userId)
        {
            var user = await GetUserById(userId);
            return user.Email;
        }

        private async Task<string> GetUserMobile(int userId)
        {
            var user = await GetUserById(userId);
            return user.Mobile;
        }
        // Infrastructure/User/Modules/AuthService.cs - ADD THESE METHODS

        #region Company User Management

        public async Task<ApiResponse<List<CompanyUserDetailDto>>> GetCompanyUsersWithDetails(int companyId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@CompanyId", companyId)
    };

            var dt = await GetDataTableAsync("sp_Company_GetUsersWithDetails", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<CompanyUserDetailDto>>.Ok(new List<CompanyUserDetailDto>(), "No users found");
            }

            var users = dt.Rows.Cast<DataRow>().Select(r => new CompanyUserDetailDto
            {
                CompanyUserId = Convert.ToInt32(r["CompanyUserId"]),
                UserId = Convert.ToInt32(r["UserId"]),
                FullName = r["FullName"]?.ToString() ?? "",
                Email = r["Email"]?.ToString() ?? "",
                MobileNumber = r["MobileNumber"]?.ToString() ?? "",
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? "",
                AssignedAt = Convert.ToDateTime(r["AssignedAt"]),
                AssignedBy = r["AssignedBy"]?.ToString() ?? "System",
                IsActive = Convert.ToBoolean(r["IsActive"])
            }).ToList();

            return ApiResponse<List<CompanyUserDetailDto>>.Ok(users, "Success");
        }

        public async Task<ApiResponse<bool>> UpdateUserRoleInCompany(int companyId, int userId, string newRole, int updatedBy)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@NewRole", newRole),
        SqlParameterHelper.Input("@UpdatedBy", updatedBy)
    };

            var dt = await GetDataTableAsync("sp_Company_UpdateUserRole", parameters);

            if (dt != null && dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["UpdatedCount"]) > 0)
            {
                return ApiResponse<bool>.Ok(true, "Role updated successfully");
            }

            return ApiResponse<bool>.Fail("Failed to update role");
        }

        public async Task<ApiResponse<bool>> RemoveUserFromCompany(int companyId, int userId, int removedBy)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@RemovedBy", removedBy)
    };

            var dt = await GetDataTableAsync("sp_Company_RemoveUser", parameters);

            if (dt != null && dt.Rows.Count > 0 && Convert.ToInt32(dt.Rows[0]["RemovedCount"]) > 0)
            {
                return ApiResponse<bool>.Ok(true, "User removed from company");
            }

            return ApiResponse<bool>.Fail("Failed to remove user");
        }

        public async Task<ApiResponse<List<InvitationDetailDto>>> GetPendingInvitationsForCompany(int companyId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@CompanyId", companyId)
    };

            var dt = await GetDataTableAsync("sp_Company_GetPendingInvitations", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<InvitationDetailDto>>.Ok(new List<InvitationDetailDto>(), "No pending invitations");
            }

            var invitations = dt.Rows.Cast<DataRow>().Select(r => new InvitationDetailDto
            {
                InvitationId = Convert.ToInt32(r["InvitationId"]),
                Email = r["Email"]?.ToString() ?? "",
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? "",
                Status = r["Status"]?.ToString() ?? "",
                ExpiresAt = Convert.ToDateTime(r["ExpiresAt"]),
                CreatedAt = Convert.ToDateTime(r["CreatedAt"]),
                CreatedByName = r["CreatedByName"]?.ToString() ?? "System"
            }).ToList();

            return ApiResponse<List<InvitationDetailDto>>.Ok(invitations, "Success");
        }

        public async Task<ApiResponse<bool>> CancelInvitation(int invitationId, int cancelledBy)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@InvitationId", invitationId),
        SqlParameterHelper.Input("@CancelledBy", cancelledBy)
    };

            var dt = await GetDataTableAsync("sp_Company_CancelInvitation", parameters);

            return ApiResponse<bool>.Ok(true, "Invitation cancelled");
        }

        #endregion

        #region Join Requests

        public async Task<ApiResponse<JoinRequestDto>> CreateJoinRequest(int userId, int companyId, string requestedRole, string remarks = null)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId),
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@RequestedRole", requestedRole),
        SqlParameterHelper.Input("@Remarks", (object?)remarks ?? DBNull.Value)
    };

            var ds = await GetDataSetAsync("sp_Company_CreateJoinRequest", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<JoinRequestDto>.Fail("Failed to create request");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<JoinRequestDto>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<JoinRequestDto>.Ok(new JoinRequestDto
            {
                RequestId = Convert.ToInt32(row["RequestId"])
            }, row["Message"]?.ToString());
        }

        public async Task<ApiResponse<List<JoinRequestDto>>> GetPendingJoinRequests(int companyId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@CompanyId", companyId)
    };

            var dt = await GetDataTableAsync("sp_Company_GetPendingRequests", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<JoinRequestDto>>.Ok(new List<JoinRequestDto>(), "No pending requests");
            }

            var requests = dt.Rows.Cast<DataRow>().Select(r => new JoinRequestDto
            {
                RequestId = Convert.ToInt32(r["RequestId"]),
                UserId = Convert.ToInt32(r["UserId"]),
                UserName = r["UserName"]?.ToString() ?? "",
                UserEmail = r["UserEmail"]?.ToString() ?? "",
                MobileNumber = r["MobileNumber"]?.ToString() ?? "",
                RequestedRole = r["RequestedRole"]?.ToString() ?? "",
                Remarks = r["Remarks"]?.ToString(),
                RequestedAt = Convert.ToDateTime(r["RequestedAt"]),
                Status = r["Status"]?.ToString() ?? ""
            }).ToList();

            return ApiResponse<List<JoinRequestDto>>.Ok(requests, "Success");
        }

        public async Task<ApiResponse<bool>> ApproveJoinRequest(int requestId, int companyId, int reviewedBy)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@RequestId", requestId),
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@ReviewedBy", reviewedBy)
    };

            var ds = await GetDataSetAsync("sp_Company_ApproveRequest", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<bool>.Fail("Failed to approve request");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            return success ? ApiResponse<bool>.Ok(true, row["Message"]?.ToString())
                           : ApiResponse<bool>.Fail(row["Message"]?.ToString());
        }

        public async Task<ApiResponse<bool>> RejectJoinRequest(int requestId, int companyId, int reviewedBy, string reason = null)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@RequestId", requestId),
        SqlParameterHelper.Input("@CompanyId", companyId),
        SqlParameterHelper.Input("@ReviewedBy", reviewedBy),
        SqlParameterHelper.Input("@RejectionReason", (object?)reason ?? DBNull.Value)
    };

            var ds = await GetDataSetAsync("sp_Company_RejectRequest", parameters);

            return ApiResponse<bool>.Ok(true, "Request rejected");
        }

        public async Task<ApiResponse<List<CompanyInfoDto>>> GetAllCompaniesForUser(int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId)
    };

            var dt = await GetDataTableAsync("sp_Company_GetAllCompanies", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<CompanyInfoDto>>.Ok(new List<CompanyInfoDto>(), "No companies found");
            }

            var companies = dt.Rows.Cast<DataRow>().Select(r => new CompanyInfoDto
            {
                CompanyId = Convert.ToInt32(r["CompanyId"]),
                CompanyName = r["CompanyName"]?.ToString() ?? "",
                CompanyCode = r["CompanyCode"]?.ToString() ?? "",
                City = r["City"]?.ToString(),
                UserStatus = r["UserStatus"]?.ToString() ?? "Available"
            }).ToList();

            return ApiResponse<List<CompanyInfoDto>>.Ok(companies, "Success");
        }

        #endregion

        // AuthService.cs - ADD THESE METHODS

        #region My Join Requests (User's own requests)

        public async Task<ApiResponse<List<MyJoinRequestDto>>> GetMyJoinRequests(int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId)
    };

            var dt = await GetDataTableAsync("sp_User_GetMyJoinRequests", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<MyJoinRequestDto>>.Ok(new List<MyJoinRequestDto>(), "No pending requests");
            }

            var requests = dt.Rows.Cast<DataRow>().Select(r => new MyJoinRequestDto
            {
                RequestId = Convert.ToInt32(r["RequestId"]),
                CompanyId = Convert.ToInt32(r["CompanyId"]),
                CompanyName = r["CompanyName"]?.ToString() ?? "",
                RequestedRole = r["RequestedRole"]?.ToString() ?? "",
                Remarks = r["Remarks"]?.ToString(),
                RequestedAt = Convert.ToDateTime(r["RequestedAt"]),
                Status = r["Status"]?.ToString() ?? ""
            }).ToList();

            return ApiResponse<List<MyJoinRequestDto>>.Ok(requests, "Success");
        }

        public async Task<ApiResponse<bool>> CancelJoinRequest(int requestId, int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@RequestId", requestId),
        SqlParameterHelper.Input("@UserId", userId)
    };

            var ds = await GetDataSetAsync("sp_User_CancelJoinRequest", parameters);

            if (ds != null && ds.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0)
            {
                var row = ds.Tables[0].Rows[0];
                var success = Convert.ToInt32(row["Success"]) == 1;

                if (success)
                {
                    return ApiResponse<bool>.Ok(true, row["Message"]?.ToString());
                }
                return ApiResponse<bool>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<bool>.Fail("Failed to cancel request");
        }

        #endregion

        #region Get Current Company from Session

        public async Task<int> GetCurrentCompanyIdFromSession(int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId)
    };

            var dt = await GetDataTableAsync("sp_User_GetCurrentSessionCompany", parameters);

            if (dt != null && dt.Rows.Count > 0)
            {
                return Convert.ToInt32(dt.Rows[0]["SelectedCompanyId"]);
            }

            return 0;
        }
        // AuthService.cs - ADD THIS METHOD

        public async Task<ApiResponse<List<UserDto>>> SearchUsers(string searchTerm)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@SearchTerm", searchTerm)
    };

            var dt = await GetDataTableAsync("sp_Users_Search", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<UserDto>>.Ok(new List<UserDto>(), "No users found");
            }

            var users = dt.Rows.Cast<DataRow>().Select(r => new UserDto
            {
                UserId = Convert.ToInt32(r["UserId"]),
                FullName = r["FullName"]?.ToString() ?? "",
                Email = r["Email"]?.ToString() ?? "",
                MobileNumber = r["MobileNumber"]?.ToString() ?? "",
                RoleId = Convert.ToInt32(r["RoleId"]),
                RoleName = r["RoleName"]?.ToString() ?? "",
                IsActive = Convert.ToBoolean(r["IsActive"]),
                CreatedAt = Convert.ToDateTime(r["CreatedAt"])
            }).ToList();

            return ApiResponse<List<UserDto>>.Ok(users, "Success");
        }
        #endregion
    }
}