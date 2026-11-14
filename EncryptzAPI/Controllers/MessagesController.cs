using System.Security.Claims;
using EncryptzBL.Common;
using EncryptzBL.Common.Jobs;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Jobs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// Messages between a person (Job Portal) and a company (Job Consultancy). The person is the
    /// main-database user of the token; the company is the company of the token. Neither is ever
    /// a value of the request. On the company side the service decides on every call whether the
    /// company has Job Consultancy and the person may use it (HiringAccess): a refusal is a 403.
    /// </summary>
    [ApiController]
    [Route("api/messages")]
    [Authorize]
    public class MessagesController : ControllerBase
    {
        private readonly IMessagesService _messages;

        public MessagesController(IMessagesService messages) => _messages = messages;

        private int Caller() => MainIdentity.UserId(User);

        private int Company()
            => int.TryParse(User.FindFirst("CompanyId")?.Value, System.Globalization.NumberStyles.None,
                   System.Globalization.CultureInfo.InvariantCulture, out var id) ? id : 0;

        /// <summary>The name a message of the company is signed with: the user who writes it.</summary>
        private string SenderName() => User.FindFirst(ClaimTypes.Name)?.Value ?? "";

        private IActionResult Answer<T>(ApiResponse<T> result)
            => !result.Success && HiringAccess.IsRefusal(result.Message)
                ? StatusCode(StatusCodes.Status403Forbidden, result)
                : Ok(result);

        // ── the person (Job Portal) ───────────────────────────────────────────

        [HttpGet("me")]
        public async Task<IActionResult> GetMine()
            => Ok(await _messages.GetPersonConversations(Caller()));

        [HttpGet("me/unread")]
        public async Task<IActionResult> GetMyUnread()
            => Ok(await _messages.GetPersonUnread(Caller()));

        [HttpGet("me/{id:int}")]
        public async Task<IActionResult> GetMyConversation(int id)
            => Ok(await _messages.GetPersonConversation(Caller(), id));

        /// <summary>Write to the company of a job: the conversation with it (made when there is none).</summary>
        [HttpPost("me/start")]
        public async Task<IActionResult> StartMine([FromBody] StartPersonConversationRequest? req)
            => Ok(await _messages.StartPersonConversation(Caller(), req?.PostingId ?? 0));

        [HttpPost("me/{id:int}")]
        public async Task<IActionResult> SendMine(int id, [FromBody] SendMessageRequest? req)
            => Ok(await _messages.SendPersonMessage(Caller(), id, req ?? new SendMessageRequest()));

        [HttpPost("me/{id:int}/block")]
        public async Task<IActionResult> Block(int id, [FromBody] BlockConversationRequest? req)
            => Ok(await _messages.BlockConversation(Caller(), id, req?.Blocked ?? false));

        // ── the company (Job Consultancy) ─────────────────────────────────────

        [HttpGet("company")]
        public async Task<IActionResult> GetCompany()
            => Answer(await _messages.GetCompanyConversations(Caller(), Company()));

        [HttpGet("company/unread")]
        public async Task<IActionResult> GetCompanyUnread()
            => Answer(await _messages.GetCompanyUnread(Caller(), Company()));

        [HttpGet("company/{id:int}")]
        public async Task<IActionResult> GetCompanyConversation(int id)
            => Answer(await _messages.GetCompanyConversation(Caller(), Company(), id));

        /// <summary>Write to a person the company may reach (by CandidateKey, or by an application to one of its jobs).</summary>
        [HttpPost("company/start")]
        public async Task<IActionResult> StartCompany([FromBody] StartCompanyConversationRequest? req)
            => Answer(await _messages.StartCompanyConversation(Caller(), Company(), req?.CandidateKey, req?.PostingId, req?.ApplicationId));

        [HttpPost("company/{id:int}")]
        public async Task<IActionResult> SendCompany(int id, [FromBody] SendMessageRequest? req)
            => Answer(await _messages.SendCompanyMessage(Caller(), Company(), id, req ?? new SendMessageRequest(), SenderName()));
    }
}
