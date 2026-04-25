using EncryptzBL.Common;
using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.RepairPart.Modules;
using Microsoft.Data.SqlClient;
using System;
using System.Data;
using System.Threading.Tasks;

namespace EncryptzBL.Infrastructure.RepairPart.Modules
{
    public class RepairPartService : BaseRepository, IRepairPartService
    {
        public RepairPartService(DbHelper db) : base(db) { }

        public async Task<ApiResponse<int>> CreateRequest(RepairPartRequestCreateDto dto)
        {
            try
            {
                var p = new[]
                {
                    SqlParameterHelper.Input("@ComplaintId", dto.ComplaintId),
                    SqlParameterHelper.Input("@AssignmentId", dto.AssignmentId),
                    SqlParameterHelper.Input("@TechnicianId", dto.TechnicianId),
                    SqlParameterHelper.Input("@CustomerId", dto.CustomerId ?? (object)DBNull.Value),
                    SqlParameterHelper.Input("@ProductId", dto.ProductId ?? (object)DBNull.Value),
                    SqlParameterHelper.Input("@PartName", dto.PartName ?? (object)DBNull.Value),
                    SqlParameterHelper.Input("@PartSerialNumber", dto.PartSerialNumber ?? (object)DBNull.Value),
                    SqlParameterHelper.Input("@Notes", dto.Notes ?? (object)DBNull.Value)
                };

                var dt = await GetDataTableAsync("sp_RepairPartRequest_Create", p);

                if (dt == null || dt.Rows.Count == 0)
                    return ApiResponse<int>.Fail("Failed to create repair part request");

                var id = Convert.ToInt32(dt.Rows[0][0]);

                return ApiResponse<int>.Ok(id, "Repair part request created successfully");
            }
            catch (Exception ex)
            {
                return ApiResponse<int>.Fail($"Error creating repair part request: {ex.Message}");
            }
        }

        public async Task<ApiResponse<int>> SaveImage(int repairRequestId, string imagePath, string imageType)
        {
            try
            {
                var p = new[]
                {
                    SqlParameterHelper.Input("@RepairRequestId", repairRequestId),
                    SqlParameterHelper.Input("@ImagePath", imagePath),
                    SqlParameterHelper.Input("@ImageType", imageType)
                };

                var dt = await GetDataTableAsync("sp_RepairPartImage_Save", p);

                if (dt == null || dt.Rows.Count == 0)
                    return ApiResponse<int>.Fail("Failed to save image");

                var id = Convert.ToInt32(dt.Rows[0][0]);
                return ApiResponse<int>.Ok(id, "Image saved successfully");
            }
            catch (Exception ex)
            {
                return ApiResponse<int>.Fail($"Error saving image: {ex.Message}");
            }
        }

        public async Task<ApiResponse<List<RepairImageDto>>> GetImagesByRequest(int repairRequestId)
        {
            try
            {
                var p = new[] { SqlParameterHelper.Input("@RepairRequestId", repairRequestId) };
                var dt = await GetDataTableAsync("sp_RepairPart_GetImages", p);
                var list = dt.ToList<RepairImageDto>();
                return ApiResponse<List<RepairImageDto>>.Ok(list);
            }
            catch (Exception ex)
            {
                return ApiResponse<List<RepairImageDto>>.Fail(ex.Message);
            }
        }

        public async Task<ApiResponse<string>> GetImageBase64(int imageId)
        {
            try
            {
                var p = new[] { SqlParameterHelper.Input("@ImageId", imageId) };
                var dt = await GetDataTableAsync("sp_RepairPart_GetImageBase64", p);
                if (dt == null || dt.Rows.Count == 0) return ApiResponse<string>.Fail("Image not found");
                var base64 = dt.Rows[0]["ImagePath"]?.ToString() ?? "";
                return ApiResponse<string>.Ok(base64);
            }
            catch (Exception ex)
            {
                return ApiResponse<string>.Fail(ex.Message);
            }
        }
    }
}
