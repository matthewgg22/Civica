import { Skeleton } from "../../../components/Skeleton";

export default function PacketDetailLoading() {
  return (
    <div className="min-h-screen bg-paper">
      {/* Back header */}
      <header className="bg-surface border-b border-hairline px-8 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-px" />
          <Skeleton className="h-4 w-16" />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-8 py-8 space-y-5">
        {/* Hero card */}
        <div className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          <Skeleton className="h-1 w-full rounded-none" />
          <div className="p-8 space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-6 w-28 rounded-full" />
            <div className="pt-5 border-t border-hairline">
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>

        {/* Status transition section */}
        <div className="bg-surface border border-hairline rounded-[4px] p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-80" />
          <Skeleton className="h-10 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
        </div>

        {/* Documents section */}
        <div className="bg-surface border border-hairline rounded-[4px] p-6 space-y-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-4 w-72" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={`flex items-center justify-between py-3.5 ${i > 0 ? "border-t border-hairline" : ""}`}>
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>

        {/* Notes section */}
        <div className="bg-surface border border-hairline rounded-[4px] p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-64" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
