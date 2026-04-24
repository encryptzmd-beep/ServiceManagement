using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Products.Modules
{
    public interface IProductMasterService
    {
        Task<ApiResponse<ProductMaster>> CreateProduct(ProductMasterRequestDto dto);
        Task<ApiResponse<ProductMaster>> UpdateProduct(ProductMasterRequestDto dto);
        Task<ApiResponse<bool>> DeleteProduct(int id, int userId);
        Task<ApiResponse<ProductMaster>> GetProductById(int id);
        Task<ApiResponse<PaginatedResult<ProductMaster>>> GetAllProducts(ProductMasterRequestDto dto);
        Task<ApiResponse<DropdownDataDto>> GetDropdownData();
        Task<List<ProductMaster>> GetProductList(string? searchTerm = null, int page = 1, int pageSize = 50);
        Task<ApiResponse<bool>> BulkDeleteProducts(List<int> productIds, int userId);
        Task<ApiResponse<bool>> BulkUpdateStatus(List<int> productIds, bool isActive, int userId);
    }
}
