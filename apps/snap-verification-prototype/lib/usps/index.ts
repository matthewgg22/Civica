// USPS Address Validation client.
//
// Real call: USPS Web Tools API (https://www.usps.com/business/web-tools-apis/).
// We only need a valid/residential check for the prototype.

export interface UspsValidationResult {
  valid: boolean;
  is_residential: boolean;
  normalized: string;
  source: "usps_live" | "usps_fixture";
}

export async function validateAddress(addr: string): Promise<UspsValidationResult> {
  const trimmed = addr.trim();
  if (!trimmed) {
    return { valid: false, is_residential: false, normalized: "", source: "usps_fixture" };
  }

  // Fixture: anything containing "PO BOX" => not residential; obviously
  // junk inputs (too short, no digits) => invalid.
  const hasDigits = /\d/.test(trimmed);
  const isPoBox = /p\.?\s*o\.?\s*box/i.test(trimmed);
  const valid = hasDigits && trimmed.length >= 8;

  return {
    valid,
    is_residential: valid && !isPoBox,
    normalized: trimmed.replace(/\s+/g, " ").toUpperCase(),
    source: "usps_fixture",
  };
}
