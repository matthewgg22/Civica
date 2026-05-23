// Nightly USDA SNAP Retailer Locator sync.
//
// What this module does:
//   1. Fetches the current USDA SNAP-authorized retailer list (via an
//      injected UsdaRetailerFetcher — stubbed until the live endpoint
//      is verified).
//   2. Upserts each record into public.find_help_locations with
//      source = 'usda', keyed by (source, external_id).
//   3. Maintains a heartbeat in public.find_help_sources so an operator
//      can see when the cron last ran, succeeded, or failed.
//
// Stub mode: StubUsdaRetailerFetcher returns []. The sync still runs
// against Supabase (it touches find_help_sources) so the cron is
// observable even before live data ingest lands. Swap in a live
// fetcher implementation once the USDA endpoint URL + field map is
// verified.
//
// Type note: find_help_locations and find_help_sources are not yet in
// @civica/db-types. The SupabaseClient is intentionally un-typed here;
// once those tables are codegen'd we can tighten the signature.

import type { SupabaseClient } from "@supabase/supabase-js";

export interface UsdaRetailerRecord {
  /** USDA SNAP authorization number — primary key in the source feed. */
  usdaAuthorizationNumber: string;
  storeName: string;
  storeType?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state: string;
  zip?: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface UsdaRetailerFetcher {
  fetchAll(): Promise<UsdaRetailerRecord[]>;
}

/**
 * Stand-in fetcher used until the live USDA endpoint is verified.
 * Returns an empty list. The sync still updates find_help_sources so
 * the cron is observable end-to-end.
 */
export class StubUsdaRetailerFetcher implements UsdaRetailerFetcher {
  async fetchAll(): Promise<UsdaRetailerRecord[]> {
    return [];
  }
}

export interface SyncResult {
  attempted: number;
  upserted: number;
  errored: number;
  durationMs: number;
  mode: "stub" | "live";
}

export interface SyncDeps {
  fetcher: UsdaRetailerFetcher;
  supabase: SupabaseClient;
  log: (
    level: "info" | "warn" | "error",
    msg: string,
    extra?: Record<string, unknown>,
  ) => void;
  /** Override for deterministic testing. */
  now?: () => Date;
}

const UPSERT_BATCH = 500;

export async function syncUsdaRetailers(deps: SyncDeps): Promise<SyncResult> {
  const { fetcher, supabase, log, now = () => new Date() } = deps;
  const startedAt = now();
  const mode: SyncResult["mode"] =
    fetcher instanceof StubUsdaRetailerFetcher ? "stub" : "live";

  // Tables are not in @civica/db-types yet; cast through `any` until we
  // codegen them. Scope is localized to this file.
  const sources = supabase.from("find_help_sources") as unknown as ReturnType<
    SupabaseClient["from"]
  >;
  const locations = supabase.from("find_help_locations") as unknown as ReturnType<
    SupabaseClient["from"]
  >;

  // Heartbeat: mark the attempt up-front so a hung fetch is visible.
  await sources
    .update({
      last_synced_at: startedAt.toISOString(),
      updated_at: startedAt.toISOString(),
    })
    .eq("source", "usda");

  let records: UsdaRetailerRecord[];
  try {
    records = await fetcher.fetchAll();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("error", "USDA sync: fetch failed", { error: message });
    await sources
      .update({
        last_error: message,
        updated_at: now().toISOString(),
      })
      .eq("source", "usda");
    return {
      attempted: 0,
      upserted: 0,
      errored: 0,
      durationMs: now().getTime() - startedAt.getTime(),
      mode,
    };
  }

  if (records.length === 0) {
    log("info", "USDA sync: zero records (stub mode or empty source)", { mode });
    await sources
      .update({
        last_succeeded_at: now().toISOString(),
        last_error: null,
        updated_at: now().toISOString(),
      })
      .eq("source", "usda");
    return {
      attempted: 0,
      upserted: 0,
      errored: 0,
      durationMs: now().getTime() - startedAt.getTime(),
      mode,
    };
  }

  let upserted = 0;
  let errored = 0;
  for (let offset = 0; offset < records.length; offset += UPSERT_BATCH) {
    const slice = records.slice(offset, offset + UPSERT_BATCH);
    const nowIso = now().toISOString();
    const rows = slice.map((r) => ({
      external_id: r.usdaAuthorizationNumber,
      source: "usda" as const,
      name: r.storeName,
      address_line_1: r.addressLine1 ?? null,
      city: r.city ?? null,
      state: r.state,
      zip: r.zip ?? null,
      latitude: r.latitude,
      longitude: r.longitude,
      service_types: ["ebt_retailer"],
      civica_last_synced_at: nowIso,
      updated_at: nowIso,
      active: true,
    }));
    const { error } = await locations.upsert(rows, {
      onConflict: "source,external_id",
    });
    if (error) {
      log("error", "USDA sync: upsert batch failed", {
        batchOffset: offset,
        batchSize: slice.length,
        error: error.message,
      });
      errored += slice.length;
    } else {
      upserted += slice.length;
    }
  }

  const finishedAt = now();
  await sources
    .update({
      last_succeeded_at: errored === 0 ? finishedAt.toISOString() : null,
      last_error:
        errored === 0
          ? null
          : `${errored} of ${records.length} records failed to upsert`,
      updated_at: finishedAt.toISOString(),
    })
    .eq("source", "usda");

  log("info", "USDA sync complete", {
    mode,
    attempted: records.length,
    upserted,
    errored,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  return {
    attempted: records.length,
    upserted,
    errored,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    mode,
  };
}
