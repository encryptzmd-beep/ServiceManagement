using EncryptzBL.Common.Provisioning;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    public class TenantProvisionerTests
    {
        private static readonly Guid Attempt = Guid.Parse("11111111-2222-3333-4444-555555555555");

        private sealed class FakeStore : IProvisionStore
        {
            public ProvisionJob? Job = new()
            {
                CompanyId = 7, Attempt = TenantProvisionerTests.Attempt, TenantScopeId = 1, FirstBranchName = "Head Office",
                ServerName = "srv", AdminUser = "creator", AdminPassword = "secret-pw", ExtraOptions = "", LookupSourceDb = ""
            };
            public bool CompleteAnswer = true;
            public Exception? BeginThrows, CompleteThrows, AbandonThrows, FailThrows;
            /// <summary>The answer of sp_Provision_Abandon: by default the job was still this attempt's and nobody names the database.</summary>
            public AbandonResult? Abandon = new(true, "Failed", TenantProvisionerTests.Attempt, "", false);
            public readonly List<string> Calls = new();
            public readonly List<Guid> Attempts = new();
            public string? Error;
            /// <summary>Shared with the server when a test needs the order across both.</summary>
            public List<string>? Timeline;

            public Task<ProvisionJob?> BeginAsync(int companyId)
            {
                Calls.Add("begin");
                if (BeginThrows != null) throw BeginThrows;
                return Task.FromResult(Job);
            }
            public Task<bool> CompleteAsync(ProvisionJob job, string databaseName)
            {
                Calls.Add("complete:" + databaseName);
                Attempts.Add(job.Attempt);
                if (CompleteThrows != null) throw CompleteThrows;
                return Task.FromResult(CompleteAnswer);
            }
            public Task FailAsync(ProvisionJob job, string error)
            {
                Calls.Add("fail");
                Timeline?.Add("fail");
                Attempts.Add(job.Attempt);
                Error = error;
                if (FailThrows != null) throw FailThrows;
                return Task.CompletedTask;
            }
            public Task<AbandonResult?> AbandonAsync(ProvisionJob job, string databaseName)
            {
                Calls.Add("abandon:" + databaseName);
                Timeline?.Add("abandon:" + databaseName);
                Attempts.Add(job.Attempt);
                if (AbandonThrows != null) throw AbandonThrows;
                return Task.FromResult(Abandon);
            }
            public Task<int> FailStuckAsync(int olderThanMinutes) => Task.FromResult(0);
            public Task<IReadOnlyList<int>> GetQueuedAsync() => Task.FromResult<IReadOnlyList<int>>(Array.Empty<int>());
        }

        private sealed class FakeServer : ITenantDatabaseServer
        {
            public bool Exists;
            public Exception? EnsureThrows, ExistsThrows, CreateThrows, BuildThrows, DropThrows;
            public int EnsureCalls;
            /// <summary>Shared with the store when a test needs the order across both.</summary>
            public List<string>? Timeline;
            /// <summary>What was done on the server (EnsureReady touches no server and is counted apart).</summary>
            public readonly List<string> Calls = new();

            public void EnsureReady()
            {
                EnsureCalls++;
                if (EnsureThrows != null) throw EnsureThrows;
            }

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
                Timeline?.Add("drop:" + databaseName);
                if (DropThrows != null) throw DropThrows;
                return Task.CompletedTask;
            }
        }

        /// <summary>Keeps what was logged: the text and whether an exception object was handed over.</summary>
        private sealed class ListLogger : ILogger<TenantProvisioner>
        {
            public readonly List<string> Lines = new();
            public readonly List<Exception> Exceptions = new();

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                Lines.Add(formatter(state, exception));
                if (exception != null) Exceptions.Add(exception);
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
            Assert.Equal(new[] { "begin", "complete:" + Db }, store.Calls);
        }

        // A company that is unknown, not Provisioning (Ready, Failed, None) or already
        // claimed by another run: the store gives no job in all of these cases.
        [Fact]
        public async Task A_company_without_a_job_is_left_alone()
        {
            var (provisioner, store, server) = Make();
            store.Job = null;

            Assert.Equal(ProvisionOutcome.Skipped, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.Equal(new[] { "begin" }, store.Calls);
        }

        [Fact]
        public async Task When_another_run_already_has_the_job_nothing_is_touched_and_nothing_is_recorded()
        {
            var (provisioner, store, server) = Make();
            store.Job = null;   // sp_Provision_Begin claimed nothing: ProvisionAttempt was already set

            Assert.Equal(ProvisionOutcome.Skipped, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.DoesNotContain("fail", store.Calls);
            Assert.DoesNotContain(store.Calls, c => c.StartsWith("abandon"));
        }

        [Fact]
        public async Task A_job_for_another_company_is_refused_and_nothing_is_touched()
        {
            var (provisioner, store, server) = Make();
            store.Job = new ProvisionJob { CompanyId = 8, Attempt = Attempt, TenantScopeId = 1, ServerName = "srv", AdminUser = "u", AdminPassword = "p" };

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.Equal(new[] { "begin" }, store.Calls);
        }

        [Fact]
        public async Task When_the_job_cannot_be_claimed_nothing_is_touched()
        {
            var (provisioner, store, server) = Make();
            store.BeginThrows = new InvalidOperationException("main database unreachable");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);
            Assert.Equal(new[] { "begin" }, store.Calls);
        }

        [Theory]
        [InlineData("", "u", "p")]
        [InlineData("srv", "", "p")]
        [InlineData("srv", "u", "")]
        public async Task Without_a_usable_server_the_set_up_fails_and_nothing_is_touched(string serverName, string user, string password)
        {
            var (provisioner, store, server) = Make();
            store.Job = new ProvisionJob { CompanyId = 7, Attempt = Attempt, TenantScopeId = 1, ServerName = serverName, AdminUser = user, AdminPassword = password };

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
            Assert.Contains("was not touched", store.Error);
            Assert.DoesNotContain("may have been created", store.Error);
        }

        [Fact]
        public async Task When_the_existence_check_fails_nothing_is_created_and_nothing_is_dropped()
        {
            var (provisioner, store, server) = Make();
            server.ExistsThrows = new InvalidOperationException("Login failed for user 'creator'");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Equal(new[] { "exists:" + Db }, server.Calls);
            Assert.Contains("Login failed", store.Error);
            Assert.DoesNotContain("may have been created", store.Error);
        }

        [Fact]
        public async Task When_creating_fails_nothing_is_dropped()
        {
            var (provisioner, store, server) = Make();
            server.CreateThrows = new InvalidOperationException("CREATE DATABASE permission denied");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("build"));
            Assert.Contains("permission denied", store.Error);
            Assert.EndsWith(" The database " + Db + " may have been created; check the server before retrying.", store.Error);
        }

        [Fact]
        public async Task When_creating_is_cancelled_nothing_is_dropped_and_the_error_says_the_database_may_exist()
        {
            var (provisioner, store, server) = Make();
            server.CreateThrows = new OperationCanceledException();

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Contains("The set-up was cancelled or timed out.", store.Error);
            Assert.Contains("may have been created", store.Error);
            Assert.Contains(Db, store.Error);
        }

        [Fact]
        public async Task The_note_that_the_database_may_have_been_created_survives_truncation()
        {
            var (provisioner, store, server) = Make();
            server.CreateThrows = new InvalidOperationException(new string('x', 5000));

            await provisioner.RunAsync(7, CancellationToken.None);

            Assert.True(store.Error!.Length <= 2000);
            Assert.EndsWith(" The database " + Db + " may have been created; check the server before retrying.", store.Error);
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
            Assert.Equal("The set-up was cancelled or timed out.", store.Error);
        }

        [Fact]
        public async Task A_job_that_was_given_up_meanwhile_drops_its_database()
        {
            var (provisioner, store, server) = Make();
            store.CompleteAnswer = false;   // the sweeper marked the company Failed while the script ran and left the job with this attempt

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("drop:" + Db, server.Calls);
            Assert.Equal("The set-up was given up before it finished.", store.Error);
            Assert.Equal(new[] { "begin", "complete:" + Db, "abandon:" + Db, "fail" }, store.Calls);   // asked before the drop, released after it
        }

        // -- the clean-up drops by NAME: only after the main database answered that it may (sp_Provision_Abandon) --

        private const string LeftNote = " The database " + Db + " was left on the server.";
        private const string UsedNote = " The database " + Db + " was left on the server: another company uses it.";

        [Theory]
        [InlineData("Failed")]   // a platform administrator attached the generated name and switched it off
        [InlineData("Ready")]    // ... or attached it while this attempt was running
        public async Task When_the_company_names_this_database_it_is_not_dropped(string status)
        {
            var store = new FakeStore { CompleteAnswer = false, Abandon = new AbandonResult(false, status, Attempt, "encryptztenant_000007", false) };
            var server = new FakeServer();
            var logger = new ListLogger();

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("the company uses this database"));
            // never an instruction to remove a database the company uses
            Assert.DoesNotContain("remove", store.Error ?? "", StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("left on the server", store.Error ?? "");
        }

        [Fact]
        public async Task When_another_company_uses_the_database_it_is_not_dropped()
        {
            // a platform administrator attached the generated name to another company while the build ran
            var store = new FakeStore { Abandon = new AbandonResult(false, "Provisioning", Attempt, "", true) };
            var server = new FakeServer { BuildThrows = new InvalidOperationException("script error") };
            var logger = new ListLogger();

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal(new[] { "begin", "abandon:" + Db, "fail" }, store.Calls);   // the job is still released for a retry
            Assert.Equal("script error" + UsedNote, store.Error);
            Assert.DoesNotContain("remove", store.Error!, StringComparison.OrdinalIgnoreCase);
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("another company uses this database"));
        }

        [Fact]
        public async Task When_marking_ready_is_refused_because_another_company_uses_the_database_it_is_not_dropped()
        {
            var store = new FakeStore { CompleteAnswer = false, Abandon = new AbandonResult(false, "Provisioning", Attempt, "", true) };
            var server = new FakeServer();

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, new ListLogger()).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal("The set-up was given up before it finished." + UsedNote, store.Error);
        }

        [Fact]
        public async Task When_the_job_is_no_longer_this_attempts_the_database_is_not_dropped_and_the_note_is_stored()
        {
            var store = new FakeStore { CompleteAnswer = false, Abandon = new AbandonResult(false, "Provisioning", Guid.NewGuid(), "", false) };
            var server = new FakeServer();
            var logger = new ListLogger();

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal("The set-up was given up before it finished." + LeftNote, store.Error);
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("no longer this attempt's job"));
        }

        [Theory]
        [InlineData(true)]    // queued again or released: no attempt on the row
        [InlineData(false)]   // the company is gone
        public async Task Without_an_attempt_on_the_row_or_without_a_row_the_database_is_not_dropped(bool rowExists)
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("script error");
            store.Abandon = rowExists ? new AbandonResult(false, "Provisioning", null, "", false) : null;

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal("script error" + LeftNote, store.Error);
        }

        // whatever else the answer says: without MayDrop there is no drop
        [Theory]
        [InlineData("Provisioning", "", false)]
        [InlineData("Failed", "", false)]
        [InlineData("Failed", "", true)]
        [InlineData("None", "", false)]
        [InlineData("", "", false)]
        [InlineData("Ready", "CustomerDb", false)]
        [InlineData("Ready", "EncryptzTenant_000007", false)]
        [InlineData("Failed", "CustomerDb", true)]
        public async Task Without_the_answer_that_it_may_nothing_is_dropped(string status, string databaseOnRow, bool usedByAnother)
        {
            foreach (var completeThrows in new[] { false, true })
            foreach (var sameAttempt in new[] { false, true })
            {
                var store = new FakeStore
                {
                    CompleteAnswer = false,
                    CompleteThrows = completeThrows ? new InvalidOperationException("connection lost") : null,
                    Abandon = new AbandonResult(false, status, sameAttempt ? Attempt : Guid.NewGuid(), databaseOnRow, usedByAnother)
                };
                var server = new FakeServer();

                await new TenantProvisioner(store, server, new ListLogger()).RunAsync(7, CancellationToken.None);

                Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            }
        }

        [Fact]
        public async Task When_the_main_database_cannot_be_asked_the_database_is_not_dropped()
        {
            var store = new FakeStore { AbandonThrows = new InvalidOperationException("main database unreachable: Password=main-db-pw") };
            var server = new FakeServer { BuildThrows = new InvalidOperationException("script error") };
            var logger = new ListLogger();

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal("script error" + LeftNote, store.Error);
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("could not be asked"));
            Assert.Empty(logger.Exceptions);
            Assert.DoesNotContain(logger.Lines, line => line.Contains("main-db-pw"));
        }

        [Fact]
        public async Task The_main_database_is_asked_before_every_drop_and_the_job_is_released_after_it()
        {
            var timeline = new List<string>();
            var store = new FakeStore { Timeline = timeline };
            var server = new FakeServer { Timeline = timeline, BuildThrows = new InvalidOperationException("script error") };

            await new TenantProvisioner(store, server, new ListLogger()).RunAsync(7, CancellationToken.None);

            Assert.Equal(new[] { "abandon:" + Db, "drop:" + Db, "fail" }, timeline);
            Assert.Equal(new[] { "begin", "abandon:" + Db, "fail" }, store.Calls);
            Assert.Equal("script error", store.Error);   // dropped: nothing was left, no note
        }

        [Fact]
        public async Task The_note_that_the_database_was_left_survives_truncation()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException(new string('x', 5000));
            store.Abandon = new AbandonResult(false, "Provisioning", Guid.NewGuid(), "", false);

            await provisioner.RunAsync(7, CancellationToken.None);

            Assert.True(store.Error!.Length <= 2000);
            Assert.EndsWith(LeftNote, store.Error);
        }

        // -- the script is resolved before anything is created --

        [Fact]
        public async Task When_the_script_cannot_be_used_nothing_is_created_and_nothing_is_dropped()
        {
            var (provisioner, store, server) = Make();
            server.EnsureThrows = new InvalidOperationException("The tenant script must have exactly one settings batch");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Empty(server.Calls);                       // no existence check, no create, no drop
            Assert.Equal(new[] { "begin", "fail" }, store.Calls);
            Assert.Contains("settings batch", store.Error);
            Assert.DoesNotContain("may have been created", store.Error);
            Assert.DoesNotContain("left on the server", store.Error);
        }

        [Fact]
        public async Task The_script_is_checked_once_in_a_run_that_succeeds()
        {
            var (provisioner, _, server) = Make();

            Assert.Equal(ProvisionOutcome.Ready, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Equal(1, server.EnsureCalls);
        }

        // -- CompleteAsync throws: nobody knows whether the main database committed; sp_Provision_Abandon tells --

        [Fact]
        public async Task When_marking_ready_throws_but_the_company_is_ready_the_database_is_kept()
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("connection lost after the commit");
            store.Abandon = new AbandonResult(false, "Ready", Attempt, Db, false);

            Assert.Equal(ProvisionOutcome.Ready, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.DoesNotContain("fail", store.Calls);
            Assert.Equal(new[] { "begin", "complete:" + Db, "abandon:" + Db }, store.Calls);
        }

        [Fact]
        public async Task When_marking_ready_throws_and_the_company_is_ready_with_another_database_nothing_is_dropped_and_nothing_is_failed()
        {
            var store = new FakeStore
            {
                CompleteThrows = new InvalidOperationException("connection lost"),
                Abandon = new AbandonResult(false, "Ready", Attempt, "CustomerDb", false)   // attached by hand meanwhile
            };
            var server = new FakeServer();
            var logger = new ListLogger();

            Assert.Equal(ProvisionOutcome.Skipped, await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.DoesNotContain("fail", store.Calls);
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("ready with another database"));   // the extra database is an orphan
        }

        [Fact]
        public async Task When_marking_ready_throws_and_a_platform_administrator_then_switched_the_database_off_it_is_not_dropped()
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("connection lost after the commit");
            store.Abandon = new AbandonResult(false, "Failed", Attempt, Db, false);   // committed, then deactivated: the row names it

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.DoesNotContain("remove", store.Error ?? "", StringComparison.OrdinalIgnoreCase);
        }

        [Fact]
        public async Task When_marking_ready_throws_and_another_attempt_has_the_job_the_database_is_not_dropped()
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("main database unreachable");
            store.Abandon = new AbandonResult(false, "Provisioning", Guid.NewGuid(), "", false);

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.EndsWith(LeftNote, store.Error);
        }

        [Fact]
        public async Task When_marking_ready_throws_and_the_main_database_says_it_may_the_database_is_dropped()
        {
            var timeline = new List<string>();
            var store = new FakeStore
            {
                Timeline = timeline,
                CompleteThrows = new InvalidOperationException("main database unreachable"),
                Abandon = new AbandonResult(true, "Failed", Attempt, "", false)   // not committed: still this attempt's, nobody names the database
            };
            var server = new FakeServer { Timeline = timeline };

            Assert.Equal(ProvisionOutcome.Failed, await new TenantProvisioner(store, server, new ListLogger()).RunAsync(7, CancellationToken.None));
            Assert.Equal(new[] { "abandon:" + Db, "drop:" + Db, "fail" }, timeline);
            Assert.Equal("main database unreachable", store.Error);
        }

        [Theory]
        [InlineData("Provisioning")]
        [InlineData("Failed")]
        [InlineData("None")]
        [InlineData("")]
        public async Task When_marking_ready_throws_and_the_main_database_does_not_say_it_may_the_database_is_left_and_the_failure_recorded(string status)
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("main database unreachable");
            store.Abandon = new AbandonResult(false, status, Attempt, "", false);

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Contains("fail", store.Calls);
            Assert.Equal("main database unreachable" + LeftNote, store.Error);
        }

        [Fact]
        public async Task When_marking_ready_throws_and_another_company_uses_the_database_it_is_not_dropped()
        {
            var (provisioner, store, server) = Make();
            store.CompleteThrows = new InvalidOperationException("main database unreachable");
            store.Abandon = new AbandonResult(false, "Provisioning", Attempt, "", true);

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Equal("main database unreachable" + UsedNote, store.Error);
        }

        [Theory]
        [InlineData(true)]    // the main database cannot be asked
        [InlineData(false)]   // the company is gone
        public async Task When_marking_ready_throws_and_there_is_no_answer_the_database_is_kept_for_a_person_to_decide(bool abandonThrows)
        {
            var store = new FakeStore
            {
                CompleteThrows = new InvalidOperationException("main database unreachable"),
                AbandonThrows = abandonThrows ? new InvalidOperationException("main database unreachable") : null,
                Abandon = null
            };
            var server = new FakeServer();
            var logger = new ListLogger();
            var provisioner = new TenantProvisioner(store, server, logger);

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.DoesNotContain(server.Calls, c => c.StartsWith("drop"));
            Assert.Contains(logger.Lines, line => line.Contains("7") && line.Contains(Db) && line.Contains("was not removed"));
            // recorded only if the attempt still owns a company that waits for its database (sp_Provision_Fail decides)
            Assert.Equal("main database unreachable" + LeftNote, store.Error);
            Assert.DoesNotContain("remove", store.Error!, StringComparison.OrdinalIgnoreCase);
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
        public async Task The_note_about_a_database_left_on_the_server_survives_truncation()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException(new string('x', 5000));
            server.DropThrows = new InvalidOperationException("cannot drop");

            await provisioner.RunAsync(7, CancellationToken.None);

            Assert.True(store.Error!.Length <= 2000);
            Assert.Contains("left on the server", store.Error);
            Assert.Contains(Db, store.Error);
            Assert.EndsWith("remove it before retrying.", store.Error);
        }

        [Fact]
        public async Task Completing_and_failing_carry_the_attempt_that_was_claimed()
        {
            var (provisioner, store, server) = Make();
            await provisioner.RunAsync(7, CancellationToken.None);
            Assert.Equal(new[] { Attempt }, store.Attempts);

            (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("script error");
            await provisioner.RunAsync(7, CancellationToken.None);
            Assert.Equal(new[] { Attempt, Attempt }, store.Attempts);   // abandon, then fail

            (provisioner, store, server) = Make();
            store.CompleteAnswer = false;
            await provisioner.RunAsync(7, CancellationToken.None);
            Assert.Equal(new[] { Attempt, Attempt, Attempt }, store.Attempts);   // complete, abandon, then fail
        }

        [Fact]
        public async Task A_failure_while_recording_the_failure_does_not_escape()
        {
            var (provisioner, store, server) = Make();
            server.BuildThrows = new InvalidOperationException("script error");
            store.FailThrows = new InvalidOperationException("main database unreachable");

            Assert.Equal(ProvisionOutcome.Failed, await provisioner.RunAsync(7, CancellationToken.None));
            Assert.Contains("drop:" + Db, server.Calls);
        }

        [Fact]
        public async Task The_log_gets_the_scrubbed_reason_and_the_error_type_never_the_exception_or_the_password()
        {
            var store = new FakeStore
            {
                BeginThrows = null,
                FailThrows = new InvalidOperationException("fail: Password=secret-pw")
            };
            var server = new FakeServer
            {
                BuildThrows = new InvalidOperationException("Login failed; Password=secret-pw"),
                DropThrows = new TimeoutException("drop: Password=secret-pw")
            };
            var logger = new ListLogger();

            await new TenantProvisioner(store, server, logger).RunAsync(7, CancellationToken.None);

            Assert.Empty(logger.Exceptions);
            Assert.NotEmpty(logger.Lines);
            Assert.DoesNotContain(logger.Lines, line => line.Contains("secret-pw"));
            Assert.Contains(logger.Lines, line => line.Contains("Login failed") && line.Contains("InvalidOperationException"));
            Assert.Contains(logger.Lines, line => line.Contains("TimeoutException"));
        }

        [Fact]
        public async Task A_failure_to_claim_is_logged_without_the_exception()
        {
            var store = new FakeStore { BeginThrows = new InvalidOperationException("Server=x;Password=main-db-pw") };
            var logger = new ListLogger();

            await new TenantProvisioner(store, new FakeServer(), logger).RunAsync(7, CancellationToken.None);

            Assert.Empty(logger.Exceptions);
            Assert.DoesNotContain(logger.Lines, line => line.Contains("main-db-pw"));
            Assert.Contains(logger.Lines, line => line.Contains("InvalidOperationException"));
        }
    }
}
