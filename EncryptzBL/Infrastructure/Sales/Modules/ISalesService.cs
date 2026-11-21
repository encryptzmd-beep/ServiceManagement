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
        Task<List<TransporterDto>> GetTransporters(bool includeInactive);
        Task<ApiResponse<int>> SaveTransporter(TransporterDto dto);

        // sales order
        Task<string> GetNextOrderNumber();
        Task<ApiResponse<SalesOrderSaveResultDto>> SaveOrder(SalesOrderSaveDto dto, int userId);
        Task<ApiResponse> CancelOrder(int salesOrderId, int userId);
        /// <summary>Previous / next sales order (0 = from a new one).</summary>
        Task<ApiResponse<NeighboursDto>> GetOrderNeighbours(int salesOrderId);
        Task<PagedResult<SalesOrderListDto>> GetOrders(SalesOrderFilterDto filter);
        Task<ApiResponse<SalesOrderDetailDto>> GetOrder(int salesOrderId);

        // despatch
        Task<ApiResponse<DespatchCreateResultDto>> CreateDespatch(DespatchCreateDto dto, int userId);
        Task<PagedResult<DespatchListDto>> GetDespatches(DespatchFilterDto filter);
        Task<ApiResponse<DespatchDetailDto>> GetDespatch(int despatchId);

        // spare and repaired parts in the same Despatch screen (script 25)
        Task<ApiResponse<PagedResult<ServiceDespatchListDto>>> GetServiceDespatches(ServiceDespatchFilterDto filter);
        Task<ApiResponse<ServiceDespatchResultDto>> CreateServiceDespatch(ServiceDespatchCreateDto dto, int userId);
        /// <summary>The missing mode and reference of an older despatch; what is recorded is never changed.</summary>
        Task<ApiResponse> AddServiceDespatchDetails(ServiceDespatchCreateDto dto, int userId);
        Task<ApiResponse> AddDespatchDetails(int despatchId, DespatchDetailsDto dto, int userId);

        // documents of a bill (PDF), shared by the Sales Order and Despatch screens
        Task<ApiResponse<List<SalesDocumentDto>>> GetDocuments(int salesOrderId);
        Task<ApiResponse<int>> SaveDocument(int salesOrderId, int? despatchId, string? documentType, string? fileName, byte[] content, int userId);
        Task<ApiResponse<SalesDocumentFile>> GetDocumentFile(int documentId);
        Task<ApiResponse> DeleteDocument(int documentId, int userId);

        // warranty
        Task<PagedResult<WarrantyLookupDto>> WarrantyLookup(WarrantyLookupFilterDto filter);
    }
}
