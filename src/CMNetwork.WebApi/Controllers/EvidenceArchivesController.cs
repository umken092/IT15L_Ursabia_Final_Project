using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using CMNetwork.Domain.Entities;
using CMNetwork.Infrastructure.Persistence;
using CMNetwork.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CMNetwork.Controllers;

/// <summary>
/// Evidence Archive: lets the auditor package selected audit log entries
/// (and any free-form notes) into an integrity-stamped JSON file persisted on
/// disk under wwwroot/evidence/{yyyy}/{MM}/. A SHA-256 checksum is stored so
/// the archive can be verified later.
/// </summary>
[ApiController]
[Route("api/auditor/evidence-archives")]
[Authorize(Roles = "auditor,super-admin")]
public class EvidenceArchivesController : ControllerBase
{
    private readonly CMNetworkDbContext _db;
    private readonly IWebHostEnvironment _env;
    private readonly ICurrentUserService _currentUser;
    private readonly IAuditEventLogger _audit;

    public EvidenceArchivesController(
        CMNetworkDbContext db,
        IWebHostEnvironment env,
        ICurrentUserService currentUser,
        IAuditEventLogger audit)
    {
        _db = db;
        _env = env;
        _currentUser = currentUser;
        _audit = audit;
    }

    public sealed class CreateArchiveRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public List<Guid> AuditLogIds { get; set; } = new();
    }

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int take = 100)
    {
        if (take < 1) take = 1;
        if (take > 500) take = 500;

        var items = await _db.EvidenceArchives.AsNoTracking()
            .OrderByDescending(x => x.GeneratedUtc)
            .Take(take)
            .Select(x => new
            {
                id = x.Id,
                archiveNumber = x.ArchiveNumber,
                title = x.Title,
                description = x.Description,
                fileName = x.FileName,
                fileSizeBytes = x.FileSizeBytes,
                checksum = x.Checksum,
                entryCount = x.EntryCount,
                generatedBy = x.GeneratedBy,
                generatedByEmail = x.GeneratedByEmail,
                generatedUtc = x.GeneratedUtc,
            })
            .ToListAsync();

        return Ok(new { items });
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateArchiveRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }
        if (req.AuditLogIds is null || req.AuditLogIds.Count == 0)
        {
            return BadRequest(new { message = "At least one audit log entry must be selected." });
        }

        var ids = req.AuditLogIds.Distinct().ToList();
        var entries = await _db.AuditLogs.AsNoTracking()
            .Where(x => ids.Contains(x.Id))
            .OrderBy(x => x.CreatedUtc)
            .ToListAsync(ct);

        if (entries.Count == 0)
        {
            return BadRequest(new { message = "Selected audit log entries were not found." });
        }

        var now = DateTime.UtcNow;
        var archiveId = Guid.NewGuid();
        var archiveNumber = $"EVD-{now:yyyyMMdd}-{archiveId.ToString()[..8].ToUpperInvariant()}";

        var webRoot = _env.WebRootPath;
        if (string.IsNullOrEmpty(webRoot))
        {
            webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");
        }
        var relativeDir = Path.Combine("evidence", now.ToString("yyyy"), now.ToString("MM"));
        var absoluteDir = Path.Combine(webRoot, relativeDir);
        Directory.CreateDirectory(absoluteDir);

        var fileName = $"{archiveNumber}.json";
        var relativePath = Path.Combine(relativeDir, fileName).Replace('\\', '/');
        var absolutePath = Path.Combine(absoluteDir, fileName);

        var payload = new
        {
            archiveNumber,
            title = req.Title.Trim(),
            description = req.Description?.Trim(),
            generatedUtc = now,
            generatedBy = _currentUser.DisplayName,
            generatedByEmail = _currentUser.UserEmail,
            entryCount = entries.Count,
            entries = entries.Select(e => new
            {
                id = e.Id,
                createdUtc = e.CreatedUtc,
                category = e.ActionCategory,
                entityName = e.EntityName,
                action = e.Action,
                recordId = e.RecordId,
                performedBy = e.PerformedBy,
                userEmail = e.UserEmail,
                ipAddress = e.IpAddress,
                userAgent = e.UserAgent,
                isReviewed = e.IsReviewed,
                reviewedBy = e.ReviewedBy,
                reviewedDate = e.ReviewedDate,
                details = e.DetailsJson,
            }),
        };

        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions { WriteIndented = true });
        var bytes = Encoding.UTF8.GetBytes(json);
        await System.IO.File.WriteAllBytesAsync(absolutePath, bytes, ct);

        var checksum = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();

        var archive = new EvidenceArchive
        {
            Id = archiveId,
            ArchiveNumber = archiveNumber,
            Title = req.Title.Trim(),
            Description = req.Description?.Trim(),
            FilePath = relativePath,
            FileName = fileName,
            FileSizeBytes = bytes.LongLength,
            ContentType = "application/json",
            Checksum = checksum,
            EntryCount = entries.Count,
            IncludedAuditLogIdsJson = JsonSerializer.Serialize(entries.Select(e => e.Id)),
            GeneratedBy = _currentUser.DisplayName ?? "unknown",
            GeneratedByEmail = _currentUser.UserEmail,
            GeneratedUtc = now,
        };

        _db.EvidenceArchives.Add(archive);
        await _db.SaveChangesAsync(ct);

        await _audit.LogAsync(
            entityName: "EvidenceArchive",
            action: "Created",
            category: AuditCategories.Export,
            recordId: archive.Id.ToString(),
            details: new { archive.ArchiveNumber, archive.Title, archive.EntryCount, archive.Checksum },
            cancellationToken: ct);

        return Ok(new
        {
            id = archive.Id,
            archiveNumber = archive.ArchiveNumber,
            checksum = archive.Checksum,
            fileName = archive.FileName,
            fileSizeBytes = archive.FileSizeBytes,
            entryCount = archive.EntryCount,
        });
    }

    [HttpGet("{id:guid}/download")]
    public async Task<IActionResult> Download(Guid id, CancellationToken ct)
    {
        var archive = await _db.EvidenceArchives.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (archive is null) return NotFound();

        var absolutePath = ResolveAbsolutePath(archive);
        if (!System.IO.File.Exists(absolutePath))
        {
            return NotFound(new { message = "Archive file is missing on disk." });
        }

        await _audit.LogAsync(
            entityName: "EvidenceArchive",
            action: "Downloaded",
            category: AuditCategories.Export,
            recordId: archive.Id.ToString(),
            details: new { archive.ArchiveNumber },
            cancellationToken: ct);

        var stream = System.IO.File.OpenRead(absolutePath);
        return File(stream, archive.ContentType, archive.FileName);
    }

    [HttpGet("{id:guid}/verify")]
    public async Task<IActionResult> Verify(Guid id, CancellationToken ct)
    {
        var archive = await _db.EvidenceArchives.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (archive is null) return NotFound();

        var absolutePath = ResolveAbsolutePath(archive);
        if (!System.IO.File.Exists(absolutePath))
        {
            return Ok(new { ok = false, reason = "missing", expected = archive.Checksum });
        }

        var bytes = await System.IO.File.ReadAllBytesAsync(absolutePath, ct);
        var actual = Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
        var ok = string.Equals(actual, archive.Checksum, StringComparison.OrdinalIgnoreCase);

        return Ok(new
        {
            ok,
            expected = archive.Checksum,
            actual,
            verifiedUtc = DateTime.UtcNow,
        });
    }

    private string ResolveAbsolutePath(EvidenceArchive archive)
    {
        var webRoot = _env.WebRootPath;
        if (string.IsNullOrEmpty(webRoot))
        {
            webRoot = Path.Combine(_env.ContentRootPath, "wwwroot");
        }
        return Path.Combine(webRoot, archive.FilePath.Replace('/', Path.DirectorySeparatorChar));
    }
}
