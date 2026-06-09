// Deficiency-notice / document-request generator for the CBO preview.
//
// Marlene's ask: "you have the verification cross-check, you just don't emit the
// notice." This turns the per-case verification GAPS into a client-ready
// document request — each missing item named, the §273 rule behind it, and the
// ~10-day cure window (7 CFR 273.2(h)) — as a printable PDF or Word (.doc),
// mirroring the progress-report builder.
//
// HONESTY FRAME (load-bearing): this is a CBO-prepared checklist the navigator
// hands the client BEFORE filing (or to chase during a county pend) — it is NOT
// the county's official Notice of Action and not an eligibility determination.
// The 10-day cure is the rule the COUNTY applies once it pends; sending proof
// early just keeps the case from stalling. The footer says so.

import type { QueueApplication } from "./demo-pipeline";

export type DeficiencyItem = {
  /** The verification category (used for dedupe + as the item heading). */
  category: string;
  /** What the household must send, in plain client-facing language. */
  action: string;
  /** The federal rule behind the request (pointer to confirm, not a quote). */
  citation: string;
};

// Document questions on the intake → the specific cure action + rule. Drives the
// most concrete items, since an outstanding document is unambiguous.
const DOC_CURE: Record<string, { category: string; citation: string; action: string }> = {
  "Photo ID": {
    category: "Identity",
    citation: "7 CFR 273.2(f)",
    action: "a clear copy of a government-issued photo ID — driver's license, state ID, or passport",
  },
  "Proof of income": {
    category: "Earned income",
    citation: "7 CFR 273.9 / 273.2(f)(1)(i)",
    action:
      "pay stubs covering the last 30 days for every working household member, or a signed employer statement of gross pay and how often you're paid",
  },
  "Proof of residence": {
    category: "Residency",
    citation: "7 CFR 273.3 / 273.2(f)",
    action: "a current lease, rent receipt, mortgage statement, or a utility bill in your name showing your address",
  },
  "Social Security Number": {
    category: "Social Security number",
    citation: "7 CFR 273.6",
    action: "the Social Security number (or card) for each household member, or proof you have applied for one",
  },
};

const docPresent = (answer: string) => !/not (yet uploaded|provided)/i.test(answer);

// Map a free-text engine verification need to a rule + category, so anything the
// engine flags that isn't already a document/flag item still lands as a citable
// line rather than a vague "needs check".
function classifyNeed(text: string): { category: string; citation: string } {
  const t = text.toLowerCase();
  if (/asset|resource|liquid|bank/.test(t)) return { category: "Resources / assets", citation: "7 CFR 273.8" };
  if (/medical/.test(t)) return { category: "Medical expenses (elderly/disabled)", citation: "7 CFR 273.9(d)(3)" };
  if (/shelter|rent|utilit|housing|mortgage/.test(t)) return { category: "Shelter & utilities", citation: "7 CFR 273.9(d)" };
  if (/income|wage|pay|employ|self-?employ|earn/.test(t)) return { category: "Income", citation: "7 CFR 273.9 / 273.2(f)" };
  if (/citizen|immigration|non-?citizen|alien|status/.test(t)) return { category: "Citizenship / immigration status", citation: "7 CFR 273.4" };
  if (/household|member|composition|student|boarder|who.*(buy|cook|eat)/.test(t)) return { category: "Household composition", citation: "7 CFR 273.1" };
  if (/work|abawd|exemption/.test(t)) return { category: "Work requirements", citation: "7 CFR 273.7" };
  if (/ssn|social security/.test(t)) return { category: "Social Security number", citation: "7 CFR 273.6" };
  if (/identity|photo|^id\b/.test(t)) return { category: "Identity", citation: "7 CFR 273.2(f)" };
  return { category: "Verification", citation: "7 CFR 273.2(f)" };
}

// Build the itemized deficiency list from the same signals the on-screen
// verification cross-check uses: outstanding documents, flagged answers, and the
// engine's remaining verification needs. Deduped by category (most-specific
// document/flag item wins over a generic need).
export function buildDeficiencyItems(app: QueueApplication): DeficiencyItem[] {
  const items: DeficiencyItem[] = [];
  const seen = new Set<string>();
  const push = (it: DeficiencyItem) => {
    if (seen.has(it.category)) return;
    seen.add(it.category);
    items.push(it);
  };

  const ans = (q: string) => app.answers.find((a) => a.question === q)?.answer ?? "";

  // 1 — Outstanding documents (most concrete).
  for (const a of app.answers) {
    if (a.section === "Documents" && DOC_CURE[a.question] && !docPresent(a.answer)) {
      push(DOC_CURE[a.question]);
    }
  }

  // 2 — Flagged answers (e.g., SSN that doesn't match SSA records).
  const ssn = ans("Social Security Number");
  if (/does not match/i.test(ssn)) {
    push({
      category: "Social Security number",
      citation: "7 CFR 273.6",
      action: "the Social Security card for each household member so the number on file matches Social Security's records",
    });
  }
  for (const a of app.answers) {
    if (!a.flagged) continue;
    const { category, citation } = classifyNeed(`${a.section} ${a.question}`);
    push({
      category,
      citation,
      action: `proof to clear the flagged item "${a.question}" (currently: ${a.answer})`,
    });
  }

  // 3 — Remaining engine verification needs not already covered by category.
  for (const need of app.verificationNeeds) {
    const { category, citation } = classifyNeed(need);
    push({
      category,
      citation,
      action: `${need.charAt(0).toLowerCase()}${need.slice(1)}`,
    });
  }

  return items;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The ~10-day cure deadline (7 CFR 273.2(h)), as a friendly date string. */
export function cureDateLabel(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() + 10);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export type DeficiencyDoc = {
  applicant: string;
  caseId: string;
  county: string;
  generatedAt: string;
  cureBy: string;
  items: DeficiencyItem[];
};

function esc(s: unknown): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// A complete, self-contained HTML document. `forWord` adds the Office XML
// namespaces (so Word opens it natively) and drops the on-screen Print button.
export function deficiencyDocument(d: DeficiencyDoc, opts: { forWord: boolean }): string {
  const head = opts.forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>Documents needed — ${esc(d.caseId)}</title>`
    : `<!doctype html><html><head><meta charset="utf-8"><title>Documents needed — ${esc(d.applicant)}</title>`;

  const style = `<style>
  * { box-sizing: border-box; }
  body { font: 13px/1.5 -apple-system, system-ui, "Segoe UI", sans-serif; color: #15181C; margin: 40px; max-width: 720px; }
  h1 { font-size: 18px; margin: 0 0 2px; }
  .meta { font-size: 12px; color: #565E68; margin: 0 0 2px; }
  .lede { margin: 18px 0; padding: 12px 14px; background: #F4F1E9; border-left: 3px solid #2D5A45; border-radius: 2px; }
  .due { font-weight: 700; }
  ol.items { padding-left: 0; list-style: none; counter-reset: item; margin: 18px 0; }
  ol.items li { counter-increment: item; padding: 12px 0 12px 34px; position: relative; border-bottom: 1px solid rgba(15,23,42,.10); }
  ol.items li::before { content: counter(item); position: absolute; left: 0; top: 11px; width: 22px; height: 22px; border-radius: 50%; background: #2D5A45; color: #fff; font-size: 12px; font-weight: 700; text-align: center; line-height: 22px; }
  .cat { font-weight: 700; }
  .rule { color: #565E68; font-size: 11px; }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #565E68; margin: 22px 0 6px; }
  .ready { margin: 22px 0; padding: 14px; background: #EAF3EE; border-radius: 2px; font-weight: 600; color: #2D5A45; }
  .disc { font-size: 11px; color: #565E68; margin-top: 24px; line-height: 1.5; border-top: 1px solid rgba(15,23,42,.14); padding-top: 10px; }
  .bar { display: flex; justify-content: flex-end; margin: 0 0 18px; }
  .bar button { font: 600 12px -apple-system, system-ui, sans-serif; color: #fff; background: #2D5A45; border: 0; border-radius: 3px; padding: 7px 14px; cursor: pointer; }
  @media print { body { margin: 0; } .bar { display: none; } @page { margin: 16mm; } }
</style></head><body>`;

  const printBar = opts.forWord ? "" : `<div class="bar"><button onclick="window.print()">Print / Save as PDF</button></div>`;

  if (d.items.length === 0) {
    return `${head}${style}${printBar}
  <h1>Documents needed to complete your CalFresh application</h1>
  <p class="meta">${esc(d.applicant)} · ${esc(d.caseId)} · ${esc(d.county)} County, CA</p>
  <p class="meta">Prepared ${esc(d.generatedAt)} by your CalFresh navigator · Civica</p>
  <div class="ready">No outstanding verification — this application is ready to file.</div>
  <p class="disc">This is a checklist prepared by your CalFresh navigator, not the county's official Notice of Action, and not an eligibility determination. The county may still request additional proof.</p>
</body></html>`;
  }

  const itemsHtml = d.items
    .map(
      (it) =>
        `<li><span class="cat">${esc(it.category)}</span> — please provide ${esc(it.action)}.<br><span class="rule">Why we need it: federal rule ${esc(it.citation)}.</span></li>`,
    )
    .join("");

  return `${head}${style}${printBar}
  <h1>Documents needed to complete your CalFresh application</h1>
  <p class="meta">${esc(d.applicant)} · ${esc(d.caseId)} · ${esc(d.county)} County, CA</p>
  <p class="meta">Prepared ${esc(d.generatedAt)} by your CalFresh navigator · Civica</p>

  <div class="lede">
    To finish your CalFresh (SNAP) application we still need the ${d.items.length} item${d.items.length !== 1 ? "s" : ""} below.
    Please send them <span class="due">by ${esc(d.cureBy)}</span> (about 10 days). Once your application is filed, the county must
    give you at least 10 days to turn in missing proof — federal rule 7 CFR 273.2(h) — so sending these now keeps your case moving
    and helps avoid a delay or denial.
  </div>

  <h2>What to send</h2>
  <ol class="items">${itemsHtml}</ol>

  <h2>How to send them</h2>
  <p>Upload them in the app, hand them to your navigator, or bring copies to your county appointment. Keep the originals — copies are fine.
  If anything is hard to get (no printer, employer slow with pay stubs), tell your navigator — there are usually other ways to prove it.</p>

  <p class="disc">This is a checklist prepared by your CalFresh navigator, not the county's official Notice of Action, and not an eligibility
  determination. The county may request additional proof, and the exact 10-day cure period and accepted documents are set by your state and
  county — confirm against current CalFresh / CDSS rules and your county worker.</p>
</body></html>`;
}
