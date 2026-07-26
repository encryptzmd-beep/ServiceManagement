using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace EncryptzBL.Common.Tenant
{
    /// <summary>
    /// AES-256 implementation of <see cref="ITenantSecretProtector"/>.
    /// Key comes from configuration "Tenant:SecretKey" (a base64 32-byte key).
    /// Output format: base64( IV(16) || ciphertext ).
    /// </summary>
    public class AesTenantSecretProtector : ITenantSecretProtector
    {
        private readonly byte[] _key;

        public AesTenantSecretProtector(IConfiguration config)
        {
            var raw = config["Tenant:SecretKey"]
                      ?? throw new InvalidOperationException("Tenant:SecretKey is not configured.");

            // Accept a base64 key, or derive a 32-byte key from a passphrase via SHA-256.
            try
            {
                _key = Convert.FromBase64String(raw);
                if (_key.Length != 32)
                    _key = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            }
            catch (FormatException)
            {
                _key = SHA256.HashData(Encoding.UTF8.GetBytes(raw));
            }
        }

        public string Protect(string plaintext)
        {
            if (string.IsNullOrEmpty(plaintext)) return string.Empty;

            using var aes = Aes.Create();
            aes.Key = _key;
            aes.GenerateIV();

            using var enc = aes.CreateEncryptor();
            var plainBytes = Encoding.UTF8.GetBytes(plaintext);
            var cipher = enc.TransformFinalBlock(plainBytes, 0, plainBytes.Length);

            var result = new byte[aes.IV.Length + cipher.Length];
            Buffer.BlockCopy(aes.IV, 0, result, 0, aes.IV.Length);
            Buffer.BlockCopy(cipher, 0, result, aes.IV.Length, cipher.Length);
            return Convert.ToBase64String(result);
        }

        public string Unprotect(string ciphertext)
        {
            if (string.IsNullOrEmpty(ciphertext)) return string.Empty;

            var all = Convert.FromBase64String(ciphertext);

            using var aes = Aes.Create();
            aes.Key = _key;

            var iv = new byte[16];
            Buffer.BlockCopy(all, 0, iv, 0, iv.Length);
            aes.IV = iv;

            using var dec = aes.CreateDecryptor();
            var cipher = new byte[all.Length - iv.Length];
            Buffer.BlockCopy(all, iv.Length, cipher, 0, cipher.Length);

            var plain = dec.TransformFinalBlock(cipher, 0, cipher.Length);
            return Encoding.UTF8.GetString(plain);
        }
    }
}
