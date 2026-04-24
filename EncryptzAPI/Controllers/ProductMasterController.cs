using EncryptzBL.DTO_s;
using EncryptzBL.DTO_s.EncryptzBL.DTO_s;
using EncryptzBL.Infrastructure.Products.Modules;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace EncryptzAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ProductMasterController : ControllerBase
    {
        private readonly IProductMasterService _productMasterService;

        public ProductMasterController(IProductMasterService productMasterService)
        {
            _productMasterService = productMasterService;
        }

        [HttpPost("create")]
        public async Task<IActionResult> Create([FromBody] ProductMasterRequestDto dto)
        {
            var result = await _productMasterService.CreateProduct(dto);
            return Ok(result);
        }

        [HttpPut("{id}/update")]
        public async Task<IActionResult> Update(int id, [FromBody] ProductMasterRequestDto dto)
        {
            dto.ProductMasterId = id;
            var result = await _productMasterService.UpdateProduct(dto);
            return Ok(result);
        }

        [HttpDelete("{id}/delete")]
        public async Task<IActionResult> Delete(int id)
        {
            var userId = GetUserId();
            var result = await _productMasterService.DeleteProduct(id, userId);
            return Ok(result);
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            var result = await _productMasterService.GetProductById(id);
            return Ok(result);
        }

        [HttpGet("all")]
        public async Task<IActionResult> GetAll([FromQuery] ProductMasterRequestDto dto)
        {
            var result = await _productMasterService.GetAllProducts(dto);
            return Ok(result);
        }

        [HttpGet("dropdowns")]
        public async Task<IActionResult> GetDropdowns()
        {
            var result = await _productMasterService.GetDropdownData();
            return Ok(result);
        }

        [HttpGet("list")]
        public async Task<IActionResult> GetList([FromQuery] string? searchTerm = null, int page = 1, int pageSize = 50)
        {
            var result = await _productMasterService.GetProductList(searchTerm, page, pageSize);
            return Ok(ApiResponse<List<ProductMaster>>.Ok(result));
        }

        [HttpPost("bulk-delete")]
        public async Task<IActionResult> BulkDelete([FromBody] BulkOperationDto dto)
        {
            var userId = GetUserId();
            var result = await _productMasterService.BulkDeleteProducts(dto.Ids, userId);
            return Ok(result);
        }

        [HttpPost("bulk-update-status")]
        public async Task<IActionResult> BulkUpdateStatus([FromBody] BulkUpdateStatusDto dto)
        {
            var userId = GetUserId();
            var result = await _productMasterService.BulkUpdateStatus(dto.Ids, dto.IsActive, userId);
            return Ok(result);
        }

        private int GetUserId()
        {
            var userIdClaim = User.FindFirst("UserId") ?? User.FindFirst(ClaimTypes.NameIdentifier);
            return userIdClaim != null ? int.Parse(userIdClaim.Value) : 1;
        }
    }

    public class BulkOperationDto
    {
        public List<int> Ids { get; set; } = new();
    }

    public class BulkUpdateStatusDto
    {
        public List<int> Ids { get; set; } = new();
        public bool IsActive { get; set; }
    }
}
