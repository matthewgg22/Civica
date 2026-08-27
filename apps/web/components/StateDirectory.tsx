"use client";

// The state list, with a search box.
//
// It replaced a row of 21 letter links. That row worked, but it cost three
// lines of vertical space on a phone before a single state appeared, and it
// only answers "where does W start" — not "who runs this in Ohio", and not
// "which state is BenefitsCal". Typing answers all three.
//
// A CLIENT COMPONENT, DELIBERATELY, AND STILL FULLY SERVER-RENDERED. Next
// renders this on the server too, so all 53 rows are in the HTML a crawler
// sees and in the page a reader gets before hydration; the JS only adds the
// filtering. It receives finished strings rather than packs, so nothing
// model-facing can reach it — see pack-field-render-guard.

import { useMemo, useState } from "react";
import Link from "next/link";
import { StateFlag } from "./StateFlag";

/** Finished, reader-facing strings — never a pack. The fields are named
 *  *Label deliberately: `row.program` would read like `pack.program`, which is
 *  the model-facing field that must never reach a reader (#931), and the
 *  render guard distinguishes them by exactly that name. */
export interface DirectoryRow {
  code: string;
  name: string;
  /** Only where the state calls SNAP something else; null on the 44 that
   *  don't, because printing "SNAP" 53 times says nothing. */
  programLabel: string | null;
  agencyLabel: string;
  countyAdministered: boolean;
  portal: { url: string; label: string; note: string | null; applyLabel: string } | null;
  /** Why there is no portal, where that is a fact about the jurisdiction
   *  rather than a gap in what we know. */
  applyNote: string | null;
  /** The Ask link's accessible name, resolved on the server. 53 links all
   *  announcing "Ask" is 53 indistinguishable destinations. */
  askLabel: string;
}

/** EVERY FIELD IS A STRING, and that is load-bearing rather than tidy: a
 *  function cannot cross the server/client boundary, and Next only says so at
 *  prerender ("Functions cannot be passed directly to Client Components"). A
 *  unit test that renders this component directly never crosses that boundary,
 *  so nothing but a build catches it. Anything per-row is resolved on the
 *  server into DirectoryRow; anything depending on the query is a template. */
export interface DirectoryCopy {
  searchLabel: string;
  searchPlaceholder: string;
  clear: string;
  countyTag: string;
  ask: string;
  /** Carries "{query}". */
  noMatch: string;
  noMatchAsk: string;
  /** Carries "{total}". */
  countedAll: string;
  /** Carries "{shown}" and "{total}". */
  countedSome: string;
}

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (whole, key) =>
    key in vars ? String(vars[key]) : whole,
  );
}

function groupByInitial(rows: DirectoryRow[]) {
  const groups: { letter: string; rows: DirectoryRow[] }[] = [];
  for (const row of rows) {
    const letter = row.name[0].toUpperCase();
    const last = groups[groups.length - 1];
    if (last && last.letter === letter) last.rows.push(row);
    else groups.push({ letter, rows: [row] });
  }
  return groups;
}

export function StateDirectory({
  rows,
  copy,
  chatHref,
}: {
  rows: DirectoryRow[];
  copy: DirectoryCopy;
  /** Language-aware, because /chat is one of the routes that IS localized. */
  chatHref: string;
}) {
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    // Agency and portal are searchable, not just the name: someone who knows
    // their state's system by its brand ("BenefitsCal", "ACCESS Florida") or
    // who has a letter from "the Department of Transitional Assistance" should
    // land on the right row without knowing which state it belongs to.
    return rows.filter((r) =>
      [r.code, r.name, r.programLabel ?? "", r.agencyLabel, r.portal?.label ?? ""].some((f) =>
        f.toLowerCase().includes(q),
      ),
    );
  }, [rows, query]);

  const groups = groupByInitial(matches);
  const filtering = query.trim() !== "";

  return (
    <>
      {/* A VISIBLE label, not a placeholder standing in for one. The
          placeholder vanishes the moment you type, taking with it the only
          statement of what the field does — and it is the field someone comes
          back to after being interrupted. The placeholder now carries the
          example ("state, agency, or portal"), which is what it is good at. */}
      <label className="vsearch__label" htmlFor="state-search">
        {copy.searchLabel}
      </label>
      <div className="vsearch">
        <input
          id="state-search"
          type="search"
          className="vsearch__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          // No autoFocus: on a phone that opens the keyboard over the list the
          // reader came to look at, and steals the page from a screen reader
          // before it has announced what the page is.
          autoComplete="off"
        />
        {filtering && (
          <button type="button" className="vsearch__clear" onClick={() => setQuery("")}>
            {copy.clear}
          </button>
        )}
      </div>

      {/* Announced, not just drawn: a filter that silently removes 50 rows is
          invisible to anyone not watching the list. */}
      <p className="vsearch__count" role="status" aria-live="polite">
        {matches.length === rows.length
          ? fill(copy.countedAll, { total: rows.length })
          : fill(copy.countedSome, { shown: matches.length, total: rows.length })}
      </p>

      {matches.length === 0 && (
        <div className="vsearch__empty">
          <p className="vsearch__emptyline">{fill(copy.noMatch, { query: query.trim() })}</p>
          <Link className="vsearch__emptycta" href={chatHref}>
            {copy.noMatchAsk} <span aria-hidden>→</span>
          </Link>
        </div>
      )}

      {groups.map(({ letter, rows: group }) => (
        <section className="vstates__group" key={letter} aria-labelledby={`letter-${letter}`}>
          <h2 className="vstates__letter" id={`letter-${letter}`}>
            {letter}
          </h2>
          <ul className="vstates__list">
            {group.map((r) => (
              <li className="vrow" key={r.code}>
                <div className="vrow__id">
                  <StateFlag code={r.code} size={34} />
                  <span className="vrow__name">
                    {r.name} <span className="vrow__code">({r.code})</span>
                  </span>
                </div>

                <div className="vrow__prog">
                  {r.programLabel && <span className="vrow__program">{r.programLabel}</span>}
                  <span className="vrow__agency">
                    {r.agencyLabel}
                    {r.countyAdministered && (
                      <span className="vrow__admin"> · {copy.countyTag}</span>
                    )}
                  </span>
                </div>

                <div className="vrow__links">
                  {r.portal && (
                    <span className="vrow__portal">
                      <a
                        className="vrow__link vrow__link--portal"
                        href={r.portal.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={r.portal.applyLabel}
                      >
                        {/* Text and arrow in ONE inline box: the link is an
                            inline-flex for its 44px target, so as two flex
                            items a wrapped portal name left the arrow stranded
                            against the right edge. */}
                        <span className="vrow__linktext">
                          {r.portal.label} <span aria-hidden>↗</span>
                        </span>
                      </a>
                      {r.portal.note && <span className="vrow__note">{r.portal.note}</span>}
                    </span>
                  )}
                  {/* Says WHY the Apply link is missing. Without it the row
                      reads as a hole in our data rather than as a fact about
                      the jurisdiction. */}
                  {!r.portal && r.applyNote && (
                    <span className="vrow__portal">
                      <span className="vrow__note vrow__note--only">{r.applyNote}</span>
                    </span>
                  )}
                  <Link
                    className="vrow__link vrow__link--ask"
                    href={`${chatHref}?state=${r.code}`}
                    aria-label={r.askLabel}
                  >
                    <span className="vrow__linktext">
                      {copy.ask} <span aria-hidden>→</span>
                    </span>
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
