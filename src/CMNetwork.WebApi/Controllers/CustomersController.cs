using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

[ApiController]
[Route("api/customers")]
[Authorize(Roles = "accountant,cfo,super-admin,auditor")]
public class CustomersController : ControllerBase
{
    private readonly CMNetworkDbContext _dbContext;

    public CustomersController(CMNetworkDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<IActionResult> GetCustomers([FromQuery] bool? isActive = null)
    {
        var query = _dbContext.Customers.AsQueryable();

        if (isActive.HasValue)
            query = query.Where(x => x.IsActive == isActive.Value);

        var items = await query
            .OrderBy(x => x.CustomerCode)
            .Select(x => new
            {
                x.Id,
                x.CustomerCode,
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
    public async Task<IActionResult> GetCustomer(Guid id)
    {
        var customer = await _dbContext.Customers
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id,
                x.CustomerCode,
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

        if (customer == null)
            return NotFound(new { message = "Customer not found." });

        return Ok(customer);
    }

    [HttpPost]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> CreateCustomer([FromBody] CreateCustomerRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var exists = await _dbContext.Customers.AnyAsync(x => x.CustomerCode == request.CustomerCode);
        if (exists)
            return Conflict(new { message = "Customer code already exists." });

        var customer = new Customer
        {
            Id = Guid.NewGuid(),
            CustomerCode = request.CustomerCode.Trim(),
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

        _dbContext.Customers.Add(customer);
        await _dbContext.SaveChangesAsync();

        return CreatedAtAction(nameof(GetCustomer), new { id = customer.Id }, new
        {
            customer.Id,
            customer.CustomerCode,
            customer.Name,
            customer.ContactPerson,
            customer.Email,
            customer.PhoneNumber,
            customer.City,
            customer.Country,
            customer.IsActive,
            customer.CreatedUtc
        });
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> UpdateCustomer(Guid id, [FromBody] UpdateCustomerRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(ModelState);

        var customer = await _dbContext.Customers.FirstOrDefaultAsync(x => x.Id == id);
        if (customer == null)
            return NotFound(new { message = "Customer not found." });

        // Check if customer code is being changed and if new code already exists
        if (!customer.CustomerCode.Equals(request.CustomerCode, StringComparison.OrdinalIgnoreCase))
        {
            var codeExists = await _dbContext.Customers.AnyAsync(x => x.CustomerCode == request.CustomerCode && x.Id != id);
            if (codeExists)
                return Conflict(new { message = "Customer code already exists." });
        }

        customer.CustomerCode = request.CustomerCode.Trim();
        customer.Name = request.Name.Trim();
        customer.ContactPerson = request.ContactPerson?.Trim();
        customer.Email = request.Email?.Trim();
        customer.PhoneNumber = request.PhoneNumber?.Trim();
        customer.Address = request.Address?.Trim();
        customer.City = request.City?.Trim();
        customer.State = request.State?.Trim();
        customer.PostalCode = request.PostalCode?.Trim();
        customer.Country = request.Country?.Trim();
        customer.TaxId = request.TaxId?.Trim();
        customer.CreditLimit = request.CreditLimit;
        customer.PaymentTerms = request.PaymentTerms?.Trim();
        customer.IsActive = request.IsActive;
        customer.LastUpdatedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new
        {
            customer.Id,
            customer.CustomerCode,
            customer.Name,
            customer.ContactPerson,
            customer.Email,
            customer.PhoneNumber,
            customer.City,
            customer.Country,
            customer.IsActive,
            customer.LastUpdatedUtc
        });
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "accountant,cfo,super-admin")]
    public async Task<IActionResult> DeleteCustomer(Guid id)
    {
        var customer = await _dbContext.Customers.FirstOrDefaultAsync(x => x.Id == id);
        if (customer == null)
            return NotFound(new { message = "Customer not found." });

        // Soft delete: set IsActive to false
        customer.IsActive = false;
        customer.LastUpdatedUtc = DateTime.UtcNow;

        await _dbContext.SaveChangesAsync();

        return Ok(new { message = "Customer deleted successfully." });
    }
}
