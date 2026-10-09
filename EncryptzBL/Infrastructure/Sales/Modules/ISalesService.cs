using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Sales.Modules
{
    /// <summary>
    /// Sales Order (bill) -> Despatch -> "New Installation" complaint -> warranty of the
    /// customer's installed base. Procs: 09_Sales_Order_Despatch.sql.
    /// </summary>
    public interface ISalesService
    {
        // customer master (from the bill)
        Task<List<SalesCustomerDto>> SearchCustomers(string? searchTerm, int top = 50);
        Task<ApiResponse<SalesCustomerSaveResultDto>> SaveCustomer(SalesCustomerSaveDto dto);

        // sales order
        Task<string> GetNextOrderNumber();
        Task<ApiResponse<SalesOrderSaveResultDto>> SaveOrder(SalesOrderSaveDto dto, int userId);
        Task<ApiResponse> CancelOrder(int salesOrderId, int userId);
        Task<PagedResult<SalesOrderListDto>> GetOrders(SalesOrderFilterDto filter);
        Task<ApiResponse<SalesOrderDetailDto>> GetOrder(int salesOrderId);

        // despatch
        Task<ApiResponse<DespatchCreateResultDto>> CreateDespatch(DespatchCreateDto dto, int userId);
        Task<PagedResult<DespatchListDto>> GetDespatches(DespatchFilterDto filter);
        Task<ApiResponse<DespatchDetailDto>> GetDespatch(int despatchId);

        // warranty
        Task<PagedResult<WarrantyLookupDto>> WarrantyLookup(WarrantyLookupFilterDto filter);
    }
}
