using EncryptzBL.Common.Sales;
using Xunit;

namespace EncryptzTests
{
    public class SalesInputRulesTests
    {
        [Theory]
        [InlineData("9000011201", "9000011201")]
        [InlineData("+91 90000 11201", "9000011201")]
        [InlineData("09000011201", "9000011201")]
        [InlineData("90000112011", null)]
        [InlineData("1000011201", null)]
        [InlineData("12345", null)]
        [InlineData("abcdefghij", null)]
        [InlineData(null, null)]
        public void Mobile_is_ten_digits(string? typed, string? expected)
            => Assert.Equal(expected, SalesInputRules.NormalizeMobile(typed));

        [Theory]
        [InlineData("priya.menon@example.test", true)]
        [InlineData("", true)]
        [InlineData("priya.menon", false)]
        [InlineData("a b@example.test", false)]
        public void Email_format(string typed, bool ok) => Assert.Equal(ok, SalesInputRules.IsEmailOrBlank(typed));

        [Theory]
        [InlineData("682024", true)]
        [InlineData("", true)]
        [InlineData("682", false)]
        [InlineData("ABCDEF", false)]
        [InlineData("082024", false)]
        public void Pin_format(string typed, bool ok) => Assert.Equal(ok, SalesInputRules.IsPinOrBlank(typed));

        [Theory]
        [InlineData("100%", "100[%]")]
        [InlineData("_", "[_]")]
        [InlineData("[a-z]", "[[]a-z]")]
        [InlineData(" O'Brien ", "O'Brien")]
        [InlineData("   ", null)]
        public void Like_term_has_no_wildcards(string typed, string? expected)
            => Assert.Equal(expected, SalesInputRules.LikeTerm(typed));
    }
}
