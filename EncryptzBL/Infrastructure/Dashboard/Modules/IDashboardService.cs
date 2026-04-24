using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;



namespace EncryptzBL.Infrastructure.Dashboard.Modules
{
    public interface IDashboardService
    {
        Task<DashboardResponse> GetDashboardStats(int? roleId, int? technicianId);
        Task<DashboardChartData> GetChartData(int days = 30);
        Task<ApiResponse<ComplaintDetailResponseModel>> GetComplaintDetails(int complaintId);

        // Master management endpoint
        Task<ApiResponse<dynamic>> ManageComplaintDetails(ManageComplaintRequestModel request);

        // Dropdown helpers
        Task<ApiResponse<List<SparePartDropdownModel>>> GetSparePartsDropdown();
        Task<ApiResponse<List<TechnicianDropdownModel>>> GetTechniciansDropdown();
    }
}
