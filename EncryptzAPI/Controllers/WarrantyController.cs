//using Microsoft.AspNetCore.Authorization;
//using Microsoft.AspNetCore.Http;
//using Microsoft.AspNetCore.Mvc;
//using System.Reflection;

//namespace EncryptzAPI.Controllers
//{
//    [ApiController]
//    [Route("api/[controller]")]
//    [Authorize]
//    public class WarrantyController : ControllerBase
//    {
//        private readonly AppDbContext _db;
//        public WarrantyController(AppDbContext db) => _db = db;

//        [HttpGet]
//        public async Task<IActionResult> GetAll()
//        {
//            var returns = await _db.WarrantyReturns
//                .Join(_db.Complaints, w => w.ComplaintId, c => c.ComplaintId, (w, c) => new { w, c })
//                .Join(_db.SpareParts, wc => wc.w.SparePartId, s => s.SparePartId, (wc, s) => new WarrantyReturnDto(
//                    wc.w.ReturnId, wc.w.ComplaintId, wc.c.ComplaintNumber,
//                    s.PartName, wc.w.OldPartSerialNumber, wc.w.ReturnStatus, wc.w.CreatedAt))
//                .ToListAsync();
//            return Ok(returns);
//        }

//        [HttpPost]
//        public async Task<IActionResult> Create([FromBody] WarrantyReturnCreateDto dto)
//        {
//            _db.WarrantyReturns.Add(new Models.WarrantyReturn
//            {
//                ComplaintId = dto.ComplaintId,
//                SparePartId = dto.SparePartId,
//                OldPartSerialNumber = dto.OldPartSerialNumber
//            });
//            await _db.SaveChangesAsync();
//            return Ok(new ApiResponse(true, "Warranty return created"));
//        }

//        [HttpPut("{id}/status")]
//        public async Task<IActionResult> UpdateStatus(int id, [FromBody] string status)
//        {
//            var wr = await _db.WarrantyReturns.FindAsync(id);
//            if (wr == null) return NotFound();
//            wr.ReturnStatus = status;
//            if (status == "Returned") wr.ReturnedAt = DateTime.UtcNow;
//            await _db.SaveChangesAsync();
//            return Ok(new ApiResponse(true, "Status updated"));
//        }
//    }

//}
