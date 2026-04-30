using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Customer.Modules
{
    public interface ICustomerService
    {
        Task<ApiResponse<CustomerDto>> GetProfile(int userId);
        Task<ApiResponse> UpdateProfile(int userId, CustomerCreateDto dto);
        Task<ApiResponse<List<ProductDto>>> GetProducts(int userId);
        Task<ApiResponse<int>> AddProduct(int userId, ProductCreateDto dto);
        Task<ApiResponse<string>> UploadProductImage(int userId, int productId, string imagePath, string imageType);
        Task<ApiResponse<List<ProductMasterDto>>> GetProductMaster(string search, string category);
        Task<ApiResponse<dynamic>> CreateComplaint(int userId, ComplaintCreateDto dto);
        Task<ApiResponse<PagedResult<ComplaintListDto>>> GetMyComplaints(int userId, int? statusFilter, int page, int size);
        Task<ApiResponse> UpdateComplaint(int userId, int complaintId, ComplaintUpdateDto dto);
        Task<ApiResponse> DeleteComplaint(int userId, int complaintId);
        Task<ApiResponse> ConfirmClosure(int userId, int complaintId);
        Task<ApiResponse<ComplaintDetailDto>> GetComplaintDetail(int id, int userId);
        // Task<ApiResponse<dynamic>> ReplyToComplaint(int complaintId, int userId, string message);
        Task<ApiResponse<CustomerDto>> GetOrCreateProfile(int userId);
        Task<ApiResponse<CustomerDto>> CheckByMobile(string mobile);
        
            Task<ApiResponse<string>> UploadComplaintImage(
                int complaintId,
                string imagePath,
                string imageType,
                int userId,
                string base64,
                string fileName,
                string contentType
            );
        

        Task<ApiResponse<RegisterResponse_Dto>> Register_Customer(CustomerRegister_Dto dto);
        Task<ApiResponse<CustomerLoginResponse_Dto>> Login(CustomerLogin_Dto dto);
        Task<ApiResponse<List<ExistingUserCompanyDto>>> GetExistingUserCompanies(int userId);

        Task<ApiResponse<bool>> InsertCustomerForExistingUser(InsertCustomerForExistingUserDto dto);
        // Profile
        Task<ApiResponse<Customer_DTO>> GetProfile_Customer(int userId);
        Task<ApiResponse<Customer_DTO>> UpdateProfile(int userId, CustomerProfileUpdate_Dto dto);

        // Dashboard
        Task<ApiResponse<DashboardResponse_Dto>> GetDashboardStats(int customerId);
        Task<ApiResponse<List<CustomerMenu_Dto>>> GetMenus(int customerId);

        // Products
        Task<ApiResponse<List<Product_Dto>>> GetProducts_Customer(int userId);
        Task<ApiResponse<int>> AddProduct(int userId, ProductCreate_Dto dto);
        Task<ApiResponse<dynamic>> CreateQuickComplaint(int userId, QuickComplaintRequest_Dto request);
    }
}
