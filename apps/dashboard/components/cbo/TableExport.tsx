"use client";

import { useState, useRef, useEffect } from "react";

// Zero-dependency table export for the CBO preview demo tables.
//  • CSV  → native Blob download (opens in Excel / Numbers / Sheets)
//  • PDF  → opens a print-optimized, table-only window and triggers the
//           browser's print dialog ("Save as PDF"). No libraries, no bundle
//           weight on this public page.
//
// Pure presentation data is passed in as string[][] so it serializes cleanly
// from the server components that own the tables. Institutional styling per
// DESIGN.md §10.

export interface TableExportProps {
  /** Download base name, no extension (e.g. "cbo-applications"). */
  filename: string;
  /** Human title printed atop the PDF + used as the CSV's first line context. */
  title: string;
  /** Column headers. */
  columns: string[];
  /** Row cells as plain strings, already formatted for display. */
  rows: string[][];
  /** Footnote printed under the PDF table (e.g. the synthetic-data disclaimer). */
  note?: string;
}

function csvCell(v: string): string {
  // RFC-4180: quote if the value contains comma, quote, or newline; double quotes.
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function downloadCsv({ filename, columns, rows }: TableExportProps) {
  const lines = [columns, ...rows].map((r) => r.map(csvCell).join(","));
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printPdf({ title, columns, rows, note }: TableExportProps) {
  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) return;
  const thead = `<tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>`;
  const tbody = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  // Self-contained, monochrome, institutional print sheet — no app chrome.
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font: 12px -apple-system, system-ui, sans-serif; color: #1A1714; margin: 32px; }
  h1 { font-size: 15px; font-weight: 700; margin: 0 0 4px; }
  .sub { font-size: 11px; color: #57524A; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; color: #57524A; border-bottom: 1px solid #1A1714; padding: 6px 10px; }
  td { font-size: 12px; padding: 6px 10px; border-bottom: 1px solid rgba(0,0,0,.12); vertical-align: top; }
  th:not(:first-child), td:not(:first-child) { text-align: right; }
  .note { font-size: 10px; color: #57524A; margin-top: 14px; line-height: 1.5; }
  @media print { body { margin: 0; } @page { margin: 18mm; } }
</style></head><body>
  <h1>${esc(title)}</h1>
  <p class="sub">Civica · CBO preview · generated ${esc(new Date().toISOString().slice(0, 10))}</p>
  <table><thead>${thead}</thead><tbody>${tbody}</tbody></table>
  ${note ? `<p class="note">${esc(note)}</p>` : ""}
<\/body><\/html>`);
  w.document.close();
  // Give the new document a tick to lay out before invoking print.
  w.setTimeout(() => w.print(), 250);
}

export default function TableExport(props: TableExportProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-[2px] border border-hairline bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-graphite hover:bg-paper focus:outline-none focus:ring-2 focus:ring-pine"
      >
        Export
        <span aria-hidden="true" className="text-[9px]">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-10 mt-1 w-36 rounded-[2px] border border-hairline bg-surface shadow-sm"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => { downloadCsv(props); setOpen(false); }}
            className="block w-full px-3 py-2 text-left text-[12px] text-ink hover:bg-paper"
          >
            CSV <span className="text-muted">(Excel)</span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => { printPdf(props); setOpen(false); }}
            className="block w-full border-t border-hairline px-3 py-2 text-left text-[12px] text-ink hover:bg-paper"
          >
            PDF
          </button>
        </div>
      )}
    </div>
  );
}
