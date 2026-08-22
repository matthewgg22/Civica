// Code → state name.
//
// PackMeta carries a code, a program and an agency, but never the state's own
// name — so anywhere the UI wanted to say "California" it had to reach for the
// nearest string that looked like one. The geo-hint row reached for `program`,
// which is how it came to read "Use Supplemental Nutrition Assistance Program
// (SNAP) — Massachusetts uses the federal name; …".
//
// Territories included: the picker offers the NAP jurisdictions in their own
// group, and they need names for the same reason the states do.

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia",
  FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana",
  ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan",
  MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee",
  TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  // Territories — SNAP in GU and USVI, NAP in the rest.
  AS: "American Samoa", GU: "Guam", MP: "Northern Mariana Islands",
  PR: "Puerto Rico", VI: "U.S. Virgin Islands",
};

/** The state's name, falling back to the code — which is always displayable,
 *  and is what a future jurisdiction without an entry should show rather than
 *  "undefined". */
export function stateName(code: string): string {
  return STATE_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}
