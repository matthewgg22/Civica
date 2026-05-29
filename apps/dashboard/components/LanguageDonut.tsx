const LANG_LABEL: Record<string, string> = {
  en: "English",
  es: "Spanish",
  zh: "Chinese",
  vi: "Vietnamese",
  tl: "Tagalog",
};

const PALETTE = ["#9C3A24", "#2A6F66", "var(--color-amber-dark)", "#4F46A5", "#5A544D"];

export default function LanguageDonut({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, n]) => s + n, 0);

  if (total === 0) {
    return <p className="text-[13px] text-muted">No applicants yet.</p>;
  }

  const r = 56;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-6">
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90 shrink-0">
        <circle cx="70" cy="70" r={r} fill="none" stroke="#F5F2EC" strokeWidth="18" />
        {entries.map(([code, n], i) => {
          const frac = n / total;
          const dash = frac * c;
          const seg = (
            <circle
              key={code}
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke={PALETTE[i % PALETTE.length]}
              strokeWidth="18"
              strokeDasharray={`${dash} ${c - dash}`}
              strokeDashoffset={-offset}
            />
          );
          offset += dash;
          return seg;
        })}
      </svg>
      <ul className="space-y-1.5 flex-1 min-w-0">
        {entries.map(([code, n], i) => {
          const pct = ((n / total) * 100).toFixed(0);
          return (
            <li key={code} className="flex items-center gap-2 text-[13px]">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PALETTE[i % PALETTE.length] }} />
              <span className="text-ink font-medium flex-1">{LANG_LABEL[code] ?? code.toUpperCase()}</span>
              <span className="text-muted tabular-nums">{n}</span>
              <span className="text-muted tabular-nums w-10 text-right">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
