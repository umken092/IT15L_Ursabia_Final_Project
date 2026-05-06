namespace CMNetwork.Infrastructure.Identity;

public class RefreshToken
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresUtc { get; set; }
    public DateTime CreatedUtc { get; set; } = DateTime.UtcNow;
    public bool IsRevoked { get; set; }
    public string? ReplacedByToken { get; set; }
    public string? RevokedReason { get; set; }
    public DateTime? RevokedUtc { get; set; }
    public string? CreatedByIp { get; set; }

    public bool IsActive => !IsRevoked && DateTime.UtcNow < ExpiresUtc;

    public ApplicationUser User { get; set; } = null!;
}
