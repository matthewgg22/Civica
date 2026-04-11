import SwiftUI

struct IssueCallCenterView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @Environment(\.openURL) private var openURL
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.scenePhase) private var scenePhase

    @StateObject private var viewModel: IssueCallCenterViewModel
    @StateObject private var waterfallController = EmojiWaterfallController()
    @AppStorage("feature.call_score_v1_enabled") private var callScoreV1Enabled = true
    @FocusState private var focusedField: FocusedField?
    @State private var shareItems: [Any] = []
    @State private var showingShareSheet = false
    @State private var didCompleteMAPC = false
    @State private var isTalkingPointsExpanded = false
    @State private var lastPromptedLaunchEventID: String?
    @State private var selectedExampleCategory: String = Self.allExamplesFilterLabel
    @State private var expandedVoicemailBriefIDs: Set<String> = []
    @State private var expandedLiveBriefIDs: Set<String> = []
    @State private var mapcSessionLoggedBriefIDs: Set<String> = []
    @State private var mapcOptimisticIssueGains: [String: MAPCIssueGainState] = [:]
    @State private var mapcBriefsSignature: String = ""
    @State private var animatedTotalVoteNowCalls: Int?
    @State private var animatedUserCallCount: Int?
    @State private var animatedMapcCallGain: Int = 0
    @State private var showMapcCallGainBadge = false
    @State private var mapcForwardSlideTransition = true
    @State private var isMAPCCardTransitioning = false
    @State private var mapcTransitionResetTask: Task<Void, Never>?
    @State private var exampleSearchQuery: String = ""
    @State private var showAllPremadeExamples = false
    @State private var showAllExampleCategoryChips = false
    @State private var expandedPremadeLiveScriptIDs: Set<String> = []
    @State private var assistantComposerText: String = ""
    @State private var assistantMessages: [AssistantChatMessage] = []
    @State private var assistantIsThinking = false
    @State private var assistantFlowStage: AssistantFlowStage = .awaitingPrompt
    @State private var hasPostedCurrentDraftBackground = false
    @State private var animatedAssistantMessageIDs: Set<UUID> = []
    @State private var pendingBackgroundMessageID: UUID?
    @State private var isBackgroundMessageReadyForActions = false
    @State private var pendingScriptPreviewMessageID: UUID?
    @State private var isScriptPreviewReadyForMAPCActions = false
    @State private var previewLintBlocked = false
    @State private var hasRetriedPreviewLintRegeneration = false
    @State private var hasAcceptedCurrentMAPCV3Preview = false
    @State private var currentBackgroundDiscussionOptions: [String] = []
    @State private var hasPickedDiscussionOptionInCurrentCycle = false
    @State private var suppressTranslationForNextBackground = false
    @State private var awaitingCustomAgenticStrategyInput = false
    @State private var isKeyboardVisible = false
    @State private var nonMapcTabSlidesForward = true
    @State private var previousNonMapcTab: CivicIssueCallTab = .assistant
    @Namespace private var topTabSelectionNamespace
    private let userAddressLine: String
    private let residencyNotice: String
    private let initialTab: CivicIssueCallTab
    private let showsReturnHomeButton: Bool
    private let hidesTabBar: Bool
    private static let assistantIntroText = "Tell me the issue you want your elected representatives to act on. I’ll help turn it into a specific call guide."

    private enum FocusedField: Hashable {
        case concern
        case billRef
    }

    private enum AssistantFlowStage {
        case awaitingPrompt
        case awaitingBackgroundApproval
        case awaitingPreviewConfirmation
        case awaitingMapcStart
    }

    private enum MAPCTurnIntent: String {
        case newIssue = "new_issue"
        case clarificationAnswer = "clarification_answer"
        case reviseIssue = "revise_issue"
        case reviseAsk = "revise_ask"
        case reviseToneOrConstraints = "revise_tone_or_constraints"
        case metaFrustration = "meta_frustration"
        case startOver = "start_over"
    }

    private struct MAPCTurnIntentClassification {
        let intent: MAPCTurnIntent
        let newIssueScore: Double
    }

    private enum MAPCAgenticStrategyChip: String, CaseIterable, Identifiable {
        case strongestFirstStep = "Strongest First Step"
        case legislativePush = "Legislative Push"
        case fundingLeverage = "Funding Leverage"
        case oversightWithDeadlines = "Oversight With Deadlines"
        case positionOnRecord = "Position on Record"
        case billLinkedOnlyIfReal = "Bill-Linked (Only if Real)"
        case districtFirstImpact = "District-First Impact"
        case bipartisanFeasiblePath = "Bipartisan Feasible Path"
        case escalationPath = "Escalation Path"
        case noGenericOptions = "No Generic Options"
        case other = "Other (Type Your Own)"

        var id: String { rawValue }

        var strategyInstruction: String {
            switch self {
            case .strongestFirstStep:
                return "Prioritize the highest-impact concrete action, not safest wording."
            case .legislativePush:
                return "Prefer vote, cosponsor, and statutory actions over hearing or letter defaults."
            case .fundingLeverage:
                return "Prioritize appropriations, funding increases or cuts, and funding restrictions."
            case .oversightWithDeadlines:
                return "Require reporting deadlines, public updates, and enforcement checkpoints."
            case .positionOnRecord:
                return "Ask for a clear public position from the member or office."
            case .billLinkedOnlyIfReal:
                return "Include an explicit bill only when confidence is high and the bill is verifiable."
            case .districtFirstImpact:
                return "Frame asks around district harms and measurable local outcomes."
            case .bipartisanFeasiblePath:
                return "Pick the most passable near-term action while staying specific."
            case .escalationPath:
                return "Provide a sequenced plan: first action now, backup if no response."
            case .noGenericOptions:
                return "Block generic asks like support this issue and require distinct action families."
            case .other:
                return ""
            }
        }
    }

    private struct AssistantRefinementSnapshot: Codable {
        let rawUserInput: String
        let normalizedIssue: String
        let briefBackground: String
        let commonInterpretations: [String]
        let clarifyingQuestions: [String]
        let recommendedPrompt: String
        let mapcSections: [String: String]
        let confidence: String
        let groundingType: String

        enum CodingKeys: String, CodingKey {
            case rawUserInput = "raw_user_input"
            case normalizedIssue = "normalized_issue"
            case briefBackground = "brief_background"
            case commonInterpretations = "common_interpretations"
            case clarifyingQuestions = "clarifying_questions"
            case recommendedPrompt = "recommended_prompt"
            case mapcSections = "mapc_sections"
            case confidence
            case groundingType = "grounding_type"
        }
    }

    private struct AssistantChatMessage: Identifiable {
        enum Role {
            case user
            case assistant
        }

        enum MessageKind {
            case plain
            case structured
            case script
        }

        let id: UUID
        let role: Role
        let text: String
        let kind: MessageKind

        static func user(_ text: String) -> AssistantChatMessage {
            AssistantChatMessage(id: UUID(), role: .user, text: text, kind: .plain)
        }

        static func assistant(_ text: String, kind: MessageKind = .plain) -> AssistantChatMessage {
            AssistantChatMessage(id: UUID(), role: .assistant, text: text, kind: kind)
        }
    }

    private struct MAPCIssueGainState: Sendable {
        let baseline: Int
        var gain: Int
    }

    private var mapcCardTransition: AnyTransition {
        // Keep MAPC card changes visually stable to avoid geometry edge cases
        // observed on some devices/simulator sessions.
        .identity
    }

    private var mapcCardAnimation: Animation {
        reduceMotion
        ? .easeInOut(duration: 0.3)
        : .interactiveSpring(response: 0.52, dampingFraction: 0.9, blendDuration: 0.22)
    }

    private var nonMapcTabTransition: AnyTransition {
        let travelDistance = UIScreen.main.bounds.width * 0.32
        let insertionX = nonMapcTabSlidesForward ? travelDistance : -travelDistance
        let removalX = nonMapcTabSlidesForward ? -travelDistance : travelDistance
        return .asymmetric(
            insertion: .offset(x: insertionX).combined(with: .opacity),
            removal: .offset(x: removalX).combined(with: .opacity)
        )
    }

    init(
        federalReps: [Official],
        userZip: String,
        userAddressLine: String = "",
        residencyNotice: String = "",
        initialTab: CivicIssueCallTab = .assistant,
        showsReturnHomeButton: Bool = true,
        hidesTabBar: Bool = true
    ) {
        _viewModel = StateObject(wrappedValue: IssueCallCenterViewModel(federalReps: federalReps, userZip: userZip))
        self.userAddressLine = userAddressLine
        self.residencyNotice = residencyNotice
        self.initialTab = initialTab
        self.showsReturnHomeButton = showsReturnHomeButton
        self.hidesTabBar = hidesTabBar
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private var selectableAsks: [CivicAsk] {
        [
            .support,
            .oppose,
            .voteYes,
            .voteNo,
            .seekOversight,
            .askPublicStatement
        ]
    }

    private var progressLabels: [String] {
        let officeTypeBySlot = Dictionary(uniqueKeysWithValues: viewModel.repTargets.map { ($0.slot, $0.officeType) })
        let slots: [CivicRepSlot] = !viewModel.callBriefs.isEmpty
            ? viewModel.callBriefs.compactMap(\.repSlot)
            : viewModel.repTargets.map(\.slot)

        return slots.map { slot in
            switch slot {
            case .house:
                return "House Rep"
            case .senate1, .senate2:
                if let officeType = officeTypeBySlot[slot],
                   let senateClass = senateClassLabel(from: officeType) {
                    return "Senator \(senateClass)"
                }
                return "Senator"
            }
        }
    }

    private func senateClassLabel(from officeType: String) -> String? {
        let normalized = officeType
            .uppercased()
            .replacingOccurrences(of: "CLASS", with: " ")
        let tokens = normalized.components(separatedBy: CharacterSet.alphanumerics.inverted)
        if tokens.contains("III") || tokens.contains("3") { return "III" }
        if tokens.contains("II") || tokens.contains("2") { return "II" }
        if tokens.contains("I") || tokens.contains("1") { return "I" }
        return nil
    }

    private var activeProgressIndex: Int {
        viewModel.activeBriefIndex ?? 0
    }

    private var isMAPCMode: Bool {
        !didCompleteMAPC
            && !viewModel.requiresDraftApproval
            && !viewModel.callBriefs.isEmpty
            && viewModel.activeBrief != nil
    }

    private var visibleTabs: [CivicIssueCallTab] {
        [.assistant, .examples, .civicScore]
    }

    private var shouldHideTopTabSelector: Bool {
        focusedField != nil || isKeyboardVisible
    }

    private static let allExamplesFilterLabel = "All"
    private static let urgentExamplesFilterLabel = "Urgent"
    private static let searchExamplesFilterLabel = "Search issues"
    private static let moreExamplesFilterToken = "__more_examples_filter__"
    private static let premadeCollapsedCardLimit = 3
    private static let premadeCollapsedCategoryRowLimit = 3
    private static let mapcScriptCardBackground = VoteNowColors.brandSoftBlue.opacity(0.55)

    private var exampleCategoryOptions: [String] {
        var seen = Set<String>()
        var categories: [String] = []

        for card in viewModel.examples {
            let category = (card.category ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !category.isEmpty else { continue }
            if category.caseInsensitiveCompare(Self.allExamplesFilterLabel) == .orderedSame { continue }
            if category.caseInsensitiveCompare(Self.urgentExamplesFilterLabel) == .orderedSame { continue }
            if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame { continue }
            if seen.insert(category).inserted {
                categories.append(category)
            }
        }

        return [Self.urgentExamplesFilterLabel, Self.searchExamplesFilterLabel] + categories
    }

    private var filteredExamples: [CivicExampleIssueCard] {
        let baseExamples: [CivicExampleIssueCard]
        if selectedExampleCategory.caseInsensitiveCompare(Self.allExamplesFilterLabel) == .orderedSame {
            baseExamples = viewModel.examples
        } else if selectedExampleCategory.caseInsensitiveCompare(Self.urgentExamplesFilterLabel) == .orderedSame {
            baseExamples = viewModel.examples.filter(isUrgentExample)
        } else if selectedExampleCategory.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            baseExamples = viewModel.examples
        } else {
            baseExamples = viewModel.examples.filter { card in
                let category = (card.category ?? "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)
                return category.caseInsensitiveCompare(selectedExampleCategory) == .orderedSame
            }
        }

        if selectedExampleCategory.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            let query = exampleSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !query.isEmpty else { return baseExamples }
            return baseExamples.filter { example in
                premadeExampleMatchesSearch(example, query: query)
            }
        }
        return baseExamples
    }

    private var visiblePremadeExamples: [CivicExampleIssueCard] {
        filteredExamples
    }

    private var hasHiddenPremadeExamples: Bool {
        false
    }

    private var collapsedExampleCategoryOptions: [String] {
        var collapsed = fittedCategoryOptionsForCollapsedRows(
            from: exampleCategoryOptions,
            maxRows: Self.premadeCollapsedCategoryRowLimit
        )
        if !containsCategory(collapsed, selectedExampleCategory),
           let selected = exampleCategoryOptions.first(where: { $0.caseInsensitiveCompare(selectedExampleCategory) == .orderedSame }) {
            if !collapsed.isEmpty {
                collapsed.removeLast()
            }
            collapsed.append(selected)
        }
        return collapsed
    }

    private var hasHiddenExampleCategoryOptions: Bool {
        collapsedExampleCategoryOptions.count < exampleCategoryOptions.count
    }

    private var visibleExampleCategoryOptions: [String] {
        exampleCategoryOptions
    }

    private var exampleCategoryGridRows: [GridItem] {
        Array(
            repeating: GridItem(.fixed(32), spacing: 8, alignment: .top),
            count: Self.premadeCollapsedCategoryRowLimit
        )
    }

    private var exampleCategoryRailHeight: CGFloat {
        let rowCount = Self.premadeCollapsedCategoryRowLimit
        let chipHeight: CGFloat = 32
        let rowSpacing: CGFloat = 8
        return CGFloat(rowCount) * chipHeight + CGFloat(max(0, rowCount - 1)) * rowSpacing + 4
    }

    private func fittedCategoryOptionsForCollapsedRows(from options: [String], maxRows: Int) -> [String] {
        guard maxRows > 0 else { return [] }
        let horizontalPadding: CGFloat = 16
        let availableWidth = max(220, UIScreen.main.bounds.width - (horizontalPadding * 2))
        let chipSpacing: CGFloat = 8
        var rowsUsed = 1
        var currentRowWidth: CGFloat = 0
        var visible: [String] = []

        for category in options {
            let chipWidth = estimatedCategoryChipWidth(for: category)
            let proposedWidth = currentRowWidth == 0 ? chipWidth : currentRowWidth + chipSpacing + chipWidth
            if proposedWidth <= availableWidth {
                visible.append(category)
                currentRowWidth = proposedWidth
                continue
            }

            guard rowsUsed < maxRows else { break }
            rowsUsed += 1
            visible.append(category)
            currentRowWidth = chipWidth
        }

        return visible
    }

    private func estimatedCategoryChipWidth(for category: String) -> CGFloat {
        let label = exampleCategoryDisplayName(for: category)
        let iconAllowance: CGFloat = category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame ? 16 : 0
        let characterWidthEstimate: CGFloat = 7.3
        let textWidth = CGFloat(label.count) * characterWidthEstimate
        return max(72, min(210, textWidth + 24 + iconAllowance))
    }

    private func containsCategory(_ list: [String], _ candidate: String) -> Bool {
        list.contains { $0.caseInsensitiveCompare(candidate) == .orderedSame }
    }

    private var exampleCategoryColorMap: [String: Color] {
        let palette: [Color] = [
            Color(hex: "#1E40AF"),
            Color(hex: "#6D28D9"),
            Color(hex: "#0F766E"),
            Color(hex: "#B45309"),
            Color(hex: "#BE123C"),
            Color(hex: "#0369A1"),
            Color(hex: "#15803D"),
            Color(hex: "#4338CA"),
            Color(hex: "#9D174D"),
            Color(hex: "#374151"),
            Color(hex: "#7C2D12"),
            Color(hex: "#14532D"),
            Color(hex: "#334155"),
            Color(hex: "#4C1D95"),
            Color(hex: "#7F1D1D"),
            Color(hex: "#0C4A6E")
        ]

        var map: [String: Color] = [
            Self.allExamplesFilterLabel.lowercased(): VoteNowColors.primaryCTA,
            Self.urgentExamplesFilterLabel.lowercased(): VoteNowColors.urgentCTA,
            Self.searchExamplesFilterLabel.lowercased(): Color(hex: "#0F766E")
        ]
        let categories = exampleCategoryOptions.filter {
            $0.caseInsensitiveCompare(Self.allExamplesFilterLabel) != .orderedSame &&
            $0.caseInsensitiveCompare(Self.urgentExamplesFilterLabel) != .orderedSame &&
            $0.caseInsensitiveCompare(Self.searchExamplesFilterLabel) != .orderedSame
        }
        for (index, category) in categories.enumerated() {
            let key = category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            map[key] = palette[index % palette.count]
        }
        return map
    }

    var body: some View {
        ZStack {
            VStack(spacing: 12) {
                ZStack {
                    if isMAPCMode {
                        VStack(spacing: 12) {
                            mapcAddressSection
                            repProgressRow
                            scriptFocusModeContent
                        }
                    } else {
                        VStack(spacing: 6) {
                            headerSection
                            topTabSelector
                                .offset(y: shouldHideTopTabSelector ? -16 : 0)
                                .opacity(shouldHideTopTabSelector ? 0 : 1)
                                .frame(height: shouldHideTopTabSelector ? 0 : nil, alignment: .top)
                                .clipped()
                                .allowsHitTesting(!shouldHideTopTabSelector)
                                .accessibilityHidden(shouldHideTopTabSelector)
                                .animation(
                                    .interactiveSpring(response: 0.26, dampingFraction: 0.9, blendDuration: 0.12),
                                    value: shouldHideTopTabSelector
                                )
                            ZStack {
                                nonMapcTabContent(for: viewModel.selectedTab)
                                    .id(viewModel.selectedTab)
                                    .transition(nonMapcTabTransition)
                            }
                                .animation(.easeInOut(duration: 0.26), value: viewModel.selectedTab)
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        }
                    }
                }
            }
            .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())

            EmojiWaterfallView(controller: waterfallController)
                .ignoresSafeArea()
                .zIndex(11)
                .allowsHitTesting(false)

        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .modifier(IssueCallCenterTabBarVisibilityModifier(hidden: hidesTabBar || isMAPCMode))
        .task {
            await viewModel.loadExamplesAndHistoryIfNeeded()
        }
        .alert(l("app.issue_call.alert.error", "Issue Call"), isPresented: Binding(
            get: { viewModel.errorMessage != nil },
            set: { newValue in
                if !newValue { viewModel.errorMessage = nil }
            }
        )) {
            Button(l("app.issue_call.alert.ok", "OK"), role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .sheet(isPresented: $showingShareSheet, onDismiss: {
            shareItems.removeAll()
        }) {
            if !shareItems.isEmpty {
                ShareSheet(items: shareItems)
            }
        }
        .onTapGesture {
            focusedField = nil
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
            withAnimation(.easeInOut(duration: 0.18)) {
                isKeyboardVisible = true
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            withAnimation(.easeInOut(duration: 0.18)) {
                isKeyboardVisible = false
            }
        }
        .onAppear {
            if !isMAPCMode {
                viewModel.selectedTab = initialTab
            }
            previousNonMapcTab = viewModel.selectedTab
            if let activeID = viewModel.activeBriefID {
                synchronizeScriptAccordionState(for: activeID)
            }
        }
        .onDisappear {
            mapcTransitionResetTask?.cancel()
            isMAPCCardTransitioning = false
            viewModel.persistDraftState()
        }
        .onChange(of: viewModel.selectedTab) { oldTab, newTab in
            nonMapcTabSlidesForward = tabIndex(for: newTab) >= tabIndex(for: oldTab)
            previousNonMapcTab = newTab
            viewModel.persistDraftState()
            if newTab == .civicScore {
                Task {
                    await viewModel.refreshCallScoreData()
                }
            }
        }
        .onChange(of: viewModel.issueTitle) { _, _ in
            isTalkingPointsExpanded = false
        }
        .onChange(of: viewModel.activeBriefID) { _, newID in
            if let newID {
                synchronizeScriptAccordionState(for: newID)
            }
            guard didCompleteMAPC else { return }
            guard viewModel.selectedTab == .assistant else { return }
            guard newID != nil else { return }
            didCompleteMAPC = false
        }
        .onChange(of: viewModel.requiresDraftApproval) { _, requiresApproval in
            guard requiresApproval else { return }
            didCompleteMAPC = false
            if viewModel.selectedTab != .assistant {
                // Avoid mutating another @Published property during the same
                // render pass that observed `requiresDraftApproval`.
                DispatchQueue.main.async {
                    if viewModel.requiresDraftApproval {
                        viewModel.selectedTab = .assistant
                    }
                }
            }
        }
        .onChange(of: scenePhase) { _, newValue in
            guard newValue == .active else { return }
            guard callScoreV1Enabled else { return }
            guard let pending = viewModel.pendingCallLaunch else { return }
            guard viewModel.shouldPromptForPendingCallCompletion() else { return }
            guard lastPromptedLaunchEventID != pending.launchEventID else { return }
            lastPromptedLaunchEventID = pending.launchEventID
            Task {
                await viewModel.confirmPendingCallCompletion(completed: true)
            }
        }
        .onChange(of: viewModel.pendingCallLaunch?.launchEventID) { _, newValue in
            if newValue == nil {
                lastPromptedLaunchEventID = nil
            }
        }
        .onChange(of: viewModel.examples.count) { _, _ in
            if !exampleCategoryOptions.contains(selectedExampleCategory) {
                selectedExampleCategory = Self.allExamplesFilterLabel
            }
            showAllPremadeExamples = false
            showAllExampleCategoryChips = false
        }
        .onChange(of: selectedExampleCategory) { _, _ in
            showAllPremadeExamples = false
        }
        .onChange(of: exampleSearchQuery) { _, _ in
            showAllPremadeExamples = false
        }
        .onChange(of: viewModel.callBriefs.map(\.id)) { _, ids in
            let signature = ids.joined(separator: "|")
            if signature != mapcBriefsSignature {
                mapcBriefsSignature = signature
                mapcSessionLoggedBriefIDs.removeAll()
                mapcOptimisticIssueGains.removeAll()
            }
        }
        .onChange(of: viewModel.callStats.totalVoteNowCalls) { _, newValue in
            if let animated = animatedTotalVoteNowCalls, newValue >= animated {
                animatedTotalVoteNowCalls = nil
            }
        }
        .onChange(of: viewModel.callStats.userCallCount) { _, newValue in
            if let animated = animatedUserCallCount, newValue >= animated {
                animatedUserCallCount = nil
            }
        }
        .onChange(of: viewModel.appWideCompletedCallsByIssueID) { _, _ in
            pruneResolvedOptimisticIssueGains()
        }
    }

    private var mapcAddressSection: some View {
        Group {
            if !userAddressLine.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(userAddressLine)
                            .font(.title3.weight(.semibold))
                            .foregroundColor(VoteNowColors.mutedText)
                            .lineLimit(2)
                            .frame(maxWidth: .infinity, alignment: .leading)

                        if let activeBrief = viewModel.activeBrief,
                           !activeBrief.talkingPoints.isEmpty {
                            HStack(spacing: 8) {
                                scriptInputsToggleButton
                                shareActionButton
                            }
                        } else {
                            shareActionButton
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16)
                .padding(.top, 10)
            } else {
                HStack {
                    Spacer(minLength: 0)
                    shareActionButton
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 0) {
            ZStack(alignment: .topTrailing) {
                PageHeader(title: Text(l("app.issue_call.title", "Call Your Reps")))

                HStack(spacing: 8) {
                    shareActionButton

                    if showsReturnHomeButton {
                        Button {
                            dismiss()
                        } label: {
                            Text(l("app.issue_call.action.return_home", "Home"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(minWidth: 58, minHeight: 32, alignment: .center)
                                .padding(.horizontal, 8)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("issue_call.return_home")
                    }
                }
                .padding(.top, 4)
            }

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if !userAddressLine.isEmpty {
                    Text(userAddressLine)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .lineLimit(1)
                        .minimumScaleFactor(0.84)
                        .truncationMode(.tail)
                }

                Spacer(minLength: 8)

                if !userAddressLine.isEmpty {
                    Button {
                        openMyInfoPanel()
                    } label: {
                        Text(l("app.reps.action.edit_location", "Edit Location"))
                            .font(.callout.weight(.semibold))
                            .italic()
                            .foregroundColor(VoteNowColors.primaryCTA)
                            .lineLimit(1)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.leading, 72)
            .padding(.top, -6)

            if !residencyNotice.isEmpty {
                residencyNoticeView
                    .padding(.top, 8)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 2)
        .padding(.bottom, 2)
        .background(VoteNowColors.brandSoftBlue)
    }

    private var residencyNoticeView: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.caption.weight(.bold))
                .foregroundColor(Color(hex: "#9A6500"))
                .padding(.top, 1)
            Button {
                openMyInfoPanel()
            } label: {
                (
                    Text("\(residencyNotice) ")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(Color(hex: "#6E4A00"))
                    + Text(l("app.issue_call.location.change_address", "Change to your Address..."))
                        .font(.caption.weight(.bold))
                        .italic()
                        .foregroundColor(VoteNowColors.primaryCTA)
                )
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .buttonStyle(.plain)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(Color(hex: "#FFF3D6"))
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(Color(hex: "#F2D38B"), lineWidth: 1)
        )
    }

    private func openMyInfoPanel() {
        NotificationCenter.default.post(name: .openMyInfoPanel, object: nil)
    }

    private var repProgressRow: some View {
        HStack(spacing: 8) {
            ForEach(Array(progressLabels.enumerated()), id: \.offset) { index, label in
                let isComplete = index < activeProgressIndex
                let isCurrent = index == activeProgressIndex
                let isLastStep = index == max(0, progressLabels.count - 1)

                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor((isComplete || isCurrent) ? .white : VoteNowColors.primaryText)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(
                        isComplete
                        ? VoteNowColors.warningAmber
                        : (isCurrent
                           ? (isLastStep ? VoteNowColors.successGreen : VoteNowColors.primaryCTA)
                           : VoteNowColors.surfaceWhite)
                    )
                    .clipShape(Capsule())
                    .overlay(
                        Capsule()
                            .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                    )

                if index < progressLabels.count - 1 {
                    Image(systemName: "chevron.right")
                        .font(.footnote.weight(.bold))
                        .foregroundColor(VoteNowColors.mutedText)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.horizontal, 16)
    }

    private var topTabSelector: some View {
        HStack(spacing: 0) {
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                ForEach(visibleTabs, id: \.self) { tab in
                    issueCallTopTabButton(tab)
                }
            }
            .frame(maxWidth: .infinity, alignment: .center)
            .padding(.horizontal, 2)
            .padding(.vertical, 2)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 5)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryCTA.opacity(0.22), lineWidth: 2)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.06), radius: 6, x: 0, y: 2)
        .padding(.horizontal, 16)
        .padding(.top, 0)
        .padding(.bottom, 4)
        .background(VoteNowColors.brandSoftBlue)
        .accessibilityIdentifier("issue_call.tabs")
    }

    private func issueCallTopTabButton(_ tab: CivicIssueCallTab) -> some View {
        let isActive = viewModel.selectedTab == tab
        return Button {
            let currentTab = viewModel.selectedTab
            nonMapcTabSlidesForward = tabIndex(for: tab) >= tabIndex(for: currentTab)
            previousNonMapcTab = currentTab
            withAnimation(.interactiveSpring(response: 0.24, dampingFraction: 0.92, blendDuration: 0.16)) {
                viewModel.selectedTab = tab
            }
        } label: {
            Text(tabNavigationTitle(for: tab))
                .font(.caption.weight(isActive ? .bold : .semibold))
                .foregroundColor(isActive ? .white : VoteNowColors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.68)
                .allowsTightening(true)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity, minHeight: 30, alignment: .center)
                .padding(.horizontal, 6)
                .padding(.vertical, 2)
                .background(
                    ZStack {
                        if isActive {
                            Capsule(style: .continuous)
                                .fill(issueCallTopTabHighlightColor(for: tab))
                                .matchedGeometryEffect(id: "issue_call_top_tab_highlight", in: topTabSelectionNamespace)
                        }
                    }
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("issue_call.tabs.\(tab.rawValue)")
    }

    @ViewBuilder
    private func nonMapcTabContent(for tab: CivicIssueCallTab) -> some View {
        switch tab {
        case .assistant:
            assistantTab
        case .examples:
            examplesTab
        case .civicScore:
            civicScoreTab
        case .history:
            rulesTab
        }
    }

    private func tabIndex(for tab: CivicIssueCallTab) -> Int {
        switch tab {
        case .assistant:
            return 0
        case .examples:
            return 1
        case .civicScore:
            return 2
        case .history:
            return 3
        }
    }

    private func issueCallTopTabHighlightColor(for tab: CivicIssueCallTab) -> Color {
        switch tab {
        case .assistant:
            return VoteNowColors.primaryCTA
        case .examples:
            return VoteNowColors.warningAmber
        case .civicScore:
            return VoteNowColors.successGreen
        case .history:
            return VoteNowColors.primaryCTA
        }
    }

    private func tabNavigationTitle(for tab: CivicIssueCallTab) -> String {
        switch tab {
        case .assistant:
            return "Write a Call"
        case .examples:
            return "Browse Issues"
        case .history:
            return "How calling works"
        case .civicScore:
            return "History"
        }
    }

    private var scriptFocusModeContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if viewModel.lastCompletionResult != nil {
                    completionFeedbackCard
                }

                issueSummaryCard

                if let brief = viewModel.activeBrief {
                    ZStack {
                        repBriefCard(brief, condensedForMAPC: true)
                            .id("mapc-card-\(brief.id)")
                            .compositingGroup()
                            .transition(mapcCardTransition)
                    }
                    .clipped()
                    .animation(mapcCardAnimation, value: viewModel.activeBriefID)
                } else {
                    Text(l("app.issue_call.empty.filtered", "No briefs match this representative filter."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                }
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 18)
        }
        .scrollDismissesKeyboard(.interactively)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    }

    private var assistantTab: some View {
        VStack(spacing: 0) {
            assistantChatBody
            assistantChatComposer
        }
        .background(VoteNowColors.brandSoftBlue)
        .onAppear {
            seedAssistantChatIfNeeded()
            if assistantComposerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                assistantComposerText = viewModel.concernText
            }
        }
    }

    private var assistantChatBody: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if viewModel.lastCompletionResult != nil {
                        completionFeedbackCard
                    }

                    ForEach(assistantMessages) { message in
                        assistantMessageRow(message)
                            .id(message.id)
                    }

                    if assistantIsThinking {
                        HStack(spacing: 8) {
                            AssistantThinkingLogoView()
                            Text("Building background + script preview…")
                                .font(.footnote)
                                .foregroundColor(VoteNowColors.mutedText)
                        }
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                        )
                        .id("assistant-typing")
                    }

                    if assistantFlowStage == .awaitingBackgroundApproval && isBackgroundMessageReadyForActions {
                        assistantBackgroundActions
                            .id("assistant-background-actions")
                    } else if assistantFlowStage == .awaitingPreviewConfirmation
                        && isScriptPreviewReadyForMAPCActions
                        && pendingBackgroundMessageID == nil {
                        assistantPreviewActions
                            .id("assistant-preview-actions")
                    } else if assistantFlowStage == .awaitingMapcStart
                        && isScriptPreviewReadyForMAPCActions
                        && pendingBackgroundMessageID == nil {
                        assistantStartMAPCActions
                            .id("assistant-mapc-actions")
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: assistantMessages.count) { _, _ in
                guard let lastID = assistantMessages.last?.id else { return }
                withAnimation(.easeOut(duration: 0.18)) {
                    proxy.scrollTo(lastID, anchor: .bottom)
                }
            }
            .onChange(of: assistantIsThinking) { _, thinking in
                guard thinking else { return }
                withAnimation(.easeOut(duration: 0.18)) {
                    proxy.scrollTo("assistant-typing", anchor: .bottom)
                }
            }
            .onChange(of: assistantFlowStage) { _, stage in
                let anchorID: String
                switch stage {
                case .awaitingBackgroundApproval:
                    anchorID = "assistant-background-actions"
                case .awaitingPreviewConfirmation:
                    anchorID = "assistant-preview-actions"
                case .awaitingMapcStart:
                    anchorID = "assistant-mapc-actions"
                case .awaitingPrompt:
                    return
                }
                withAnimation(.easeOut(duration: 0.18)) {
                    proxy.scrollTo(anchorID, anchor: .bottom)
                }
            }
        }
    }

    @ViewBuilder
    private func assistantMessageRow(_ message: AssistantChatMessage) -> some View {
        let isUser = message.role == .user

        HStack {
            if isUser { Spacer(minLength: 28) }
            VStack(alignment: .leading, spacing: 6) {
                if message.kind == .structured {
                    Text("Issue Snapshot")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                } else if message.kind == .script {
                    Text("Script Preview")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                }

                if isUser {
                    Text(message.text)
                        .font(message.kind == .structured ? .system(.footnote, design: .monospaced) : .body)
                        .foregroundColor(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .textSelection(.enabled)
                } else {
                    AssistantTypewriterText(
                        text: message.text,
                        animate: !reduceMotion && !animatedAssistantMessageIDs.contains(message.id),
                        onFinished: {
                            animatedAssistantMessageIDs.insert(message.id)
                            if pendingBackgroundMessageID == message.id {
                                pendingBackgroundMessageID = nil
                                withAnimation(.easeOut(duration: 0.18)) {
                                    isBackgroundMessageReadyForActions = true
                                }
                            }
                            if pendingScriptPreviewMessageID == message.id {
                                pendingScriptPreviewMessageID = nil
                                withAnimation(.easeOut(duration: 0.18)) {
                                    isScriptPreviewReadyForMAPCActions = true
                                }
                            }
                        }
                    )
                    .font(message.kind == .structured ? .system(.footnote, design: .monospaced) : .body)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
                    .textSelection(.enabled)
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(isUser ? VoteNowColors.primaryCTA : VoteNowColors.surfaceWhite)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .stroke(isUser ? .clear : VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
            )
            .frame(maxWidth: .infinity, alignment: isUser ? .trailing : .leading)
            if !isUser { Spacer(minLength: 28) }
        }
    }

    private var assistantChatComposer: some View {
        HStack(spacing: 8) {
            TextField(
                "Describe the issue...",
                text: $assistantComposerText,
                axis: .vertical
            )
            .lineLimit(1...5)
            .textInputAutocapitalization(.sentences)
            .focused($focusedField, equals: .concern)
            .submitLabel(.send)
            .onSubmit {
                submitScriptDraft()
            }
            .disabled(assistantIsThinking || viewModel.isSubmitting)

            Button {
                submitScriptDraft()
            } label: {
                Image(systemName: "paperplane.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Circle())
            }
            .buttonStyle(.plain)
            .disabled(assistantComposerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || assistantIsThinking || viewModel.isSubmitting)
            .opacity((assistantComposerText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || assistantIsThinking || viewModel.isSubmitting) ? 0.45 : 1.0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(
            Capsule(style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            Capsule(style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
        )
        .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 5, x: 0, y: 2)
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
    }

    private var assistantBackgroundActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            if viewModel.mapcPipelineV3Enabled {
                // mapc_pipeline_v3 — remove flag check after rollout confirmed
                Text("I read this as: \(viewModel.mapcV3DisplayIssue)")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                Text("Pick the first action you want the office to take.")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)

                LazyVGrid(columns: [GridItem(.adaptive(minimum: 165), spacing: 8)], spacing: 8) {
                    ForEach(viewModel.mapcV3AskOptions) { option in
                        Button {
                            selectMAPCV3OptionInChat(option)
                        } label: {
                            Text(option.displayAsk)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(VoteNowColors.primaryText)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 9)
                                .background(VoteNowColors.surfaceWhite)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                                        .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                                )
                        }
                        .buttonStyle(.plain)
                    }
                }
            } else {
                Text("Does this match what you meant?")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                if !hasPickedDiscussionOptionInCurrentCycle && !discussionOptionsForCurrentBackground.isEmpty {
                    Text("Pick a direction and I’ll execute it in the script:")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 165), spacing: 8)], spacing: 8) {
                        ForEach(discussionOptionsForCurrentBackground, id: \.self) { option in
                            Button {
                                selectDiscussionOptionInChat(option)
                            } label: {
                                Text(option)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .multilineTextAlignment(.leading)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 9)
                                    .background(VoteNowColors.surfaceWhite)
                                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                                            .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }

                HStack(spacing: 8) {
                    Button {
                        reviseGeneratedDraftInChat()
                    } label: {
                        Text("Revise")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(VoteNowColors.surfaceWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button {
                        approveBackgroundInChat()
                    } label: {
                        Text("Use This")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
        )
    }

    private var assistantPreviewActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            if previewLintBlocked {
                Text("I hit a snag, but I still have your issue.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                Text("Pick a fix or restate the action you want.")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)

                Button {
                    fixMAPCV3PreviewInChat()
                } label: {
                    Text("Fix this")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            } else {
                Text("Review the draft preview below.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                Text("Looks right moves to final approval. Fix this keeps this ask and lets you adjust details.")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)

                HStack(spacing: 8) {
                    Button {
                        fixMAPCV3PreviewInChat()
                    } label: {
                        Text("Fix this")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(VoteNowColors.surfaceWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)

                    Button {
                        confirmMAPCV3PreviewInChat()
                    } label: {
                        Text("Looks right")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
        )
    }

    private var assistantStartMAPCActions: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Your call guide is ready. Approve and call, or fix the wording first.")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            Text("Pick how agentic the ask options should be:")
                .font(.caption.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)

            LazyVGrid(columns: [GridItem(.adaptive(minimum: 145), spacing: 8)], spacing: 8) {
                ForEach(MAPCAgenticStrategyChip.allCases) { chip in
                    Button {
                        applyMAPCAgenticStrategyChip(chip)
                    } label: {
                        Text(chip.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .multilineTextAlignment(.leading)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 9)
                            .background(VoteNowColors.surfaceWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            HStack(spacing: 8) {
                Button {
                    startMAPCFromChat()
                } label: {
                    Text("Approve and call")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.primaryCTA)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite.opacity(0.6))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
        )
    }

    private var concernComposerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.issue_call.concern.header", "Build your Script"))
                .font(.headline)

            TextField(
                "",
                text: $viewModel.concernText,
                prompt: Text(l(
                    "app.issue_call.concern.subheader",
                    "Tell us what issue you want your elected representatives to act on and we’ll generate a script."
                )),
                axis: .vertical
            )
            .lineLimit(3...7)
            .textInputAutocapitalization(.sentences)
            .focused($focusedField, equals: .concern)
            .submitLabel(.send)
            .onSubmit {
                submitScriptDraft()
            }
            .frame(minHeight: 90, alignment: .topLeading)
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .accessibilityIdentifier("issue_call.concern_input")
            .background(VoteNowColors.surfaceWhite)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
            )

            if !viewModel.mapcPipelineV3Enabled {
                // mapc_pipeline_v3 — remove flag check after rollout confirmed
                VStack(alignment: .leading, spacing: 8) {
                    Text(l("app.issue_call.ask.header", "Choose your explicit ask"))
                        .font(.subheadline.weight(.semibold))

                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 138), spacing: 8)], spacing: 8) {
                        ForEach(selectableAsks) { ask in
                            Button {
                                viewModel.selectedAsk = ask
                            } label: {
                                Text(ask.title)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(viewModel.selectedAsk == ask ? .white : VoteNowColors.primaryText)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 8)
                                    .frame(maxWidth: .infinity)
                                    .background(viewModel.selectedAsk == ask ? VoteNowColors.primaryCTA : VoteNowColors.surfaceWhite)
                                    .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 9, style: .continuous)
                                            .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                                    )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("issue_call.ask.\(ask.rawValue)")
                        }
                    }
                }
            }

            TextField(
                "",
                text: $viewModel.optionalBillRef,
                prompt: Text(l("app.issue_call.bill.placeholder", "Optional bill reference (e.g., H.R.1234)"))
            )
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .focused($focusedField, equals: .billRef)
            .submitLabel(.send)
            .onSubmit {
                submitScriptDraft()
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .background(VoteNowColors.surfaceWhite)
            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
            )
            .accessibilityIdentifier("issue_call.bill_input")

            Button {
                submitScriptDraft()
            } label: {
                HStack {
                    if viewModel.isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(l("app.issue_call.action.generate", "Create Call Script"))
                        .font(.headline)
                }
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(viewModel.canSubmit ? VoteNowColors.primaryCTA : VoteNowColors.mutedText.opacity(0.45))
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.canSubmit || viewModel.isSubmitting)
            .accessibilityIdentifier("issue_call.generate")
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
    }

    private func submitScriptDraft(fromDiscussionOption: Bool = false) {
        let prompt = assistantComposerText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !prompt.isEmpty else { return }
        guard !viewModel.isSubmitting, !assistantIsThinking else { return }
        suppressTranslationForNextBackground = fromDiscussionOption

        let priorConcern = viewModel.concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        let pipelinePrompt: String
        var intent = classifyMAPCTurnIntent(prompt)
        if awaitingCustomAgenticStrategyInput && viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            // "Other" strategy text should be handled as a constraints revision, not a new issue.
            pipelinePrompt = "strategy preference: \(prompt)"
            intent = MAPCTurnIntentClassification(intent: .reviseToneOrConstraints, newIssueScore: 0.1)
            awaitingCustomAgenticStrategyInput = false
        } else {
            pipelinePrompt = prompt
        }
        let hasActiveMAPCV3Session = viewModel.mapcPipelineV3Enabled
            && (isActiveMAPCRefinementStage
                || viewModel.shouldContinueMAPCV3Clarification
                || viewModel.mapcV3SessionState != "new")

        if hasActiveMAPCV3Session && intent.intent == .startOver {
            appendAssistantUserMessage(prompt, messageType: "mapc_turn_\(intent.intent.rawValue)")
            assistantComposerText = ""
            startOverMAPCV3SessionInChat()
            return
        }

        let shouldTreatAsMAPCRevision = viewModel.mapcPipelineV3Enabled
            && hasActiveMAPCV3Session
            && intent.intent != .startOver
            && intent.newIssueScore < 0.85
        let wasLegacyRefinementStage = !viewModel.mapcPipelineV3Enabled
            && (assistantFlowStage == .awaitingBackgroundApproval || assistantFlowStage == .awaitingMapcStart)

        let combinedPrompt: String
        if shouldTreatAsMAPCRevision {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            combinedPrompt = rewrittenMAPCV3RevisionPrompt(
                from: pipelinePrompt,
                priorConcern: priorConcern,
                intent: intent
            )
        } else if wasLegacyRefinementStage, !priorConcern.isEmpty {
            combinedPrompt = mergedConcernText(base: priorConcern, refinement: pipelinePrompt)
        } else {
            combinedPrompt = pipelinePrompt
            hasPickedDiscussionOptionInCurrentCycle = false
        }

        if viewModel.selectedAsk == nil {
            viewModel.selectedAsk = inferredAsk(from: combinedPrompt) ?? .support
        }
        if viewModel.optionalBillRef.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
           let extractedBill = extractedBillReference(from: combinedPrompt) {
            viewModel.optionalBillRef = extractedBill
        }
        viewModel.concernText = combinedPrompt

        guard viewModel.canSubmit else { return }

        let messageType = viewModel.mapcPipelineV3Enabled
            ? "mapc_turn_\(intent.intent.rawValue)"
            : "user_prompt"
        appendAssistantUserMessage(prompt, messageType: messageType)
        assistantComposerText = ""
        hasPostedCurrentDraftBackground = false
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        pendingScriptPreviewMessageID = nil
        isScriptPreviewReadyForMAPCActions = false
        currentBackgroundDiscussionOptions = []
        assistantFlowStage = .awaitingPrompt
        assistantIsThinking = true
        focusedField = nil
        isTalkingPointsExpanded = false
        didCompleteMAPC = false
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            if viewModel.shouldContinueMAPCV3Clarification {
                viewModel.prepareForMAPCV3ClarificationFollowUp()
            } else if shouldTreatAsMAPCRevision {
                viewModel.prepareForMAPCV3RevisionFollowUp()
            } else {
                viewModel.prepareForFreshGeneration()
            }
        } else {
            viewModel.prepareForFreshGeneration()
        }

        Task {
            await viewModel.submitAssistantRequest()
            await MainActor.run {
                assistantIsThinking = false
                processAssistantGenerationResult()
            }
        }
    }

    private var isActiveMAPCRefinementStage: Bool {
        assistantFlowStage == .awaitingBackgroundApproval
            || assistantFlowStage == .awaitingPreviewConfirmation
            || assistantFlowStage == .awaitingMapcStart
    }

    private func classifyMAPCTurnIntent(_ prompt: String) -> MAPCTurnIntentClassification {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()

        if containsAnyIntentPhrase(lower, [
            "start over",
            "restart",
            "reset this",
            "new conversation"
        ]) {
            return MAPCTurnIntentClassification(intent: .startOver, newIssueScore: 1.0)
        }

        if containsAnyIntentPhrase(lower, [
            "new issue",
            "different issue",
            "switch topics",
            "instead talk about",
            "actually i want to talk about"
        ]) {
            return MAPCTurnIntentClassification(intent: .newIssue, newIssueScore: 0.92)
        }

        if containsAnyIntentPhrase(lower, [
            "wrong ask",
            "change the ask",
            "there's no explicit bill",
            "there’s no explicit bill",
            "there is no explicit bill",
            "needs a bill",
            "needs a specific action"
        ]) {
            return MAPCTurnIntentClassification(intent: .reviseAsk, newIssueScore: 0.2)
        }

        if containsAnyIntentPhrase(lower, [
            "wrong issue",
            "not about",
            "too broad",
            "narrow this",
            "not this issue"
        ]) {
            return MAPCTurnIntentClassification(intent: .reviseIssue, newIssueScore: 0.2)
        }

        if containsAnyIntentPhrase(lower, [
            "needs a local angle",
            "make it local",
            "local angle",
            "district",
            "state-specific",
            "tone",
            "strategy preference"
        ]) {
            return MAPCTurnIntentClassification(intent: .reviseToneOrConstraints, newIssueScore: 0.2)
        }

        if containsAnyIntentPhrase(lower, [
            "bad response",
            "this is bad",
            "this is wrong",
            "you are not listening",
            "frustrating"
        ]) {
            return MAPCTurnIntentClassification(intent: .metaFrustration, newIssueScore: 0.15)
        }

        if viewModel.shouldContinueMAPCV3Clarification {
            return MAPCTurnIntentClassification(intent: .clarificationAnswer, newIssueScore: 0.2)
        }

        if isActiveMAPCRefinementStage && viewModel.mapcPipelineV3Enabled {
            return MAPCTurnIntentClassification(intent: .reviseIssue, newIssueScore: 0.25)
        }

        return MAPCTurnIntentClassification(intent: .newIssue, newIssueScore: 0.7)
    }

    private func rewrittenMAPCV3RevisionPrompt(
        from prompt: String,
        priorConcern: String,
        intent: MAPCTurnIntentClassification
    ) -> String {
        let trimmed = prompt.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = trimmed.lowercased()
        let contextSnippet = String(priorConcern.prefix(180)).trimmingCharacters(in: .whitespacesAndNewlines)
        let contextPrefix = contextSnippet.isEmpty ? "" : " Current issue context: \(contextSnippet)."

        switch intent.intent {
        case .clarificationAnswer:
            return trimmed
        case .reviseIssue:
            return "Keep the current issue context.\(contextPrefix) Revise issue framing based on this feedback: \(trimmed)"
        case .reviseAsk:
            if containsAnyIntentPhrase(lower, ["there's no explicit bill", "there’s no explicit bill", "there is no explicit bill", "needs a bill"]) {
                return "Keep the same issue.\(contextPrefix) Revision request: there is no explicit bill reference. Add a bill only if explicit and feasible; otherwise choose one specific congressional action."
            }
            if containsAnyIntentPhrase(lower, ["needs a specific action"]) {
                return "Keep the same issue.\(contextPrefix) Revision request: replace generic language with one explicit congressional action."
            }
            return "Keep the same issue.\(contextPrefix) Revise the ask selection based on: \(trimmed)"
        case .reviseToneOrConstraints:
            return "Keep the same issue and ask.\(contextPrefix) Apply this constraint update: \(trimmed)"
        case .metaFrustration:
            return "Keep the same issue.\(contextPrefix) Improve specificity and correctness. User feedback: \(trimmed)"
        case .newIssue, .startOver:
            return trimmed
        }
    }

    private func containsAnyIntentPhrase(_ text: String, _ phrases: [String]) -> Bool {
        phrases.contains { text.contains($0) }
    }

    private func processAssistantGenerationResult() {
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            processAssistantGenerationResultV3()
            return
        }

        if viewModel.requiresDraftApproval {
            postStructuredBackgroundIfNeeded()
            viewModel.errorMessage = nil
            return
        }

        if let error = viewModel.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
           !error.isEmpty {
            appendAssistantBotMessage(error, kind: .plain, messageType: "error")
            viewModel.errorMessage = nil
        } else {
            appendAssistantBotMessage(
                "I need one detail to make this usable: what issue do you care about most?",
                kind: .plain,
                messageType: "fallback_prompt"
            )
        }
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        currentBackgroundDiscussionOptions = []
        assistantFlowStage = .awaitingPrompt
    }

    private func processAssistantGenerationResultV3() {
        if viewModel.hasMAPCV3PreparedSelection {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            // Do not auto-advance. Always show interpreted issue + ask chips and wait for user selection.
            guard !viewModel.mapcV3AskOptions.isEmpty else {
                appendAssistantBotMessage(
                    "I hit a snag, but I still have your issue. Pick a fix or restate the action you want.",
                    kind: .plain,
                    messageType: "offline_notice"
                )
                assistantFlowStage = .awaitingPrompt
                viewModel.errorMessage = nil
                return
            }

            hasPostedCurrentDraftBackground = true
            hasAcceptedCurrentMAPCV3Preview = false
            pendingBackgroundMessageID = nil
            pendingScriptPreviewMessageID = nil
            withAnimation(.easeOut(duration: 0.18)) {
                isScriptPreviewReadyForMAPCActions = false
                isBackgroundMessageReadyForActions = true
            }
            assistantFlowStage = .awaitingBackgroundApproval
            viewModel.errorMessage = nil
            return
        }

        if let error = viewModel.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
           !error.isEmpty {
            appendAssistantBotMessage(error, kind: .plain, messageType: "error")
            viewModel.errorMessage = nil
        } else {
            appendAssistantBotMessage(
                "I need one detail to make this usable: what issue do you care about most?",
                kind: .plain,
                messageType: "fallback_prompt"
            )
        }
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        currentBackgroundDiscussionOptions = []
        assistantFlowStage = .awaitingPrompt
    }

    private func postStructuredBackgroundIfNeeded() {
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            return
        }
        guard !hasPostedCurrentDraftBackground else { return }
        let snapshot = assistantRefinementSnapshot()
        let laymanBackground = laymanBackgroundMessage(from: snapshot)
        var options = AssistantBackgroundFirstResponseFormatter.discussionOptions(
            rawInput: snapshot.rawUserInput,
            normalizedIssue: snapshot.normalizedIssue,
            seeded: snapshot.commonInterpretations,
            billReference: normalizedBillInput() ?? viewModel.resolvedEntities.bills.first
        )
        options = options
            .map(cleanedDiscussionOption)
            .filter { !$0.isEmpty }
        var seen = Set<String>()
        options = options.filter { seen.insert($0.lowercased()).inserted }
        if let generalOption = generalDiscussionOptionText(from: snapshot.rawUserInput, normalizedIssue: snapshot.normalizedIssue) {
            let cleanedGeneralOption = cleanedDiscussionOption(generalOption)
            if !cleanedGeneralOption.isEmpty {
                options.removeAll { $0.caseInsensitiveCompare(cleanedGeneralOption) == .orderedSame }
                options.insert(cleanedGeneralOption, at: 0)
            }
        }
        currentBackgroundDiscussionOptions = options

        let backgroundMessage = AssistantChatMessage.assistant(
            laymanBackground,
            kind: .plain
        )
        assistantMessages.append(backgroundMessage)
        viewModel.logScriptChatTurn(
            role: "assistant",
            messageText: laymanBackground,
            messageType: "background"
        )
        pendingBackgroundMessageID = backgroundMessage.id
        isBackgroundMessageReadyForActions = false
        assistantFlowStage = .awaitingBackgroundApproval
        hasPostedCurrentDraftBackground = true
        suppressTranslationForNextBackground = false
    }

    private func approveBackgroundInChat() {
        guard assistantFlowStage == .awaitingBackgroundApproval else { return }
        guard let brief = viewModel.activeBrief else {
            appendAssistantBotMessage(
                "I lost the draft state. Send your issue again and I’ll regenerate it.",
                kind: .plain,
                messageType: "error"
            )
            assistantFlowStage = .awaitingPrompt
            hasPostedCurrentDraftBackground = false
            return
        }

        appendAssistantUserMessage("Selected: Use This", messageType: "approval")
        isScriptPreviewReadyForMAPCActions = false
        let scriptPreviewMessage = AssistantChatMessage.assistant(formattedScriptPreview(for: brief), kind: .script)
        assistantMessages.append(scriptPreviewMessage)
        viewModel.logScriptChatTurn(
            role: "assistant",
            messageText: scriptPreviewMessage.text,
            messageType: "script_preview"
        )
        pendingScriptPreviewMessageID = scriptPreviewMessage.id
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        currentBackgroundDiscussionOptions = []
        assistantFlowStage = .awaitingMapcStart
    }

    private func startMAPCFromChat() {
        guard assistantFlowStage == .awaitingMapcStart else { return }
        if viewModel.mapcPipelineV3Enabled && !hasAcceptedCurrentMAPCV3Preview {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            appendAssistantBotMessage(
                "Review the script preview and tap Looks right before approving the call.",
                kind: .plain,
                messageType: "preview_required"
            )
            assistantFlowStage = .awaitingPreviewConfirmation
            return
        }
        guard viewModel.requiresDraftApproval else { return }
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        viewModel.markMAPCV3ApprovedByUser()
        viewModel.approveGeneratedDraft()
        appendAssistantBotMessage(
            "Your call guide is ready. Approve and call, or fix the wording first.",
            kind: .plain,
            messageType: "mapc_launch"
        )
        assistantFlowStage = .awaitingPrompt
        hasPostedCurrentDraftBackground = false
        hasAcceptedCurrentMAPCV3Preview = false
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        pendingScriptPreviewMessageID = nil
        isScriptPreviewReadyForMAPCActions = false
        currentBackgroundDiscussionOptions = []
        suppressTranslationForNextBackground = false
    }

    private func applyMAPCAgenticStrategyChip(_ chip: MAPCAgenticStrategyChip) {
        guard !assistantIsThinking, !viewModel.isSubmitting else { return }
        appendAssistantUserMessage("Selected strategy: \(chip.rawValue)", messageType: "strategy_chip")

        if chip == .other {
            awaitingCustomAgenticStrategyInput = true
            appendAssistantBotMessage(
                "Type your strategy in one sentence and I’ll apply it to the next ask options.",
                kind: .plain,
                messageType: "strategy_other_prompt"
            )
            focusedField = .concern
            return
        }

        awaitingCustomAgenticStrategyInput = false
        assistantComposerText = "strategy preference: \(chip.strategyInstruction)"
        submitScriptDraft(fromDiscussionOption: true)
    }

    private func startOverMAPCV3SessionInChat() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        viewModel.startOverMAPCV3Session()
        awaitingCustomAgenticStrategyInput = false
        previewLintBlocked = false
        hasRetriedPreviewLintRegeneration = false
        hasAcceptedCurrentMAPCV3Preview = false
        assistantFlowStage = .awaitingPrompt
        hasPostedCurrentDraftBackground = false
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        pendingScriptPreviewMessageID = nil
        isScriptPreviewReadyForMAPCActions = false
        currentBackgroundDiscussionOptions = []
        suppressTranslationForNextBackground = false
        appendAssistantBotMessage(
            "Starting over. Tell me the issue you want your elected representatives to act on.",
            kind: .plain,
            messageType: "start_over"
        )
    }

    private func reviseGeneratedDraftInChat() {
        appendAssistantUserMessage("Selected: Revise", messageType: "revise")
        viewModel.reviseGeneratedDraft()
        assistantFlowStage = .awaitingPrompt
        hasPostedCurrentDraftBackground = false
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        pendingScriptPreviewMessageID = nil
        isScriptPreviewReadyForMAPCActions = false
        currentBackgroundDiscussionOptions = []
        suppressTranslationForNextBackground = false
        appendAssistantBotMessage(
            "Tell me what to change and I’ll rewrite the call guide.",
            kind: .plain,
            messageType: "revise_prompt"
        )
        focusedField = .concern
    }

    private var discussionOptionsForCurrentBackground: [String] {
        currentBackgroundDiscussionOptions
    }

    private func cleanedDiscussionOption(_ option: String) -> String {
        let withoutGeneralPrefix = option.replacingOccurrences(
            of: #"^\s*general\s*:\s*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        return withoutGeneralPrefix
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func selectDiscussionOptionInChat(_ option: String) {
        guard !assistantIsThinking, !viewModel.isSubmitting else { return }
        let cleanedOption = cleanedDiscussionOption(option)
        guard !cleanedOption.isEmpty else { return }
        hasPickedDiscussionOptionInCurrentCycle = true
        assistantComposerText = cleanedOption
        submitScriptDraft(fromDiscussionOption: true)
    }

    private func selectMAPCV3OptionInChat(_ option: CivicMAPCV3PreparedOption) {
        guard !assistantIsThinking, !viewModel.isSubmitting else { return }
        hasPickedDiscussionOptionInCurrentCycle = true
        awaitingCustomAgenticStrategyInput = false
        previewLintBlocked = false
        hasRetriedPreviewLintRegeneration = false
        hasAcceptedCurrentMAPCV3Preview = false
        viewModel.selectMAPCV3Option(optionID: option.optionID)
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // New flow order: selecting an ask immediately generates background + script preview.
        appendAssistantUserMessage("Selected ask: \(option.displayAsk)", messageType: "ask_selected")
        assistantIsThinking = true
        pendingBackgroundMessageID = nil
        pendingScriptPreviewMessageID = nil
        withAnimation(.easeOut(duration: 0.18)) {
            isBackgroundMessageReadyForActions = false
            isScriptPreviewReadyForMAPCActions = false
        }
        assistantFlowStage = .awaitingPrompt
        Task {
            await viewModel.generateMAPCV3ScriptAfterPreviewConfirmation()
            await MainActor.run {
                assistantIsThinking = false
                processMAPCV3ConfirmedResult()
            }
        }
    }

    private func fixMAPCV3PreviewInChat() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // Preserve selected ask so the user can refine without reselecting.
        appendAssistantUserMessage("Selected: Fix this", messageType: "preview_fix")
        previewLintBlocked = false
        hasRetriedPreviewLintRegeneration = false
        hasAcceptedCurrentMAPCV3Preview = false
        hasPickedDiscussionOptionInCurrentCycle = false
        assistantFlowStage = .awaitingPreviewConfirmation
        withAnimation(.easeOut(duration: 0.18)) {
            isBackgroundMessageReadyForActions = false
            isScriptPreviewReadyForMAPCActions = false
        }
        appendAssistantBotMessage(
            "Got it — I’m keeping the issue and changing the ask.",
            kind: .plain,
            messageType: "revise_prompt"
        )
        focusedField = .concern
    }

    private func confirmMAPCV3PreviewInChat() {
        guard !assistantIsThinking, !viewModel.isSubmitting else { return }
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        // Preview confirmation now happens after preview is visible; no regeneration here.
        appendAssistantUserMessage("Selected: Looks right", messageType: "preview_confirm")
        hasAcceptedCurrentMAPCV3Preview = true
        viewModel.mapcV3SessionState = "script_shown"
        assistantFlowStage = .awaitingMapcStart
    }

    private func processMAPCV3ConfirmedResult() {
        // mapc_pipeline_v3 — remove flag check after rollout confirmed
        let normalizedGenerationPath = viewModel.generationPath
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        let previewAllowedPaths: Set<String> = ["v3", "premade"]
        if viewModel.requiresDraftApproval && !previewAllowedPaths.contains(normalizedGenerationPath) {
            let reason = normalizedGenerationPath.isEmpty
                ? "final_preview_guard_unknown_path"
                : "final_preview_guard_\(normalizedGenerationPath)"
            viewModel.blockLegacyPreviewAtHandoff(reason: reason)
            appendAssistantBotMessage(
                viewModel.mapcTransportNotice,
                kind: .plain,
                messageType: "offline_notice"
            )
            assistantFlowStage = .awaitingPrompt
            pendingBackgroundMessageID = nil
            pendingScriptPreviewMessageID = nil
            isBackgroundMessageReadyForActions = false
            isScriptPreviewReadyForMAPCActions = false
            currentBackgroundDiscussionOptions = []
            viewModel.errorMessage = nil
            return
        }

        if viewModel.requiresDraftApproval, let brief = viewModel.activeBrief {
            if let lintReason = mapcPreviewLintFailureReason(for: brief) {
                if normalizedGenerationPath == "v3", !hasRetriedPreviewLintRegeneration {
                    // mapc_pipeline_v3 — remove flag check after rollout confirmed
                    hasRetriedPreviewLintRegeneration = true
                    assistantIsThinking = true
                    Task {
                        await viewModel.generateMAPCV3ScriptAfterPreviewConfirmation()
                        await MainActor.run {
                            assistantIsThinking = false
                            processMAPCV3ConfirmedResult()
                        }
                    }
                    return
                }

                previewLintBlocked = true
                hasAcceptedCurrentMAPCV3Preview = false
                appendAssistantBotMessage(
                    "I hit a snag, but I still have your issue. Pick a fix or restate the action you want.",
                    kind: .plain,
                    messageType: "lint_blocked"
                )
                assistantFlowStage = .awaitingPreviewConfirmation
                pendingBackgroundMessageID = nil
                pendingScriptPreviewMessageID = nil
                withAnimation(.easeOut(duration: 0.18)) {
                    isBackgroundMessageReadyForActions = false
                    isScriptPreviewReadyForMAPCActions = true
                }
                viewModel.errorMessage = nil
                return
            }

            previewLintBlocked = false
            hasRetriedPreviewLintRegeneration = false
            hasAcceptedCurrentMAPCV3Preview = false
            let trimmedBackground = viewModel.mapcV3BackgroundText.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmedBackground.isEmpty {
                let backgroundMessage = AssistantChatMessage.assistant(trimmedBackground, kind: .plain)
                assistantMessages.append(backgroundMessage)
                viewModel.logScriptChatTurn(
                    role: "assistant",
                    messageText: trimmedBackground,
                    messageType: "background"
                )
                pendingBackgroundMessageID = backgroundMessage.id
            } else {
                pendingBackgroundMessageID = nil
            }
            let scriptPreviewMessage = AssistantChatMessage.assistant(formattedScriptPreview(for: brief), kind: .script)
            assistantMessages.append(scriptPreviewMessage)
            viewModel.logScriptChatTurn(
                role: "assistant",
                messageText: scriptPreviewMessage.text,
                messageType: "script_preview"
            )
            pendingScriptPreviewMessageID = scriptPreviewMessage.id
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            // Keep preview confirmation post-preview. MAPC start appears only after "Looks right".
            assistantFlowStage = .awaitingPreviewConfirmation
            isBackgroundMessageReadyForActions = false
            currentBackgroundDiscussionOptions = []
            viewModel.errorMessage = nil
            return
        }

        if let error = viewModel.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines),
           !error.isEmpty {
            if error.lowercased().contains("script issue and held this draft") {
                previewLintBlocked = true
                hasAcceptedCurrentMAPCV3Preview = false
                appendAssistantBotMessage(error, kind: .plain, messageType: "lint_blocked")
                assistantFlowStage = .awaitingPreviewConfirmation
                pendingBackgroundMessageID = nil
                pendingScriptPreviewMessageID = nil
                withAnimation(.easeOut(duration: 0.18)) {
                    isBackgroundMessageReadyForActions = false
                    isScriptPreviewReadyForMAPCActions = true
                }
                viewModel.errorMessage = nil
                return
            }
            appendAssistantBotMessage(error, kind: .plain, messageType: "error")
            viewModel.errorMessage = nil
        }
        previewLintBlocked = false
        hasAcceptedCurrentMAPCV3Preview = false
        assistantFlowStage = .awaitingPrompt
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        currentBackgroundDiscussionOptions = []
    }

    private func generalDiscussionOptionText(from rawInput: String, normalizedIssue: String) -> String? {
        let baseInput = rawInput
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let labelSource = baseInput.isEmpty
            ? normalizedIssue.trimmingCharacters(in: .whitespacesAndNewlines)
            : baseInput
        guard !labelSource.isEmpty else { return nil }

        let compact = labelSource
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !compact.isEmpty else { return nil }
        if let bill = normalizedBillInput() ?? viewModel.resolvedEntities.bills.first {
            return "Build the script around \(compact). If feasible, tie the ask directly to \(bill)."
        }
        return "Build the script around \(compact) and choose the highest-impact congressional action."
    }

    private func mapcPreviewLintFailureReason(for brief: CivicCallBrief) -> String? {
        let rawIssue = viewModel.concernText
        let scripts = [
            ("live", brief.liveScript),
            ("voicemail", brief.voicemailScript),
        ]

        for (label, script) in scripts {
            if let reason = singleScriptLintFailureReason(script: script, rawIssue: rawIssue) {
                return "\(label): \(reason)"
            }
        }
        return nil
    }

    private func singleScriptLintFailureReason(script: String, rawIssue: String) -> String? {
        let lowered = normalizeLintText(script)
        guard !lowered.isEmpty else { return "empty script" }

        let blockedPhrases = [
            "[representative]",
            "[your_name]",
            "[your name]",
            "[name]",
            "my name is [zip]",
            "support this issue",
            "oppose this issue",
            "represents your house district",
            "support on congressional action on support",
            "oppose stop",
            "calling about i want a mapc on"
        ]
        if let matched = blockedPhrases.first(where: { lowered.contains($0) }) {
            return "blocked phrase '\(matched)'"
        }

        if hasDisallowedPlaceholder(in: script) {
            return "placeholder other than [ZIP]"
        }

        if lowered.contains("[zip]"), !zipAppearsInLocationPhrase(script) {
            return "[ZIP] not in location phrase"
        }

        if !askSentenceHasConcreteAction(script) {
            return "missing concrete ask verb"
        }

        if !closeRequestsPositionOrNextStep(script) {
            return "missing closing request"
        }

        if directRawIssueCopyDetected(script: script, rawIssue: rawIssue) {
            return "direct raw issue copy"
        }

        return nil
    }

    private func hasDisallowedPlaceholder(in script: String) -> Bool {
        let nsrange = NSRange(script.startIndex..<script.endIndex, in: script)
        guard let regex = try? NSRegularExpression(pattern: #"\[[^\]]+\]"#, options: []) else {
            return false
        }
        let matches = regex.matches(in: script, options: [], range: nsrange)
        for match in matches {
            guard let range = Range(match.range, in: script) else { continue }
            let token = script[range].lowercased()
            if token != "[zip]" {
                return true
            }
        }
        return false
    }

    private func zipAppearsInLocationPhrase(_ script: String) -> Bool {
        let lowered = normalizeLintText(script)
        if lowered.contains("my name is [zip]") {
            return false
        }
        let pattern = #"(calling from|constituent from|constituent in|from|in)\s*(zip\s*)?\[zip\]"#
        return lowered.range(of: pattern, options: .regularExpression) != nil
    }

    private func askSentenceHasConcreteAction(_ script: String) -> Bool {
        let sentences = splitSentences(script)
        guard !sentences.isEmpty else { return false }

        let actionPatterns = [
            #"\bsupport\b"#,
            #"\boppose\b"#,
            #"\bvote\s+yes\b"#,
            #"\bvote\s+no\b"#,
            #"\bfund(?:ing)?\b"#,
            #"\binvestigat(?:e|es|ing|ion)\b"#,
            #"\brequire\s+report(?:ing|s)?\b"#,
            #"\bback\s+protections?\b"#,
            #"\brestrict\s+funding\b"#,
            #"\bissue\s+a\s+public\s+statement\b"#
        ]

        let candidateSentence = sentences.first(where: {
            let lowered = normalizeLintText($0)
            return lowered.contains("please") || lowered.contains("i'm asking") || lowered.contains("i am asking")
        }) ?? sentences[0]

        let loweredCandidate = normalizeLintText(candidateSentence)
        return actionPatterns.contains(where: { loweredCandidate.range(of: $0, options: .regularExpression) != nil })
    }

    private func closeRequestsPositionOrNextStep(_ script: String) -> Bool {
        let sentences = splitSentences(script)
        guard let last = sentences.last else { return false }
        let lowered = normalizeLintText(last)

        if lowered.contains("position") && (lowered.contains("office") || lowered.contains("member")) {
            return true
        }
        if lowered.contains("next step") {
            return true
        }
        let supportPattern = #"(whether|will)\s+the\s+office\s+(support|oppose|back|vote|fund|investigate|require|restrict|issue)"#
        return lowered.range(of: supportPattern, options: .regularExpression) != nil
    }

    private func directRawIssueCopyDetected(script: String, rawIssue: String) -> Bool {
        let normalizedRaw = normalizeLintText(rawIssue)
        let normalizedScript = normalizeLintText(script)
        guard !normalizedRaw.isEmpty, !normalizedScript.isEmpty else { return false }

        let words = normalizedRaw.split(separator: " ")
        if normalizedRaw.count >= 8, words.count >= 2, normalizedScript.contains(normalizedRaw) {
            if normalizedScript.hasPrefix(normalizedRaw)
                || normalizedScript.contains("about \(normalizedRaw)")
                || normalizedScript.contains("calling about \(normalizedRaw)")
                || words.count >= 5 {
                return true
            }
        }
        return false
    }

    private func splitSentences(_ text: String) -> [String] {
        text
            .components(separatedBy: CharacterSet(charactersIn: ".!?"))
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
    }

    private func normalizeLintText(_ text: String) -> String {
        text
            .lowercased()
            .replacingOccurrences(of: #"[^a-z0-9\[\]\s']"#, with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func mergedConcernText(base: String, refinement: String) -> String {
        let cleanBase = base.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanRefinement = refinement.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !cleanBase.isEmpty else { return cleanRefinement }
        guard !cleanRefinement.isEmpty else { return cleanBase }

        let baseLower = cleanBase.lowercased()
        let refinementLower = cleanRefinement.lowercased()
        if baseLower.contains(refinementLower) { return cleanBase }
        if refinementLower.contains(baseLower) { return cleanRefinement }

        let normalizedBase = cleanBase.hasSuffix(".") ? String(cleanBase.dropLast()) : cleanBase
        return "\(normalizedBase). \(cleanRefinement)"
    }

    private func seedAssistantChatIfNeeded() {
        guard assistantMessages.isEmpty else { return }
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            let hasPriorAssistantTurns = viewModel.hasScriptChatHistory
                || assistantMessages.contains(where: { $0.role == .assistant })
            guard viewModel.mapcV3SessionState == "new" else { return }
            guard !viewModel.mapcV3IntroShown else { return }
            guard !hasPriorAssistantTurns else { return }
            let intro = Self.assistantIntroText
            let introMessage = AssistantChatMessage.assistant(intro)
            assistantMessages = [introMessage]
            animatedAssistantMessageIDs.insert(introMessage.id)
            viewModel.markMAPCV3IntroShown()
            viewModel.logScriptChatTurn(
                role: "assistant",
                messageText: intro,
                messageType: "intro"
            )
            return
        }
        let intro = Self.assistantIntroText
        let introMessage = AssistantChatMessage.assistant(intro)
        assistantMessages = [introMessage]
        animatedAssistantMessageIDs.insert(introMessage.id)
        viewModel.logScriptChatTurn(
            role: "assistant",
            messageText: intro,
            messageType: "intro"
        )
    }

    private func inferredAsk(from prompt: String) -> CivicAsk? {
        let lowered = prompt.lowercased()
        if lowered.contains("vote no") { return .voteNo }
        if lowered.contains("vote yes") { return .voteYes }
        if lowered.contains("oppose") || lowered.contains("block") || lowered.contains("stop") || lowered.contains("reject") {
            return .oppose
        }
        if lowered.contains("oversight") || lowered.contains("investigate") || lowered.contains("hearing") {
            return .seekOversight
        }
        if lowered.contains("statement") || lowered.contains("speak out") || lowered.contains("publicly") {
            return .askPublicStatement
        }
        if lowered.contains("support") || lowered.contains("protect") || lowered.contains("expand") {
            return .support
        }
        return nil
    }

    private func extractedBillReference(from prompt: String) -> String? {
        let patterns = [
            #"\bH\.?\s*R\.?\s*\d+\b"#,
            #"\bS\.?\s*\d+\b"#,
            #"\bH\.?\s*J\.?\s*Res\.?\s*\d+\b"#,
            #"\bS\.?\s*J\.?\s*Res\.?\s*\d+\b"#
        ]

        for pattern in patterns {
            guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { continue }
            let range = NSRange(prompt.startIndex..<prompt.endIndex, in: prompt)
            guard let match = regex.firstMatch(in: prompt, options: [], range: range),
                  let swiftRange = Range(match.range, in: prompt) else { continue }
            return prompt[swiftRange]
                .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
                .uppercased()
        }
        return nil
    }

    private func assistantRefinementSnapshot() -> AssistantRefinementSnapshot {
        let normalizedIssue = mapcIssueHeadline
        let background = condensedAssistantBackground(from: viewModel.issueSummary, fallbackIssue: normalizedIssue)

        var interpretations: [String] = []
        if let selectedAsk = viewModel.selectedAsk {
            interpretations.append("Likely intent: \(selectedAsk.title.lowercased()) congressional action on \(normalizedIssue.lowercased()).")
        }
        if let bill = normalizedBillInput() {
            interpretations.append("Potential policy anchor: \(bill).")
        } else if let firstBill = viewModel.resolvedEntities.bills.first {
            interpretations.append("Possible tie-in from issue data: \(firstBill).")
        } else {
            interpretations.append("This appears to be a broad civic advocacy request that may need scope confirmation.")
        }
        interpretations = Array(interpretations.prefix(3))

        var questions: [String] = []
        if normalizedBillInput() == nil && viewModel.resolvedEntities.bills.isEmpty {
            questions.append("Is there a specific bill, program, or agency you want referenced?")
        }
        questions.append("What issue do you care about most?")
        questions.append("Should the script prioritize funding, oversight, or voting action?")
        questions.append("Do you want a stronger economic, safety, rights, or local-impact framing?")
        questions = Array(questions.prefix(4))

        let recommendedPrompt = recommendedPromptText(for: normalizedIssue)

        let repTargets = viewModel.callBriefs.map { memberTitleAndLastName(for: $0) }.joined(separator: ", ")

        let sections: [String: String] = [
            "issue_title": normalizedIssue,
            "explicit_ask": (viewModel.selectedAsk ?? .support).title,
            "target_reps": repTargets
        ]

        return AssistantRefinementSnapshot(
            rawUserInput: viewModel.concernText,
            normalizedIssue: normalizedIssue,
            briefBackground: background,
            commonInterpretations: interpretations,
            clarifyingQuestions: questions,
            recommendedPrompt: recommendedPrompt,
            mapcSections: sections,
            confidence: confidenceLabel(),
            groundingType: groundingTypeLabel()
        )
    }

    private func laymanBackgroundMessage(from snapshot: AssistantRefinementSnapshot) -> String {
        let evidenceLine = laymanEvidenceLines().first
        return AssistantBackgroundFirstResponseFormatter.format(
            rawInput: snapshot.rawUserInput,
            normalizedIssue: snapshot.normalizedIssue,
            briefBackground: snapshot.briefBackground,
            commonInterpretations: snapshot.commonInterpretations,
            evidenceLine: evidenceLine,
            includeTranslation: !suppressTranslationForNextBackground
        )
    }

    private func laymanEvidenceLines() -> [String] {
        var items: [String] = []

        if let activeBrief = viewModel.activeBrief {
            for point in activeBrief.talkingPoints {
                var cleaned = point.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !cleaned.isEmpty else { continue }
                guard !cleaned.hasPrefix("Issue:") else { continue }
                guard !cleaned.hasPrefix("Ask:") else { continue }

                cleaned = cleaned
                    .replacingOccurrences(of: "Issue context:", with: "")
                    .replacingOccurrences(of: "Summary:", with: "")
                    .replacingOccurrences(of: "Evidence note:", with: "")
                    .trimmingCharacters(in: .whitespacesAndNewlines)

                if cleaned.isEmpty { continue }
                if items.contains(where: { $0.caseInsensitiveCompare(cleaned) == .orderedSame }) { continue }
                items.append(cleaned)
                if items.count >= 2 { break }
            }
        }

        if items.isEmpty,
           let bill = normalizedBillInput() ?? viewModel.resolvedEntities.bills.first {
            items.append("A policy anchor in current context is \(bill).")
        }

        return items
    }

    private func serializedRefinementSnapshot(_ snapshot: AssistantRefinementSnapshot) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(snapshot),
              let text = String(data: data, encoding: .utf8) else {
            return """
            {"normalized_issue":"\(snapshot.normalizedIssue)","brief_background":"\(snapshot.briefBackground)"}
            """
        }
        return text
    }

    private func condensedAssistantBackground(from summary: String, fallbackIssue: String) -> String {
        let trimmed = summary.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return "This request concerns \(fallbackIssue.lowercased()) and needs a clear congressional ask with one concrete policy action."
        }
        let firstParagraph = trimmed
            .components(separatedBy: "\n\n")
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed
        return concisePreview(firstParagraph, maxWords: 42)
    }

    private func concisePreview(_ text: String, maxWords: Int = 36) -> String {
        let collapsed = text
            .replacingOccurrences(of: "\n", with: " ")
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let words = collapsed.split(whereSeparator: \.isWhitespace).map(String.init)
        guard words.count > maxWords else { return collapsed }
        return words.prefix(maxWords).joined(separator: " ") + "..."
    }

    private func recommendedPromptText(for issue: String) -> String {
        let ask = (viewModel.selectedAsk ?? .support).title.lowercased()
        if let bill = normalizedBillInput() {
            return "Please generate a phone-ready script to \(ask) \(issue.lowercased()), tied to \(bill), with one concrete policy action and one real-world impact."
        }
        return "Please generate a phone-ready script to \(ask) \(issue.lowercased()) with one concrete policy action, one real-world impact, and language natural for speaking to a congressional office."
    }

    private func confidenceLabel() -> String {
        let loweredSummary = viewModel.issueSummary.lowercased()
        if loweredSummary.contains("evidence is limited") || loweredSummary.contains("no verified evidence") {
            return "low"
        }
        if !viewModel.resolvedEntities.bills.isEmpty || !viewModel.resolvedEntities.committees.isEmpty {
            return "high"
        }
        return "medium"
    }

    private func groundingTypeLabel() -> String {
        if normalizedBillInput() != nil || !viewModel.resolvedEntities.bills.isEmpty {
            return "web"
        }
        return "general"
    }

    private func normalizedBillInput() -> String? {
        let value = viewModel.optionalBillRef.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    private func formattedScriptPreview(for brief: CivicCallBrief) -> String {
        let live = maskedRepresentativePreviewText(
            brief.liveScript.trimmingCharacters(in: .whitespacesAndNewlines),
            brief: brief
        )
        return """
        Draft script:
        \(live)
        """
    }

    private func maskedRepresentativePreviewText(_ text: String, brief: CivicCallBrief) -> String {
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            return text
        }
        var masked = text
        let fullName = brief.repName.trimmingCharacters(in: .whitespacesAndNewlines)
        if !fullName.isEmpty {
            masked = masked.replacingOccurrences(
                of: NSRegularExpression.escapedPattern(for: fullName),
                with: "[REPRESENTATIVE]",
                options: [.regularExpression, .caseInsensitive]
            )
        }

        let lastName = trackerDisplayLastName(from: fullName).trimmingCharacters(in: .whitespacesAndNewlines)
        if !lastName.isEmpty {
            let escapedLast = NSRegularExpression.escapedPattern(for: lastName)
            let titledPatterns = [
                #"(?i)\bU\.?\s*S\.?\s*Senator\s+\#(escapedLast)\b"#,
                #"(?i)\bU\.?\s*S\.?\s*Representative\s+\#(escapedLast)\b"#,
                #"(?i)\bSenator\s+\#(escapedLast)\b"#,
                #"(?i)\bRepresentative\s+\#(escapedLast)\b"#,
                #"(?i)\bCongress(?:man|woman)\s+\#(escapedLast)\b"#
            ]
            for pattern in titledPatterns {
                masked = masked.replacingOccurrences(
                    of: pattern,
                    with: "[REPRESENTATIVE]",
                    options: .regularExpression
                )
            }
        }

        return masked
    }

    private var draftApprovalCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Review draft before calling")
                .font(.headline)

            Text("Looks right? Use this script. Not right? Revise and regenerate.")
                .font(.subheadline)
                .foregroundColor(VoteNowColors.mutedText)

            HStack(spacing: 8) {
                Button {
                    viewModel.reviseGeneratedDraft()
                    focusedField = .concern
                } label: {
                    Text("Revise")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    if viewModel.mapcPipelineV3Enabled {
                        // mapc_pipeline_v3 — remove flag check after rollout confirmed
                        // Treat this tap as explicit script acceptance before final approval.
                        viewModel.mapcV3SessionState = "script_shown"
                        viewModel.markMAPCV3ApprovedByUser()
                    }
                    viewModel.approveGeneratedDraft()
                } label: {
                    Text("Looks good")
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(VoteNowColors.primaryCTA)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite.opacity(0.55))
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
    }

    private func draftPreviewCard(_ brief: CivicCallBrief) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Draft preview for \(brief.repName)")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            scriptBlock(title: "Live-call Script (Draft)", text: maskedRepresentativePreviewText(brief.liveScript, brief: brief))
            scriptBlock(title: "Voicemail Script (Draft)", text: maskedRepresentativePreviewText(brief.voicemailScript, brief: brief))
        }
        .padding(12)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
    }

    private var issueSummaryCard: some View {
        let talkingPoints = viewModel.activeBrief?.talkingPoints ?? []
        let issueHeadline = isMAPCMode ? mapcIssueHeadline : viewModel.issueTitle

        return VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Text("\(l("app.issue_call.issue.prefix", "Issue:")) \(issueHeadline)")
                    .font(isMAPCMode ? .headline.weight(.semibold) : .title3.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .lineLimit(isMAPCMode ? 2 : 1)
            .minimumScaleFactor(isMAPCMode ? 0.92 : 0.85)
            .padding(.trailing, talkingPoints.isEmpty ? 0 : (isMAPCMode ? 0 : 122))
            .overlay(alignment: .topTrailing) {
                if !talkingPoints.isEmpty, !isMAPCMode {
                    scriptInputsToggleButton
                }
            }

            if !isMAPCMode, !isIssueSummaryDuplicate {
                Text(cleanedIssueSummaryForTopCard(viewModel.issueSummary))
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
            }

            if !talkingPoints.isEmpty && isTalkingPointsExpanded && !isMAPCMode {
                VStack(alignment: .leading, spacing: 4) {
                    Text(l("app.issue_call.script.inputs", "Script inputs"))
                        .font(.subheadline.weight(.semibold))
                    VStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(talkingPoints.enumerated()), id: \.offset) { _, point in
                            Text("• \(point)")
                                .font(.caption)
                                .foregroundColor(VoteNowColors.primaryText)
                        }
                    }
                    .padding(.top, 4)
                }
            }

            if !isMAPCMode, !viewModel.resolvedEntities.bills.isEmpty {
                chipRow(title: l("app.issue_call.related.bills", "Related bills"), items: viewModel.resolvedEntities.bills)
            }
            if !isMAPCMode, !viewModel.resolvedEntities.committees.isEmpty {
                chipRow(title: l("app.issue_call.related.committees", "Related committees"), items: viewModel.resolvedEntities.committees)
            }
            if !isMAPCMode, !viewModel.resolvedEntities.agencies.isEmpty {
                chipRow(title: l("app.issue_call.related.agencies", "Related agencies"), items: viewModel.resolvedEntities.agencies)
            }
        }
        .padding(isMAPCMode ? 0 : 10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(isMAPCMode ? Color.clear : VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: isMAPCMode ? 0 : 12, style: .continuous))
        .overlay {
            if !isMAPCMode {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
            }
        }
    }

    private var isIssueSummaryDuplicate: Bool {
        let title = viewModel.issueTitle.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let summary = cleanedIssueSummaryForTopCard(viewModel.issueSummary)
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !title.isEmpty, !summary.isEmpty else { return false }
        return title == summary
    }

    private func cleanedIssueSummaryForTopCard(_ text: String) -> String {
        var cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        cleaned = cleaned.replacingOccurrences(
            of: #"^\s*why\s+it\s+matters\s*:?\s*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        cleaned = cleaned.replacingOccurrences(
            of: #"^\s*issue\s+explanation\s*:?\s*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        cleaned = cleaned.replacingOccurrences(
            of: #"^\s*issue\s+summary\s*:?\s*"#,
            with: "",
            options: [.regularExpression, .caseInsensitive]
        )
        return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    @ViewBuilder
    private func repBriefCard(_ brief: CivicCallBrief, condensedForMAPC: Bool = false) -> some View {
        let isActive = viewModel.activeBriefID == brief.id
        let official = viewModel.official(for: brief)
        let displayRepName: String = {
            let officialName = official?.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !officialName.isEmpty { return officialName }
            return brief.repName
        }()
        let displayOfficeType: String = {
            let officialTitle = official?.officeTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !officialTitle.isEmpty { return officialTitle }
            return brief.officeType
        }()
        let primaryCallURL = callURL(primary: brief.primaryPhoneNumber, fallback: official?.officialPhone)
        let shouldShowCallPillOrbit = condensedForMAPC
        let isLastBrief = viewModel.isLastBrief(brief)
        let briefIndex = viewModel.callBriefs.firstIndex(where: { $0.id == brief.id }) ?? 0
        let isFirstBrief = briefIndex == 0
        let isLiveScriptExpanded = expandedLiveBriefIDs.contains(brief.id)
        let isVoicemailExpanded = expandedVoicemailBriefIDs.contains(brief.id)
        let selectedOutcome = viewModel.loggedOutcomeByBriefID[brief.id]
        let liveScriptText = brief.liveScript

        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                IssueCallRepHeadshotView(official: official)
                    .frame(width: 65, height: 65)
                    .clipShape(Circle())
                    .overlay(
                        Circle()
                            .stroke(VoteNowColors.borderWarm.opacity(0.9), lineWidth: 1)
                    )
                    .shadow(color: VoteNowColors.primaryText.opacity(0.06), radius: 2, x: 0, y: 1)

                VStack(alignment: .leading, spacing: 4) {
                    Text(displayRepName)
                        .font(.headline)
                    Text(displayOfficeType)
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
            if let official, let district = official.district {
                Text(district)
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
            }
                }
                .frame(maxWidth: .infinity, alignment: .leading)

            }

            HStack(spacing: 8) {
                Button {
                    guard let url = primaryCallURL else { return }
                    openURL(url) { accepted in
                        guard accepted else {
                            viewModel.errorMessage = l(
                                "app.reps.alert.phone_unavailable.generic",
                                "This device cannot place calls."
                            )
                            return
                        }

                        if callScoreV1Enabled {
                            // Never block dialing on network logging.
                            Task {
                                await viewModel.beginCallLaunch(for: brief, sourceScreen: "issue_call_center")
                            }
                        }
                    }
                } label: {
                    Group {
                        if shouldShowCallPillOrbit {
                            Label(
                                callButtonTitle(for: brief, official: official),
                                systemImage: "phone.fill"
                            )
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(primaryCallURL == nil ? VoteNowColors.mutedText.opacity(0.45) : VoteNowColors.primaryCTA)
                            .clipShape(Capsule(style: .continuous))
                            .voteNowPillDualOrbit(
                                enabled: true,
                                redColor: VoteNowColors.ctaRed.opacity(0.94),
                                blueColor: VoteNowColors.ctaBlue.opacity(0.88),
                                strokeThickness: 2.8,
                                loopDuration: 4.95,
                                glowIntensity: 0.28,
                                idleOpacity: 0.24,
                                borderInset: 0.65,
                                segmentLength: 0.34,
                                separatorThickness: 0.75
                            )
                        } else {
                            Label(
                                callButtonTitle(for: brief, official: official),
                                systemImage: "phone.fill"
                            )
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(primaryCallURL == nil ? VoteNowColors.mutedText.opacity(0.45) : VoteNowColors.primaryCTA)
                            .clipShape(Capsule(style: .continuous))
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(primaryCallURL == nil)
                .accessibilityIdentifier("issue_call.call_button.\(brief.repID)")
            }

            if !condensedForMAPC {
                VStack(alignment: .leading, spacing: 6) {
                    phoneRow(label: l("app.issue_call.phone.primary", "Primary"), phone: brief.primaryPhoneNumber)
                    if let local = brief.localOfficePhoneNumber {
                        phoneRow(label: l("app.issue_call.phone.local", "Local office"), phone: local)
                    }
                }

                chipRow(title: l("app.issue_call.relevance", "Why this rep is relevant"), items: brief.relevanceBadges)

                let related = brief.relatedBills + brief.relatedCommittees
                if !related.isEmpty {
                    chipRow(title: l("app.issue_call.related", "Related bill / committee"), items: related)
                }
            }

            if condensedForMAPC {
                if isLiveScriptExpanded {
                    scriptBlock(
                        title: "Live-call Script",
                        text: liveScriptText,
                        showScriptInputsToggle: false,
                        usesMapcCardChrome: true
                    )
                }
            } else {
                scriptBlock(
                    title: "Live-call Script",
                    text: liveScriptText,
                    showScriptInputsToggle: false
                )
            }
            if condensedForMAPC, isTalkingPointsExpanded, !brief.talkingPoints.isEmpty {
                scriptInputsExpandedBlock(brief.talkingPoints, usesMapcCardChrome: true)
                    .padding(.leading, 8)
            }

            if condensedForMAPC {
                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if isVoicemailExpanded {
                                expandedVoicemailBriefIDs.remove(brief.id)
                                expandedLiveBriefIDs.insert(brief.id)
                            } else {
                                expandedVoicemailBriefIDs.insert(brief.id)
                                expandedLiveBriefIDs.remove(brief.id)
                            }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text("Voicemail Script")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.primaryText)
                            Spacer(minLength: 0)
                            Image(systemName: isVoicemailExpanded ? "chevron.up" : "chevron.down")
                                .font(.caption.weight(.bold))
                                .foregroundColor(VoteNowColors.primaryCTA)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Self.mapcScriptCardBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 9, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)

                    if isVoicemailExpanded {
                        scriptBlock(
                            title: "Voicemail Script",
                            text: brief.voicemailScript,
                            usesMapcCardChrome: true
                        )
                    }
                }
            } else {
                scriptBlock(title: "Voicemail Script", text: brief.voicemailScript)
            }

            outcomeButtons(
                brief,
                selectedOutcome: selectedOutcome,
                isVoicemailLocked: false
            )

            if condensedForMAPC {
                HStack(spacing: 8) {
                    if showsReturnHomeButton || !isFirstBrief {
                        Button {
                            if isFirstBrief {
                                dismiss()
                            } else {
                                beginMAPCCardTransition()
                                mapcForwardSlideTransition = true
                                viewModel.retreatToPreviousRep(before: brief)
                            }
                        } label: {
                            Text(
                                isFirstBrief && showsReturnHomeButton
                                ? l("app.issue_call.action.return_home", "Home")
                                : l("app.issue_call.action.back", "Back")
                            )
                                .font(.headline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .frame(width: 82)
                        .accessibilityIdentifier("issue_call.home_in_mapc")
                    }

                    nextRepButton(for: brief, isLastBrief: isLastBrief)
                }
            } else {
                nextRepButton(for: brief, isLastBrief: isLastBrief)
            }
        }
        .padding(12)
        .id(brief.id)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .shadow(
            color: condensedForMAPC ? VoteNowColors.primaryText.opacity(0.08) : .clear,
            radius: condensedForMAPC ? 6 : 0,
            x: 0,
            y: condensedForMAPC ? 2 : 0
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(
                    condensedForMAPC
                    ? VoteNowColors.borderWarm.opacity(0.5)
                    : (isActive ? VoteNowColors.primaryCTA : VoteNowColors.borderWarm.opacity(0.7)),
                    lineWidth: condensedForMAPC ? 0.9 : 1
                )
        )
    }

    private func nextRepButton(for brief: CivicCallBrief, isLastBrief: Bool) -> some View {
        let canAdvance = viewModel.hasLoggedOutcome(for: brief)

        return Button {
            let mapcGain = mapcSessionLoggedBriefIDs.count
            if isLastBrief {
                withAnimation(mapcCardAnimation) {
                    waterfallController.trigger(reduceMotion: reduceMotion)
                    viewModel.finishScript()
                }
                DispatchQueue.main.asyncAfter(deadline: .now() + 1.05) {
                    withAnimation(.easeInOut(duration: 0.22)) {
                        didCompleteMAPC = true
                        viewModel.selectedTab = .civicScore
                        // Primary review signal: successful MAPC completion.
                        DispatchQueue.main.async {
                            ReviewPromptManager.shared.markMAPCCompleted(
                                isInErrorState: viewModel.errorMessage != nil,
                                isFlowInterrupted: showingShareSheet
                            )
                        }
                        startMAPCCallGainAnimation(gain: mapcGain)
                        mapcSessionLoggedBriefIDs.removeAll()
                    }
                    resetAssistantConversationAfterMAPCCompletion()
                }
            } else {
                beginMAPCCardTransition()
                mapcForwardSlideTransition = true
                viewModel.advanceToNextRep(after: brief)
            }
        } label: {
            HStack {
                Text(isLastBrief ? l("app.issue_call.action.finish_script", "Finish Calling") : l("app.issue_call.action.next_rep", "Call Next Representative"))
                    .font(.headline.weight(.semibold))
                Spacer(minLength: 0)
                Image(systemName: isLastBrief ? "checkmark.circle.fill" : "arrow.right.circle.fill")
                    .font(.system(size: 16, weight: .semibold))
            }
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 12)
            .frame(maxWidth: .infinity)
            .background(
                canAdvance
                ? VoteNowColors.warningAmber
                : VoteNowColors.mutedText.opacity(0.45)
            )
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(!canAdvance)
        .accessibilityIdentifier("issue_call.next_button.\(brief.repID)")
    }

    private var examplesTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if !exampleCategoryOptions.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHGrid(rows: exampleCategoryGridRows, alignment: .top, spacing: 8) {
                            ForEach(visibleExampleCategoryOptions, id: \.self) { category in
                                        let isSelected = category.caseInsensitiveCompare(selectedExampleCategory) == .orderedSame
                                        let categoryColor = exampleCategoryColor(for: category)
                                        let textColor = exampleCategoryTextColor(for: category)
                                        Button {
                                            selectedExampleCategory = category
                                        } label: {
                                            HStack(spacing: 5) {
                                                if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
                                                    Image(systemName: "magnifyingglass")
                                                        .font(.caption2.weight(.bold))
                                                        .foregroundColor(textColor)
                                                }
                                                Text(exampleCategoryDisplayName(for: category))
                                                    .font(.caption.weight(.semibold))
                                                    .foregroundColor(textColor)
                                                    .lineLimit(1)
                                                    .multilineTextAlignment(.center)
                                                    .minimumScaleFactor(0.78)
                                            }
                                                .padding(.horizontal, 12)
                                                .padding(.vertical, 8)
                                                .background(
                                                    ZStack {
                                                        exampleCategoryBackgroundColor(for: category, isSelected: isSelected)
                                                        if isSelected {
                                                            Capsule()
                                                                .fill(Color.white.opacity(0.16))
                                                                .padding(1)
                                                        }
                                                    }
                                                )
                                                .clipShape(Capsule())
                                                .overlay(
                                                    Capsule()
                                                        .stroke(
                                                            exampleCategoryBorderColor(
                                                                for: category,
                                                                isSelected: isSelected,
                                                                baseColor: categoryColor
                                                            ),
                                                            lineWidth: isSelected ? 1.8 : 1
                                                        )
                                                )
                                                .shadow(
                                                    color: isSelected ? categoryColor.opacity(0.36) : .clear,
                                                    radius: isSelected ? 4 : 0,
                                                    x: 0,
                                                    y: 1
                                                )
                                        }
                                        .buttonStyle(.plain)
                            }
                        }
                        .padding(.vertical, 2)
                    }
                    .frame(maxWidth: .infinity, minHeight: exampleCategoryRailHeight, maxHeight: exampleCategoryRailHeight, alignment: .topLeading)
                    .padding(.top, 4)
                }

                if selectedExampleCategory.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
                    HStack(spacing: 8) {
                        Image(systemName: "magnifyingglass")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.mutedText)
                        TextField(
                            l("app.issue_call.examples.search_placeholder", "Search premade scripts"),
                            text: $exampleSearchQuery
                        )
                        .textInputAutocapitalization(.sentences)
                        .disableAutocorrection(false)
                        .font(.subheadline)
                        .accessibilityIdentifier("issue_call.examples.search_input")
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 10)
                    .background(VoteNowColors.surfaceWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
                    )
                }

                if viewModel.examples.isEmpty {
                    Text(l("app.issue_call.examples.empty", "No example cards are available right now."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                } else if filteredExamples.isEmpty {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(l("app.issue_call.examples.empty_for_category", "No examples match this category yet."))
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)

                        if selectedExampleCategory.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
                            Button {
                                let query = exampleSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
                                transitionToAssistantFromPremade(prefillConcern: query)
                            } label: {
                                Text(l("app.issue_call.examples.build_script", "Build this script"))
                                    .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                                .voteNowPillDualOrbit(
                                    redColor: VoteNowColors.ctaRed.opacity(0.94),
                                    blueColor: VoteNowColors.ctaBlue.opacity(0.88),
                                    strokeThickness: 2.4,
                                    loopDuration: 4.9,
                                    glowIntensity: 0.24,
                                    idleOpacity: 0.2,
                                    borderInset: 0.6,
                                    segmentLength: 0.36,
                                    separatorThickness: 0.7,
                                    pathStyle: .roundedRect(cornerRadius: 10)
                                )
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("issue_call.examples.build_from_search")
                        }
                    }
                }

                ForEach(visiblePremadeExamples) { example in
                    VStack(alignment: .leading, spacing: 8) {
                        VStack(alignment: .leading, spacing: 6) {
                            HStack(alignment: .firstTextBaseline, spacing: 8) {
                                Text(example.title)
                                    .font(.headline)
                                    .foregroundColor(.white)
                                    .lineLimit(2)
                                    .fixedSize(horizontal: false, vertical: true)

                                Spacer(minLength: 6)
                            }
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(exampleCategoryColor(for: example.category ?? Self.allExamplesFilterLabel))
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))

                        HStack(spacing: 8) {
                            if let category = example.category, !category.isEmpty {
                                let categoryColor = exampleCategoryColor(for: category)
                                Text(category)
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(categoryColor)
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .stroke(categoryColor.opacity(0.85), lineWidth: 1)
                                    )
                            }
                            Spacer(minLength: 0)

                            Text("UPDATED: \(premadeUpdatedDate(for: example))")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.white.opacity(0.96))
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(exampleCategoryColor(for: example.category ?? Self.allExamplesFilterLabel))
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.white.opacity(0.72), lineWidth: 1)
                                )
                        }

                        emphasizedPromptText(example.summary, baseFont: .subheadline)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)

                        if let actionSentence = premadeOptionalDisplayText(example.actionSentence) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("Action request")
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(VoteNowColors.mutedText)
                                emphasizedPromptText(actionSentence, baseFont: .subheadline)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .fixedSize(horizontal: false, vertical: true)
                            }
                        }

                        Button {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                if expandedPremadeLiveScriptIDs.contains(example.id) {
                                    expandedPremadeLiveScriptIDs.remove(example.id)
                                } else {
                                    expandedPremadeLiveScriptIDs.insert(example.id)
                                }
                            }
                        } label: {
                            HStack(spacing: 8) {
                                Text("Live-call Script")
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(VoteNowColors.primaryText)
                                Spacer(minLength: 0)
                                Image(systemName: expandedPremadeLiveScriptIDs.contains(example.id) ? "chevron.up" : "chevron.down")
                                    .font(.caption.weight(.bold))
                                    .foregroundColor(VoteNowColors.primaryCTA)
                            }
                            .padding(.horizontal, 10)
                            .padding(.vertical, 8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(VoteNowColors.infoSurfaceBlue)
                            .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                        }
                        .buttonStyle(.plain)

                        if expandedPremadeLiveScriptIDs.contains(example.id) {
                            exampleScriptBlock(
                                title: "Live-call Script",
                                text: condensedPremadeScriptPlaceholderText(example.liveScript)
                            )
                        }

                        Button {
                            focusedField = nil
                            didCompleteMAPC = false
                            isTalkingPointsExpanded = false
                            withAnimation(.easeInOut(duration: 0.28)) {
                                viewModel.startMAPC(from: example)
                            }
                        } label: {
                            Text(l("app.issue_call.examples.use_for_mapc", "Use this Call Script"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 10)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                        }
                        .buttonStyle(.plain)
                        .disabled(viewModel.isSubmitting)
                    }
                    .padding(12)
                    .background(VoteNowColors.surfaceWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
                    )
                    .transition(.move(edge: .top).combined(with: .opacity))
                }

                if hasHiddenPremadeExamples {
                    Button {
                        withAnimation(.easeInOut(duration: 0.24)) {
                            showAllPremadeExamples.toggle()
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text(showAllPremadeExamples ? "Show less" : "More...")
                                .font(.subheadline.weight(.semibold))
                            Spacer(minLength: 0)
                            Image(systemName: showAllPremadeExamples ? "chevron.up" : "chevron.down")
                                .font(.caption.weight(.semibold))
                        }
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("issue_call.examples.toggle_more")
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 20)
        }
        .refreshable {
            await refreshPremadeExamples()
        }
    }

    private func refreshPremadeExamples() async {
        await viewModel.loadExamplesAndHistoryIfNeeded(force: true)
    }

    private func transitionToAssistantFromPremade(prefillConcern: String?) {
        focusedField = nil
        didCompleteMAPC = false
        if let prefillConcern {
            let query = prefillConcern.trimmingCharacters(in: .whitespacesAndNewlines)
            if !query.isEmpty {
                viewModel.concernText = query
            }
        }
        withAnimation(.interactiveSpring(response: 0.36, dampingFraction: 0.9, blendDuration: 0.2)) {
            viewModel.selectedTab = .assistant
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.24) {
            focusedField = .concern
        }
    }

    private var civicScoreTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                if viewModel.lastCompletionResult != nil {
                    completionFeedbackCard
                }
                civicScoreSummaryCard
                historyTrackerSection
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
    }

    private var rulesTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("How calling works")
                        .font(.headline)
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("1. Keep your issue specific so the script is clear and actionable.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("2. Include a concrete congressional action (support, oppose, fund, vote, or oversight).")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("3. Add a bill, program, or agency when possible to improve personalization.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.primaryText)
                    Text("4. Use the generated script as a guide, then personalize your opening line and local impact.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.primaryText)
                }
                .padding(12)
                .background(VoteNowColors.surfaceWhite)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
                )
            }
            .padding(.horizontal, 16)
            .padding(.bottom, 20)
        }
    }

    private var civicScoreSummaryCard: some View {
        let stats = viewModel.callStats
        let outcomeBreakdown = viewModel.outcomeBreakdown
        let displayedTotalCalls = max(stats.totalVoteNowCalls, animatedTotalVoteNowCalls ?? 0)
        let displayedUserCalls = max(stats.userCallCount, animatedUserCallCount ?? 0)
        let showGainBadge = showMapcCallGainBadge && animatedMapcCallGain > 0
        let contactedCountText = outcomeBreakdown.contacted.formatted(.number)
        let voicemailCountText = outcomeBreakdown.voicemail.formatted(.number)
        let unavailableCountText = outcomeBreakdown.unavailable.formatted(.number)
        let outcomeSummaryLine = "\(contactedCountText) Contacted, \(voicemailCountText) Voicemail, \(unavailableCountText) Unavailable"

        return VStack(alignment: .leading, spacing: 12) {
            civicScoreHeadline(
                displayedUserCalls: displayedUserCalls,
                showGainBadge: showGainBadge,
                gain: animatedMapcCallGain
            )

            Divider()

            Text(outcomeSummaryLine)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.8)

            Text("\(displayedTotalCalls.formatted(.number)) \(l("app.issue_call.score.stats.community_calls", "Community calls"))")
                .font(.caption)
                .foregroundColor(VoteNowColors.mutedText)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func civicScoreHeadline(
        displayedUserCalls: Int,
        showGainBadge: Bool,
        gain: Int
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 10) {
                Text("\(displayedUserCalls.formatted(.number)) \(l("app.issue_call.score.stats.your_calls", "Your calls"))")
                    .font(.system(size: 36, weight: .bold, design: .rounded))
                    .foregroundColor(VoteNowColors.primaryCTA)

                if showGainBadge {
                    Text("+\(gain)")
                        .font(.title3.weight(.bold))
                        .foregroundColor(VoteNowColors.successGreen)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.easeInOut(duration: 0.2), value: showGainBadge)
            .frame(maxWidth: .infinity, alignment: .leading)

            if showGainBadge {
                Text("+\(gain) calls completed")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.successGreen)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private func scoreStatLine(label: String, value: Int) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: 10) {
            Text(value.formatted(.number))
                .font(.title3.weight(.bold))
                .foregroundColor(VoteNowColors.primaryCTA)
            Text(label)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
        }
    }

    @ViewBuilder
    private var completionFeedbackCard: some View {
        if let result = viewModel.lastCompletionResult {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Text(l("app.issue_call.completion.logged", "Call logged"))
                        .font(.headline)
                    Spacer()
                    Button(l("app.issue_call.alert.dismiss", "Dismiss")) {
                        viewModel.clearCompletionResult()
                    }
                    .font(.caption.weight(.semibold))
                }

                if result.scoringEligible == true, let snapshot = result.callScoreSnapshot {
                    Text(l("app.issue_call.completion.new_score", "New call score: \(snapshot.callScore)"))
                        .font(.subheadline.weight(.semibold))

                    if result.baselineCrossed {
                        Text(l("app.issue_call.completion.baseline", "You crossed the baseline"))
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.successGreen)
                    }

                    if !result.changedComponents.isEmpty {
                        Text(l("app.issue_call.completion.changed", "Updated components:"))
                            .font(.caption.weight(.semibold))
                        Text(
                            result.changedComponents
                                .map { viewModel.componentDisplayName(for: $0) }
                                .joined(separator: ", ")
                        )
                        .font(.caption)
                        .foregroundColor(VoteNowColors.mutedText)
                    }
                } else {
                    Text(l("app.issue_call.completion.no_change", "No score change"))
                        .font(.subheadline.weight(.semibold))
                    Text(
                        result.scoringIneligibilityReason
                        ?? l("app.issue_call.completion.duplicate_default", "A recent duplicate call was logged, so score and leaderboard counts did not change.")
                    )
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VoteNowColors.surfaceWhite)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
            )
        }
    }

    private var historyTrackerSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.issue_call.tracker.title.calls_to_my_reps", "Recent call history"))
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .center)

            if trackerGroups.isEmpty {
                Text(l("app.issue_call.history.empty", "Your call history will appear here after you generate and log call briefs."))
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
            } else {
                ForEach(trackerGroups.prefix(4)) { group in
                    let outcomeRows = trackerOutcomeRows(for: group)
                    let persistedCompletedCalls = trackerPersistedCompletedCalls(for: group)
                    let optimisticGain = trackerOptimisticGain(
                        for: group,
                        persistedCompletedCalls: persistedCompletedCalls
                    )
                    let displayedCompletedCalls = persistedCompletedCalls + optimisticGain
                    let displayIssueTitle = trackerDisplayIssueTitle(for: group)

                    VStack(alignment: .leading, spacing: 8) {
                        Text(displayIssueTitle)
                            .font(.headline)
                            .lineLimit(2)
                            .minimumScaleFactor(0.9)

                        HStack(alignment: .center, spacing: 10) {
                            Text(group.date.formatted(date: .abbreviated, time: .shortened))
                                .font(.caption)
                                .foregroundColor(VoteNowColors.mutedText)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 5)
                                .background(VoteNowColors.infoSurfaceBlue)
                                .clipShape(Capsule())

                            Spacer(minLength: 0)

                            Text(
                                trackerProgressSummaryText(
                                    completedCalls: displayedCompletedCalls,
                                    optimisticGain: optimisticGain
                                )
                            )
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                        }

                        trackerIssueProgressBar(completedCalls: displayedCompletedCalls)

                        if !outcomeRows.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(l("app.issue_call.history.outcomes", "Recent outcomes"))
                                    .font(.subheadline.weight(.semibold))

                                HStack(spacing: 6) {
                                    ForEach(outcomeRows) { row in
                                        VStack(alignment: .center, spacing: 2) {
                                            Text(trackerDisplayLastName(from: row.repName))
                                                .font(.caption.weight(.semibold))
                                                .foregroundColor(VoteNowColors.primaryText)
                                                .lineLimit(1)
                                                .multilineTextAlignment(.center)
                                            Text(row.outcome.title)
                                                .font(.caption2)
                                                .foregroundColor(outcomeColor(for: row.outcome))
                                                .lineLimit(1)
                                                .multilineTextAlignment(.center)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .center)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 5)
                                        .background(outcomeHistoryBackground(for: row.outcome))
                                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 8, style: .continuous)
                                                .stroke(outcomeColor(for: row.outcome).opacity(0.42), lineWidth: 1)
                                        )
                                    }
                                }
                            }
                        }

                        Button {
                            didCompleteMAPC = false
                            mapcSessionLoggedBriefIDs.removeAll()
                            mapcOptimisticIssueGains.removeAll()
                            viewModel.reopen(historyGroup: group.representativeGroup)
                        } label: {
                            Text(l("app.issue_call.history.reopen", "Call again"))
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 8)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(VoteNowColors.surfaceWhite)
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
                    )
                }
            }
        }
    }

    private var trackerGroups: [TrackerIssueGroup] {
        let sortedGroups = viewModel.historyGroups.sorted { $0.date > $1.date }
        var order: [String] = []
        var buckets: [String: (representative: CivicHistoryGroup, briefs: [CivicCallBrief], logs: [CivicCallLogRecord])] = [:]

        for group in sortedGroups {
            let key = trackerIssueKey(for: group)
            if var existing = buckets[key] {
                existing.briefs.append(contentsOf: group.briefs)
                existing.logs.append(contentsOf: group.logs)
                buckets[key] = existing
            } else {
                order.append(key)
                buckets[key] = (group, group.briefs, group.logs)
            }
        }

        return order.compactMap { key in
            guard let bucket = buckets[key] else { return nil }
            var seenRepKeys = Set<String>()
            let dedupedBriefs = bucket.briefs.filter { brief in
                let repKey = trackerRepKey(repID: brief.repID, repName: brief.repName)
                return seenRepKeys.insert(repKey).inserted
            }

            return TrackerIssueGroup(
                id: key,
                representativeGroup: bucket.representative,
                issueTitle: bucket.representative.issueTitle,
                issueSummary: bucket.representative.issueSummary,
                date: bucket.representative.date,
                briefs: dedupedBriefs,
                logs: bucket.logs
            )
        }
    }

    private func trackerOutcomeRows(for group: TrackerIssueGroup) -> [TrackerOutcomeRow] {
        let currentRepKeys = trackerCurrentRepKeys
        let sortedLogs = group.logs
            .sorted { $0.createdAt > $1.createdAt }
            .filter { log in
                let repKey = trackerRepKey(repID: log.repID, repName: log.repName)
                return currentRepKeys.isEmpty || currentRepKeys.contains(repKey)
            }
        var latestByRep: [String: CivicCallLogRecord] = [:]
        for log in sortedLogs {
            let repKey = trackerRepKey(repID: log.repID, repName: log.repName)
            if latestByRep[repKey] == nil {
                latestByRep[repKey] = log
            }
        }

        var orderedRows: [TrackerOutcomeRow] = []
        var seenRepKeys = Set<String>()

        for brief in group.briefs {
            let repKey = trackerRepKey(repID: brief.repID, repName: brief.repName)
            guard currentRepKeys.isEmpty || currentRepKeys.contains(repKey) else { continue }
            guard seenRepKeys.insert(repKey).inserted else { continue }
            guard let log = latestByRep[repKey] else { continue }
            orderedRows.append(
                TrackerOutcomeRow(id: repKey, repName: log.repName, outcome: log.outcome)
            )
        }

        for log in sortedLogs {
            let repKey = trackerRepKey(repID: log.repID, repName: log.repName)
            guard seenRepKeys.insert(repKey).inserted else { continue }
            orderedRows.append(
                TrackerOutcomeRow(id: repKey, repName: log.repName, outcome: log.outcome)
            )
        }

        return Array(orderedRows.prefix(3))
    }

    private var trackerCurrentRepKeys: Set<String> {
        Set(viewModel.repTargets.map { target in
            trackerRepKey(
                repID: stableRepID(for: target.official),
                repName: target.official.name
            )
        })
    }

    private func trackerIssueProgressBar(completedCalls: Int) -> some View {
        let safeGoal = max(1, trackerProgressGoalCalls)
        let safeCompleted = max(0, completedCalls)
        let progress = min(Double(safeCompleted) / Double(safeGoal), 1)

        return GeometryReader { geometry in
            let filledWidth = geometry.size.width * progress

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(VoteNowColors.infoSurfaceBlue)

                Capsule()
                    .fill(VoteNowColors.primaryCTA)
                    .frame(width: filledWidth)
            }
            .overlay(
                Capsule()
                    .stroke(VoteNowColors.borderWarm.opacity(0.5), lineWidth: 0.7)
            )
        }
        .frame(maxWidth: .infinity)
        .frame(height: 10)
        .accessibilityLabel("Issue call progress \(min(safeCompleted, safeGoal)) of \(safeGoal)")
    }

    private func trackerPersistedCompletedCalls(for group: TrackerIssueGroup) -> Int {
        if let perIssueCount = viewModel.appWideCompletedCalls(forIssueID: group.representativeGroup.issueID) {
            return perIssueCount
        }

        let normalizedIssueID = group.representativeGroup.issueID
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if normalizedIssueID.isEmpty {
            return viewModel.callStats.totalVoteNowCalls
        }
        return 0
    }

    private func trackerOptimisticGain(for group: TrackerIssueGroup, persistedCompletedCalls: Int) -> Int {
        guard let issueKey = normalizedIssueKey(group.representativeGroup.issueID),
              let gainState = mapcOptimisticIssueGains[issueKey] else {
            return 0
        }
        let target = gainState.baseline + gainState.gain
        return max(0, target - max(0, persistedCompletedCalls))
    }

    private func trackerProgressSummaryText(completedCalls: Int, optimisticGain: Int) -> String {
        let safeGoal = max(1, trackerProgressGoalCalls)
        let safeCompleted = max(0, completedCalls)
        let completedText: String
        if safeCompleted >= safeGoal {
            completedText = "\(safeGoal.formatted(.number))+"
        } else {
            completedText = safeCompleted.formatted(.number)
        }
        if optimisticGain > 0 {
            return "\(completedText) / \(safeGoal.formatted(.number)) calls (+\(optimisticGain))"
        }
        return "\(completedText) / \(safeGoal.formatted(.number)) calls"
    }

    private var trackerProgressGoalCalls: Int { 1_000 }

    private func trackerIssueKey(for group: CivicHistoryGroup) -> String {
        let normalizedIssueID = group.issueID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedIssueID.isEmpty {
            return normalizedIssueID
        }

        let normalizedTitle = group.issueTitle
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return normalizedTitle
    }

    private func trackerRepKey(repID: String, repName: String) -> String {
        let normalizedRepID = repID.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedRepID.isEmpty {
            return normalizedRepID
        }
        return repName.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func trackerDisplayLastName(from fullName: String) -> String {
        let components = fullName
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(separator: " ")
            .map(String.init)

        guard !components.isEmpty else {
            return fullName
        }

        if components.count >= 3 {
            let suffixes = Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"])
            let lastRaw = components[components.count - 1]
            let secondLastRaw = components[components.count - 2]

            let cleanedLast = lastRaw.trimmingCharacters(in: CharacterSet(charactersIn: ",."))
            let cleanedSecond = secondLastRaw.trimmingCharacters(in: CharacterSet(charactersIn: ",."))
            let normalizedLast = cleanedLast.lowercased()
            let secondLooksLikeMiddleInitial = cleanedSecond.count <= 2 || cleanedSecond.hasSuffix(".")

            if !suffixes.contains(normalizedLast), !secondLooksLikeMiddleInitial, !cleanedSecond.isEmpty {
                return "\(cleanedSecond) \(cleanedLast)"
            }
        }

        let fallback = components.last?.trimmingCharacters(in: CharacterSet(charactersIn: ",.")) ?? fullName
        return fallback.isEmpty ? fullName : fallback
    }

    private func trackerDisplayIssueTitle(for group: TrackerIssueGroup) -> String {
        let rawTitle = group.issueTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let slugTitle = trackerIssueTitleFromIssueID(group.representativeGroup.issueID)

        if rawTitle.isEmpty {
            return slugTitle ?? l("app.issue_call.history.issue_default", "Issue call")
        }

        if trackerLooksLikeSummaryText(rawTitle), let slugTitle {
            return slugTitle
        }

        return rawTitle
    }

    private func shareHeadlineText() -> String {
        let preferred = mapcIssueHeadline.trimmingCharacters(in: .whitespacesAndNewlines)
        if !preferred.isEmpty, preferred.caseInsensitiveCompare(l("app.issue_call.issue.default", "Issue")) != .orderedSame {
            return preferred
        }

        let concern = viewModel.concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !concern.isEmpty {
            return conciseIssueHeadline(concern)
        }

        return l("app.issue_call.title", "Call Your Reps")
    }

    private var shareActionButton: some View {
        Button {
            shareCurrentCivicCard()
        } label: {
            Image(systemName: "square.and.arrow.up")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryCTA)
                .frame(width: 34, height: 34)
                .background(VoteNowColors.surfaceWhite)
                .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(VoteNowColors.primaryCTA.opacity(0.4), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("issue_call.share")
    }

    private func shareCurrentCivicCard() {
        let issueHeadline = shareHeadlineText()
        guard !issueHeadline.isEmpty else { return }

        let summary = viewModel.issueSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        let subtitle = summary.isEmpty
            ? l(
                "app.issue_call.share.subtitle.default",
                "VoteNow gives you a script, contact details, and call steps so you can act in minutes."
            )
            : summary

        var details: [URLQueryItem] = [
            URLQueryItem(name: "issue", value: issueHeadline),
            URLQueryItem(name: "calls", value: String(viewModel.callStats.totalVoteNowCalls))
        ]
        if let issueID = viewModel.activeBrief?.issueID, !issueID.isEmpty {
            details.append(URLQueryItem(name: "issue_id", value: issueID))
        }

        let payload = VoteNowShareCardPayload(
            cardType: .civic,
            target: .civic,
            title: "Take Action: \(issueHeadline)",
            subtitle: subtitle,
            cta: l("app.issue_call.share.cta", "Take Action"),
            badge: l("app.issue_call.share.badge", "Script Ready"),
            campaign: "send-to-friend",
            details: details
        )

        shareItems = VoteNowShareComposer.activityItems(for: payload)
        showingShareSheet = true
    }

    private func trackerLooksLikeSummaryText(_ text: String) -> Bool {
        let cleaned = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let lower = cleaned.lowercased()
        let wordCount = cleaned.split(whereSeparator: \.isWhitespace).count

        if cleaned.contains(".") || cleaned.contains(":") { return true }
        if wordCount >= 9 { return true }
        if lower.hasPrefix("this issue")
            || lower.hasPrefix("recent ")
            || lower.contains("i'm calling")
            || lower.contains("i am calling")
            || lower.contains("please ")
        {
            return true
        }

        return false
    }

    private func normalizedIssueKey(_ issueID: String) -> String? {
        let normalized = issueID
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        return normalized.isEmpty ? nil : normalized
    }

    private func noteOptimisticIssueGain(for issueID: String) {
        guard let issueKey = normalizedIssueKey(issueID) else { return }
        let baseline = max(0, viewModel.appWideCompletedCalls(forIssueID: issueID) ?? 0)
        if var existing = mapcOptimisticIssueGains[issueKey] {
            existing.gain += 1
            mapcOptimisticIssueGains[issueKey] = existing
        } else {
            mapcOptimisticIssueGains[issueKey] = MAPCIssueGainState(baseline: baseline, gain: 1)
        }
    }

    private func pruneResolvedOptimisticIssueGains() {
        mapcOptimisticIssueGains = mapcOptimisticIssueGains.filter { issueKey, gainState in
            let persisted = max(0, viewModel.appWideCompletedCalls(forIssueID: issueKey) ?? 0)
            return persisted < (gainState.baseline + gainState.gain)
        }
    }

    private func trackerIssueTitleFromIssueID(_ issueID: String) -> String? {
        let raw = issueID.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return nil }

        let candidate = raw.split(separator: "/").last.map(String.init) ?? raw
        let uuidCharset = CharacterSet(charactersIn: "0123456789abcdef-")
        let lowerCandidate = candidate.lowercased()
        if lowerCandidate.unicodeScalars.allSatisfy({ uuidCharset.contains($0) }), lowerCandidate.count >= 32 {
            return nil
        }

        let normalized = candidate
            .replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        guard !normalized.isEmpty else { return nil }
        return normalized.capitalized
    }

    private var mapcIssueHeadline: String {
        let rawTitle = viewModel.issueTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !rawTitle.isEmpty, !trackerLooksLikeSummaryText(rawTitle) {
            return normalizedMAPCIssueHeadline(rawTitle)
        }

        if let issueID = viewModel.activeBrief?.issueID,
           let fromIssueID = trackerIssueTitleFromIssueID(issueID) {
            return normalizedMAPCIssueHeadline(fromIssueID)
        }

        let concern = viewModel.concernText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !concern.isEmpty {
            return normalizedMAPCIssueHeadline(concern)
        }

        if !rawTitle.isEmpty {
            return normalizedMAPCIssueHeadline(rawTitle)
        }

        let summary = viewModel.issueSummary.trimmingCharacters(in: .whitespacesAndNewlines)
        if !summary.isEmpty {
            return normalizedMAPCIssueHeadline(summary)
        }

        return l("app.issue_call.issue.default", "Issue")
    }

    private func normalizedMAPCIssueHeadline(_ text: String) -> String {
        var value = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)

        let prefixRewrites: [(prefix: String, replacement: String)] = [
            ("this issue asks members of congress to ", "Ask Congress to "),
            ("this issue asks congress to ", "Ask Congress to "),
            ("this issue asks lawmakers to ", "Ask lawmakers to "),
            ("this issue asks senators to ", "Ask senators to "),
            ("this issue asks ", "Ask "),
            ("recent military escalation has renewed pressure on congress to ", "Ask Congress to ")
        ]

        for rewrite in prefixRewrites {
            if value.lowercased().hasPrefix(rewrite.prefix) {
                value = rewrite.replacement + value.dropFirst(rewrite.prefix.count)
                break
            }
        }

        if let firstSentence = value
            .split(whereSeparator: { $0 == "." || $0 == "!" || $0 == "?" })
            .first
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines),
           !firstSentence.isEmpty
        {
            value = firstSentence
        }

        value = conciseIssueHeadline(value, maxWords: 10)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        while let last = value.last, [",", ";", ":"].contains(last) {
            value.removeLast()
            value = value.trimmingCharacters(in: .whitespacesAndNewlines)
        }

        guard !value.isEmpty else { return l("app.issue_call.issue.default", "Issue") }
        let first = value.prefix(1).uppercased()
        let remainder = value.dropFirst()
        return first + remainder
    }

    private func conciseIssueHeadline(_ text: String, maxWords: Int = 8) -> String {
        let firstSentence = text
            .split(whereSeparator: { $0 == "." || $0 == "!" || $0 == "?" })
            .first
            .map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? text

        let words = firstSentence
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)

        guard words.count > maxWords else { return firstSentence }

        var trimmed = Array(words.prefix(maxWords))
        let trailingStopWords = Set(["to", "for", "of", "on", "in", "at", "with", "and", "or"])
        while let last = trimmed.last, trailingStopWords.contains(last.lowercased()), trimmed.count > 1 {
            trimmed.removeLast()
        }

        return trimmed.joined(separator: " ")
    }

    private func resetAssistantConversationAfterMAPCCompletion() {
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            viewModel.mapcV3SessionState = "new"
            viewModel.mapcV3IntroShown = false
            viewModel.resetScriptChatSession()
            let hasPriorAssistantTurns = viewModel.hasScriptChatHistory
                || assistantMessages.contains(where: { $0.role == .assistant })
            guard viewModel.mapcV3SessionState == "new", !viewModel.mapcV3IntroShown, !hasPriorAssistantTurns else { return }
        }
        let introMessage = AssistantChatMessage.assistant(Self.assistantIntroText)
        assistantMessages = [introMessage]
        assistantComposerText = ""
        assistantIsThinking = false
        assistantFlowStage = .awaitingPrompt
        hasPostedCurrentDraftBackground = false
        pendingBackgroundMessageID = nil
        isBackgroundMessageReadyForActions = false
        pendingScriptPreviewMessageID = nil
        isScriptPreviewReadyForMAPCActions = false
        currentBackgroundDiscussionOptions = []
        hasPickedDiscussionOptionInCurrentCycle = false
        suppressTranslationForNextBackground = false
        animatedAssistantMessageIDs = [introMessage.id]
        if viewModel.mapcPipelineV3Enabled {
            // mapc_pipeline_v3 — remove flag check after rollout confirmed
            viewModel.markMAPCV3IntroShown()
        } else {
            viewModel.resetScriptChatSession()
        }
    }

    private func appendAssistantUserMessage(_ text: String, messageType: String) {
        assistantMessages.append(.user(text))
        viewModel.logScriptChatTurn(role: "user", messageText: text, messageType: messageType)
    }

    private func appendAssistantBotMessage(
        _ text: String,
        kind: AssistantChatMessage.MessageKind = .plain,
        messageType: String
    ) {
        assistantMessages.append(.assistant(text, kind: kind))
        viewModel.logScriptChatTurn(role: "assistant", messageText: text, messageType: messageType)
    }

    @ViewBuilder
    private func scriptBlock(
        title: String,
        text: String,
        showScriptInputsToggle: Bool = false,
        showTitle: Bool = true,
        textLineLimit: Int? = nil,
        usesMapcCardChrome: Bool = false
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if showTitle || showScriptInputsToggle {
                ZStack {
                    if showTitle {
                        Text(title)
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity, alignment: .center)
                            .multilineTextAlignment(.center)
                    }
                    if showScriptInputsToggle {
                        HStack {
                            Spacer(minLength: 0)
                            scriptInputsToggleButton
                        }
                    }
                }
            }
            emphasizedPromptText(text, baseFont: .footnote)
                .foregroundColor(VoteNowColors.primaryText)
                .lineLimit(textLineLimit)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(usesMapcCardChrome ? Self.mapcScriptCardBackground : VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay {
            if usesMapcCardChrome {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private func scriptInputsExpandedBlock(_ talkingPoints: [String], usesMapcCardChrome: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(l("app.issue_call.script.inputs", "Script inputs"))
                .font(.subheadline.weight(.semibold))
            VStack(alignment: .leading, spacing: 4) {
                ForEach(Array(talkingPoints.enumerated()), id: \.offset) { _, point in
                    Text("• \(point)")
                        .font(.caption)
                        .foregroundColor(VoteNowColors.primaryText)
                }
            }
            .padding(.top, 2)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(usesMapcCardChrome ? Self.mapcScriptCardBackground : VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay {
            if usesMapcCardChrome {
                RoundedRectangle(cornerRadius: 9, style: .continuous)
                    .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
            }
        }
    }

    @ViewBuilder
    private func exampleScriptBlock(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .frame(maxWidth: .infinity, alignment: .center)
                .multilineTextAlignment(.center)
            emphasizedPromptText(text, baseFont: .footnote)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }

    private func emphasizedPromptText(_ text: String, baseFont: Font) -> Text {
        guard let regex = try? NSRegularExpression(pattern: #"\[[^\[\]]+\]"#) else {
            return Text(text).font(baseFont.weight(.bold))
        }

        let nsRange = NSRange(text.startIndex..<text.endIndex, in: text)
        let matches = regex.matches(in: text, options: [], range: nsRange)
        if matches.isEmpty {
            return Text(text).font(baseFont.weight(.bold))
        }

        var composed = Text("")
        var cursor = text.startIndex

        for match in matches {
            guard let matchRange = Range(match.range, in: text) else { continue }

            if cursor < matchRange.lowerBound {
                let prefix = String(text[cursor..<matchRange.lowerBound])
                composed = composed + Text(prefix).font(baseFont.weight(.bold))
            }

            let token = String(text[matchRange])
            composed = composed + Text(token).font(baseFont)
            cursor = matchRange.upperBound
        }

        if cursor < text.endIndex {
            let suffix = String(text[cursor..<text.endIndex])
            composed = composed + Text(suffix).font(baseFont.weight(.bold))
        }

        return composed
    }

    @ViewBuilder
    private func phoneRow(label: String, phone: String) -> some View {
        HStack {
            Text("\(label):")
                .font(.caption.weight(.semibold))
            if let telURL = URL(string: "tel:\(phone.filter(\.isNumber))"), !phone.filter(\.isNumber).isEmpty {
                Link(phone, destination: telURL)
                    .font(.caption)
                    .foregroundColor(VoteNowColors.primaryCTA)
            } else {
                Text(phone)
                    .font(.caption)
            }
        }
    }

    private func callURL(primary: String, fallback: String?) -> URL? {
        let primaryDigits = primary.filter(\.isNumber)
        if !primaryDigits.isEmpty {
            return URL(string: "tel:\(primaryDigits)")
        }
        let fallbackDigits = (fallback ?? "").filter(\.isNumber)
        if !fallbackDigits.isEmpty {
            return URL(string: "tel:\(fallbackDigits)")
        }
        return nil
    }

    @ViewBuilder
    private func chipRow(title: String, items: [String]) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.caption.weight(.semibold))
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(items, id: \.self) { item in
                            Text(item)
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(VoteNowColors.infoSurfaceBlue)
                                .clipShape(Capsule())
                        }
                    }
                }
            }
        }
    }

    private func outcomeButtons(
        _ brief: CivicCallBrief,
        selectedOutcome: CivicCallOutcome?,
        isVoicemailLocked: Bool
    ) -> some View {
        let selectableOutcomes: [CivicCallOutcome] = [
            .undecided,
            .voicemail,
            .supportive,
            .opposed,
        ]

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(logOutcomeTitle(for: brief))
                    .font(.subheadline.weight(.semibold))
                Spacer(minLength: 0)
                if isVoicemailLocked {
                    Text("Log Outcome: Voicemail")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.gray.opacity(0.9))
                        .clipShape(Capsule())
                }
            }
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], spacing: 8) {
                ForEach(selectableOutcomes) { outcome in
                    Button {
                        guard !isVoicemailLocked else { return }
                        if outcome == .voicemail {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                expandedVoicemailBriefIDs.insert(brief.id)
                                expandedLiveBriefIDs.remove(brief.id)
                            }
                        }
                        if isMAPCMode {
                            let inserted = mapcSessionLoggedBriefIDs.insert(brief.id).inserted
                            if inserted {
                                noteOptimisticIssueGain(for: brief.issueID)
                            }
                        }
                        Task {
                            await viewModel.logOutcome(for: brief, outcome: outcome)
                        }
                    } label: {
                        Text(outcomeDisplayTitle(for: outcome))
                            .font(.body.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedOutcome == outcome
                                ? outcomeColor(for: outcome)
                                : VoteNowColors.primaryCTA
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm.opacity(0.95), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                    .disabled(isVoicemailLocked)
                }
            }
            .opacity(isVoicemailLocked ? 0.34 : 1.0)
        }
    }

    private func outcomeDisplayTitle(for outcome: CivicCallOutcome) -> String {
        switch outcome {
        case .undecided:
            return "Connected"
        case .voicemail:
            return "Voicemail"
        default:
            return outcome.title
        }
    }

    private func logOutcomeTitle(for brief: CivicCallBrief) -> String {
        let member = memberTitleAndLastName(for: brief)
        guard !member.isEmpty else {
            return l("app.issue_call.outcomes", "Log outcome")
        }
        return "\(member)\(possessiveSuffix(for: member)) response"
    }

    private func memberTitleAndLastName(for brief: CivicCallBrief) -> String {
        let lastName = trackerDisplayLastName(from: brief.repName.trimmingCharacters(in: .whitespacesAndNewlines))
        let office = brief.officeType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        if office.contains("senator") {
            return "Senator \(lastName)"
        }
        if office.contains("representative") || office.contains("house") || brief.repSlot == .house {
            return "Representative \(lastName)"
        }
        if office.contains("governor") {
            return "Governor \(lastName)"
        }
        if office.contains("mayor") {
            return "Mayor \(lastName)"
        }
        return lastName
    }

    private func possessiveSuffix(for value: String) -> String {
        value.lowercased().hasSuffix("s") ? "'" : "'s"
    }

    private func outcomeColor(for outcome: CivicCallOutcome) -> Color {
        switch outcome {
        case .undecided, .stafferReached:
            // Connected / reached should be visually distinct from the default blue CTA fill.
            return VoteNowColors.warningAmber
        case .voicemail:
            // Neutral status (neither positive nor negative).
            return VoteNowColors.mutedText
        case .unavailable:
            // Explicit muted gray for unreachable outcomes.
            return Color.gray
        case .followUpRequested:
            // Attention-needed status.
            return VoteNowColors.warningAmber
        case .supportive:
            return VoteNowColors.successGreen
        case .opposed:
            return VoteNowColors.urgentCTA
        case .other:
            return VoteNowColors.mutedText
        }
    }

    private func callButtonTitle(for brief: CivicCallBrief, official: Official?) -> String {
        let displayName = {
            let officialName = official?.name.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !officialName.isEmpty { return officialName }
            return brief.repName
        }()
        let displayOffice = {
            let officialTitle = official?.officeTitle?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !officialTitle.isEmpty { return officialTitle }
            return brief.officeType
        }()

        let lastName = trackerDisplayLastName(from: displayName)
        let office = displayOffice.lowercased()

        if office.contains("senator") {
            return "Call Senator \(lastName)"
        }
        if office.contains("representative") || office.contains("house") || brief.repSlot == .house {
            return "Call Representative \(lastName)"
        }
        return "Call \(lastName)"
    }

    private func outcomeHistoryBackground(for outcome: CivicCallOutcome) -> Color {
        switch outcome {
        case .undecided, .stafferReached:
            return VoteNowColors.infoSurfaceBlue
        case .voicemail, .other:
            return VoteNowColors.borderWarm.opacity(0.58)
        case .unavailable:
            return Color.gray.opacity(0.2)
        case .followUpRequested:
            return VoteNowColors.warningAmber.opacity(0.2)
        case .supportive:
            return VoteNowColors.successGreen.opacity(0.18)
        case .opposed:
            return VoteNowColors.urgentCTA.opacity(0.18)
        }
    }

    private func startMAPCCallGainAnimation(gain: Int) {
        guard gain > 0 else { return }

        let currentTotal = max(viewModel.callStats.totalVoteNowCalls, animatedTotalVoteNowCalls ?? 0)
        let currentUser = max(viewModel.callStats.userCallCount, animatedUserCallCount ?? 0)
        let targetTotal = currentTotal + gain
        let targetUser = currentUser + gain

        animatedMapcCallGain = gain
        showMapcCallGainBadge = true
        animatedTotalVoteNowCalls = currentTotal
        animatedUserCallCount = currentUser

        Task { @MainActor in
            if reduceMotion {
                animatedTotalVoteNowCalls = targetTotal
                animatedUserCallCount = targetUser
            } else {
                let steps = max(6, gain * 4)
                for step in 1...steps {
                    let progress = Double(step) / Double(steps)
                    let increment = Int(round(Double(gain) * progress))
                    animatedTotalVoteNowCalls = min(targetTotal, currentTotal + increment)
                    animatedUserCallCount = min(targetUser, currentUser + increment)
                    try? await Task.sleep(nanoseconds: 70_000_000)
                }
            }

            animatedTotalVoteNowCalls = targetTotal
            animatedUserCallCount = targetUser
            try? await Task.sleep(nanoseconds: reduceMotion ? 900_000_000 : 1_500_000_000)
            withAnimation(.easeOut(duration: 0.2)) {
                showMapcCallGainBadge = false
            }
            animatedMapcCallGain = 0
        }
    }

    private func premadeCommitteeJurisdictionItems(from relevance: [String]) -> [String] {
        relevance.filter { line in
            line.localizedCaseInsensitiveContains("committee of jurisdiction")
        }
    }

    private func exampleCategoryBackgroundColor(for category: String, isSelected: Bool) -> Color {
        if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            return .white
        }
        let base = exampleCategoryColor(for: category)
        return isSelected ? base : base.opacity(0.78)
    }

    private func exampleCategoryTextColor(for category: String) -> Color {
        if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            return .black
        }
        return .white
    }

    private func exampleCategoryBorderColor(for category: String, isSelected: Bool, baseColor: Color) -> Color {
        if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            return isSelected ? Color.black.opacity(0.95) : Color.black.opacity(0.55)
        }
        return isSelected ? Color.white.opacity(0.98) : baseColor.opacity(0.85)
    }

    private func exampleCategoryDisplayName(for category: String) -> String {
        if category.caseInsensitiveCompare(Self.moreExamplesFilterToken) == .orderedSame {
            return showAllExampleCategoryChips ? "Close" : "More..."
        }
        if category.caseInsensitiveCompare("Government Oversight") == .orderedSame {
            return "Gov. Oversight"
        }
        if category.caseInsensitiveCompare(Self.searchExamplesFilterLabel) == .orderedSame {
            return "Search issues"
        }
        if category.caseInsensitiveCompare(Self.urgentExamplesFilterLabel) == .orderedSame {
            return Self.urgentExamplesFilterLabel
        }
        return category
    }

    private func premadeExampleMatchesSearch(_ example: CivicExampleIssueCard, query: String) -> Bool {
        let needle = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !needle.isEmpty else { return true }

        let haystacks: [String] = [
            example.title,
            example.summary,
            example.vehicleLabel ?? "",
            example.actionSentence ?? "",
            example.category ?? "",
            example.slug ?? "",
            example.liveScript,
            example.voicemailScript
        ] + example.relatedBills + example.tags + example.templateAsks.map(\.title)

        return haystacks.contains { value in
            value.lowercased().contains(needle)
        }
    }

    private func isUrgentExample(_ example: CivicExampleIssueCard) -> Bool {
        let urgentKeywords: Set<String> = [
            "urgent",
            "urgency",
            "time-sensitive",
            "timesensitive",
            "asap",
            "priority",
            "high-priority",
            "high priority",
            "emergency",
            "immediate"
        ]

        let normalizedTags = example.tags.map {
            $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        }
        if normalizedTags.contains(where: { urgentKeywords.contains($0) || $0.contains("urgent") }) {
            return true
        }

        let normalizedCategory = (example.category ?? "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        if normalizedCategory.contains("urgent") {
            return true
        }

        let normalizedTitle = example.title.lowercased()
        if normalizedTitle.contains("urgent") {
            return true
        }

        let normalizedSummary = example.summary.lowercased()
        if normalizedSummary.contains("urgent") {
            return true
        }

        return false
    }

    private func premadeUpdatedDate(for example: CivicExampleIssueCard) -> String {
        let date = example.updatedAt ?? Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MM/dd/yy"
        return formatter.string(from: date)
    }

    private func condensedPremadeScriptPlaceholderText(_ text: String) -> String {
        // Premade cards are read as quick previews, so collapse verbose official tokens.
        var preview = text.replacingOccurrences(
            of: #"\[OFFICIAL_TITLE\]\s+\[OFFICIAL_LAST\]"#,
            with: "[YOUR_REP]",
            options: .regularExpression
        )

        // Remove setup and sign-off lines in selection cards to make scripts easier to skim.
        preview = preview.replacingOccurrences(
            of: #"(?i)^\s*hi,?\s*my name is[^.!?]*constituent from[^.!?]*[.!?]\s*"#,
            with: "",
            options: .regularExpression
        )
        preview = preview.replacingOccurrences(
            of: #"(?im)^\s*thank you for your time and consideration\.?\s*$\n?"#,
            with: "",
            options: .regularExpression
        )

        // Keep paragraph spacing readable after line removal.
        preview = preview.replacingOccurrences(
            of: #"\n{3,}"#,
            with: "\n\n",
            options: .regularExpression
        )

        return preview.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private func premadeOptionalDisplayText(_ text: String?) -> String? {
        guard let text = text?.trimmingCharacters(in: .whitespacesAndNewlines),
              !text.isEmpty else { return nil }
        return text
    }

    private var scriptInputsToggleButton: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) {
                isTalkingPointsExpanded.toggle()
            }
        } label: {
            HStack(spacing: 4) {
                Text(l("app.issue_call.script.inputs", "Script inputs"))
                    .font(.caption.weight(.semibold))
                Image(systemName: isTalkingPointsExpanded ? "chevron.up" : "chevron.down")
                    .font(.caption2.weight(.bold))
            }
            .foregroundColor(VoteNowColors.primaryCTA)
            .padding(.horizontal, 8)
            .padding(.vertical, 5)
            .background(VoteNowColors.infoSurfaceBlue)
            .clipShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("issue_call.talking_points.toggle")
    }

    private func synchronizeScriptAccordionState(for briefID: String) {
        if !expandedLiveBriefIDs.contains(briefID) && !expandedVoicemailBriefIDs.contains(briefID) {
            expandedLiveBriefIDs.insert(briefID)
        }
    }

    private func beginMAPCCardTransition() {
        isMAPCCardTransitioning = true
        mapcTransitionResetTask?.cancel()
        mapcTransitionResetTask = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 680_000_000)
            guard !Task.isCancelled else { return }
            isMAPCCardTransitioning = false
        }
    }

    private func exampleCategoryColor(for category: String) -> Color {
        let normalized = category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let mapped = exampleCategoryColorMap[normalized] {
            return mapped
        }
        return VoteNowColors.primaryCTA
    }
}

private struct AssistantThinkingLogoView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var scale: CGFloat = 0.98
    @State private var opacity: Double = 0.9
    @State private var animationTask: Task<Void, Never>?
    private let flagHeight: CGFloat = 24
    private let flagAspectRatio: CGFloat = 1.5

    var body: some View {
        Image(uiImage: VoteNowLogoIcon.tabBarBarsUIImage)
            .renderingMode(.original)
            .resizable()
            .interpolation(.high)
            .antialiased(true)
            .aspectRatio(contentMode: .fit)
            .frame(width: flagHeight * flagAspectRatio, height: flagHeight)
            .scaleEffect(scale)
            .opacity(opacity)
            .layoutPriority(2)
            .onAppear {
                startAnimationLoop()
            }
            .onDisappear {
                animationTask?.cancel()
                animationTask = nil
            }
    }

    private func startAnimationLoop() {
        animationTask?.cancel()
        animationTask = nil

        guard !reduceMotion else {
            scale = 1.0
            opacity = 1.0
            return
        }

        animationTask = Task {
            let cycleDuration = 0.55
            let peakScale: CGFloat = 1.03
            let valleyScale: CGFloat = 0.98
            let valleyOpacity: Double = 0.84
            let upNs = UInt64(cycleDuration * 1_000_000_000)

            while !Task.isCancelled {
                await MainActor.run {
                    withAnimation(.easeInOut(duration: cycleDuration)) {
                        scale = peakScale
                        opacity = 1.0
                    }
                }
                try? await Task.sleep(nanoseconds: upNs)

                await MainActor.run {
                    withAnimation(.easeInOut(duration: cycleDuration)) {
                        scale = valleyScale
                        opacity = valleyOpacity
                    }
                }
                try? await Task.sleep(nanoseconds: upNs)
            }
        }
    }
}

private struct ChipFlowLayout: Layout {
    var itemSpacing: CGFloat = 8
    var rowSpacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .greatestFiniteMagnitude
        var currentX: CGFloat = 0
        var currentY: CGFloat = 0
        var rowHeight: CGFloat = 0
        var usedWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let needsWrap = currentX > 0 && (currentX + size.width) > maxWidth
            if needsWrap {
                usedWidth = max(usedWidth, currentX - itemSpacing)
                currentX = 0
                currentY += rowHeight + rowSpacing
                rowHeight = 0
            }

            currentX += size.width + itemSpacing
            rowHeight = max(rowHeight, size.height)
        }

        if currentX > 0 {
            usedWidth = max(usedWidth, currentX - itemSpacing)
        }

        let height = currentY + rowHeight
        let finalWidth = proposal.width ?? usedWidth
        return CGSize(width: finalWidth, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var currentX = bounds.minX
        var currentY = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            let needsWrap = currentX > bounds.minX && (currentX + size.width) > bounds.maxX
            if needsWrap {
                currentX = bounds.minX
                currentY += rowHeight + rowSpacing
                rowHeight = 0
            }

            subview.place(
                at: CGPoint(x: currentX, y: currentY),
                proposal: ProposedViewSize(width: size.width, height: size.height)
            )
            currentX += size.width + itemSpacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

private struct IssueCallRepHeadshotView: View {
    let official: Official?
    @State private var fallbackWikipediaURL: URL?
    @State private var activeRemoteURL: URL?
    @State private var attemptedWikipediaLookup = false

    var body: some View {
        headshotContent
            .task(id: official?.name ?? "") {
                await resolveBestPhotoURL()
            }
    }

    @ViewBuilder
    private var headshotContent: some View {
        if let official, let bundled = UIImage(named: official.assetName) {
            Image(uiImage: bundled)
                .resizable()
                .scaledToFill()
        } else if let remoteURL = activeRemoteURL ?? normalizedURL {
            AsyncImage(url: remoteURL) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .scaledToFill()
                case .failure:
                    fallback
                        .onAppear {
                            if remoteURL == normalizedURL {
                                activeRemoteURL = fallbackWikipediaURL
                            } else {
                                activeRemoteURL = nil
                            }
                        }
                case .empty:
                    ZStack {
                        VoteNowColors.infoSurfaceBlue
                        ProgressView().scaleEffect(0.82)
                    }
                @unknown default:
                    fallback
                }
            }
        } else {
            fallback
        }
    }

    private var normalizedURL: URL? {
        guard let raw = official?.photoURL?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return nil
        }
        if raw.lowercased().hasPrefix("http://") || raw.lowercased().hasPrefix("https://") {
            return URL(string: raw)
        }
        return URL(string: "https://\(raw)")
    }

    private var fallback: some View {
        ZStack {
            VoteNowColors.infoSurfaceBlue
            Image(systemName: "person.crop.circle.fill")
                .resizable()
                .scaledToFit()
                .padding(8)
                .foregroundColor(VoteNowColors.mutedText.opacity(0.55))
        }
    }

    private func resolveBestPhotoURL() async {
        guard let official else { return }

        await MainActor.run {
            if activeRemoteURL == nil {
                activeRemoteURL = normalizedURL
            }
        }

        if UIImage(named: official.assetName) != nil { return }
        if attemptedWikipediaLookup { return }

        await MainActor.run {
            attemptedWikipediaLookup = true
        }

        do {
            let wikipediaURL = try await WikipediaImageService.shared.thumbnailURL(for: official.name)
            await MainActor.run {
                fallbackWikipediaURL = wikipediaURL
                if activeRemoteURL == nil {
                    activeRemoteURL = wikipediaURL
                }
            }
        } catch {
            return
        }
    }
}

private struct AssistantTypewriterText: View {
    let text: String
    let animate: Bool
    var onFinished: (() -> Void)? = nil

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var displayedText = ""
    @State private var typingTask: Task<Void, Never>?
    @State private var animationSignature = ""

    var body: some View {
        Group {
            if shouldEmphasizeLeadParagraph {
                emphasizedLeadParagraphText(from: displayedText)
            } else if let attributed = try? AttributedString(
                markdown: displayedText,
                options: AttributedString.MarkdownParsingOptions(interpretedSyntax: .inlineOnlyPreservingWhitespace)
            ) {
                Text(attributed)
            } else {
                Text(displayedText)
            }
        }
            .onAppear {
                runAnimationIfNeeded()
            }
            .onChange(of: text) { _, _ in
                runAnimationIfNeeded()
            }
            .onChange(of: animate) { _, _ in
                runAnimationIfNeeded()
            }
    }

    private func runAnimationIfNeeded() {
        let shouldAnimate = animate && !reduceMotion && !text.isEmpty
        guard shouldAnimate else {
            typingTask?.cancel()
            typingTask = nil
            animationSignature = text
            displayedText = text
            onFinished?()
            return
        }

        // Prevent restarts when the row briefly disappears/reappears during scrolling.
        if animationSignature == text {
            if typingTask != nil { return }
            if !displayedText.isEmpty && displayedText != text { return }
            if displayedText == text {
                onFinished?()
                return
            }
        }

        typingTask?.cancel()
        typingTask = nil
        animationSignature = text
        displayedText = ""

        let targetDurationSeconds = min(max(Double(text.count) * 0.025, 1.05), 9.6)
        let perCharacterDelayNs = UInt64((targetDurationSeconds / Double(max(text.count, 1))) * 1_000_000_000)
        let newlineDelayNs: UInt64 = 210_000_000

        typingTask = Task {
            var running = ""
            for character in text {
                if Task.isCancelled { return }
                running.append(character)
                await MainActor.run {
                    displayedText = running
                }
                let delay = character == "\n" ? newlineDelayNs : perCharacterDelayNs
                try? await Task.sleep(nanoseconds: delay)
            }
            await MainActor.run {
                onFinished?()
            }
    }
    }

    private var shouldEmphasizeLeadParagraph: Bool {
        let lowered = text.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return lowered.hasPrefix("it sounds like you’re asking about")
            || lowered.hasPrefix("it sounds like you're asking about")
            || lowered.hasPrefix("it sounds like you’re asking about a public policy issue")
            || lowered.hasPrefix("it sounds like you're asking about a public policy issue")
    }

    private func emphasizedLeadParagraphText(from value: String) -> Text {
        if let separatorRange = value.range(of: "\n\n") {
            let lead = String(value[..<separatorRange.lowerBound])
            let tail = String(value[separatorRange.upperBound...])
            var rendered = Text(lead).fontWeight(.semibold) + Text("\n\n")
            if !tail.isEmpty {
                rendered = rendered + Text(tail)
            }
            return rendered
        }
        return Text(value).fontWeight(.semibold)
    }
}

struct AssistantBackgroundFirstResponseFormatter {
    static func format(
        rawInput: String,
        normalizedIssue: String,
        briefBackground: String,
        commonInterpretations: [String],
        evidenceLine: String?,
        includeTranslation: Bool = true
    ) -> String {
        let translation = translationSentence(rawInput: rawInput, normalizedIssue: normalizedIssue)
        let background = backgroundParagraph(
            rawInput: rawInput,
            normalizedIssue: normalizedIssue,
            briefBackground: briefBackground,
            evidenceLine: evidenceLine
        )

        if !includeTranslation {
            return background
        }

        return """
        \(translation)

        \(background)
        """
    }

    static func discussionOptions(
        rawInput: String,
        normalizedIssue: String,
        seeded: [String],
        billReference: String? = nil
    ) -> [String] {
        interpretationBullets(
            rawInput: rawInput,
            normalizedIssue: normalizedIssue,
            seeded: seeded,
            billReference: billReference
        )
    }

    private static func translationSentence(rawInput: String, normalizedIssue: String) -> String {
        let input = compact(rawInput)
        let issue = compact(normalizedIssue)
        if !issue.isEmpty {
            return "It sounds like you’re asking about \(issue.lowercased())."
        }
        if !input.isEmpty {
            return "It sounds like you’re asking about \(input.lowercased())."
        }
        return "It sounds like you’re asking about a public policy issue that needs congressional action."
    }

    private static func backgroundParagraph(
        rawInput: String,
        normalizedIssue: String,
        briefBackground: String,
        evidenceLine: String?
    ) -> String {
        let lowered = compact("\(rawInput) \(normalizedIssue)").lowercased()
        let explanation = plainEnglishExplanation(for: lowered)
        let mechanism = whyItHappensSentence(for: lowered)
        let impact = whyItMattersSentence(for: lowered)
        let evidence = singleEvidenceSentence(
            candidate: evidenceLine,
            contextKey: lowered
        )
        return [explanation, mechanism, evidence, impact]
            .filter { !$0.isEmpty }
            .prefix(4)
            .joined(separator: " ")
    }

    private static func interpretationBullets(
        rawInput: String,
        normalizedIssue: String,
        seeded: [String],
        billReference: String?
    ) -> [String] {
        let lowered = compact("\(rawInput) \(normalizedIssue)").lowercased()
        let issueLabel = compact(normalizedIssue).isEmpty ? compact(rawInput) : compact(normalizedIssue)
        let issueLabelLower = issueLabel.lowercased()
        let normalizedBill = compact(billReference ?? "")

        var mapped: [String] = [
            congressionalActionOption(issueLabelLower: issueLabelLower, billReference: normalizedBill)
        ]
        mapped.append(contentsOf: priorityOptions(
            lowered: lowered,
            issueLabel: issueLabel,
            seeded: seeded
        ))

        let rotatedFallbacks = rotatedOptions(
            genericPriorityPool(issueLabel: issueLabel),
            contextKey: "\(lowered)|\(issueLabelLower)"
        )
        for fallback in rotatedFallbacks {
            mapped.append(fallback)
            if uniquePreservingOrder(mapped).count >= 6 {
                break
            }
        }

        return Array(uniquePreservingOrder(mapped).prefix(6))
    }

    private static func congressionalActionOption(issueLabelLower: String, billReference: String) -> String {
        if !billReference.isEmpty {
            return "Apply this ask to \(billReference) and request sponsorship or cosponsorship if feasible."
        }
        if issueLabelLower.isEmpty {
            return "If feasible, apply this ask to a specific bill or resolution and request sponsorship or cosponsorship."
        }
        return "If feasible, apply this ask to a bill or resolution on \(issueLabelLower) and request sponsorship or cosponsorship."
    }

    private static func priorityOptions(lowered: String, issueLabel: String, seeded: [String]) -> [String] {
        var options = topicPriorityOptions(for: lowered)
        options.append(contentsOf: seededPriorityOptions(from: seeded))
        options.append(contentsOf: rotatedOptions(genericPriorityPool(issueLabel: issueLabel), contextKey: lowered))
        return uniquePreservingOrder(options)
    }

    private static func topicPriorityOptions(for lowered: String) -> [String] {
        if lowered.contains("shutdown") {
            return [
                "Protect federal workers and essential services from disruption.",
                "Prioritize a clean funding path with enforceable deadlines."
            ]
        }
        if lowered.contains("gun") || lowered.contains("firearm") || lowered.contains("assault weapon") {
            return [
                "Prioritize enforceable background checks and safer storage standards.",
                "Prioritize reducing mass-casualty risk with measurable safety outcomes."
            ]
        }
        if (lowered.contains("veteran") || lowered.contains("veterans")) && (lowered.contains("deport") || lowered.contains("deportation") || lowered.contains("immigration")) {
            return [
                "Prioritize due process protections and legal support in immigration proceedings.",
                "Prioritize continuity of VA access and family stability."
            ]
        }
        if lowered.contains("iran") || lowered.contains("war") {
            return [
                "Prioritize war-powers guardrails and public accountability.",
                "Prioritize de-escalation steps that reduce risk of a wider conflict."
            ]
        }
        if lowered.contains("wildfire") || lowered.contains("fire") {
            return [
                "Prioritize prevention capacity, including fuel reduction and prescribed burns.",
                "Prioritize response staffing and long-term recovery support."
            ]
        }
        if lowered.contains("rent") || lowered.contains("housing") {
            return [
                "Prioritize faster affordable-housing production and preservation.",
                "Prioritize rent-burden relief for households at highest risk of displacement."
            ]
        }
        return []
    }

    private static func seededPriorityOptions(from seeded: [String]) -> [String] {
        var options: [String] = []
        for item in seeded {
            let cleaned = compact(item)
                .replacingOccurrences(of: "^Likely intent:\\s*", with: "", options: .regularExpression)
                .replacingOccurrences(of: "^Potential policy anchor:\\s*", with: "", options: .regularExpression)
                .replacingOccurrences(of: "^Possible tie-in from issue data:\\s*", with: "", options: .regularExpression)
            guard !cleaned.isEmpty else { continue }
            let lowered = cleaned.lowercased()
            if lowered.contains("oversight") || lowered.contains("hearing") || lowered.contains("investigate") {
                options.append("Prioritize strict oversight milestones and public reporting.")
                continue
            }
            if lowered.contains("funding") || lowered.contains("appropriation") || lowered.contains("grant") {
                options.append("Prioritize a clear funding pathway and implementation timeline.")
                continue
            }
            if lowered.contains("rights") || lowered.contains("civil") || lowered.contains("equity") {
                options.append("Prioritize legal protections and rights-based safeguards.")
                continue
            }
            if lowered.contains("broad civic advocacy") || lowered.contains("scope confirmation") {
                options.append("Prioritize a narrow first-step action Congress can execute this term.")
                continue
            }
        }
        return options
    }

    private static func genericPriorityPool(issueLabel: String) -> [String] {
        let normalizedIssue = compact(issueLabel)
        let issueSuffix = normalizedIssue.isEmpty ? "this issue" : normalizedIssue.lowercased()
        return [
            "Prioritize direct household cost relief and affordability outcomes.",
            "Prioritize safety and public-health outcomes with measurable impact.",
            "Prioritize legal durability and bipartisan feasibility.",
            "Prioritize implementation speed through existing agency authority.",
            "Prioritize local district and state impact with clear benefits.",
            "Prioritize accountability metrics, deadlines, and public updates.",
            "Prioritize protections for vulnerable communities most at risk.",
            "Prioritize a near-term win now plus a stronger follow-on package for \(issueSuffix)."
        ]
    }

    private static func rotatedOptions(_ options: [String], contextKey: String) -> [String] {
        guard !options.isEmpty else { return [] }
        let seed = stableSeed(for: contextKey)
        let offset = seed % options.count
        let head = Array(options[offset...])
        let tail = Array(options[..<offset])
        return head + tail
    }

    private static func stableSeed(for text: String) -> Int {
        var accumulator = 0
        for scalar in text.unicodeScalars {
            accumulator = (accumulator &* 31) &+ Int(scalar.value)
        }
        return accumulator == Int.min ? 0 : abs(accumulator)
    }

    private static func uniquePreservingOrder(_ values: [String]) -> [String] {
        var seen: Set<String> = []
        var ordered: [String] = []
        for value in values {
            let cleaned = compact(value)
            guard !cleaned.isEmpty else { continue }
            let key = cleaned.lowercased()
            if seen.contains(key) { continue }
            seen.insert(key)
            ordered.append(cleaned)
        }
        return ordered
    }

    private static func plainEnglishExplanation(for lowered: String) -> String {
        if lowered.contains("shutdown") {
            return "A government shutdown happens when Congress and the president do not finalize funding in time, so parts of the federal government pause operations."
        }
        if lowered.contains("gun") || lowered.contains("firearm") || lowered.contains("assault weapon") {
            return "Gun policy debates are about balancing public safety, constitutional rights, and how to reduce shootings while keeping laws enforceable."
        }
        if (lowered.contains("veteran") || lowered.contains("veterans")) && (lowered.contains("deport") || lowered.contains("deportation") || lowered.contains("immigration")) {
            return "This issue is about military veterans who face immigration enforcement and possible deportation, even after serving in the U.S. armed forces."
        }
        if lowered.contains("iran") || lowered.contains("war") {
            return "This issue is about whether the U.S. should expand military action and how much authority Congress should exercise over war decisions."
        }
        if lowered.contains("wildfire") || lowered.contains("fire") {
            return "Wildfire policy focuses on prevention, emergency response, and recovery as hotter, drier conditions increase fire risk in many regions."
        }
        if lowered.contains("rent") || lowered.contains("housing") {
            return "High rent usually reflects a shortage of affordable homes, rising costs, and wages that are not keeping pace with housing prices."
        }
        return "This issue affects how Congress sets policy, funds programs, and oversees agencies that directly impact daily life."
    }

    private static func whyItHappensSentence(for lowered: String) -> String {
        if lowered.contains("shutdown") {
            return "Shutdowns usually occur when lawmakers disagree on spending totals or policy conditions attached to budget bills."
        }
        if lowered.contains("gun") || lowered.contains("firearm") {
            return "Policy disagreements often center on background checks, weapon access, enforcement, and how to prevent harm without broad overreach."
        }
        if (lowered.contains("veteran") || lowered.contains("veterans")) && (lowered.contains("deport") || lowered.contains("deportation") || lowered.contains("immigration")) {
            return "The problem usually comes from gaps between immigration law, military service pathways, and access to legal support after discharge."
        }
        if lowered.contains("iran") || lowered.contains("war") {
            return "Tension rises when executive actions move faster than congressional debate about legal authority, cost, and long-term strategy."
        }
        if lowered.contains("wildfire") || lowered.contains("fire") {
            return "Risk grows from drought, fuel buildup, development in fire-prone areas, and limited mitigation capacity."
        }
        if lowered.contains("rent") || lowered.contains("housing") {
            return "The problem is often driven by limited supply, restrictive zoning, and financing barriers for new affordable construction."
        }
        return "It usually becomes contentious when timelines, funding, and policy tradeoffs are not aligned."
    }

    private static func whyItMattersSentence(for lowered: String) -> String {
        if lowered.contains("shutdown") {
            return "It matters because service disruptions can affect families, paychecks, and confidence in basic government functions."
        }
        if lowered.contains("gun") || lowered.contains("firearm") {
            return "It matters because communities want fewer preventable deaths and injuries while keeping clear, workable rules."
        }
        if (lowered.contains("veteran") || lowered.contains("veterans")) && (lowered.contains("deport") || lowered.contains("deportation") || lowered.contains("immigration")) {
            return "It matters because deporting veterans can separate families, disrupt access to benefits, and undermine trust in service commitments."
        }
        if lowered.contains("iran") || lowered.contains("war") {
            return "It matters because military escalation can cost lives, increase regional instability, and commit the U.S. to prolonged conflict."
        }
        if lowered.contains("wildfire") || lowered.contains("fire") {
            return "It matters because severe fires can threaten homes, health, local economies, and public infrastructure."
        }
        if lowered.contains("rent") || lowered.contains("housing") {
            return "It matters because housing costs shape household stability, family budgets, and local economic mobility."
        }
        return "It matters because the decisions made here affect costs, safety, and trust in public institutions."
    }

    private static func singleEvidenceSentence(candidate: String?, contextKey: String) -> String {
        let cleanedCandidate = compact(candidate ?? "")
        if !cleanedCandidate.isEmpty {
            let oneSentence = cleanedCandidate
                .components(separatedBy: CharacterSet(charactersIn: ".!?"))
                .map(compact)
                .first(where: { !$0.isEmpty }) ?? cleanedCandidate
            if containsConcreteExample(oneSentence) {
                return ensureSentenceEnd(oneSentence)
            }
        }
        return ensureSentenceEnd(defaultConcreteExample(for: contextKey))
    }

    private static func defaultConcreteExample(for contextKey: String) -> String {
        if contextKey.contains("shutdown") {
            return "For example, the 2018–2019 federal shutdown lasted 35 days and affected about 800,000 federal workers."
        }
        if contextKey.contains("gun") || contextKey.contains("firearm") {
            return "For example, the U.S. has recorded more than 40,000 gun deaths per year in recent years."
        }
        if (contextKey.contains("veteran") || contextKey.contains("veterans")) && (contextKey.contains("deport") || contextKey.contains("deportation") || contextKey.contains("immigration")) {
            return "For example, national advocacy groups have documented deported veterans separated from U.S.-based families after military service."
        }
        if contextKey.contains("iran") || contextKey.contains("war") {
            return "For example, Congress has not issued a formal declaration of war against Iran, which is why war-powers oversight keeps coming up."
        }
        if contextKey.contains("wildfire") || contextKey.contains("fire") {
            return "For example, wildfire smoke events have repeatedly pushed air quality to unhealthy levels for millions of people."
        }
        if contextKey.contains("rent") || contextKey.contains("housing") {
            return "For example, many renters now spend more than 30% of income on housing, which is considered cost-burdened."
        }
        return "For example, one delayed funding decision can quickly ripple into higher costs and reduced services for families."
    }

    private static func containsConcreteExample(_ text: String) -> Bool {
        let lowered = text.lowercased()
        let hasNumber = text.range(of: #"\d"#, options: .regularExpression) != nil
        if hasNumber { return true }
        if lowered.contains("for example") { return true }
        if lowered.contains("example") { return true }
        return false
    }

    private static func compact(_ text: String) -> String {
        text
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private static func ensureSentenceEnd(_ text: String) -> String {
        let trimmed = compact(text)
        guard !trimmed.isEmpty else { return "" }
        if trimmed.hasSuffix(".") || trimmed.hasSuffix("!") || trimmed.hasSuffix("?") {
            return trimmed
        }
        return "\(trimmed)."
    }
}

private struct TrackerIssueGroup: Identifiable {
    let id: String
    let representativeGroup: CivicHistoryGroup
    let issueTitle: String
    let issueSummary: String
    let date: Date
    let briefs: [CivicCallBrief]
    let logs: [CivicCallLogRecord]
}

private struct TrackerOutcomeRow: Identifiable {
    let id: String
    let repName: String
    let outcome: CivicCallOutcome
}

private struct IssueCallCenterTabBarVisibilityModifier: ViewModifier {
    let hidden: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if hidden {
            content.toolbar(.hidden, for: .tabBar)
        } else {
            content
        }
    }
}

#Preview {
    let rep1 = Official(
        name: "Sample Senator",
        divisionId: "ocd-division/country:us/state:ca",
        party: "Independent",
        officeTitle: "U.S. Senator",
        photoURL: nil,
        officialPhone: "(202) 555-0101"
    )
    let rep2 = Official(
        name: "Sample House Member",
        divisionId: "ocd-division/country:us/state:ca/cd:12",
        party: "Independent",
        officeTitle: "U.S. Representative",
        photoURL: nil,
        officialPhone: "(202) 555-0102"
    )

    IssueCallCenterView(federalReps: [rep1, rep2], userZip: "90210")
}
