

using EncryptzAPI.Provisioning;
using EncryptzBL.Common;
using EncryptzBL.Common.Provisioning;
using EncryptzBL.Common.Tenant;
using EncryptzBL.Infrastructure.Complients.Modules;
using EncryptzBL.Infrastructure.Customer.Modules;
using EncryptzBL.Infrastructure.CustomerPortal.Modules;
using EncryptzBL.Infrastructure.Dashboard.Modules;
using EncryptzBL.Infrastructure.Products.Modules;
using EncryptzBL.Infrastructure.Provisioning;
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
using EncryptzBL.Infrastructure.Sales.Modules;

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

            // company creation: the database of a new company is built in the background
            services.AddSingleton<ProvisioningQueue>();
            services.AddSingleton<IProvisioningQueue>(sp => sp.GetRequiredService<ProvisioningQueue>());
            services.AddSingleton(new Lazy<TenantScript>(() => TenantScript.Load(TenantScript.DefaultPath)));
            services.AddSingleton<ITenantDatabaseServer, SqlTenantDatabaseServer>();
            services.AddScoped<IProvisionStore, ProvisionStore>();
            services.AddScoped<TenantProvisioner>();
            services.AddHostedService<ProvisioningWorker>();

            // On shutdown a running set-up is cancelled and then cleans up: it asks the main
            // database, drops its half-built database (up to about two minutes) and records
            // the failure. The default of 30 seconds would cut that off and leave the database.
            services.Configure<HostOptions>(o => o.ShutdownTimeout = TimeSpan.FromMinutes(3));

            services.AddScoped<DbHelper>();                                         // tenant ServiceDB executor (business)
            services.AddScoped<DbTransactionHelper>();
            services.AddScoped<IAuthService, AuthService>();
            services.AddScoped<ICompanyProvisioningService, CompanyProvisioningService>();
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
            services.AddScoped<ISalesService, SalesService>();                      // sales order -> despatch -> warranty

            return services;
        }
    }
}
