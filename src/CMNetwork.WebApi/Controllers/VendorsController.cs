using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/vendors")]
[Authorize(Roles = "accountant,cfo,super-admin,auditor")]
public class VendorsController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;

    public VendorsController(CMNetworkDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetVendors([FromQuery] bool? isActive = null)
    {
        var query = _dbContext.Vendors.AsQueryable();

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        var items = await query
            .OrderBy(x => x.VendorCode)
            .Select(x => new
            {
                x.Id,
                x.VendorCode,
                x.Name,
                x.ContactPerson,
                x.Email,
                x.PhoneNumber,
                x.City,
                x.Country,
                x.TaxId,
                x.CreditLimit,
                x.PaymentTerms,
                x.IsActive,
                x.CreatedUtc,
                x.LastUpdatedUtc
            })
            .ToListAsync();

        return Ok(items);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetVendor(Guid id)
    {
        var vendor = await _dbContext.Vendors
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.VendorCode,
                x.Name,
                x.ContactPerson,
                x.Email,
                x.PhoneNumber,
                x.Address,
                x.City,
                x.State,
                x.PostalCode,
                x.Country,
                x.TaxId,
                x.CreditLimit,
                x.PaymentTerms,
                x.IsActive,
                x.CreatedUtc,
                x.LastUpdatedUtc
            })
            .FirstOrDefaultAsync();

        if (vendor == null)
            return NotFound(new { message = "Vendor not found." });

        return Ok(vendor);
    }

    [HttpPost]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CreateVendor([FromBody] CreateVendorRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var exists = await _dbContext.Vendors.AnyAsync(x => x.VendorCode == request.VendorCode);
        if (exists)
            return Conflict(new { message = "Vendor code already exists." });

        var vendor = new Vendor
        {
            Id = Guid.NewGuid(),
            VendorCode = request.VendorCode.Trim(),
            Name = request.Name.Trim(),
            ContactPerson = request.ContactPerson?.Trim(),
            Email = request.Email?.Trim(),
            PhoneNumber = request.PhoneNumber?.Trim(),
            Address = request.Address?.Trim(),
            City = request.City?.Trim(),
            State = request.State?.Trim(),
            PostalCode = request.PostalCode?.Trim(),
            Country = request.Country?.Trim(),
            TaxId = request.TaxId?.Trim(),
            CreditLimit = request.CreditLimit,
            PaymentTerms = request.PaymentTerms?.Trim(),
            IsActive = true,
            CreatedUtc = DateTime.UtcNow
        };

        _dbContext.Vendors.Add(vendor);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetVendor), new { id = vendor.Id }, new
        {
            vendor.Id,
            vendor.VendorCode,
            vendor.Name,
            vendor.ContactPerson,
            vendor.Email,
            vendor.PhoneNumber,
            vendor.City,
            vendor.Country,
            vendor.IsActive,
            vendor.CreatedUtc
        });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> UpdateVendor(Guid id, [FromBody] UpdateVendorRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var vendor = await _dbContext.Vendors.FirstOrDefaultAsync(x => x.Id == id);
        if (vendor == null)
            return NotFound(new { message = "Vendor not found." });

        // Check if vendor code is being changed and if new code already exists
        if (!vendor.VendorCode.Equals(request.VendorCode, StringComparison.OrdinalIgnoreCase))
        {
            var codeExists = await _dbContext.Vendors.AnyAsync(x => x.VendorCode == request.VendorCode && x.Id != id);
            if (codeExists)
                return Conflict(new { message = "Vendor code already exists." });
        }

        vendor.VendorCode = request.VendorCode.Trim();
        vendor.Name = request.Name.Trim();
        vendor.ContactPerson = request.ContactPerson?.Trim();
        vendor.Email = request.Email?.Trim();
        vendor.PhoneNumber = request.PhoneNumber?.Trim();
        vendor.Address = request.Address?.Trim();
        vendor.City = request.City?.Trim();
        vendor.State = request.State?.Trim();
        vendor.PostalCode = request.PostalCode?.Trim();
        vendor.Country = request.Country?.Trim();
        vendor.TaxId = request.TaxId?.Trim();
        vendor.CreditLimit = request.CreditLimit;
        vendor.PaymentTerms = request.PaymentTerms?.Trim();
        vendor.IsActive = request.IsActive;
        vendor.LastUpdatedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            vendor.Id,
            vendor.VendorCode,
            vendor.Name,
            vendor.ContactPerson,
            vendor.Email,
            vendor.PhoneNumber,
            vendor.City,
            vendor.Country,
            vendor.IsActive,
            vendor.LastUpdatedUtc
        });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> DeleteVendor(Guid id)
    {
        var vendor = await _dbContext.Vendors.FirstOrDefaultAsync(x => x.Id == id);
        if (vendor == null)
            return NotFound(new { message = "Vendor not found." });

        // Soft delete: set IsActive to false
        vendor.IsActive = false;
        vendor.LastUpdatedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Vendor deleted successfully." });
    }
}
