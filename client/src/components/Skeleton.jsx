// Placeholders that stand in for content while the first request is in flight.
// Each one mirrors the real element's box, so nothing jumps when data lands.

export function Skeleton({ width = '100%', height = 14, radius = 7, className = '' }) {
  return (
    <span
      className={`skeleton ${className}`.trim()}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}

export function SkeletonLines({ count = 3, widths = ['100%', '84%', '62%'] }) {
  return (
    <span className="skeleton-lines" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} width={widths[index % widths.length]} height={12} />
      ))}
    </span>
  );
}

// Every page skeleton carries the same live-region wrapper, so a screen reader
// hears "loading" once rather than reading a wall of empty boxes.
function Loading({ label, children }) {
  return (
    <div className="skeleton-page" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{label}</span>
      {children}
    </div>
  );
}

function KpiRowSkeleton() {
  return (
    <div className="kpi-row">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="card kpi" key={index}>
          <div className="kpi-head">
            <Skeleton width={34} height={34} radius={8} />
            <Skeleton width={index === 3 ? 128 : 86} height={13} />
          </div>
          <div className="kpi-figure">
            <Skeleton width={132} height={26} radius={8} />
            <Skeleton width={44} height={30} radius={6} />
          </div>
          <Skeleton width={104} height={11} />
        </div>
      ))}
    </div>
  );
}

function CardHeadSkeleton({ title = 150, tool = 84 }) {
  return (
    <div className="card-head">
      <span className="skeleton-title">
        <Skeleton width={19} height={19} radius={6} />
        <Skeleton width={title} height={15} />
      </span>
      <Skeleton width={tool} height={30} radius={9} />
    </div>
  );
}

function RowsSkeleton({ rows = 5, height = 44 }) {
  return (
    <span className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} height={height} radius={10} />
      ))}
    </span>
  );
}

export function OverviewSkeleton() {
  return (
    <Loading label="Loading your month">
      {/* The phone shows the hero card where the desktop shows the tiles, so the
          skeleton borrows the same visibility rules rather than inventing them. */}
      <section className="card hero-card">
        <Skeleton width={128} height={12} />
        <Skeleton width={196} height={30} radius={9} className="skeleton-hero-amount" />
        <div className="hero-split">
          <SkeletonLines count={2} widths={['70px', '104px']} />
          <SkeletonLines count={2} widths={['70px', '104px']} />
        </div>
      </section>

      <KpiRowSkeleton />
      <div className="overview-grid">
        <div className="overview-main">
          <section className="card">
            <CardHeadSkeleton title={112} tool={188} />
            <Skeleton height={300} radius={12} />
          </section>
          <section className="card">
            <CardHeadSkeleton title={186} tool={132} />
            <RowsSkeleton rows={5} height={46} />
          </section>
        </div>
        <div className="overview-side">
          <section className="card">
            <CardHeadSkeleton title={176} />
            <div className="skeleton-donut">
              <Skeleton width={152} height={152} radius="50%" />
              <SkeletonLines count={5} widths={['100%', '92%', '86%', '78%', '68%']} />
            </div>
          </section>
          <section className="card">
            <CardHeadSkeleton title={116} tool={64} />
            <Skeleton height={72} radius={12} />
          </section>
          <section className="card">
            <CardHeadSkeleton title={126} tool={64} />
            <RowsSkeleton rows={3} height={38} />
          </section>
        </div>
      </div>
    </Loading>
  );
}

export function TableSkeleton({ rows = 8 }) {
  return (
    <Loading label="Loading transactions">
      <section className="card">
        <CardHeadSkeleton title={132} tool={168} />
        <RowsSkeleton rows={rows} height={46} />
      </section>
    </Loading>
  );
}

export function ReportsSkeleton() {
  return (
    <Loading label="Loading reports">
      <KpiRowSkeleton />
      <div className="two-col">
        {[0, 1].map((index) => (
          <section className="card" key={index}>
            <CardHeadSkeleton title={132} tool={116} />
            <Skeleton height={220} radius={12} />
          </section>
        ))}
      </div>
      <section className="card">
        <CardHeadSkeleton title={148} tool={96} />
        <Skeleton height={220} radius={12} />
      </section>
    </Loading>
  );
}

export function CardsSkeleton({ count = 3, label = 'Loading' }) {
  return (
    <Loading label={label}>
      <div className="account-grid">
        {Array.from({ length: count }, (_, index) => (
          <section className="card" key={index}>
            <div className="account-head">
              <Skeleton width={38} height={38} radius={10} />
              <SkeletonLines count={2} widths={['120px', '84px']} />
            </div>
            <SkeletonLines count={3} widths={['100%', '88%', '70%']} />
          </section>
        ))}
      </div>
    </Loading>
  );
}

export default Skeleton;
