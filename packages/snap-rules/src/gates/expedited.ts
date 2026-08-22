// Expedited-service screening (7 CFR 273.2(i)).
//
// Issue #557: the dashboard's ExpeditedReviewGate re-derived expedited
// eligibility with a heuristic that captured only part of Path 1 —
//   employment_status === "unemployed" && gross < 150
// — with NO liquid-resources check (so it over-triggered for an unemployed
// household holding $500 in savings) and no Path 2 or Path 3 at all. A
// household earning $400/mo with $700 rent and $100 liquid qualifies for
// expedited service and would never have seen the gate.
//
// This is the canonical TypeScript port of the Python engine's
// _is_expedited_eligible (backend/civic_api/snap/rules/federal.py), so the two
// encodings agree. It exists in TS because the Python engine is not yet wired
// to the dashboard (0 prod rows), and the gate needs a correct answer now.
//
// WHY THIS MATTERS BEYOND CORRECTNESS: expedited households are legally owed
// benefits within 3 calendar days. In the CDSS Management Evaluation corpus
// (38 county reports, FFY2024-25) "ES-entitled household not screened or
// interviewed timely" appears 65 times — 41 of them on applications that were
// eventually APPROVED, i.e. households that qualified, were owed food in 3
// days, and waited 30 to 124. A screener that silently under-triggers
// reproduces the exact failure the counties are cited for.
//
// TRI-STATE ON PURPOSE: every path except Path 2 needs liquid resources, and
// the fixture schema allows assets to be an unauthored sentinel. Rather than
// defaulting unknown liquid to zero (which would over-trigger, the very bug in
// #557) or to infinity (which would under-trigger, the more harmful direction),
// an unknown value returns `needs_liquid_resources` together with the threshold
// that would decide it — so a navigator is told exactly what to go ask.

import type { Facts } from "../facts";
import { countableAssets } from "../facts";

/** Which federal path the household qualifies under. */
export type ExpeditedPath =
  /** 7 CFR 273.2(i)(1)(i) — gross < $150 and liquid <= $100. */
  | "low_income_low_resources"
  /** 7 CFR 273.2(i)(1)(iii) — gross + liquid < rent + utilities. */
  | "shelter_exceeds_resources"
  /** 7 CFR 273.2(i)(1)(ii) — destitute migrant/seasonal farmworker. */
  | "destitute_farmworker";

export type ExpeditedStatus =
  | "eligible"
  | "not_eligible"
  /** Cannot decide without countable liquid resources. */
  | "needs_liquid_resources";

export interface ExpeditedResult {
  status: ExpeditedStatus;
  /** Paths satisfied. Empty unless status is "eligible". */
  paths: ExpeditedPath[];
  /** Forward-looking gross: only income sources still paying. */
  effectiveGrossMonthly: number;
  /** Rent plus the entitled utility allowance (NOT actual utility cost). */
  shelterCost: number;
  /** Countable liquid resources, or null when unknown. */
  liquidResources: number | null;
  /**
   * When status is "needs_liquid_resources": the household qualifies if liquid
   * resources are at or below this figure. Null otherwise.
   */
  qualifyingLiquidCeiling: number | null;
  /** Plain-language explanation, safe to show a navigator. */
  explanation: string;
}

const PATH1_GROSS_LIMIT = 150;
const LIQUID_LIMIT = 100;
/** 7 CFR 273.10(e)(3): a new source paying more than this defeats "destitute". */
const DESTITUTE_NEW_SOURCE_LIMIT = 25;

/**
 * A source still paying. The v0.6 fixture marks ended sources
 * `source_status: "terminated"`; anything else (including absent) is treated as
 * ongoing, matching the Python engine where is_ongoing defaults True.
 */
function isOngoing(status: string | undefined): boolean {
  return status !== "terminated";
}

/**
 * Monthly gross from sources still paying.
 *
 * Terminated income is excluded deliberately: a household whose wages just
 * ended has $0 going forward, which is the regulatory intent — the expedited
 * threshold asks what the household will actually have, not what it had.
 * (This is the same forward-looking rule as issue #556.)
 */
export function effectiveGrossMonthly(facts: Facts): number {
  return facts.income
    .filter((line) => isOngoing(line.source_status))
    .reduce((sum, line) => sum + (Number(line.amount) || 0), 0);
}

/**
 * Rent plus the entitled standard utility allowance.
 *
 * 7 CFR 273.2(i)(1)(iii) and 58 Fed. Reg. 58448 use the SUA the household is
 * ENTITLED to, not its actual utility bills — so this reads sua_amount rather
 * than summing individual utility costs.
 */
export function expeditedShelterCost(facts: Facts): number {
  const rent = Number(facts.shelter?.rent) || 0;
  const sua = Number(facts.shelter?.sua_amount) || 0;
  return rent + sua;
}

/** Any member coded as a migrant or seasonal farmworker. */
function isMigrantOrSeasonalFarmworker(facts: Facts): boolean {
  return facts.household.some(
    (m) => m.living === "migrant" || m.living === "seasonal",
  );
}

export interface ExpeditedOptions {
  /**
   * Income expected from a NEW source within 10 days. Only relevant to Path 3:
   * more than $25 defeats "destitute" (7 CFR 273.10(e)(3)). Not present in the
   * v0.6 fixture schema, so it defaults to 0 — pass it explicitly when the
   * intake captures it.
   */
  newSourceIncomeWithin10Days?: number;
}

const money = (n: number): string =>
  `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

/**
 * Screen a household for expedited service under all three federal paths.
 *
 * Ported from the Python engine so both encodings agree; parity is pinned by
 * test. Returns tri-state rather than a boolean — see the header note on why
 * unknown liquid resources must not silently default.
 */
export function screenExpedited(
  facts: Facts,
  opts: ExpeditedOptions = {},
): ExpeditedResult {
  const gross = effectiveGrossMonthly(facts);
  const shelter = expeditedShelterCost(facts);
  const liquid = countableAssets(facts);
  const farmworker = isMigrantOrSeasonalFarmworker(facts);
  const newSource = opts.newSourceIncomeWithin10Days ?? 0;

  const allSourcesTerminated =
    facts.income.length === 0 ||
    facts.income.every((line) => !isOngoing(line.source_status));

  const paths: ExpeditedPath[] = [];

  if (liquid !== null) {
    // Path 1 — 7 CFR 273.2(i)(1)(i)
    if (gross < PATH1_GROSS_LIMIT && liquid <= LIQUID_LIMIT) {
      paths.push("low_income_low_resources");
    }
    // Path 2 — 7 CFR 273.2(i)(1)(iii)
    if (gross + liquid < shelter) {
      paths.push("shelter_exceeds_resources");
    }
    // Path 3 — 7 CFR 273.2(i)(1)(ii)
    if (
      farmworker &&
      liquid <= LIQUID_LIMIT &&
      allSourcesTerminated &&
      newSource <= DESTITUTE_NEW_SOURCE_LIMIT
    ) {
      paths.push("destitute_farmworker");
    }

    if (paths.length > 0) {
      return {
        status: "eligible",
        paths,
        effectiveGrossMonthly: gross,
        shelterCost: shelter,
        liquidResources: liquid,
        qualifyingLiquidCeiling: null,
        explanation: explain(paths, gross, shelter, liquid),
      };
    }
    return {
      status: "not_eligible",
      paths: [],
      effectiveGrossMonthly: gross,
      shelterCost: shelter,
      liquidResources: liquid,
      qualifyingLiquidCeiling: null,
      explanation: `Not expedited-eligible on the information provided: ${money(gross)}/mo ongoing income and ${money(liquid)} liquid resources against ${money(shelter)} shelter + utilities.`,
    };
  }

  // Liquid unknown. Report the ceiling that would decide it rather than
  // guessing in either direction.
  const path1Ceiling = gross < PATH1_GROSS_LIMIT ? LIQUID_LIMIT : null;
  const path2Ceiling = shelter - gross > 0 ? shelter - gross - 1 : null;
  const path3Ceiling =
    farmworker && allSourcesTerminated && newSource <= DESTITUTE_NEW_SOURCE_LIMIT
      ? LIQUID_LIMIT
      : null;
  const ceiling = [path1Ceiling, path2Ceiling, path3Ceiling]
    .filter((c): c is number => c !== null)
    .reduce<number | null>((max, c) => (max === null || c > max ? c : max), null);

  return {
    status: ceiling === null ? "not_eligible" : "needs_liquid_resources",
    paths: [],
    effectiveGrossMonthly: gross,
    shelterCost: shelter,
    liquidResources: null,
    qualifyingLiquidCeiling: ceiling,
    explanation:
      ceiling === null
        ? `Not expedited-eligible: ${money(gross)}/mo ongoing income already exceeds every expedited threshold regardless of liquid resources.`
        : `Ask the household for their liquid resources (cash, checking, savings). With ${money(gross)}/mo ongoing income and ${money(shelter)} shelter + utilities, they qualify for expedited service if liquid resources are ${money(ceiling)} or less.`,
  };
}

function explain(
  paths: ExpeditedPath[],
  gross: number,
  shelter: number,
  liquid: number,
): string {
  const parts: string[] = [];
  if (paths.includes("low_income_low_resources")) {
    parts.push(
      `ongoing income ${money(gross)} is under $150 and liquid resources ${money(liquid)} are at or under $100`,
    );
  }
  if (paths.includes("shelter_exceeds_resources")) {
    parts.push(
      `income plus resources (${money(gross + liquid)}) is less than shelter and utilities (${money(shelter)})`,
    );
  }
  if (paths.includes("destitute_farmworker")) {
    parts.push(
      "the household is a destitute migrant or seasonal farmworker with terminated income and no more than $100 in resources",
    );
  }
  return `Expedited-eligible — benefits are owed within 3 calendar days because ${parts.join("; and ")}.`;
}
