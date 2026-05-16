type Props = {
  completed: number;
  total: number;
  label?: string;
  size?: "sm" | "md";
};

export function ProgressBar({ completed, total, label, size = "md" }: Props) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const height = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="space-y-1">
      {label && (
        <p className="text-xs text-slate-500">{label}</p>
      )}
      <div
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
        className={`w-full overflow-hidden rounded-full bg-slate-100 ${height}`}
      >
        <div
          className="h-full rounded-full bg-slate-900 motion-safe:transition-all motion-safe:duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
