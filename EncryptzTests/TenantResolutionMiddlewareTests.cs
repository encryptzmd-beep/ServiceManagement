using System.Security.Claims;
using EncryptzAPI.Middleware;
using EncryptzBL.Common.Tenant;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EncryptzTests
{
    public class TenantResolutionMiddlewareTests
    {
        private sealed class FakeResolver : IConnectionResolver
        {
            public List<string> Asked { get; } = new();
            public Exception? Throws { get; set; }

            public Task<string> GetServiceConnectionAsync(string projectKey)
            {
                Asked.Add(projectKey);
                if (Throws != null) throw Throws;
                return Task.FromResult("conn:" + projectKey);
            }

            public Task<ProjectScope?> GetProjectScopeAsync(string projectKey)
                => Task.FromResult(projectKey == "KNOWN"
                    ? new ProjectScope { ProjectKey = "KNOWN", CompanyId = 7, ProjectId = 3, DefaultLocationId = 9 }
                    : null);

            public void Evict(string projectKey) { }
        }

        private static async Task<(TenantContext Tenant, FakeResolver Resolver, HttpContext Http, bool NextCalled)> Run(
            Claim[]? claims, Action<HttpContext>? setup = null, Exception? resolverThrows = null)
        {
            var http = new DefaultHttpContext { RequestServices = new ServiceCollection().BuildServiceProvider() };
            http.Response.Body = new MemoryStream();
            if (claims != null)
                http.User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test"));
            setup?.Invoke(http);

            var tenant = new TenantContext();
            var resolver = new FakeResolver { Throws = resolverThrows };
            var nextCalled = false;
            var middleware = new TenantResolutionMiddleware(_ => { nextCalled = true; return Task.CompletedTask; });

            await middleware.InvokeAsync(http, resolver, tenant, NullLogger<TenantResolutionMiddleware>.Instance);
            return (tenant, resolver, http, nextCalled);
        }

        [Fact]
        public async Task A_scoped_token_is_routed_by_its_tenant_key()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2"),
                new Claim("ProjectId", "5"), new Claim("LocationId", "9"),
                new Claim("ModuleKey", "SERVICE"), new Claim("TenantUserId", "31"), new Claim("TechnicianId", "4")
            });

            Assert.True(r.NextCalled);
            Assert.Equal("conn:C002-P001", r.Tenant.ServiceDbConnectionString);
            Assert.Equal("C002-P001", r.Tenant.ProjectKey);
            Assert.Equal(2, r.Tenant.CompanyId);
            Assert.Equal(5, r.Tenant.ProjectId);
            Assert.Equal(9, r.Tenant.LocationId);
            Assert.Equal("SERVICE", r.Tenant.ModuleKey);
            Assert.Equal(31, r.Tenant.TenantUserId);
            Assert.Equal(11, r.Tenant.MainUserId);
            Assert.Equal(4, r.Tenant.TechnicianId);
        }

        [Fact]
        public async Task A_token_issued_before_the_change_is_still_routed()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("ProjectKey", "C001-P001"), new Claim("CompanyId", "1"),
                new Claim("ProjectId", "1"), new Claim("LocationId", "2"), new Claim("TenantUserId", "8")
            });

            Assert.Equal("conn:C001-P001", r.Tenant.ServiceDbConnectionString);
            Assert.Equal(1, r.Tenant.ProjectId);
            Assert.Equal(2, r.Tenant.LocationId);
        }

        [Fact]
        public async Task A_company_only_token_resolves_no_database()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", ""), new Claim("ProjectKey", ""), new Claim("CompanyId", "2")
            });

            Assert.True(r.NextCalled);
            Assert.False(r.Tenant.IsResolved);
            Assert.Empty(r.Resolver.Asked);
        }

        [Fact]
        public async Task The_location_header_cannot_change_the_branch_of_a_token()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2"),
                new Claim("ProjectId", "5"), new Claim("LocationId", "9")
            }, http => http.Request.Headers["X-Location-Id"] = "77");

            Assert.Equal(9, r.Tenant.LocationId);
        }

        [Theory]
        [InlineData("X-Tenant-Key")]
        [InlineData("X-Project-Key")]
        public async Task An_anonymous_request_is_routed_by_the_key_header(string header)
        {
            var r = await Run(null, http => http.Request.Headers[header] = " KNOWN ");

            Assert.True(r.NextCalled);
            Assert.Equal("conn:KNOWN", r.Tenant.ServiceDbConnectionString);
            Assert.Equal(7, r.Tenant.CompanyId);
            Assert.Equal(3, r.Tenant.ProjectId);
            Assert.Equal(9, r.Tenant.LocationId);
        }

        [Fact]
        public async Task An_unknown_key_header_is_rejected()
        {
            var r = await Run(null, http => http.Request.Headers["X-Tenant-Key"] = "NOPE");

            Assert.False(r.NextCalled);
            Assert.Equal(StatusCodes.Status400BadRequest, r.Http.Response.StatusCode);
            Assert.False(r.Tenant.IsResolved);
        }

        [Fact]
        public async Task The_key_header_is_ignored_for_a_logged_in_caller()
        {
            var r = await Run(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, "11"),
                new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2")
            }, http => http.Request.Headers["X-Tenant-Key"] = "KNOWN");

            Assert.Equal("conn:C002-P001", r.Tenant.ServiceDbConnectionString);
        }

        private static readonly Claim[] ScopedClaims =
        {
            new Claim(ClaimTypes.NameIdentifier, "11"),
            new Claim("TenantKey", "C002-P001"), new Claim("CompanyId", "2"),
            new Claim("ProjectId", "5"), new Claim("LocationId", "9"), new Claim("ModuleKey", "SERVICE")
        };

        [Fact]
        public async Task A_scoped_token_whose_company_is_not_routable_continues_unresolved()
        {
            var r = await Run(ScopedClaims, resolverThrows: new TenantNotRoutableException());

            Assert.True(r.NextCalled);
            Assert.False(r.Tenant.IsResolved);
            Assert.Null(r.Tenant.ProjectKey);
            Assert.Equal(0, r.Tenant.CompanyId);
        }

        [Fact]
        public async Task Another_resolver_failure_still_surfaces()
        {
            await Assert.ThrowsAsync<TimeoutException>(() => Run(ScopedClaims, resolverThrows: new TimeoutException()));
        }
    }
}
