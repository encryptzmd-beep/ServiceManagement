using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace EncryptzBL.Infrastructure.RepairPart.Modules
{
    public interface IRepairPartService
    {
        Task<ApiResponse<int>> CreateRequest(RepairPartRequestCreateDto dto);
        Task<ApiResponse<int>> SaveImage(int repairRequestId, string imagePath, string imageType);
        Task<ApiResponse<List<RepairImageDto>>> GetImagesByRequest(int repairRequestId);
        Task<ApiResponse<string>> GetImageBase64(int imageId);
        Task<ApiResponse<bool>> UpdateStatus(int repairRequestId, string status, string? notes);
    }

    public class RepairImageDto
    {
        public int ImageId { get; set; }
        public string ImageType { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }
}
