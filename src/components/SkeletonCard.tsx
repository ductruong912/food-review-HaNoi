export default function SkeletonCard() {
  return (
    <div aria-hidden="true" className="flex min-h-32 items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-sm">
      {/* Left Thumbnail Skeleton */}
      <div className="h-28 w-24 rounded-xl skeleton shrink-0" />

      {/* Right Content Skeleton */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5 gap-2">
        <div>
          {/* Name + price */}
          <div className="mb-1.5 h-3 w-2/5 rounded skeleton" />
          <div className="mb-2 h-4 w-3/4 rounded skeleton" />
          <div className="h-3 w-1/2 rounded skeleton" />
        </div>
        <div className="space-y-1.5"><div className="h-3 w-2/3 rounded skeleton" /><div className="h-3 w-5/6 rounded skeleton" /></div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2" role="status" aria-label="Đang tải danh sách quán">
      <span className="sr-only">Đang tải danh sách quán</span>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
