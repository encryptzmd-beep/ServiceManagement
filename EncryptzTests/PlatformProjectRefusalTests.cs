using EncryptzBL.Infrastructure.User.Modules;
using Xunit;

namespace EncryptzTests
{
    public class PlatformProjectRefusalTests
    {
        [Fact]
        public void A_new_project_for_a_company_without_a_database_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(0, 7, null, "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(0, 7, "  ", "C007-P001"));
        }

        [Fact]
        public void A_new_project_for_a_company_that_has_a_database_is_refused()
        {
            Assert.Equal("This company already has a database. Edit it instead",
                PlatformService.ProjectRefusal(0, 7, "C007-P001", ""));
        }

        [Theory]
        [InlineData(3)]
        [InlineData(-1)]
        public void A_project_id_other_than_the_company_id_is_refused(int projectId)
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, "C007-P001", "C007-P001"));
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, null, "X"));
        }

        [Fact]
        public void Editing_the_database_of_the_company_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(7, 7, "C007-P001", "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, "C007-P001", ""));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, "C007-P001", null));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, "C007-P001", "  c007-p001 "));
        }

        [Fact]
        public void Changing_the_key_of_a_company_is_refused()
        {
            Assert.Equal("The key of a company cannot be changed",
                PlatformService.ProjectRefusal(7, 7, "C007-P001", "C007-P002"));
        }

        [Fact]
        public void The_id_check_comes_before_the_key_check()
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(3, 7, "C007-P001", "OTHER"));
        }
    }
}
