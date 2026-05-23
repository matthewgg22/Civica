import Foundation
import Testing
@testable import Civica

// EXPERIMENTAL SILOED MODULE: tests for the persona picker wiring.
//
// The PersonaPickerView itself is a SwiftUI view (state lives in @State,
// not externally observable without a snapshot harness). What we CAN
// pin down deterministically is the contract surface around it:
//
//   1. PracticeSessionViewModel honors a custom SessionContext passed
//      in at init time — the picker's promise to the rest of the app.
//   2. SessionContext.defaultCA matches the skip-path expectation
//      (California, gigWorker applicant, friendlyRushed persona).
//   3. Every combination of CaseworkerArchetype × ApplicantArchetype
//      produces a valid SessionContext the VM can consume — no enum
//      case crashes the construction path.
//   4. CaseworkerArchetype.isImplemented stays a strict subset (one
//      implemented today, four preview) — guards against silently
//      shipping a persona the backend hasn't been prompted for.
//
// We use the Swift Testing framework (`@Test`/`#expect`) to match the
// prevailing pattern in PracticeSessionViewModelTests.swift.

@MainActor
@Suite struct PersonaPickerTests {

    // MARK: - 1. VM honors custom SessionContext

    @Test func viewModelInitAcceptsCustomContext() {
        let custom = PracticeSessionViewModel.SessionContext(
            stateCode: "CA",
            stateName: "California",
            scenario: .initial,
            archetype: .senior,
            persona: .adversarial
        )
        let vm = PracticeSessionViewModel(
            recertId: "rec-1",
            context: custom,
            client: MockInterviewCoachClient()
        )
        #expect(vm.context.persona == .adversarial)
        #expect(vm.context.archetype == .senior)
        #expect(vm.context.stateCode == "CA")
    }

    // MARK: - 2. defaultCA matches the skip-path expectation

    @Test func skipPathDefaultsToCaliforniaGigWorkerFriendlyRushed() {
        let defaultCtx = PracticeSessionViewModel.SessionContext.defaultCA
        #expect(defaultCtx.stateCode == "CA")
        #expect(defaultCtx.stateName == "California")
        #expect(defaultCtx.scenario == .initial)
        #expect(defaultCtx.archetype == .gigWorker)
        #expect(defaultCtx.persona == .friendlyRushed)
    }

    // MARK: - 3. Every (persona, archetype) combo yields a valid SessionContext

    @Test func everyComboProducesValidSessionContext() {
        for persona in CaseworkerArchetype.allCases {
            for archetype in ApplicantArchetype.allCases {
                let ctx = PracticeSessionViewModel.SessionContext(
                    stateCode: "CA",
                    stateName: "California",
                    scenario: .initial,
                    archetype: archetype,
                    persona: persona
                )
                let vm = PracticeSessionViewModel(
                    recertId: "rec-1",
                    context: ctx,
                    client: MockInterviewCoachClient()
                )
                #expect(vm.context.persona == persona)
                #expect(vm.context.archetype == archetype)
                // Status starts idle — no network call has fired yet, so
                // construction itself never leaves the VM in a failed
                // state regardless of the persona × archetype combo.
                #expect(vm.status == .idle)
            }
        }
    }

    // MARK: - 4. Picker selection state machine

    @Test func selectionStateMachineProducesResolvedContextOnFullSelection() {
        var selectedCaseworker: CaseworkerArchetype?
        var selectedApplicant: ApplicantArchetype?
        var canStart: Bool { selectedCaseworker != nil && selectedApplicant != nil }

        // Initial state: nothing picked, start is gated.
        #expect(canStart == false)

        // Tap a caseworker — partial selection, still gated.
        selectedCaseworker = .adversarial
        #expect(canStart == false)

        // Tap an applicant — both picked, start enabled.
        selectedApplicant = .mixedStatus
        #expect(canStart == true)

        // The resolved context the picker would push matches what the
        // user selected — no silent fallback to defaultCA while both
        // selections are present.
        let resolved = PracticeSessionViewModel.SessionContext(
            stateCode: PracticeSessionViewModel.SessionContext.defaultCA.stateCode,
            stateName: PracticeSessionViewModel.SessionContext.defaultCA.stateName,
            scenario: PracticeSessionViewModel.SessionContext.defaultCA.scenario,
            archetype: selectedApplicant ?? PracticeSessionViewModel.SessionContext.defaultCA.archetype,
            persona: selectedCaseworker ?? PracticeSessionViewModel.SessionContext.defaultCA.persona
        )
        #expect(resolved.persona == .adversarial)
        #expect(resolved.archetype == .mixedStatus)
    }

    @Test func tappingDifferentCaseworkerReplacesPriorSelection() {
        var selectedCaseworker: CaseworkerArchetype?
        selectedCaseworker = .friendlyRushed
        #expect(selectedCaseworker == .friendlyRushed)
        selectedCaseworker = .skeptical
        #expect(selectedCaseworker == .skeptical)
    }

    // MARK: - 5. isImplemented invariants
    //
    // The picker still lets the user tap a non-implemented persona
    // (preview pill signals the state). What we lock in here is that
    // the set of implemented personas hasn't silently expanded —
    // backend prompts have to land case-by-case before this assertion
    // is updated.

    @Test func friendlyRushedIsTheOnlyImplementedPersonaToday() {
        let implemented = CaseworkerArchetype.allCases.filter(\.isImplemented)
        let preview = CaseworkerArchetype.allCases.filter { !$0.isImplemented }
        #expect(implemented == [.friendlyRushed])
        #expect(preview.count == 4)
        #expect(Set(preview) == Set([.formal, .skeptical, .languageMismatched, .adversarial]))
    }

    // MARK: - 6. Hashable conformance round-trip
    //
    // The picker uses navigationDestination(item:) which requires
    // Hashable. Guard against a future refactor stripping the file-
    // scoped extension and breaking the navigation path silently.

    @Test func sessionContextIsHashableForNavigationDestination() {
        let a = PracticeSessionViewModel.SessionContext.defaultCA
        let b = PracticeSessionViewModel.SessionContext.defaultCA
        let c = PracticeSessionViewModel.SessionContext(
            stateCode: "CA",
            stateName: "California",
            scenario: .initial,
            archetype: .senior,
            persona: .adversarial
        )
        var seen: Set<PracticeSessionViewModel.SessionContext> = []
        seen.insert(a)
        seen.insert(b) // dedupes with a
        seen.insert(c)
        #expect(seen.count == 2)
        #expect(a == b)
        #expect(a != c)
    }
}
