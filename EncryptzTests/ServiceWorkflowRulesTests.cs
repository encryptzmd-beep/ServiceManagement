using EncryptzBL.Common.Service;
using Xunit;

namespace EncryptzTests
{
    public class ServiceWorkflowRulesTests
    {
        [Theory]
        [InlineData("4", 4)]
        [InlineData(" 0 ", 0)]
        [InlineData("6", 6)]
        public void Min_parses_whole_numbers(string value, int expected)
            => Assert.Equal(expected, ServiceWorkflowRules.ParseMinPhotos(value));

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("abc")]
        [InlineData("-2")]
        [InlineData("2.5")]
        public void Bad_min_falls_back_to_one(string? value)
            => Assert.Equal(1, ServiceWorkflowRules.ParseMinPhotos(value));

        [Fact]
        public void Categories_are_trimmed()
        {
            Assert.Equal(new[] { "Front View" }, ServiceWorkflowRules.ParseCategories(" , ,Front View ,"));
            Assert.Equal(new[] { "A", "B" }, ServiceWorkflowRules.ParseCategories("A,B"));
        }

        [Theory]
        [InlineData(null)]
        [InlineData(" , ")]
        public void Blank_categories_fall_back(string? value)
            => Assert.Equal(new[] { "Before", "After", "Part", "Signature", "Other" }, ServiceWorkflowRules.ParseCategories(value));

        [Fact]
        public void Photo_problem_words()
        {
            Assert.Equal("Upload at least one service photo before completing the work order", ServiceWorkflowRules.PhotoProblem(0, 1));
            Assert.Equal("Upload at least 4 service photos before completing the work order", ServiceWorkflowRules.PhotoProblem(2, 4));
            Assert.Null(ServiceWorkflowRules.PhotoProblem(4, 4));
            Assert.Null(ServiceWorkflowRules.PhotoProblem(0, 0));
            Assert.Null(ServiceWorkflowRules.PhotoProblem(5, 4));
        }
    }
}
