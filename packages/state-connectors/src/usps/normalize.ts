import type { NormalizedAddress, ValidationResult } from "../schemas.js";
import type { USPSAddressApiResponse } from "./types.js";

export function normalizeUSPSResponse(raw: USPSAddressApiResponse): ValidationResult {
  const a = raw.address;
  const dpv = raw.additionalInfo?.DPVConfirmation;
  // USPS occasionally returns "D" (drop-shipment) — treat as not deliverable
  // for SNAP purposes since the applicant cannot receive mail there.
  const dpvOut: "Y" | "N" | "S" | undefined =
    dpv === "Y" || dpv === "N" || dpv === "S" ? dpv : dpv === "D" ? "N" : undefined;

  const normalized: NormalizedAddress = {
    street: a.streetAddress.toUpperCase(),
    ...(a.secondaryAddress ? { street2: a.secondaryAddress.toUpperCase() } : {}),
    city: a.city.toUpperCase(),
    state: a.state.toUpperCase(),
    zip5: a.ZIPCode,
    ...(a.ZIPPlus4 ? { zip4: a.ZIPPlus4 } : {}),
  };

  const valid = dpvOut === "Y";

  return {
    valid,
    normalized,
    ...(dpvOut ? { delivery_point_validation: dpvOut } : {}),
    warnings: raw.warnings ?? [],
  };
}
