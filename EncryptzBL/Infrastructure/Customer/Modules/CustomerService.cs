using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using System;
using System.Collections.Generic;
using System.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;


namespace EncryptzBL.Infrastructure.Customer.Modules
{
    public class CustomerService : BaseRepository, ICustomerService
    {
        private readonly IConfiguration _configuration;

        public CustomerService(DbHelper db, IConfiguration configuration) : base(db)
        {
            _configuration = configuration;
        }
        public async Task<ApiResponse<Customer_DTO>> GetProfile_Customer(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_Customer_GetProfile", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<Customer_DTO>.Fail("Customer not found");

            var data = dt.ToList<Customer_DTO>().FirstOrDefault();

            return ApiResponse<Customer_DTO>.Ok(data, "Success");
        }
        public async Task<ApiResponse<DashboardResponse_Dto>> GetDashboardStats(int customerId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var ds = await GetDataSetAsync("sp_Customer_GetDashboardStats", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<DashboardResponse_Dto>.Fail("No data found");

            var stats = ds.Tables[0].ToList<DashboardStats_Dto>().FirstOrDefault();

            var recentComplaints = new List<RecentComplaint_Dto>();
            if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
            {
                recentComplaints = ds.Tables[1].ToList<RecentComplaint_Dto>();
            }

            var response = new DashboardResponse_Dto
            {
                Stats = stats,
                RecentComplaints = recentComplaints ?? new List<RecentComplaint_Dto>()
            };

            return ApiResponse<DashboardResponse_Dto>.Ok(response, "Success");
        }

        public async Task<ApiResponse<List<CustomerMenu_Dto>>> GetMenus(int customerId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var dt = await GetDataTableAsync("sp_Customer_GetMenu", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<CustomerMenu_Dto>>.Ok(new List<CustomerMenu_Dto>(), "No menus found");

            var menus = dt.ToList<CustomerMenu_Dto>();

            return ApiResponse<List<CustomerMenu_Dto>>.Ok(menus, "Success", menus.Count);
        }

        // ============================================
        // PRODUCTS
        // ============================================

        public async Task<ApiResponse<List<Product_Dto>>> GetProducts_Customer(int userId)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<List<Product_Dto>>.Fail("Customer not found");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var dt = await GetDataTableAsync("sp_Customer_GetProducts", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<List<Product_Dto>>.Ok(new List<Product_Dto>(), "No products found");

            var products = dt.ToList<Product_Dto>();

            return ApiResponse<List<Product_Dto>>.Ok(products, "Success", products.Count);
        }

        public async Task<ApiResponse<int>> AddProduct(int userId, ProductCreate_Dto dto)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<int>.Fail("Customer not found");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId),
                SqlParameterHelper.Input("@ProductName", dto.ProductName),
                SqlParameterHelper.Input("@SerialNumber", dto.SerialNumber),
                SqlParameterHelper.Input("@Brand", dto.Brand),
                SqlParameterHelper.Input("@Model", dto.Model),
                SqlParameterHelper.Input("@PurchaseDate", dto.PurchaseDate),
                SqlParameterHelper.Input("@WarrantyExpiryDate", dto.WarrantyExpiryDate),
                SqlParameterHelper.Input("@ProductMasterId", dto.ProductMasterId)
            };

            var dt = await GetDataTableAsync("sp_Product_Create", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Failed to add product");

            var productId = Convert.ToInt32(dt.Rows[0]["ProductId"]);
            var message = dt.Rows[0]["Message"]?.ToString();

            if (productId == -1)
                return ApiResponse<int>.Fail(message ?? "Failed to add product");

            return ApiResponse<int>.Ok(productId, message ?? "Product added successfully");
        }

        public async Task<ApiResponse<Customer_DTO>> UpdateProfile(int userId, CustomerProfileUpdate_Dto dto)
        {
            try
            {
                var parameters = new[]
                {
            SqlParameterHelper.Input("@UserId", userId),
            SqlParameterHelper.Input("@FullName", dto.FullName),
            SqlParameterHelper.Input("@Email", dto.Email),
            SqlParameterHelper.Input("@Address", dto.Address),
            SqlParameterHelper.Input("@City", dto.City),
            SqlParameterHelper.Input("@State", dto.State),
            SqlParameterHelper.Input("@PinCode", dto.PinCode),
            SqlParameterHelper.Input("@Latitude", dto.Latitude),
            SqlParameterHelper.Input("@Longitude", dto.Longitude)
        };

                var dt = await GetDataTableAsync("sp_Customer_UpdateProfile", parameters);

                if (dt != null && dt.Rows.Count > 0)
                {
                    var success = Convert.ToBoolean(dt.Rows[0]["Success"]);
                    var message = dt.Rows[0]["Message"].ToString();

                    if (success)
                    {
                        var updatedProfile = dt.ToList<Customer_DTO>().FirstOrDefault();
                        return ApiResponse<Customer_DTO>.Ok(updatedProfile, message);
                    }
                    else
                    {
                        return ApiResponse<Customer_DTO>.Fail(message);
                    }
                }

                return ApiResponse<Customer_DTO>.Fail("Failed to update profile");
            }
            catch (Exception ex)
            {
                return ApiResponse<Customer_DTO>.Fail($"Error updating profile: {ex.Message}");
            }
        }
        public async Task<ApiResponse<CustomerLoginResponse_Dto>> Login(CustomerLogin_Dto dto)
        {
            // Validate input
            if (string.IsNullOrEmpty(dto.Email) || string.IsNullOrEmpty(dto.Password))
                return ApiResponse<CustomerLoginResponse_Dto>.Fail("Email and password are required");

            // Get customer by email only (no password in SP)
            var parameters = new[]
            {
        SqlParameterHelper.Input("@Email", dto.Email)
    };

            var ds = await GetDataSetAsync("sp_Customer_Login", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<CustomerLoginResponse_Dto>.Fail("Invalid email or password");

            var customer = ds.Tables[0].ToList<Customer_DTO>().FirstOrDefault();

            // Verify password in C# with BCrypt
            if (customer == null || !BCrypt.Net.BCrypt.Verify(dto.Password, customer.PasswordHash))
                return ApiResponse<CustomerLoginResponse_Dto>.Fail("Invalid email or password");

            // Remove PasswordHash before sending to client
            customer.PasswordHash = null;

            // Get menus
            var menus = new List<CustomerMenu_Dto>();
            if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
                menus = ds.Tables[1].ToList<CustomerMenu_Dto>();

            var token = GenerateJwtToken(customer);

            var response = new CustomerLoginResponse_Dto
            {
                Success = true,
                Message = "Login successful",
                Customer = customer,
                Menus = menus,
                Token = token
            };

            return ApiResponse<CustomerLoginResponse_Dto>.Ok(response, "Login successful");
        }

        public async Task<ApiResponse<RegisterResponse_Dto>> Register_Customer(CustomerRegister_Dto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@FullName", dto.FullName),
                SqlParameterHelper.Input("@Email", dto.Email),
                SqlParameterHelper.Input("@MobileNumber", dto.MobileNumber),
                SqlParameterHelper.Input("@PasswordHash",BCrypt.Net.BCrypt.HashPassword(dto.PasswordHash)),
                SqlParameterHelper.Input("@Address", dto.Address),
                SqlParameterHelper.Input("@City", dto.City),
                SqlParameterHelper.Input("@State", dto.State),
                SqlParameterHelper.Input("@PinCode", dto.PinCode),
                SqlParameterHelper.Input("@CompanyId", dto.CompanyId)
            };

            var dt = await GetDataTableAsync("sp_Customer_Register", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<RegisterResponse_Dto>.Fail("Registration failed");

            var result = dt.ToList<RegisterResponse_Dto>().FirstOrDefault();

            if (result != null && result.Success)
                return ApiResponse<RegisterResponse_Dto>.Ok(result, result.Message);

            return ApiResponse<RegisterResponse_Dto>.Fail(result?.Message ?? "Registration failed");
        }
        private string GenerateJwtToken(Customer_DTO customer)
        {
            var tokenHandler = new JwtSecurityTokenHandler();
            var key = Encoding.ASCII.GetBytes(_configuration["Jwt:Key"] ?? "your-secret-key-here-min-32-characters-long");
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(new[]
                {
                    new Claim(ClaimTypes.NameIdentifier, customer.UserId.ToString()),
                    new Claim(ClaimTypes.Email, customer.Email),
                    new Claim(ClaimTypes.Role, "Customer"),
                    new Claim("CustomerId", customer.CustomerId.ToString())
                }),
                Expires = DateTime.UtcNow.AddDays(7),
                SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(key), SecurityAlgorithms.HmacSha256Signature)
            };
            var token = tokenHandler.CreateToken(tokenDescriptor);
            return tokenHandler.WriteToken(token);
        }


        // 🔹 Reusable: Get CustomerId from UserId
        private async Task<int?> GetCustomerId(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_GetCustomerIdByUserId", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return null;

            return Convert.ToInt32(dt.Rows[0]["CustomerId"]);
        }

        // 🔥 GET PROFILE (Aligned with new ApiResponse<T>)
        public async Task<ApiResponse<CustomerDto>> GetProfile(int userId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId)
            };

            var dt = await GetDataTableAsync("sp_Customer_GetProfile", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<CustomerDto>.Fail("Customer not found");

            var data = dt.ToList<CustomerDto>().FirstOrDefault();

            return ApiResponse<CustomerDto>.Ok(data, "Success");
        }

        // 🔥 UPDATE PROFILE
        public async Task<ApiResponse> UpdateProfile(int userId, CustomerCreateDto dto)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@UserId", userId),
                SqlParameterHelper.Input("@CustomerName", dto.CustomerName),
                SqlParameterHelper.Input("@Address", dto.Address),
                SqlParameterHelper.Input("@City", dto.City),
                SqlParameterHelper.Input("@State", dto.State),
                SqlParameterHelper.Input("@PinCode", dto.PinCode),
                SqlParameterHelper.Input("@AlternatePhone", dto.AlternatePhone)
            };

            var rows = await ExecuteAsync("sp_Customer_UpdateProfile", parameters);

            return rows > 0
                ? new ApiResponse(true, "Profile updated")
                : new ApiResponse(false, "Customer not found");
        }

        // 🔥 GET PRODUCTS (Safe + Enterprise)
        public async Task<ApiResponse<List<ProductDto>>> GetProducts(int userId)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<List<ProductDto>>.Fail("Customer not found");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@CustomerId", customerId)
            };

            var ds = await GetDataSetAsync("sp_Product_GetByCustomer", parameters);

            if (ds == null || ds.Tables.Count == 0)
                return ApiResponse<List<ProductDto>>.Ok(new List<ProductDto>(), "No products found");

            var products = ds.Tables[0].Rows.Count > 0
                ? ds.Tables[0].ToList<ProductDto>()
                : new List<ProductDto>();

            // Map Images (if exists)
            if (ds.Tables.Count > 1 && ds.Tables[1].Rows.Count > 0)
            {
                var images = ds.Tables[1].ToList<ProductImageDto>();

                foreach (var product in products)
                {
                    product.Images = images
                        .Where(i => i.ProductId == product.ProductId)
                        .ToList();
                }
            }

            return ApiResponse<List<ProductDto>>.Ok(products, "Success", products.Count);
        }

        // 🔥 ADD PRODUCT (Output Param Safe)
        public async Task<ApiResponse<int>> AddProduct(int userId, ProductCreateDto dto)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<int>.Fail("Customer not found");

            var outputId = SqlParameterHelper.Output("@NewProductId", SqlDbType.Int);

            var parameters = new[]
            {
        SqlParameterHelper.Input("@CustomerId", customerId),
        SqlParameterHelper.Input("@ProductName", dto.ProductName),
        SqlParameterHelper.Input("@SerialNumber", dto.SerialNumber),
        SqlParameterHelper.Input("@Brand", dto.Brand),
        SqlParameterHelper.Input("@Model", dto.Model),
        SqlParameterHelper.Input("@PurchaseDate", dto.PurchaseDate),
        SqlParameterHelper.Input("@WarrantyExpiryDate", dto.WarrantyExpiryDate),
        outputId
    };

            var dt = await GetDataTableAsync("sp_Product_Create", parameters);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Failed to register product");

            var productId = Convert.ToInt32(dt.Rows[0]["ProductId"]);
            var message = dt.Rows[0]["Message"].ToString();

            if (productId == -1)
                return ApiResponse<int>.Fail(message);

            return ApiResponse<int>.Ok(productId, message);
        }

        // 🔥 UPLOAD PRODUCT IMAGE (SECURE VERSION)
        public async Task<ApiResponse<string>> UploadProductImage(int userId, int productId, string imagePath, string imageType)
        {
            // Validate ownership (VERY IMPORTANT SECURITY)
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<string>.Fail("Customer not found");

            var parameters = new[]
            {
                SqlParameterHelper.Input("@ProductId", productId),
                SqlParameterHelper.Input("@ImageType", imageType),
                SqlParameterHelper.Input("@ImagePath", imagePath),
                SqlParameterHelper.Input("@CustomerId", customerId) // enforce ownership in SP
            };

            var rows = await ExecuteAsync("sp_ProductImage_Create", parameters);

            return rows > 0
                ? ApiResponse<string>.Ok(imagePath, "Image uploaded")
                : ApiResponse<string>.Fail("Upload failed or unauthorized product");
        }


        public async Task<ApiResponse<List<ProductMasterDto>>> GetProductMaster(string searchTerm = null, string category = null)
        {
            var p = new[]
            {
        SqlParameterHelper.Input("@SearchTerm", string.IsNullOrEmpty(searchTerm) ? (object)DBNull.Value : searchTerm),
        SqlParameterHelper.Input("@Category", string.IsNullOrEmpty(category) ? (object)DBNull.Value : category)
    };

            var data = await GetListAsync<ProductMasterDto>("sp_ProductMaster_GetAll", p);

            return ApiResponse<List<ProductMasterDto>>.Ok(data, "Success", data.Count);
        }
        public async Task<ApiResponse<List<ExistingUserCompanyDto>>> GetExistingUserCompanies(int userId)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", userId)
    };

            var dt = await GetDataTableAsync("sp_GetExistingUserCompanies", parameters);

            if (dt == null || dt.Rows.Count == 0)
            {
                return ApiResponse<List<ExistingUserCompanyDto>>
                    .Ok(new List<ExistingUserCompanyDto>(), "No companies found");
            }

            var companies = dt.Rows.Cast<DataRow>().Select(r => new ExistingUserCompanyDto
            {
                CompanyUserId = Convert.ToInt32(r["CompanyUserId"]),
                CompanyId = Convert.ToInt32(r["CompanyId"]),
                CompanyName = r["CompanyName"]?.ToString() ?? "",
                RoleInCompany = r["RoleInCompany"]?.ToString() ?? ""
            }).ToList();

            return ApiResponse<List<ExistingUserCompanyDto>>
                .Ok(companies, "Success");
        }

        public async Task<ApiResponse<bool>> InsertCustomerForExistingUser(InsertCustomerForExistingUserDto dto)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@UserId", dto.UserId),
        SqlParameterHelper.Input("@CompanyId", (object?)dto.CompanyId ?? DBNull.Value),
        SqlParameterHelper.Input("@Address", (object?)dto.Address ?? DBNull.Value),
        SqlParameterHelper.Input("@City", (object?)dto.City ?? DBNull.Value),
        SqlParameterHelper.Input("@State", (object?)dto.State ?? DBNull.Value),
        SqlParameterHelper.Input("@PinCode", (object?)dto.PinCode ?? DBNull.Value)
    };

            var ds = await GetDataSetAsync("sp_InsertCustomerForExistingUser", parameters);

            if (ds == null || ds.Tables.Count == 0 || ds.Tables[0].Rows.Count == 0)
            {
                return ApiResponse<bool>.Fail("Unable to create customer");
            }

            var row = ds.Tables[0].Rows[0];
            var success = Convert.ToInt32(row["Success"]) == 1;

            if (!success)
            {
                return ApiResponse<bool>.Fail(row["Message"]?.ToString());
            }

            return ApiResponse<bool>.Ok(true, row["Message"]?.ToString());
        }
        public async Task<ApiResponse<CustomerDto>> GetOrCreateProfile(int userId)
        {
            var p = new[] { SqlParameterHelper.Input("@UserId", userId) };
            var dt = await GetDataTableAsync("sp_Customer_GetOrCreate", p);
            if (dt == null || dt.Rows.Count == 0) return ApiResponse<CustomerDto>.Fail("Failed");
            return ApiResponse<CustomerDto>.Ok(dt.ToList<CustomerDto>().FirstOrDefault());
        }

        public async Task<ApiResponse<CustomerDto>> CheckByMobile(string mobile)
        {
            var p = new[] { SqlParameterHelper.Input("@MobileNumber", mobile) };
            var dt = await GetDataTableAsync("sp_Customer_CheckByMobile", p);
            if (dt == null || dt.Rows.Count == 0) return ApiResponse<CustomerDto>.Fail("No customer found");
            return ApiResponse<CustomerDto>.Ok(dt.ToList<CustomerDto>().FirstOrDefault());
        }

        public async Task<ApiResponse<dynamic>> CreateComplaint(int userId, ComplaintCreateDto dto)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<dynamic>.Fail("Customer not found");

            var p = new[]
            {
        SqlParameterHelper.Input("@CustomerId", customerId),
        SqlParameterHelper.Input("@ProductId", dto.ProductId),
        SqlParameterHelper.Input("@Subject", dto.Subject),
        SqlParameterHelper.Input("@Description", dto.Description ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@Priority", dto.Priority)
    };

            var dt = await GetDataTableAsync("sp_Complaint_Create", p);

            if (dt == null || dt.Rows.Count == 0)
                return ApiResponse<dynamic>.Fail("Failed to create complaint");

            var id = Convert.ToInt32(dt.Rows[0]["ComplaintId"]);

            return ApiResponse<dynamic>.Ok(id, "Complaint created");
        }

        public async Task<ApiResponse<PagedResult<ComplaintListDto>>> GetMyComplaints(
      int userId, int? statusFilter, int page, int size)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null)
                return ApiResponse<PagedResult<ComplaintListDto>>.Fail("Customer not found");

            var p = new[]
            {
        SqlParameterHelper.Input("@CustomerId", customerId),
        SqlParameterHelper.Input("@StatusFilter", statusFilter ?? (object)DBNull.Value),
        SqlParameterHelper.Input("@PageNumber", page),
        SqlParameterHelper.Input("@PageSize", size)
    };

            var list = await GetListAsync<CustomerComplaintListDto>("sp_Customer_GetMyComplaints", p);

            var total = list.FirstOrDefault()?.TotalCount ?? 0;

            var mappedList = list.Select(x => new ComplaintListDto
            {
                ComplaintId = x.ComplaintId,
                ComplaintNumber = x.ComplaintNumber,
                Subject = x.Subject,
                Priority = x.Priority,
                ProductName = x.ProductName,
                SLADeadline = x.SLADeadline,
                CreatedAt = x.CreatedAt,
                TotalCount = x.TotalCount,

                // Optional if your SP returns them
                StatusName = "",
                StatusColor = null,
                CustomerName = ""
            }).ToList();

            var result = new PagedResult<ComplaintListDto>(
                mappedList,
                total,
                page,
                size,
                (int)Math.Ceiling((double)total / size)
            );

            return ApiResponse<PagedResult<ComplaintListDto>>.Ok(result);
        }

        public async Task<ApiResponse<ComplaintDetailDto>> GetComplaintDetail(int complaintId, int userId)
        {
            var customerId = await GetCustomerId(userId);
            if (customerId == null) return ApiResponse<ComplaintDetailDto>.Fail("Not found");

            var p = new[] {
        SqlParameterHelper.Input("@ComplaintId", complaintId),
        SqlParameterHelper.Input("@CustomerId", customerId)
    };
            var ds = await GetDataSetAsync("sp_Customer_GetComplaintDetail", p);
            if (ds == null || ds.Tables[0].Rows.Count == 0)
                return ApiResponse<ComplaintDetailDto>.Fail("Complaint not found");

            var detail = ds.Tables[0].ToList<ComplaintDetailDto>().FirstOrDefault();
            if (detail != null)
            {
                detail.Technicians = ds.Tables.Count > 1 ? ds.Tables[1].ToList<AssignedTechDto>() : new();
                detail.Timeline = ds.Tables.Count > 2 ? ds.Tables[2].ToList<TimelineItemDto>() : new();
            }
            return ApiResponse<ComplaintDetailDto>.Ok(detail);
        }

        // Services/QuickComplaintService.cs
       
            public async Task<ApiResponse<dynamic>> CreateQuickComplaint(int userId, QuickComplaintRequest_Dto request)
            {
                try
                {
                    // First get customer ID from user ID
                    var customerId = await GetCustomerId(userId);
                    if (customerId == null)
                    {
                        return ApiResponse<dynamic>.Fail("Customer not found");
                    }

                    var parameters = new[]
                    {
                SqlParameterHelper.Input("@CustomerId", customerId.Value),
                SqlParameterHelper.Input("@Subject", request.Subject),
                SqlParameterHelper.Input("@Description", request.Description ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@Category", request.Category ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@BrandName", request.BrandName ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ModelNumber", request.ModelNumber ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@Latitude", request.Latitude ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@Longitude", request.Longitude ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@LocationName", request.LocationName ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ImageBase64", request.ImageBase64 ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ImageName", request.ImageName ?? (object)DBNull.Value),
                SqlParameterHelper.Input("@ContentType", request.ContentType ?? (object)DBNull.Value)
            };

                    var dt = await GetDataTableAsync("sp_QuickComplaint_Create", parameters);

                    if (dt != null && dt.Rows.Count > 0)
                    {
                        var row = dt.Rows[0];
                        var complaintId = Convert.ToInt32(row["ComplaintId"]);
                        var complaintNumber = row["ComplaintNumber"].ToString();
                        var message = row["Message"].ToString();

                        if (complaintId > 0)
                        {
                            return ApiResponse<dynamic>.Ok(new
                            {
                                ComplaintId = complaintId,
                                ComplaintNumber = complaintNumber
                            }, message);
                        }

                        return ApiResponse<dynamic>.Fail(message ?? "Failed to create complaint");
                    }

                    return ApiResponse<dynamic>.Fail("Failed to create complaint");
                }
                catch (Exception ex)
                {
                  
                    return ApiResponse<dynamic>.Fail(ex.Message);
                }
            }

        //    private async Task<int?> GetCustomerIdByUserId(int userId)
        //    {
        //        var parameters = new[]
        //        {
        //    SqlParameterHelper.Input("@UserId", userId)
        //};

        //        var dt = await GetDataTableAsync("sp_GetCustomerIdByUserId", parameters);

        //        if (dt != null && dt.Rows.Count > 0)
        //        {
        //            return Convert.ToInt32(dt.Rows[0]["CustomerId"]);
        //        }

        //        return null;
        //    }


        public async Task<ApiResponse<string>> UploadComplaintImage(
      int complaintId,
      string imagePath,
      string imageType,
      int userId,
      string base64,
      string fileName,
      string contentType)
        {
            var parameters = new[]
            {
        SqlParameterHelper.Input("@ComplaintId", complaintId),
        SqlParameterHelper.Input("@ImagePath", imagePath),
        SqlParameterHelper.Input("@ImageType", imageType),
        SqlParameterHelper.Input("@UploadedBy", userId),
        SqlParameterHelper.Input("@ImageData", base64),
        SqlParameterHelper.Input("@ImageName", fileName),
        SqlParameterHelper.Input("@ContentType", contentType)
    };

            var dt = await GetDataTableAsync("sp_Complaint_UploadImage", parameters);

            return ApiResponse<string>.Ok("Uploaded", "Image uploaded successfully");
        }

    }
}
