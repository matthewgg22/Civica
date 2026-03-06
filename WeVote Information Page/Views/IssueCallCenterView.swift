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
    @State private var showBreakdownSheet = false
    @State private var lastPromptedLaunchEventID: String?
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

    var body: some View {
        ZStack {
            VStack(spacing: 12) {
                if isMAPCMode {
                    mapcAddressSection
                    repProgressRow
                    scriptFocusModeContent
                } else {
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
            }
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
        .sheet(isPresented: $showBreakdownSheet) {
            callScoreBreakdownSheet
                .presentationDetents([.medium, .large])
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
        }
        .onDisappear {
            viewModel.persistDraftState()
        }
        .onChange(of: viewModel.selectedTab) { _, _ in
            viewModel.persistDraftState()
        }
        .onChange(of: viewModel.issueTitle) { _, _ in
            isTalkingPointsExpanded = false
        }
        .onChange(of: viewModel.activeBriefID) { _, newID in
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
    }

    private var mapcAddressSection: some View {
        Group {
            if !userAddressLine.isEmpty {
                Text(userAddressLine)
                    .font(.title3.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
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
            Text(l(
                "app.issue_call.concern.subheader",
                "Enter your issue below to generate a personalized script for each of your reps."
            ))
            .font(.subheadline)
            .foregroundColor(VoteNowColors.mutedText)

            ZStack(alignment: .topLeading) {
                if viewModel.concernText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Text(l("app.issue_call.concern.placeholder", "What issue do you want to call about?"))
                        .foregroundColor(VoteNowColors.mutedText)
                        .padding(.top, 12)
                        .padding(.leading, 8)
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

        return VStack(alignment: .leading, spacing: 6) {
            ZStack {
                Text("\(l("app.issue_call.issue.prefix", "Issue:")) \(viewModel.issueTitle)")
                    .font(.title3.weight(.semibold))
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .lineLimit(1)
            .minimumScaleFactor(0.85)
            .padding(.trailing, talkingPoints.isEmpty ? 0 : 122)
            .overlay(alignment: .topTrailing) {
                if !talkingPoints.isEmpty {
                    Button {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            isTalkingPointsExpanded.toggle()
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(l("app.issue_call.script.talking_points", "Talking points"))
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
            }

            if !isMAPCMode, !isIssueSummaryDuplicate {
                Text(viewModel.issueSummary)
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
            }

            if !talkingPoints.isEmpty && isTalkingPointsExpanded {
                VStack(alignment: .leading, spacing: 4) {
                    Text(l("app.issue_call.script.talking_points", "Talking points"))
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
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
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
        let isLastBrief = viewModel.isLastBrief(brief)
        let briefIndex = viewModel.callBriefs.firstIndex(where: { $0.id == brief.id }) ?? 0
        let isFirstBrief = briefIndex == 0

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
                    Label(
                        l("app.issue_call.action.call_rep", "Call this representative"),
                        systemImage: "phone.fill"
                    )
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(primaryCallURL == nil ? VoteNowColors.mutedText.opacity(0.45) : VoteNowColors.primaryCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
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

            scriptBlock(title: l("app.issue_call.script.live", "Live-call script"), text: brief.liveScript)
            scriptBlock(title: l("app.issue_call.script.voicemail", "Voicemail"), text: brief.voicemailScript)

            outcomeButtons(brief)

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
            withAnimation(.easeInOut(duration: 0.28)) {
                if isLastBrief {
                    waterfallController.trigger(reduceMotion: reduceMotion)
                    viewModel.finishScript()
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.05) {
                        withAnimation(.easeInOut(duration: 0.22)) {
                            didCompleteMAPC = true
                            viewModel.selectedTab = .civicScore
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
                ? (isLastBrief ? VoteNowColors.successGreen : VoteNowColors.primaryCTA)
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
                if viewModel.examples.isEmpty {
                    Text(l("app.issue_call.examples.empty", "No example cards are available right now."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                }

                ForEach(viewModel.examples) { example in
                    VStack(alignment: .leading, spacing: 8) {
                        Text(example.title)
                            .font(.headline)

                        HStack(spacing: 8) {
                            if let category = example.category, !category.isEmpty {
                                Text(category)
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(VoteNowColors.infoSurfaceBlue)
                                    .clipShape(Capsule())
                            }
                            if !example.targetChambers.isEmpty {
                                Text(example.targetChambers.map { $0.capitalized }.joined(separator: " + "))
                                    .font(.caption.weight(.semibold))
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 4)
                                    .background(VoteNowColors.infoSurfaceBlue)
                                    .clipShape(Capsule())
                            }
                        }

                        Text(example.summary)
                            .font(.subheadline)

                        chipRow(title: l("app.issue_call.examples.bills", "Related bill(s)"), items: example.relatedBills)
                        chipRow(title: l("app.issue_call.examples.relevance", "Why your reps are relevant"), items: example.repRelevance)
                        chipRow(title: l("app.issue_call.examples.template_asks", "Template asks"), items: example.templateAsks.map(\.title))

                        scriptBlock(title: l("app.issue_call.script.live", "Live-call script"), text: example.liveScript)
                        scriptBlock(title: l("app.issue_call.script.voicemail", "Voicemail"), text: example.voicemailScript)

                        if let footer = example.voicemailFooter, !footer.isEmpty {
                            Text(footer)
                                .font(.caption)
                                .foregroundColor(VoteNowColors.mutedText)
                        }

                        Button {
                            focusedField = nil
                            didCompleteMAPC = false
                            isTalkingPointsExpanded = false
                            Task {
                                await viewModel.startMAPC(from: example)
                            }
                        } label: {
                            Text(l("app.issue_call.examples.use_for_mapc", "Use this issue for MAPC"))
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
        let summary = viewModel.callScoreSummary
        let score = summary?.callScore ?? 0
        let tier = summary?.tierName ?? l("app.issue_call.score.tier.not_active", "Not Active Yet")

        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Text(l("app.issue_call.score.title", "Call Score"))
                    .font(.headline)
                Spacer()
                Text("\(score)/100")
                    .font(.title2.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryCTA)
            }

            Text(tier)
                .font(.subheadline.weight(.semibold))

            Text(summary?.explanation ?? l("app.issue_call.score.explanation", "Build a real civic calling habit with verified, non-duplicate calls over time."))
                .font(.footnote)
                .foregroundColor(VoteNowColors.primaryText)

            if let leaderboardSummary = viewModel.leaderboardSummary {
                Text(
                    l(
                        "app.issue_call.score.leaderboard.summary",
                        "This month: \(leaderboardSummary.eligibleVerifiedCallCount) eligible calls across \(leaderboardSummary.uniqueOfficeCount) office(s)."
                    )
                )
                .font(.caption)
                .foregroundColor(VoteNowColors.mutedText)
            }

            Button {
                showBreakdownSheet = true
            } label: {
                Text(l("app.issue_call.score.action.breakdown", "View score breakdown"))
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("issue_call.score.breakdown")
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

    @ViewBuilder
    private var callScoreBreakdownSheet: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    if let breakdown = viewModel.callScoreBreakdown {
                        Text("\(l("app.issue_call.score.title", "Call Score")): \(breakdown.callScore)/100")
                            .font(.title3.weight(.bold))
                        Text(breakdown.tierName)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryCTA)

                        scoreBreakdownRow(
                            title: l("app.issue_call.score.activation", "Activation"),
                            value: breakdown.components.activationPoints,
                            maxPoints: breakdown.maxima.activationPoints
                        )
                        scoreBreakdownRow(
                            title: l("app.issue_call.score.recency", "Recency"),
                            value: breakdown.components.recencyPoints,
                            maxPoints: breakdown.maxima.recencyPoints
                        )
                        scoreBreakdownRow(
                            title: l("app.issue_call.score.consistency", "Consistency"),
                            value: breakdown.components.consistencyPoints,
                            maxPoints: breakdown.maxima.consistencyPoints
                        )
                        scoreBreakdownRow(
                            title: l("app.issue_call.score.breadth", "Breadth"),
                            value: breakdown.components.breadthPoints,
                            maxPoints: breakdown.maxima.breadthPoints
                        )
                        scoreBreakdownRow(
                            title: l("app.issue_call.score.momentum", "Momentum"),
                            value: breakdown.components.momentumPoints,
                            maxPoints: breakdown.maxima.momentumPoints
                        )

                        if !viewModel.callScoreHistory.isEmpty {
                            Text(l("app.issue_call.score.history", "Recent scoring history"))
                                .font(.headline)
                                .padding(.top, 4)
                            ForEach(viewModel.callScoreHistory.prefix(8)) { item in
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(item.officeID)
                                            .font(.caption.weight(.semibold))
                                        Text(item.completedConfirmedAt.formatted(date: .abbreviated, time: .shortened))
                                            .font(.caption2)
                                            .foregroundColor(VoteNowColors.mutedText)
                                    }
                                    Spacer()
                                    Text(
                                        item.scoringEligible
                                        ? l("app.issue_call.score.history.eligible", "Eligible")
                                        : l("app.issue_call.score.history.duplicate", "Duplicate")
                                    )
                                    .font(.caption.weight(.semibold))
                                    .foregroundColor(item.scoringEligible ? VoteNowColors.successGreen : VoteNowColors.warningAmber)
                                }
                                .padding(8)
                                .background(VoteNowColors.infoSurfaceBlue)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            }
                        }
                    } else {
                        Text(l("app.issue_call.score.loading", "Loading score breakdown..."))
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                }
                .padding(16)
            }
            .background(VoteNowColors.brandSoftBlue.ignoresSafeArea())
            .navigationTitle(l("app.issue_call.score.breakdown.title", "Score Breakdown"))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(l("app.issue_call.alert.done", "Done")) {
                        showBreakdownSheet = false
                    }
                }
            }
        }
    }

    private var historyTrackerSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(l("app.issue_call.tracker.title", "Call Tracker"))
                .font(.headline)

            if trackerGroups.isEmpty {
                Text(l("app.issue_call.history.empty", "Your call history will appear here after you generate and log call briefs."))
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
            } else {
                ForEach(trackerGroups.prefix(4)) { group in
                    let outcomeRows = trackerOutcomeRows(for: group)

                    VStack(alignment: .leading, spacing: 8) {
                        HStack(alignment: .top, spacing: 10) {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(group.issueTitle)
                                    .font(.headline)
                                    .lineLimit(2)

                                Text(group.issueSummary)
                                    .font(.subheadline)
                                    .foregroundColor(VoteNowColors.primaryText)
                                    .lineLimit(2)
                            }

                            Spacer(minLength: 0)

                            VStack(alignment: .trailing, spacing: 6) {
                                Text(group.date.formatted(date: .abbreviated, time: .shortened))
                                    .font(.caption)
                                    .foregroundColor(VoteNowColors.mutedText)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 5)
                                    .background(VoteNowColors.infoSurfaceBlue)
                                    .clipShape(Capsule())

                                if !outcomeRows.isEmpty {
                                    Text("\(outcomeRows.count) of 3 reps")
                                        .font(.caption2.weight(.semibold))
                                        .foregroundColor(VoteNowColors.mutedText)
                                }
                            }
                        }

                        if !outcomeRows.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(l("app.issue_call.history.outcomes", "Recent outcomes"))
                                    .font(.subheadline.weight(.semibold))

                                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 6) {
                                    ForEach(outcomeRows) { row in
                                        VStack(alignment: .leading, spacing: 2) {
                                            Text(row.repName)
                                                .font(.caption.weight(.semibold))
                                                .lineLimit(1)
                                            Text(row.outcome.title)
                                                .font(.caption2)
                                                .foregroundColor(VoteNowColors.mutedText)
                                                .lineLimit(1)
                                        }
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                        .padding(.horizontal, 8)
                                        .padding(.vertical, 6)
                                        .background(VoteNowColors.infoSurfaceBlue.opacity(0.9))
                                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                                    }
                                }
                            }
                        }

                        Button {
                            viewModel.reopen(historyGroup: group.representativeGroup)
                        } label: {
                            Text(l("app.issue_call.history.reopen", "Reopen brief"))
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

    @ViewBuilder
    private func scoreBreakdownRow(title: String, value: Int, maxPoints: Int) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Spacer()
                Text("\(value)/\(maxPoints)")
                    .font(.subheadline.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryCTA)
            }
            GeometryReader { geo in
                let ratio = maxPoints > 0 ? CGFloat(value) / CGFloat(maxPoints) : 0
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(VoteNowColors.infoSurfaceBlue.opacity(0.8))
                        .frame(height: 8)
                    Capsule()
                        .fill(VoteNowColors.primaryCTA)
                        .frame(width: Swift.max(0, geo.size.width * ratio), height: 8)
                }
            }
            .frame(height: 8)
        }
        .padding(10)
        .background(VoteNowColors.surfaceWhite)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(VoteNowColors.borderWarm.opacity(0.7), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func scriptBlock(title: String, text: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.subheadline.weight(.semibold))
            Text(text)
                .font(.footnote)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(VoteNowColors.infoSurfaceBlue)
        .clipShape(RoundedRectangle(cornerRadius: 9, style: .continuous))
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

    private func outcomeButtons(_ brief: CivicCallBrief) -> some View {
        let selectableOutcomes: [CivicCallOutcome] = [
            .voicemail,
            .supportive,
            .opposed,
            .undecided,
            .followUpRequested,
            .other
        ]
        let selectedOutcome = viewModel.loggedOutcomeByBriefID[brief.id]

        return VStack(alignment: .leading, spacing: 8) {
            Text(l("app.issue_call.outcomes", "Log outcome"))
                .font(.subheadline.weight(.semibold))
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 120), spacing: 8)], spacing: 8) {
                ForEach(selectableOutcomes) { outcome in
                    Button {
                        Task {
                            await viewModel.logOutcome(for: brief, outcome: outcome)
                        }
                    } label: {
                        Text(outcome.title)
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(selectedOutcome == outcome ? .white : VoteNowColors.primaryText)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(
                                selectedOutcome == outcome
                                ? VoteNowColors.warningAmber
                                : VoteNowColors.infoSurfaceBlue.opacity(0.95)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm.opacity(0.95), lineWidth: 1)
                            )
                    }
                    .buttonStyle(.plain)
                }
            }
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
