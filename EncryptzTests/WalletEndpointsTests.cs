using System.Reflection;
using EncryptzAPI.Controllers;
using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Wallet;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Routing;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    /// <summary>The wallet service, its controller and the referral token of self-registration.</summary>
    public class WalletEndpointsTests
    {
        private sealed class FakeMail : IEmailService
        {
            public bool Throw;
            public Task SendEmailAsync(string to, string subject, string body, bool isHtml = true)
                => Throw ? throw new InvalidOperationException("smtp down") : Task.CompletedTask;
        }

        private static WalletService Svc()
        {
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                // never reached by a refusal
                ["ConnectionStrings:MainConnection"] = "Server=nowhere.invalid;Database=x;Connect Timeout=1"
            }).Build();
            return new WalletService(new MainDbHelper(config), new FakeMail(), config, NullLogger<WalletService>.Instance);
        }

        [Fact]
        public async Task Every_call_refuses_user_0()
        {
            var s = Svc();
            Assert.Equal("Sign in again", (await s.GetBalance(0)).Message);
            Assert.Equal("Sign in again", (await s.GetLedger(0, 1)).Message);
            Assert.Equal("Sign in again", (await s.GetReferrals(0)).Message);
            var invite = await s.Invite(0, "a@b.com");
            Assert.False(invite.Success);
            Assert.Equal("Sign in again", invite.Message);
            Assert.Equal("Sign in again", (await s.GetInviteLink(0)).Message);
        }

        [Fact]
        public async Task Invite_refuses_a_bad_email_before_the_database()
        {
            var r = await Svc().Invite(5, "not-an-email");
            Assert.False(r.Success);
            Assert.Equal("Enter a valid e-mail address", r.Message);
        }

        [Theory]
        [InlineData("GetBalance", typeof(HttpGetAttribute), "balance")]
        [InlineData("GetLedger", typeof(HttpGetAttribute), "ledger")]
        [InlineData("GetReferrals", typeof(HttpGetAttribute), "referrals")]
        [InlineData("Invite", typeof(HttpPostAttribute), "referrals")]
        [InlineData("GetOffer", typeof(HttpGetAttribute), "offer")]
        [InlineData("GetInviteLink", typeof(HttpGetAttribute), "link")]
        public void The_controller_needs_a_login(string action, Type verb, string template)
        {
            var t = typeof(WalletController);
            Assert.NotNull(t.GetCustomAttribute<AuthorizeAttribute>());
            Assert.Equal("api/wallet", t.GetCustomAttribute<RouteAttribute>()!.Template);
            var attr = (HttpMethodAttribute)t.GetMethod(action)!.GetCustomAttribute(verb)!;
            Assert.Equal(template, attr.Template);
        }

        [Fact]
        public void Self_register_dto_carries_the_token()
            => Assert.Equal(typeof(string), typeof(SelfRegisterDto).GetProperty("ReferralToken")!.PropertyType);

        [Fact]
        public void Self_register_dto_carries_the_inviter_key()
            => Assert.Equal(typeof(string), typeof(SelfRegisterDto).GetProperty("InviterKey")!.PropertyType);

        [Fact]
        public async Task A_failed_mail_still_saves_the_invite()
        {
            Assert.False(await WalletService.TrySend(new FakeMail { Throw = true }, "a@b.com", "s", "b", NullLogger.Instance));
            Assert.True(await WalletService.TrySend(new FakeMail(), "a@b.com", "s", "b", NullLogger.Instance));
        }
    }
}
