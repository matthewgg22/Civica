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
    @State private var showWhyCallOverlay = false
    @State private var didCompleteMAPC = false
    @State private var isTalkingPointsExpanded = false
    @State private var logoFrameInSpreadSpace: CGRect = .zero
    @State private var overlayOriginInSpreadSpace: CGPoint?
    @State private var showCompletionPrompt = false
    @State private var lastPromptedLaunchEventID: String?
    @State private var selectedExampleCategory: String = "All"
    @State private var expandedVoicemailBriefIDs: Set<String> = []
    @State private var expandedLiveBriefIDs: Set<String> = []
    @State private var mapcSessionLoggedBriefIDs: Set<String> = []
    @State private var mapcBriefsSignature: String = ""
    @State private var animatedTotalVoteNowCalls: Int?
    @State private var animatedUserCallCount: Int?
    @State private var animatedMapcCallGain: Int = 0
    @State private var showMapcCallGainBadge = false
    private let userAddressLine: String

    private enum FocusedField: Hashable {
        case concern
        case billRef
    }

    private struct LogoFramePreferenceKey: PreferenceKey {
        static var defaultValue: CGRect = .zero
        static func reduce(value: inout CGRect, nextValue: () -> CGRect) {
            let next = nextValue()
            if next != .zero {
                value = next
            }
        }
    }

    init(federalReps: [Official], userZip: String, userAddressLine: String = "") {
        _viewModel = StateObject(wrappedValue: IssueCallCenterViewModel(federalReps: federalReps, userZip: userZip))
        self.userAddressLine = userAddressLine
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
        let slots: [CivicRepSlot]
        if !viewModel.callBriefs.isEmpty {
            slots = viewModel.callBriefs.compactMap(\.repSlot)
        } else {
            slots = viewModel.repTargets.map(\.slot)
        }
        return slots.map { slot in
            switch slot {
            case .house:
                return "House Rep"
            case .senate1, .senate2:
                return "Senator"
            }
        }
    }

    private var activeProgressIndex: Int {
        viewModel.activeBriefIndex ?? 0
    }

    private var isMAPCMode: Bool {
        !didCompleteMAPC && !viewModel.callBriefs.isEmpty && viewModel.activeBrief != nil
    }

    private var visibleTabs: [CivicIssueCallTab] {
        [.assistant, .examples, .civicScore]
    }

    private var exampleCategoryOptions: [String] {
        var seen = Set<String>()
        var categories: [String] = []

        for card in viewModel.examples {
            let category = (card.category ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            guard !category.isEmpty else { continue }
            if seen.insert(category).inserted {
                categories.append(category)
            }
        }

        return ["All"] + categories
    }

    private var filteredExamples: [CivicExampleIssueCard] {
        guard selectedExampleCategory != "All" else { return viewModel.examples }
        return viewModel.examples.filter { card in
            let category = (card.category ?? "")
                .trimmingCharacters(in: .whitespacesAndNewlines)
            return category == selectedExampleCategory
        }
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

        var map: [String: Color] = ["all": VoteNowColors.primaryCTA]
        let categories = exampleCategoryOptions.filter { $0.caseInsensitiveCompare("All") != .orderedSame }
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
                        .transition(.move(edge: .trailing).combined(with: .opacity))
                    } else {
                        VStack(spacing: 12) {
                            headerSection
                            Group {
                                switch viewModel.selectedTab {
                                case .assistant:
                                    assistantTab
                                case .examples:
                                    examplesTab
                                case .civicScore:
                                    civicScoreTab
                                case .history:
                                    civicScoreTab
                                }
                            }
                            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                        }
                        .transition(.move(edge: .leading).combined(with: .opacity))
                    }
                }
            }
            .animation(.easeInOut(duration: 0.28), value: isMAPCMode)
            .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())

            EmojiWaterfallView(controller: waterfallController)
                .ignoresSafeArea()
                .zIndex(11)
                .allowsHitTesting(false)

            if showWhyCallOverlay {
                WhyCallFloodOverlay(
                    isPresented: $showWhyCallOverlay,
                    originInSpreadSpace: overlayOriginInSpreadSpace,
                    onStartCalling: {
                        focusedField = nil
                        withAnimation(.easeInOut(duration: 0.2)) {
                            viewModel.selectedTab = .assistant
                        }
                    }
                )
                    .transition(.identity)
                    .zIndex(20)
            }
        }
        .coordinateSpace(name: "SpreadSpace")
        .safeAreaInset(edge: .bottom) {
            if !isMAPCMode {
                bottomTabSelector
            }
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .tabBar)
        .toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button(l("app.issue_call.action.done", "Done")) {
                    focusedField = nil
                }
            }
        }
        .task {
            await viewModel.loadExamplesAndHistory()
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
        .confirmationDialog(
            l("app.issue_call.completion.prompt.title", "Did you complete the call?"),
            isPresented: $showCompletionPrompt,
            titleVisibility: .visible
        ) {
            Button(l("app.issue_call.completion.prompt.yes", "Yes")) {
                Task {
                    await viewModel.confirmPendingCallCompletion(completed: true)
                }
            }
            Button(l("app.issue_call.completion.prompt.not_yet", "Not yet")) {
                Task {
                    await viewModel.confirmPendingCallCompletion(completed: false)
                }
            }
            Button(l("app.issue_call.alert.cancel", "Cancel"), role: .cancel) {}
        }
        .onTapGesture {
            focusedField = nil
        }
        .onPreferenceChange(LogoFramePreferenceKey.self) { newFrame in
            guard newFrame != .zero else { return }
            logoFrameInSpreadSpace = newFrame
        }
        .onAppear {
            if !isMAPCMode {
                viewModel.selectedTab = .assistant
            }
            if let activeID = viewModel.activeBriefID {
                synchronizeScriptAccordionState(for: activeID)
            }
        }
        .onDisappear {
            viewModel.persistDraftState()
        }
        .onChange(of: viewModel.selectedTab) { _, newTab in
            viewModel.persistDraftState()
            if newTab == .civicScore || newTab == .history {
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
        .onChange(of: scenePhase) { _, newValue in
            guard newValue == .active else { return }
            guard callScoreV1Enabled else { return }
            guard let pending = viewModel.pendingCallLaunch else { return }
            guard viewModel.shouldPromptForPendingCallCompletion() else { return }
            guard lastPromptedLaunchEventID != pending.launchEventID else { return }
            lastPromptedLaunchEventID = pending.launchEventID
            showCompletionPrompt = true
        }
        .onChange(of: viewModel.pendingCallLaunch?.launchEventID) { _, newValue in
            if newValue == nil {
                lastPromptedLaunchEventID = nil
            }
        }
        .onChange(of: viewModel.examples.count) { _, _ in
            if !exampleCategoryOptions.contains(selectedExampleCategory) {
                selectedExampleCategory = "All"
            }
        }
        .onChange(of: viewModel.callBriefs.map(\.id)) { _, ids in
            let signature = ids.joined(separator: "|")
            if signature != mapcBriefsSignature {
                mapcBriefsSignature = signature
                mapcSessionLoggedBriefIDs.removeAll()
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
    }

    private var mapcAddressSection: some View {
        Group {
            if !userAddressLine.isEmpty {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Text(userAddressLine)
                        .font(.title3.weight(.semibold))
                        .foregroundColor(VoteNowColors.mutedText)
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    if let activeBrief = viewModel.activeBrief,
                       !activeBrief.talkingPoints.isEmpty {
                        scriptInputsToggleButton
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 10)
            }
        }
    }

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .center, spacing: 12) {
                Button {
                    if logoFrameInSpreadSpace != .zero {
                        overlayOriginInSpreadSpace = CGPoint(
                            x: logoFrameInSpreadSpace.midX,
                            y: logoFrameInSpreadSpace.midY
                        )
                    } else {
                        overlayOriginInSpreadSpace = nil
                    }
                    showWhyCallOverlay = true
                } label: {
                    VoteNowLogoIcon(size: 50)
                        .background(
                            GeometryReader { geo in
                                Color.clear.preference(
                                    key: LogoFramePreferenceKey.self,
                                    value: geo.frame(in: .named("SpreadSpace"))
                                )
                            }
                        )
                }
                .buttonStyle(.plain)
                .accessibilityLabel(l("app.issue_call.action.why_call", "Open Why Call"))

                Text(l("app.issue_call.title", "Call my Rep"))
                    .font(.system(size: 38, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.84)

                Spacer(minLength: 8)

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

            if !userAddressLine.isEmpty {
                Text(userAddressLine)
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
                    .lineLimit(2)
                    .padding(.leading, 62)
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
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

    private var bottomTabSelector: some View {
        Picker("", selection: $viewModel.selectedTab) {
            ForEach(visibleTabs) { tab in
                Text(tab.title).tag(tab)
            }
        }
        .pickerStyle(.segmented)
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .background(
            VoteNowColors.brandSoftBlue.opacity(0.96)
                .ignoresSafeArea(edges: .bottom)
        )
        .accessibilityIdentifier("issue_call.tabs")
    }

    private var scriptFocusModeContent: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 10) {
                if viewModel.lastCompletionResult != nil {
                    completionFeedbackCard
                }

                issueSummaryCard

                if let brief = viewModel.activeBrief {
                    repBriefCard(brief, condensedForMAPC: true)
                        .id(brief.id)
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
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if viewModel.lastCompletionResult != nil {
                        completionFeedbackCard
                    }

                    if viewModel.issueTitle.isEmpty || didCompleteMAPC {
                        concernComposerCard
                    } else {
                        issueSummaryCard
                    }

                    if viewModel.filteredBriefs.isEmpty, !viewModel.issueTitle.isEmpty {
                        Text(l("app.issue_call.empty.filtered", "No briefs match this representative filter."))
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)
                    }

                    if let brief = viewModel.activeBrief {
                        repBriefCard(brief)
                            .id(brief.id)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: viewModel.activeBriefID) { _, id in
                guard let id else { return }
                withAnimation(.easeInOut(duration: 0.2)) {
                    proxy.scrollTo(id, anchor: .top)
                }
            }
            .animation(.easeInOut(duration: 0.28), value: viewModel.activeBriefID)
        }
    }

    private var concernComposerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.issue_call.concern.header", "Build your Script"))
                .font(.headline)

            ZStack(alignment: .topLeading) {
                if viewModel.concernText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(l(
                        "app.issue_call.concern.subheader",
                        "Write what issue you want to inform Congress and we will generate a script!"
                    ))
                        .foregroundColor(VoteNowColors.mutedText.opacity(0.64))
                        .font(.subheadline)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(.top, 12)
                        .padding(.leading, 8)
                        .padding(.trailing, 10)
                        .allowsHitTesting(false)
                }

                TextEditor(text: $viewModel.concernText)
                    .frame(minHeight: 90)
                    .padding(4)
                    .background(Color.clear)
                    .focused($focusedField, equals: .concern)
                    .accessibilityIdentifier("issue_call.concern_input")
            }
            .background(VoteNowColors.surfaceWhite)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
            )

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

            TextField(
                "",
                text: $viewModel.optionalBillRef,
                prompt: Text(l("app.issue_call.bill.placeholder", "Optional bill reference (e.g., H.R.1234)"))
            )
            .textInputAutocapitalization(.characters)
            .autocorrectionDisabled()
            .focused($focusedField, equals: .billRef)
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
                focusedField = nil
                didCompleteMAPC = false
                isTalkingPointsExpanded = false
                Task {
                    await viewModel.submitAssistantRequest()
                }
            } label: {
                HStack {
                    if viewModel.isSubmitting {
                        ProgressView()
                            .tint(.white)
                    }
                    Text(l("app.issue_call.action.generate", "Generate call briefs"))
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
                Text(viewModel.issueSummary)
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
        let summary = viewModel.issueSummary.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard !title.isEmpty, !summary.isEmpty else { return false }
        return title == summary
    }

    @ViewBuilder
    private func repBriefCard(_ brief: CivicCallBrief, condensedForMAPC: Bool = false) -> some View {
        let isActive = viewModel.activeBriefID == brief.id
        let official = viewModel.official(for: brief)
        let primaryCallURL = callURL(primary: brief.primaryPhoneNumber, fallback: official?.officialPhone)
        let shouldShowCallPillOrbit = condensedForMAPC && primaryCallURL != nil
        let isLastBrief = viewModel.isLastBrief(brief)
        let briefIndex = viewModel.callBriefs.firstIndex(where: { $0.id == brief.id }) ?? 0
        let isFirstBrief = briefIndex == 0
        let isVoicemailExpanded = expandedVoicemailBriefIDs.contains(brief.id)
        let selectedOutcome = viewModel.loggedOutcomeByBriefID[brief.id]
        let isVoicemailOutcomeLocked = condensedForMAPC && isVoicemailExpanded
        let liveScriptText = brief.liveScript

        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 8) {
                IssueCallRepHeadshotView(official: official)
                    .frame(width: 65, height: 65)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: 4) {
                    Text(brief.repName)
                        .font(.headline)
                    Text(brief.officeType)
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
                    Task {
                        if callScoreV1Enabled {
                            await viewModel.beginCallLaunch(for: brief, sourceScreen: "issue_call_center")
                        }
                        openURL(url)
                    }
                } label: {
                    Group {
                        if shouldShowCallPillOrbit {
                            Label(
                                callButtonTitle(for: brief),
                                systemImage: "phone.fill"
                            )
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(primaryCallURL == nil ? VoteNowColors.mutedText.opacity(0.45) : VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .voteNowPillDualOrbit(
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
                                callButtonTitle(for: brief),
                                systemImage: "phone.fill"
                            )
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 11)
                            .background(primaryCallURL == nil ? VoteNowColors.mutedText.opacity(0.45) : VoteNowColors.primaryCTA)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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
                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            if expandedLiveBriefIDs.contains(brief.id) {
                                expandedLiveBriefIDs.remove(brief.id)
                            } else {
                                expandedLiveBriefIDs.insert(brief.id)
                                expandedVoicemailBriefIDs.remove(brief.id)
                            }
                        }
                    } label: {
                        HStack(spacing: 8) {
                            Text("Live-call Script")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.primaryText)
                            Spacer(minLength: 0)
                            Image(systemName: expandedLiveBriefIDs.contains(brief.id) ? "chevron.up" : "chevron.down")
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

                    if expandedLiveBriefIDs.contains(brief.id) {
                        scriptBlock(
                            title: "Live-call Script",
                            text: liveScriptText,
                            showScriptInputsToggle: false
                        )
                    }
                }
            } else {
                scriptBlock(
                    title: "Live-call Script",
                    text: liveScriptText,
                    showScriptInputsToggle: false
                )
            }
            if condensedForMAPC, isTalkingPointsExpanded, !brief.talkingPoints.isEmpty {
                scriptInputsExpandedBlock(brief.talkingPoints)
                    .padding(.leading, 8)
            }

            if condensedForMAPC {
                VStack(alignment: .leading, spacing: 4) {
                    Button {
                        if selectedOutcome != .voicemail {
                            if isMAPCMode {
                                mapcSessionLoggedBriefIDs.insert(brief.id)
                            }
                            Task {
                                await viewModel.logOutcome(for: brief, outcome: .voicemail)
                            }
                        }
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
                        .background(VoteNowColors.infoSurfaceBlue)
                        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
                    }
                    .buttonStyle(.plain)

                    if isVoicemailExpanded {
                        scriptBlock(title: "Voicemail Script", text: brief.voicemailScript)
                    }
                }
            } else {
                scriptBlock(title: "Voicemail Script", text: brief.voicemailScript)
            }

            outcomeButtons(
                brief,
                selectedOutcome: selectedOutcome,
                isVoicemailLocked: isVoicemailOutcomeLocked
            )

            if condensedForMAPC {
                HStack(spacing: 8) {
                    Button {
                        if isFirstBrief {
                            dismiss()
                        } else {
                            withAnimation(.easeInOut(duration: 0.2)) {
                                viewModel.retreatToPreviousRep(before: brief)
                            }
                        }
                    } label: {
                        Text(isFirstBrief ? l("app.issue_call.action.return_home", "Home") : l("app.issue_call.action.back", "Back"))
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
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(isActive ? VoteNowColors.primaryCTA : VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
        .transition(.asymmetric(
            insertion: .move(edge: .trailing).combined(with: .opacity),
            removal: .move(edge: .leading).combined(with: .opacity)
        ))
    }

    private func nextRepButton(for brief: CivicCallBrief, isLastBrief: Bool) -> some View {
        let canAdvance = viewModel.hasLoggedOutcome(for: brief)

        return Button {
            let mapcGain = mapcSessionLoggedBriefIDs.count
            withAnimation(.easeInOut(duration: 0.28)) {
                if isLastBrief {
                    waterfallController.trigger(reduceMotion: reduceMotion)
                    viewModel.finishScript()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.05) {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            didCompleteMAPC = true
                            viewModel.selectedTab = .civicScore
                            startMAPCCallGainAnimation(gain: mapcGain)
                            mapcSessionLoggedBriefIDs.removeAll()
                        }
                    }
                } else {
                    viewModel.advanceToNextRep(after: brief)
                }
            }
        } label: {
            HStack {
                Text(isLastBrief ? l("app.issue_call.action.finish_script", "Finish Script!") : l("app.issue_call.action.next_rep", "Next Representative"))
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
                    ChipFlowLayout(itemSpacing: 8, rowSpacing: 8) {
                        ForEach(exampleCategoryOptions, id: \.self) { category in
                            let isAllMode = selectedExampleCategory == "All"
                            let isSelected = isAllMode || (category == selectedExampleCategory)
                            let categoryColor = exampleCategoryColor(for: category)
                            Button {
                                selectedExampleCategory = category
                            } label: {
                                Text(exampleCategoryDisplayName(for: category))
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.white)
                                    .lineLimit(1)
                                    .multilineTextAlignment(.center)
                                    .minimumScaleFactor(0.78)
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
                                                isSelected ? Color.white.opacity(0.98) : categoryColor.opacity(0.85),
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
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.top, 4)
                }

                if viewModel.examples.isEmpty {
                    Text(l("app.issue_call.examples.empty", "No example cards are available right now."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                } else if filteredExamples.isEmpty {
                    Text(l("app.issue_call.examples.empty_for_category", "No examples match this category yet."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                }

                ForEach(filteredExamples) { example in
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
                        .background(exampleCategoryColor(for: example.category ?? "All"))
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
                            if !example.targetChambers.isEmpty {
                                Text(example.targetChambers.map { $0.capitalized }.joined(separator: " + "))
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(.white)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(VoteNowColors.primaryCTA)
                                    .clipShape(Capsule())
                            }

                            Spacer(minLength: 0)

                            Text("UPDATED: \(premadeUpdatedDate(for: example))")
                                .font(.caption2.weight(.bold))
                                .foregroundColor(.white.opacity(0.96))
                                .lineLimit(1)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(exampleCategoryColor(for: example.category ?? "All"))
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule()
                                        .stroke(Color.white.opacity(0.72), lineWidth: 1)
                                )
                        }

                        emphasizedPromptText(example.summary, baseFont: .subheadline)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)

                        let committeeJurisdictionItems = premadeCommitteeJurisdictionItems(from: example.repRelevance)

                        chipRow(title: l("app.issue_call.examples.bills", "Related bill(s)"), items: example.relatedBills)
                        chipRow(title: l("app.issue_call.examples.relevance", "Why your reps are relevant"), items: committeeJurisdictionItems)
                        chipRow(title: l("app.issue_call.examples.template_asks", "Template asks"), items: example.templateAsks.map(\.title))

                        exampleScriptBlock(
                            title: "Live-call Script",
                            text: condensedPremadeScriptPlaceholderText(example.liveScript)
                        )

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
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 6)
            .padding(.bottom, 20)
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

    private var civicScoreSummaryCard: some View {
        let stats = viewModel.callStats
        let displayedTotalCalls = max(stats.totalVoteNowCalls, animatedTotalVoteNowCalls ?? 0)
        let displayedUserCalls = max(stats.userCallCount, animatedUserCallCount ?? 0)

        return VStack(alignment: .center, spacing: 12) {
            VStack(alignment: .center, spacing: 4) {
                HStack(alignment: .firstTextBaseline, spacing: 8) {
                    Spacer(minLength: 0)
                    Text("\(displayedTotalCalls.formatted(.number)) Total Calls")
                        .font(.system(size: 36, weight: .bold, design: .rounded))
                        .foregroundColor(VoteNowColors.primaryCTA)

                    if showMapcCallGainBadge && animatedMapcCallGain > 0 {
                        Text("+\(animatedMapcCallGain)")
                            .font(.title3.weight(.bold))
                            .foregroundColor(VoteNowColors.successGreen)
                            .transition(.move(edge: .top).combined(with: .opacity))
                    }
                    Spacer(minLength: 0)
                }
                .animation(.easeInOut(duration: 0.2), value: showMapcCallGainBadge)
                .frame(maxWidth: .infinity, alignment: .center)

                if showMapcCallGainBadge && animatedMapcCallGain > 0 {
                    Text("+\(animatedMapcCallGain) added to Calls to Congress")
                        .font(.caption.weight(.semibold))
                        .foregroundColor(VoteNowColors.successGreen)
                        .frame(maxWidth: .infinity, alignment: .center)
                }
            }

            Divider()

            VStack(alignment: .leading, spacing: 10) {
                scoreStatLine(
                    label: l("app.issue_call.score.stats.user_calls", "Your number of calls"),
                    value: displayedUserCalls
                )
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
            Text(l("app.issue_call.tracker.title.calls_to_my_reps", "Calls to My Reps"))
                .font(.headline)
                .frame(maxWidth: .infinity, alignment: .center)

            if trackerGroups.isEmpty {
                Text(l("app.issue_call.history.empty", "Your call history will appear here after you generate and log call briefs."))
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
            } else {
                ForEach(trackerGroups.prefix(4)) { group in
                    let outcomeRows = trackerOutcomeRows(for: group)
                    let appWideCompletedCalls = trackerAppWideCompletedCalls(for: group)
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

                            Text(trackerProgressSummaryText(completedCalls: appWideCompletedCalls))
                                .font(.caption2.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                        }

                        trackerIssueProgressBar(completedCalls: appWideCompletedCalls)

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
                            viewModel.reopen(historyGroup: group.representativeGroup)
                        } label: {
                            Text(l("app.issue_call.history.reopen", "Repeat Script"))
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
        let sortedLogs = group.logs.sorted { $0.createdAt > $1.createdAt }
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

    private func trackerAppWideCompletedCalls(for group: TrackerIssueGroup) -> Int {
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

    private func trackerProgressSummaryText(completedCalls: Int) -> String {
        let safeGoal = max(1, trackerProgressGoalCalls)
        let safeCompleted = max(0, completedCalls)
        let completedText: String
        if safeCompleted >= safeGoal {
            completedText = "\(safeGoal.formatted(.number))+"
        } else {
            completedText = safeCompleted.formatted(.number)
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

    @ViewBuilder
    private func scriptBlock(
        title: String,
        text: String,
        showScriptInputsToggle: Bool = false,
        textLineLimit: Int? = nil
    ) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            ZStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .frame(maxWidth: .infinity, alignment: .center)
                    .multilineTextAlignment(.center)
                if showScriptInputsToggle {
                    HStack {
                        Spacer(minLength: 0)
                        scriptInputsToggleButton
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
        .background(VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
    }

    @ViewBuilder
    private func scriptInputsExpandedBlock(_ talkingPoints: [String]) -> some View {
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
        .background(VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
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
            .supportive,
            .opposed,
            .undecided,
            .other
        ]

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text(l("app.issue_call.outcomes", "Log outcome"))
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
                        if isMAPCMode {
                            mapcSessionLoggedBriefIDs.insert(brief.id)
                        }
                        Task {
                            await viewModel.logOutcome(for: brief, outcome: outcome)
                        }
                    } label: {
                        Text(outcome.title)
                            .font(.body.weight(.semibold))
                            .foregroundColor(selectedOutcome == outcome ? .white : VoteNowColors.primaryText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedOutcome == outcome
                                ? outcomeColor(for: outcome)
                                : VoteNowColors.infoSurfaceBlue.opacity(0.95)
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

    private func outcomeColor(for outcome: CivicCallOutcome) -> Color {
        switch outcome {
        case .voicemail:
            return Color(hex: "#6B5B54")
        case .supportive:
            return VoteNowColors.successGreen
        case .opposed:
            return VoteNowColors.urgentCTA
        case .undecided:
            return Color(hex: "#5D6B75")
        case .followUpRequested:
            return Color(hex: "#6A4FB3")
        case .other:
            return Color(hex: "#B56A18")
        case .unavailable:
            return Color(hex: "#7F8A93")
        case .stafferReached:
            return Color(hex: "#3B7CA5")
        }
    }

    private func callButtonTitle(for brief: CivicCallBrief) -> String {
        let lastName = trackerDisplayLastName(from: brief.repName)
        let office = brief.officeType.lowercased()

        if office.contains("senator") {
            return "Call Senator \(lastName)"
        }
        if office.contains("representative") || office.contains("house") || brief.repSlot == .house {
            return "Call Congressman \(lastName)"
        }
        return "Call \(lastName)"
    }

    private func outcomeHistoryBackground(for outcome: CivicCallOutcome) -> Color {
        outcomeColor(for: outcome).opacity(0.18)
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
        let base = exampleCategoryColor(for: category)
        return isSelected ? base : base.opacity(0.78)
    }

    private func exampleCategoryDisplayName(for category: String) -> String {
        if category.caseInsensitiveCompare("Government Oversight") == .orderedSame {
            return "Gov. Oversight"
        }
        return category
    }

    private func premadeUpdatedDate(for example: CivicExampleIssueCard) -> String {
        let date = example.updatedAt ?? Date()
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.timeZone = TimeZone.current
        formatter.dateFormat = "MMMM d, yyyy"
        return formatter.string(from: date)
    }

    private func condensedPremadeScriptPlaceholderText(_ text: String) -> String {
        // Premade cards are read as quick previews, so collapse verbose official tokens.
        text.replacingOccurrences(
            of: #"\[OFFICIAL_TITLE\]\s+\[OFFICIAL_LAST\]"#,
            with: "[YOUR_REP]",
            options: .regularExpression
        )
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

    private func exampleCategoryColor(for category: String) -> Color {
        let normalized = category.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if let mapped = exampleCategoryColorMap[normalized] {
            return mapped
        }
        return VoteNowColors.primaryCTA
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
