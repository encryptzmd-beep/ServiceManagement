using System.Data;
using EncryptzBL.Common;
using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Crm
{
    public sealed partial class CrmService
    {
        // ── dashboard and reports (a sales user's numbers cover own leads; the procedures enforce it) ──

        public Task<ApiResponse<CrmDashboardDto>> GetDashboard(int userId, bool isManager, int companyId)
            => Guard(async () =>
            {
                var ds = await GetDataSetAsync("crm.sp_Dashboard", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId)
                });

                var result = new CrmDashboardDto();
                if (ds.Tables.Count > 0 && ds.Tables[0].Rows.Count > 0)
                {
                    var c = ds.Tables[0].ToList<CrmDashboardCountsDto>().First();
                    result.NewLeads = c.NewLeads;
                    result.FollowUpPending = c.FollowUpPending;
                    result.TodayFollowUps = c.TodayFollowUps;
                    result.Overdue = c.Overdue;
                    result.Qualified = c.Qualified;
                    result.QuotationPending = c.QuotationPending;
                    result.ConvertedThisMonth = c.ConvertedThisMonth;
                    result.LostThisMonth = c.LostThisMonth;
                }
                if (ds.Tables.Count > 1) result.DueFollowUps = ds.Tables[1].ToList<CrmDueFollowUpDto>();
                return ApiResponse<CrmDashboardDto>.Ok(result);
            });

        public Task<ApiResponse<List<CrmFollowUpReportRowDto>>> FollowUpReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, int? ownerUserId)
            => Guard(async () =>
            {
                if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
                    return ApiResponse<List<CrmFollowUpReportRowDto>>.Fail("The From date is after the To date");

                var dt = await GetDataTableAsync("crm.sp_Report_FollowUps", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId),
                    In("@From", from?.Date), In("@To", to?.Date), In("@OwnerUserId", ownerUserId)
                });
                return ApiResponse<List<CrmFollowUpReportRowDto>>.Ok(dt.ToList<CrmFollowUpReportRowDto>());
            });

        public Task<ApiResponse<List<CrmConversionRowDto>>> ConversionReport(int userId, bool isManager, int companyId, DateTime? from, DateTime? to, string? groupBy)
            => Guard(async () =>
            {
                // the procedure returns the sets in this order
                var set = (groupBy ?? "").Trim().ToLowerInvariant() switch { "source" => 0, "owner" => 1, "month" => 2, _ => -1 };
                if (set < 0) return ApiResponse<List<CrmConversionRowDto>>.Fail("Choose source, owner or month");
                if (from.HasValue && to.HasValue && from.Value.Date > to.Value.Date)
                    return ApiResponse<List<CrmConversionRowDto>>.Fail("The From date is after the To date");

                var ds = await GetDataSetAsync("crm.sp_Report_Conversion", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId),
                    In("@From", from?.Date), In("@To", to?.Date)
                });

                var rows = ds.Tables.Count > set ? ds.Tables[set].ToList<CrmConversionRowDto>() : new List<CrmConversionRowDto>();
                // the procedure supplies the percentage; fill it only if a row came without one
                foreach (var r in rows.Where(r => r.ConversionPct == 0m && r.Converted > 0))
                    r.ConversionPct = CrmRules.Percent(r.Converted, r.Leads);
                return ApiResponse<List<CrmConversionRowDto>>.Ok(rows);
            });
    }
}
