export default function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-card border border-border/60 shadow-sm">
      {/* Left Thumbnail Skeleton */}
      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl skeleton shrink-0" />

      {/* Right Content Skeleton */}
      <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5 gap-2">
        <div>
          {/* Name + price */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="h-4 w-10 skeleton rounded shrink-0" />
          </div>
          {/* District + address */}
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-14 skeleton rounded" />
            <div className="h-3 w-2/3 skeleton rounded" />
          </div>
        </div>
        {/* Review snippet */}
        <div className="h-3 w-5/6 skeleton rounded" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
