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
import type {
  AssetPackage,
  GigIncomePackage,
  SharedLeasePackage,
  StoredPackage,
  UtilityPackage,
  VerificationPackage,
} from "@/types/verification";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 10, fontFamily: "Helvetica", color: "#222" },
  h1: { fontSize: 18, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 12, marginTop: 14, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  meta: { fontSize: 9, color: "#666", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 3 },
  label: { width: 180, color: "#555" },
  value: { flex: 1 },
  pill: {
    padding: 3,
    paddingHorizontal: 6,
    borderRadius: 4,
    fontSize: 9,
    backgroundColor: "#eef",
    color: "#225",
    alignSelf: "flex-start",
  },
  warn: { backgroundColor: "#fde8e8", color: "#8a1f1f" },
  good: { backgroundColor: "#e6f5e6", color: "#1f6b1f" },
  sigBlock: {
    marginTop: 28,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#aaa",
    borderTopStyle: "solid",
  },
  small: { fontSize: 9, color: "#666" },
  tableHeader: { flexDirection: "row", marginTop: 4, fontFamily: "Helvetica-Bold" },
  tableRow: { flexDirection: "row", marginBottom: 2 },
  cell: { flex: 1, paddingRight: 4 },
});

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{String(value)}</Text>
    </View>
  );
}

function Header({ title, stored }: { title: string; stored: StoredPackage }) {
  return (
    <>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.meta}>
        Package ID: {stored.id}   |   Applicant: {stored.applicant_name}   |   Generated:{" "}
        {stored.created_at}
      </Text>
    </>
  );
}

function Signature() {
  return (
    <View style={styles.sigBlock}>
      <Text style={styles.h2}>Applicant Attestation</Text>
      <Text style={styles.small}>
        I declare under penalty of perjury that the information in this package is true and
        complete to the best of my knowledge. I understand that providing false information
        may result in denial of benefits and potential prosecution under 7 U.S.C. § 2024.
      </Text>
      <View style={{ marginTop: 18, flexDirection: "row" }}>
        <View style={{ flex: 1, marginRight: 12 }}>
          <Text>____________________________________</Text>
          <Text style={styles.small}>Applicant signature</Text>
        </View>
        <View style={{ width: 140 }}>
          <Text>__________________</Text>
          <Text style={styles.small}>Date</Text>
        </View>
      </View>
    </View>
  );
}

function UtilityBody({ pkg }: { pkg: UtilityPackage }) {
  const u = pkg.intake_responses.utilities_paid_by_applicant;
  const paid = [
    u.heat_gas && "heat/gas",
    u.electricity && "electricity",
    u.water && "water",
    u.phone_internet && "phone/internet",
    u.none && "none",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <Text style={styles.h2}>SUA Determination</Text>
      <Row label="State" value={pkg.state_code} />
      <Row label="SUA tier" value={pkg.tier.toUpperCase()} />
      <Row
        label="Monthly amount"
        value={pkg.tier_amount_usd > 0 ? `$${pkg.tier_amount_usd}` : "—"}
      />
      <Row label="Rule citation" value={pkg.rule_citation} />
      <Row label="Basis" value={pkg.basis} />
      <Row label="Attestation required" value={pkg.attestation_required ? "yes" : "no"} />

      <Text style={styles.h2}>Intake Responses</Text>
      <Row
        label="Landlord pays / includes utilities"
        value={pkg.intake_responses.landlord_pays_any ? "yes" : "no"}
      />
      <Row label="Utilities paid by applicant" value={paid || "(none)"} />

      <Text style={styles.h2}>Utility Accounts (UtilityAPI)</Text>
      <Row label="Service address" value={pkg.service_address} />
      <Row label="Name match" value={pkg.name_match ? "yes" : "no"} />
      {pkg.utility_accounts_found.length === 0 && <Row label="Accounts found" value="none" />}
      {pkg.utility_accounts_found.map((a, i) => (
        <View key={i} style={{ marginTop: 4 }}>
          <Row label="Utility" value={`${a.utility} (${a.utility_type})`} />
          <Row label="Account holder" value={a.account_holder_name} />
          <Row label="Status" value={a.account_status} />
        </View>
      ))}

      <Text style={styles.h2}>Verification Method</Text>
      <Text style={styles.small}>
        Structured intake (applicant-declared) + UtilityAPI account lookup keyed on service
        address and applicant name. Tier derived per state SUA rules.
      </Text>
    </>
  );
}

function SharedLeaseBody({ pkg }: { pkg: SharedLeasePackage }) {
  const ev = pkg.bank_payment_evidence;
  return (
    <>
      <Text style={styles.h2}>Lease Status</Text>
      <Row label="Lease in applicant's name" value={pkg.lease_in_applicant_name ? "yes" : "no"} />
      <Row label="Primary leaseholder" value={pkg.leaseholder_name || "—"} />
      <Row label="Stated monthly rent share" value={`$${pkg.stated_monthly_rent.toFixed(2)}`} />
      <Row label="Supporting document" value={pkg.document_type} />
      <Row label="Document uploaded" value={pkg.document_uploaded ? "yes" : "no"} />

      <Text style={styles.h2}>Bank Payment Evidence (Plaid)</Text>
      <Row label="Match found" value={ev.match_found ? "yes" : "no"} />
      <Row label="Matched amount (avg)" value={`$${ev.matched_amount.toFixed(2)}`} />
      <Row label="Frequency" value={ev.frequency} />
      <Row label="Confidence" value={ev.confidence} />
      <Row label="Months confirmed" value={ev.months_confirmed} />
      {ev.matched_transactions.length > 0 && (
        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>Date</Text>
            <Text style={styles.cell}>Amount</Text>
            <Text style={[styles.cell, { flex: 2 }]}>Description</Text>
          </View>
          {ev.matched_transactions.map((t, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{t.date}</Text>
              <Text style={styles.cell}>${t.amount.toFixed(2)}</Text>
              <Text style={[styles.cell, { flex: 2 }]}>{t.description}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.h2}>Address Validation (USPS)</Text>
      <Row label="Address valid" value={pkg.address_valid ? "yes" : "no"} />
      <Row label="Normalized" value={pkg.address_normalized || "—"} />

      <Text style={styles.h2}>QC Defensibility</Text>
      <Row label="Score" value={pkg.qc_defensibility_score.toUpperCase()} />

      <Text style={styles.h2}>Verification Method</Text>
      <Text style={styles.small}>
        Structured intake + uploaded supporting document (sublease or landlord letter) +
        Plaid bank transaction analysis for recurring rent transfers + USPS address validation.
      </Text>
      <Text style={styles.h2}>Regulatory Citations</Text>
      {pkg.regulatory_citations.map((c, i) => (
        <Text key={i} style={styles.small}>• {c}</Text>
      ))}
    </>
  );
}

function GigIncomeBody({ pkg }: { pkg: GigIncomePackage }) {
  return (
    <>
      <Text style={styles.h2}>Income Sources</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cell}>Source</Text>
        <Text style={styles.cell}>Type</Text>
        <Text style={styles.cell}>Method</Text>
        <Text style={styles.cell}>Confidence</Text>
        <Text style={styles.cell}>Monthly avg</Text>
      </View>
      {pkg.income_sources.map((s, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={styles.cell}>{s.source_name}</Text>
          <Text style={styles.cell}>{s.type}</Text>
          <Text style={styles.cell}>{s.verification_method}</Text>
          <Text style={styles.cell}>{s.confidence}</Text>
          <Text style={styles.cell}>${s.monthly_average.toFixed(2)}</Text>
        </View>
      ))}

      <Text style={styles.h2}>Reconciliation</Text>
      <Row label="API-verified monthly total" value={`$${pkg.total_monthly_verified.toFixed(2)}`} />
      <Row
        label="Bank-corroborated monthly total"
        value={`$${pkg.total_monthly_bank_corroborated.toFixed(2)}`}
      />
      <Row
        label="Self-declared cash"
        value={`$${pkg.total_monthly_self_declared_cash.toFixed(2)}`}
      />
      <Row label="Total declared" value={`$${pkg.total_monthly_declared.toFixed(2)}`} />
      <Row label="Reconciliation gap" value={`$${pkg.reconciliation_gap.toFixed(2)}`} />
      <Row label="Reconciliation flag" value={pkg.reconciliation_flag ? "FLAG" : "clean"} />

      <Text style={styles.h2}>Cash Attestation</Text>
      <Row label="Signed" value={pkg.cash_attestation_signed ? "yes" : "no"} />
      {pkg.cash_log && pkg.cash_log.length > 0 && (
        <View>
          <View style={styles.tableHeader}>
            <Text style={styles.cell}>Week of</Text>
            <Text style={styles.cell}>Amount</Text>
          </View>
          {pkg.cash_log.map((w, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.cell}>{w.week_of}</Text>
              <Text style={styles.cell}>${w.amount.toFixed(2)}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.h2}>SNAP Eligibility Notes</Text>
      <Row
        label="CA BBCE applies"
        value={pkg.snap_bbce_applies ? "yes — gross income test & asset test waived (CDSS ACL 11-27)" : "no"}
      />
      <Row
        label="1-person gross income limit (130% FPL)"
        value={`$${pkg.snap_gross_income_limit_1person.toLocaleString()}/mo`}
      />

      <Text style={styles.h2}>Verification Method</Text>
      <Text style={styles.small}>
        W-2 and platform-gig earnings sourced from Argyle (employer/platform-connected
        90-day history). Bank deposits sourced from Plaid for cross-corroboration. Cash income
        captured via signed attestation and flagged as self-declared/unverifiable.
      </Text>
      <Text style={styles.h2}>Regulatory Citations</Text>
      {pkg.regulatory_citations.map((c, i) => (
        <Text key={i} style={styles.small}>• {c}</Text>
      ))}
    </>
  );
}

function AssetBody({ pkg }: { pkg: AssetPackage }) {
  return (
    <>
      <Text style={styles.h2}>Asset Test</Text>
      <Row label="State" value={pkg.state_code} />
      <Row label="Asset test applies" value={pkg.asset_test_applies ? "yes" : "no"} />
      <Row label="Result" value={pkg.asset_test_result.replace("_", " ").toUpperCase()} />
      {pkg.asset_test_applies && (
        <>
          <Row label="Total countable assets" value={`$${pkg.total_countable_assets.toFixed(2)}`} />
          <Row label="Asset limit" value={`$${pkg.asset_limit_usd.toLocaleString()}`} />
        </>
      )}

      <Text style={styles.h2}>Asset Inventory</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.cell, { flex: 2 }]}>Description</Text>
        <Text style={styles.cell}>Type</Text>
        <Text style={styles.cell}>Stated</Text>
        <Text style={styles.cell}>Exempt</Text>
        <Text style={styles.cell}>Countable</Text>
      </View>
      {pkg.assets.map((a, i) => (
        <View key={i} style={styles.tableRow}>
          <Text style={[styles.cell, { flex: 2 }]}>{a.description}</Text>
          <Text style={styles.cell}>{a.type}</Text>
          <Text style={styles.cell}>${a.stated_value.toFixed(2)}</Text>
          <Text style={styles.cell}>{a.exempt ? `yes (${a.exemption_reason ?? ""})` : "no"}</Text>
          <Text style={styles.cell}>${a.countable_value.toFixed(2)}</Text>
        </View>
      ))}

      <Text style={styles.h2}>Regulatory Citations</Text>
      {pkg.regulatory_citations.map((c, i) => (
        <Text key={i} style={styles.small}>• {c}</Text>
      ))}
    </>
  );
}

export function VerificationPdf({ stored }: { stored: StoredPackage }) {
  const pkg = stored.package;
  const title =
    pkg.flow === "utility"
      ? "SNAP Utility / SUA Verification Package"
      : pkg.flow === "shared-lease"
        ? "SNAP Shared-Lease Verification Package"
        : pkg.flow === "gig-income"
          ? "SNAP Earned-Income Verification Package"
          : "SNAP Asset / Resource Verification Package";
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Header title={title} stored={stored} />
        {pkg.flow === "utility" && <UtilityBody pkg={pkg} />}
        {pkg.flow === "shared-lease" && <SharedLeaseBody pkg={pkg} />}
        {pkg.flow === "gig-income" && <GigIncomeBody pkg={pkg} />}
        {pkg.flow === "assets" && <AssetBody pkg={pkg} />}
        <Signature />
      </Page>
    </Document>
  );
}

export async function renderPackagePdf(stored: StoredPackage): Promise<Buffer> {
  return renderToBuffer(<VerificationPdf stored={stored} />);
}
