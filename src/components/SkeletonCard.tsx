export default function SkeletonCard() {
  return (
    <div className="rounded-2xl overflow-hidden bg-card border border-border/30">
      {/* Image skeleton */}
      <div className="aspect-[4/3] skeleton" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="h-5 w-3/4 skeleton" />
        <div className="h-3 w-1/2 skeleton" />
        <div className="flex justify-between">
          <div className="h-4 w-16 skeleton" />
          <div className="h-4 w-12 skeleton" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
