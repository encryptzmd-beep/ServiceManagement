using System.Net;
using System.Reflection;
using System.Security.Claims;
using EncryptzAPI.Controllers;
using EncryptzAPI.Middleware;
using EncryptzAPI.Provisioning;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Provisioning;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace EncryptzTests
{
    public class CompanyCreationRateLimitTests
    {
        private static ClaimsPrincipal User(string? id)
            => id == null
                ? new ClaimsPrincipal(new ClaimsIdentity())
                : new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim(ClaimTypes.NameIdentifier, id) }, "test"));

        [Fact]
        public void A_logged_in_user_has_one_bucket_whatever_the_address()
        {
            var first = RateLimitPolicies.CompanyCreationKey(User("42"), IPAddress.Parse("10.0.0.1"));
            var second = RateLimitPolicies.CompanyCreationKey(User("42"), IPAddress.Parse("10.0.0.2"));

            Assert.Equal("u:42", first);
            Assert.Equal(first, second);
        }

        [Fact]
        public void Two_users_behind_one_address_have_a_bucket_each()
        {
            var address = IPAddress.Parse("10.0.0.1");

            Assert.NotEqual(
                RateLimitPolicies.CompanyCreationKey(User("42"), address),
                RateLimitPolicies.CompanyCreationKey(User("43"), address));
        }

        [Fact]
        public void Without_a_user_the_bucket_is_the_address()
        {
            Assert.Equal("ip:10.0.0.1", RateLimitPolicies.CompanyCreationKey(User(null), IPAddress.Parse("10.0.0.1")));
            Assert.Equal("ip:10.0.0.1", RateLimitPolicies.CompanyCreationKey(null, IPAddress.Parse("10.0.0.1")));
            Assert.Equal("ip:unknown", RateLimitPolicies.CompanyCreationKey(User(""), null));
        }

        /// <summary>
        /// The policy can only see the user when the rate limiter runs after authentication.
        /// Read from the source: the pipeline itself cannot be started in a test (it would
        /// read the real configuration).
        /// </summary>
        [Fact]
        public void The_rate_limiter_runs_after_authentication_and_after_cors()
        {
            var program = File.ReadAllText(Path.Combine(RepositoryRoot(), "EncryptzAPI", "Program.cs"));

            var cors = program.IndexOf("app.UseCors(", StringComparison.Ordinal);
            var authentication = program.IndexOf("app.UseAuthentication()", StringComparison.Ordinal);
            var limiter = program.IndexOf("app.UseRateLimiter()", StringComparison.Ordinal);
            var authorization = program.IndexOf("app.UseAuthorization()", StringComparison.Ordinal);

            Assert.True(cors >= 0 && authentication >= 0 && limiter >= 0 && authorization >= 0);
            Assert.True(cors < authentication);
            Assert.True(authentication < limiter);
            Assert.True(limiter < authorization);
        }

        private static string RepositoryRoot()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;

            return folder?.FullName ?? throw new Xunit.Sdk.XunitException("The repository root was not found");
        }
    }

    public class TenantScriptLoadingTests
    {
        private const string GoodScript =
            "CREATE TABLE #TenantSettings (CompanyId INT NOT NULL, ProjectId INT NOT NULL, LocationName NVARCHAR(200) NOT NULL, "
            + "LocationCode NVARCHAR(50) NULL, LocationCity NVARCHAR(100) NULL, CopyLookupsFrom SYSNAME NULL);\nGO\nSELECT 1;";

        [Fact]
        public void A_script_file_that_was_missing_once_is_read_again_at_the_next_attempt()
        {
            var folder = Path.Combine(Path.GetTempPath(), "encryptz-tests-" + Guid.NewGuid().ToString("N"));
            var path = Path.Combine(folder, "New_Tenant_Database.sql");

            try
            {
                var script = TenantScript.LoadLazily(path);

                Assert.ThrowsAny<IOException>(() => script.Value);
                Assert.ThrowsAny<IOException>(() => script.Value);

                Directory.CreateDirectory(folder);
                File.WriteAllText(path, GoodScript);

                Assert.Single(script.Value.Batches);          // read now
                Assert.Same(script.Value, script.Value);      // and kept from then on
            }
            finally
            {
                if (Directory.Exists(folder))
                    Directory.Delete(folder, true);
            }
        }

        [Fact]
        public void The_API_registers_the_script_so_that_a_failed_read_is_not_remembered()
        {
            var services = new ServiceCollection();
            EncryptzAPI.SrvInjection.ServiceRegistration.AddApplicationServices(services);

            var lazy = (Lazy<TenantScript>)services.Single(d => d.ServiceType == typeof(Lazy<TenantScript>)).ImplementationInstance!;

            // Lazy keeps its mode in a non-public member; ask it the only way there is
            var mode = typeof(Lazy<TenantScript>)
                .GetProperty("Mode", BindingFlags.Instance | BindingFlags.NonPublic)?.GetValue(lazy);

            Assert.NotNull(mode);
            Assert.Equal(LazyThreadSafetyMode.PublicationOnly, mode);
        }
    }

    public class ProvisioningWorkerShutdownTests
    {
        /// <summary>Its first scope is asked for while the host stops, and that fails with something that is not a cancellation.</summary>
        private sealed class ScopesThatFailWhileStopping : IServiceScopeFactory
        {
            public readonly ManualResetEventSlim Entered = new(false);
            public readonly ManualResetEventSlim Release = new(false);

            public IServiceScope CreateScope()
            {
                Entered.Set();
                Release.Wait(TimeSpan.FromSeconds(30));
                throw new InvalidOperationException("the connection was closed while the host stopped");
            }
        }

        private sealed class Lines : ILogger<ProvisioningWorker>
        {
            public readonly List<(LogLevel Level, string Text)> Entries = new();

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                lock (Entries) Entries.Add((logLevel, formatter(state, exception)));
            }
        }

        [Fact]
        public async Task An_exception_while_the_host_is_stopping_does_not_fault_the_worker()
        {
            var scopes = new ScopesThatFailWhileStopping();
            var logger = new Lines();
            var worker = new ProvisioningWorker(new ProvisioningQueue(), scopes, logger);

            await worker.StartAsync(CancellationToken.None);
            Assert.True(scopes.Entered.Wait(TimeSpan.FromSeconds(30)));

            var stopping = worker.StopAsync(CancellationToken.None);   // cancels the stopping token, then waits for the worker
            scopes.Release.Set();
            await stopping;

            var execution = worker.ExecuteTask!;
            await Task.WhenAny(execution, Task.Delay(TimeSpan.FromSeconds(30)));

            Assert.True(execution.IsCompletedSuccessfully, "the worker faulted: " + execution.Exception?.GetBaseException().Message);
            lock (logger.Entries)
            {
                Assert.DoesNotContain(logger.Entries, e => e.Level >= LogLevel.Warning);
                Assert.Contains(logger.Entries, e => e.Level == LogLevel.Information && e.Text.Contains("stopping"));
            }
        }
    }

    public class CompanyCreationNotInstalledTests
    {
        /// <summary>A SqlException cannot be made in the open: built the way the client builds it.</summary>
        private static SqlException SqlError(int number)
        {
            const BindingFlags Hidden = BindingFlags.Instance | BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public;

            var errorType = typeof(SqlError);
            var constructor = errorType.GetConstructors(Hidden)
                .Where(c => c.GetParameters().Length > 0 && c.GetParameters()[0].ParameterType == typeof(int))
                .OrderBy(c => c.GetParameters().Length)
                .First();

            var arguments = constructor.GetParameters().Select((p, i) =>
                i == 0 ? number
                : p.ParameterType == typeof(string) ? ""
                : p.ParameterType.IsValueType ? Activator.CreateInstance(p.ParameterType)
                : null).ToArray();

            var error = constructor.Invoke(arguments);

            var collection = Activator.CreateInstance(typeof(SqlErrorCollection), true)!;
            typeof(SqlErrorCollection).GetMethod("Add", Hidden)!.Invoke(collection, new[] { error });

            var create = typeof(SqlException).GetMethods(Hidden)
                .First(m => m.Name == "CreateException" && m.GetParameters().Length == 2
                            && m.GetParameters()[0].ParameterType == typeof(SqlErrorCollection));

            return (SqlException)create.Invoke(null, new object?[] { collection, "16.00.0000" })!;
        }

        [Fact]
        public void A_missing_procedure_means_script_20_is_not_installed()
        {
            Assert.True(CompanyCreateRules.IsNotInstalled(SqlError(2812)));
        }

        [Theory]
        [InlineData(208)]     // invalid object name
        [InlineData(1205)]    // deadlock
        [InlineData(-2)]      // time-out
        [InlineData(18456)]   // login failed
        public void Any_other_database_error_is_not_swallowed(int number)
        {
            Assert.False(CompanyCreateRules.IsNotInstalled(SqlError(number)));
        }

        [Fact]
        public void Other_exceptions_are_not_swallowed()
        {
            Assert.False(CompanyCreateRules.IsNotInstalled(new InvalidOperationException("Could not find stored procedure")));
            Assert.False(CompanyCreateRules.IsNotInstalled(new TimeoutException()));
        }

        private sealed class Lines : ILogger
        {
            public readonly List<(LogLevel Level, string Text, Exception? Exception)> Entries = new();

            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel logLevel) => true;
            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
                => Entries.Add((logLevel, formatter(state, exception), exception));
        }

        [Fact]
        public async Task A_call_that_finds_no_procedure_gives_the_fallback_and_one_warning()
        {
            var logger = new Lines();

            var answer = await CompanyProvisioningService.WhenInstalledAsync<string>(
                () => throw SqlError(2812), () => "not available", logger, "sp_Company_Create");

            Assert.Equal("not available", answer);
            var entry = Assert.Single(logger.Entries);
            Assert.Equal(LogLevel.Warning, entry.Level);
            Assert.Contains("sp_Company_Create", entry.Text);
            Assert.Null(entry.Exception);
        }

        [Fact]
        public async Task A_call_that_works_gives_its_own_answer_and_logs_nothing()
        {
            var logger = new Lines();

            var answer = await CompanyProvisioningService.WhenInstalledAsync(
                () => Task.FromResult("created"), () => "not available", logger, "sp_Company_Create");

            Assert.Equal("created", answer);
            Assert.Empty(logger.Entries);
        }

        [Fact]
        public async Task Any_other_database_error_keeps_propagating()
        {
            var logger = new Lines();

            await Assert.ThrowsAsync<SqlException>(() => CompanyProvisioningService.WhenInstalledAsync<string>(
                () => throw SqlError(1205), () => "not available", logger, "sp_Company_Create"));
            await Assert.ThrowsAsync<InvalidOperationException>(() => CompanyProvisioningService.WhenInstalledAsync<string>(
                () => throw new InvalidOperationException("x"), () => "not available", logger, "sp_Company_Create"));

            Assert.Empty(logger.Entries);
        }
    }

    public class CompanyControllerCreateTests
    {
        private sealed class Recorder : ICompanyProvisioningService
        {
            public int? UserId;
            public bool? PlatformAdmin;

            public Task<ApiResponse<CompanyCreatedDto>> CreateCompany(CreateCompanyRequest req, int userId, bool isPlatformAdmin)
            {
                UserId = userId;
                PlatformAdmin = isPlatformAdmin;
                return Task.FromResult(ApiResponse<CompanyCreatedDto>.Fail("Please log in again"));
            }

            public Task<ApiResponse<bool>> RetryProvision(int companyId, int userId, bool isPlatformAdmin) => throw new NotSupportedException();
            public Task<ApiResponse<CompanyCreationStateDto>> GetCreationState(int userId, bool isPlatformAdmin) => throw new NotSupportedException();
        }

        private static async Task<Recorder> Create(params Claim[] claims)
        {
            var recorder = new Recorder();
            var controller = new CompanyController(null!, recorder)
            {
                ControllerContext = new ControllerContext
                {
                    HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test")) }
                }
            };

            var result = await controller.CreateCompany(new CreateCompanyDto { CompanyName = "Acme", CompanyCode = "ACME" });

            Assert.IsType<OkObjectResult>(result);
            return recorder;
        }

        [Theory]
        [InlineData("abc")]
        [InlineData("")]
        [InlineData("12abc")]
        [InlineData("99999999999999999999")]
        public async Task A_user_id_that_is_not_a_number_is_no_user_and_no_error(string claim)
        {
            var recorder = await Create(new Claim(ClaimTypes.NameIdentifier, claim));

            Assert.Equal(0, recorder.UserId);
        }

        [Fact]
        public async Task Without_the_claim_there_is_no_user()
        {
            Assert.Equal(0, (await Create()).UserId);
        }

        [Fact]
        public async Task The_user_id_of_the_token_is_passed_on()
        {
            var recorder = await Create(new Claim(ClaimTypes.NameIdentifier, "42"), new Claim("PlatformAdmin", "true"));

            Assert.Equal(42, recorder.UserId);
            Assert.True(recorder.PlatformAdmin);
        }
    }
}
