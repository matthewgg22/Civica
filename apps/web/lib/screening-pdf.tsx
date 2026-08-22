// The exported case-file PDF (mockup frame 07). Org members only — a
// guest's Export PDF button stays disabled (enforced both client-side in
// ScreeningWorksheet and server-side in the export route, which requires
// an org identity). Content mirrors ScreeningWorksheet.tsx exactly via the
// shared screening-worksheet-shape module — this is a second RENDERING of
// the same data, not a second source of truth for what that data means.
//
// Typography follows the Type Directions spec, Turn 3 ("sibling not twin"),
// section 3c: Newsreader throughout — body 11pt/17pt leading, section heads
// 12pt semibold, metadata labels 8pt uppercase tracked 0.16em, disclaimer
// 8.5pt. Sans (Be Vietnam Pro) survives only in the tiny legal footer line,
// same split as the rest of the Demeter surface (serif speaks, sans labels).
// Margins 0.9in per the spec; the spec's 68-character measure is left as the
// page's available width rather than hand-computed from font metrics.
//
// @react-pdf/renderer reads real font FILES via Font.register() — it doesn't
// see next/font or system fonts. The TTFs below are the same Newsreader/Be
// Vietnam Pro weights loaded in layout.tsx, vendored locally (not fetched
// from Google Fonts at request time) so PDF generation has no runtime
// network dependency and can't break on a font-hash rotation.

import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { OUTCOME_COPY, CALC_ROWS, money, type BenefitCalcDetail } from "./screening-worksheet-shape";

const FONT_DIR = path.join(process.cwd(), "public", "fonts", "demeter");

Font.register({
  family: "Newsreader",
  fonts: [
    { src: path.join(FONT_DIR, "Newsreader-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "Newsreader-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "Newsreader-SemiBold.ttf"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "Newsreader-Italic.ttf"), fontWeight: 400, fontStyle: "italic" },
  ],
});
Font.register({
  family: "Be Vietnam Pro",
  fonts: [
    { src: path.join(FONT_DIR, "BeVietnamPro-Regular.ttf"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "BeVietnamPro-Medium.ttf"), fontWeight: 500 },
    { src: path.join(FONT_DIR, "BeVietnamPro-SemiBold.ttf"), fontWeight: 600 },
  ],
});

// Same values as apps/web/app/globals.css's --demeter-* tokens (Turn 3).
// Hardcoded, not shared as an import — @react-pdf/renderer's StyleSheet
// doesn't resolve CSS custom properties, so this constant list is the PDF's
// own copy, same pattern the old file already used.
const TERRACOTTA = "#C0553B";
const TERRACOTTA_DEEP = "#8E3A26";
const INK = "#1F2429";
const BODY = "#494F56";
const MUTED = "#646C75";
const RULE = "#E2E5E9";

const styles = StyleSheet.create({
  page: { padding: "0.9in", fontSize: 11, lineHeight: 17 / 11, color: INK, fontFamily: "Newsreader" },
  // Masthead: the settled wordmark treatment (section 3d) — "Demeter" in ink,
  // "AI" in terracotta-deep — plus the document-label small-caps-style
  // treatment (section 3e's "Case" rule: document labels are tracked 0.06em,
  // never all-caps). True OpenType small caps aren't available through
  // react-pdf/fontkit, so this is an uppercase approximation at label size,
  // not genuine small-cap glyphs.
  eyebrow: { fontSize: 8, color: MUTED, letterSpacing: 0.16 * 8, textTransform: "uppercase", marginBottom: 4 },
  eyebrowBrand: { color: INK, fontWeight: 600 },
  eyebrowBrandAI: { color: TERRACOTTA_DEEP, fontWeight: 600 },
  title: { fontSize: 20, fontWeight: 600, marginBottom: 2, letterSpacing: -0.012 * 20 },
  meta: { fontSize: 9, color: MUTED, marginBottom: 20 },
  section: { marginBottom: 18, paddingBottom: 14, borderBottom: `1pt solid ${RULE}` },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: INK, marginBottom: 8 },
  resultLabel: { fontSize: 16, fontWeight: 600, color: TERRACOTTA, marginBottom: 4 },
  resultSummary: { fontSize: 11, color: BODY, lineHeight: 17 / 11 },
  benefitLine: { fontSize: 12, fontWeight: 600, marginTop: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  rowLabel: { color: BODY },
  rowValue: { fontWeight: 600 },
  listItem: { fontSize: 11, color: BODY, marginBottom: 4 },
  disclaimer: {
    fontFamily: "Be Vietnam Pro", fontSize: 7, color: MUTED, marginTop: 20, lineHeight: 1.4,
  },
});

export interface ScreeningPdfProps {
  caseLabel: string | null;
  orgName: string;
  stateCode: string;
  generatedAt: string;
  outcome: string;
  summary: string;
  calc?: BenefitCalcDetail;
  stillNeeded: string[];
}

export function ScreeningPdfDocument({
  caseLabel,
  orgName,
  stateCode,
  generatedAt,
  outcome,
  summary,
  calc,
  stillNeeded,
}: ScreeningPdfProps) {
  const copy = OUTCOME_COPY[outcome] ?? { label: outcome, tone: "pending" as const };
  const rows = calc ? CALC_ROWS.filter(([k]) => calc[k] !== undefined) : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>
          <Text style={styles.eyebrowBrand}>Demeter</Text>
          <Text style={styles.eyebrowBrandAI}> AI</Text>
          <Text> · Submission file</Text>
        </Text>
        <Text style={styles.title}>{caseLabel ?? "Screening case"}</Text>
        <Text style={styles.meta}>
          {orgName} · {stateCode} policy set · Generated {generatedAt}
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Screening result</Text>
          <Text style={styles.resultLabel}>{copy.label}</Text>
          <Text style={styles.resultSummary}>{summary}</Text>
          {calc && outcome !== "not_enough_information" && (
            <Text style={styles.benefitLine}>Est. monthly benefit: {money(calc.monthly_benefit)}</Text>
          )}
        </View>

        {rows.length > 0 && calc && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Benefit calculation</Text>
            {rows.map(([key, label]) => (
              <View style={styles.row} key={key}>
                <Text style={styles.rowLabel}>{label}</Text>
                <Text style={styles.rowValue}>{money(calc[key])}</Text>
              </View>
            ))}
          </View>
        )}

        {stillNeeded.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Still needed ({stillNeeded.length})</Text>
            {stillNeeded.map((item) => (
              <Text style={styles.listItem} key={item}>
                • {item}
              </Text>
            ))}
          </View>
        )}

        <Text style={styles.disclaimer}>
          Screening estimate only, generated by Demeter. The county agency makes the final SNAP
          eligibility determination based on a complete application and verification.
        </Text>
      </Page>
    </Document>
  );
}
