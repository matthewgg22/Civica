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
    <>
      <main className="lgl" id="main-content">
        <header className="lgl__head">
          <h1 className="lgl__title">{doc.title}</h1>
          <p className="lgl__lede">{doc.lede}</p>
          <p className="lgl__updated">Last updated {doc.lastUpdated}</p>

          {/* The point of `status`. An unreviewed document that reads exactly
              like a live one is the failure this banner exists to prevent. */}
          {doc.status === "draft" && (
            <p className="lgl__draft" role="note">
              <strong>Draft — not yet in effect.</strong> This document has been
              written but not yet reviewed by counsel. It describes how Demeter
              works today and is published here for review.
            </p>
          )}

          <nav className="lgl__docnav" aria-label="Legal documents">
            {DOC_NAV.map((d) => (
              <Link
                key={d.slug}
                href={`/${d.slug}`}
                className={`lgl__docnav-link${d.slug === doc.slug ? " is-current" : ""}`}
                aria-current={d.slug === doc.slug ? "page" : undefined}
              >
                {d.label}
              </Link>
            ))}
          </nav>
        </header>

        {/* On-page contents. These documents are long, and the section a person
            actually came for — retention, immigration, arbitration — is
            otherwise several screens of scrolling away. */}
        <nav className="lgl__toc" aria-label="Contents">
          <p className="lgl__toc-label">Contents</p>
          <ol className="lgl__toc-list">
            {doc.sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.heading}</a>
              </li>
            ))}
          </ol>
        </nav>

        {doc.sections.map((section) => (
          <section key={section.id} id={section.id} className="lgl__section">
            <h2 className="lgl__h2">{section.heading}</h2>
            {section.blocks.map((block, i) => (
              <BlockView key={i} block={block} />
            ))}
          </section>
        ))}
      </main>
      <DemeterFooter />
    </>
  );
}
