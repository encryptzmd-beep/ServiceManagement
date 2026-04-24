using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;

namespace EncryptzBL.Infrastructure.Settings.Modules
{
    public interface ISettingsService
    {
        Task<List<SystemSetting>> GetAll(string settingGroup = null);
        Task<ApiResponse<int>> Update(SettingUpdateDto dto, int modifiedBy);
        Task<ApiResponse<string>> BulkUpdate(BulkSettingsUpdateDto dto, int modifiedBy);
    }
}
