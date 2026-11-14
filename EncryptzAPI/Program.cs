using EncryptzAPI.Hubs;
using EncryptzAPI.Middleware;
using EncryptzAPI.SrvInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.IdentityModel.Tokens;
using System.Net;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// 🔹 No "Server: Kestrel" header (version / stack disclosure)
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

#if DEBUG
// 🔹 Local runs: the UI calls http://localhost:5092. When the exe is started without a
//    launch profile (no --urls / ASPNETCORE_URLS) Kestrel would fall back to :5000.
if (string.IsNullOrWhiteSpace(builder.Configuration["urls"]))
    builder.WebHost.UseUrls("http://localhost:5092");
#endif

// 🔹 Controllers
builder.Services.AddControllers();
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    options.Filters.Add<PagingGuardFilter>();   // page / size validation + max page size on every list endpoint
    options.Filters.Add<CustomerBoundaryFilter>();   // customer tokens only reach customer-portal endpoints
    options.Filters.Add<TenantScopeExceptionFilter>();   // no scope selected -> 403, not 500
    options.Filters.Add<ModuleBoundaryFilter>();   // a token is issued for one module
});

// 🔹 SignalR: notifications reach the open pages at once
builder.Services.AddSignalR();

// 🔹 Single Service Injection (Your Custom DI)
builder.Services.AddApplicationServices();

// 🔹 CORS (Angular Support)
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins!)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 🔹 Behind nginx: take the client IP / scheme from X-Forwarded-* (loopback proxy only)
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
});

// 🔹 Rate limiting for the anonymous lookups (tenant resolver): per client IP
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(RateLimitPolicies.PublicLookup, context =>
    {
        // A loopback address means the proxy did not pass the client IP on (no
        // X-Forwarded-For): every caller then shares one bucket, so it is kept wide.
        var ip = context.Connection.RemoteIpAddress;
        var sharedBucket = ip == null || IPAddress.IsLoopback(ip);

        return RateLimitPartition.GetFixedWindowLimiter(
            ip?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = sharedBucket ? 300 : 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });

    // The public job pages: browsing is many calls, so the window is wider than a lookup.
    options.AddPolicy(RateLimitPolicies.PublicJobs, context =>
    {
        var ip = context.Connection.RemoteIpAddress;
        var sharedBucket = ip == null || IPAddress.IsLoopback(ip);

        return RateLimitPartition.GetFixedWindowLimiter(
            ip?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = sharedBucket ? 1200 : 120,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            });
    });

    // Each permitted call can start a database build: per logged-in user, else per IP.
    // The user is known here because UseRateLimiter() comes after UseAuthentication() below.
    options.AddPolicy(RateLimitPolicies.CompanyCreation, context =>
    {
        var key = RateLimitPolicies.CompanyCreationKey(context.User, context.Connection.RemoteIpAddress);

        return RateLimitPartition.GetFixedWindowLimiter(
            key,
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromHours(1),
                QueueLimit = 0
            });
    });
});

// 🔹 JWT Authentication (Required for [Authorize])
var jwtKey = builder.Configuration["Jwt:Key"];

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.SaveToken = true;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey =
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!))
        };

        // A browser cannot set a header on a WebSocket: the hub alone takes the token from the
        // query string. Every other endpoint still reads it from the Authorization header only.
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var token = context.Request.Query["access_token"];
                if (!string.IsNullOrEmpty(token) && context.HttpContext.Request.Path.StartsWithSegments(NotificationHub.Path))
                    context.Token = token;
                return Task.CompletedTask;
            }
        };
    });

// 🔹 Swagger / OpenAPI
builder.Services.AddOpenApi();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseForwardedHeaders();

// 🔹 Security headers on every API response
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "strict-origin-when-cross-origin";

    if (context.Request.IsHttps)
        headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";

    // The API answers with JSON only: nothing may be loaded from or framed around it.
    // (Swagger UI is a page of its own and needs its scripts and styles.)
    if (!context.Request.Path.StartsWithSegments("/swagger"))
        headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";

    await next();
});

    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();


app.UseHttpsRedirection();

// 🔥 VERY IMPORTANT ORDER (Most people do wrong)
app.UseCors("CorsPolicy");     // 1️⃣ FIRST CORS
app.UseAuthentication();       // 2️⃣ Auth
app.UseRateLimiter();          // 2️⃣.2 after CORS so a 429 still carries the CORS headers, and after
                               //       authentication so a policy can limit per logged-in user
app.UseMiddleware<TenantResolutionMiddleware>();  // 2️⃣.5 Resolve tenant/ServiceDB from JWT claims
app.UseAuthorization();        // 3️⃣ Authorization

app.MapControllers();
app.MapHub<NotificationHub>(NotificationHub.Path);

app.Run();
