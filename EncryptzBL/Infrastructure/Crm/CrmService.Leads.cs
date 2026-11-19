using System.Data;
using EncryptzBL.Common;
using EncryptzBL.Common.Crm;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Notifications;
using Microsoft.Extensions.Logging;

namespace EncryptzBL.Infrastructure.Crm
{
    public sealed partial class CrmService
    {
        private const string LeadNotFound = "Lead not found";

        // ── leads ─────────────────────────────────────────────────────────────

        public Task<ApiResponse<PagedResult<LeadListDto>>> GetLeads(int userId, bool isManager, int companyId, LeadFilterDto f)
            => Guard(async () =>
            {
                f ??= new LeadFilterDto();
                var due = (f.Due ?? "").Trim();
                if (due.Length > 0)
                {
                    due = new[] { "Today", "Overdue", "Pending" }.FirstOrDefault(d => string.Equals(d, due, StringComparison.OrdinalIgnoreCase)) ?? "";
                    if (due.Length == 0) return ApiResponse<PagedResult<LeadListDto>>.Fail("Choose Today, Overdue or Pending");
                }
                var page = f.Page < 1 ? 1 : f.Page;
                var size = f.PageSize < 1 ? 25 : Math.Min(f.PageSize, 200);

                var dt = await GetDataTableAsync("crm.sp_Lead_List", new[]
                {
                    In("@CompanyId", companyId), In("@UserId", userId), In("@IsManager", isManager), In("@LocationId", LocationId),
                    In("@Search", f.Search), In("@Status", f.Status), In("@SourceId", f.SourceId), In("@OwnerUserId", f.OwnerUserId),
                    In("@From", f.From?.Date), In("@To", f.To?.Date), In("@Due", due.Length > 0 ? due : null),
                    In("@ClosedFrom", f.ClosedFrom?.Date), In("@ClosedTo", f.ClosedTo?.Date), In("@Page", page), In("@PageSize", size)
                });

                var items = dt.ToList<LeadListDto>();
                var total = items.Count > 0 ? items[0].TotalCount : 0;
                var pages = total == 0 ? 0 : (int)Math.Ceiling(total / (double)size);
                return ApiResponse<PagedResult<LeadListDto>>.Ok(new PagedResult<LeadListDto>(items, total, page, size, pages), "Success", total);
            });

        public Task<ApiResponse<LeadDetailDto>> GetLead(int userId, bool isManager, int companyId, int leadId)
            => Guard(async () =>
            {
                var lead = await ReadLead(userId, isManager, companyId, leadId);
                return lead == null ? ApiResponse<LeadDetailDto>.Fail(LeadNotFound) : ApiResponse<LeadDetailDto>.Ok(lead);
            });

        private async Task<LeadDetailDto?> ReadLead(int userId, bool isManager, int companyId, int leadId)
        {
            var lead = (await GetDataTableAsync("crm.sp_Lead_Get", new[]
            {
                In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId),
                In("@IsManager", isManager), In("@LocationId", LocationId)
            })).ToList<LeadDetailDto>().FirstOrDefault();
            if (lead == null) return null;

            lead.FollowUps = (await GetDataTableAsync("crm.sp_FollowUp_List", LeadScope(userId, isManager, companyId, leadId))).ToList<FollowUpDto>();
            lead.History = (await GetDataTableAsync("crm.sp_Lead_History", LeadScope(userId, isManager, companyId, leadId))).ToList<LeadHistoryDto>();
            lead.Quotations = (await GetDataTableAsync("crm.sp_Quotation_ListForLead", LeadScope(userId, isManager, companyId, leadId))).ToList<QuotationSummaryDto>();
            return lead;
        }

        private Microsoft.Data.SqlClient.SqlParameter[] LeadScope(int userId, bool isManager, int companyId, int leadId)
            => new[]
            {
                In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId),
                In("@IsManager", isManager), In("@LocationId", LocationId)
            };

        public Task<ApiResponse<int>> SaveLead(int userId, bool isManager, int companyId, LeadSaveDto dto)
            => Guard(async () =>
            {
                var problem = CrmRules.LeadProblem(dto);
                if (problem != null) return ApiResponse<int>.Fail(problem);

                // only a manager gives a new lead to someone else; the owner of an existing lead changes through Reassign
                var owner = isManager && dto.LeadId == 0 ? dto.OwnerUserId : null;

                var dt = await GetDataTableAsync("crm.sp_Lead_Save", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", dto.LeadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@LeadDate", dto.LeadDate.Date), In("@ContactName", dto.ContactName),
                    In("@Mobile", dto.Mobile), In("@Email", dto.Email), In("@Address", dto.Address), In("@City", dto.City),
                    In("@State", dto.State), In("@PinCode", dto.PinCode), In("@Landmark", dto.Landmark),
                    In("@LeadSourceId", dto.LeadSourceId), In("@ProductCategory", dto.ProductCategory),
                    In("@ModelRequirement", dto.ModelRequirement), In("@EstimatedQty", dto.EstimatedQty),
                    In("@ExpectedPurchaseDate", dto.ExpectedPurchaseDate?.Date), In("@OwnerUserId", owner),
                    In("@Priority", dto.Priority), In("@Remarks", dto.Remarks), In("@ProductMasterId", dto.ProductMasterId)
                });

                var answer = Answer(dt);
                if (answer.Success && dto.LeadId == 0 && owner.HasValue && owner.Value > 0 && owner.Value != userId)
                    await NotifyAssigned(isManager, userId, companyId, answer.Id, owner.Value);
                return ToResponse(answer);
            });

        public Task<ApiResponse<int>> ChangeStatus(int userId, bool isManager, int companyId, int leadId, StatusChangeDto dto)
            => Guard(async () =>
            {
                var lead = await ReadLead(userId, isManager, companyId, leadId);
                if (lead == null) return ApiResponse<int>.Fail(LeadNotFound);

                var problem = CrmRules.StatusChangeProblem(lead.Status, dto, isManager);
                if (problem != null) return ApiResponse<int>.Fail(problem);

                // the note of a Lost lead is its LostNote; any other note goes to the history
                var lost = dto.Status == "Lost";
                var dt = await GetDataTableAsync("crm.sp_Lead_SetStatus", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@Status", dto.Status), In("@LostReasonId", dto.LostReasonId),
                    In("@LostNote", lost ? dto.Note : null), In("@Note", lost ? null : dto.Note)
                });
                return ToResponse(Answer(dt));
            });

        public Task<ApiResponse<int>> Reassign(int userId, bool isManager, int companyId, int leadId, ReassignDto dto)
            => Guard(async () =>
            {
                if (!isManager) return ApiResponse<int>.Fail(ManagerOnly);
                if (dto == null || dto.OwnerUserId <= 0) return ApiResponse<int>.Fail("Choose a member of the sales team");

                var dt = await GetDataTableAsync("crm.sp_Lead_Reassign", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@NewOwnerUserId", dto.OwnerUserId)
                });

                var answer = Answer(dt);
                // "No change" is the literal message of crm.sp_Lead_Reassign (14_CRM.sql) when the owner is the same
                if (answer.Success && answer.Message != "No change" && dto.OwnerUserId != userId)
                    await NotifyAssigned(isManager, userId, companyId, leadId, dto.OwnerUserId);
                return ToResponse(answer);
            });

        public Task<ApiResponse<int>> AddFollowUp(int userId, bool isManager, int companyId, int leadId, FollowUpSaveDto dto)
            => Guard(async () =>
            {
                var problem = CrmRules.FollowUpProblem(dto);
                if (problem != null) return ApiResponse<int>.Fail(problem);

                // the procedure moves a New lead to Contacted (CrmRules.AutoStatusAfterFollowUp)
                var dt = await GetDataTableAsync("crm.sp_FollowUp_Add", new[]
                {
                    In("@CompanyId", companyId), In("@LeadId", leadId), In("@UserId", userId), In("@IsManager", isManager),
                    In("@LocationId", LocationId), In("@FollowUpAt", dto.FollowUpAt), In("@Type", dto.Type), In("@Notes", dto.Notes),
                    In("@NextFollowUpAt", dto.NextFollowUpAt), In("@NextAction", dto.NextAction), In("@Remarks", dto.Remarks)
                });
                return ToResponse(Answer(dt));
            });

        // ── notification of the new owner ─────────────────────────────────────

        /// <summary>
        /// Tells the new owner "Lead LD-xxxx was assigned to you". Notifications are keyed by the main
        /// database user; the tenant user maps to it through dbo.Users.MainUserId. Never fails the caller.
        /// </summary>
        private async Task NotifyAssigned(bool isManager, int userId, int companyId, int leadId, int ownerUserId)
        {
            try
            {
                var mapped = await GetDataTableByQueryAsync(
                    "SELECT MainUserId FROM dbo.Users WHERE UserId = @UserId",
                    new[] { In("@UserId", ownerUserId) });
                if (mapped.Rows.Count == 0 || mapped.Rows[0]["MainUserId"] == DBNull.Value) return;

                var lead = (await GetDataTableAsync("crm.sp_Lead_Get", LeadScope(userId, isManager, companyId, leadId))).ToList<LeadDetailDto>().FirstOrDefault();
                if (lead == null) return;

                await _notifications.SendAsync(new[]
                {
                    new NotificationTarget(NotificationRules.ToUser, Convert.ToInt32(mapped.Rows[0]["MainUserId"]), companyId, "CRM",
                        "LeadAssigned", "Lead assigned", $"Lead {lead.LeadNo} was assigned to you", "/crm/leads/" + leadId)
                });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "CRM: notifying the new owner of lead {LeadId} failed ({ErrorType})", leadId, ex.GetType().Name);
            }
        }
    }
}
