// "Your outlined application", as a PDF.
//
// A SECOND RENDERING of buildOutline(), never a second source of truth. The
// panel, the email and this page all read the same sections in the same order,
// so a person who prints it and a person who reads it on screen are looking at
// the same document.
//
// Typography follows the same Type Directions spec as screening-pdf.tsx —
// Newsreader for everything that speaks, Be Vietnam Pro for labels and the
// small legal line. Fonts are registered from vendored TTFs for the reason
// that file gives: @react-pdf/renderer reads font FILES, so it cannot see
// next/font, and fetching from Google at request time would put a network
// dependency inside PDF generation.
//
// WHAT THIS DOCUMENT IS FOR: someone sits down in front of the real
// application — on a county portal, or on paper at a kitchen table — and
// copies from this. That is why every fact renders as a LABELLED ROW with a
// dotted leader to its value (the shape of the form they are about to fill
// in), why open items carry a checkbox to tick off, and why the heading says
// in the first two lines that it is not an application and has not been sent
// anywhere.
//
// ONE PAGE, BY LAYOUT (#898 P2-8). The single-column version spilled a real
// six-section outline onto a second sheet with a fifth of page one still
// empty — and the stranded half was "Still to work out" plus the legal line,
// the worst half to lose. Sections now flow into two columns, split by line
// count with the section order preserved (left column first, then right —
// the order the application asks in). outline-pdf.test.tsx renders real
// households and counts pages.

import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { buildOutline, type OutlineInput, type OutlineSection } from "./demeter-outline";

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

// Same values as globals.css's --demeter-* tokens. Hardcoded for the reason
// screening-pdf.tsx gives: react-pdf's StyleSheet cannot resolve CSS custom
// properties. Wheat is the measured logo gold (#E8C547), not the older guess.
const TERRACOTTA_DEEP = "#8E3A26";
const INK = "#241E1A";
const BODY = "#55504C";
const MUTED = "#6E655E";
const RULE = "#E3E0DB";
const LEADER = "#C9C4BD";
const WHEAT = "#E8C547";

const styles = StyleSheet.create({
  page: {
    paddingTop: "0.7in",
    paddingBottom: "1.05in", // room for the fixed legal line
    paddingHorizontal: "0.75in",
    fontSize: 10,
    color: INK,
    fontFamily: "Newsreader",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: "Be Vietnam Pro",
    fontSize: 7.5,
    color: MUTED,
    letterSpacing: 0.16 * 7.5,
    textTransform: "uppercase",
  },
  eyebrowBrand: { color: INK, fontWeight: 600 },
  meta: { fontFamily: "Be Vietnam Pro", fontSize: 7.5, color: MUTED },
  title: { fontSize: 19, fontWeight: 600, letterSpacing: -0.012 * 19, marginBottom: 10 },
  // THE FIRST THING READ. A tidy document is exactly what someone could
  // mistake for having applied, so this sits above the content, not under it,
  // and is marked in the brand's own gold rather than a warning red — it is a
  // clarification, not an alarm.
  notice: {
    borderLeft: `3pt solid ${WHEAT}`,
    paddingLeft: 10,
    marginBottom: 16,
    fontSize: 9.5,
    color: BODY,
    lineHeight: 1.5,
  },
  columns: { flexDirection: "row", gap: 26 },
  col: { flex: 1 },
  section: { marginBottom: 14 },
  // Sans labels, serif speaks — the section heading is a label.
  sectionTitle: {
    fontFamily: "Be Vietnam Pro",
    fontSize: 7.5,
    fontWeight: 600,
    color: MUTED,
    letterSpacing: 0.14 * 7.5,
    textTransform: "uppercase",
    borderBottom: `1pt solid ${RULE}`,
    paddingBottom: 3,
    marginBottom: 6,
  },
  // A labelled fact, in the shape of the form it will be copied into.
  row: { flexDirection: "row", alignItems: "flex-end", marginBottom: 4 },
  rowLabel: { fontFamily: "Be Vietnam Pro", fontSize: 8, color: BODY, maxWidth: "62%" },
  leader: {
    flex: 1,
    borderBottom: `0.8pt dotted ${LEADER}`,
    marginHorizontal: 5,
    marginBottom: 1.5,
    minWidth: 10,
  },
  rowValue: { fontSize: 10.5, fontWeight: 500, color: INK, textAlign: "right" },
  bare: { fontSize: 10.5, fontWeight: 500, color: INK, marginBottom: 4 },
  note: { fontSize: 8.5, fontStyle: "italic", color: MUTED, lineHeight: 1.45, marginBottom: 4 },
  portalLink: { fontSize: 9.5, color: TERRACOTTA_DEEP, marginBottom: 4 },
  checkRow: { flexDirection: "row", marginBottom: 5 },
  checkbox: {
    width: 8,
    height: 8,
    border: `0.9pt solid ${MUTED}`,
    borderRadius: 1,
    marginRight: 6,
    marginTop: 1.5,
  },
  checkText: { flex: 1, fontSize: 9.5, color: BODY, lineHeight: 1.4 },
  disclaimer: {
    position: "absolute",
    bottom: "0.55in",
    left: "0.75in",
    right: "0.75in",
    fontFamily: "Be Vietnam Pro",
    fontSize: 7,
    color: MUTED,
    lineHeight: 1.4,
    borderTop: `1pt solid ${RULE}`,
    paddingTop: 6,
  },
});

/** One outline line, classified for rendering. buildOutline emits strings so
 *  the email and panel stay plain; the split into label/value happens HERE,
 *  presentation-only, and falls back to printing the line whole. */
function renderLine(line: string, key: string) {
  if (/^https?:\/\//.test(line)) {
    // The one line on this page someone will type into a browser, so it keeps
    // the link colour even though a PDF cannot be clicked in every reader.
    return (
      <Text key={key} style={styles.portalLink}>
        {line}
      </Text>
    );
  }
  // Sentences ("3 people who buy and cook food together.", the before-tax
  // note) read as guidance, not facts to copy — set small and quiet.
  if (/[.!?]$/.test(line)) {
    return (
      <Text key={key} style={styles.note}>
        {line}
      </Text>
    );
  }
  // "Label: value" and "Who — details" both become a form-shaped row.
  const m = /^([^:]{1,48}): (.+)$/.exec(line) ?? /^(.{1,48}?) — (.+)$/.exec(line);
  if (m) {
    return (
      <View key={key} style={styles.row}>
        <Text style={styles.rowLabel}>{m[1]}</Text>
        <View style={styles.leader} />
        <Text style={styles.rowValue}>{m[2]}</Text>
      </View>
    );
  }
  return (
    <Text key={key} style={styles.bare}>
      {line}
    </Text>
  );
}

function SectionBlock({ section }: { section: OutlineSection }) {
  return (
    <View style={styles.section} wrap={false}>
      <Text style={styles.sectionTitle}>{section.heading}</Text>
      {section.kind === "checklist"
        ? section.lines.map((l, i) => (
            <View key={`${section.heading}-${i}`} style={styles.checkRow}>
              <View style={styles.checkbox} />
              <Text style={styles.checkText}>{l}</Text>
            </View>
          ))
        : section.lines.map((l, i) => renderLine(l, `${section.heading}-${i}`))}
    </View>
  );
}

/** Split sections into two columns, preserving order (left first, then
 *  right), at the index that best balances the columns by weight. Long lines
 *  wrap inside a half-width column, so they count double. */
function splitColumns(sections: OutlineSection[]): [OutlineSection[], OutlineSection[]] {
  if (sections.length < 3) return [sections, []];
  const weight = (s: OutlineSection) =>
    2 + s.lines.reduce((n, l) => n + (l.length > 48 ? 2 : 1), 0);
  const weights = sections.map(weight);
  const total = weights.reduce((a, b) => a + b, 0);
  let best = 1;
  let bestDiff = Infinity;
  let acc = 0;
  for (let i = 0; i < sections.length - 1; i++) {
    acc += weights[i]!;
    const diff = Math.abs(acc - (total - acc));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i + 1;
    }
  }
  return [sections.slice(0, best), sections.slice(best)];
}

export function OutlinePdf({ input }: { input: OutlineInput }) {
  const sections = buildOutline(input);
  const [left, right] = splitColumns(sections);
  const date = input.generatedAt.toISOString().slice(0, 10);

  return (
    <Document
      title="Your outlined application"
      author="Demeter"
      subject="A working sheet for a SNAP application"
    >
      <Page size="LETTER" style={styles.page}>
        <View style={styles.headerRow}>
          <Text style={styles.eyebrow}>
            <Text style={styles.eyebrowBrand}>Demeter</Text> · SNAP enrollment and eligibility
            assistance
          </Text>
          <Text style={styles.meta}>
            Prepared {date}
            {input.stateName ? ` · ${input.stateName}` : ""}
          </Text>
        </View>
        <Text style={styles.title}>Your outlined application</Text>

        <View style={styles.notice}>
          <Text>
            This is a working sheet to help you fill in the real application. It is not an
            application, and it has not been sent to anyone.
          </Text>
        </View>

        <View style={styles.columns}>
          <View style={styles.col}>
            {left.map((s) => (
              <SectionBlock key={s.heading} section={s} />
            ))}
          </View>
          {right.length > 0 && (
            <View style={styles.col}>
              {right.map((s) => (
                <SectionBlock key={s.heading} section={s} />
              ))}
            </View>
          )}
        </View>

        <Text style={styles.disclaimer} fixed>
          Demeter is AI and can make mistakes. Check anything you rely on against your state SNAP
          agency before you submit. Demeter does not decide your case; your state agency does.
        </Text>
      </Page>
    </Document>
  );
}
