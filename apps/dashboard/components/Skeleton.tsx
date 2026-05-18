export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-hairline motion-safe:animate-pulse ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
