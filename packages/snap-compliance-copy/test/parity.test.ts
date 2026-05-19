import { describe, expect, it } from "vitest";
import { bannedPhrases, pendingCopyRevisions } from "../src/index";

// Parity expectations are the values that lived in
// SNAPComplianceCopyRegistry.swift before T6 extracted them to JSON.
// If counsel signs a row and the JSON's `status` / `approved_*` slots
// change, update the expectation here in the same PR — that is the
// signal that the parity contract intentionally moved.

describe("parity vs prior hand-authored Swift literals", () => {
  it("banned phrases match the prior Swift array exactly", () => {
    expect(bannedPhrases).toEqual([
      {
        id: "submit_to_dta",
        phrase: "Submit to DTA Connect",
        audit_reference: "Q14",
        rationale:
          "Implies a Civica->DTA write integration that does not exist without written MA DTA authorization. Use 'Open MA DTA Connect to submit' until authorization is confirmed and an integration ships.",
      },
      {
        id: "submit_to_benefitscal",
        phrase: "Submit to BenefitsCal",
        audit_reference: "Q14 (CA launch parallel)",
        rationale:
          "Implies a Civica->BenefitsCal/CDSS write integration that does not exist without written authorization from CDSS or the user's county welfare department. Use 'Open BenefitsCal to submit' until authorization is confirmed and an integration ships. Parallels the MA DTA Connect ban; CA is the launch state so the bar applies before user-visible surfaces ship.",
      },
    ]);
  });

  it("pending copy revisions match the prior Swift array exactly (count, order, ids)", () => {
    expect(pendingCopyRevisions).toHaveLength(9);

    expect(pendingCopyRevisions.map((r) => r.id)).toEqual([
      "approval_email_subject",
      "decision_approved_headline",
      "expedited_banner_almost",
      "estimator_entry_subtitle",
      "estimator_apply_cta",
      "doc_requested_sms_body",
      "recert_one_day_sms",
      "recert_heads_up_email_subject",
      "ebt_pin_cta",
    ]);
  });

  // Counsel-prep decisions applied 2026-05-19 (see
  // docs/outreach/counsel-prep-analysis-2026-05-19.md). All 9 rows
  // flipped to `approved`; licensed-counsel signature on
  // docs/outreach/counsel-batch-2026-05-19.md is still required before
  // these surfaces ship to production. `approved` here is software
  // state, not legal sign-off.
  it("all 9 rows are marked approved after counsel-prep 2026-05-19", () => {
    for (const row of pendingCopyRevisions) {
      expect(row.status).toBe("approved");
    }
  });

  it("state-keyed rows expose both CA and MA variants", () => {
    const stateKeyedIDs = [
      "decision_approved_headline",
      "estimator_entry_subtitle",
      "doc_requested_sms_body",
      "recert_one_day_sms",
      "recert_heads_up_email_subject",
    ];
    for (const id of stateKeyedIDs) {
      const row = pendingCopyRevisions.find((r) => r.id === id);
      expect(row, `missing row ${id}`).toBeDefined();
      expect(row!.approved_english_by_state?.CA).toBeDefined();
      expect(row!.approved_english_by_state?.MA).toBeDefined();
      expect(row!.approved_spanish_by_state?.CA).toBeDefined();
      expect(row!.approved_spanish_by_state?.MA).toBeDefined();
    }
  });

  it("CA-variant decision headline names CalFresh; MA-variant names SNAP", () => {
    const row = pendingCopyRevisions.find(
      (r) => r.id === "decision_approved_headline",
    )!;
    expect(row.approved_english_by_state?.CA).toContain("CalFresh");
    expect(row.approved_english_by_state?.MA).toContain("SNAP");
  });

  it("recert SMS no longer mentions the RECERT keyword (Decision 3)", () => {
    const row = pendingCopyRevisions.find(
      (r) => r.id === "recert_one_day_sms",
    )!;
    // Both flat default + state-keyed variants must drop the keyword phrase.
    expect(row.approved_english).not.toMatch(/RECERT/);
    expect(row.approved_spanish).not.toMatch(/RECERT/);
    expect(row.approved_english_by_state?.CA).not.toMatch(/RECERT/);
    expect(row.approved_english_by_state?.MA).not.toMatch(/RECERT/);
  });

  it("estimator subtitle CA-variant names CDSS and county welfare department (Decision 2)", () => {
    const row = pendingCopyRevisions.find(
      (r) => r.id === "estimator_entry_subtitle",
    )!;
    expect(row.approved_english_by_state?.CA).toContain("CDSS");
    expect(row.approved_english_by_state?.CA).toContain("county welfare");
    expect(row.approved_english_by_state?.MA).toContain("DTA");
  });

  it("all rows that carry Spanish strings are flagged for Session K reviewer", () => {
    for (const row of pendingCopyRevisions) {
      expect(row.spanish_parity_review_pending).toBe(true);
    }
  });

  // Spot-check the full shape of one row to catch field-name drift.
  it("approval_email_subject row matches expected shape", () => {
    const row = pendingCopyRevisions.find(
      (r) => r.id === "approval_email_subject",
    )!;
    expect(row.surface_file).toBe("CivicaNotificationTemplates.swift");
    expect(row.string_id).toBe("approvedEmail.subject");
    expect(row.approved_english).toBe(
      "Your SNAP application: eligibility determination complete",
    );
    expect(row.approved_spanish).toBe(
      "Su solicitud de SNAP: determinación de elegibilidad completada",
    );
    expect(row.status).toBe("approved");
  });
});
