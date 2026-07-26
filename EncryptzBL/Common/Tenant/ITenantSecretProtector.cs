namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// Encrypts/decrypts the ServiceDB password stored in
    /// MainDB.dbo.CompanyConnections.DbPasswordEnc. Registry passwords are never
    /// stored in plaintext.
    /// </summary>
    public interface ITenantSecretProtector
    {
        /// <summary>Encrypt a plaintext secret for storage in the registry.</summary>
        string Protect(string plaintext);

        /// <summary>Decrypt a value read from the registry.</summary>
        string Unprotect(string ciphertext);
    }
}
