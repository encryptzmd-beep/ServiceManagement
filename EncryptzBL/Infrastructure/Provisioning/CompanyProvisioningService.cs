using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.DTO_s;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Provisioning
{
    /// <summary>
    /// A user creates a company: the company is written at once (status Provisioning)
    /// and its database is built by the background worker.
    /// </summary>
    public class CompanyProvisioningService : BaseRepository, ICompanyProvisioningService
    {
        private readonly IProvisioningQueue _queue;
        private readonly ILogger<CompanyProvisioningService> _logger;

        public CompanyProvisioningService(MainDbHelper db, IProvisioningQueue queue, ILogger<CompanyProvisioningService> logger) : base(db)
        {
            _queue = queue;
            _logger = logger;
        }

        public async Task<ApiResponse<CompanyCreatedDto>> CreateCompany(CreateCompanyRequest req, int userId, bool isPlatformAdmin)
        {
            if (userId <= 0)
                return ApiResponse<CompanyCreatedDto>.Fail("Please log in again");

            var (company, error) = CompanyCreateRules.Normalize(
                req?.CompanyName, req?.CompanyCode, req?.FirstBranchName, req?.Address, req?.City, req?.PhoneNumber);

            if (company == null)
                return ApiResponse<CompanyCreatedDto>.Fail(error ?? "Check the company details");

            var dt = await GetDataTableAsync("sp_Company_Create", new[]
            {
                SqlParameterHelper.Input("@CompanyName", company.CompanyName),
                SqlParameterHelper.Input("@CompanyCode", company.CompanyCode),
                SqlParameterHelper.Input("@Address", (object?)company.Address ?? DBNull.Value),
                SqlParameterHelper.Input("@City", (object?)company.City ?? DBNull.Value),
                SqlParameterHelper.Input("@PhoneNumber", (object?)company.PhoneNumber ?? DBNull.Value),
                SqlParameterHelper.Input("@FirstBranchName", company.FirstBranchName),
                SqlParameterHelper.Input("@CreatedBy", userId),
                SqlParameterHelper.Input("@IsPlatformAdmin", isPlatformAdmin)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<CompanyCreatedDto>.Fail("The company could not be created. Please try again.");

            var row = dt.Rows[0];
            var message = row["Message"]?.ToString() ?? "";

            if (Convert.ToInt32(row["Success"]) != 1)
            {
                // the database error is for the log only, never for the caller
                var errorNumber = dt.Columns.Contains("ErrorNumber") && row["ErrorNumber"] != DBNull.Value
                    ? Convert.ToInt32(row["ErrorNumber"]) : 0;
                if (errorNumber != 0)
                {
                    var detail = dt.Columns.Contains("ErrorDetail") && row["ErrorDetail"] != DBNull.Value
                        ? row["ErrorDetail"].ToString() : "";
                    _logger.LogWarning("Creating a company for user {UserId} failed in the database: error {ErrorNumber}: {ErrorDetail}",
                        userId, errorNumber, detail);
                }

                return ApiResponse<CompanyCreatedDto>.Fail(message);
            }

            var companyId = Convert.ToInt32(row["CompanyId"]);
            _logger.LogInformation("Company {CompanyId} created by user {UserId}; database set-up queued", companyId, userId);

            _queue.Enqueue(companyId);

            return ApiResponse<CompanyCreatedDto>.Ok(new CompanyCreatedDto { CompanyId = companyId }, message);
        }

        public async Task<ApiResponse<bool>> RetryProvision(int companyId, int userId, bool isPlatformAdmin)
        {
            if (companyId <= 0 || userId <= 0)
                return ApiResponse<bool>.Fail("Company not found");

            var dt = await GetDataTableAsync("sp_Provision_Retry", new[]
            {
                SqlParameterHelper.Input("@CompanyId", companyId),
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@IsPlatformAdmin", isPlatformAdmin)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Please try again");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "";
            if (Convert.ToInt32(dt.Rows[0]["Success"]) != 1)
                return ApiResponse<bool>.Fail(message);

            _logger.LogInformation("Database set-up of company {CompanyId} queued again by user {UserId}", companyId, userId);
            _queue.Enqueue(companyId);

            return ApiResponse<bool>.Ok(true, message);
        }

        public async Task<ApiResponse<CompanyCreationStateDto>> GetCreationState(int userId, bool isPlatformAdmin)
        {
            var dt = await GetDataTableAsync("sp_Company_GetCreationState", new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            });

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<CompanyCreationStateDto>.Ok(new CompanyCreationStateDto { Message = CompanyCreateRules.NotAvailableMessage });

            var row = dt.Rows[0];
            var created = Convert.ToInt32(row["Created"]);
            var limit = Convert.ToInt32(row["Limit"]);
            var serverAvailable = Convert.ToBoolean(row["ServerAvailable"]);
            var pendingRetry = dt.Columns.Contains("PendingRetry")
                && row["PendingRetry"] != DBNull.Value && Convert.ToBoolean(row["PendingRetry"]);

            var reason = CompanyCreateRules.CreationBlockedReason(serverAvailable, pendingRetry, created, limit, isPlatformAdmin);

            return ApiResponse<CompanyCreationStateDto>.Ok(new CompanyCreationStateDto
            {
                CanCreate = reason == null,
                Created = created,
                Limit = limit,
                Message = reason ?? ""
            });
        }
    }
}
