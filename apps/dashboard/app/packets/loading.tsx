import { Skeleton } from "../../components/Skeleton";

export default function PacketsLoading() {
  return (
    <div className="min-h-screen">
      {/* AppHeader placeholder */}
      <div className="border-b border-hairline bg-surface px-8 py-4 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <div className="flex gap-6">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-8 py-10">
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-hairline rounded-[4px] px-5 py-4 space-y-2">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>

        {/* Title area */}
        <div className="mb-6 space-y-2">
          <Skeleton className="h-3 w-12" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>

        {/* Filter chips */}
        <div className="mb-6 flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-full" />
          ))}
        </div>

        {/* Packet rows */}
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? "border-t border-hairline" : ""}`}
            >
              <Skeleton className="w-9 h-9 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="flex gap-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-3 w-20 rounded-full" />
              </div>
              <div className="text-right space-y-1 shrink-0">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
