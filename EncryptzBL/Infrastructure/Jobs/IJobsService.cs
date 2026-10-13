using EncryptzBL.DTO_s;

namespace EncryptzBL.Infrastructure.Jobs
{
    /// <summary>A file as it arrives from the caller: its name and its bytes.</summary>
    public sealed record JobUpload(string FileName, byte[] Content);

    /// <summary>
    /// Job Portal: the profile of one person in the Personal DB. Every method takes the
    /// user first; it is the main UserId of whoever is logged in, never a value a client sent.
    /// </summary>
    public interface IJobsService
    {
        Task<ApiResponse<JobProfilePageDto>> GetPage(int userId);
        Task<ApiResponse<bool>> SaveProfile(int userId, JobProfileDto dto);
        Task<ApiResponse<bool>> SetVisible(int userId, bool isVisible);

        Task<ApiResponse<int>> SaveExperience(int userId, JobExperienceDto dto);
        Task<ApiResponse<bool>> DeleteExperience(int userId, int experienceId);

        Task<ApiResponse<int>> SaveEducation(int userId, JobEducationDto dto);
        Task<ApiResponse<bool>> DeleteEducation(int userId, int educationId);

        Task<ApiResponse<int>> SaveSkill(int userId, JobSkillDto dto);
        Task<ApiResponse<bool>> DeleteSkill(int userId, int skillId);
        Task<ApiResponse<List<string>>> SuggestSkills(int userId, string? query);

        Task<ApiResponse<int>> SaveCertificate(int userId, JobCertificateDto dto, JobUpload? file);
        Task<ApiResponse<bool>> DeleteCertificate(int userId, int certificateId);

        Task<ApiResponse<int>> SaveResume(int userId, JobUpload? file);
        Task<ApiResponse<bool>> DeleteResume(int userId);

        Task<ApiResponse<JobFileContent>> GetFile(int userId, int fileId);
    }
}
