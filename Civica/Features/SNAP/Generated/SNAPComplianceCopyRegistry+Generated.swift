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
            approvedEnglishByState: [:],
            approvedSpanishByState: [:],
            auditReference: "Q3",
            rationale: "Dollar-amount-first subject reads as incentive; reframe as factual state-agency status update.",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "decision_approved_headline",
            surfaceFile: "SNAPDecisionApprovedView.swift",
            stringID: "SNAPDecisionApprovedStrings.headline",
            currentEnglish: "You're approved.",
            approvedEnglish: "You have been determined eligible for SNAP benefits.",
            approvedSpanish: "Se ha determinado que usted es elegible para recibir beneficios de SNAP.",
            approvedEnglishByState: ["CA": "You have been determined eligible for CalFresh benefits.", "MA": "You have been determined eligible for SNAP benefits."],
            approvedSpanishByState: ["CA": "Se ha determinado que usted es elegible para recibir beneficios de CalFresh.", "MA": "Se ha determinado que usted es elegible para recibir beneficios de SNAP."],
            auditReference: "Q3 (boundary)",
            rationale: "Attributes the state agency's determination to Civica. Replace with state-attributed phrasing. State-keyed: CalFresh (CA) vs SNAP (MA).",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "expedited_banner_almost",
            surfaceFile: "SNAPExpeditedBanner.swift",
            stringID: "almostHeadline",
            currentEnglish: "Almost — one more answer could speed this up",
            approvedEnglish: "You may qualify for expedited SNAP benefits — answer one more question to check.",
            approvedSpanish: "Es posible que califique para beneficios expeditados de SNAP. Responda una pregunta más para verificar.",
            approvedEnglishByState: [:],
            approvedSpanishByState: [:],
            auditReference: "Q3 / Q2.4",
            rationale: "Gamification of a regulatory eligibility category. Reframe to attribute expedited criteria to 7 CFR 273.2(i).",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "estimator_entry_subtitle",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "entryCardSubtitle",
            currentEnglish: "Five questions. See your monthly dollar amount before you apply.",
            approvedEnglish: "Answer a few questions to estimate your potential SNAP eligibility. Results are estimates only — actual eligibility is determined by [Agency].",
            approvedSpanish: "Responda algunas preguntas para estimar su posible elegibilidad para SNAP. Los resultados son estimaciones únicamente; la elegibilidad real es determinada por [Agencia].",
            approvedEnglishByState: ["CA": "Answer a few questions to estimate your potential CalFresh eligibility. Results are estimates only — actual eligibility is determined by the California Department of Social Services (CDSS) or your county welfare department.", "MA": "Answer a few questions to estimate your potential SNAP eligibility. Results are estimates only — actual eligibility is determined by the Department of Transitional Assistance (DTA)."],
            approvedSpanishByState: ["CA": "Responda algunas preguntas para estimar su posible elegibilidad para CalFresh. Los resultados son estimaciones únicamente; la elegibilidad real es determinada por el Departamento de Servicios Sociales de California (CDSS) o el departamento de bienestar de su condado.", "MA": "Responda algunas preguntas para estimar su posible elegibilidad para SNAP. Los resultados son estimaciones únicamente; la elegibilidad real es determinada por el Departamento de Asistencia Transitoria (DTA)."],
            auditReference: "Q3 / Q2.3",
            rationale: "Pairs ease cue with incentive cue connected to applying. Reframe as a screening estimate. [Agency] resolved to CDSS/county (CA) or DTA (MA) per Decision 2.",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "estimator_apply_cta",
            surfaceFile: "SNAPBenefitEstimatorStrings.swift",
            stringID: "applyCTA",
            currentEnglish: "Apply for SNAP",
            approvedEnglish: "Apply on BenefitsCal",
            approvedSpanish: "Solicitar en BenefitsCal",
            approvedEnglishByState: [:],
            approvedSpanishByState: [:],
            auditReference: "Q3 / Q2.3",
            rationale: "Generic 'Apply for SNAP' CTA without official-link attribution; routes via the state apply portal (BenefitsCal for CA; MA fallback to 'Apply on DTA Connect' tracked separately). External-link affordance rendered per Decision 4.",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "doc_requested_sms_body",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "documentRequestedSMS.body",
            currentEnglish: "DTA needs one more thing: a recent paystub. Send a photo here or upload in the app. By {deadline} keeps your application moving.",
            approvedEnglish: "Your SNAP application with {agency} requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app.",
            approvedSpanish: "Su solicitud de SNAP con {agency} requiere documentación adicional. Envíe un talón de pago reciente antes del {deadline}. Puede responder a este mensaje con una foto o cargarlo en la aplicación.",
            approvedEnglishByState: ["CA": "Your CalFresh application with CDSS requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app.", "MA": "Your SNAP application with DTA requires additional documentation. Please submit a recent paystub by {deadline}. You can reply to this message with a photo or upload it in the app."],
            approvedSpanishByState: ["CA": "Su solicitud de CalFresh con CDSS requiere documentación adicional. Envíe un talón de pago reciente antes del {deadline}. Puede responder a este mensaje con una foto o cargarlo en la aplicación.", "MA": "Su solicitud de SNAP con DTA requiere documentación adicional. Envíe un talón de pago reciente antes del {deadline}. Puede responder a este mensaje con una foto o cargarlo en la aplicación."],
            auditReference: "Q3",
            rationale: "'Keeps your application moving' is loss-aversion framing. Reframed as factual deadline with agency attribution (Decision 1+6 SMS).",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "recert_one_day_sms",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertOneDayBeforeSMS.body",
            currentEnglish: "Tomorrow is your recert deadline ({recertDate}). 4 minutes if you start now. If you miss it, benefits pause until you submit — text RECERT for a fast link any time.",
            approvedEnglish: "Your SNAP recertification with {agency} is due {recertDate}. To recertify, visit {portal}.",
            approvedSpanish: "Su recertificación de SNAP con {agency} vence el {recertDate}. Para recertificar, visite {portal}.",
            approvedEnglishByState: ["CA": "Your CalFresh recertification with CDSS is due {recertDate}. To recertify, visit https://benefitscal.com.", "MA": "Your SNAP recertification with DTA is due {recertDate}. To recertify, visit https://dtaconnect.eohhs.mass.gov."],
            approvedSpanishByState: ["CA": "Su recertificación de CalFresh con CDSS vence el {recertDate}. Para recertificar, visite https://benefitscal.com.", "MA": "Su recertificación de SNAP con DTA vence el {recertDate}. Para recertificar, visite https://dtaconnect.eohhs.mass.gov."],
            auditReference: "Q3",
            rationale: "Urgency + ease + loss-aversion stacked. Reframed as factual deadline with agency attribution. Per Decision 3, the RECERT keyword phrase is removed (deferred to v1.1 enhancement).",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "recert_heads_up_email_subject",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "recertHeadsUpEmail.subject",
            currentEnglish: "Recertify in 60 days. Usually 4 minutes.",
            approvedEnglish: "SNAP recertification required — deadline in 60 days",
            approvedSpanish: "Recertificación de SNAP requerida — fecha límite en 60 días",
            approvedEnglishByState: ["CA": "CalFresh recertification required — deadline in 60 days", "MA": "SNAP recertification required — deadline in 60 days"],
            approvedSpanishByState: ["CA": "Recertificación de CalFresh requerida — fecha límite en 60 días", "MA": "Recertificación de SNAP requerida — fecha límite en 60 días"],
            auditReference: "Q3",
            rationale: "Ease framing tied to recertification. Reframed to factual deadline; state-keyed program name (CalFresh CA / SNAP MA).",
            status: .approved,
            spanishParityReviewPending: true
        ),
        PendingCopyRevision(
            id: "ebt_pin_cta",
            surfaceFile: "CivicaNotificationTemplates.swift",
            stringID: "approvedEmail.buttonLabel",
            currentEnglish: "Set the EBT PIN",
            approvedEnglish: "Set your EBT PIN at ebt.ca.gov",
            approvedSpanish: "Establezca su PIN de EBT en ebt.ca.gov",
            approvedEnglishByState: [:],
            approvedSpanishByState: [:],
            auditReference: "Q3",
            rationale: "Implies Civica performs the PIN action. CA-only string today; MA fallback to DTA EBT services portal tracked separately. External-link affordance rendered per Decision 4.",
            status: .approved,
            spanishParityReviewPending: true
        )
    ]
}
