/**
 * Free-resources payload for the distress visible-honor swap.
 *
 * Source plan: ceo-plans/2026-05-26-ebt-offer-moment-platform.md (E3 + D7).
 *
 * Returned by /me/offers when isDistressed(userId) === true. iOS renders
 * these rows in the SAME shelf structure as offers (per design D7). User
 * has no visible signal that they've been segmented.
 *
 * v1: static per-state list. v1.1+ could pull live food-bank / 211 records
 * from FindHelp's helpDirectory bucket — but the static set is calibrated
 * (food bank, Lifeline, legal aid) and stable; live pulls add no value yet.
 */

export interface FreeResource {
  resource_id: string;
  icon_glyph: "house" | "phone" | "document"; // monoline icon hint for iOS
  title_en: string;
  title_es: string;
  subtitle_en: string;
  subtitle_es: string;
  /**
   * iOS tap routes to this in-app destination. v1 supports two kinds:
   *   - findhelp_helpdirectory: opens FindHelp filtered to help_directory
   *   - external_url: opens Safari to the URL
   */
  action: { kind: "findhelp_helpdirectory" } | { kind: "external_url"; url: string };
}

const CA_FREE_RESOURCES: FreeResource[] = [
  {
    resource_id: "ca_food_bank",
    icon_glyph: "house",
    title_en: "Local food bank",
    title_es: "Banco de alimentos local",
    subtitle_en: "CalFresh-eligible pantries near you · no appointment needed",
    subtitle_es: "Despensas elegibles para CalFresh cerca de ti · no se necesita cita",
    action: { kind: "findhelp_helpdirectory" },
  },
  {
    resource_id: "ca_lifeline",
    icon_glyph: "phone",
    title_en: "Lifeline phone & internet",
    title_es: "Lifeline: teléfono e internet",
    subtitle_en: "Reduces your monthly bill if you receive CalFresh",
    subtitle_es: "Reduce tu factura mensual si recibes CalFresh",
    action: { kind: "external_url", url: "https://www.lifelinesupport.org/" },
  },
  {
    resource_id: "ca_legal_aid_snap",
    icon_glyph: "document",
    title_en: "Legal aid for SNAP appeals",
    title_es: "Ayuda legal para apelaciones de SNAP",
    subtitle_en: "Free help if your benefits were denied or reduced",
    subtitle_es: "Ayuda gratuita si tus beneficios fueron denegados o reducidos",
    action: {
      kind: "external_url",
      url: "https://lawhelpca.org/issues/food-stamps-and-other-government-assistance",
    },
  },
];

const MA_FREE_RESOURCES: FreeResource[] = [
  {
    resource_id: "ma_food_bank",
    icon_glyph: "house",
    title_en: "Local food bank",
    title_es: "Banco de alimentos local",
    subtitle_en: "SNAP-eligible pantries near you · no appointment needed",
    subtitle_es: "Despensas elegibles para SNAP cerca de ti · no se necesita cita",
    action: { kind: "findhelp_helpdirectory" },
  },
  {
    resource_id: "ma_lifeline",
    icon_glyph: "phone",
    title_en: "Lifeline phone & internet",
    title_es: "Lifeline: teléfono e internet",
    subtitle_en: "Reduces your monthly bill if you receive SNAP",
    subtitle_es: "Reduce tu factura mensual si recibes SNAP",
    action: { kind: "external_url", url: "https://www.lifelinesupport.org/" },
  },
  {
    resource_id: "ma_legal_aid_snap",
    icon_glyph: "document",
    title_en: "Legal aid for SNAP appeals",
    title_es: "Ayuda legal para apelaciones de SNAP",
    subtitle_en: "Free help if your benefits were denied or reduced",
    subtitle_es: "Ayuda gratuita si tus beneficios fueron denegados o reducidos",
    action: {
      kind: "external_url",
      url: "https://www.masslegalhelp.org/income-benefits/food-stamps",
    },
  },
];

export function getFreeResources(stateCode: "CA" | "MA"): FreeResource[] {
  return stateCode === "MA" ? MA_FREE_RESOURCES : CA_FREE_RESOURCES;
}
