using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;

namespace EncryptzBL.Infrastructure.Report.Modules
{
    public class ReportService : BaseRepository, IReportService
    {
        public ReportService(DbHelper db) : base(db) { }

        // 🔥 COMPLAINT SUMMARY REPORT
        public async Task<List<ComplaintSummaryReport>> GetComplaintSummary(ReportFilterDto filter)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@StartDate", filter.StartDate),
                SqlParameterHelper.Input("@EndDate", filter.EndDate),
                SqlParameterHelper.Input("@StatusId", filter.StatusId),
                SqlParameterHelper.Input("@PriorityId", filter.PriorityId)
            };

            var dt = await GetDataTableAsync("sp_Report_ComplaintSummary", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<ComplaintSummaryReport>()
                : new List<ComplaintSummaryReport>();
        }

        // 🔥 TECHNICIAN PERFORMANCE REPORT
        public async Task<List<TechPerformanceReport>> GetTechnicianPerformance(ReportFilterDto filter)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@StartDate", filter.StartDate),
                SqlParameterHelper.Input("@EndDate", filter.EndDate),
                SqlParameterHelper.Input("@TechnicianId", filter.TechnicianId)
            };

            var dt = await GetDataTableAsync("sp_Report_TechnicianPerformance", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<TechPerformanceReport>()
                : new List<TechPerformanceReport>();
        }
        public async Task<List<SlaComplianceDto>> GetSlaCompliance(DateTime startDate, DateTime endDate)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@StartDate", startDate),
        SqlParameterHelper.Input("@EndDate",   endDate)
    };

            var dt = await GetDataTableAsync("sp_Report_SlaCompliance", parameters);
            return dt.Rows.Count > 0
                ? dt.ToList<SlaComplianceDto>()
                : new List<SlaComplianceDto>();
        }

        // Service
        public async Task<List<TechProductivityDto>> GetProductivityReport(
      DateTime startDate,
      DateTime endDate)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@StartDate", startDate),
        SqlParameterHelper.Input("@EndDate", endDate)
    };

            var dt = await GetDataTableAsync("sp_Report_TechnicianProductivity", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return new List<TechProductivityDto>();

            return dt.Rows.Cast<DataRow>().Select(x => new TechProductivityDto
            {
                TechnicianId = Convert.ToInt32(x["TechnicianId"]),
                TechnicianName = x["TechnicianName"]?.ToString() ?? "",
                Specialization = x["Specialization"]?.ToString() ?? "",
                TotalAssignments = Convert.ToInt32(x["TotalAssignments"]),
                CompletedAssignments = Convert.ToInt32(x["CompletedAssignments"]),
                PendingAssignments = Convert.ToInt32(x["PendingAssignments"]),
                CompletionRate = Convert.ToDecimal(x["CompletionRate"]),
                TotalWorkHours = Convert.ToDecimal(x["TotalWorkHours"]),
                AvgResolutionHours = Convert.ToDecimal(x["AvgResolutionHours"]),
                TotalDistanceKm = Convert.ToDecimal(x["TotalDistanceKm"]),
                SparePartsUsed = Convert.ToInt32(x["SparePartsUsed"]),
                CustomerRating = Convert.ToDecimal(x["CustomerRating"])
            }).ToList();
        }



    }
}
