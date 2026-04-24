using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.User.Modules;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Configuration;
using System;
using System.Collections.Generic;
using System.Data;
using System.Text;


namespace EncryptzBL.Infrastructure.Dashboard.Modules
{
    public class DashboardService : BaseRepository, IDashboardService
    {
        public DashboardService(DbHelper db) : base(db) { }

        // 🔥 DASHBOARD STATS (Matches sp_Dashboard_GetStats - 3 Result Sets)
        public async Task<DashboardResponse> GetDashboardStats(int? roleId, int? technicianId)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@RoleId", roleId),
                SqlParameterHelper.Input("@TechnicianId", technicianId)
            };

            // Your SP returns 3 tables:
            // Table[0] = Stats
            // Table[1] = Recent Complaints
            // Table[2] = SLA Breaches
            var ds = await GetDataSetAsync("sp_Dashboard_GetStats", parameters);

            var response = new DashboardResponse
            {
                Stats = ds.Tables[0].ToList<DashboardStats>().FirstOrDefault(),
                RecentComplaints = ds.Tables.Count > 1
                    ? ds.Tables[1].ToList<RecentComplaint>()
                    : new List<RecentComplaint>(),
                SLABreaches = ds.Tables.Count > 2
                    ? ds.Tables[2].ToList<SLABreachItem>()
                    : new List<SLABreachItem>()
            };

            return response;
        }

        // 🔥 CHART DATA (Matches sp_Dashboard_GetChartData - 3 Result Sets)
        public async Task<DashboardChartData> GetChartData(int days = 30)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@Days", days)
            };

            // Your SP returns:
            // Table[0] = ComplaintsByDate
            // Table[1] = ComplaintsByStatus
            // Table[2] = ComplaintsByPriority
            var ds = await GetDataSetAsync("sp_Dashboard_GetChartData", parameters);

            var result = new DashboardChartData
            {
                ComplaintsByDate = ds.Tables[0].ToList<ChartDataPoint>(),
                ComplaintsByStatus = ds.Tables.Count > 1
                    ? ds.Tables[1].ToList<StatusCount>()
                    : new List<StatusCount>(),
                ComplaintsByPriority = ds.Tables.Count > 2
                    ? ds.Tables[2].ToList<StatusCount>()
                    : new List<StatusCount>()
            };

            return result;
        }

        

        // ============================================
        // GET: Get Complete Complaint Details
        // ============================================
        public async Task<ApiResponse<ComplaintDetailResponseModel>> GetComplaintDetails(int complaintId)
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GET"),
                    SqlParameterHelper.Input("@ComplaintId", complaintId),
                    SqlParameterHelper.Input("@PageNumber", 1),
                    SqlParameterHelper.Input("@PageSize", 50)
                };

                var ds = await GetDataSetAsync("sp_ManageComplaintDetails", parameters);

                if (ds == null || ds.Tables.Count == 0)
                {
                    return ApiResponse<ComplaintDetailResponseModel>.Fail("Complaint not found");
                }

                var response = new ComplaintDetailResponseModel();

                // Table 0: Complaint details
                if (ds.Tables[0].Rows.Count > 0)
                {
                    response.Complaint = MapComplaint(ds.Tables[0].Rows[0]);
                }
                else
                {
                    return ApiResponse<ComplaintDetailResponseModel>.Fail("Complaint not found");
                }

                // Table 1: Customer details
                if (ds.Tables[1].Rows.Count > 0)
                {
                    response.Customer = MapCustomer(ds.Tables[1].Rows[0]);
                }

                // Table 2: Product details
                if (ds.Tables[2].Rows.Count > 0)
                {
                    response.Product = MapProduct(ds.Tables[2].Rows[0]);
                }

                // Table 3: Assignments
                if (ds.Tables[3].Rows.Count > 0)
                {
                    response.Assignments = ds.Tables[3].Rows.Cast<DataRow>().Select(MapAssignment).ToList();
                }
                else
                {
                    response.Assignments = new List<AssignmentResponseModel>();
                }

                // Table 4: Spare Parts
                if (ds.Tables[4].Rows.Count > 0)
                {
                    response.SpareParts = ds.Tables[4].Rows.Cast<DataRow>().Select(MapSparePart).ToList();
                }
                else
                {
                    response.SpareParts = new List<SparePartResponseModel>();
                }

                // Table 5: Comments
                if (ds.Tables[5].Rows.Count > 0)
                {
                    response.Comments = ds.Tables[5].Rows.Cast<DataRow>().Select(MapComment).ToList();
                }
                else
                {
                    response.Comments = new List<CommentResponseModel>();
                }

                // Table 6: Spare Parts Dropdown
                if (ds.Tables[6].Rows.Count > 0)
                {
                    response.SparePartsDropdown = ds.Tables[6].Rows.Cast<DataRow>().Select(MapSparePartDropdown).ToList();
                }
                else
                {
                    response.SparePartsDropdown = new List<SparePartDropdownModel>();
                }

                // Table 7: Technicians Dropdown
                if (ds.Tables[7].Rows.Count > 0)
                {
                    response.TechniciansDropdown = ds.Tables[7].Rows.Cast<DataRow>().Select(MapTechnicianDropdown).ToList();
                }
                else
                {
                    response.TechniciansDropdown = new List<TechnicianDropdownModel>();
                }

                return ApiResponse<ComplaintDetailResponseModel>.Ok(response, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<ComplaintDetailResponseModel>.Fail($"Error fetching complaint details: {ex.Message}");
            }
        }

        // ============================================
        // POST: Manage Complaint Details (All Operations)
        // ============================================
        // ═════════════════════════════════════════════════════════════════════════
        //  CORRECTED ManageComplaintDetails  (service method)
        //
        //  ONLY CHANGE vs your existing file is marked with "// ← FIX".
        //  The DBNull → null conversion in the GET path is what stops the popup
        //  from rendering "[object Object]" on fields that are NULL in the DB.
        // ═════════════════════════════════════════════════════════════════════════

        public async Task<ApiResponse<dynamic>> ManageComplaintDetails(ManageComplaintRequestModel request)
        {
            try
            {
                var parameters = new List<SqlParameter>
        {
            SqlParameterHelper.Input("@OperationType", request.OperationType)
        };

                // Common parameters
                if (request.ComplaintId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@ComplaintId", request.ComplaintId.Value));
                if (request.UserId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@UserId", request.UserId.Value));

                // Complaint parameters
                if (request.Subject != null)
                    parameters.Add(SqlParameterHelper.Input("@Subject", request.Subject));
                if (request.Description != null)
                    parameters.Add(SqlParameterHelper.Input("@Description", request.Description));
                if (request.Priority != null)
                    parameters.Add(SqlParameterHelper.Input("@Priority", request.Priority));
                if (request.Category != null)
                    parameters.Add(SqlParameterHelper.Input("@Category", request.Category));
                if (request.BrandName != null)
                    parameters.Add(SqlParameterHelper.Input("@BrandName", request.BrandName));
                if (request.ModelNumber != null)
                    parameters.Add(SqlParameterHelper.Input("@ModelNumber", request.ModelNumber));
                if (request.PreferredDate.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@PreferredDate", request.PreferredDate.Value));
                if (request.PreferredTimeSlot != null)
                    parameters.Add(SqlParameterHelper.Input("@PreferredTimeSlot", request.PreferredTimeSlot));
                if (request.Latitude.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@Latitude", request.Latitude.Value));
                if (request.Longitude.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@Longitude", request.Longitude.Value));
                if (request.LocationAddress != null)
                    parameters.Add(SqlParameterHelper.Input("@LocationAddress", request.LocationAddress));
                if (request.LocationName != null)
                    parameters.Add(SqlParameterHelper.Input("@LocationName", request.LocationName));

                // Customer parameters
                if (request.CustomerId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@CustomerId", request.CustomerId.Value));
                if (request.CustomerName != null)
                    parameters.Add(SqlParameterHelper.Input("@CustomerName", request.CustomerName));
                if (request.CustomerEmail != null)
                    parameters.Add(SqlParameterHelper.Input("@CustomerEmail", request.CustomerEmail));
                if (request.CustomerMobile != null)
                    parameters.Add(SqlParameterHelper.Input("@CustomerMobile", request.CustomerMobile));
                if (request.AlternatePhone != null)
                    parameters.Add(SqlParameterHelper.Input("@AlternatePhone", request.AlternatePhone));
                if (request.CustomerAddress != null)
                    parameters.Add(SqlParameterHelper.Input("@CustomerAddress", request.CustomerAddress));
                if (request.City != null)
                    parameters.Add(SqlParameterHelper.Input("@City", request.City));
                if (request.State != null)
                    parameters.Add(SqlParameterHelper.Input("@State", request.State));
                if (request.PinCode != null)
                    parameters.Add(SqlParameterHelper.Input("@PinCode", request.PinCode));
                if (request.Landmark != null)
                    parameters.Add(SqlParameterHelper.Input("@Landmark", request.Landmark));
                if (request.CustomerLatitude.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@CustomerLatitude", request.CustomerLatitude.Value));
                if (request.CustomerLongitude.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@CustomerLongitude", request.CustomerLongitude.Value));

                // Product parameters
                if (request.ProductId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@ProductId", request.ProductId.Value));
                if (request.ProductName != null)
                    parameters.Add(SqlParameterHelper.Input("@ProductName", request.ProductName));
                if (request.SerialNumber != null)
                    parameters.Add(SqlParameterHelper.Input("@SerialNumber", request.SerialNumber));
                if (request.ProductModelNumber != null)
                    parameters.Add(SqlParameterHelper.Input("@ProductModelNumber", request.ProductModelNumber));
                if (request.ProductBrand != null)
                    parameters.Add(SqlParameterHelper.Input("@ProductBrand", request.ProductBrand));
                if (request.ProductCategory != null)
                    parameters.Add(SqlParameterHelper.Input("@ProductCategory", request.ProductCategory));
                if (request.PurchaseDate.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@PurchaseDate", request.PurchaseDate.Value));
                if (request.WarrantyExpiryDate.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@WarrantyExpiryDate", request.WarrantyExpiryDate.Value));

                // Assignment parameters
                if (request.AssignmentId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@AssignmentId", request.AssignmentId.Value));
                if (request.TechnicianId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@TechnicianId", request.TechnicianId.Value));
                if (request.AssignmentRole != null)
                    parameters.Add(SqlParameterHelper.Input("@AssignmentRole", request.AssignmentRole));
                if (request.AssignmentNotes != null)
                    parameters.Add(SqlParameterHelper.Input("@AssignmentNotes", request.AssignmentNotes));
                if (request.ScheduledDate.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@ScheduledDate", request.ScheduledDate.Value));
                if (request.StartTime != null)
                    parameters.Add(SqlParameterHelper.Input("@StartTime", request.StartTime));
                if (request.EndTime != null)
                    parameters.Add(SqlParameterHelper.Input("@EndTime", request.EndTime));
                if (request.EstimatedDuration.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@EstimatedDuration", request.EstimatedDuration.Value));
                if (request.WorkDone != null)
                    parameters.Add(SqlParameterHelper.Input("@WorkDone", request.WorkDone));
                if (request.PartsUsed != null)
                    parameters.Add(SqlParameterHelper.Input("@PartsUsed", request.PartsUsed));
                if (request.CompletionRemarks != null)
                    parameters.Add(SqlParameterHelper.Input("@CompletionRemarks", request.CompletionRemarks));

                // Spare part parameters
                if (request.SpareRequestId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@SpareRequestId", request.SpareRequestId.Value));
                if (request.SparePartId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@SparePartId", request.SparePartId.Value));
                if (request.SpareQuantity.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@SpareQuantity", request.SpareQuantity.Value));
                if (request.SpareUrgency != null)
                    parameters.Add(SqlParameterHelper.Input("@SpareUrgency", request.SpareUrgency));
                if (request.SpareRemarks != null)
                    parameters.Add(SqlParameterHelper.Input("@SpareRemarks", request.SpareRemarks));
                if (request.SpareStatus != null)
                    parameters.Add(SqlParameterHelper.Input("@SpareStatus", request.SpareStatus));

                // Comment parameters
                if (request.CommentId.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@CommentId", request.CommentId.Value));
                if (request.CommentText != null)
                    parameters.Add(SqlParameterHelper.Input("@CommentText", request.CommentText));
                if (request.IsInternal.HasValue)
                    parameters.Add(SqlParameterHelper.Input("@IsInternal", request.IsInternal.Value));

                if (request.OperationType == "GET")
                {
                    var ds = await GetDataSetAsync("sp_ManageComplaintDetails", parameters.ToArray());

                    if (ds != null && ds.Tables.Count > 0)
                    {
                        var result = new List<object>();

                        foreach (DataTable table in ds.Tables)
                        {
                            var tableData = table.AsEnumerable()
                                .Select(row => table.Columns.Cast<DataColumn>()
                                    .ToDictionary(
                                        col => col.ColumnName,
                                        col => row[col] is DBNull ? null : row[col]   // ← FIX: was `col => row[col]`
                                    ))
                                .ToList();

                            result.Add(tableData);
                        }

                        return ApiResponse<object>.Ok(result, "Success");
                    }

                    return ApiResponse<object>.Fail("No data found");
                }
                else
                {
                    // For UPDATE/INSERT/DELETE operations, use GetDataTableAsync
                    var dt = await GetDataTableAsync("sp_ManageComplaintDetails", parameters.ToArray());

                    if (dt != null && dt.Rows.Count > 0)
                    {
                        // ── Defensive reads — every branch of the SP now returns
                        // Success, Message, AssignmentId, CommentId, RequestId
                        // columns, but if an older SP version is still deployed the
                        // extra columns may be missing. Guard against it so we never
                        // throw "Column X does not belong to table".
                        var row = dt.Rows[0];
                        var cols = dt.Columns;

                        var result = new OperationResultModel
                        {
                            Success = cols.Contains("Success") && Convert.ToBoolean(row["Success"]),
                            Message = cols.Contains("Message") ? row["Message"]?.ToString() : null,
                            AssignmentId = (cols.Contains("AssignmentId") && row["AssignmentId"] != DBNull.Value)
                                ? Convert.ToInt32(row["AssignmentId"]) : (int?)null,
                            CommentId = (cols.Contains("CommentId") && row["CommentId"] != DBNull.Value)
                                ? Convert.ToInt32(row["CommentId"]) : (int?)null,
                            RequestId = (cols.Contains("RequestId") && row["RequestId"] != DBNull.Value)
                                ? Convert.ToInt32(row["RequestId"]) : (int?)null
                        };

                        if (result.Success)
                            return ApiResponse<dynamic>.Ok(result, result.Message);
                        else
                            return ApiResponse<dynamic>.Fail(result.Message);
                    }
                    return ApiResponse<dynamic>.Fail("Operation failed");
                }
            }
            catch (Exception ex)
            {
                return ApiResponse<dynamic>.Fail($"Error: {ex.Message}");
            }
        }

        // ============================================
        // Dropdown Helpers
        // ============================================
        public async Task<ApiResponse<List<SparePartDropdownModel>>> GetSparePartsDropdown()
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GET_SPARE_PARTS_DROPDOWN")
                };

                var dt = await GetDataTableAsync("sp_ManageComplaintDetails", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<List<SparePartDropdownModel>>.Ok(new List<SparePartDropdownModel>(), "No spare parts found");
                }

                var spareParts = dt.Rows.Cast<DataRow>().Select(MapSparePartDropdown).ToList();
                return ApiResponse<List<SparePartDropdownModel>>.Ok(spareParts, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<List<SparePartDropdownModel>>.Fail($"Error fetching spare parts: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<TechnicianDropdownModel>>> GetTechniciansDropdown()
        {
            try
            {
                var parameters = new[]
                {
                    SqlParameterHelper.Input("@OperationType", "GET_TECHNICIANS_DROPDOWN")
                };

                var dt = await GetDataTableAsync("sp_ManageComplaintDetails", parameters);

                if (dt == null || dt.Rows.Count == 0)
                {
                    return ApiResponse<List<TechnicianDropdownModel>>.Ok(new List<TechnicianDropdownModel>(), "No technicians found");
                }

                var technicians = dt.Rows.Cast<DataRow>().Select(MapTechnicianDropdown).ToList();
                return ApiResponse<List<TechnicianDropdownModel>>.Ok(technicians, "Success");
            }
            catch (Exception ex)
            {
                return ApiResponse<List<TechnicianDropdownModel>>.Fail($"Error fetching technicians: {ex.Message}");
            }
        }

        // ============================================
        // Mapping Methods
        // ============================================

        private ComplaintResponseModel MapComplaint(DataRow row)
        {
            return new ComplaintResponseModel
            {
                ComplaintId = Convert.ToInt32(row["ComplaintId"]),
                ComplaintNumber = row["ComplaintNumber"]?.ToString(),
                Subject = row["Subject"]?.ToString(),
                Description = row["Description"]?.ToString(),
                CreatedAt = Convert.ToDateTime(row["CreatedAt"]),
                UpdatedAt = row["UpdatedAt"] != DBNull.Value ? Convert.ToDateTime(row["UpdatedAt"]) : (DateTime?)null,
                Priority = row["Priority"]?.ToString(),
                PriorityId = Convert.ToInt32(row["PriorityId"]),
                StatusId = Convert.ToInt32(row["StatusId"]),
                StatusName = row["StatusName"]?.ToString(),
                StatusColor = row["StatusColor"]?.ToString(),
                IsSLABreached = Convert.ToBoolean(row["IsSLABreached"]),
                SLADeadline = row["SLADeadline"] != DBNull.Value ? Convert.ToDateTime(row["SLADeadline"]) : (DateTime?)null,
                ContactNumber = row["ContactNumber"]?.ToString(),
                PreferredDate = row["PreferredDate"] != DBNull.Value ? Convert.ToDateTime(row["PreferredDate"]) : (DateTime?)null,
                PreferredTimeSlot = row["PreferredTimeSlot"]?.ToString(),
                Category = row["Category"]?.ToString(),
                BrandName = row["BrandName"]?.ToString(),
                ModelNumber = row["ModelNumber"]?.ToString(),
                LocationName = row["LocationName"]?.ToString(),
                LocationAddress = row["LocationAddress"]?.ToString(),
                Latitude = row["Latitude"] != DBNull.Value ? Convert.ToDecimal(row["Latitude"]) : (decimal?)null,
                Longitude = row["Longitude"] != DBNull.Value ? Convert.ToDecimal(row["Longitude"]) : (decimal?)null,
                ClosedAt = row["ClosedAt"] != DBNull.Value ? Convert.ToDateTime(row["ClosedAt"]) : (DateTime?)null
            };
        }

        private CustomerResponseModel MapCustomer(DataRow row)
        {
            return new CustomerResponseModel
            {
                CustomerId = Convert.ToInt32(row["CustomerId"]),
                CustomerName = row["CustomerName"]?.ToString(),
                Email = row["Email"]?.ToString(),
                MobileNumber = row["MobileNumber"]?.ToString(),
                AlternatePhone = row["AlternatePhone"]?.ToString(),
                Address = row["Address"]?.ToString(),
                City = row["City"]?.ToString(),
                State = row["State"]?.ToString(),
                PinCode = row["PinCode"]?.ToString(),
                Landmark = row["Landmark"]?.ToString(),
                Latitude = row["Latitude"] != DBNull.Value ? Convert.ToDecimal(row["Latitude"]) : (decimal?)null,
                Longitude = row["Longitude"] != DBNull.Value ? Convert.ToDecimal(row["Longitude"]) : (decimal?)null,
                CreatedAt = Convert.ToDateTime(row["CreatedAt"]),
                UpdatedAt = row["UpdatedAt"] != DBNull.Value ? Convert.ToDateTime(row["UpdatedAt"]) : (DateTime?)null
            };
        }

        private ProductResponseModel MapProduct(DataRow row)
        {
            return new ProductResponseModel
            {
                ProductId = Convert.ToInt32(row["ProductId"]),
                ProductName = row["ProductName"]?.ToString(),
                SerialNumber = row["SerialNumber"]?.ToString(),
                ModelNumber = row["ModelNumber"]?.ToString(),
                Brand = row["Brand"]?.ToString(),
                ProductCategory = row["ProductCategory"]?.ToString(),
                PurchaseDate = row["PurchaseDate"] != DBNull.Value ? Convert.ToDateTime(row["PurchaseDate"]) : (DateTime?)null,
                WarrantyExpiryDate = row["WarrantyExpiryDate"] != DBNull.Value ? Convert.ToDateTime(row["WarrantyExpiryDate"]) : (DateTime?)null,
                WarrantyStatus = row["WarrantyStatus"]?.ToString(),
                CreatedAt = Convert.ToDateTime(row["CreatedAt"]),
                UpdatedAt = row["UpdatedAt"] != DBNull.Value ? Convert.ToDateTime(row["UpdatedAt"]) : (DateTime?)null
            };
        }

        private AssignmentResponseModel MapAssignment(DataRow row)
        {
            return new AssignmentResponseModel
            {
                AssignmentId = Convert.ToInt32(row["AssignmentId"]),
                TechnicianId = Convert.ToInt32(row["TechnicianId"]),
                TechnicianName = row["TechnicianName"]?.ToString(),
                TechnicianPhone = row["TechnicianPhone"]?.ToString(),
                Specialization = row["Specialization"]?.ToString(),
                EmployeeCode = row["EmployeeCode"]?.ToString(),
                Role = row["Role"]?.ToString(),
                Status = row["Status"]?.ToString(),
                AssignedAt = Convert.ToDateTime(row["AssignedAt"]),
                CompletedAt = row["CompletedAt"] != DBNull.Value ? Convert.ToDateTime(row["CompletedAt"]) : (DateTime?)null,
                ScheduledDate = row["ScheduledDate"] != DBNull.Value ? Convert.ToDateTime(row["ScheduledDate"]) : (DateTime?)null,
                StartTime = row["StartTime"]?.ToString(),
                EndTime = row["EndTime"]?.ToString(),
                EstimatedDuration = row["EstimatedDuration"] != DBNull.Value ? Convert.ToInt32(row["EstimatedDuration"]) : (int?)null,
                Notes = row["Notes"]?.ToString(),
                Priority = row["Priority"]?.ToString(),
                WorkDone = row["WorkDone"]?.ToString(),
                PartsUsed = row["PartsUsed"]?.ToString(),
                CompletionRemarks = row["CompletionRemarks"]?.ToString(),
                AssignedByName = row["AssignedByName"]?.ToString()
            };
        }

        private SparePartResponseModel MapSparePart(DataRow row)
        {
            return new SparePartResponseModel
            {
                RequestId = Convert.ToInt32(row["RequestId"]),
                SparePartId = Convert.ToInt32(row["SparePartId"]),
                PartName = row["PartName"]?.ToString(),
                PartNumber = row["PartNumber"]?.ToString(),
                UnitPrice = row["UnitPrice"] != DBNull.Value ? Convert.ToDecimal(row["UnitPrice"]) : (decimal?)null,
                Quantity = Convert.ToInt32(row["Quantity"]),
                Status = row["Status"]?.ToString(),
                UrgencyLevel = row["UrgencyLevel"]?.ToString(),
                RequestedAt = Convert.ToDateTime(row["RequestedAt"]),
                ApprovedAt = row["ApprovedAt"] != DBNull.Value ? Convert.ToDateTime(row["ApprovedAt"]) : (DateTime?)null,
                Remarks = row["Remarks"]?.ToString(),
                TechnicianName = row["TechnicianName"]?.ToString(),
                TechnicianId = Convert.ToInt32(row["TechnicianId"]),
                ApprovedByName = row["ApprovedByName"]?.ToString()
            };
        }

        private CommentResponseModel MapComment(DataRow row)
        {
            return new CommentResponseModel
            {
                CommentId = Convert.ToInt32(row["CommentId"]),
                Comment = row["Comment"]?.ToString(),
                PostedByRole = row["PostedByRole"]?.ToString(),
                PostedBy = row["PostedBy"]?.ToString(),
                PostedAt = Convert.ToDateTime(row["PostedAt"]),
                IsInternal = Convert.ToBoolean(row["IsInternal"])
            };
        }

        private SparePartDropdownModel MapSparePartDropdown(DataRow row)
        {
            return new SparePartDropdownModel
            {
                SparePartId = Convert.ToInt32(row["SparePartId"]),
                PartName = row["PartName"]?.ToString(),
                PartNumber = row["PartNumber"]?.ToString(),
                StockQuantity = Convert.ToInt32(row["StockQuantity"]),
                UnitPrice = row["UnitPrice"] != DBNull.Value ? Convert.ToDecimal(row["UnitPrice"]) : (decimal?)null
            };
        }

        private TechnicianDropdownModel MapTechnicianDropdown(DataRow row)
        {
            return new TechnicianDropdownModel
            {
                TechnicianId = Convert.ToInt32(row["TechnicianId"]),
                TechnicianName = row["TechnicianName"]?.ToString(),
                Specialization = row["Specialization"]?.ToString(),
                AvailabilityStatus = Convert.ToInt32(row["AvailabilityStatus"]),
                EmployeeCode = row["EmployeeCode"]?.ToString()
            };
        }

        // ============================================
        // Database Helper Methods
        // ============================================

       
    }
}

