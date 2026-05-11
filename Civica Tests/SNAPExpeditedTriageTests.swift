import Foundation
import Testing
@testable import Civica

@MainActor
struct SNAPExpeditedTriageTests {

    // MARK: - Hard rules

    @Test func lowIncomeLowResourcesRuleFires() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 120
        draft.income.liquidResources = 50

        let result = await evaluateTriage(draft: draft)

        #expect(result.firedHardRules.contains(.lowIncomeLowResources))
        #expect(result.combinedConfidence == 1.0)
        #expect(result.state == .high)
        #expect(result.expeditedEligible)
    }

    @Test func lowIncomeLowResourcesNeedsBothConditions() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 120
        draft.income.liquidResources = 200  // over $100

        let result = await evaluateTriage(draft: draft)

        #expect(!result.firedHardRules.contains(.lowIncomeLowResources))
    }

    @Test func migrantSeasonalDestituteRuleFires() async {
        var draft = SNAPApplicationDraft()
        draft.household.migrantSeasonalFarmworker = .yes
        draft.income.liquidResources = 50

        let result = await evaluateTriage(draft: draft)

        #expect(result.firedHardRules.contains(.migrantSeasonalDestitute))
        #expect(result.combinedConfidence == 1.0)
        #expect(result.state == .high)
    }

    @Test func housingExceedsResourcesRuleFires() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 800
        draft.income.liquidResources = 0
        draft.expenses.monthlyRentOrHousing = 700
        draft.expenses.monthlyUtilities = 200

        let result = await evaluateTriage(draft: draft)

        #expect(result.firedHardRules.contains(.housingExceedsResources))
        #expect(result.combinedConfidence == 1.0)
    }

    @Test func hardRulesEmptyForComfortableHousehold() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 4_000
        draft.income.liquidResources = 5_000
        draft.expenses.monthlyRentOrHousing = 1_200
        draft.expenses.monthlyUtilities = 200

        let result = await evaluateTriage(draft: draft)

        #expect(result.firedHardRules.isEmpty)
        #expect(result.combinedConfidence < 1.0)
    }

    // MARK: - Confidence state mapping

    @Test func stateAtLowBoundary() {
        #expect(ExpeditedConfidenceState.from(0.39) == .low)
        #expect(ExpeditedConfidenceState.from(0.0) == .low)
    }

    @Test func stateAtUncertainLowerBoundary() {
        #expect(ExpeditedConfidenceState.from(0.40) == .uncertain)
    }

    @Test func stateAtUncertainUpperBoundary() {
        #expect(ExpeditedConfidenceState.from(0.74) == .uncertain)
    }

    @Test func stateAtHighBoundary() {
        #expect(ExpeditedConfidenceState.from(0.75) == .high)
        #expect(ExpeditedConfidenceState.from(1.0) == .high)
    }

    // MARK: - Combined confidence

    @Test func hardRulePinsCombinedToOne() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 120
        draft.income.liquidResources = 50

        let result = await evaluateTriage(draft: draft)

        #expect(result.combinedConfidence == 1.0)
        #expect(result.state == .high)
    }

    // MARK: - Heuristic determinism

    @Test func heuristicIsDeterministic() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 1_400
        draft.income.liquidResources = 200
        draft.income.recentJobLoss30d = .yes
        draft.household.hasMinorInHousehold = true
        draft.expenses.monthlyRentOrHousing = 1_000

        let a = await evaluateTriage(draft: draft)
        let b = await evaluateTriage(draft: draft)

        #expect(a.softConfidence == b.softConfidence)
        #expect(a.combinedConfidence == b.combinedConfidence)
        #expect(a.state == b.state)
    }

    @Test func heuristicMonotonicInSignals() async {
        // Adding signals should never decrease confidence.
        var weak = SNAPApplicationDraft()
        weak.income.grossMonthlyIncome = 4_000

        var strong = weak
        strong.income.liquidResources = 100
        strong.expenses.utilityShutoffNotice = .yes
        strong.income.recentJobLoss30d = .yes
        strong.whereApplying.housingStatus = .unhoused
        strong.household.hasMinorInHousehold = true

        let weakResult = await evaluateTriage(draft: weak)
        let strongResult = await evaluateTriage(draft: strong)

        #expect(strongResult.softConfidence >= weakResult.softConfidence)
    }

    // MARK: - Clarifying question

    @Test func clarifyingQuestionReturnsNilWhenNotUncertain() async {
        var draft = SNAPApplicationDraft()
        draft.income.grossMonthlyIncome = 5_000  // clearly not expedited

        let result = await evaluateTriage(draft: draft)
        let q = clarifyingQuestion(for: result, draft: draft)

        // Either state is .low (q must be nil) or accidentally
        // .uncertain (then q must point at an unanswered field).
        if result.state == .low {
            #expect(q == nil)
        }
    }

    @Test func clarifyingQuestionPicksHighestWeightUnanswered() {
        // Synthesize an uncertain result and a draft where every
        // soft-signal field is nil. liquidResources has the highest
        // weight, so the clarifying question should point to .income.
        let uncertain = ExpeditedTriageResult(
            firedHardRules: [],
            softConfidence: 0.5,
            combinedConfidence: 0.5,
            state: .uncertain,
            rationale: []
        )
        let draft = SNAPApplicationDraft()
        let q = clarifyingQuestion(for: uncertain, draft: draft)

        #expect(q?.0 == .income)
    }

    @Test func clarifyingQuestionSkipsAnsweredFields() {
        let uncertain = ExpeditedTriageResult(
            firedHardRules: [],
            softConfidence: 0.5,
            combinedConfidence: 0.5,
            state: .uncertain,
            rationale: []
        )
        var draft = SNAPApplicationDraft()
        draft.income.liquidResources = 500       // answered (highest)
        draft.expenses.utilityShutoffNotice = .no  // answered (next)
        draft.whereApplying.housingStatus = .stableHome  // answered
        // recentJobLoss30d still nil — should be the next prompt

        let q = clarifyingQuestion(for: uncertain, draft: draft)

        #expect(q?.0 == .income)
        #expect(q?.1.contains("job") == true)
    }

    // MARK: - Orchestrator integration

    @Test func orchestratorUpdatesTriageResultAfterSection() async {
        let store = SNAPApplicationDraftStore()
        store.clear()
        let vm = SNAPApplicationFlowOrchestratorViewModel(store: store)
        vm.draft.income.grossMonthlyIncome = 120
        vm.draft.income.liquidResources = 50
        vm.finishSection(.income)

        // Yield until @Published triageResult lands. The detached
        // Task should publish within a few microtask hops.
        for _ in 0..<20 {
            await Task.yield()
            if vm.triageResult != nil { break }
        }

        #expect(vm.triageResult != nil)
        #expect(vm.triageResult?.state == .high)
        store.clear()
    }

    @Test func orchestratorClearsTriageOnReset() async {
        let store = SNAPApplicationDraftStore()
        store.clear()
        let vm = SNAPApplicationFlowOrchestratorViewModel(store: store)
        vm.draft.income.grossMonthlyIncome = 120
        vm.draft.income.liquidResources = 50
        vm.finishSection(.income)
        for _ in 0..<20 {
            await Task.yield()
            if vm.triageResult != nil { break }
        }

        vm.resetDraft()

        #expect(vm.triageResult == nil)
        store.clear()
    }

    // MARK: - Backward-compat with SNAPEligibilityResult bool

    @Test func eligibilityEvaluatorBoolMatchesHardRules() {
        var hardRuleDraft = SNAPApplicationDraft()
        hardRuleDraft.income.grossMonthlyIncome = 120
        hardRuleDraft.income.liquidResources = 50
        let hard = SNAPLocalEligibilityEvaluator.evaluate(hardRuleDraft)
        #expect(hard.expeditedEligible)

        var notExpeditedDraft = SNAPApplicationDraft()
        notExpeditedDraft.income.grossMonthlyIncome = 4_000
        notExpeditedDraft.income.liquidResources = 5_000
        notExpeditedDraft.expenses.monthlyRentOrHousing = 1_200
        notExpeditedDraft.expenses.monthlyUtilities = 200
        let notExpedited = SNAPLocalEligibilityEvaluator.evaluate(notExpeditedDraft)
        #expect(!notExpedited.expeditedEligible)
    }
}
