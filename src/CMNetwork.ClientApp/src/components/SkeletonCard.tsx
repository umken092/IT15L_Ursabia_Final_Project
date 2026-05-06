interface SkeletonCardProps {
  rows?: number
  showValue?: boolean
}

export const SkeletonCard = ({ rows = 3, showValue = false }: SkeletonCardProps) => (
  <div className="skeleton-card">
    <div className="skeleton skeleton-line short" />
    {showValue && <div className="skeleton skeleton-value" />}
    {Array.from({ length: rows }).map((_, i) => (
      <div
        key={i}
        className={`skeleton skeleton-line ${i % 3 === 0 ? 'full' : i % 3 === 1 ? 'medium' : 'short'}`}
      />
    ))}
  </div>
)

export const SkeletonKpiGrid = ({ count = 3 }: { count?: number }) => (
  <div className="dashboard-grid cols-3 dashboard-kpis-grid">
    {Array.from({ length: count }).map((_, i) => (
      <SkeletonCard key={i} rows={2} showValue />
    ))}
  </div>
)
