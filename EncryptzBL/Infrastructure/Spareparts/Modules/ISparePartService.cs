using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Spareparts.Modules
{
    public interface ISparePartService
    {
       
        Task<List<SparePartDto>> GetAll(string? searchTerm = null, int page = 1, int pageSize = 50);
        Task<List<SparePartRequestListDto>> GetRequests(int? technicianId = null, int? complaintId = null);
        Task<ApiResponse<int>> CreateRequest(SparePartRequestCreateDto dto);
        Task<SpareStatusResult> UpdateRequestStatus(int requestId, string status, int updatedBy,
            string? rejectReason = null, decimal? unitPrice = null, bool allowNoStock = false);
        /// <summary>Technician the request belongs to; null when it does not exist.</summary>
        Task<int?> GetRequestTechnicianId(int requestId);
        Task<SparePartDashboardSummaryDto?> GetDashboardSummary();
        Task<List<SpareRequestAdminDto>> GetAdminRequests(SpareFilterDto filter);
        Task<List<SpareRequestByComplaintDto>> GetByComplaint(int complaintId);
        Task<ApiResponse> BulkUpdateStatus(List<int> requestIds, string status, int updatedBy, string? rejectReason = null);
        Task<ApiResponse<ProductMaster>> CreateProduct(ProductMasterRequestDto dto);
        Task<ApiResponse<ProductMaster>> UpdateProduct(ProductMasterRequestDto dto);
        Task<ApiResponse<bool>> DeleteProduct(int id, int userId);
        Task<ApiResponse<ProductMaster>> GetProductById(int id);
        Task<ApiResponse<PaginatedResult<ProductMaster>>> GetAllProducts(ProductMasterRequestDto dto);
        Task<ApiResponse<DropdownDataDto>> GetDropdownData();
        Task<List<ProductMaster>> GetProductList(string? searchTerm = null, int page = 1, int pageSize = 50);
        Task<ApiResponse<bool>> BulkDeleteProducts(List<int> productIds, int userId);
        Task<ApiResponse<bool>> BulkUpdateStatus(List<int> productIds, bool isActive, int userId);
        Task<ApiResponse<SparePartListResponse>> GetAllSpareParts(SparePartFilter_Model filter);
        Task<ApiResponse<SparePart_Model>> GetSparePartById(int id);
        Task<ApiResponse<SparePart_Model>> CreateSparePart(SparePartRequest_Model request);
        Task<ApiResponse<SparePart_Model>> UpdateSparePart(SparePartRequest_Model request);
        Task<ApiResponse<object>> DeleteSparePart(int id);
        Task<ApiResponse<object>> BulkDeleteSpareParts(string ids);
        Task<ApiResponse<List<SparePartDropdown_Model>>> GetSparePartDropdown();
    }
}
