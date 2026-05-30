import Testing
@testable import Civica

// JR-6 (iOS audit 2026-05-29) regression guard for the destination-
// preview line under SNAPReturningUserHomeView's primary CTA.
//
// The button label is status-aware but says nothing about where the
// tap lands. The preview line closes that gap. These tests cover every
// SNAPApplicationStatus branch in both languages.

@Suite("SNAPReturningUserHome CTA preview line")
struct SNAPReturningUserCTAPreviewTests {

    private func state(
        section: SNAPApplicationSection? = nil,
        stateCode: String? = nil
    ) -> SNAPApplicationDraftStore.PersistedState {
        var draft = SNAPApplicationDraft()
        draft.whereApplying.stateCode = stateCode
        return .init(draft: draft, mode: .sequential, sequentialSection: section)
    }

    // MARK: - screenerInProgress -> "Step N of total · Section"

    @Test("screenerInProgress shows step + section in English")
    func screenerInProgressEnglish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .screenerInProgress,
            persistedState: state(section: .income),
            language: .english
        )
        let total = SNAPApplicationSection.count
        #expect(line == "Step \(SNAPApplicationSection.income.oneBasedIndex) of \(total) \u{00B7} Income")
    }

    @Test("screenerInProgress shows step + section in Spanish")
    func screenerInProgressSpanish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .screenerInProgress,
            persistedState: state(section: .expenses),
            language: .spanish
        )
        let total = SNAPApplicationSection.count
        #expect(line == "Paso \(SNAPApplicationSection.expenses.oneBasedIndex) de \(total) \u{00B7} Gastos")
    }

    @Test("screenerInProgress with no persisted state falls back to step 1")
    func screenerInProgressNilFallback() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .screenerInProgress,
            persistedState: nil,
            language: .english
        )
        let total = SNAPApplicationSection.count
        #expect(line == "Step 1 of \(total) \u{00B7} Where you're applying")
    }

    // MARK: - screenerComplete -> packet-generation action

    @Test("screenerComplete previews generate-packet action (EN)")
    func screenerCompleteEnglish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .screenerComplete,
            persistedState: state(),
            language: .english
        )
        #expect(line == "Generate your application packet")
    }

    @Test("screenerComplete previews generate-packet action (ES)")
    func screenerCompleteSpanish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .screenerComplete,
            persistedState: state(),
            language: .spanish
        )
        #expect(line == "Genera tu paquete de solicitud")
    }

    // MARK: - packetGenerated -> "Open {portal} to submit"

    @Test("packetGenerated previews BenefitsCal for CA (EN)")
    func packetGeneratedCAEnglish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .packetGenerated,
            persistedState: state(stateCode: "CA"),
            language: .english
        )
        #expect(line == "Open BenefitsCal to submit")
    }

    @Test("packetGenerated previews BenefitsCal for CA (ES)")
    func packetGeneratedCASpanish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .packetGenerated,
            persistedState: state(stateCode: "CA"),
            language: .spanish
        )
        #expect(line == "Abrir BenefitsCal para enviar")
    }

    @Test("packetGenerated previews DTA Connect for MA")
    func packetGeneratedMA() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .packetGenerated,
            persistedState: state(stateCode: "MA"),
            language: .english
        )
        #expect(line == "Open DTA Connect to submit")
    }

    // MARK: - documentsRequested -> upload action

    @Test("documentsRequested previews upload action (EN)")
    func documentsRequestedEnglish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .documentsRequested,
            persistedState: state(),
            language: .english
        )
        #expect(line == "Upload requested documents")
    }

    @Test("documentsRequested previews upload action (ES)")
    func documentsRequestedSpanish() {
        let line = SNAPReturningHomeStrings.ctaPreviewLine(
            status: .documentsRequested,
            persistedState: state(),
            language: .spanish
        )
        #expect(line == "Sube los documentos solicitados")
    }

    // MARK: - Default -> empty (no preview noise on off-surface statuses)

    @Test("Off-surface statuses render an empty preview line")
    func offSurfaceStatusesEmpty() {
        let offSurface: [SNAPApplicationStatus] = [
            .notStarted,
            .submittedToState,
            .interviewScheduled,
            .interviewCompleted,
            .decisionApproved,
            .decisionDenied,
            .recertDue,
        ]
        for status in offSurface {
            for language in CivicaLanguage.allCases {
                let line = SNAPReturningHomeStrings.ctaPreviewLine(
                    status: status,
                    persistedState: state(),
                    language: language
                )
                #expect(
                    line.isEmpty,
                    "\(status.rawValue)/\(language.rawValue) should render no preview"
                )
            }
        }
    }
}
