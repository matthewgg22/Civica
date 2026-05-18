// SNAPComplianceCopyRegistry+Generated.swift
//
// AUTO-GENERATED — DO NOT EDIT.
// Regenerate with: pnpm --filter @civica/snap-compliance-copy generate:swift
// Source of truth: packages/snap-compliance-copy/data/
//
// Parity contract (T6): the symbols and string values emitted here must
// match the hand-authored SNAPComplianceCopyRegistry.swift byte-for-byte
// at the value level (whitespace and comments are normalised). The
// parity test in packages/snap-compliance-copy/test/parity.test.ts
// asserts this; CI re-runs the generator and `git diff --exit-code`
// catches drift.

import Foundation

extension SNAPComplianceCopyRegistry {

    static let bannedPhrasesGenerated: [BannedPhrase] = [
        BannedPhrase(
            id: "submit_to_dta",
            phrase: "Submit to DTA Connect",
            auditReference: "Q14",
            rationale: "Implies a Civica->DTA write integration that does not exist without written MA DTA authorization. Use 'Open MA DTA Connect to submit' until authorization is confirmed and an integration ships."
        ),
        BannedPhrase(
            id: "submit_to_benefitscal",
            phrase: "Submit to BenefitsCal",
            auditReference: "Q14 (CA launch parallel)",
            rationale: "Implies a Civica->BenefitsCal/CDSS write integration that does not exist without written authorization from CDSS or the user's county welfare department. Use 'Open BenefitsCal to submit' until authorization is confirmed and an integration ships. Parallels the MA DTA Connect ban; CA is the launch state so the bar applies before user-visible surfaces ship."
        )
    ]

    static let pendingCopyRevisionsGenerated: [PendingCopyRevision] = [
        PendingCopyRevision(
            id: "approval_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.subject",
            currentEnglish: "Approved. ${monthlyBenefit}/mo, starting this month.",
            approvedEnglish: "Your SNAP application: eligibility determination complete",
            approvedSpanish: "Su solicitud de SNAP: determinación de elegibilidad completada",
            auditReference: "Q3",
            rationale: "Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "decision_approved_headline",
            surfaceFile: "SNAPDecisionApprovedView.swift",
            stringID: "SNAPDecisionApprovedStrings.headline",
            currentEnglish: "You're approved.",
            approvedEnglish: "You have been determined eligible for SNAP benefits.",
            approvedSpanish: "Se ha determinado que usted es elegible para recibir beneficios de SNAP.",
            auditReference: "Q3 (boundary)",
            rationale: "Attributes the state agency's determination to Civica. Replace with state-attributed phrasing.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "expedited_banner_almost",
            surfaceFile: "SNAPExpeditedBanner.swift",
            stringID: "almostHeadline",
            currentEnglish: "Almost — one more answer could speed this up",
            approvedEnglish: "You may qualify for expedited SNAP benefits — answer one more question to check.",
            approvedSpanish: "Es posible que califique para beneficios expeditados de SNAP. Responda una pregunta más para verificar.",
            auditReference: "Q3 / Q2.4",
            rationale: "Gamification of a regulatory eligibility category. Reframe to attribute expedited criteria to 7 CFR 273.2(i).",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_entry_subtitle",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "entryCardSubtitle",
            currentEnglish: "Five questions. See your monthly dollar amount before you apply.",
            approvedEnglish: "Answer a few questions to estimate your potential SNAP eligibility. Results are estimates only — actual eligibility is determined by [Agency].",
            approvedSpanish: "Responda algunas preguntas para estimar su posible elegibilidad para SNAP. Los resultados son estimaciones únicamente; la elegibilidad real es determinada por [Agencia].",
            auditReference: "Q3 / Q2.3",
            rationale: "Pairs ease cue with incentive cue connected to applying. Reframe as a screening estimate.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "estimator_apply_cta",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "applyCTA",
            currentEnglish: "Apply for SNAP",
            approvedEnglish: "Apply on BenefitsCal",
            approvedSpanish: "Solicitar en BenefitsCal",
            auditReference: "Q3 / Q2.3",
            rationale: "Generic 'Apply for SNAP' CTA without official-link attribution; should route via the state apply portal (e.g. 'Open BenefitsCal application' for CA, 'Open MA DTA Connect application' for MA) or similar neutral path. CA-portal naming requires the same counsel sign-off MA's did.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "doc_requested_sms_body",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "documentRequestedSMS.body",
            currentEnglish: "DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.",
            approvedEnglish: "Your SNAP application requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app.",
            approvedSpanish: "Su solicitud de SNAP requiere documentación adicional. Envíe un talón de pago reciente antes del {deadline}. Puede responder a este mensaje con una foto o cargarlo en la aplicación.",
            auditReference: "Q3",
            rationale: "'Keeps your application moving' is loss-aversion framing. Reframe as factual deadline.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_one_day_sms",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertOneDayBeforeSMS.body",
            currentEnglish: "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time.",
            approvedEnglish: "Your SNAP recertification is due {recertDate}. To recertify, visit [Portal] or text RECERT for a link.",
            approvedSpanish: "Su recertificación de SNAP vence el {recertDate}. Para recertificar, visite [Portal] o escriba RECERT para recibir un enlace.",
            auditReference: "Q3",
            rationale: "Urgency + ease + loss-aversion stacked. Reframe as factual deadline with consequence stated neutrally.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "recert_heads_up_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertHeadsUpEmail.subject",
            currentEnglish: "Recertify in 60 days. Usually 4 minutes.",
            approvedEnglish: "SNAP recertification required — deadline in 60 days",
            approvedSpanish: "Recertificación de SNAP requerida — fecha límite en 60 días",
            auditReference: "Q3",
            rationale: "Ease framing tied to recertification. Reframe to factual deadline only.",
            status: .pendingSignoff
        ),
        PendingCopyRevision(
            id: "ebt_pin_cta",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.buttonLabel",
            currentEnglish: "Set the EBT PIN",
            approvedEnglish: "Set your EBT PIN at ebt.ca.gov",
            approvedSpanish: "Establezca su PIN de EBT en ebt.ca.gov",
            auditReference: "Q3",
            rationale: "Implies Civica performs the PIN action. Reframe as 'Learn how to set your EBT card PIN' linking to official EBT/DTA instructions.",
            status: .pendingSignoff
        )
    ]
}
