// Generate the counsel-facing Markdown from lib/legal.
//
//   pnpm --filter web legal:md
//
// The site renders lib/legal directly; counsel redlines the Markdown this
// writes. One source, two outputs — so a redline that lands in the TS shows up
// in the next generated file, and there is never a second copy of a sentence to
// forget to update.
//
// Regenerate and commit whenever a document changes. docs/legal/*.md carries a
// generated-file header so nobody edits it by hand and loses the change.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENTS, ENTITY, RETENTION_JOB_LIVE, type Block, type LegalDocument } from "../lib/legal/index";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "..", "..", "..", "docs", "legal");

function renderBlock(block: Block): string {
  switch (block.kind) {
    case "p":
      return block.text;
    case "ul":
      return block.items.map((i) => `- ${i}`).join("\n");
    case "callout":
      // Blockquote — the closest Markdown gets to "set this apart", and it
      // survives paste into Word, which is how counsel will actually read it.
      return `> ${block.tone === "warning" ? "**" : ""}${block.text}${block.tone === "warning" ? "**" : ""}`;
    case "table": {
      const head = `| ${block.columns.join(" | ")} |`;
      const rule = `| ${block.columns.map(() => "---").join(" | ")} |`;
      const rows = block.rows.map((r) => `| ${r.join(" | ")} |`);
      return [head, rule, ...rows].join("\n");
    }
  }
}

function renderDocument(doc: LegalDocument): string {
  const banner =
    doc.status === "draft"
      ? [
          "> **STATUS: DRAFT — NOT IN EFFECT.**",
          "> Written against the running code, not yet reviewed by counsel.",
          "> See `docs/legal/README.md` for the open questions and the publish checklist.",
        ].join("\n")
      : "";

  const body = doc.sections
    .map((s) => [`## ${s.heading}`, ...s.blocks.map(renderBlock)].join("\n\n"))
    .join("\n\n");

  return [
    "<!-- GENERATED FILE — DO NOT EDIT BY HAND.",
    "     Source: apps/web/lib/legal/. Regenerate: pnpm --filter web legal:md",
    "     Redlines should be applied to the source, then regenerated. -->",
    "",
    `# ${doc.title}`,
    "",
    `**${ENTITY}** · Last updated ${doc.lastUpdated}`,
    "",
    `*${doc.lede}*`,
    ...(banner ? ["", banner] : []),
    "",
    body,
    "",
  ].join("\n");
}

mkdirSync(OUT_DIR, { recursive: true });

for (const doc of DOCUMENTS) {
  const path = join(OUT_DIR, `demeter-${doc.slug}.md`);
  writeFileSync(path, renderDocument(doc), "utf8");
  console.log(`wrote ${path} (${doc.status})`);
}

if (!RETENTION_JOB_LIVE) {
  console.log(
    "\nNOTE: RETENTION_JOB_LIVE is false — the purge job enforcing the stated\n" +
      "retention windows does not exist yet, so every document is held at draft.",
  );
}
