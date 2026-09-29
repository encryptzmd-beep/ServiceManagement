

using EncryptzBL.Common;
using EncryptzBL.Common.Tenant;
using EncryptzBL.Infrastructure.Complients.Modules;
using EncryptzBL.Infrastructure.Customer.Modules;
using EncryptzBL.Infrastructure.CustomerPortal.Modules;
using EncryptzBL.Infrastructure.Dashboard.Modules;
using EncryptzBL.Infrastructure.Products.Modules;
using EncryptzBL.Infrastructure.Report.Modules;
using EncryptzBL.Infrastructure.Schedule.Modules;
using EncryptzBL.Infrastructure.Settings.Modules;
using EncryptzBL.Infrastructure.Spareparts.Modules;
using EncryptzBL.Infrastructure.Technician.modules;
using EncryptzBL.Infrastructure.Technician.Modules;
using EncryptzBL.Infrastructure.Tracking.Modules;
using EncryptzBL.Infrastructure.User.Modules;
using EncryptzBL.Infrastructure.WarrantyReturn.Modules;
using EncryptzBL.Infrastructure.RepairPart.Modules;
using EncryptzBL.Infrastructure.Payments.Modules;

namespace EncryptzAPI.SrvInjection
{
    public static class ServiceRegistration
    {
        // 🔥 SINGLE METHOD TO INJECT EVERYTHING
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // 🔹 Multi-tenant infrastructure
            services.AddScoped<TenantContext>();                                   // per-request tenant state
            services.AddSingleton<ITenantSecretProtector, AesTenantSecretProtector>();
            services.AddSingleton<IConnectionResolver, ConnectionResolver>();      // ClientKey -> ServiceDB conn (cached)
            services.AddScoped<MainDbHelper>();                                     // fixed MainDB executor (control-plane)
            services.AddScoped<ITenantUserSyncService, TenantUserSyncService>();    // MainDB users -> project DB mirror

            services.AddScoped<DbHelper>();                                         // tenant ServiceDB executor (business)
            services.AddScoped<DbTransactionHelper>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<IPlatformService, PlatformService>();                // MainDB registry administration
            services.AddScoped<IPlatformUnlockService, PlatformUnlockService>();    // e-mailed access code for Platform Admin
            services.AddScoped<IComplaintService, ComplaintService>();
            services.AddScoped<IDashboardService, DashboardService>();
            services.AddScoped<ITechnicianService, TechnicianService>();
            services.AddScoped<IWarrantyReturnService, WarrantyReturnService>();
            services.AddScoped<IScheduleService, ScheduleService>();
           // services.AddScoped<ITrackingService, TrackingService>();
            services.AddScoped<ICustomerPortalService, CustomerPortalService>();
            services.AddScoped<IReportService, ReportService>();
            services.AddScoped<ISettingsService, SettingsService>();
            services.AddScoped<ICustomerService, CustomerService>();
            services.AddScoped<ISparePartService, SparePartService>();
            services.AddScoped<ITrackingService, TrackingService>();
            services.AddScoped<IProductMasterService, ProductMasterService>();
            services.AddScoped<IRepairPartService, RepairPartService>();
            services.AddScoped<IEmailService, EmailService>();
            services.AddScoped<IPaymentService, PaymentService>();

            return services;
        }
    }
}
