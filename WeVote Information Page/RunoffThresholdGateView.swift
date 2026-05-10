import CivicaDesignSystem
import SwiftUI

struct RunoffThresholdGateView: View {
    let title: String
    let stateCode: String?
    let stateName: String?
    let isEmbedded: Bool

    init(title: String, stateCode: String? = nil, stateName: String? = nil, isEmbedded: Bool = false) {
        self.title = title
        self.stateCode = stateCode
        self.stateName = stateName
        self.isEmbedded = isEmbedded
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var roundOneShares = RunoffThresholdGateEngine.defaultRoundOneShares
    @State private var transferToFirstFinalistByCandidateID = RunoffThresholdGateEngine.defaultTransferToFirstFinalistByCandidateID
    @State private var stage: Stage = .editingRound1
    @State private var roundTwoShares = RunoffThresholdGateEngine.defaultRoundTwoShares
    @State private var hasAdjustedRoundOneShares = false
    @State private var currentStagePage: RunoffStagePage = .roundOne
    @State private var showNoMajorityFlash = false

    @FocusState private var focusedField: FocusedField?

    enum Stage {
        case editingRound1
        case round1Counted
        case runoffAdvanced
        case round2Counted
    }

    enum RunoffStagePage: Hashable {
        case roundOne
        case runoff
    }

    enum FocusedField: Hashable {
        case roundOneSlider(Int)
        case transferSlider(Int)
    }

    private let candidatePalette: [Color] = [
        Color(red: 0.00, green: 0.72, blue: 0.78),
        Color(red: 0.96, green: 0.58, blue: 0.18),
        Color(red: 0.53, green: 0.78, blue: 0.22)
    ]
    private static let runoffRulesByStateCode: [String: RunoffThresholdStateRule] = {
        guard let url = Bundle.main.url(forResource: "USRunoffThresholdRulesByState", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: RunoffThresholdStateRule].self, from: data) else {
            return [:]
        }
        return decoded
    }()

    private var roundOneResult: ThresholdGateRoundOneResult {
        RunoffThresholdGateEngine.roundOneResult(shares: roundOneShares, threshold: configuredThreshold)
    }

    private var configuredThreshold: Double {
        stateRule?.primaryThresholdPercent ?? RunoffThresholdGateEngine.defaultThreshold
    }

    private var stateRule: RunoffThresholdStateRule? {
        guard let stateCode else { return nil }
        return Self.runoffRulesByStateCode[stateCode.uppercased()]
    }

    private var topTwoIndices: [Int] {
        roundOneResult.topTwoIndices
    }

    private var eliminatedIndices: [Int] {
        RunoffThresholdGateEngine.candidates.map(\.id).filter { !topTwoIndices.contains($0) }
    }

    private var hasMajorityWinner: Bool {
        roundOneResult.hasMajorityWinner
    }

    private var runoffIsFeasible: Bool {
        !hasMajorityWinner
    }

    private var showsPagedRunoffExperience: Bool {
        hasAdjustedRoundOneShares
    }

    private var isRunoffStageVisible: Bool {
        showsPagedRunoffExperience && currentStagePage == .runoff
    }

    private var firstFinalistIndex: Int? {
        topTwoIndices.first
    }

    private var secondFinalistIndex: Int? {
        topTwoIndices.dropFirst().first
    }

    private var previewRunoffShares: [Double] {
        guard topTwoIndices.count == 2 else { return RunoffThresholdGateEngine.defaultRoundTwoShares }
        return RunoffThresholdGateEngine.runoffShares(
            roundOneShares: roundOneShares,
            transferToFirstFinalistByCandidateID: transferToFirstFinalistByCandidateID,
            finalists: topTwoIndices
        )
    }

    var body: some View {
        Group {
            if isEmbedded {
                GeometryReader { proxy in
                    let compact = proxy.size.width < 960
                    VStack(spacing: CivicaSpacing.sm) {
                        stageScene(compact: compact)
                    }
                    .frame(maxWidth: .infinity, alignment: .top)
                    .frame(height: 520, alignment: .top)
                }
                .frame(height: 520, alignment: .top)
                .clipped()
            } else {
                GeometryReader { proxy in
                    let compact = proxy.size.width < 960

                    ZStack {
                        LinearGradient(
                            colors: [
                                Color(red: 0.95, green: 0.96, blue: 0.97),
                                Color(red: 0.92, green: 0.94, blue: 0.95)
                            ],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                        .ignoresSafeArea()

                        VStack(spacing: CivicaSpacing.sm) {
                            header

                            ScrollView {
                                VStack(spacing: CivicaSpacing.sm) {
                                    stageScene(compact: compact)
                                }
                                .padding(.horizontal, CivicaSpacing.md)
                                .padding(.bottom, CivicaSpacing.md)
                            }
                        }
                        .padding(.top, CivicaSpacing.xs)
                    }
                }
            }
        }
        .onAppear(perform: resetAll)
    }

    private var header: some View {
        HStack(spacing: CivicaSpacing.sm) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundColor(CivicaColors.textPrimary.opacity(0.75))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close runoff threshold gate demo")

            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                Text(title)
                    .font(CivicaTypography.sectionHeaderBold)
                    .foregroundColor(CivicaColors.textPrimary)
                Text("Threshold Gate")
                    .font(CivicaTypography.caption)
                    .foregroundColor(CivicaColors.textSecondary)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, CivicaSpacing.lg)
    }

    private func roundOneSlider(_ candidate: ThresholdGateCandidate) -> some View {
        let index = candidate.id
        let share = roundOneShares[index]
        let candidateColor = colorForCandidate(index)

        return HStack(spacing: CivicaSpacing.sm) {
            Text(candidate.label)
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.textPrimary)
                .frame(width: 96, alignment: .leading)

            Slider(
                value: Binding(
                    get: { roundOneShares[index] },
                    set: { newValue in
                        hasAdjustedRoundOneShares = true
                        roundOneShares = RunoffThresholdGateEngine.adjustedShares(
                            currentShares: roundOneShares,
                            updating: index,
                            to: newValue
                        )
                        applyDerivedStateFromInputs()
                    }
                ),
                in: 0...100,
                step: 0.5
            )
            .focused($focusedField, equals: .roundOneSlider(index))
            .accessibilityLabel("\(candidate.label) round 1 vote share")
            .accessibilityValue("\(Int(share.rounded())) percent")

            Text("\(Int(share.rounded()))%")
                .font(CivicaTypography.captionStrong)
                .foregroundColor(CivicaColors.textSecondary)
                .frame(width: 42, alignment: .trailing)
        }
        .padding(.horizontal, CivicaSpacing.sm)
        .padding(.vertical, CivicaSpacing.sm)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .fill(candidateColor.opacity(0.13))
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                .stroke(candidateColor.opacity(0.35), lineWidth: 1)
        )
    }

    @ViewBuilder
    private func stageScene(compact: Bool) -> some View {
        if showsPagedRunoffExperience {
            let embeddedTabHeight: CGFloat = compact ? 470 : 500
            VStack(spacing: CivicaSpacing.sm) {
                TabView(selection: $currentStagePage) {
                    roundOneStage(compact: compact)
                        .tag(RunoffStagePage.roundOne)
                    runoffStage
                        .tag(RunoffStagePage.runoff)
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .frame(height: isEmbedded ? embeddedTabHeight : (compact ? 620 : 640))

                HStack(spacing: CivicaSpacing.sm) {
                    pagerDot(for: .roundOne)
                    pagerDot(for: .runoff)
                }
                .frame(maxWidth: .infinity)
                .padding(.top, CivicaSpacing.xs)
                .padding(.bottom, CivicaSpacing.xs)
            }
        } else {
            roundOneStage(compact: compact)
        }
    }

    private func pagerDot(for page: RunoffStagePage) -> some View {
        let isSelected = currentStagePage == page
        return Button {
            withAnimation(reduceMotion ? nil : CivicaAnimation.standard) {
                currentStagePage = page
            }
        } label: {
            Circle()
                .fill(isSelected ? CivicaColors.brickPrimary : CivicaColors.borderSubtle.opacity(0.9))
                .frame(width: isSelected ? 10 : 8, height: isSelected ? 10 : 8)
                .overlay(
                    Circle()
                        .stroke(CivicaColors.brickPrimary.opacity(isSelected ? 0 : 0.35), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(page == .roundOne ? "Show round 1 page" : "Show runoff page")
    }

    private func roundOneStage(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(roundOneHeaderText)
                .font(CivicaTypography.sectionHeader)
                .foregroundColor(CivicaColors.textPrimary)

            GeometryReader { geometry in
                let barAreaHeight = geometry.size.height - 42
                let displayMax = roundOneDisplayMax(maxShare: roundOneShares.max() ?? 0)
                let safeDisplayMax = max(1, displayMax)
                let thresholdY = barAreaHeight * (1 - CGFloat(min(configuredThreshold, safeDisplayMax) / safeDisplayMax))
                let thresholdLabelY = max(4, thresholdY - 12)

                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .fill(Color.white)

                    Path { path in
                        path.move(to: CGPoint(x: 10, y: thresholdY + 10))
                        path.addLine(to: CGPoint(x: geometry.size.width - 10, y: thresholdY + 10))
                    }
                    .stroke(Color.black.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))

                    Text("\(Int(configuredThreshold))% threshold")
                        .font(CivicaTypography.captionStrong)
                        .foregroundColor(CivicaColors.textPrimary)
                        .padding(.horizontal, CivicaSpacing.xs)
                        .padding(.vertical, CivicaSpacing.xs)
                        .background(Color.white.opacity(0.9), in: Capsule())
                        .offset(x: 14, y: thresholdLabelY)

                    HStack(alignment: .bottom, spacing: CivicaSpacing.sm) {
                        ForEach(RunoffThresholdGateEngine.candidates) { candidate in
                            roundOneBar(
                                for: candidate,
                                maxHeight: barAreaHeight - 12,
                                displayMax: displayMax
                            )
                        }
                    }
                    .padding(.horizontal, CivicaSpacing.md)
                    .padding(.bottom, CivicaSpacing.sm)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                    if stage == .round1Counted && !hasMajorityWinner {
                        Text("No majority")
                            .font(CivicaTypography.captionStrong)
                            .foregroundColor(CivicaColors.textPrimary)
                            .padding(.horizontal, CivicaSpacing.sm)
                            .padding(.vertical, CivicaSpacing.xs)
                            .background(Color.white.opacity(0.9), in: Capsule())
                            .overlay(
                                Capsule()
                                    .stroke(Color.black.opacity(0.15), lineWidth: 1)
                            )
                            .offset(x: geometry.size.width - 130, y: 12)
                            .opacity(showNoMajorityFlash ? 1 : 0.55)
                    }
                }
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )
            }
            .frame(height: compact ? 176 : 216)

            ForEach(RunoffThresholdGateEngine.candidates) { candidate in
                roundOneSlider(candidate)
            }

            if roundOneResult.majorityWinnerIndex != nil {
                Text("Outcome: 🏆 a candidate reached a majority in Round 1, so no runoff is needed.")
                    .font(CivicaTypography.caption)
                    .foregroundColor(CivicaColors.textSecondary)
            } else {
                Text(runoffThresholdSummaryText)
                    .font(CivicaTypography.caption)
                    .foregroundColor(CivicaColors.textSecondary)

                Text("Outcome: no majority in Round 1, so two candidates advance to runoff.")
                    .font(CivicaTypography.caption)
                    .foregroundColor(CivicaColors.textSecondary)

                if showsPagedRunoffExperience {
                    Text("Swipe right to view runoff stage")
                        .font(CivicaTypography.captionStrong)
                        .foregroundColor(CivicaColors.textSecondary)
                }
            }

        }
        .padding(CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    private var runoffStage: some View {
        let shares = stage == .round2Counted ? roundTwoShares : previewRunoffShares

        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text("Runoff stage")
                .font(CivicaTypography.sectionHeader)
                .foregroundColor(CivicaColors.textPrimary)

            if hasMajorityWinner {
                Text("Runoff is not needed because a majority was reached in Round 1.")
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("What happens next?")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundColor(CivicaColors.textPrimary)
                    Text("The top two candidates move into a runoff. The candidate with more votes in this round wins.")
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.textPrimary)
                }
                .padding(.bottom, CivicaSpacing.xs)

                ForEach(Array(shares.enumerated()), id: \.offset) { idx, share in
                    runoffBar(indexInRunoff: idx, share: share)
                }

                Text("Runoff preview based on transfer sliders.")
                    .font(CivicaTypography.caption)
                    .foregroundColor(CivicaColors.textSecondary)

                VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                    Text("Round 2 transfer controls")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundColor(CivicaColors.textPrimary)

                    if let firstIndex = firstFinalistIndex,
                       let secondIndex = secondFinalistIndex {
                        let firstName = RunoffThresholdGateEngine.candidates[firstIndex].label
                        let secondName = RunoffThresholdGateEngine.candidates[secondIndex].label

                        ForEach(eliminatedIndices, id: \.self) { eliminatedIndex in
                            let eliminatedName = RunoffThresholdGateEngine.candidates[eliminatedIndex].label
                            let toFirst = transferToFirstFinalistByCandidateID[eliminatedIndex, default: 50]
                            let toSecond = 100 - toFirst

                            VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                                Text("\(eliminatedName) support split")
                                    .font(CivicaTypography.subheadStrong)
                                    .foregroundColor(CivicaColors.textPrimary)

                                Slider(
                                    value: Binding(
                                        get: { transferToFirstFinalistByCandidateID[eliminatedIndex, default: 50] },
                                        set: { newValue in
                                            transferToFirstFinalistByCandidateID[eliminatedIndex] = newValue.rounded()
                                            applyDerivedStateFromInputs()
                                        }
                                    ),
                                    in: 0...100,
                                    step: 1
                                )
                                .focused($focusedField, equals: .transferSlider(eliminatedIndex))
                                .accessibilityLabel("\(eliminatedName) support transfer")
                                .accessibilityValue("\(Int(toFirst)) percent to \(firstName), \(Int(toSecond)) percent to \(secondName)")

                                Text("\(Int(toFirst))% to \(firstName), \(Int(toSecond))% to \(secondName)")
                                    .font(CivicaTypography.caption)
                                    .foregroundColor(CivicaColors.textSecondary)
                            }
                            .padding(.horizontal, CivicaSpacing.sm)
                            .padding(.vertical, CivicaSpacing.sm)
                            .background(
                                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                    .fill(colorForCandidate(eliminatedIndex).opacity(0.13))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                    .stroke(colorForCandidate(eliminatedIndex).opacity(0.35), lineWidth: 1)
                            )
                        }
                    }
                }

                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text("Why this matters")
                        .font(CivicaTypography.subheadStrong)
                        .foregroundColor(CivicaColors.textPrimary)
                    Text("Second-choice support can change final results even if a candidate leads in Round 1.")
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.textPrimary)
                }
                .padding(.top, CivicaSpacing.xs)
            }
        }
        .padding(CivicaSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .fill(CivicaColors.surfacePrimary)
        )
        .overlay(
            RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
        )
    }

    private func roundOneBar(for candidate: ThresholdGateCandidate, maxHeight: CGFloat, displayMax: Double) -> some View {
        let share = roundOneShares[candidate.id]
        let isTopTwo = topTwoIndices.contains(candidate.id)
        let shouldDim = (stage == .round1Counted || stage == .runoffAdvanced || stage == .round2Counted) && !hasMajorityWinner && !isTopTwo
        let shouldZoom = (stage == .runoffAdvanced || stage == .round2Counted) && isTopTwo && !hasMajorityWinner

        return VStack(spacing: CivicaSpacing.xs) {
            Spacer(minLength: 0)

            RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                .fill(colorForCandidate(candidate.id))
                .frame(height: max(12, maxHeight * CGFloat(share / max(1, displayMax))))
                .overlay(
                    VStack(spacing: CivicaSpacing.xs) {
                        Text("\(Int(share.rounded()))%")
                            .font(CivicaTypography.captionStrong)
                        Text(roundOneOutcomeText(for: candidate.id))
                            .font(CivicaTypography.captionStrong)
                            .lineLimit(2)
                            .multilineTextAlignment(.center)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, CivicaSpacing.xs)
                    .padding(.vertical, CivicaSpacing.xs)
                    .background(
                        RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                            .fill(Color.black.opacity(0.22))
                    )
                    .padding(.bottom, CivicaSpacing.xs),
                    alignment: .bottom
                )

            Text(candidate.label)
                .font(CivicaTypography.captionStrong)
                .foregroundColor(CivicaColors.textPrimary)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .frame(height: 26)
        }
        .opacity(shouldDim ? 0.28 : 1)
        .scaleEffect(shouldZoom ? 1.08 : 1)
        .offset(y: shouldZoom ? -8 : 0)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.25), value: share)
        .animation(reduceMotion ? nil : .spring(response: 0.35, dampingFraction: 0.85), value: shouldZoom)
        .animation(reduceMotion ? nil : .easeInOut(duration: 0.22), value: shouldDim)
    }

    private func runoffBar(indexInRunoff: Int, share: Double) -> some View {
        let candidateIndex = indexInRunoff == 0 ? firstFinalistIndex : secondFinalistIndex
        let colorIndex = candidateIndex ?? indexInRunoff
        let candidateColor = colorForCandidate(colorIndex)
        let label = candidateIndex.flatMap { idx in
            RunoffThresholdGateEngine.candidates.first(where: { $0.id == idx })?.label
        } ?? "Finalist \(indexInRunoff + 1)"

        return VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            HStack {
                Text(label)
                    .font(CivicaTypography.subheadStrong)
                    .foregroundColor(CivicaColors.textPrimary)
                Spacer(minLength: 0)
                Text("\(Int(share.rounded()))%")
                    .font(CivicaTypography.captionStrong)
                    .foregroundColor(CivicaColors.textSecondary)
            }

            GeometryReader { geometry in
                let clampedShare = share.isFinite ? min(max(share, 0), 100) : 0
                let fillWidth = geometry.size.width * CGFloat(clampedShare / 100)
                let labelWidth = min(max(44, fillWidth - 8), 110)
                RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                    .fill(candidateColor.opacity(0.18))
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                            .fill(candidateColor)
                            .frame(width: fillWidth)
                            .overlay(alignment: .trailing) {
                                Text(runoffOutcomeText(for: share, indexInRunoff: indexInRunoff))
                                    .font(CivicaTypography.captionStrong)
                                    .foregroundColor(.white)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.center)
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(width: labelWidth)
                                    .padding(.horizontal, CivicaSpacing.xs)
                                    .padding(.vertical, CivicaSpacing.xs)
                                    .background(
                                        RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                                            .fill(Color.black.opacity(0.25))
                                    )
                                    .padding(.trailing, CivicaSpacing.xs)
                            }
                    }
            }
            .frame(height: 18)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label), \(Int(share.rounded())) percent in runoff")
    }

    private func colorForCandidate(_ candidateIndex: Int) -> Color {
        candidatePalette[candidateIndex % candidatePalette.count]
    }

    private func roundOneOutcomeText(for candidateID: Int) -> String {
        if let winner = roundOneResult.majorityWinnerIndex {
            return candidateID == winner ? "🏆 Winner" : "Not Advancing"
        }
        return topTwoIndices.contains(candidateID) ? "➡️ Advances" : "❌ Eliminated"
    }

    private func runoffOutcomeText(for share: Double, indexInRunoff: Int) -> String {
        guard roundTwoShares.count == 2 else { return "Finalist" }
        let other = roundTwoShares[1 - indexInRunoff]
        if share == other { return "🤝 Tie" }
        return share > other ? "🏆 Winner" : "❌ Loses"
    }

    private func roundOneDisplayMax(maxShare: Double) -> Double {
        let lowerBound = max(configuredThreshold + 8, 55)
        let paddedMax = maxShare + 8
        let raw = min(100, max(lowerBound, paddedMax))
        return min(100, ceil(raw / 5) * 5)
    }

    private var runoffThresholdExplainerText: String {
        if let stateRule {
            if let percent = stateRule.primaryThresholdPercent {
                return "If nobody reaches \(stateRule.state)'s \(Int(percent))% threshold, the top two advance to a runoff."
            }

            let label = stateRule.primaryThresholdLabel.trimmingCharacters(in: .whitespacesAndNewlines)
            if !label.isEmpty {
                return "If nobody reaches \(stateRule.state)'s \(label) threshold, the top two advance to a runoff."
            }
            return "If nobody reaches \(stateRule.state)'s threshold, the top two advance to a runoff."
        }

        if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "If nobody reaches \(stateName)'s \(Int(configuredThreshold))% threshold, the top two advance to a runoff."
        }

        return "If nobody reaches the \(Int(configuredThreshold))% threshold, the top two advance to a runoff."
    }

    private var runoffThresholdSummaryText: String {
        if let stateRule {
            if let percent = stateRule.primaryThresholdPercent {
                return "\(stateRule.state) has a \(Int(percent))% threshold to avoid a runoff."
            }

            let label = stateRule.primaryThresholdLabel.trimmingCharacters(in: .whitespacesAndNewlines)
            if !label.isEmpty {
                return "\(stateRule.state) has a \(label) threshold to avoid a runoff."
            }
            return "\(stateRule.state) uses a threshold rule to avoid a runoff."
        }

        if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "\(stateName) has a \(Int(configuredThreshold))% threshold to avoid a runoff."
        }

        return "This election uses a \(Int(configuredThreshold))% threshold to avoid a runoff."
    }

    private var roundOneHeaderText: String {
        if let stateRule {
            if let percent = stateRule.primaryThresholdPercent {
                return "Round 1 — \(stateRule.state) threshold: \(Int(percent))%"
            }

            let label = stateRule.primaryThresholdLabel.trimmingCharacters(in: .whitespacesAndNewlines)
            if !label.isEmpty {
                return "Round 1 — \(stateRule.state) threshold: \(label)"
            }
            return "Round 1 — \(stateRule.state) threshold rule"
        }

        if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            return "Round 1 — \(stateName) threshold: \(Int(configuredThreshold))%"
        }

        return "Round 1 — threshold: \(Int(configuredThreshold))%"
    }

    private func resetAll() {
        roundOneShares = RunoffThresholdGateEngine.defaultRoundOneShares
        transferToFirstFinalistByCandidateID = RunoffThresholdGateEngine.defaultTransferToFirstFinalistByCandidateID
        roundTwoShares = RunoffThresholdGateEngine.defaultRoundTwoShares
        hasAdjustedRoundOneShares = false
        currentStagePage = .roundOne
        applyDerivedStateFromInputs()
    }

    private func applyDerivedStateFromInputs() {
        roundTwoShares = RunoffThresholdGateEngine.runoffShares(
            roundOneShares: roundOneShares,
            transferToFirstFinalistByCandidateID: transferToFirstFinalistByCandidateID,
            finalists: topTwoIndices
        )
        stage = hasMajorityWinner ? .round1Counted : .runoffAdvanced
        showNoMajorityFlash = false
    }
}

private struct RunoffThresholdStateRule: Decodable {
    let stateCode: String
    let state: String
    let stateEmoji: String
    let primaryThresholdLabel: String
    let primaryThresholdPercent: Double?
    let primaryRunoffRule: String
    let generalThresholdLabel: String
    let generalRunoffRule: String
    let notes: String
    let sources: String
}

struct RunoffThresholdGateView_Previews: PreviewProvider {
    static var previews: some View {
        RunoffThresholdGateView(title: "Runoff Rules")
            .previewDisplayName("Runoff Threshold Gate")
    }
}
