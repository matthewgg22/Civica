import {
  StateAgencyRecordSchema,
  type AgencyLookupResult,
  type StateAgencyRecord,
} from "../schemas";
import caData from "./data/ca.json";
import maData from "./data/ma.json";
import stubData from "./data/states-stub.json";

const FULLY_POPULATED: Record<string, StateAgencyRecord> = {
  CA: StateAgencyRecordSchema.parse(caData),
  MA: StateAgencyRecordSchema.parse(maData),
};

const STUBS: Record<string, StateAgencyRecord> = Object.fromEntries(
  (stubData as { states: unknown[] }).states.map((entry) => {
    const parsed = StateAgencyRecordSchema.parse(entry);
    return [parsed.state_code, parsed];
  }),
);

export interface AgencyLookupInput {
  stateCode: string;
  countyFips?: string;
}

export function lookup(input: AgencyLookupInput): AgencyLookupResult | undefined {
  const code = input.stateCode.toUpperCase();
  const record = FULLY_POPULATED[code] ?? STUBS[code];
  if (!record) return undefined;

  const county = input.countyFips
    ? record.counties.find((c) => c.fips === input.countyFips)
    : undefined;

  return {
    state: record.state_agency,
    ...(county ? { county } : {}),
    fallback_to_state: !county,
  };
}

export function listSupportedStates(): string[] {
  return Object.keys(FULLY_POPULATED).sort();
}

export function getStateRecord(stateCode: string): StateAgencyRecord | undefined {
  const code = stateCode.toUpperCase();
  return FULLY_POPULATED[code] ?? STUBS[code];
}
