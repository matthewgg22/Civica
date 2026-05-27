// Tests for the civicaEmit.qcEvaluations.byOrg reader — TODO-5 / T8.
//
// Uses the ANALYTICS_LOCAL_PARQUET_DIR override (despite the name; the local
// override also handles JSON globs for civica-emit). No DuckDB, no httpfs.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { qcEvaluationsByOrg } from "./civicaEmit";

let workDir: string;
let prevEnv: string | undefined;

const event = (
  overrides: Partial<{
    event_id: string;
    emitted_at: string;
    packet_id: string;
    applicant_id: string;
    org_id: string | null;
    county: string | null;
    state_code: string | null;
    packet_status: string | null;
    engine_version: string;
    tier: string;
    score: number | null;
    factors: string[];
    flow_signals: Array<{ flow: string; defensibility_score: string }>;
  }> = {},
) => ({
  schema_version: 1 as const,
  event_id: overrides.event_id ?? "11111111-1111-4111-8111-111111111111",
  emitted_at: overrides.emitted_at ?? "2026-05-27T10:00:00.000Z",
  packet_id: overrides.packet_id ?? "pkt-1",
  applicant_id: overrides.applicant_id ?? "app-1",
  org_id: overrides.org_id ?? "org-a",
  county: overrides.county ?? "Alameda",
  state_code: overrides.state_code ?? "CA",
  packet_status: overrides.packet_status ?? "In Navigator Review",
  engine_version: overrides.engine_version ?? "v0.2.0",
  tier: overrides.tier ?? "medium",
  score: overrides.score ?? 42,
  factors: overrides.factors ?? ["earned_income_unverified"],
  flow_signals: overrides.flow_signals ?? [
    { flow: "gig-income", defensibility_score: "weak" },
  ],
});

async function writeEvent(date: string, name: string, body: unknown) {
  const dir = join(workDir, "civica-emit", "qc-evaluations", `date=${date}`);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${name}.json`), JSON.stringify(body), "utf8");
}

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "civica-qc-emit-"));
  prevEnv = process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  process.env.ANALYTICS_LOCAL_PARQUET_DIR = workDir;
});

afterAll(async () => {
  if (prevEnv === undefined) {
    delete process.env.ANALYTICS_LOCAL_PARQUET_DIR;
  } else {
    process.env.ANALYTICS_LOCAL_PARQUET_DIR = prevEnv;
  }
  await rm(workDir, { recursive: true, force: true });
});

describe("civicaEmit.qcEvaluations.byOrg — local override", () => {
  it("returns empty when no partitions exist (pre-pilot state)", async () => {
    const { rows, provenance } = await qcEvaluationsByOrg({ orgId: "org-nothing" });
    expect(rows).toEqual([]);
    expect(provenance).toHaveLength(1);
    expect(provenance[0]!.source_kind).toBe("civica_qc_evaluation");
    expect(provenance[0]!.row_count).toBe(0);
  });

  it("filters events by org_id and returns only matching rows", async () => {
    await writeEvent("2026-05-27", "e1", event({ event_id: "e1", org_id: "org-a", packet_id: "p1" }));
    await writeEvent("2026-05-27", "e2", event({ event_id: "e2", org_id: "org-b", packet_id: "p2" }));
    await writeEvent("2026-05-27", "e3", event({ event_id: "e3", org_id: "org-a", packet_id: "p3" }));

    const { rows } = await qcEvaluationsByOrg({ orgId: "org-a" });
    expect(rows.map((r) => r.packet_id).sort()).toEqual(["p1", "p3"]);
    for (const row of rows) {
      expect(row.org_id).toBe("org-a");
    }
  });

  it("sorts results by emitted_at ascending across partitions", async () => {
    await writeEvent("2026-05-27", "later", event({
      event_id: "later",
      org_id: "org-time",
      packet_id: "p-later",
      emitted_at: "2026-05-27T20:00:00.000Z",
    }));
    await writeEvent("2026-05-26", "earlier", event({
      event_id: "earlier",
      org_id: "org-time",
      packet_id: "p-earlier",
      emitted_at: "2026-05-26T08:00:00.000Z",
    }));

    const { rows } = await qcEvaluationsByOrg({ orgId: "org-time" });
    expect(rows.map((r) => r.packet_id)).toEqual(["p-earlier", "p-later"]);
  });

  it("provenance row_count matches filtered row count, not total scanned", async () => {
    await writeEvent("2026-05-27", "x1", event({ event_id: "x1", org_id: "org-prov", packet_id: "px1" }));
    await writeEvent("2026-05-27", "x2", event({ event_id: "x2", org_id: "org-other", packet_id: "px2" }));

    const { rows, provenance } = await qcEvaluationsByOrg({ orgId: "org-prov" });
    expect(rows).toHaveLength(1);
    expect(provenance[0]!.row_count).toBe(1);
  });

  it("provenance source_url uses file:// scheme for local override", async () => {
    const { provenance } = await qcEvaluationsByOrg({ orgId: "org-prov" });
    expect(provenance[0]!.source_url).toMatch(/^file:\/\/.*civica-emit\/qc-evaluations$/);
  });

  it("throws if a stored event fails schema validation (catches emit-side drift)", async () => {
    await writeEvent("2026-05-27", "broken", {
      // schema_version omitted — should fail QcEvaluationSchema parse
      packet_id: "p-broken",
      org_id: "org-broken",
    });
    await expect(qcEvaluationsByOrg({ orgId: "org-broken" })).rejects.toThrow();
  });
});
