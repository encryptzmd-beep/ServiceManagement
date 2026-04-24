

using EncryptzBL.Common;
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

namespace EncryptzAPI.SrvInjection
{
    public static class ServiceRegistration
    {
        // 🔥 SINGLE METHOD TO INJECT EVERYTHING
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            services.AddScoped<DbHelper>();
            services.AddScoped<IAuthService, AuthService>();
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


            return services;
        }
    }
}
