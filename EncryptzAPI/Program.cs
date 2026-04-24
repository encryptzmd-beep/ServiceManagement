using EncryptzAPI.SrvInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

// 🔹 Controllers
builder.Services.AddControllers();
builder.Services.AddControllers(options =>
{
    options.SuppressImplicitRequiredAttributeForNonNullableReferenceTypes = true;
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



    app.UseSwagger();
    app.UseSwaggerUI();
    app.MapOpenApi();


app.UseHttpsRedirection();

// 🔥 VERY IMPORTANT ORDER (Most people do wrong)
app.UseCors("CorsPolicy");     // 1️⃣ FIRST CORS
app.UseAuthentication();       // 2️⃣ Auth
app.UseAuthorization();        // 3️⃣ Authorization

app.MapControllers();

app.Run();
