import { describe, expect, it } from "vitest";
import { bannedPhrases, pendingCopyRevisions } from "../src/index.js";

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

  it("pending copy revisions match the prior Swift array exactly (count, order, values)", () => {
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

    // All rows must be pending_signoff until counsel signs.
    for (const row of pendingCopyRevisions) {
      expect(row.status).toBe("pending_signoff");
    }

    // Spot-check the full shape of one row to catch field-name drift.
    expect(pendingCopyRevisions[0]).toEqual({
      id: "approval_email_subject",
      surface_file: "CivicaNotificationTemplates.swift",
      string_id: "approvedEmail.subject",
      current_english: "Approved. ${monthlyBenefit}/mo, starting this month.",
      approved_english:
        "Your SNAP application: eligibility determination complete",
      approved_spanish:
        "Su solicitud de SNAP: determinación de elegibilidad completada",
      audit_reference: "Q3",
      rationale:
        "Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.",
      status: "pending_signoff",
    });
  });
});
