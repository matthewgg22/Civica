// "Your outlined application", as a PDF.
//
// A SECOND RENDERING of buildOutline(), never a second source of truth. The
// panel, the email and this page all read the same sections in the same order,
// so a person who prints it and a person who reads it on screen are looking at
// the same document.
//
// Typography follows the same Type Directions spec as screening-pdf.tsx —
// Newsreader for everything that speaks, Be Vietnam Pro for the small legal
// line, 0.9in margins. Fonts are registered from vendored TTFs for the reason
// that file gives: @react-pdf/renderer reads font FILES, so it cannot see
// next/font, and fetching from Google at request time would put a network
// dependency inside PDF generation.
//
// WHAT THIS DOCUMENT IS FOR: someone sits down in front of the real
// application — on a county portal, or on paper at a kitchen table — and
// copies from this. That is why it is plain, why nothing is abbreviated, and
// why the heading says in the first two lines that it is not an application
// and has not been sent anywhere.

import path from "node:path";
import { Document, Page, Text, View, StyleSheet, Font } from "@react-pdf/renderer";
import { buildOutline, type OutlineInput } from "./demeter-outline";

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
const WHEAT = "#E8C547";

const styles = StyleSheet.create({
  page: {
    padding: "0.9in",
    fontSize: 11,
    lineHeight: 17 / 11,
    color: INK,
    fontFamily: "Newsreader",
  },
  eyebrow: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 0.16 * 8,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  eyebrowBrand: { color: INK, fontWeight: 600 },
  title: { fontSize: 20, fontWeight: 600, marginBottom: 2, letterSpacing: -0.012 * 20 },
  meta: { fontSize: 9, color: MUTED, marginBottom: 11 },
  // THE FIRST THING READ. A tidy document is exactly what someone could
  // mistake for having applied, so this sits above the content, not under it,
  // and is marked in the brand's own gold rather than a warning red — it is a
  // clarification, not an alarm.
  notice: {
    borderLeft: `3pt solid ${WHEAT}`,
    paddingLeft: 10,
    marginBottom: 16,
    fontSize: 10,
    color: BODY,
    lineHeight: 1.5,
  },
  // TIGHT ENOUGH TO BE ONE PAGE. A short outline was spilling two sections onto
  // a second sheet with most of the first still empty — and a two-page document
  // is a two-page document to print, carry and not lose half of.
  section: { marginBottom: 11, paddingBottom: 9, borderBottom: `1pt solid ${RULE}` },
  sectionTitle: { fontSize: 12, fontWeight: 600, color: INK, marginBottom: 5 },
  line: { fontSize: 11, color: BODY, marginBottom: 3 },
  portalLink: { fontSize: 11, color: TERRACOTTA_DEEP },
  disclaimer: {
    fontFamily: "Be Vietnam Pro",
    fontSize: 7,
    color: MUTED,
    marginTop: 12,
    lineHeight: 1.4,
  },
});

export function OutlinePdf({ input }: { input: OutlineInput }) {
  const sections = buildOutline(input);
  const date = input.generatedAt.toISOString().slice(0, 10);

  return (
    <Document
      title="Your outlined application"
      author="Demeter"
      subject="A working sheet for a SNAP application"
    >
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.eyebrow}>
          <Text style={styles.eyebrowBrand}>Demeter</Text> · SNAP enrollment and eligibility
          assistance
        </Text>
        <Text style={styles.title}>Your outlined application</Text>
        <Text style={styles.meta}>
          Prepared {date}
          {input.stateName ? ` · ${input.stateName}` : ""}
        </Text>

        <View style={styles.notice}>
          <Text>
            This is a working sheet to help you fill in the real application. It is not an
            application, and it has not been sent to anyone.
          </Text>
        </View>

        {sections.map((s) => (
          <View key={s.heading} style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>{s.heading}</Text>
            {s.lines.map((l, i) => (
              <Text
                key={`${s.heading}-${i}`}
                // The portal URL is the one line on this page someone will
                // type into a browser, so it keeps the link colour even though
                // a PDF cannot be clicked in every reader.
                style={l.startsWith("http") ? styles.portalLink : styles.line}
              >
                {l}
              </Text>
            ))}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Demeter is AI and can make mistakes. Check anything you rely on against your state SNAP
          agency before you submit. Demeter does not decide your case; your state agency does.
        </Text>
      </Page>
    </Document>
  );
}
