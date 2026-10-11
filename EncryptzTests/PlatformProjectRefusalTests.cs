using EncryptzBL.Infrastructure.User.Modules;
using Xunit;

namespace EncryptzTests
{
    public class PlatformProjectRefusalTests
    {
        [Fact]
        public void A_new_project_for_a_company_without_a_database_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, null, "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "  ", "C007-P001"));
        }

        [Fact]
        public void A_company_with_a_key_but_no_listed_database_can_still_be_attached()
        {
            // migrated company whose connection never worked: it has a key, it is not listed
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "C007-P001", "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "C007-P001", ""));
        }

        [Fact]
        public void A_new_project_for_a_company_that_has_a_database_is_refused()
        {
            Assert.Equal("This company already has a database. Edit it instead",
                PlatformService.ProjectRefusal(0, 7, true, "C007-P001", ""));
        }

        [Theory]
        [InlineData(3)]
        [InlineData(-1)]
        public void A_project_id_other_than_the_company_id_is_refused(int projectId)
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, true, "C007-P001", "C007-P001"));
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(projectId, 7, false, null, "X"));
        }

        [Fact]
        public void Editing_the_company_database_with_the_same_key_is_allowed()
        {
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", "C007-P001"));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", ""));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", null));
            Assert.Null(PlatformService.ProjectRefusal(7, 7, true, "C007-P001", "  c007-p001 "));
        }

        [Theory]
        [InlineData(true)]
        public void A_key_that_is_already_set_cannot_be_changed(bool hasDatabase)
        {
            // the key is in tokens and customer links: it stays for a company that has a database
            Assert.Equal("The key of a company cannot be changed",
                PlatformService.ProjectRefusal(7, 7, hasDatabase, "C007-P001", "C007-P002"));
        }

        [Fact]
        public void A_company_without_a_listed_database_can_be_attached_with_a_different_suggested_key()
        {
            // the administrator cannot see the real key of an unlisted company; the stored procedure keeps it
            Assert.Null(PlatformService.ProjectRefusal(0, 7, false, "C007-P001", "C007-P002"));
        }

        [Fact]
        public void A_foreign_project_id_is_refused_before_anything_else()
        {
            Assert.Equal("Database not found for this company",
                PlatformService.ProjectRefusal(3, 7, true, "C007-P001", "OTHER"));
        }
    }
}
