import { cookies } from "next/headers";
import Link from "next/link";
import { createServerClientFromCookies } from "../../lib/supabase";
import AppHeader from "../../components/AppHeader";
import { decryptDemoName, firstNameLastInitial, formatDate, shortId } from "../../lib/format";

export const dynamic = "force-dynamic";

const RECERT_MONTHS = 12;
const EXPIRING_WINDOW_DAYS = 30;

type Bucket = "active" | "expiring" | "expired" | "recertified";

const BUCKET_META: Record<Bucket, { label: string; description: string; accent: string; bg: string; border: string }> = {
  active:       { label: "Active",        description: "Benefits in force, recertification not yet due.",                                  accent: "text-teal",   bg: "bg-teal/10",   border: "border-l-teal" },
  expiring:     { label: "Expiring Soon", description: `Recertification due within ${EXPIRING_WINDOW_DAYS} days — action needed.`,         accent: "text-amber",  bg: "bg-amber/15",  border: "border-l-amber" },
  expired:      { label: "Recert Overdue",description: "Recertification window has passed; benefits at risk.",                              accent: "text-brick",  bg: "bg-brick/15",  border: "border-l-brick" },
  recertified:  { label: "Recertified",   description: "Successfully recertified — new benefit period begun.",                              accent: "text-indigo", bg: "bg-indigo/10", border: "border-l-indigo" },
};

export default async function EnrollmentsPage({ searchParams }: { searchParams: Promise<{ bucket?: Bucket; q?: string }> }) {
  const params = await searchParams;
  const activeBucket = (params.bucket as Bucket) ?? "all" as Bucket;
  const query = params.q?.trim() ?? "";
  const queryLower = query.toLowerCase();
  const cookieStore = await cookies();
  const supabase = createServerClientFromCookies(cookieStore);
  const { data: { user } } = await supabase.auth.getUser();

  const { data: packets } = await supabase
    .schema("snap_enrollment")
    .from("snap_packets")
    .select("packet_id, status, county, state_code, handed_off_at, closed_at, applicants(full_name_ciphertext, preferred_language)")
    .in("status", ["Handed Off", "Closed"])
    .is("deleted_at", null)
    .order("handed_off_at", { ascending: false })
    .limit(500);

  const now = Date.now();
  const oneMonthMs = 30 * 24 * 60 * 60 * 1000;

  type Row = {
    packet_id: string;
    name: string;
    county: string | null;
    state_code: string;
    handed_off_at: string | null;
    bucket: Bucket;
    daysToRecert: number; // negative if overdue
    recertDate: Date | null;
  };

  const rows: Row[] = (packets ?? []).map((p) => {
    const name = p.applicants ? firstNameLastInitial(decryptDemoName(p.applicants.full_name_ciphertext)) : "Unknown";
    const handed = p.handed_off_at ? new Date(p.handed_off_at) : null;
    const recertDate = handed ? new Date(handed.getTime() + RECERT_MONTHS * oneMonthMs) : null;
    const daysToRecert = recertDate ? Math.floor((recertDate.getTime() - now) / (24 * 60 * 60 * 1000)) : 0;

    let bucket: Bucket;
    if (p.status === "Closed") bucket = "recertified";
    else if (!recertDate) bucket = "active";
    else if (daysToRecert < 0) bucket = "expired";
    else if (daysToRecert <= EXPIRING_WINDOW_DAYS) bucket = "expiring";
    else bucket = "active";

    return {
      packet_id: p.packet_id,
      name,
      county: p.county,
      state_code: p.state_code,
      handed_off_at: p.handed_off_at,
      bucket,
      daysToRecert,
      recertDate,
    };
  });

  const counts: Record<Bucket, number> = {
    active: rows.filter((r) => r.bucket === "active").length,
    expiring: rows.filter((r) => r.bucket === "expiring").length,
    expired: rows.filter((r) => r.bucket === "expired").length,
    recertified: rows.filter((r) => r.bucket === "recertified").length,
  };

  const bucketFiltered = (activeBucket as string) === "all"
    ? rows
    : rows.filter((r) => r.bucket === activeBucket);
  const filtered = queryLower
    ? bucketFiltered.filter((r) =>
        r.name.toLowerCase().includes(queryLower) ||
        (r.county ?? "").toLowerCase().includes(queryLower) ||
        shortId(r.packet_id).toLowerCase().includes(queryLower)
      )
    : bucketFiltered;

  // Sort: expired first (most urgent), then expiring (soonest), then active (soonest to recert), then recertified (most recent)
  filtered.sort((a, b) => {
    const order: Record<Bucket, number> = { expired: 0, expiring: 1, active: 2, recertified: 3 };
    if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
    return a.daysToRecert - b.daysToRecert;
  });

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader email={user?.email} active="enrollments" />
      <main className="max-w-6xl mx-auto px-8 py-8 space-y-5">
        <div>
          <p className="eyebrow mb-1.5">Enrollments</p>
          <h2 className="text-[28px] font-semibold tracking-tight leading-tight text-ink">Benefit Period Tracker</h2>
          <p className="text-[15px] text-graphite mt-1.5">
            Every enrolled household, sorted by recertification urgency. SNAP recertification cycle: {RECERT_MONTHS} months.
          </p>
        </div>

        {/* Bucket summary cards (also filter chips when clicked) */}
        <div className="grid grid-cols-4 gap-4">
          {(["expired", "expiring", "active", "recertified"] as Bucket[]).map((b) => {
            const meta = BUCKET_META[b];
            const isActive = activeBucket === b;
            const href = isActive ? "/enrollments" : `/enrollments?bucket=${b}`;
            return (
              <Link
                key={b}
                href={href}
                className={`block ${meta.bg} border-l-4 ${meta.border} border-y border-r border-hairline rounded-[4px] px-5 py-4 transition-all hover:shadow-sm ${isActive ? "ring-2 ring-ink/20" : ""}`}
              >
                <p className={`text-[36px] font-bold tabular-nums leading-none ${meta.accent}`}>{counts[b]}</p>
                <p className="text-[15px] font-bold text-ink mt-2.5">{meta.label}</p>
                <p className="text-[13px] text-graphite mt-1.5 leading-snug">{meta.description}</p>
              </Link>
            );
          })}
        </div>

        {/* Search + active-filter chip */}
        <div className="flex items-center gap-3 flex-wrap">
          <form method="get" className="relative flex-1 max-w-md">
            {(activeBucket as string) !== "all" && (
              <input type="hidden" name="bucket" value={activeBucket} />
            )}
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-[14px]">⌕</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by household, county, or packet ID…"
              className="w-full bg-surface border border-hairline rounded-[3px] pl-9 pr-3 py-2 text-[14px] focus:outline-none focus:border-teal focus:ring-2 focus:ring-teal/15 transition-all"
            />
          </form>
          {(activeBucket as string) !== "all" && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-graphite">Filter:</span>
              <span className={`font-semibold ${BUCKET_META[activeBucket].accent}`}>{BUCKET_META[activeBucket].label}</span>
              <Link
                href={query ? `/enrollments?q=${encodeURIComponent(query)}` : "/enrollments"}
                className="text-teal hover:underline font-medium"
              >
                clear ×
              </Link>
            </div>
          )}
          {query && (
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-graphite">Searching:</span>
              <span className="font-semibold text-ink">"{query}"</span>
              <Link
                href={(activeBucket as string) === "all" ? "/enrollments" : `/enrollments?bucket=${activeBucket}`}
                className="text-teal hover:underline font-medium"
              >
                clear ×
              </Link>
            </div>
          )}
          <span className="text-[12px] text-muted tabular-nums ml-auto">
            {filtered.length} of {rows.length} enrollments
          </span>
        </div>

        {/* List */}
        <section className="bg-surface border border-hairline rounded-[4px] overflow-hidden">
          <div
            className="grid gap-4 px-6 py-3 bg-paper border-b border-hairline text-[12px] uppercase tracking-wider font-bold text-ink"
            style={{ gridTemplateColumns: "1.4fr 0.9fr 1fr 1.4fr auto" }}
          >
            <div>Household</div>
            <div>County</div>
            <div>Enrolled</div>
            <div>Time to Recertification</div>
            <div></div>
          </div>
          {filtered.length === 0 ? (
            <p className="px-6 py-10 text-center text-[14px] text-muted">No enrollments in this bucket.</p>
          ) : (
            filtered.slice(0, 200).map((r, i) => (
              <Link
                key={r.packet_id}
                href={`/packets/${r.packet_id}`}
                style={{ gridTemplateColumns: "1.4fr 0.9fr 1fr 1.4fr auto" }}
                className={`grid gap-4 px-6 py-3.5 items-center hover:bg-paper transition-colors ${i > 0 ? "border-t-2 border-[#EDE7DA]" : ""}`}
              >
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[16px] font-bold text-ink truncate">{r.name}</span>
                  <span className="text-[11px] text-graphite font-mono tabular-nums shrink-0">{shortId(r.packet_id)}</span>
                </div>
                <div className="text-[14px] text-ink font-medium truncate">{r.county ?? "—"}, {r.state_code}</div>
                <div className="text-[14px] text-ink tabular-nums font-medium">{r.handed_off_at ? formatDate(r.handed_off_at) : "—"}</div>
                <div>
                  <Countdown bucket={r.bucket} days={r.daysToRecert} recertDate={r.recertDate} />
                </div>
                <span className="text-muted text-[18px]">›</span>
              </Link>
            ))
          )}
          {filtered.length > 200 && (
            <p className="px-6 py-3 text-[12px] text-muted text-center border-t border-hairline bg-paper/50">
              Showing 200 of {filtered.length} · refine via the summary cards above
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

function Countdown({ bucket, days, recertDate }: { bucket: Bucket; days: number; recertDate: Date | null }) {
  // Recertified packets don't show a countdown
  if (bucket === "recertified") {
    return (
      <div className="flex items-center gap-2.5">
        <span className="inline-block w-2 h-2 rounded-full bg-indigo" />
        <div>
          <p className="text-[14px] font-semibold text-indigo">Recertified</p>
          <p className="text-[11px] text-muted">new cycle started</p>
        </div>
      </div>
    );
  }

  // % of 12-month cycle elapsed (clamped 0–100 for the bar; "over 100" gets a separate visual)
  const totalDays = RECERT_MONTHS * 30;
  const elapsedDays = totalDays - days;
  const pctElapsed = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100));

  const isOverdue = bucket === "expired";
  const isExpiring = bucket === "expiring";

  const numberColor = isOverdue ? "text-brick" : isExpiring ? "text-amber" : "text-ink";
  const barColor    = isOverdue ? "bg-brick"   : isExpiring ? "bg-amber"   : "bg-teal";

  // Numeric display: "32d" for upcoming, "−18d" for overdue
  const displayDays = isOverdue ? `−${Math.abs(days)}` : `${days}`;
  const subLabel = isOverdue
    ? "days past recert"
    : isExpiring
      ? "days until recert · ACTION SOON"
      : "days until recert";

  return (
    <div className="min-w-0">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className={`text-[26px] font-bold tabular-nums leading-none ${numberColor}`}>{displayDays}</span>
        <span className="text-[14px] text-graphite font-semibold">d</span>
        {recertDate && (
          <span className="text-[12px] text-graphite tabular-nums ml-auto font-medium">
            {isOverdue ? "due" : "by"} {recertDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
      <div className="relative rounded-full overflow-hidden" style={{ height: 8, background: "#E8E2D5" }}>
        <div
          className={`absolute inset-y-0 left-0 ${barColor}`}
          style={{ width: `${pctElapsed}%` }}
        />
        {isOverdue && (
          <div className="absolute inset-y-0 right-0 w-1 bg-brick animate-pulse" />
        )}
      </div>
      <p className={`text-[11px] uppercase tracking-wider font-bold mt-1.5 ${
        isOverdue ? "text-brick" : isExpiring ? "text-amber" : "text-graphite"
      }`}>
        {subLabel}
      </p>
    </div>
  );
}
