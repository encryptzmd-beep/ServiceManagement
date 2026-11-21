using System.Text;
using EncryptzBL.Common.Sales;
using Xunit;

namespace EncryptzTests
{
    public class SalesDocumentRulesTests
    {
        [Fact]
        public void A_pdf_is_known_by_its_content()
        {
            Assert.True(SalesDocumentRules.IsPdf(Encoding.ASCII.GetBytes("%PDF-1.7 body")));
            Assert.False(SalesDocumentRules.IsPdf(Encoding.ASCII.GetBytes("<html>not a pdf</html>")));
            Assert.False(SalesDocumentRules.IsPdf(Array.Empty<byte>()));
        }

        [Theory]
        [InlineData("invoice.pdf", "invoice.pdf")]
        [InlineData(@"C:\bills\e-way.PDF", "e-way.pdf")]
        [InlineData("../../secret", "secret.pdf")]
        [InlineData("a<b>:c.pdf", "abc.pdf")]
        [InlineData("", "document.pdf")]
        public void The_file_name_is_cleaned(string given, string expected)
            => Assert.Equal(expected, SalesDocumentRules.CleanFileName(given));

        [Fact]
        public void Only_a_known_type_is_kept()
        {
            Assert.Equal("E-Way Bill", SalesDocumentRules.KnownType(" e-way bill "));
            Assert.Null(SalesDocumentRules.KnownType("Anything"));
        }
    }
}
