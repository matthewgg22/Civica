// The answer for a jurisdiction that does not run SNAP.
//
// Puerto Rico, American Samoa and the Northern Mariana Islands receive NAP
// block grants "in lieu of" SNAP (USDA, fna.usda.gov/nap), and each territory
// "establish[es] eligibility and benefit levels" itself. So there is no federal
// floor to fall back on and no state manual to cite — the honest answer is that
// this tool does not cover their program, and here is who does.
//
// Written as a plain string rather than generated, deliberately. Everything
// this product says normally carries a citation because a model produced it;
// this is the one answer no model touches, so it needs no verifier and must
// never look like a hedged SNAP answer.
//
// Shaped like a real answer — a certainty banner and a source line — so the
// chat renders it consistently and a screen reader announces it through the
// same path as everything else.

import { type NapJurisdiction } from "@civica/demeter-engine/packs";

const COPY = {
  en: {
    lead: (name: string, program: string) =>
      `${name} does not run SNAP. Food assistance there is provided through ${program}, a separate program funded by a federal block grant.`,
    why: "That matters for your question: the territory sets its own income limits, benefit amounts and rules, so the federal SNAP figures this tool works from do not apply where you live.",
    who: (agency: string) => `Apply and ask questions through ${agency}.`,
    banner: "✓ **CERTAIN** — this is a scope limit, not an estimate.",
    source: "Source: USDA Food and Nutrition Service — Nutrition Assistance Program block grants.",
  },
  es: {
    lead: (name: string, program: string) =>
      `${name} no administra SNAP. La ayuda alimentaria allí se brinda a través de ${program}, un programa aparte financiado por una subvención federal en bloque.`,
    why: "Eso importa para tu pregunta: el territorio fija sus propios límites de ingreso, montos y reglas, así que las cifras federales de SNAP con las que trabaja esta herramienta no aplican donde vives.",
    who: (agency: string) => `Solicita y haz tus preguntas a través de ${agency}.`,
    banner: "✓ **SEGURO** — es un límite de alcance, no un estimado.",
    source:
      "Fuente: USDA Food and Nutrition Service — subvenciones en bloque del Programa de Asistencia Nutricional.",
  },
} as const;

/** The full streamed body for a NAP jurisdiction. */
export function napHandoff(j: NapJurisdiction, lang: "en" | "es"): string {
  const c = COPY[lang] ?? COPY.en;
  const lines = [c.lead(j.name, j.program), "", c.why, "", c.who(j.agency)];
  if (j.agencyUrl) lines.push(j.agencyUrl);
  lines.push("", "---", c.banner, "", c.source);
  return lines.join("\n");
}
