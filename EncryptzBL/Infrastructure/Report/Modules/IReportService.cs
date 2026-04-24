using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Report.Modules
{
    public interface IReportService
    {
        Task<List<ComplaintSummaryReport>> GetComplaintSummary(ReportFilterDto filter);
        Task<List<TechPerformanceReport>> GetTechnicianPerformance(ReportFilterDto filter);
        Task<List<SlaComplianceDto>> GetSlaCompliance(DateTime startDate, DateTime endDate);
        // Service Interface
        Task<List<TechProductivityDto>> GetProductivityReport(DateTime startDate, DateTime endDate);
    }
}
