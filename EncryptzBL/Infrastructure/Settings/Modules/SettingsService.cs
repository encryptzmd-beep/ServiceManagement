using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.Json;

namespace EncryptzBL.Infrastructure.Settings.Modules
{
    public class SettingsService : BaseRepository, ISettingsService
    {
        public SettingsService(DbHelper db) : base(db) { }

        // 🔥 GET ALL SETTINGS (OPTIONAL GROUP FILTER)
        public async Task<List<SystemSetting>> GetAll(string settingGroup = null)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@SettingGroup", settingGroup)
            };

            var dt = await GetDataTableAsync("sp_Settings_GetAll", parameters);

            return dt.Rows.Count > 0
                ? dt.ToList<SystemSetting>()
                : new List<SystemSetting>();
        }

        // 🔥 UPDATE SINGLE SETTING
        public async Task<ApiResponse<int>> Update(SettingUpdateDto dto, int modifiedBy)
        {
            var parameters = new[]
            {
                SqlParameterHelper.Input("@SettingId", dto.SettingId),
                SqlParameterHelper.Input("@SettingValue", dto.SettingValue),
                SqlParameterHelper.Input("@ModifiedBy", modifiedBy)
            };

            var dt = await GetDataTableAsync("sp_Settings_Update", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<int>.Fail("Update failed");

            var settingId = Convert.ToInt32(dt.Rows[0]["SettingId"]);
            var message = dt.Rows[0]["Message"]?.ToString() ?? "Setting updated";

            return ApiResponse<int>.Ok(settingId, message);
        }

        // 🔥 BULK UPDATE SETTINGS (JSON → SP OPENJSON)
        public async Task<ApiResponse<string>> BulkUpdate(BulkSettingsUpdateDto dto, int modifiedBy)
        {
            // Convert to SP expected JSON format: [{ id: 1, value: "xxx" }]
            var settingsJson = JsonSerializer.Serialize(
                dto.Settings.Select(s => new { id = s.SettingId, value = s.SettingValue })
            );

            var parameters = new[]
            {
                SqlParameterHelper.Input("@SettingsJson", settingsJson),
                SqlParameterHelper.Input("@ModifiedBy", modifiedBy)
            };

            var dt = await GetDataTableAsync("sp_Settings_BulkUpdate", parameters);

            if (dt.Rows.Count == 0)
                return ApiResponse<string>.Fail("Bulk update failed");

            var message = dt.Rows[0]["Message"]?.ToString() ?? "Settings updated successfully";

            return ApiResponse<string>.Ok(message, message);
        }
    }
}
