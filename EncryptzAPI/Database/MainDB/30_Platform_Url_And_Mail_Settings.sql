/* =============================================================================
   MainDB · 30 · Platform settings: the platform address and the mail server
   -----------------------------------------------------------------------------
   Run in MainDBEncryptz AFTER 20_Company_Provisioning.sql. SAFE TO RE-RUN: a setting is added
   only when it is missing; a value set in Platform Admin is never overwritten.

     PublicUrl       the address used in the links of mails (invite links)
     SmtpHost / SmtpPort / SmtpEnableSsl / SmtpUserName / SmtpPassword / SmtpFromEmail / SmtpFromName
                     the mail server. Empty = the Smtp section of appsettings.json is used, so
                     nothing changes until a value is set. SmtpPassword is stored encrypted by the
                     API (Tenant:SecretKey) and never shown again.
   ============================================================================= */
SET NOCOUNT ON;
SET XACT_ABORT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
SET NOEXEC OFF;
GO

IF DB_NAME() IN ('master', 'model', 'msdb', 'tempdb') OR OBJECT_ID('dbo.Users') IS NULL
BEGIN
    RAISERROR('Select MainDBEncryptz before running this script.', 16, 1);
    SET NOEXEC ON;
END
GO

IF OBJECT_ID('dbo.PlatformSettings') IS NULL
BEGIN
    RAISERROR('Run 20_Company_Provisioning.sql in this database first. Nothing was changed.', 16, 1);
    SET NOEXEC ON;
END
GO

INSERT INTO dbo.PlatformSettings (SettingKey, SettingValue)
SELECT v.SettingKey, v.SettingValue
FROM (VALUES
    ('PublicUrl',     'https://serviceapp.encryptz.in'),
    ('SmtpHost',      ''),
    ('SmtpPort',      ''),
    ('SmtpEnableSsl', ''),
    ('SmtpUserName',  ''),
    ('SmtpPassword',  ''),
    ('SmtpFromEmail', ''),
    ('SmtpFromName',  '')
) v (SettingKey, SettingValue)
WHERE NOT EXISTS (SELECT 1 FROM dbo.PlatformSettings s WHERE s.SettingKey = v.SettingKey);
GO

PRINT 'Platform settings: platform address and mail server added (only the missing ones).';
GO
SET NOEXEC OFF;
GO
