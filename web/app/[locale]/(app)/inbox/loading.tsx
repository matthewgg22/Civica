import { Skeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <div className="space-y-6">
      {/* Title + badge */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>

      {/* Section label */}
      <Skeleton className="h-3 w-24" />

      {/* Inbox item cards */}
      <ul className="space-y-3" aria-busy="true" aria-label="Loading inbox">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="rounded-xl border border-hairline bg-surface p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-4 w-full max-w-xs" />
                <Skeleton className="h-4 w-3/4 max-w-sm" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-32 rounded-lg shrink-0" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
