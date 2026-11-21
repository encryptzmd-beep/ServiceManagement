using System.Data;
using System.Text.Json;
using EncryptzBL.Common;
using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Crm
{
    /// <summary>Lead Excel import and export: a company admin freely, anyone else with one approval per file.</summary>
    public sealed partial class CrmService
    {
        public const int MaxImportRows = 1000;
        private const string AdminOnly = "Only a company admin can do this";
        private const string NeedsApproval = "This needs approval from your admin";

        private static string? DataType(string? kind)
        {
            var k = kind?.Trim().ToLowerInvariant();
            return k == "import" ? "Import" : k == "export" ? "Export" : null;
        }

        public Task<ApiResponse<LeadDataAccessDto>> GetLeadDataAccess(int userId, bool isManager, int companyId, bool isAdmin)
            => Guard(async () =>
            {
                var access = (await GetDataTableAsync("crm.sp_LeadData_Access", new[] { In("@CompanyId", companyId), In("@UserId", userId) }))
                    .ToList<LeadDataAccessDto>().FirstOrDefault() ?? new LeadDataAccessDto();
                access.IsAdmin = isAdmin;
                access.CanExport = isAdmin || access.ExportApproved;
                access.CanImport = isAdmin || access.ImportApproved;
                if (!isAdmin) access.PendingCount = 0;   // the queue is the admin's
                return ApiResponse<LeadDataAccessDto>.Ok(access);
            });

        public Task<ApiResponse<int>> RequestLeadData(int userId, bool isManager, int companyId, LeadDataRequestDto dto)
            => Guard(async () =>
            {
                var type = DataType(dto?.RequestType);
                if (type == null) return ApiResponse<int>.Fail("Choose import or export");
                var note = (dto!.Note ?? "").Trim();
                if (note.Length > 500) return ApiResponse<int>.Fail("The note is too long");
                var invalid = InputSanitizer.Validate(("Note", note));
                if (invalid != null) return ApiResponse<int>.Fail(invalid);

                return ToResponse(Answer(await GetDataTableAsync("crm.sp_LeadData_RequestAdd", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@RequestType", type), In("@Note", note)
                })));
            });

        public Task<ApiResponse<List<LeadDataRequestRowDto>>> GetLeadDataRequests(int userId, bool isManager, int companyId, bool isAdmin)
            => Guard(async () =>
            {
                if (!isAdmin) return ApiResponse<List<LeadDataRequestRowDto>>.Fail(AdminOnly);
                var rows = (await GetDataTableAsync("crm.sp_LeadData_RequestList", new[] { In("@CompanyId", companyId) })).ToList<LeadDataRequestRowDto>();
                return ApiResponse<List<LeadDataRequestRowDto>>.Ok(rows);
            });

        public Task<ApiResponse<int>> DecideLeadData(int userId, bool isManager, int companyId, bool isAdmin, int requestId, LeadDataDecisionDto dto)
            => Guard(async () =>
            {
                if (!isAdmin) return ApiResponse<int>.Fail(AdminOnly);
                var note = (dto?.Note ?? "").Trim();
                if (note.Length > 500) return ApiResponse<int>.Fail("The note is too long");
                var invalid = InputSanitizer.Validate(("Note", note));
                if (invalid != null) return ApiResponse<int>.Fail(invalid);

                return ToResponse(Answer(await GetDataTableAsync("crm.sp_LeadData_Decide", new[]
                {
                    In("@CompanyId", companyId), In("@RequestId", requestId), In("@AdminId", userId),
                    In("@Approve", dto?.Approve == true), In("@DecisionNote", note)
                })));
            });

        private async Task<bool> SpendApproval(int userId, int companyId, bool isAdmin, string type)
            => isAdmin || Answer(await GetDataTableAsync("crm.sp_LeadData_Use", new[]
            {
                In("@CompanyId", companyId), In("@UserId", userId), In("@RequestType", type)
            })).Success;

        /// <summary>The leads this person may see anyway (own leads, or all for a manager).</summary>
        public Task<ApiResponse<List<LeadExportRowDto>>> ExportLeads(int userId, bool isManager, int companyId, bool isAdmin)
            => Guard(async () =>
            {
                if (!await SpendApproval(userId, companyId, isAdmin, "Export"))
                    return ApiResponse<List<LeadExportRowDto>>.Fail(NeedsApproval);

                var rows = (await GetDataTableAsync("crm.sp_Lead_Export", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId)
                })).ToList<LeadExportRowDto>();
                return ApiResponse<List<LeadExportRowDto>>.Ok(rows);
            });

        /// <summary>Each row is saved as a new lead of this person, through the same rules as the lead form.</summary>
        public Task<ApiResponse<LeadImportResultDto>> ImportLeads(int userId, bool isManager, int companyId, bool isAdmin, List<LeadImportRowDto> rows)
            => Guard(async () =>
            {
                if (rows == null || rows.Count == 0) return ApiResponse<LeadImportResultDto>.Fail("The file has no leads");
                if (rows.Count > MaxImportRows) return ApiResponse<LeadImportResultDto>.Fail($"Import at most {MaxImportRows} leads at a time");
                if (!await SpendApproval(userId, companyId, isAdmin, "Import"))
                    return ApiResponse<LeadImportResultDto>.Fail(NeedsApproval);

                var mobiles = rows.Select(r => CrmRules.NormaliseMobile(r.Mobile)).Where(m => m.Length > 0).Distinct().ToList();
                var known = (await GetDataTableAsync("crm.sp_Lead_ExistingMobiles", new[]
                {
                    In("@CompanyId", companyId), In("@LocationId", LocationId), In("@Mobiles", JsonSerializer.Serialize(mobiles))
                })).AsEnumerable().Select(r => r["Mobile"]?.ToString() ?? "").ToHashSet();

                var result = new LeadImportResultDto();
                var today = DateTime.UtcNow.AddMinutes(330).Date;
                foreach (var row in rows)
                {
                    var mobile = CrmRules.NormaliseMobile(row.Mobile);
                    if (known.Contains(mobile))
                    {
                        result.Skipped++;
                        result.Problems.Add(new LeadImportProblemDto { RowNumber = row.RowNumber, ContactName = row.ContactName ?? "", Message = "This mobile is already a lead" });
                        continue;
                    }

                    var priority = (row.Priority ?? "").Trim();
                    var saved = await SaveLead(userId, isManager, companyId, new LeadSaveDto
                    {
                        LeadDate = today, ContactName = row.ContactName ?? "", Mobile = row.Mobile ?? "", Email = row.Email,
                        Address = row.Address, City = row.City, State = row.State, PinCode = row.PinCode, Landmark = row.Landmark,
                        ProductCategory = row.ProductCategory, ModelRequirement = row.ModelRequirement,
                        Priority = priority.Length == 0 ? "Medium" : priority, Remarks = row.Remarks
                    });

                    if (saved.Success)
                    {
                        result.Created++;
                        known.Add(mobile);   // the same mobile twice in one file
                    }
                    else
                    {
                        result.Failed++;
                        result.Problems.Add(new LeadImportProblemDto { RowNumber = row.RowNumber, ContactName = row.ContactName ?? "", Message = saved.Message ?? "Could not be saved" });
                    }
                }
                return ApiResponse<LeadImportResultDto>.Ok(result, $"{result.Created} leads imported");
            });
    }
}
