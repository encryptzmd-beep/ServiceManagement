using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Text;

namespace EncryptzBL.DTO_s
{


    // --- AUTH ---
    public class OtpRequestDto
    {
        public string MobileNumber { get; set; } = string.Empty;
    }

    public class OtpValidateDto
    {
        public string MobileNumber { get; set; } = string.Empty;
        public string OtpCode { get; set; } = string.Empty;
    }

    public class LoginRequestDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    public class LoginResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int UserId { get; set; }
        public int? technicianId { get; set; } 
        public string mobileNumber { get; set; } = string.Empty;
        public string Email { get; set; }
        public List<MenuDto> Menus { get; set; } = new();
    }

    public class RegisterDto
    {
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string MobileNumber { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public int RoleId { get; set; }
    }

    // --- MENU ---
    public class MenuDto
    {
        public int MenuId { get; set; }

        public string MenuName { get; set; } = string.Empty;

        public string? MenuPath { get; set; }

        public string? Icon { get; set; }

        public int? ParentMenuId { get; set; }

        public int SortOrder { get; set; }

        public bool CanView { get; set; }

        public bool CanCreate { get; set; }

        public bool CanEdit { get; set; }

        public bool CanDelete { get; set; }

        public List<MenuDto> Children { get; set; } = new();
    }
    public class MenuDto_new
    {
        public int MenuId { get; set; }

        public string MenuName { get; set; } = string.Empty;

        public string? MenuPath { get; set; }

        public string? Icon { get; set; }

        public int? ParentMenuId { get; set; }

        public int SortOrder { get; set; }

        public bool CanView { get; set; }

        public bool CanCreate { get; set; }

        public bool CanEdit { get; set; }

        public bool CanDelete { get; set; }

        public List<MenuDto> Children { get; set; } = new();
    }
    // --- CUSTOMER ---
    public class CustomerDto
    {
        public int CustomerId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? AlternatePhone { get; set; }
        public string MobileNumber { get; set; } = string.Empty;
    }

    public class CustomerCreateDto
    {
        public string CustomerName { get; set; } = string.Empty;
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PinCode { get; set; }
        public string? AlternatePhone { get; set; }
    }

    // --- PRODUCT ---
    public class ProductDto
    {
        public int ProductId { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Model { get; set; }
        public DateTime? PurchaseDate { get; set; }
        public DateTime? WarrantyExpiryDate { get; set; }
        public List<ProductImageDto> Images { get; set; } = new();
    }

    public class ProductCreateDto
    {
        public string ProductName { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public string? Brand { get; set; }
        public string? Model { get; set; }
        public DateTime? PurchaseDate { get; set; }
        public DateTime? WarrantyExpiryDate { get; set; }
    }

    public class ProductImageDto
    {
        public int ImageId { get; set; }
        public string ImageType { get; set; } = string.Empty;
        public string ImagePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
        public int ProductId { get; internal set; }
    }

    // --- COMPLAINT ---
    public class ComplaintDto
    {
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = string.Empty;
        public string StatusName { get; set; } = string.Empty;
        public string? StatusColor { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public string SerialNumber { get; set; } = string.Empty;
        public DateTime? SLADeadline { get; set; }
        public bool IsSLABreached { get; set; }
        public bool IsCustomerConfirmed { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public List<ComplaintImageDto> Images { get; set; } = new();
        public List<ComplaintTimelineDto> Timeline { get; set; } = new();
        public List<TechnicianAssignmentDto> Assignments { get; set; } = new();
    }

    public class ComplaintCreateDto
    {
        public int ProductId { get; set; }
        public string Subject { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Priority { get; set; } = string.Empty;
    }

    public class ComplaintUpdateStatusDto
    {
        public int StatusId { get; set; }
        public string? Remarks { get; set; }
    }

    public class ComplaintImageDto
    {
        public int ImageId { get; set; }
        public string ImagePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
    }

    public class ComplaintTimelineDto
    {
        public int TimelineId { get; set; }
        public string StatusName { get; set; } = string.Empty;
        public string? StatusColor { get; set; }
        public string? Remarks { get; set; }
        public string? ActionByName { get; set; }
        public DateTime ActionAt { get; set; }
    }

    public class ComplaintFilterDto
    {
        public int? StatusId { get; set; }
        public string? Priority { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class ComplaintListDto
    {
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string Priority { get; set; } = string.Empty;
        public string StatusName { get; set; } = string.Empty;
        public string? StatusColor { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string ProductName { get; set; } = string.Empty;
        public DateTime? SLADeadline { get; set; }
        public bool IsSLABreached { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? AssignedTechnicians { get; set; }
        public int TotalCount { get; set; }
    }

    // --- TECHNICIAN ASSIGNMENT ---
    public class TechnicianAssignmentDto
    {
        public int AssignmentId { get; set; }
        public int TechnicianId { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public string AssignmentRole { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime AssignedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
    }
    public class CompleteAssignmentDto
    {
        public int AssignmentId { get; set; }
        public string? Remarks { get; set; }
    }
    public class AssignTechnicianDto
    {
        public int ComplaintId { get; set; }
        public int TechnicianId { get; set; }
        public string AssignmentRole { get; set; } = string.Empty;
        public string? Priority { get; set; }
        public string? Notes { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public int? EstimatedDuration { get; set; }
        public string? TimeSlot { get; set; }
    }
    // UserDto.cs
    public class UserDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string MobileNumber { get; set; } = "";
        public int RoleId { get; set; }
        public string RoleName { get; set; } = "";
        public bool IsActive { get; set; } = true;
        public DateTime CreatedAt { get; set; }
    }

    public class SaveUserRequest
    {
        public int? UserId { get; set; }
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public string MobileNumber { get; set; } = "";
        public int RoleId { get; set; }
        public bool IsActive { get; set; } = true;
        public string? Password { get; set; }
    }

    // RoleDto.cs
    public class RoleDto
    {
        public int RoleId { get; set; }
        public string RoleName { get; set; } = "";
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class SaveRoleRequest
    {
        public int? RoleId { get; set; }
        public string RoleName { get; set; } = "";
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }

    // MenuAccessDto.cs
    public class MenuAccessDto
    {
        public int MenuId { get; set; }
        public string MenuName { get; set; } = "";
        public string? MenuPath { get; set; }
        public int? ParentMenuId { get; set; }
        public int SortOrder { get; set; }
        public bool CanView { get; set; }
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
        public bool HasAccess { get; set; }
    }

    public class SaveMenuAccessBulkRequest
    {
        public int RoleId { get; set; }
        public List<MenuAccessItem> Items { get; set; } = [];
    }

    public class MenuAccessItem
    {
        public int MenuId { get; set; }
        public bool CanView { get; set; }
        public bool CanCreate { get; set; }
        public bool CanEdit { get; set; }
        public bool CanDelete { get; set; }
    }
    public class AuditLogDto
    {
        public int AuditId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? OldTechnician { get; set; }
        public string? NewTechnician { get; set; }
        public string? OldRole { get; set; }
        public string? NewRole { get; set; }
        public string? ChangedByName { get; set; }
        public DateTime ChangedAt { get; set; }
        public string? Remarks { get; set; }
    }

    // --- TECHNICIAN ---
    // This DTO already exists in your file, it matches Angular perfectly:
    public class TechnicianDto
    {
        public int TechnicianId { get; set; }    // ← maps to UserId AS TechnicianId
        public string FullName { get; set; }
        public string? Email { get; set; }
        public string MobileNumber { get; set; }
        public string? Specialization { get; set; }
        public bool IsAvailable { get; set; }
    }

    public class WorkOrderDto
    {
        public int AssignmentId { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerAddress { get; set; }
        public string? CustomerPhone { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string AssignmentRole { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime AssignedAt { get; set; }
    }

    public class ServiceUpdateDto
    {
        public int AssignmentId { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public string? WorkDone { get; set; }
        public string? PartsUsed { get; set; }
        public string? CustomerFeedback { get; set; }
    }
    public class ServiceImageDto
    {
        public int ComplaintId { get; set; }
        public string ImageType { get; set; } = string.Empty;
    }

    // --- SPARE PARTS ---
    public class SparePartDto
    {
        public int SparePartId { get; set; }
        public string PartName { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public int StockQuantity { get; set; }
        public decimal? UnitPrice { get; set; }
    }

    public class SparePartRequestDto
    {
        public int ComplaintId { get; set; }
        public int SparePartId { get; set; }
        public int Quantity { get; set; }
    }

    public class SparePartRequestListDto
    {
        public int RequestId { get; set; }
        public string PartName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime RequestedAt { get; set; }
        public string? ApprovedByName { get; set; }
        public DateTime? ApprovedAt { get; set; }
    }

    // --- WARRANTY ---
    public class WarrantyReturnDto
    {
        public int ReturnId { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string PartName { get; set; } = string.Empty;
        public string? OldPartSerialNumber { get; set; }
        public string ReturnStatus { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    //public class WarrantyReturnCreateDto
    //{
    //    public int ComplaintId { get; set; }
    //    public int SparePartId { get; set; }
    //    public string? OldPartSerialNumber { get; set; }
    //}

    // --- TRACKING ---
    public class CheckInDto
    {
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public string? Address { get; set; }
    }

    public class CheckOutDto
    {
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public string? Address { get; set; }
    }

    public class AttendanceDto
    {
        public int AttendanceId { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public DateTime? CheckInTime { get; set; }
        public string? CheckInAddress { get; set; }
        public DateTime? CheckOutTime { get; set; }
        public string? CheckOutAddress { get; set; }
        public decimal? TotalWorkHours { get; set; }
        public DateOnly AttendanceDate { get; set; }
    }

    public class GeoTrackDto
    {
        public long TrackingId { get; set; }
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public string? Address { get; set; }
        public string EventType { get; set; } = string.Empty;
        public DateTime RecordedAt { get; set; }
    }

    public class SiteArrivalDto
    {
        public int ComplaintId { get; set; }
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public string? Address { get; set; }
    }

    public class TravelReportDto
    {
        public string TechnicianName { get; set; } = string.Empty;
        public DateOnly TravelDate { get; set; }
        public decimal TotalDistanceKm { get; set; }
        public int ServiceVisits { get; set; }
    }

    // --- SCHEDULE ---
    public class ScheduleDto
    {
        public int ScheduleId { get; set; }
        public int TechnicianId { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public DateOnly ScheduledDate { get; set; }
        public TimeOnly TimeSlotStart { get; set; }
        public TimeOnly TimeSlotEnd { get; set; }
        public string Status { get; set; } = string.Empty;
        public bool HasConflict { get; set; }
    }

    //public class ScheduleCreateDto
    //{
    //    public int TechnicianId { get; set; }
    //    public int ComplaintId { get; set; }
    //    public DateOnly ScheduledDate { get; set; }
    //    public TimeOnly TimeSlotStart { get; set; }
    //    public TimeOnly TimeSlotEnd { get; set; }
    //}

    // --- REPORTS ---
    public class DashboardSummaryDto
    {
        public int TotalComplaints { get; set; }
        public int OpenComplaints { get; set; }
        public int ClosedToday { get; set; }
        public int SLABreached { get; set; }
        public int ActiveTechnicians { get; set; }
        public decimal AvgResolutionHours { get; set; }
    }

    public class SLAReportDto
    {
        public int TotalComplaints { get; set; }
        public int WithinSLA { get; set; }
        public int SLABreached { get; set; }
        public decimal SLACompliancePercent { get; set; }
        public List<SLAByPriorityDto> ByPriority { get; set; } = new();
    }

    public class SLAByPriorityDto
    {
        public string Priority { get; set; } = string.Empty;
        public int Total { get; set; }
        public int WithinSLA { get; set; }
        public int Breached { get; set; }
    }

    public class ProductivityReportDto
    {
        public string TechnicianName { get; set; } = string.Empty;
        public int TotalAssignments { get; set; }
        public int Completed { get; set; }
        public decimal TotalWorkHours { get; set; }
        public decimal TotalDistanceKm { get; set; }
        public int SparePartsUsed { get; set; }
    }



    public class PagedResult<T>
    {
        public List<T> Items { get; set; } = new();
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }

        public PagedResult() { }

        // ⭐ THIS FIXES YOUR ERROR
        public PagedResult(
            List<T> items,
            int totalCount,
            int pageNumber,
            int pageSize,
            int totalPages)
        {
            Items = items;
            TotalCount = totalCount;
            PageNumber = pageNumber;
            PageSize = pageSize;
            TotalPages = totalPages;
        }
    }


    // --- COMMON ---
    public class ApiResponse
    {
        public bool Success { get; set; }
        public string Message { get; set; }

        public ApiResponse() { }

        public ApiResponse(bool success, string message)
        {
            Success = success;
            Message = message;
        }
    }


    public class DashboardStats
    {
        public int TotalComplaints { get; set; }
        public int NewComplaints { get; set; }
        public int InProgressComplaints { get; set; }
        public int ResolvedComplaints { get; set; }
        public int ClosedComplaints { get; set; }
        public int SLABreached { get; set; }
        public int WarrantyComplaints { get; set; }
        public int AvailableTechnicians { get; set; }
        public int TodaySchedules { get; set; }
        public int PendingReturns { get; set; }
    }

    public class RecentComplaint
    {
        public int ComplaintId { get; set; }
        public string ComplaintNo { get; set; }
        public string Subject { get; set; }
        public DateTime CreatedDate { get; set; }
        public int StatusId { get; set; }
        public int? PriorityId { get; set; }
        public string CustomerName { get; set; }
        public string TechnicianName { get; set; }
    }

    public class SLABreachItem
    {
        public string ComplaintNo { get; set; }
        public string Subject { get; set; }
        public DateTime SLADeadline { get; set; }
        public int HoursOverdue { get; set; }
        public string CustomerName { get; set; }
    }

    public class DashboardResponse
    {
        public DashboardStats Stats { get; set; }
        public List<RecentComplaint> RecentComplaints { get; set; }
        public List<SLABreachItem> SLABreaches { get; set; }
    }

    public class ChartDataPoint
    {
        public DateTime Date { get; set; }
        public int Count { get; set; }
    }

    public class StatusCount
    {
        public int StatusId { get; set; }
        public int Count { get; set; }
    }

    public class DashboardChartData
    {
        public List<ChartDataPoint> ComplaintsByDate { get; set; }
        public List<StatusCount> ComplaintsByStatus { get; set; }
        public List<StatusCount> ComplaintsByPriority { get; set; }
    }


    public class TechnicianListItem
    {
        public int TechnicianId { get; set; }           // ✅ maps to "UserId AS TechnicianId"
        public string FullName { get; set; }
        public string Email { get; set; }
        public string MobileNumber { get; set; }        // ✅ maps to "MobileNumber"
        public string Specialization { get; set; }
        public int AvailabilityStatus { get; set; }
        public bool IsActive { get; set; }
        public int ProfileId { get; set; }
        public string EmployeeCode { get; set; }
        public int ExperienceYears { get; set; }
        public decimal Rating { get; set; }
        public int TotalCompletedJobs { get; set; }
        public int MaxDailyAssignments { get; set; }
        public DateTime JoinDate { get; set; }
        public decimal? CurrentLatitude { get; set; }
        public decimal? CurrentLongitude { get; set; }
        public DateTime? LastLocationUpdate { get; set; }
        public int TodayAssignments { get; set; }
        public int ActiveComplaints { get; set; }
        public int TotalCount { get; set; }
    }

    public class TechnicianDetail : TechnicianListItem
    {
        public string ProfileImage { get; set; }
        public string CertificationDetails { get; set; }
        public int TotalAssigned { get; set; }
        public int TotalResolved { get; set; }
        public double? AvgResolutionHours { get; set; }
        public List<dynamic> Skills { get; set; }
        public List<ScheduleListItem> RecentSchedules { get; set; }
    }

    public class TechnicianCreateDto
    {
        public string FullName { get; set; }
        public string? Email { get; set; }
        public string MobileNumber { get; set; }
        public string Specialization { get; set; }
        public int ExperienceYears { get; set; }
        public string? CertificationDetails { get; set; }
        public int MaxDailyAssignments { get; set; } = 5;
        public DateTime? JoinDate { get; set; }
    }



    //public class TechnicianCreateDto
    //{
    //    public int UserId { get; set; }
    //    public string EmployeeCode { get; set; }
    //    public string Specialization { get; set; }
    //    public int ExperienceYears { get; set; }
    //    public string CertificationDetails { get; set; }
    //    public int MaxDailyAssignments { get; set; } = 5;
    //    public DateTime JoinDate { get; set; }
    //}

    public class TechnicianUpdateDto
    {
        public int ProfileId { get; set; }
        public string Specialization { get; set; }
        public int ExperienceYears { get; set; }
        public string CertificationDetails { get; set; }
        public int MaxDailyAssignments { get; set; }
        public int AvailabilityStatus { get; set; }
    }

    public class TechnicianFilterDto
    {
        public string? SearchTerm { get; set; }
        public int? StatusFilter { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;
        public string SortBy { get; set; } = "FullName";
        public string SortDir { get; set; } = "ASC";
    }


    public class TechnicianScheduleBoardItemDto
    {
        public int ScheduleId { get; set; }

        public string ComplaintNumber { get; set; } = string.Empty;

        public string CustomerName { get; set; } = string.Empty;

        public string City { get; set; } = string.Empty;

        public string Address { get; set; } = string.Empty;

        public decimal? Latitude { get; set; }

        public decimal? Longitude { get; set; }

        public string Landmark { get; set; } = string.Empty;

        public string ProductName { get; set; } = string.Empty;

        public string StartTime { get; set; } = string.Empty;

        public string EndTime { get; set; } = string.Empty;

        public int StatusId { get; set; }

        public string StatusName { get; set; } = string.Empty;

        public string TimeSlot { get; set; } = string.Empty;

        public bool IsFuture { get; set; }

        public bool IsFree { get; set; }
    }

    public class WarrantyReturnListItem
    {
        public int ReturnId { get; set; }
        public string ReturnNo { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNo { get; set; }
        public string ComplaintSubject { get; set; }
        public int CustomerId { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public int ProductId { get; set; }
        public string ProductSerialNo { get; set; }
        public DateTime WarrantyStartDate { get; set; }
        public DateTime WarrantyEndDate { get; set; }
        public string ReturnReason { get; set; }
        public int ReturnType { get; set; }
        public int StatusId { get; set; }
        public int? ApprovedBy { get; set; }
        public DateTime? ApprovedDate { get; set; }
        public DateTime? PickupDate { get; set; }
        public string PickupAddress { get; set; }
        public string TrackingNumber { get; set; }
        public string ResolutionNotes { get; set; }
        public decimal? RefundAmount { get; set; }
        public DateTime CreatedDate { get; set; }
        public int TotalCount { get; set; }
    }



    public class WarrantyReturnCreateDto
    {
        public int ComplaintId { get; set; }
        public int CustomerId { get; set; }
        public int ProductId { get; set; }
        public string ProductSerialNo { get; set; }
        public DateTime WarrantyStartDate { get; set; }
        public DateTime WarrantyEndDate { get; set; }
        public string ReturnReason { get; set; }
        public int ReturnType { get; set; }
        public string PickupAddress { get; set; }
    }

    public class WarrantyReturnStatusDto
    {
        public int ReturnId { get; set; }
        public int StatusId { get; set; }
        public string ResolutionNotes { get; set; }
        public string TrackingNumber { get; set; }
        public decimal? RefundAmount { get; set; }
    }

    public class WarrantyReturnFilterDto
    {
        public string SearchTerm { get; set; }
        public int? StatusFilter { get; set; }
        public int? ReturnTypeFilter { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 10;
    }



    public class ScheduleListItem
    {
        public int ScheduleId { get; set; }
        public int TechnicianId { get; set; }
        public string TechnicianName { get; set; }
        public string EmployeeCode { get; set; }
        public string Specialization { get; set; }
        public int? ComplaintId { get; set; }
        public string ComplaintNo { get; set; }
        public string ComplaintSubject { get; set; }
        public int? PriorityId { get; set; }
        public DateTime ScheduleDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int TaskType { get; set; }
        public int PriorityLevel { get; set; }
        public int StatusId { get; set; }
        public string CustomerAddress { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public int EstimatedDuration { get; set; }
        public int? ActualDuration { get; set; }
        public string Notes { get; set; }
    }

    public class ScheduleConflictItem
    {
        public int ConflictId { get; set; }
        public int Schedule1Id { get; set; }
        public int Schedule2Id { get; set; }
        public int TechnicianId { get; set; }
        public string TechnicianName { get; set; }
        public string EmployeeCode { get; set; }
        public DateTime ConflictDate { get; set; }
        public int ConflictType { get; set; }
        public int Severity { get; set; }
        public TimeSpan Schedule1Start { get; set; }
        public TimeSpan Schedule1End { get; set; }
        public int Schedule1Type { get; set; }
        public TimeSpan Schedule2Start { get; set; }
        public TimeSpan Schedule2End { get; set; }
        public int Schedule2Type { get; set; }
        public string Complaint1No { get; set; }
        public string Complaint2No { get; set; }
        public bool IsResolved { get; set; }
    }

    public class TechnicianScheduleBoardDto
    {
        public int TechnicianId { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public List<TechnicianScheduleBoardItemDto> Items { get; set; } = new();
    }

    public class ScheduleCreateDto
    {
        public int TechnicianId { get; set; }
        public int? ComplaintId { get; set; }
        public DateTime ScheduleDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int TaskType { get; set; } = 1;
        public int PriorityLevel { get; set; } = 2;
        public string CustomerAddress { get; set; }
        public decimal? CustomerLatitude { get; set; }
        public decimal? CustomerLongitude { get; set; }
        public int EstimatedDuration { get; set; } = 60;
        public string Notes { get; set; }
    }

    public class ScheduleUpdateDto
    {
        public int ScheduleId { get; set; }
        public DateTime ScheduleDate { get; set; }
        public TimeSpan StartTime { get; set; }
        public TimeSpan EndTime { get; set; }
        public int TaskType { get; set; }
        public int PriorityLevel { get; set; }
        public int StatusId { get; set; }
        public string Notes { get; set; }
    }

    public class ConflictResolveDto
    {
        public int ConflictId { get; set; }
        public string Resolution { get; set; }
    }



    public class TechnicianLivePosition
    {
        public int TechnicianId { get; set; }
        public string FullName { get; set; }
        public string EmployeeCode { get; set; }
        public string Specialization { get; set; }
        public decimal? CurrentLatitude { get; set; }
        public decimal? CurrentLongitude { get; set; }
        public DateTime? LastLocationUpdate { get; set; }
        public int AvailabilityStatus { get; set; }
        public string CurrentComplaint { get; set; }
    }

    public class TrackingLogEntry
    {
        public long LogId { get; set; }
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public decimal? Accuracy { get; set; }
        public decimal? Speed { get; set; }
        public int? BatteryLevel { get; set; }
        public DateTime LogTime { get; set; }
    }
    public class SpareRequestAdminDto
    {
        public int RequestId { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string ComplaintSubject { get; set; } = string.Empty;
        public int SparePartId { get; set; }
        public string PartName { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public int StockQuantity { get; set; }
        public int Quantity { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? UrgencyLevel { get; set; }
        public string? Remarks { get; set; }
        public DateTime RequestedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string? ApprovedByName { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public int TechnicianId { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerPhone { get; set; }
        public int TotalCount { get; set; }
    }

    public class SpareRequestByComplaintDto
    {
        public int RequestId { get; set; }
        public int SparePartId { get; set; }
        public string PartName { get; set; } = string.Empty;
        public string? PartNumber { get; set; }
        public decimal? UnitPrice { get; set; }
        public int Quantity { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? UrgencyLevel { get; set; }
        public string? Remarks { get; set; }
        public DateTime RequestedAt { get; set; }
        public DateTime? ApprovedAt { get; set; }
        public string TechnicianName { get; set; } = string.Empty;
        public string? ApprovedByName { get; set; }
    }

    public class SparePartDashboardSummaryDto
    {
        public int TotalRequests { get; set; }
        public int PendingCount { get; set; }
        public int ApprovedCount { get; set; }
        public int DispatchedCount { get; set; }
        public int RejectedCount { get; set; }
        public int UsedCount { get; set; }
        public int CriticalPending { get; set; }
    }

    public class SpareFilterDto
    {
        public string? Status { get; set; }
        public string? UrgencyLevel { get; set; }
        public int? ComplaintId { get; set; }
        public int PageNumber { get; set; } = 1;
        public int PageSize { get; set; } = 20;
    }

    public class BulkStatusDto
    {
        public List<int> RequestIds { get; set; } = new();
        public string Status { get; set; } = string.Empty;
    }
    public class SparePartRequestCreateDto
    {
        public int ComplaintId { get; set; }
        public int TechnicianId { get; set; }

        public int? SparePartId { get; set; }   // ✅ nullable

        public int Quantity { get; set; } = 1;
        public string UrgencyLevel { get; set; } = "Normal";
        public string? Remarks { get; set; }

        // ✅ NEW (for custom parts)
        public string? CustomPartName { get; set; }
        public string? CustomPartNumber { get; set; }
    }

    public class WorkOrderDetailDto
    {
        public int AssignmentId { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; } = string.Empty;
        public string Subject { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string? Priority { get; set; }
        public DateTime? SLADeadline { get; set; }
        public DateTime ComplaintCreatedAt { get; set; }
        public string AssignmentRole { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string StatusName { get; set; } = string.Empty;
        public string? StatusColor { get; set; }
        public DateTime AssignedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public DateTime? ScheduledDate { get; set; }
        public string? StartTime { get; set; }
        public string? EndTime { get; set; }
        public int? EstimatedDuration { get; set; }
        public string? TimeSlot { get; set; }
        public string? Notes { get; set; }
        public string CustomerName { get; set; } = string.Empty;
        public string? CustomerAddress { get; set; }
        public string? CustomerPhone { get; set; }
        public string? City { get; set; }
        public string ProductName { get; set; } = string.Empty;
        public string? SerialNumber { get; set; }
        public string? Brand { get; set; }
        public DateTime? WarrantyExpiryDate { get; set; }
        public bool IsSLABreached { get; set; }
        public List<WorkOrderTimelineDto> Timeline { get; set; } = new();
        public List<ServiceImageItemDto> Images { get; set; } = new();
        public List<WorkOrderRepairDetailDto> RepairDetails { get; set; } = new();
    }

    public class WorkOrderRepairDetailDto
    {
        public int RepairRequestId { get; set; }
        public string PartName { get; set; } = string.Empty;
        public string? PartSerialNumber { get; set; }
        public string? Notes { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int ImageCount { get; set; }
    }

    public class WorkOrderTimelineDto
    {
        public int AuditId { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public DateTime ChangedAt { get; set; }
        public string? ChangedByName { get; set; }
        public string? OldTechnicianName { get; set; }
        public string? NewTechnicianName { get; set; }
        public string? OldRole { get; set; }
        public string? NewRole { get; set; }
    }

    public class ServiceImageItemDto
    {
        public int ImageId { get; set; }
        public string ImageType { get; set; } = string.Empty;
        public string ImagePath { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
    }

    public class ServiceImageSaveDto
    {
        public int ComplaintId { get; set; }
        public int TechnicianId { get; set; }
        public string ImageType { get; set; } = "Other";
        public string ImagePath { get; set; } = string.Empty;
    }



    public class TrackingLogDto
    {
        public int TechnicianId { get; set; }
        public decimal Latitude { get; set; }
        public decimal Longitude { get; set; }
        public decimal? Accuracy { get; set; }
        public decimal? Speed { get; set; }
        public int? BatteryLevel { get; set; }
        public Guid? SessionId { get; set; }
    }


    public class CustomerComplaint
    {
        public int ComplaintId { get; set; }
        public string ComplaintNo { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public int StatusId { get; set; }
        public int? PriorityId { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? ResolvedDate { get; set; }
        public DateTime? ClosedDate { get; set; }
        public bool IsWarranty { get; set; }
        public string TechnicianName { get; set; }
        public string TechnicianPhone { get; set; }
        public int TotalCount { get; set; }
    }

    public class ComplaintTrackingDetail
    {
        public int ComplaintId { get; set; }
        public string ComplaintNo { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public int StatusId { get; set; }
        public string CustomerName { get; set; }
        public string TechnicianName { get; set; }
        public DateTime CreatedDate { get; set; }
        public DateTime? AssignedDate { get; set; }
        public DateTime? ResolvedDate { get; set; }
        public List<StatusHistoryItem> StatusHistory { get; set; }
    }

    public class StatusHistoryItem
    {
        public int HistoryId { get; set; }
        public int OldStatusId { get; set; }
        public int NewStatusId { get; set; }
        public string ChangedByName { get; set; }
        public DateTime ChangedDate { get; set; }
        public string Remarks { get; set; }
    }



    public class ServiceRequestCreateDto
    {
        public int? ProductId { get; set; }
        public int RequestType { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public DateTime? PreferredDate { get; set; }
        public string PreferredTimeSlot { get; set; }
    }



    public class ComplaintSummaryReport
    {
        public DateTime ReportDate { get; set; }
        public int StatusId { get; set; }
        public int PriorityId { get; set; }
        public int ComplaintCount { get; set; }
        public int WarrantyCount { get; set; }
        public int SLABreached { get; set; }
        public double? AvgResolutionHours { get; set; }
    }
    public class SlaComplianceDto
    {
        public string Priority { get; set; } = string.Empty;
        public int Total { get; set; }
        public int WithinSla { get; set; }
        public int Breached { get; set; }
        public decimal CompliancePercent { get; set; }
        public decimal AvgResolutionHours { get; set; }
        public int SlaTargetHours { get; set; }
    }
    public class TechPerformanceReport
    {
        public int UserId { get; set; }
        public string FullName { get; set; }
        public string EmployeeCode { get; set; }
        public string Specialization { get; set; }
        public int TotalAssigned { get; set; }
        public int Resolved { get; set; }
        public int Closed { get; set; }
        public int SLABreached { get; set; }
        public double? AvgResolutionHours { get; set; }
        public decimal Rating { get; set; }
    }



    public class ReportFilterDto
    {
        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public int? StatusId { get; set; }
        public int? PriorityId { get; set; }
        public int? TechnicianId { get; set; }
    }


    public class SystemSetting
    {
        public int SettingId { get; set; }
        public string SettingKey { get; set; }
        public string SettingValue { get; set; }
        public string SettingGroup { get; set; }
        public string DataType { get; set; }
        public string Description { get; set; }
        public bool IsEditable { get; set; }
        public DateTime ModifiedDate { get; set; }
    }



    public class SettingUpdateDto
    {
        public int SettingId { get; set; }
        public string SettingValue { get; set; }
    }

    public class BulkSettingsUpdateDto
    {
        public List<SettingUpdateDto> Settings { get; set; }
    }



    public class ApiResponse<T>
    {
        public bool Success { get; set; }
        public string Message { get; set; }
        public T Data { get; set; }
        public int? TotalCount { get; set; }

        public static ApiResponse<T> Ok(T data, string message = "Success", int? totalCount = null)
            => new() { Success = true, Message = message, Data = data, TotalCount = totalCount };

        public static ApiResponse<T> Fail(string message)
            => new() { Success = false, Message = message };
    }

    public class PagedResponse<T>
    {
        public List<T> Items { get; set; }
        public int TotalCount { get; set; }
        public int PageNumber { get; set; }
        public int PageSize { get; set; }
        public int TotalPages => (int)Math.Ceiling((double)TotalCount / PageSize);
    }

    public class UnAssignTechnicianRequest
    {
        public int AssignmentId { get; set; }
        public string? Reason { get; set; }
    }

    // ─── Response Model ──────────────────────────────────────────────────────────
    public class UnAssignTechnicianResponse
    {
        public int Result { get; set; }
        public string Message { get; set; } = string.Empty;

        // Derived helper — true only when SP returns Result = 1
        public bool Success => Result == 1;
    }
    public class ComplaintAutoCompleteDto
    {
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; }
        public string Subject { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
        public string CustomerPlace { get; set; }
        public string Priority { get; set; }
        public int StatusId { get; set; }
    }

    public class ActiveAssignmentDto
    {
        public int AssignmentId { get; set; }
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; }
        public string ComplaintSubject { get; set; }
        public string TechnicianName { get; set; }
        public string AssignmentRole { get; set; }
        public string Status { get; set; }
        public DateTime AssignedAt { get; set; }
        public string CustomerName { get; set; }
        public string CustomerPhone { get; set; }
    }

    public class ProductMasterDto
    {
        public int ProductMasterId { get; set; }
        public string ProductName { get; set; }
        public string Brand { get; set; }
        public string Category { get; set; }
        public string Model { get; set; }
        public string Description { get; set; }
        public int WarrantyMonths { get; set; }
    }

    public class CustomerComplaintListDto
    {
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public string Priority { get; set; }
        public int StatusId { get; set; }
        public DateTime? SLADeadline { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string ProductName { get; set; }
        public string SerialNumber { get; set; }
        public string Brand { get; set; }
        public string TechnicianName { get; set; }
        public string TechnicianPhone { get; set; }
        public string AssignmentRole { get; set; }
        public string AssignmentStatus { get; set; }
        public DateTime? AssignedAt { get; set; }
        public int TotalCount { get; set; }
    }

    public class ComplaintDetailDto
    {
        public int ComplaintId { get; set; }
        public string ComplaintNumber { get; set; }
        public string Subject { get; set; }
        public string Description { get; set; }
        public string Priority { get; set; }
        public int StatusId { get; set; }
        public DateTime? SLADeadline { get; set; }
        public DateTime CreatedAt { get; set; }
        public bool IsCustomerConfirmed { get; set; }
        public string ProductName { get; set; }
        public string SerialNumber { get; set; }
        public string Brand { get; set; }
        public string CustomerName { get; set; }
        public string MobileNumber { get; set; }
        public string City { get; set; }
        public List<AssignedTechDto> Technicians { get; set; } = new();
        public List<TimelineItemDto> Timeline { get; set; } = new();
    }

    public class AssignedTechDto
    {
        public int AssignmentId { get; set; }
        public string AssignmentRole { get; set; }
        public string Status { get; set; }
        public DateTime AssignedAt { get; set; }
        public DateTime? CompletedAt { get; set; }
        public string TechnicianName { get; set; }
        public string TechnicianPhone { get; set; }
        public string Specialization { get; set; }
        public decimal Rating { get; set; }
    }

    public class TimelineItemDto
    {
        public int AuditId { get; set; }
        public string Action { get; set; }
        public string Remarks { get; set; }
        public DateTime ChangedAt { get; set; }
        public string ChangedByName { get; set; }
        public string TechnicianName { get; set; }
        public string NewRole { get; set; }
    }

    public class ComplaintReplyDto
    {
        public string Message { get; set; }
    }
    // DTOs/CompanyDtos.cs
   
        public class SelfRegisterDto
        {
            public string FullName { get; set; }
            public string Email { get; set; }
            public string MobileNumber { get; set; }
            public string Password { get; set; }
            public string AadhaarNumber { get; set; }
        }

        public class CompanyResponseDto
        {
            public int CompanyId { get; set; }
            public string CompanyName { get; set; }
            public string CompanyCode { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
            public string PhoneNumber { get; set; }
            public string RoleInCompany { get; set; }
            public bool IsLinked { get; set; }
        }

    public class SelectCompanyRequestDto
    {
        public int UserId { get; set; }
        public int CompanyId { get; set; }
    }

    public class SelectCompanyResponseDto
        {
            public string Token { get; set; }
            public string Role { get; set; }
            public string RedirectUrl { get; set; }
        }

        public class InviteUserRequestDto
        {
            public string Email { get; set; }
            public string RoleInCompany { get; set; }
            public string Remarks { get; set; }
        }
    public class AcceptInvitationRequestDto
    {
        public Guid Token { get; set; }
        public int UserId { get; set; }
    }

    public class CompanyUserResponseDto
    {
        public int UserId { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string MobileNumber { get; set; }
        public string RoleInCompany { get; set; }
        public DateTime AssignedAt { get; set; }
        public string AssignedByName { get; set; }
    }
    public class ExistingUserCompanyDto
    {
        public int CompanyUserId { get; set; }

        public int CompanyId { get; set; }

        public string CompanyName { get; set; } = string.Empty;

        public string RoleInCompany { get; set; } = string.Empty;
    }
    public class InsertCustomerForExistingUserDto
    {
        public int UserId { get; set; }

        public int? CompanyId { get; set; }

        public string? Address { get; set; }

        public string? City { get; set; }

        public string? State { get; set; }

        public string? PinCode { get; set; }
    }
    public class InvitationResponseDto
        {
            public int InvitationId { get; set; }
            public int CompanyId { get; set; }
            public string CompanyName { get; set; }
            public string RoleInCompany { get; set; }
            public Guid Token { get; set; }
            public DateTime ExpiresAt { get; set; }
            public string InvitedByName { get; set; }
        }

        public class CheckUserExistsResponseDto
        {
            public bool Exists { get; set; }
            public int? UserId { get; set; }
            public string FullName { get; set; }
        }

        public class CustomerRegisterDto
        {
            public string FullName { get; set; }
            public string Email { get; set; }
            public string MobileNumber { get; set; }
            public string Password { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
        }
    public class CustomerLoginRequestDto
    {
        public string Email { get; set; }
        public string Password { get; set; }
    }
    public class CustomerLoginResponseDto
        {
            public int CustomerPortalId { get; set; }
            public string FullName { get; set; }
            public string Email { get; set; }
            public string Token { get; set; }
            public string RedirectUrl { get; set; }
        }

        public class CustomerDashboardDto
        {
            public CustomerProfileDto Profile { get; set; }
            public List<CustomerMenuDto> Menus { get; set; }
        }

        public class CustomerProfileDto
        {
            public int CustomerPortalId { get; set; }
            public string FullName { get; set; }
            public string Email { get; set; }
            public string MobileNumber { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
        }

        public class CustomerMenuDto
        {
            public int MenuId { get; set; }
            public string MenuName { get; set; }
            public string MenuPath { get; set; }
            public string Icon { get; set; }
        }

        // Extended LoginResponseDto to include companies
        public class ExtendedLoginResponseDto : LoginResponseDto
        {
            public List<CompanyResponseDto> Companies { get; set; }
    }
    public class CreateCompanyDto
    {
        public string CompanyName { get; set; }
        public string CompanyCode { get; set; }
        public string Address { get; set; }
        public string City { get; set; }
        public string State { get; set; }
        public string PinCode { get; set; }
        public string PhoneNumber { get; set; }
        public string Email { get; set; }
    }
    public class CompanyUserDetailDto
    {
        public int CompanyUserId { get; set; }
        public int UserId { get; set; }
        public string FullName { get; set; }
        public string Email { get; set; }
        public string MobileNumber { get; set; }
        public string RoleInCompany { get; set; }
        public DateTime AssignedAt { get; set; }
        public string AssignedBy { get; set; }
        public bool IsActive { get; set; }
    }

    public class UpdateUserRoleDto
    {
        public int UserId { get; set; }
        public string NewRole { get; set; }
    }

    public class InvitationDetailDto
    {
        public int InvitationId { get; set; }
        public string Email { get; set; }
        public string RoleInCompany { get; set; }
        public string Status { get; set; }
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string CreatedByName { get; set; }
    }

    public class JoinRequestDto
    {
        public int RequestId { get; set; }
        public int UserId { get; set; }
        public string UserName { get; set; }
        public string UserEmail { get; set; }
        public string MobileNumber { get; set; }
        public string RequestedRole { get; set; }
        public string Remarks { get; set; }
        public DateTime RequestedAt { get; set; }
        public string Status { get; set; }
    }

    public class CreateJoinRequestDto
    {
        public int CompanyId { get; set; }
        public string RequestedRole { get; set; }
        public string Remarks { get; set; }
    }

    public class CompanyInfoDto
    {
        public int CompanyId { get; set; }
        public string CompanyName { get; set; }
        public string CompanyCode { get; set; }
        public string City { get; set; }
        public string UserStatus { get; set; } // Member, Requested, Available
    }
    // DTOs/CompanyManagementDtos.cs - ADD THESE

    namespace EncryptzBL.DTO_s
    {
        // Existing DTOs...

        public class MyJoinRequestDto
        {
            public int RequestId { get; set; }
            public int CompanyId { get; set; }
            public string CompanyName { get; set; }
            public string RequestedRole { get; set; }
            public string Remarks { get; set; }
            public DateTime RequestedAt { get; set; }
            public string Status { get; set; }
        }

        public class UpdateUserRoleDto
        {
            public string NewRole { get; set; }
        }

        public class InviteUserRequestDto
        {
            public string Email { get; set; }
            public string RoleInCompany { get; set; }
            public string Remarks { get; set; }
        }

        public class CreateJoinRequestDto
        {
            public int CompanyId { get; set; }
            public string RequestedRole { get; set; }
            public string Remarks { get; set; }
        }

        public class CreateCompanyDto
        {
            public string CompanyName { get; set; }
            public string CompanyCode { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
            public string State { get; set; }
            public string PinCode { get; set; }
            public string PhoneNumber { get; set; }
            public string Email { get; set; }
        }
        public class CustomerRegister_Dto
        {
            public string FullName { get; set; }
            public string Email { get; set; }
            public string MobileNumber { get; set; }
            public string PasswordHash { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
            public string State { get; set; }
            public string PinCode { get; set; }
            public int? CompanyId { get; set; }
        }

        public class CustomerLogin_Dto
        {
            public string Email { get; set; }
            public string Password { get; set; }
        }

        public class CustomerLoginResponse_Dto
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public Customer_DTO Customer { get; set; }
            public List<CustomerMenu_Dto> Menus { get; set; }
            public string Token { get; set; }
        }

        public class Customer_DTO
        {
            public int UserId { get; set; }
            public int CustomerId { get; set; }
            public string FullName { get; set; }
            public string Email { get; set; }
            public string MobileNumber { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
            public string State { get; set; }
            public string PinCode { get; set; }
            public decimal? Latitude { get; set; }
            public decimal? Longitude { get; set; }
            public int RoleId { get; set; }
            public string RoleName { get; set; }
            public bool IsActive { get; set; }
            public int? CompanyId { get; set; }
            public DateTime CreatedAt { get; set; }
            public string PasswordHash { get; set; }
        }

        public class CustomerMenu_Dto
        {
            public int MenuId { get; set; }
            public string MenuName { get; set; }
            public string MenuPath { get; set; }
            public string Icon { get; set; }
            public int? ParentMenuId { get; set; }
            public int SortOrder { get; set; }
            public bool CanView { get; set; }
            public bool CanCreate { get; set; }
            public bool CanEdit { get; set; }
            public bool CanDelete { get; set; }
        }

        public class CustomerProfileUpdate_Dto
        {
            public string FullName { get; set; }
            public string Email { get; set; }
            public string Address { get; set; }
            public string City { get; set; }
            public string State { get; set; }
            public string PinCode { get; set; }
            public decimal? Latitude { get; set; }
            public decimal? Longitude { get; set; }
        }

        public class DashboardStats_Dto
        {
            public int TotalComplaints { get; set; }
            public int ActiveComplaints { get; set; }
            public int ResolvedComplaints { get; set; }
            public int TotalProducts { get; set; }
            public int ActiveWarrantyProducts { get; set; }
            public int ExpiredWarrantyProducts { get; set; }
        }

        public class DashboardResponse_Dto
        {
            public DashboardStats_Dto Stats { get; set; }
            public List<RecentComplaint_Dto> RecentComplaints { get; set; }
        }

        public class RecentComplaint_Dto
        {
            public int ComplaintId { get; set; }
            public string ComplaintNumber { get; set; }
            public string Subject { get; set; }
            public string Priority { get; set; }
            public int StatusId { get; set; }
            public string StatusName { get; set; }
            public string StatusColor { get; set; }
            public DateTime CreatedAt { get; set; }
            public int HoursSinceCreated { get; set; }
            public string AssignedTechnicianName { get; set; }
        }

        public class Product_Dto
        {
            public int ProductId { get; set; }
            public string ProductName { get; set; }
            public string SerialNumber { get; set; }
            public string ModelNumber { get; set; }
            public string Brand { get; set; }
            public string Category { get; set; }
            public DateTime? PurchaseDate { get; set; }
            public DateTime? WarrantyExpiryDate { get; set; }
            public bool IsUnderWarranty { get; set; }
            public bool IsActive { get; set; }
            public int TotalComplaints { get; set; }
        }

        public class ProductCreate_Dto
        {
            public string ProductName { get; set; }
            public string SerialNumber { get; set; }
            public string Brand { get; set; }
            public string Model { get; set; }
            public DateTime? PurchaseDate { get; set; }
            public DateTime? WarrantyExpiryDate { get; set; }
            public int? ProductMasterId { get; set; }
        }
        // DTO
        public class TechProductivityDto
        {
            public int TechnicianId { get; set; }
            public string TechnicianName { get; set; } = "";
            public string? Specialization { get; set; }
            public int TotalAssignments { get; set; }
            public int CompletedAssignments { get; set; }
            public int PendingAssignments { get; set; }
            public decimal CompletionRate { get; set; }
            public decimal TotalWorkHours { get; set; }
            public decimal AvgResolutionHours { get; set; }
            public decimal TotalDistanceKm { get; set; }
            public int SparePartsUsed { get; set; }
            public decimal CustomerRating { get; set; }
        }
        public class RegisterResponse_Dto
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public int? UserId { get; set; }
            public int? CustomerId { get; set; }
        }
        public class ProductMaster
        {
            public int ProductMasterId { get; set; }
            public string? ProductCode { get; set; }
            public string? ProductName { get; set; }
            public string? Brand { get; set; }
            public string? Category { get; set; }
            public string? SubCategory { get; set; }
            public string? Model { get; set; }
            public string? Description { get; set; }
            public decimal? MRP { get; set; }
            public string? Org { get; set; }
            public string? PriceChangeStatus { get; set; }
            public DateTime? PriceEffectiveDate { get; set; }
            public int? WarrantyMonths { get; set; }
            public bool IsActive { get; set; }
            public DateTime? CreatedDate { get; set; }
            public DateTime? UpdatedDate { get; set; }
        }

        // ProductMasterRequestDto.cs
        public class ProductMasterRequestDto
        {
            public int? ProductMasterId { get; set; }
            public string? ProductCode { get; set; }
            public string? ProductName { get; set; }
            public string? Brand { get; set; }
            public string? Category { get; set; }
            public string? SubCategory { get; set; }
            public string? Model { get; set; }
            public string? Description { get; set; }
            public decimal? MRP { get; set; }
            public string? Org { get; set; }
            public string? PriceChangeStatus { get; set; }
            public DateTime? PriceEffectiveDate { get; set; }
            public int? WarrantyMonths { get; set; }
            public bool? IsActive { get; set; }
            public string? SearchTerm { get; set; }
            public int PageNumber { get; set; } = 1;
            public int PageSize { get; set; } = 20;
            public string? SortColumn { get; set; } = "ProductMasterId";
            public string? SortDirection { get; set; } = "DESC";
        }

        // DropdownItemDto.cs
        public class DropdownItemDto
        {
            public string? Value { get; set; }
            public string? Label { get; set; }
        }

        // DropdownDataDto.cs
        public class DropdownDataDto
        {
            public List<DropdownItemDto> Categories { get; set; } = new();
            public List<DropdownItemDto> SubCategories { get; set; } = new();
            public List<DropdownItemDto> Brands { get; set; } = new();
            public List<DropdownItemDto> Orgs { get; set; } = new();
        }

        // PaginatedResult.cs
        public class PaginatedResult<T>
        {
            public List<T> Items { get; set; } = new();
            public int TotalCount { get; set; }
            public int CurrentPage { get; set; }
            public int TotalPages { get; set; }
            public int PageSize { get; set; }
        }
        public class QuickComplaintRequest_Dto
        {
            public string Subject { get; set; }
            public string Category { get; set; }
            public string BrandName { get; set; }
            public string ModelNumber { get; set; }
            public string Description { get; set; }
            public decimal? Latitude { get; set; }
            public decimal? Longitude { get; set; }
            public string LocationName { get; set; }
            public string ImageBase64 { get; set; }  // Base64 string
            public string ImageName { get; set; }
            public string ContentType { get; set; }
        }
        // Models/ComplaintDetailModels.cs - Fixed Version

            // ============================================
            // Request Models - ALL PROPERTIES OPTIONAL
            // ============================================

            public class ManageComplaintRequestModel
            {
                [Required]
                public string OperationType { get; set; }

                // Common
                public int? ComplaintId { get; set; }
                public int? UserId { get; set; }

                // Complaint fields (all nullable)
                public string Subject { get; set; }
                public string Description { get; set; }
                public string Priority { get; set; }
                public string Category { get; set; }
                public string BrandName { get; set; }
                public string ModelNumber { get; set; }
                public DateTime? PreferredDate { get; set; }
                public string PreferredTimeSlot { get; set; }
                public decimal? Latitude { get; set; }
                public decimal? Longitude { get; set; }
                public string LocationAddress { get; set; }
                public string LocationName { get; set; }

                // Customer fields (all nullable)
                public int? CustomerId { get; set; }
                public string CustomerName { get; set; }
                public string CustomerEmail { get; set; }
                public string CustomerMobile { get; set; }
                public string AlternatePhone { get; set; }
                public string CustomerAddress { get; set; }
                public string City { get; set; }
                public string State { get; set; }
                public string PinCode { get; set; }
                public string Landmark { get; set; }
                public decimal? CustomerLatitude { get; set; }
                public decimal? CustomerLongitude { get; set; }

                // Product fields (all nullable)
                public int? ProductId { get; set; }
                public string ProductName { get; set; }
                public string SerialNumber { get; set; }
                public string ProductModelNumber { get; set; }
                public string ProductBrand { get; set; }
                public string ProductCategory { get; set; }
                public DateTime? PurchaseDate { get; set; }
                public DateTime? WarrantyExpiryDate { get; set; }

                // Assignment fields (all nullable)
                public int? AssignmentId { get; set; }
                public int? TechnicianId { get; set; }
                public string AssignmentRole { get; set; }
                public string AssignmentNotes { get; set; }
                public DateTime? ScheduledDate { get; set; }
                public string StartTime { get; set; }
                public string EndTime { get; set; }
                public int? EstimatedDuration { get; set; }
                public string WorkDone { get; set; }
                public string PartsUsed { get; set; }
                public string CompletionRemarks { get; set; }

                // Spare part fields (all nullable)
                public int? SpareRequestId { get; set; }
                public int? SparePartId { get; set; }
                public int? SpareQuantity { get; set; }
                public string SpareUrgency { get; set; }
                public string SpareRemarks { get; set; }
                public string SpareStatus { get; set; }

                // Comment fields (all nullable)
                public int? CommentId { get; set; }
                public string CommentText { get; set; }
                public bool? IsInternal { get; set; }
            }

            public class UpdateComplaintRequestModel
            {
                public string Subject { get; set; }
                public string Description { get; set; }
                public string Priority { get; set; }
                public string Category { get; set; }
                public string BrandName { get; set; }
                public string ModelNumber { get; set; }
                public DateTime? PreferredDate { get; set; }
                public string PreferredTimeSlot { get; set; }
            }

            public class UpdateCustomerRequestModel
            {
                public string CustomerName { get; set; }
                public string CustomerEmail { get; set; }
                public string CustomerMobile { get; set; }
                public string AlternatePhone { get; set; }
                public string CustomerAddress { get; set; }
                public string City { get; set; }
                public string State { get; set; }
                public string PinCode { get; set; }
                public string Landmark { get; set; }
                public decimal? CustomerLatitude { get; set; }
                public decimal? CustomerLongitude { get; set; }
            }

            public class UpdateProductRequestModel
            {
                public string ProductName { get; set; }
                public string SerialNumber { get; set; }
                public string ProductModelNumber { get; set; }
                public string ProductBrand { get; set; }
                public string ProductCategory { get; set; }
                public DateTime? PurchaseDate { get; set; }
                public DateTime? WarrantyExpiryDate { get; set; }
            }

            public class UpdateLocationRequestModel
            {
                public decimal? Latitude { get; set; }
                public decimal? Longitude { get; set; }
                public string LocationAddress { get; set; }
                public string LocationName { get; set; }
            }

            public class AssignTechnicianRequestModel
            {
                [Required]
                public int ComplaintId { get; set; }
                [Required]
                public int TechnicianId { get; set; }
                public string AssignmentRole { get; set; }
                public string AssignmentNotes { get; set; }
                public DateTime? ScheduledDate { get; set; }
                public string StartTime { get; set; }
                public string EndTime { get; set; }
                public int? EstimatedDuration { get; set; }
                public string Priority { get; set; }
            }

        public class UpdateAssignmentRequestModel
        {
            public int? TechnicianId { get; set; }   // <-- ADD THIS LINE
            public string AssignmentRole { get; set; }
            public string AssignmentNotes { get; set; }
            public DateTime? ScheduledDate { get; set; }
            public string StartTime { get; set; }
            public string EndTime { get; set; }
            public int? EstimatedDuration { get; set; }
            public string Priority { get; set; }
            public string WorkDone { get; set; }
            public string PartsUsed { get; set; }
            public string CompletionRemarks { get; set; }
        }
        public class AddSparePartRequestModel
            {
                [Required]
                public int ComplaintId { get; set; }
                [Required]
                public int SparePartId { get; set; }
                [Required]
                public int TechnicianId { get; set; }
                public int? SpareQuantity { get; set; }
                public string SpareUrgency { get; set; }
                public string SpareRemarks { get; set; }
            }

            public class UpdateSparePartRequestModel
            {
                public int? SpareQuantity { get; set; }
                public string SpareUrgency { get; set; }
                public string SpareRemarks { get; set; }
                public string SpareStatus { get; set; }
            }

            public class AddCommentRequestModel
            {
                [Required]
                public int ComplaintId { get; set; }
                [Required]
                public string CommentText { get; set; }
                public bool? IsInternal { get; set; }
            }

            public class UpdateCommentRequestModel
            {
                [Required]
                public string CommentText { get; set; }
            }

            // ============================================
            // Response Models (No changes needed)
            // ============================================

            public class ComplaintDetailResponseModel
            {
                public ComplaintResponseModel Complaint { get; set; }
                public CustomerResponseModel Customer { get; set; }
                public ProductResponseModel Product { get; set; }
                public List<AssignmentResponseModel> Assignments { get; set; }
                public List<SparePartResponseModel> SpareParts { get; set; }
                public List<CommentResponseModel> Comments { get; set; }
                public List<SparePartDropdownModel> SparePartsDropdown { get; set; }
                public List<TechnicianDropdownModel> TechniciansDropdown { get; set; }
            }

            public class ComplaintResponseModel
            {
                public int ComplaintId { get; set; }
                public string ComplaintNumber { get; set; }
                public string Subject { get; set; }
                public string Description { get; set; }
                public DateTime CreatedAt { get; set; }
                public DateTime? UpdatedAt { get; set; }
                public string Priority { get; set; }
                public int PriorityId { get; set; }
                public int StatusId { get; set; }
                public string StatusName { get; set; }
                public string StatusColor { get; set; }
                public bool IsSLABreached { get; set; }
                public DateTime? SLADeadline { get; set; }
                public string ContactNumber { get; set; }
                public DateTime? PreferredDate { get; set; }
                public string PreferredTimeSlot { get; set; }
                public string Category { get; set; }
                public string BrandName { get; set; }
                public string ModelNumber { get; set; }
                public string LocationName { get; set; }
                public string LocationAddress { get; set; }
                public decimal? Latitude { get; set; }
                public decimal? Longitude { get; set; }
                public DateTime? ClosedAt { get; set; }
            }

            public class CustomerResponseModel
            {
                public int CustomerId { get; set; }
                public string CustomerName { get; set; }
                public string Email { get; set; }
                public string MobileNumber { get; set; }
                public string AlternatePhone { get; set; }
                public string Address { get; set; }
                public string City { get; set; }
                public string State { get; set; }
                public string PinCode { get; set; }
                public string Landmark { get; set; }
                public decimal? Latitude { get; set; }
                public decimal? Longitude { get; set; }
                public DateTime CreatedAt { get; set; }
                public DateTime? UpdatedAt { get; set; }
            }

            public class ProductResponseModel
            {
                public int ProductId { get; set; }
                public string ProductName { get; set; }
                public string SerialNumber { get; set; }
                public string ModelNumber { get; set; }
                public string Brand { get; set; }
                public string ProductCategory { get; set; }
                public DateTime? PurchaseDate { get; set; }
                public DateTime? WarrantyExpiryDate { get; set; }
                public string WarrantyStatus { get; set; }
                public DateTime CreatedAt { get; set; }
                public DateTime? UpdatedAt { get; set; }
            }

            public class AssignmentResponseModel
            {
                public int AssignmentId { get; set; }
                public int TechnicianId { get; set; }
                public string TechnicianName { get; set; }
                public string TechnicianPhone { get; set; }
                public string Specialization { get; set; }
                public string EmployeeCode { get; set; }
                public string Role { get; set; }
                public string Status { get; set; }
                public DateTime AssignedAt { get; set; }
                public DateTime? CompletedAt { get; set; }
                public DateTime? ScheduledDate { get; set; }
                public string StartTime { get; set; }
                public string EndTime { get; set; }
                public int? EstimatedDuration { get; set; }
                public string Notes { get; set; }
                public string Priority { get; set; }
                public string WorkDone { get; set; }
                public string PartsUsed { get; set; }
                public string CompletionRemarks { get; set; }
                public string AssignedByName { get; set; }
            }

            public class SparePartResponseModel
            {
                public int RequestId { get; set; }
                public int SparePartId { get; set; }
                public string PartName { get; set; }
                public string PartNumber { get; set; }
                public decimal? UnitPrice { get; set; }
                public int Quantity { get; set; }
                public string Status { get; set; }
                public string UrgencyLevel { get; set; }
                public DateTime RequestedAt { get; set; }
                public DateTime? ApprovedAt { get; set; }
                public string Remarks { get; set; }
                public string TechnicianName { get; set; }
                public int TechnicianId { get; set; }
                public string ApprovedByName { get; set; }
            }

            public class CommentResponseModel
            {
                public int CommentId { get; set; }
                public string Comment { get; set; }
                public string PostedByRole { get; set; }
                public string PostedBy { get; set; }
                public DateTime PostedAt { get; set; }
                public bool IsInternal { get; set; }
            }

            public class SparePartDropdownModel
            {
                public int SparePartId { get; set; }
                public string PartName { get; set; }
                public string PartNumber { get; set; }
                public int StockQuantity { get; set; }
                public decimal? UnitPrice { get; set; }
            }

            public class TechnicianDropdownModel
            {
                public int TechnicianId { get; set; }
                public string TechnicianName { get; set; }
                public string Specialization { get; set; }
                public int AvailabilityStatus { get; set; }
                public string EmployeeCode { get; set; }
        }

        public class OperationResultModel
        {
            public bool Success { get; set; }
            public string Message { get; set; }
            public int? AssignmentId { get; set; }
            public int? CommentId { get; set; }
            public int? RequestId { get; set; }
        }
        public class SparePart_Model
        {
            public int SparePartId { get; set; }
            public string PartName { get; set; }
            public string PartNumber { get; set; }
            public int StockQuantity { get; set; }
            public decimal? UnitPrice { get; set; }
            public bool IsActive { get; set; }
            public int? CompanyId { get; set; }
        }

        public class SparePartListResponse
        {
            public List<SparePart_Model> Items { get; set; }
            public int TotalCount { get; set; }
            public int CurrentPage { get; set; }
            public int TotalPages { get; set; }
            public int PageSize { get; set; }
        }

        public class SparePartRequest_Model
        {
            public int? SparePartId { get; set; }
            public string PartName { get; set; }
            public string PartNumber { get; set; }
            public int? StockQuantity { get; set; }
            public decimal? UnitPrice { get; set; }
            public bool? IsActive { get; set; }
            public int? CompanyId { get; set; }
        }

        public class SparePartFilter_Model
        {
            public string SearchTerm { get; set; }
            public bool? IsActive { get; set; }
            public int PageNumber { get; set; } = 1;
            public int PageSize { get; set; } = 20;
            public string SortBy { get; set; } = "SparePartId";
            public string SortOrder { get; set; } = "DESC";
        }

        public class SparePartDropdown_Model
        {
            public int SparePartId { get; set; }
            public string PartName { get; set; }
            public string PartNumber { get; set; }
            public int StockQuantity { get; set; }
        }
        public class RepairPartRequestCreateDto
        {
            public int ComplaintId { get; set; }
            public int AssignmentId { get; set; }
            public int TechnicianId { get; set; }
            public int? CustomerId { get; set; }
            public int? ProductId { get; set; }
            public string PartName { get; set; }
            public string PartSerialNumber { get; set; }
            public string Notes { get; set; }
        }
    }
}


