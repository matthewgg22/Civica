import Link from "next/link";

export interface FilterOption {
  key: string;
  label: string;
  count: number;
}

export default function FilterChips({
  options,
  active,
}: {
  options: FilterOption[];
  active: string;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {options.map((opt) => {
        const isActive = opt.key === active;
        return (
          <Link
            key={opt.key}
            href={opt.key === "all" ? "/packets" : `/packets?filter=${opt.key}`}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              isActive
                ? "bg-teal text-white border border-teal"
                : "bg-surface border border-hairline text-graphite hover:border-graphite"
            }`}
          >
            {opt.label}
            <span className={`tabular-nums text-[11px] ${isActive ? "text-white/70" : "text-muted"}`}>
              {opt.count}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
