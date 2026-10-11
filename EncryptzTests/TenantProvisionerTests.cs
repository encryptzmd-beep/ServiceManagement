using EncryptzBL.Common.Provisioning;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    public class TenantProvisionerTests
    {
        private sealed class FakeStore : IProvisionStore
        {
            public ProvisionJob? Job = new()
            {
                CompanyId = 7, TenantScopeId = 1, FirstBranchName = "Head Office", Status = "Provisioning",
                ServerName = "srv", AdminUser = "creator", AdminPassword = "secret-pw", ExtraOptions = "", LookupSourceDb = ""
            };
            public bool CompleteAnswer = true;
            public Exception? CompleteThrows;
            public readonly List<string> Calls = new();
            public string? Error;

            public Task<ProvisionJob?> GetJobAsync(int companyId) { Calls.Add("get"); return Task.FromResult(Job); }
            public Task<bool> CompleteAsync(int companyId, string databaseName)
            {
                Calls.Add("complete:" + databaseName);
                if (CompleteThrows != null) throw CompleteThrows;
                return Task.FromResult(CompleteAnswer);
            }
            public Task FailAsync(int companyId, string error) { Calls.Add("fail"); Error = error; return Task.CompletedTask; }
            public Task<int> FailStuckAsync(int olderThanMinutes) => Task.FromResult(0);
        }

        private sealed class FakeServer : ITenantDatabaseServer
        {
            public bool Exists;
            public Exception? ExistsThrows, CreateThrows, BuildThrows, DropThrows;
            public readonly List<string> Calls = new();

            public Task<bool> DatabaseExistsAsync(ProvisionJob job, string databaseName, CancellationToken ct)
            {
                Calls.Add("exists:" + databaseName);
                if (ExistsThrows != null) throw ExistsThrows;
                return Task.FromResult(Exists);
            }
            public Task CreateDatabaseAsync(ProvisionJob job, string databaseName, CancellationToken ct)
            {
                Calls.Add("create:" + databaseName);
                if (CreateThrows != null) throw CreateThrows;
                return Task.CompletedTask;
            }
            public Task BuildTenantAsync(ProvisionJob job, string databaseName, CancellationToken ct)
            {
                Calls.Add("build:" + databaseName);
                if (BuildThrows != null) throw BuildThrows;
                ct.ThrowIfCancellationRequested();
                return Task.CompletedTask;
            }
            public Task DropDatabaseAsync(ProvisionJob job, string databaseName)
            {
                Calls.Add("drop:" + databaseName);
                if (DropThrows != null) throw DropThrows;
                return Task.CompletedTask;
            }
        }

        private const string Db = "EncryptzTenant_000007";

        private static (TenantProvisioner Provisioner, FakeStore Store, FakeServer Server) Make()
        {
            var store = new FakeStore();
            var server = new FakeServer();
            return (new TenantProvisioner(store, server, NullLogger<TenantProvisioner>.Instance), store, server);
        }

        [Fact]
        public async Task A_database_is_created_built_and_the_company_made_ready()
        {
            var (provisioner, store, server) = Make();

            var outcome = await provisioner.RunAsync(7, CancellationToken.None);

            Assert.Equal(ProvisionOutcome.Ready, outcome);
            Assert.Equal(new[] { "exists:" + Db, "create:" + Db, "build:" + Db }, server.Calls);
            Assert.Equal(new[] { "get", "complete:" + Db }, store.Calls);
        }

        [Theory]
        [InlineData("Ready")]
        [InlineData("Failed")]
        [InlineData("None")]
        [InlineData("")]
        public async Task A_company_that_is_not_being_set_up_is_left_alone(string status)
        {
            var (provisioner, store, server) = Make();
            store.Job = new ProvisionJob { CompanyId = 7, Status = status, ServerName = "srv", AdminUser = "u", AdminPassword = "p" };

            Assert.Equal(ProvisionOutcome.Skipped, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.Equal(new[] { "get" }, store.Calls);
        }

        [Fact]
        public async Task An_unknown_company_is_left_alone()
        {
            var (provisioner, store, server) = Make();
            store.Job = null;

            Assert.Equal(ProvisionOutcome.Skipped, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
        }

        [Theory]
        [InlineData("", "u", "p")]
        [InlineData("srv", "", "p")]
        [InlineData("srv", "u", "")]
        public async Task Without_a_usable_server_the_set_up_fails_and_nothing_is_touched(string serverName, string user, string password)
        {
            var (provisioner, store, server) = Make();
            store.Job = new ProvisionJob { CompanyId = 7, TenantScopeId = 1, Status = "Provisioning", ServerName = serverName, AdminUser = user, AdminPassword = password };

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.Contains("fail", store.Calls);
        }

        [Fact]
        public async Task A_database_that_already_exists_is_neither_dropped_nor_reused()
        {
            var (provisioner, store, server) = Make();
            server.Exists = true;

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Equal(new[] { "exists:" + Db }, server.Calls);
            Assert.Contains("already exists", store.Error);
        }

        [Fact]
        public async Task When_creating_fails_nothing_is_dropped()
        {
            var (provisioner, store, server) = Make();
            server.CreateThrows = new InvalidOperationException("CREATE DATABASE permission denied");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Contains("permission denied", store.Error);
        }

        [Fact]
        public async Task When_the_script_fails_the_database_of_this_attempt_is_dropped()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("Invalid object name 'dbo.Missing'");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Equal(new[] { "exists:" + Db, "create:" + Db, "build:" + Db, "drop:" + Db }, server.Calls);
            Assert.Contains("Invalid object name", store.Error);
            Assert.DoesNotContain(store.Calls, c => c.StartsWith("complete"));
        }

        [Fact]
        public async Task A_time_out_drops_the_database_and_is_recorded()
        {
            var (provisioner, store, server) = Make();
            using var cts = new CancellationTokenSource();
            cts.Cancel();

            // the existence check and the create do not observe the token in the fake; the build does
            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, cts.Token));
            Assert.Contains("drop:" + Db, server.Calls);
            Assert.Contains("timed out", store.Error);
        }

        [Fact]
        public async Task A_job_that_was_given_up_meanwhile_drops_its_database()
        {
            var (provisioner, store, server) = Make();
            store.CompleteAnswer = false;   // the sweeper marked the company Failed while the script ran

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("drop:" + Db, server.Calls);
        }

        [Fact]
        public async Task When_marking_ready_fails_the_database_is_dropped()
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("main database unreachable");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("drop:" + Db, server.Calls);
            Assert.Contains("fail", store.Calls);
        }

        [Fact]
        public async Task When_the_clean_up_fails_too_the_error_says_the_database_was_left_behind()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("script error");
            server.DropThrows = new InvalidOperationException("cannot drop");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("script error", store.Error);
            Assert.Contains(Db, store.Error);
            Assert.Contains("left on the server", store.Error);
        }

        [Fact]
        public async Task The_stored_error_never_contains_the_password_and_fits_the_column()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("Login failed; Password=secret-pw; " + new string('x', 5000));

            await provisioner.RunAsync(7, CancellationToken.None);

            Assert.DoesNotContain("secret-pw", store.Error);
            Assert.True(store.Error!.Length <= 2000);
        }

        [Fact]
        public async Task A_failure_while_recording_the_failure_does_not_escape()
        {
            var store = new ThrowingFailStore();
            var server = new FakeServer { BuildThrows = new InvalidOperationException("script error") };
            var provisioner = new TenantProvisioner(store, server, NullLogger<TenantProvisioner>.Instance);

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("drop:" + Db, server.Calls);
        }

        private sealed class ThrowingFailStore : IProvisionStore
        {
            public Task<ProvisionJob?> GetJobAsync(int companyId) => Task.FromResult<ProvisionJob?>(new ProvisionJob
            {
                CompanyId = 7, TenantScopeId = 1, Status = "Provisioning", ServerName = "srv", AdminUser = "u", AdminPassword = "p"
            });
            public Task<bool> CompleteAsync(int companyId, string databaseName) => Task.FromResult(true);
            public Task FailAsync(int companyId, string error) => throw new InvalidOperationException("main database unreachable");
            public Task<int> FailStuckAsync(int olderThanMinutes) => Task.FromResult(0);
        }
    }
}
