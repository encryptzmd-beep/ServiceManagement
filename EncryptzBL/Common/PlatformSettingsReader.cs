using Microsoft.Extensions.Logging;
using EncryptzBL.DTO_s;

namespace EncryptzBL.Common
{
    /// <summary>
    /// The platform settings (MainDB dbo.PlatformSettings) for the code that uses them: the mail
    /// server, the platform address, the wallet credits. Never fails: a database that cannot be
    /// read gives no settings, and each caller falls back to appsettings.json.
    /// </summary>
    public class PlatformSettingsReader : BaseRepository
    {
        private readonly ILogger<PlatformSettingsReader> _logger;

        public PlatformSettingsReader(MainDbHelper db, ILogger<PlatformSettingsReader> logger) : base(db)
        {
            _logger = logger;
        }

        /// <summary>Every setting by key; a value may be empty (= not set).</summary>
        public virtual async Task<IReadOnlyDictionary<string, string>> ReadAll()
        {
            try
            {
                var list = await GetListAsync<PlatformSettingDto>("sp_Platform_GetSettings");
                return list.Where(s => !string.IsNullOrEmpty(s.SettingKey))
                           .GroupBy(s => s.SettingKey)
                           .ToDictionary(g => g.Key, g => g.First().SettingValue ?? "");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("The platform settings could not be read ({ExceptionType})", ex.GetType().Name);
                return new Dictionary<string, string>();
            }
        }
    }
}
