export const dynamic = "force-dynamic";

const ENROLLMENT_API =
  process.env.ENROLLMENT_API_URL ??
  process.env.NEXT_PUBLIC_ENROLLMENT_API_URL ??
  "http://localhost:8787";

const API_BASE =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:3001";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

type CheckResult = { name: string; ok: boolean; latencyMs: number; detail?: string };

async function probe(name: string, fn: () => Promise<void>): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    return {
      name,
      ok: false,
      latencyMs: Date.now() - start,
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

async function checks(): Promise<CheckResult[]> {
  return Promise.all([
    probe("enrollment-api", async () => {
      const r = await fetch(`${ENROLLMENT_API}/health`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json() as { ok?: boolean };
      if (!body.ok) throw new Error("ok != true");
    }),

    probe("apps-api", async () => {
      const r = await fetch(`${API_BASE}/healthz`, { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),

    probe("supabase-postgres", async () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("SUPABASE env vars not set");
      // Hit the Supabase REST health endpoint — returns 200 when Postgres is reachable.
      const r = await fetch(`${SUPABASE_URL}/rest/v1/`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
    }),
  ]);
}

export default async function HealthPage() {
  const results = await checks();
  const allOk = results.every((r) => r.ok);

  return (
    <div className="min-h-screen bg-paper p-10">
      <h1 className="text-2xl font-bold mb-2">System Health</h1>
      <p className="text-sm text-graphite mb-8">
        Checked at {new Date().toISOString()} — auto-refreshes on load.
      </p>

      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold mb-8 ${
          allOk ? "bg-teal/15 text-teal" : "bg-brick/15 text-brick"
        }`}
      >
        <span className={`w-2 h-2 rounded-full ${allOk ? "bg-teal" : "bg-brick"}`} />
        {allOk ? "All systems operational" : "Degraded — see table below"}
      </div>

      <table className="w-full max-w-xl border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-graphite text-xs uppercase tracking-wider">
            <th className="pb-2 pr-6 font-semibold">Service</th>
            <th className="pb-2 pr-6 font-semibold">Status</th>
            <th className="pb-2 pr-6 font-semibold">Latency</th>
            <th className="pb-2 font-semibold">Detail</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.name} className="border-b border-hairline last:border-0">
              <td className="py-3 pr-6 font-mono">{r.name}</td>
              <td className="py-3 pr-6">
                <span
                  className={`inline-flex items-center gap-1.5 font-semibold ${
                    r.ok ? "text-teal" : "text-brick"
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${r.ok ? "bg-teal" : "bg-brick"}`} />
                  {r.ok ? "ok" : "error"}
                </span>
              </td>
              <td className="py-3 pr-6 tabular-nums text-graphite">{r.latencyMs}ms</td>
              <td className="py-3 text-graphite">{r.detail ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
