using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Wallet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EncryptzAPI.Controllers
{
    /// <summary>
    /// The credits and invites of the logged-in individual (main database). The user is always
    /// the main-database user of the token, never a value of the request.
    /// </summary>
    [ApiController]
    [Route("api/wallet")]
    [Authorize]
    public class WalletController : ControllerBase
    {
        private readonly IWalletService _wallet;

        public WalletController(IWalletService wallet) => _wallet = wallet;

        /// <summary>0 for anybody who is not a logged-in user of the main database: the service refuses 0.</summary>
        private int Caller() => MainIdentity.UserId(User);

        [HttpGet("balance")]
        public async Task<IActionResult> GetBalance() => Ok(await _wallet.GetBalance(Caller()));

        [HttpGet("ledger")]
        public async Task<IActionResult> GetLedger([FromQuery] int page = 1) => Ok(await _wallet.GetLedger(Caller(), page));

        [HttpGet("referrals")]
        public async Task<IActionResult> GetReferrals() => Ok(await _wallet.GetReferrals(Caller()));

        [HttpPost("referrals")]
        public async Task<IActionResult> Invite([FromBody] InviteFriendRequest? req) => Ok(await _wallet.Invite(Caller(), req?.Email));

        [HttpGet("offer")]
        public async Task<IActionResult> GetOffer() => Ok(await _wallet.GetOffer());

        [HttpGet("link")]
        public async Task<IActionResult> GetInviteLink() => Ok(await _wallet.GetInviteLink(Caller()));
    }
}
