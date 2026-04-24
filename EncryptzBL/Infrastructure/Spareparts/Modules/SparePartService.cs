


using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Spareparts.Modules;
using Microsoft.Data.SqlClient;
using System.Data;

namespace EncryptzBL.Infrastructure.Spareparts.Modules
{

    public class SparePartService : BaseRepository, ISparePartService
    {
        public SparePartService(DbHelper db) : base(db) { }


        public async Task<SparePartDashboardSummaryDto?> GetDashboardSummary()
        {
            var dt = await GetDataTableAsync("sp_SparePart_GetDashboardSummary", null);
            if (dt == null || dt.Rows.Count == 0) return null;
            return dt.ToList<SparePartDashboardSummaryDto>().FirstOrDefault();
        }

        public async Task<List<SpareRequestAdminDto>> GetAdminRequests(SpareFilterDto filter)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@Status",       string.IsNullOrEmpty(filter.Status)       ? (object)DBNull.Value : filter.Status),
        SqlParameterHelper.Input("@UrgencyLevel", string.IsNullOrEmpty(filter.UrgencyLevel) ? (object)DBNull.Value : filter.UrgencyLevel),
        SqlParameterHelper.Input("@ComplaintId",  filter.ComplaintId ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@PageNumber",   filter.PageNumber),
        SqlParameterHelper.Input("@PageSize",     filter.PageSize)
    };
            return await GetListAsync<SpareRequestAdminDto>("sp_SparePart_GetAdminRequests", p);
        }

        public async Task<List<SpareRequestByComplaintDto>> GetByComplaint(int complaintId)
        {
            var p = new[] { SqlParameterHelper.Input("@ComplaintId", complaintId) };
            return await GetListAsync<SpareRequestByComplaintDto>("sp_SparePart_GetByComplaint", p);
        }

        public async Task<ApiResponse> BulkUpdateStatus(List<int> requestIds, string status, int updatedBy)
        {
            var ids = string.Join(",", requestIds);
            var p = new[]
            {
        SqlParameterHelper.Input("@RequestIds", ids),
        SqlParameterHelper.Input("@Status",     status),
        SqlParameterHelper.Input("@ApprovedBy", updatedBy)
    };
            var dt = await GetDataTableAsync("sp_SparePart_BulkUpdateStatus", p);
            if (dt == null || dt.Rows.Count == 0) return new ApiResponse(false, "Update failed");
            var msg = dt.Rows[0]["Message"]?.ToString() ?? "Done";
            return new ApiResponse(true, msg);
        }

        public async Task<List<SparePartDto>> GetAll(
                string? searchTerm = null, int page = 1, int pageSize = 50)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@SearchTerm", string.IsNullOrWhiteSpace(searchTerm)
                    ? (object)DBNull.Value : searchTerm.Trim()),
                SqlParameterHelper.Input("@PageNumber", page),
                SqlParameterHelper.Input("@PageSize",   pageSize)
            };

            return await GetListAsync<SparePartDto>("sp_SparePart_GetAll", p);
        }

        // GET requests by technician / complaint
        public async Task<List<SparePartRequestListDto>> GetRequests(
            int? technicianId = null, int? complaintId = null)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@TechnicianId", technicianId ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ComplaintId",  complaintId  ?? (object)DBNull.Value)
            };

            return await GetListAsync<SparePartRequestListDto>("sp_SparePart_GetRequests", p);
        }

        // POST create request
        public async Task<ApiResponse<int>> CreateRequest(SparePartRequestCreateDto dto)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@ComplaintId", dto.ComplaintId),
        SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
        SqlParameterHelper.Input("@SparePartId", dto.SparePartId ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@Quantity", dto.Quantity),
        SqlParameterHelper.Input("@UrgencyLevel", dto.UrgencyLevel ?? "Normal"),
        SqlParameterHelper.Input("@Remarks", dto.Remarks ?? (object)DBNull.Value),

        // ✅ NEW
        SqlParameterHelper.Input("@CustomPartName", dto.CustomPartName ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@CustomPartNumber", dto.CustomPartNumber ?? (object)DBNull.Value)
    };

            var dt = await GetDataTableAsync("sp_SparePart_CreateRequest", p);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Request failed");

            var id = Convert.ToInt32(dt.Rows[0]["RequestId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            return id < 0
                ? ApiResponse<int>.Fail(message)
                : ApiResponse<int>.Ok(id, message);
        }

        // PATCH update request status (approve/reject/dispatch)
        public async Task<ApiResponse> UpdateRequestStatus(
            int requestId, string status, int updatedBy)
        {
            var p = new[]
            {
                SqlParameterHelper.Input("@RequestId",  requestId),
                SqlParameterHelper.Input("@Status",     status),
                SqlParameterHelper.Input("@ApprovedBy", updatedBy)
            };

            var dt = await GetDataTableAsync("sp_SparePart_UpdateRequestStatus", p);

            if (dt == null || dt.Rows.Count == 0)
                return new ApiResponse(false, "Update failed");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";
            return new ApiResponse(result == 1, message);
        }
        public async Task<ApiResponse<ProductMaster>> CreateProduct(ProductMasterRequestDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "CREATE"),
                SqlParameterHelper.Input("@ProductCode", dto.ProductCode),
                SqlParameterHelper.Input("@ProductName", dto.ProductName),
                SqlParameterHelper.Input("@Brand", dto.Brand ?? "AEROFIT"),
                SqlParameterHelper.Input("@Category", dto.Category),
                SqlParameterHelper.Input("@SubCategory", dto.SubCategory),
                SqlParameterHelper.Input("@Model", dto.Model),
                SqlParameterHelper.Input("@Description", dto.Description),
                SqlParameterHelper.Input("@MRP", dto.MRP),
                SqlParameterHelper.Input("@Org", dto.Org),
                SqlParameterHelper.Input("@PriceChangeStatus", dto.PriceChangeStatus),
                SqlParameterHelper.Input("@PriceEffectiveDate", dto.PriceEffectiveDate),
                SqlParameterHelper.Input("@WarrantyMonths", dto.WarrantyMonths ?? 12),
                SqlParameterHelper.Input("@IsActive", true)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<ProductMaster>.Fail("Create failed - no response from database");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            if (result == 0)
                return ApiResponse<ProductMaster>.Fail(message);

            var product = dt.ToList<ProductMaster>().FirstOrDefault();
            return ApiResponse<ProductMaster>.Ok(product, message);
        }

        public async Task<ApiResponse<ProductMaster>> UpdateProduct(ProductMasterRequestDto dto)
        {
            if (!dto.ProductMasterId.HasValue)
                return ApiResponse<ProductMaster>.Fail("ProductMasterId is required for update");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "UPDATE"),
                SqlParameterHelper.Input("@ProductMasterId", dto.ProductMasterId),
                SqlParameterHelper.Input("@ProductCode", dto.ProductCode),
                SqlParameterHelper.Input("@ProductName", dto.ProductName),
                SqlParameterHelper.Input("@Brand", dto.Brand),
                SqlParameterHelper.Input("@Category", dto.Category),
                SqlParameterHelper.Input("@SubCategory", dto.SubCategory),
                SqlParameterHelper.Input("@Model", dto.Model),
                SqlParameterHelper.Input("@Description", dto.Description),
                SqlParameterHelper.Input("@MRP", dto.MRP),
                SqlParameterHelper.Input("@Org", dto.Org),
                SqlParameterHelper.Input("@PriceChangeStatus", dto.PriceChangeStatus),
                SqlParameterHelper.Input("@PriceEffectiveDate", dto.PriceEffectiveDate),
                SqlParameterHelper.Input("@WarrantyMonths", dto.WarrantyMonths),
                SqlParameterHelper.Input("@IsActive", dto.IsActive)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<ProductMaster>.Fail("Update failed - no response from database");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            if (result == 0)
                return ApiResponse<ProductMaster>.Fail(message);

            var product = dt.ToList<ProductMaster>().FirstOrDefault();
            return ApiResponse<ProductMaster>.Ok(product, message);
        }

        public async Task<ApiResponse<bool>> DeleteProduct(int id, int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "DELETE"),
                SqlParameterHelper.Input("@ProductMasterId", id),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Delete failed - no response from database");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            return result == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }

        public async Task<ApiResponse<ProductMaster>> GetProductById(int id)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "GETBYID"),
                SqlParameterHelper.Input("@ProductMasterId", id)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<ProductMaster>.Fail("Product not found");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            if (result == 0)
                return ApiResponse<ProductMaster>.Fail(message);

            var product = dt.ToList<ProductMaster>().FirstOrDefault();
            return ApiResponse<ProductMaster>.Ok(product, message);
        }

        public async Task<ApiResponse<PaginatedResult<ProductMaster>>> GetAllProducts(ProductMasterRequestDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "GET"),
                SqlParameterHelper.Input("@SearchTerm", string.IsNullOrWhiteSpace(dto.SearchTerm) ? (object)DBNull.Value : dto.SearchTerm.Trim()),
                SqlParameterHelper.Input("@PageNumber", dto.PageNumber),
                SqlParameterHelper.Input("@PageSize", dto.PageSize),
                SqlParameterHelper.Input("@SortColumn", dto.SortColumn ?? "ProductMasterId"),
                SqlParameterHelper.Input("@SortDirection", dto.SortDirection ?? "DESC")
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<PaginatedResult<ProductMaster>>.Ok(
                    new PaginatedResult<ProductMaster>(),
                    "No products found");

            var products = dt.ToList<ProductMaster>();

            var totalCount = dt.Rows.Count > 0 && dt.Columns.Contains("TotalCount")
                ? Convert.ToInt32(dt.Rows[0]["TotalCount"])
                : products.Count;

            var currentPage = dt.Rows.Count > 0 && dt.Columns.Contains("CurrentPage")
                ? Convert.ToInt32(dt.Rows[0]["CurrentPage"])
                : dto.PageNumber;

            var totalPages = dt.Rows.Count > 0 && dt.Columns.Contains("TotalPages")
                ? Convert.ToInt32(dt.Rows[0]["TotalPages"])
                : 1;

            var paginatedResult = new PaginatedResult<ProductMaster>
            {
                Items = products,
                TotalCount = totalCount,
                CurrentPage = currentPage,
                TotalPages = totalPages,
                PageSize = dto.PageSize
            };

            return ApiResponse<PaginatedResult<ProductMaster>>.Ok(paginatedResult, "Success", totalCount);
        }

        public async Task<ApiResponse<DropdownDataDto>> GetDropdownData()
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "GETDROPDOWNS")
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<DropdownDataDto>.Ok(new DropdownDataDto(), "No dropdown data found");

            var dropdownData = new DropdownDataDto();

            // The stored procedure returns multiple result sets
            // For single DataTable, we need to parse differently
            // This assumes all dropdowns are in one table with Type column
            // Or we can call separate SPs for each dropdown

            // Alternative: Get each dropdown separately
            dropdownData.Categories = await GetDistinctValues("Category");
            dropdownData.SubCategories = await GetDistinctValues("SubCategory");
            dropdownData.Brands = await GetDistinctValues("Brand");
            dropdownData.Orgs = await GetDistinctValues("Org");

            return ApiResponse<DropdownDataDto>.Ok(dropdownData, "Success");
        }

        // Helper method to get distinct values
        private async Task<List<DropdownItemDto>> GetDistinctValues(string columnName)
        {
            var query = $"SELECT DISTINCT {columnName} AS Value, {columnName} AS Label FROM ProductMaster WHERE IsActive = 1 AND {columnName} IS NOT NULL AND {columnName} != '' ORDER BY {columnName}";
            var dt = await GetDataTableByQueryAsync(query);
            return dt?.ToList<DropdownItemDto>() ?? new List<DropdownItemDto>();
        }

        // Simple list method (matching your SparePartService pattern)
        public async Task<List<ProductMaster>> GetProductList(string? searchTerm = null, int page = 1, int pageSize = 50)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "GET"),
                SqlParameterHelper.Input("@SearchTerm", string.IsNullOrWhiteSpace(searchTerm) ? (object)DBNull.Value : searchTerm.Trim()),
                SqlParameterHelper.Input("@PageNumber", page),
                SqlParameterHelper.Input("@PageSize", pageSize),
                SqlParameterHelper.Input("@SortColumn", "ProductMasterId"),
                SqlParameterHelper.Input("@SortDirection", "DESC")
            };

            return await GetListAsync<ProductMaster>("sp_ProductMaster_Upsert", parameters);
        }

        // Bulk operations
        public async Task<ApiResponse<bool>> BulkDeleteProducts(List<int> productIds, int userId)
        {
            var ids = string.Join(",", productIds);
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "BULKDELETE"),
                SqlParameterHelper.Input("@ProductIds", ids),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Bulk delete failed");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            return result == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }

        public async Task<ApiResponse<bool>> BulkUpdateStatus(List<int> productIds, bool isActive, int userId)
        {
            var ids = string.Join(",", productIds);
            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "BULKUPDATE"),
                SqlParameterHelper.Input("@ProductIds", ids),
                SqlParameterHelper.Input("@IsActive", isActive),
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<bool>.Fail("Bulk update failed");

            var result = Convert.ToInt32(dt.Rows[0]["Result"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Done";

            return result == 1
                ? ApiResponse<bool>.Ok(true, message)
                : ApiResponse<bool>.Fail(message);
        }
        public async Task<ApiResponse<SparePartListResponse>> GetAllSpareParts(SparePartFilter_Model filter)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GET"),
                    SqlParameterHelper.Input("@SearchTerm", filter.SearchTerm),
                    SqlParameterHelper.Input("@IsActive", filter.IsActive),
                    SqlParameterHelper.Input("@PageNumber", filter.PageNumber),
                    SqlParameterHelper.Input("@PageSize", filter.PageSize),
                    SqlParameterHelper.Input("@SortBy", filter.SortBy),
                    SqlParameterHelper.Input("@SortOrder", filter.SortOrder)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<SparePartListResponse>.Ok(new SparePartListResponse
                    {
                        Items = new List<SparePart_Model>(),
                        TotalCount = 0,
                        CurrentPage = filter.PageNumber,
                        TotalPages = 1,
                        PageSize = filter.PageSize
                    }, "No spare parts found");
                }

                var items = dt.Rows.Cast<DataRow>().Select(row => new SparePart_Model
                {
                    SparePartId = Convert.ToInt32(row["SparePartId"]),
                    PartName = row["PartName"].ToString(),
                    PartNumber = row["PartNumber"]?.ToString(),
                    StockQuantity = Convert.ToInt32(row["StockQuantity"]),
                    UnitPrice = row["UnitPrice"] != DBNull.Value ? Convert.ToDecimal(row["UnitPrice"]) : (decimal?)null,
                    IsActive = Convert.ToBoolean(row["IsActive"]),
                    CompanyId = row["CompanyId"] != DBNull.Value ? Convert.ToInt32(row["CompanyId"]) : (int?)null
                }).ToList();

                var totalCount = dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["TotalCount"]) : 0;
                var totalPages = dt.Rows.Count > 0 ? Convert.ToInt32(dt.Rows[0]["TotalPages"]) : 1;

                var response = new SparePartListResponse
                {
                    Items = items,
                    TotalCount = totalCount,
                    CurrentPage = filter.PageNumber,
                    TotalPages = totalPages,
                    PageSize = filter.PageSize
                };

                return ApiResponse<SparePartListResponse>.Ok(response, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<SparePartListResponse>.Fail($"Error fetching spare parts: {ex.Message}");
            }
        }

        public async Task<ApiResponse<SparePart_Model>> GetSparePartById(int id)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GETBYID"),
                    SqlParameterHelper.Input("@SparePartId", id)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<SparePart_Model>.Fail("Spare part not found");
                }

                var row = dt.Rows[0];
                var sparePart = new SparePart_Model
                {
                    SparePartId = Convert.ToInt32(row["SparePartId"]),
                    PartName = row["PartName"].ToString(),
                    PartNumber = row["PartNumber"]?.ToString(),
                    StockQuantity = Convert.ToInt32(row["StockQuantity"]),
                    UnitPrice = row["UnitPrice"] != DBNull.Value ? Convert.ToDecimal(row["UnitPrice"]) : (decimal?)null,
                    IsActive = Convert.ToBoolean(row["IsActive"]),
                    CompanyId = row["CompanyId"] != DBNull.Value ? Convert.ToInt32(row["CompanyId"]) : (int?)null
                };

                return ApiResponse<SparePart_Model>.Ok(sparePart, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<SparePart_Model>.Fail($"Error fetching spare part: {ex.Message}");
            }
        }

        public async Task<ApiResponse<SparePart_Model>> CreateSparePart(SparePartRequest_Model request)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "CREATE"),
                    SqlParameterHelper.Input("@PartName", request.PartName),
                    SqlParameterHelper.Input("@PartNumber", request.PartNumber),
                    SqlParameterHelper.Input("@StockQuantity", request.StockQuantity ?? 0),
                    SqlParameterHelper.Input("@UnitPrice", request.UnitPrice),
                    SqlParameterHelper.Input("@IsActive", request.IsActive ?? true),
                    SqlParameterHelper.Input("@CompanyId", request.CompanyId)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt != null && dt.Rows.Count > 0)
                {
                    var success = Convert.ToBoolean(dt.Rows[0]["Success"]);
                    var message = dt.Rows[0]["Message"].ToString();
                    var sparePartId = dt.Rows[0]["SparePartId"] != DBNull.Value ? Convert.ToInt32(dt.Rows[0]["SparePartId"]) : 0;

                    if (success)
                    {
                        return ApiResponse<SparePart_Model>.Ok(new SparePart_Model { SparePartId = sparePartId }, message);
                    }
                    return ApiResponse<SparePart_Model>.Fail(message);
                }

                return ApiResponse<SparePart_Model>.Fail("Failed to create spare part");
            }
            catch (Exception ex)
            {
                return ApiResponse<SparePart_Model>.Fail($"Error creating spare part: {ex.Message}");
            }
        }

        public async Task<ApiResponse<SparePart_Model>> UpdateSparePart(SparePartRequest_Model request)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "UPDATE"),
                    SqlParameterHelper.Input("@SparePartId", request.SparePartId.Value),
                    SqlParameterHelper.Input("@PartName", request.PartName),
                    SqlParameterHelper.Input("@PartNumber", request.PartNumber),
                    SqlParameterHelper.Input("@StockQuantity", request.StockQuantity),
                    SqlParameterHelper.Input("@UnitPrice", request.UnitPrice),
                    SqlParameterHelper.Input("@IsActive", request.IsActive),
                    SqlParameterHelper.Input("@CompanyId", request.CompanyId)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt != null && dt.Rows.Count > 0)
                {
                    var success = Convert.ToBoolean(dt.Rows[0]["Success"]);
                    var message = dt.Rows[0]["Message"].ToString();

                    if (success)
                    {
                        return ApiResponse<SparePart_Model>.Ok(null, message);
                    }
                    return ApiResponse<SparePart_Model>.Fail(message);
                }

                return ApiResponse<SparePart_Model>.Fail("Failed to update spare part");
            }
            catch (Exception ex)
            {
                return ApiResponse<SparePart_Model>.Fail($"Error updating spare part: {ex.Message}");
            }
        }

        public async Task<ApiResponse<object>> DeleteSparePart(int id)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "DELETE"),
                    SqlParameterHelper.Input("@SparePartId", id)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt != null && dt.Rows.Count > 0)
                {
                    var success = Convert.ToBoolean(dt.Rows[0]["Success"]);
                    var message = dt.Rows[0]["Message"].ToString();

                    if (success)
                    {
                        return ApiResponse<object>.Ok(null, message);
                    }
                    return ApiResponse<object>.Fail(message);
                }

                return ApiResponse<object>.Fail("Failed to delete spare part");
            }
            catch (Exception ex)
            {
                return ApiResponse<object>.Fail($"Error deleting spare part: {ex.Message}");
            }
        }

        public async Task<ApiResponse<object>> BulkDeleteSpareParts(string ids)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "BULKDELETE"),
                    SqlParameterHelper.Input("@SearchTerm", ids)
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt != null && dt.Rows.Count > 0)
                {
                    var success = Convert.ToBoolean(dt.Rows[0]["Success"]);
                    var message = dt.Rows[0]["Message"].ToString();

                    if (success)
                    {
                        return ApiResponse<object>.Ok(null, message);
                    }
                    return ApiResponse<object>.Fail(message);
                }

                return ApiResponse<object>.Fail("Failed to delete spare parts");
            }
            catch (Exception ex)
            {
                return ApiResponse<object>.Fail($"Error deleting spare parts: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<SparePartDropdown_Model>>> GetSparePartDropdown()
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GETDROPDOWN")
                };

                var dt = await GetDataTableAsync("sp_ManageSpareParts", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<List<SparePartDropdown_Model>>.Ok(new List<SparePartDropdown_Model>(), "No spare parts found");
                }

                var items = dt.Rows.Cast<DataRow>().Select(row => new SparePartDropdown_Model
                {
                    SparePartId = Convert.ToInt32(row["SparePartId"]),
                    PartName = row["PartName"].ToString(),
                    PartNumber = row["PartNumber"]?.ToString(),
                    StockQuantity = Convert.ToInt32(row["StockQuantity"])
                }).ToList();

                return ApiResponse<List<SparePartDropdown_Model>>.Ok(items, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<List<SparePartDropdown_Model>>.Fail($"Error fetching dropdown: {ex.Message}");
            }
        }

     
    }
}




