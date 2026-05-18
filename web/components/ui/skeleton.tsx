import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded bg-hairline motion-safe:animate-pulse",
        className
      )}
      aria-hidden="true"
    />
  );
}
