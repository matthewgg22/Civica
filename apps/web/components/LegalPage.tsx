// One renderer for all three legal documents.
//
// A server component with no state: these pages are text, and text does not
// need JavaScript. Everything it renders comes from lib/legal, so a wording
// change is a data change and never a component change.
//
// TYPOGRAPHY follows DEMETER-DESIGN.md's rule — serif speaks, sans labels. The
// prose is the display serif because it is the document talking; section
// numbers, the table head, the status banner and the "last updated" line are
// sans because they label rather than speak.

import Link from "next/link";
import { DemeterFooter } from "./DemeterFooter";
import { DOC_NAV, type Block, type LegalDocument } from "../lib/legal";
import { LegalContents } from "./LegalContents";
import { BackToChat } from "./BackToChat";

function BlockView({ block }: { block: Block }) {
  switch (block.kind) {
    case "p":
      return <p className="lgl__p">{block.text}</p>;
    case "ul":
      return (
        <ul className="lgl__ul">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );
    case "callout":
      return (
        <p className={`lgl__callout lgl__callout--${block.tone}`}>{block.text}</p>
      );
    case "table":
      // Wrapped so a wide table scrolls inside itself rather than pushing the
      // page sideways on a phone — which is most of how this is read.
      return (
        <div className="lgl__tablewrap">
          <table className="lgl__table">
            <thead>
              <tr>
                {block.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function LegalPage({ doc }: { doc: LegalDocument }) {
  return (
    <div className="lglpage">
      <main className="lgl" id="main-content">
        <header className="lgl__head">
          <BackToChat />
          <h1 className="lgl__title">{doc.title}</h1>
          <p className="lgl__lede">{doc.lede}</p>
          <p className="lgl__updated">Last updated {doc.lastUpdated}</p>

          {/* THE DRAFT BANNER WAS REMOVED HERE (owner decision, 2026-08-26).
              It said the document had not been reviewed by counsel, which is
              still true: `status` is unchanged and every document is still
              "draft". Recorded rather than deleted quietly, because the page
              no longer discloses something the data still says, and #1013
              tracks the review that would make it moot. To restore it, render
              on `doc.status === "draft"`. */}
          {/* NOT A SEGMENTED CONTROL. Filled pills implied three views of one
              document; these are three separate agreements. The current one is
              plain text rather than a link — you are on it, so it is the one
              thing here that needs no emphasis at all, and a filled terracotta
              pill made it the loudest element on the page while competing with
              the draft banner right above it. */}
          <nav className="lgl__docnav" aria-label="Legal documents">
            {DOC_NAV.map((d) =>
              d.slug === doc.slug ? (
                <span key={d.slug} className="lgl__docnav-current" aria-current="page">
                  {d.label}
                </span>
              ) : (
                <Link key={d.slug} href={`/${d.slug}`} className="lgl__docnav-link">
                  {d.label}
                </Link>
              ),
            )}
          </nav>
        </header>

        {/* CONTENTS BESIDE THE DOCUMENT, not stacked on top of it.
            The prose column is 680px because that is the right measure to read
            at; on a 1440px screen the other half of the page did nothing while
            sixteen contents entries sat between the reader and Section 1. The
            margin now holds the contents and keeps them in view while you
            scroll, which is what a sixteen-section document needs.

            The nav stays FIRST in the DOM — before the body — so it is
            reachable in reading order and lands above the text on a phone.
            Grid places it in the second column on desktop. */}
        <div className="lgl__grid">
          <LegalContents
            label="Contents"
            entries={doc.sections.map((s) => ({ id: s.id, heading: s.heading }))}
          />

          <div className="lgl__body">
            {doc.sections.map((section) => (
              <section key={section.id} id={section.id} className="lgl__section">
                <h2 className="lgl__h2">{section.heading}</h2>
                {section.blocks.map((block, i) => (
                  <BlockView key={i} block={block} />
                ))}
              </section>
            ))}
          </div>
        </div>
      </main>
      <DemeterFooter />
    </div>
  );
}
