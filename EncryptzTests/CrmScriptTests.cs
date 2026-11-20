using System.Text.RegularExpressions;
using Xunit;

namespace EncryptzTests
{
    // ── the company database script of the CRM application (14_CRM.sql) ─────

    public class CrmScriptTests
    {
        private static string Root()
        {
            var folder = new DirectoryInfo(AppContext.BaseDirectory);
            while (folder != null && !File.Exists(Path.Combine(folder.FullName, "EncryptzAPI", "Program.cs")))
                folder = folder.Parent;
            return folder!.FullName;
        }

        private static string Read(params string[] path) => File.ReadAllText(Path.Combine(new[] { Root(), "EncryptzAPI", "Database" }.Concat(path).ToArray()));

        private static string Script14() => Read("ProjectDB", "14_CRM.sql");

        private static string Script15() => Read("ProjectDB", "15_CRM_Convert_Check.sql");

        /// <summary>The effective definition: 14_CRM.sql, with each procedure that 15_CRM_Convert_Check.sql replaces taken from 15 (the last definition wins).</summary>
        private static string Script()
        {
            var s14 = Script14();
            var s15 = Script15();
            foreach (var (name, _) in Procedures(s15))
                s14 = Regex.Replace(s14, @"CREATE OR ALTER PROCEDURE crm\." + name + @"\b.*?\nGO\r?\n\r?\n?", "", RegexOptions.Singleline);
            return s14 + "\n" + s15;
        }

        /// <summary>Name and body of every procedure of a script.</summary>
        private static List<(string Name, string Body)> Procedures(string script)
            => Regex.Matches(script, @"CREATE OR ALTER PROCEDURE crm\.(\w+)(.*?)\nGO", RegexOptions.Singleline)
                .Select(m => (m.Groups[1].Value, m.Groups[2].Value)).ToList();

        private static string Body(string name) => Procedures(Script()).Single(p => p.Name == name).Body;

        private static readonly string[] Tables =
            { "Members", "LeadSources", "LostReasons", "Leads", "LeadStatusHistory", "FollowUps", "Quotations", "QuotationItems" };

        [Fact]
        public void Script_creates_every_table()
        {
            var script = Script();
            foreach (var table in Tables)
                Assert.Contains($"CREATE TABLE crm.{table}", script);
            Assert.Contains("ConvertingAt", script);
        }

        [Fact]
        public void Script_guards_the_database()
        {
            var script = Script();
            Assert.Contains("is the SaaS main database", script);
            Assert.Contains("is the Personal DB. Select a company database", script);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), script);
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("14_CRM.sql", Script14()).Batches);

            var s15 = Script15();
            Assert.Contains("is the SaaS main database", s15);
            Assert.Contains("is the Personal DB. Select a company database", s15);
            Assert.Contains("Run 14_CRM.sql first", s15);
            Assert.DoesNotMatch(new Regex(@"^\s*USE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), s15);
            Assert.NotEmpty(EncryptzBL.Common.Provisioning.TenantScript.ParseFollowUp("15_CRM_Convert_Check.sql", s15).Batches);
        }

        [Fact]
        public void Every_proc_of_the_interface_exists()
        {
            var names = Procedures(Script()).Select(p => p.Name).ToHashSet();
            foreach (var name in new[]
            {
                "sp_Masters_Ensure", "sp_Source_List", "sp_Source_Save", "sp_LostReason_List", "sp_LostReason_Save",
                "sp_Member_List", "sp_Member_Save", "sp_IsManager",
                "sp_Lead_NextNumber", "sp_Lead_Save", "sp_Lead_List", "sp_Lead_Get", "sp_Lead_SetStatus", "sp_Lead_Reassign", "sp_Lead_History",
                "sp_FollowUp_Add", "sp_FollowUp_List",
                "sp_Quotation_Save", "sp_Quotation_Get", "sp_Quotation_ListForLead", "sp_Quotation_Revise", "sp_Quotation_SetStatus",
                "sp_Lead_BeginConvert", "sp_Lead_FinishConvert", "sp_Lead_CancelConvert", "sp_Lead_LinkOrder", "sp_Lead_MarkConvertUnknown",
                "sp_Product_Search", "sp_Dashboard", "sp_Report_FollowUps", "sp_Report_Conversion"
            })
                Assert.True(names.Contains(name), $"crm.{name} is missing");
        }

        [Fact]
        public void Every_proc_takes_company_first_and_names_it()
        {
            var procedures = Procedures(Script());
            Assert.NotEmpty(procedures);

            foreach (var (name, body) in procedures)
            {
                Assert.True(Regex.Match(body, @"@\w+").Value == "@CompanyId", $"{name}: the first parameter is not @CompanyId");
                foreach (var statement in body.Split(';').Where(s => Regex.IsMatch(s, @"crm\.(Leads|FollowUps|Quotations|QuotationItems|Members|LeadSources|LostReasons|LeadStatusHistory)\b")))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
            }
        }

        [Fact]
        public void Legacy_dbo_tables_are_not_filtered_by_company()
        {
            // Existing procs rely on Security.TenantScopePolicy for dbo.Users and dbo.ProductMaster,
            // because legacy rows may carry another CompanyId. CRM does the same.
            Assert.DoesNotContain("p.CompanyId", Body("sp_Product_Search"));
            Assert.DoesNotContain("u.CompanyId", Body("sp_Member_List"));
            Assert.DoesNotContain("dbo.Users WHERE UserId = @MemberUserId AND CompanyId", Body("sp_Member_Save"));
            Assert.DoesNotContain("so.CompanyId", Script());
            Assert.DoesNotContain("OrderNo = @OrderNo AND CompanyId", Script());
            Assert.DoesNotContain(Script().Split((char)10), line => line.Contains("dbo.SalesOrders") && line.Contains("CompanyId = @CompanyId"));
        }

        [Fact]
        public void Script_changes_nothing_of_dbo()
        {
            var script = Script();
            foreach (var forbidden in new[] { @"ALTER\s+TABLE\s+dbo\.", @"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.", @"INSERT\s+INTO\s+dbo\.", @"UPDATE\s+dbo\.", @"DELETE\s+FROM\s+dbo\." })
                Assert.DoesNotMatch(new Regex(forbidden, RegexOptions.IgnoreCase), script);
        }

        [Fact]
        public void Lead_list_filters_owner_for_sales_users()
        {
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", Body("sp_Lead_List"));
            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId", Body("sp_Lead_Get"));
        }

        /// <summary>Parameter list of a procedure: the text up to the AS line.</summary>
        private static string Parameters(string body) => body.Substring(0, Regex.Match(body, @"\n\s*AS\s*\n").Index);

        [Fact]
        public void A_lead_is_seen_and_saved_only_in_the_selected_branch()
        {
            foreach (var name in new[]
            {
                "sp_Lead_Save", "sp_Lead_List", "sp_Lead_Get", "sp_Lead_SetStatus", "sp_Lead_Reassign", "sp_Lead_History",
                "sp_FollowUp_Add", "sp_FollowUp_List",
                "sp_Quotation_Save", "sp_Quotation_Get", "sp_Quotation_ListForLead", "sp_Quotation_Revise", "sp_Quotation_SetStatus",
                "sp_Lead_BeginConvert", "sp_Lead_FinishConvert", "sp_Lead_CancelConvert", "sp_Lead_LinkOrder", "sp_Lead_MarkConvertUnknown",
                "sp_Dashboard", "sp_Report_FollowUps", "sp_Report_Conversion"
            })
            {
                var parameters = Parameters(Body(name));
                Assert.Matches(new Regex(@"@LocationId\s+INT\s*(,|$)"), parameters);   // required: no default
                Assert.DoesNotMatch(new Regex(@"@LocationId\s+INT\s*="), parameters);
                Assert.Contains("LocationId = @LocationId", Body(name));
                Assert.DoesNotContain("@LocationId IS NULL OR", Body(name));
            }

            Assert.Contains("@IsManager = 1 OR l.OwnerUserId = @UserId) AND l.LocationId = @LocationId", Body("sp_Lead_Get"));

            // a new lead gets the selected branch; an existing one of another branch is not found
            var save = Body("sp_Lead_Save");
            Assert.Contains("OwnerUserId = @UserId) AND LocationId = @LocationId", save);
            Assert.Matches(new Regex(@"Priority, Status, Remarks, LocationId, CreatedBy\)\s*VALUES \(.*@LocationId, @UserId\)", RegexOptions.Singleline), save);
        }

        [Fact]
        public void The_lead_list_can_show_what_was_closed_in_a_period()
        {
            var list = Body("sp_Lead_List");
            Assert.Contains("@ClosedFrom", Parameters(list));
            Assert.Contains("@ClosedTo", Parameters(list));
            Assert.Contains("l.ConvertedAt >= @ClosedFrom", list);
            Assert.Contains("l.LostAt >= @ClosedFrom", list);
        }

        [Fact]
        public void Begin_convert_is_atomic()
        {
            var body = Body("sp_Lead_BeginConvert");
            var update = body.Split(';').Single(s => s.Contains("UPDATE crm.Leads"));
            // a marker older than 15 minutes is free (a convert that died midway), in the same single UPDATE
            Assert.Contains(FreeMarker, update);
            Assert.Contains("SalesOrderId IS NULL", update);
            Assert.Contains("Status IN ('Quotation','Negotiation')", update);
            Assert.Contains("@@ROWCOUNT = 1", body);
        }

        [Fact]
        public void Status_values_and_numbers_are_the_agreed_ones()
        {
            var script = Script();
            Assert.Contains("'New', 'Contacted', 'Qualified', 'Quotation', 'Negotiation', 'Converted', 'Lost'", script);
            Assert.Contains("'Draft', 'Sent', 'Accepted', 'Rejected', 'Superseded'", script);
            Assert.Contains("'LD-'", script);
            Assert.Contains("'QT-'", script);
            Assert.Contains("Only a draft quotation can be changed. Revise it instead", Body("sp_Quotation_Save"));
        }

        [Fact]
        public void Release_touches_only_the_crm_row()
        {
            var script = Read("MainDB", "32_CRM_Release.sql");
            Assert.Single(Regex.Matches(script, @"^\s*UPDATE\s", RegexOptions.Multiline | RegexOptions.IgnoreCase));
            Assert.Contains("WHERE ModuleKey = N'CRM'", script);
            Assert.DoesNotMatch(new Regex(@"^\s*(INSERT|DELETE)\s", RegexOptions.Multiline | RegexOptions.IgnoreCase), script);
        }

        [Fact]
        public void Script_ships_with_the_api()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\14_CRM.sql", project);
        }

        [Fact]
        public void Script_15_ships_with_the_api()
        {
            var project = File.ReadAllText(Path.Combine(Root(), "EncryptzAPI", "EncryptzAPI.csproj"));
            Assert.Contains(@"Database\ProjectDB\15_CRM_Convert_Check.sql", project);
        }

        [Fact]
        public void Script_15_holds_only_the_guarded_alter_and_procedures()
        {
            var s15 = Script15();
            Assert.DoesNotMatch(new Regex(@"CREATE\s+TABLE", RegexOptions.IgnoreCase), s15);
            Assert.DoesNotMatch(new Regex(@"CREATE\s+(UNIQUE\s+)?(NONCLUSTERED\s+)?INDEX", RegexOptions.IgnoreCase), s15);
            Assert.Single(Regex.Matches(s15, @"\bALTER\s+TABLE\b", RegexOptions.IgnoreCase));
            Assert.Contains("IF COL_LENGTH('crm.Leads', 'ConvertNeedsCheck') IS NULL ALTER TABLE crm.Leads ADD ConvertNeedsCheck BIT NOT NULL CONSTRAINT DF_crm_Leads_ConvertNeedsCheck DEFAULT (0);", s15);
            Assert.Equal(Regex.Matches(s15, @"\bCREATE\s+OR\s+ALTER\s+PROCEDURE\b", RegexOptions.IgnoreCase).Count, Regex.Matches(s15, @"\bCREATE\s+", RegexOptions.IgnoreCase).Count);
            Assert.Contains("sp_Lead_MarkConvertUnknown", Procedures(s15).Select(p => p.Name));
            // every company statement of 15 names @CompanyId, and 15 leaves dbo alone
            foreach (var (name, body) in Procedures(s15))
                foreach (var statement in body.Split(';').Where(x => Regex.IsMatch(x, @"crm\.(Leads|FollowUps|Quotations|QuotationItems|Members|LeadSources|LostReasons|LeadStatusHistory)\b")))
                    Assert.True(statement.Contains("@CompanyId"), $"{name}: a statement does not name @CompanyId:\n{statement.Trim()}");
            foreach (var forbidden in new[] { @"ALTER\s+TABLE\s+dbo\.", @"CREATE\s+OR\s+ALTER\s+PROCEDURE\s+dbo\.", @"INSERT\s+INTO\s+dbo\.", @"UPDATE\s+dbo\.", @"DELETE\s+FROM\s+dbo\." })
                Assert.DoesNotMatch(new Regex(forbidden, RegexOptions.IgnoreCase), s15);
        }

        // ── the convert marker: free only when stale AND not flagged for a manager's check ──

        /// <summary>The one expression of a free marker, on the table's columns (UPDATE ... WHERE).</summary>
        private const string FreeMarker = "(ConvertingAt IS NULL OR (ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND ConvertNeedsCheck = 0))";

        /// <summary>The same expression on the variables a proc read under lock.</summary>
        private const string FreeMarkerRead = "(@Converting IS NULL OR (@Converting < DATEADD(MINUTE, -15, SYSUTCDATETIME()) AND @ConvertNeedsCheck = 0))";

        private const string NeedsCheckRefusal = "A manager must check the sales orders for this lead first";

        [Fact]
        public void Leads_carry_the_needs_check_flag()
        {
            // the column is added by 15_CRM_Convert_Check.sql, guarded, to the crm.Leads that 14_CRM.sql made
            Assert.Contains("IF COL_LENGTH('crm.Leads', 'ConvertNeedsCheck') IS NULL ALTER TABLE crm.Leads ADD ConvertNeedsCheck BIT NOT NULL CONSTRAINT DF_crm_Leads_ConvertNeedsCheck DEFAULT (0);",
                Script15());
            Assert.DoesNotContain("ConvertNeedsCheck", Script14());
            Assert.Contains("l.ConvertNeedsCheck", Body("sp_Lead_Get"));
        }

        [Fact]
        public void Every_marker_check_uses_the_free_marker_rule()
        {
            var script = Script();
            // no bare "busy" check is left anywhere: a marker is never read as busy or free by IS NULL alone
            Assert.DoesNotContain("@Converting IS NOT NULL", script);
            Assert.DoesNotContain("AND ConvertingAt IS NULL;", script);
            Assert.DoesNotContain("OR ConvertingAt < DATEADD(MINUTE, -15, SYSUTCDATETIME()))", script);
            // no function: the one inline expression
            Assert.DoesNotMatch(new Regex(@"CREATE\s+(OR\s+ALTER\s+)?FUNCTION", RegexOptions.IgnoreCase), script);

            Assert.Contains(FreeMarker, Body("sp_Lead_BeginConvert"));

            var setStatus = Body("sp_Lead_SetStatus");
            Assert.Contains("IF NOT " + FreeMarkerRead, setStatus);
            // the Lost UPDATE accepts a stale, unflagged marker and clears it
            var lost = setStatus.Split(';').Single(s => s.Contains("SET Status = 'Lost'"));
            Assert.Contains(FreeMarker, lost);
            Assert.Contains("ConvertingAt = NULL", lost);

            foreach (var name in new[] { "sp_Quotation_Save", "sp_Quotation_Revise", "sp_Quotation_SetStatus" })
                Assert.Contains("OR NOT " + FreeMarkerRead, Body(name));

            foreach (var name in new[] { "sp_Lead_BeginConvert", "sp_Lead_SetStatus", "sp_Quotation_Save", "sp_Quotation_Revise", "sp_Quotation_SetStatus", "sp_Lead_CancelConvert" })
                Assert.Contains(NeedsCheckRefusal, Body(name));
        }

        [Fact]
        public void Mark_convert_unknown_flags_only_a_lead_holding_the_marker()
        {
            var body = Body("sp_Lead_MarkConvertUnknown");
            var parameters = Parameters(body);
            Assert.Matches(new Regex(@"^\s*@CompanyId\s+INT"), parameters);
            Assert.Matches(new Regex(@"@LocationId\s+INT\s*(,|$)"), parameters);
            var update = body.Split(';').Single(s => s.Contains("UPDATE crm.Leads"));
            Assert.Contains("SET ConvertNeedsCheck = 1", update);
            Assert.Contains("ConvertingAt IS NOT NULL", update);
            Assert.Contains("SalesOrderId IS NULL", update);
            Assert.Contains("(@IsManager = 1 OR OwnerUserId = @UserId) AND LocationId = @LocationId", update);
        }

        [Fact]
        public void Only_a_manager_frees_a_flagged_lead()
        {
            var cancel = Body("sp_Lead_CancelConvert").Split(';').Single(s => s.Contains("UPDATE crm.Leads"));
            Assert.Contains("SET ConvertingAt = NULL, ConvertNeedsCheck = 0", cancel);
            Assert.Contains("(ConvertNeedsCheck = 0 OR ISNULL(@IsManager, 0) = 1)", cancel);

            var link = Body("sp_Lead_LinkOrder").Split(';').Single(s => s.Contains("UPDATE crm.Leads"));
            Assert.Contains("ConvertingAt = NULL, ConvertNeedsCheck = 0", link);
            Assert.Contains("Only a CRM manager can link an order", Body("sp_Lead_LinkOrder"));

            var finish = Body("sp_Lead_FinishConvert").Split(';').Single(s => s.Contains("UPDATE crm.Leads"));
            Assert.Contains("ConvertNeedsCheck = 0", finish);
        }

        // ── phase 1: a CRM user must also have Service (Review Focus 1) ──

        [Fact]
        public void A_crm_user_without_service_gets_the_known_refusal()
        {
            var auth = File.ReadAllText(Path.Combine(Root(), "EncryptzBL", "Infrastructure", "User", "Modules", "AuthService.cs"));
            Assert.Contains("\"Your user is not set up for this company\"", auth);

            var release = Read("MainDB", "32_CRM_Release.sql");
            var header = release.Substring(0, release.IndexOf("*/", StringComparison.Ordinal));
            Assert.Contains("every CRM user must ALSO be granted the Service module", header);
        }
    }
}
