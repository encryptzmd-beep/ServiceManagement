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

// 🔹 Controllers
builder.Services.AddControllers();
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
    options.Filters.Add<PagingGuardFilter>();   // page / size validation + max page size on every list endpoint
    options.Filters.Add<CustomerBoundaryFilter>();   // customer tokens only reach customer-portal endpoints
});

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
app.UseRateLimiter();          // 1️⃣.5 after CORS so a 429 still carries the CORS headers
app.UseAuthentication();       // 2️⃣ Auth
app.UseMiddleware<TenantResolutionMiddleware>();  // 2️⃣.5 Resolve tenant/ServiceDB from JWT claims
app.UseAuthorization();        // 3️⃣ Authorization

app.MapControllers();

app.Run();
