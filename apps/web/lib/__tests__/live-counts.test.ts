// The count feeding the hero tally. One number, three obligations:
//   - counts ONLY mode="public" rows of snap_enrollment.mae_query_log — eval
//     runs write the same table and must never inflate the public figure;
//   - any failure (query error, thrown client, missing env) resolves to null,
//     and null keeps the tally dormant — a broken counter must degrade to
//     silence, never to a stale or invented number;
//   - the fetch never throws into the page render.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  result: { count: null as number | null, error: null as { message: string } | null },
  throwOnClient: false,
  filters: [] as [string, string][],
}));

vi.mock("../supabase-server", () => ({
  supabaseAdmin: () => {
    if (state.throwOnClient) throw new Error("missing env");
    const chain = {
      schema: (s: string) => {
        state.filters.push(["schema", s]);
        return chain;
      },
      from: (t: string) => {
        state.filters.push(["from", t]);
        return chain;
      },
      select: () => chain,
      eq: (col: string, val: string) => {
        state.filters.push(["eq", `${col}=${val}`]);
        return Promise.resolve(state.result);
      },
    };
    return chain;
  },
}));

import { publicQuestionCount } from "../live-counts";

beforeEach(() => {
  state.result = { count: null, error: null };
  state.throwOnClient = false;
  state.filters = [];
});

describe("publicQuestionCount", () => {
  it("returns the count of public-mode audit rows", async () => {
    state.result = { count: 62, error: null };
    await expect(publicQuestionCount()).resolves.toBe(62);
    expect(state.filters).toContainEqual(["schema", "snap_enrollment"]);
    expect(state.filters).toContainEqual(["from", "mae_query_log"]);
    expect(state.filters).toContainEqual(["eq", "mode=public"]);
  });

  it("resolves null on a query error", async () => {
    state.result = { count: 12, error: { message: "permission denied" } };
    await expect(publicQuestionCount()).resolves.toBeNull();
  });

  it("resolves null when the client cannot even be constructed", async () => {
    state.throwOnClient = true;
    await expect(publicQuestionCount()).resolves.toBeNull();
  });
});
