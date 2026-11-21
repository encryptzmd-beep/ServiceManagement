using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Products.Modules
{
    public class ProductMasterService : BaseRepository, IProductMasterService
    {
        public ProductMasterService(DbHelper db) : base(db) { }


        // ── category / sub category master (21_Product_Categories.sql) ──
        public async Task<ApiResponse<List<ProductCategoryDto>>> GetCategories()
        {
            try
            {
                var dt = await GetDataTableAsync("sp_ProductCategory_List");
                return ApiResponse<List<ProductCategoryDto>>.Ok(dt != null && dt.Rows.Count > 0 ? dt.ToList<ProductCategoryDto>() : new());
            }
            catch (Microsoft.Data.SqlClient.SqlException e) when (e.Number == 2812 || e.Number == 208)
            {
                return ApiResponse<List<ProductCategoryDto>>.Fail("The category master is not set up in this company yet");
            }
        }

        public async Task<ApiResponse<int>> SaveCategory(ProductCategorySaveDto dto)
        {
            if (dto == null || string.IsNullOrWhiteSpace(dto.Name)) return ApiResponse<int>.Fail("Enter the name");
            var invalid = InputSanitizer.Validate(("Name", dto.Name));
            if (invalid != null) return ApiResponse<int>.Fail(invalid);

            var dt = await GetDataTableAsync("sp_ProductCategory_Save", new[]
            {
                SqlParameterHelper.Input("@CategoryId", dto.CategoryId),
                SqlParameterHelper.Input("@ParentId", dto.ParentId is > 0 ? dto.ParentId : null),
                SqlParameterHelper.Input("@Name", dto.Name.Trim()),
                SqlParameterHelper.Input("@IsActive", dto.IsActive)
            });
            if (dt == null || dt.Rows.Count == 0) return ApiResponse<int>.Fail("The category could not be saved");
            var row = dt.Rows[0];
            var message = row["Message"]?.ToString() ?? "";
            return Convert.ToBoolean(row["Success"])
                ? ApiResponse<int>.Ok(Convert.ToInt32(row["CategoryId"]), message)
                : ApiResponse<int>.Fail(message);
        }

        private static string? InvalidProduct(ProductMasterRequestDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.ProductCode)) return "Product code is required";
            if (string.IsNullOrWhiteSpace(dto.ProductName)) return "Product name is required";
            if (dto.MRP < 0) return "MRP cannot be negative";
            if (dto.WarrantyMonths < 0) return "Warranty months cannot be negative";
            dto.ProductCode = dto.ProductCode.Trim();
            dto.ProductName = dto.ProductName.Trim();
            return null;
        }

        public async Task<ApiResponse<ProductMaster>> CreateProduct(ProductMasterRequestDto dto)
        {
            var invalid = InvalidProduct(dto);
            if (invalid != null) return ApiResponse<ProductMaster>.Fail(invalid);

            var parameters = new[]
            {
                SqlParameterHelper.Input("@OperationType", "CREATE"),
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
            var invalid = InvalidProduct(dto);
            if (invalid != null) return ApiResponse<ProductMaster>.Fail(invalid);

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
            var parameters = new List<Microsoft.Data.SqlClient.SqlParameter>
            {
                SqlParameterHelper.Input("@OperationType", "GET"),
                SqlParameterHelper.Input("@SearchTerm", EncryptzBL.Common.Sales.SalesInputRules.LikeTerm(dto.SearchTerm)),
                SqlParameterHelper.Input("@PageNumber", dto.PageNumber),
                SqlParameterHelper.Input("@PageSize", dto.PageSize),
                SqlParameterHelper.Input("@SortColumn", dto.SortColumn ?? "ProductMasterId"),
                SqlParameterHelper.Input("@SortDirection", dto.SortDirection ?? "DESC")
            };
            // the product master lists inactive products too, so they can be activated again (script 24)
            if (dto.IncludeInactive) parameters.Add(SqlParameterHelper.Input("@IncludeInactive", true));

            System.Data.DataTable dt;
            try
            {
                dt = await GetDataTableAsync("sp_ProductMaster_Upsert", parameters.ToArray());
            }
            catch (Microsoft.Data.SqlClient.SqlException e) when (e.Number == 8144)
            {
                return ApiResponse<PaginatedResult<ProductMaster>>.Fail("This company database needs script 24 (24_QA_Product_Job_Fixes.sql).");
            }

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
    }
}

