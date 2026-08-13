// The outlined application, as a document.
//
// This is the thing the product is actually for. Someone talks to Demeter,
// answers get gathered, and at the end they should be holding something they
// can put beside the real application and copy from — not a transcript they
// have to re-read, and not a number.
//
// Rendered from the SAME facts the estimate panel shows, so the document and
// the panel can never disagree. Deliberately plain: this gets emailed, printed,
// read on a phone in a waiting room, and possibly handed to a caseworker.
//
// WHAT IT IS NOT: an application, a determination, or a submission. Every
// renderer here says so, because a tidy document is exactly the kind of thing
// someone could mistake for having applied.

import type { PartialFacts } from "@civica/demeter-engine";

export interface OutlineInput {
  facts: PartialFacts;
  stateName: string | null;
  agency: string | null;
  portalName: string | null;
  portalUrl: string | null;
  /** Items assessCompleteness says are still outstanding, already in English. */
  stillNeeded: string[];
  generatedAt: Date;
}

export interface OutlineSection {
  heading: string;
  /** Lines already formatted "Label: value", or bare sentences. */
  lines: string[];
}

const money = (n: number) => `$${n.toLocaleString("en-US")}`;

/** Frequency as someone says it, not as the schema stores it. */
function freqLabel(freq: string | undefined): string {
  switch (freq) {
    case "weekly":
      return "a week";
    case "biweekly":
      return "every two weeks";
    case "annual":
      return "a year";
    default:
      return "a month";
  }
}

function incomeLabel(type: string | undefined): string {
  switch (type) {
    case "wages":
      return "Wages";
    case "self_employment":
      return "Self-employment";
    case "ssa":
      return "Social Security";
    case "ssi":
      return "SSI";
    case "tanf":
      return "TANF";
    default:
      return "Other income";
  }
}

/** The document's sections, in the order the application asks for them.
 *
 *  Sections with nothing in them are DROPPED rather than shown empty. A page
 *  of "not provided" reads as a form someone failed to fill in; the point of
 *  the "still to work out" section at the end is to carry that honestly, once,
 *  in one place. */
export function buildOutline(input: OutlineInput): OutlineSection[] {
  const { facts, stateName, agency, portalName, stillNeeded } = input;
  const sections: OutlineSection[] = [];

  const where: string[] = [];
  if (stateName) where.push(`State: ${stateName}`);
  if (agency) where.push(`Agency: ${agency}`);
  if (portalName) where.push(`Apply at: ${portalName}`);
  if (where.length) sections.push({ heading: "Where this application goes", lines: where });

  const household = facts.household ?? [];
  if (household.length) {
    sections.push({
      heading: "Who is in the household",
      lines: [
        `${household.length} ${household.length === 1 ? "person" : "people"} who buy and cook food together.`,
        ...household.map((m, i) => {
          const bits: string[] = [];
          if (m.age !== undefined) bits.push(`age ${m.age}`);
          if (m.role) bits.push(String(m.role));
          if (m.student) bits.push("student");
          if (m.disability) bits.push("has a disability");
          if (m.elderly) bits.push("60 or over");
          const who = m.member_id || `Person ${i + 1}`;
          return bits.length ? `${who} — ${bits.join(", ")}` : who;
        }),
      ],
    });
  }

  const income = facts.income ?? [];
  if (income.length) {
    sections.push({
      heading: "Income, before tax",
      lines: [
        ...income.map(
          (r) =>
            `${incomeLabel(r.type)}${r.member ? ` (${r.member})` : ""}: ` +
            `${money(r.amount)} ${freqLabel(r.freq)}`,
        ),
        "SNAP is tested on income BEFORE tax and deductions, not on take-home pay.",
      ],
    });
  }

  const costs: string[] = [];
  if (facts.shelter?.rent !== undefined) costs.push(`Rent or mortgage: ${money(facts.shelter.rent)} a month`);
  if (facts.deductions?.dependent_care !== undefined) {
    costs.push(`Childcare or dependent care: ${money(facts.deductions.dependent_care)} a month`);
  }
  if (facts.deductions?.medical_unreimbursed !== undefined) {
    costs.push(`Out-of-pocket medical: ${money(facts.deductions.medical_unreimbursed)} a month`);
  }
  if (facts.deductions?.child_support_paid !== undefined) {
    costs.push(`Child support paid: ${money(facts.deductions.child_support_paid)} a month`);
  }
  if (costs.length) sections.push({ heading: "Costs that can reduce what counts", lines: costs });

  if (facts.assets !== undefined) {
    // The schema allows a string here (someone can say "none" as easily as a
    // figure), so this must not assume a number and quietly print "$NaN" on a
    // document someone is about to take to an office.
    const assets =
      typeof facts.assets === "number" ? money(facts.assets) : String(facts.assets);
    sections.push({ heading: "Savings and resources", lines: [`Countable resources: ${assets}`] });
  }

  if (stillNeeded.length) {
    sections.push({
      heading: "Still to work out",
      lines: stillNeeded,
    });
  }

  return sections;
}

/** Plain text, for the body of an email and for anywhere formatting cannot be
 *  relied on. Kept narrow enough to survive a phone's mail client. */
export function outlineToText(input: OutlineInput): string {
  const sections = buildOutline(input);
  const date = input.generatedAt.toISOString().slice(0, 10);
  const out: string[] = [
    "YOUR OUTLINED APPLICATION",
    `Prepared with Demeter on ${date}`,
    "",
    "This is a working sheet to help you fill in the real application.",
    "It is NOT an application and it has not been sent to anyone.",
    "",
  ];
  for (const s of sections) {
    out.push(s.heading.toUpperCase(), ...s.lines.map((l) => `  ${l}`), "");
  }
  if (input.portalUrl) {
    out.push(
      "WHERE TO APPLY",
      `  ${input.portalName ?? "Your state's portal"}: ${input.portalUrl}`,
      "",
    );
  }
  out.push(
    "Demeter is AI and can make mistakes. Check anything you rely on against",
    "your state agency before you submit.",
  );
  return out.join("\n");
}
