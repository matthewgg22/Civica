/* @jsxImportSource react */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { SnapDeductionBreakdown, SnapCalculatorInput } from "./index";
import type { StateCode } from "@/types/verification";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  h1: { fontSize: 16, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 11, marginTop: 14, marginBottom: 5, fontFamily: "Helvetica-Bold", color: "#333" },
  meta: { fontSize: 9, color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 3, alignItems: "flex-start" },
  label: { width: 220, color: "#555" },
  labelIndent: { width: 220, paddingLeft: 16, color: "#555" },
  value: { flex: 1 },
  divider: { borderTopWidth: 1, borderTopColor: "#ccc", borderTopStyle: "solid", marginVertical: 6 },
  pillGood: { backgroundColor: "#e6f5e6", color: "#1f6b1f", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 9 },
  pillBad: { backgroundColor: "#fde8e8", color: "#8a1f1f", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 9 },
  pillNeutral: { backgroundColor: "#eef", color: "#225", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 9 },
  resultBox: { backgroundColor: "#e6f5e6", padding: 12, borderRadius: 4, marginTop: 10, marginBottom: 4 },
  resultBoxBad: { backgroundColor: "#fde8e8", padding: 12, borderRadius: 4, marginTop: 10, marginBottom: 4 },
  resultLabel: { fontSize: 9, color: "#555" },
  resultValue: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#1f6b1f" },
  resultValueBad: { fontSize: 22, fontFamily: "Helvetica-Bold", color: "#8a1f1f" },
  small: { fontSize: 9, color: "#666" },
  bold: { fontFamily: "Helvetica-Bold" },
});

function Row({ label, value, indent = false }: { label: string; value: string; indent?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={indent ? styles.labelIndent : styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

function usd(n: number) {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export interface DeductionsPdfInput {
  input: SnapCalculatorInput;
  result: SnapDeductionBreakdown;
  applicantName?: string;
  generatedAt?: string;
}

export function DeductionsPdf({ input, result, applicantName, generatedAt }: DeductionsPdfInput) {
  const suaTierLabel = input.monthlySuaAmount === 0 ? "none" :
    input.monthlySuaAmount === (input.stateCode === "CA" ? 670 : 745) ? "full" :
    input.monthlySuaAmount === (input.stateCode === "CA" ? 159 : 488) ? "limited" : "telephone";

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.h1}>SNAP Benefit Estimate Worksheet</Text>
        <Text style={styles.meta}>
          {applicantName ? `Applicant: ${applicantName}   |   ` : ""}
          State: {input.stateCode}   |   Household size: {input.householdSize}
          {input.elderlyOrDisabled ? "   |   Elderly/disabled" : ""}
          {"\n"}Generated: {generatedAt ?? new Date().toISOString()}
        </Text>

        {/* Eligibility */}
        <Text style={styles.h2}>Eligibility Determination</Text>
        <View style={styles.row}>
          <Text style={styles.label}>
            Gross income test
            {result.gross_income_test_waived ? " (CA BBCE — waived)" : ` (130% FPL · ${usd(result.gross_income_limit)})`}
          </Text>
          <Text style={result.gross_income_test_pass ? styles.pillGood : styles.pillBad}>
            {result.gross_income_test_pass
              ? result.gross_income_test_waived ? "WAIVED (BBCE)" : "PASS"
              : "FAIL"}
          </Text>
        </View>
        <View style={[styles.row, { marginTop: 4 }]}>
          <Text style={styles.label}>Net income test (100% FPL · {usd(result.net_income_limit)})</Text>
          <Text style={result.net_income_test_pass ? styles.pillGood : styles.pillBad}>
            {result.net_income_test_pass ? "PASS" : "FAIL"}
          </Text>
        </View>
        {result.bbce_eligible && (
          <Text style={[styles.small, { marginTop: 4 }]}>
            CA broad-based categorical eligibility (CDSS ACL 11-27): gross income test and asset test
            waived for households with gross income ≤ 200% FPL.
          </Text>
        )}

        {/* Result box */}
        <View style={result.eligible ? styles.resultBox : styles.resultBoxBad}>
          <Text style={styles.resultLabel}>
            {result.eligible ? "Estimated monthly benefit" : "Household does not appear eligible"}
          </Text>
          <Text style={result.eligible ? styles.resultValue : styles.resultValueBad}>
            {result.eligible ? usd(result.estimated_benefit) + "/mo" : "$0"}
          </Text>
          {result.eligible && (
            <Text style={styles.small}>
              Maximum allotment for {input.householdSize}-person HH: {usd(result.max_allotment)}/mo
            </Text>
          )}
        </View>

        {/* Income */}
        <Text style={styles.h2}>Income</Text>
        <Row label="Gross earned income" value={usd(input.grossMonthlyEarnedIncome)} />
        <Row label="Gross unearned income" value={usd(input.grossMonthlyUnearnedIncome)} />
        <Row label="Total gross income" value={usd(result.gross_income)} />

        {/* Deductions */}
        <Text style={styles.h2}>Deductions</Text>
        <Row label="20% earned income deduction" value={usd(result.earned_income_deduction)} indent />
        <Row label={`Standard deduction (HH size ${input.householdSize})`} value={usd(result.standard_deduction)} indent />
        {result.dependent_care_deduction > 0 && (
          <Row label="Dependent care deduction" value={usd(result.dependent_care_deduction)} indent />
        )}
        <Row label="Adjusted net before shelter" value={usd(result.adjusted_net_before_shelter)} />

        {/* Shelter */}
        <Text style={styles.h2}>Shelter Deduction</Text>
        <Row label="Monthly rent / housing cost" value={usd(input.monthlySheltCost)} indent />
        <Row label={`SUA (${suaTierLabel})`} value={usd(input.monthlySuaAmount)} indent />
        <Row label="Total shelter cost" value={usd(result.shelter_cost_total)} indent />
        <Row label="50% of adjusted net" value={usd(result.half_adjusted_net)} indent />
        <Row label="Excess shelter" value={usd(result.excess_shelter)} indent />
        {!input.elderlyOrDisabled && result.excess_shelter > 672 && (
          <Row label="Shelter deduction cap applied ($672 max)" value="non-elderly/non-disabled" indent />
        )}
        <Row label="Shelter deduction applied" value={usd(result.shelter_deduction_applied)} indent />

        <View style={styles.divider} />
        <View style={styles.row}>
          <Text style={[styles.label, styles.bold]}>Net monthly income</Text>
          <Text style={[styles.value, styles.bold]}>{usd(result.net_income)}</Text>
        </View>

        {result.eligible && (
          <>
            <Text style={styles.h2}>Benefit Calculation</Text>
            <Row label="Maximum allotment" value={usd(result.max_allotment)} indent />
            <Row label="30% × net income" value={usd(result.thirty_pct_net)} indent />
            <View style={styles.row}>
              <Text style={[styles.label, styles.bold]}>Estimated benefit</Text>
              <Text style={[styles.value, styles.bold]}>{usd(result.estimated_benefit)}/mo</Text>
            </View>
          </>
        )}

        {/* Citations */}
        <Text style={styles.h2}>Regulatory Citations</Text>
        {[
          "7 CFR 273.10(e)(1) — 20% earned income deduction",
          "7 CFR 273.10(d)(4) — dependent care deduction",
          "7 CFR 273.10(d)(6) — excess shelter deduction",
          "7 CFR 273.10(e)(4) — benefit calculation (30% of net income)",
          ...(input.stateCode === "CA"
            ? ["CA CDSS ACL 11-27 — broad-based categorical eligibility (BBCE)"]
            : []),
        ].map((c, i) => (
          <Text key={i} style={styles.small}>• {c}</Text>
        ))}

        <Text style={[styles.small, { marginTop: 16, color: "#aaa" }]}>
          Estimate only. Final benefit amount determined by the certifying agency. Not a
          guarantee of eligibility or benefit level.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderDeductionsPdf(data: DeductionsPdfInput): Promise<Buffer> {
  return renderToBuffer(
    <DeductionsPdf
      input={data.input}
      result={data.result}
      applicantName={data.applicantName}
      generatedAt={data.generatedAt}
    />
  );
}
