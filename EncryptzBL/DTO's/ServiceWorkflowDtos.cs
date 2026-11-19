namespace EncryptzBL.DTO_s
{
    /// <summary>What the complete dialog needs: photos needed, photo types, photos already on the complaint.</summary>
    public class CompletionRulesDto
    {
        public int MinPhotos { get; set; }
        public List<string> PhotoCategories { get; set; } = new();
        public int PhotosUploaded { get; set; }
    }

    /// <summary>Previous / next document of the transaction toolbar (null at either end).</summary>
    public class NeighboursDto
    {
        public int? PreviousId { get; set; }
        public int? NextId { get; set; }
    }

    /// <summary>Attendance check-in required (dbo.Technicians.AttendanceRequired) of one technician.</summary>
    public class TechnicianAttendanceRuleDto
    {
        public int UserId { get; set; }
        public int TechnicianId { get; set; }
        public bool AttendanceRequired { get; set; }
    }

    /// <summary>Keyed by TechnicianId: the technician list rows carry it (they have no UserId).</summary>
    public class AttendanceRequiredSetDto
    {
        public int TechnicianId { get; set; }
        public bool Required { get; set; }
    }
}
