using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.WarrantyReturn.Modules
{
    public interface IWarrantyReturnService
    {
        Task<PagedResponse<WarrantyReturnListItem>> GetAll(WarrantyReturnFilterDto filter);
        Task<WarrantyReturnListItem> GetById(int returnId);
        Task<ApiResponse<object>> Create(WarrantyReturnCreateDto dto, int createdBy);
        Task<ApiResponse<int>> UpdateStatus(WarrantyReturnStatusDto dto, int modifiedBy);
    }
}
