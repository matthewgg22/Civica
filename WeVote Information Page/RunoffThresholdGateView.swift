import SwiftUI

struct RunoffThresholdGateView: View {
    let title: String
    let stateCode: String?
    let stateName: String?

    init(title: String, stateCode: String? = nil, stateName: String? = nil) {
        self.title = title
        self.stateCode = stateCode
        self.stateName = stateName
    }

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var roundOneShares = RunoffThresholdGateEngine.defaultRoundOneShares
    @State private var transferToFirstFinalistByCandidateID = RunoffThresholdGateEngine.defaultTransferToFirstFinalistByCandidateID
    @State private var stage: Stage = .editingRound1
    @State private var roundTwoShares = RunoffThresholdGateEngine.defaultRoundTwoShares
    @State private var showNoMajorityFlash = false
    @State private var activeTooltip: Tooltip?

    @FocusState private var focusedField: FocusedField?

    enum Stage {
        case editingRound1
        case round1Counted
        case runoffAdvanced
        case round2Counted
    }

    enum Tooltip: Identifiable {
        case transfer

        var id: String {
            switch self {
            case .transfer: return "transfer"
            }
        }

        var message: String {
            switch self {
            case .transfer:
                return "Each slider controls how an eliminated candidate's support splits between the finalists."
            }
        }
    }

    enum FocusedField: Hashable {
        case countRound1
        case advanceRunoff
        case countRound2
        case roundOneSlider(Int)
        case transferSlider(Int)
    }

    private let candidatePalette: [Color] = [
        Color(red: 0.36, green: 0.58, blue: 0.64),
        Color(red: 0.59, green: 0.62, blue: 0.49),
        Color(red: 0.71, green: 0.6, blue: 0.5)
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

    private var canAdvanceToRunoff: Bool {
        stage == .round1Counted && !hasMajorityWinner
    }

    private var canCountRoundTwo: Bool {
        (stage == .runoffAdvanced || stage == .round2Counted) && !hasMajorityWinner
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

                VStack(spacing: 10) {
                    header

                    ScrollView {
                        VStack(spacing: 10) {
                            explainerCard
                            controlsCard(compact: compact)
                            stageScene(compact: compact)
                            if stage == .runoffAdvanced || stage == .round2Counted {
                                transferControlsCard
                            }
                        }
                        .padding(.horizontal, 14)
                        .padding(.bottom, 14)
                    }
                }
                .padding(.top, 6)
            }
        }
        .onAppear(perform: resetAll)
        .popover(item: $activeTooltip, attachmentAnchor: .point(.top), arrowEdge: .top) { tip in
            Text(tip.message)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .padding(10)
                .frame(maxWidth: 260, alignment: .leading)
        }
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title3)
                    .foregroundColor(VoteNowColors.primaryText.opacity(0.75))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close runoff threshold gate demo")

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.headline.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryText)
                Text("Threshold Gate")
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
            }

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
    }

    private var explainerCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Runoff concept")
                .font(.headline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            Text("In this example, if nobody gets \(Int(configuredThreshold))%, the top two advance to a runoff.")
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)

            if let stateRule {
                Text("\(stateRule.stateEmoji) \(stateRule.state): threshold to avoid a runoff is \(stateRule.primaryThresholdLabel).")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            } else if let stateName, !stateName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("🇺🇸 \(stateName): threshold to avoid a runoff is \(Int(configuredThreshold))%.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    private func controlsCard(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Round 1 controls")
                    .font(.headline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Spacer()
            }

            ForEach(RunoffThresholdGateEngine.candidates) { candidate in
                roundOneSlider(candidate)
            }

            HStack(spacing: 8) {
                Text("Total")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
                Text("\(Int(roundOneShares.reduce(0, +).rounded()))%")
                    .font(.caption.weight(.bold))
                    .foregroundColor(VoteNowColors.primaryText)
            }

            actionButtonsRow(compact: compact)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    @ViewBuilder
    private func actionButtonsRow(compact: Bool) -> some View {
        if compact {
            VStack(spacing: 8) {
                HStack(spacing: 8) {
                    actionButton(
                        title: "Count Round 1",
                        isPrimary: true,
                        isDisabled: false,
                        focus: .countRound1,
                        action: countRoundOne
                    )
                    actionButton(
                        title: "Advance to Runoff",
                        isPrimary: false,
                        isDisabled: !canAdvanceToRunoff,
                        focus: .advanceRunoff,
                        action: advanceToRunoff
                    )
                }
                actionButton(
                    title: "Count Round 2",
                    isPrimary: false,
                    isDisabled: !canCountRoundTwo,
                    focus: .countRound2,
                    action: countRoundTwo
                )
            }
        } else {
            HStack(spacing: 8) {
                actionButton(
                    title: "Count Round 1",
                    isPrimary: true,
                    isDisabled: false,
                    focus: .countRound1,
                    action: countRoundOne
                )
                actionButton(
                    title: "Advance to Runoff",
                    isPrimary: false,
                    isDisabled: !canAdvanceToRunoff,
                    focus: .advanceRunoff,
                    action: advanceToRunoff
                )
                actionButton(
                    title: "Count Round 2",
                    isPrimary: false,
                    isDisabled: !canCountRoundTwo,
                    focus: .countRound2,
                    action: countRoundTwo
                )
            }
        }
    }

    private func actionButton(
        title: String,
        isPrimary: Bool,
        isDisabled: Bool,
        focus: FocusedField,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Text(title)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(isPrimary ? .white : VoteNowColors.primaryText)
                .lineLimit(1)
                .minimumScaleFactor(0.82)
                .frame(maxWidth: .infinity, minHeight: 42)
                .background(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .fill(isPrimary ? VoteNowColors.primaryCTA : Color.white)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 11, style: .continuous)
                        .stroke(isPrimary ? VoteNowColors.primaryCTA : VoteNowColors.borderWarm, lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .focused($focusedField, equals: focus)
        .overlay(roundedFocus(field: focus))
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.45 : 1)
        .accessibilityLabel(title)
    }

    private func roundOneSlider(_ candidate: ThresholdGateCandidate) -> some View {
        let index = candidate.id
        let share = roundOneShares[index]
        let candidateColor = colorForCandidate(index)

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(candidate.label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Spacer()
                Text("\(Int(share.rounded()))%")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
            }

            Slider(
                value: Binding(
                    get: { roundOneShares[index] },
                    set: { newValue in
                        roundOneShares = RunoffThresholdGateEngine.adjustedShares(
                            currentShares: roundOneShares,
                            updating: index,
                            to: newValue
                        )
                        invalidateAfterInputChange()
                    }
                ),
                in: 0...100,
                step: 0.5
            )
            .focused($focusedField, equals: .roundOneSlider(index))
            .accessibilityLabel("\(candidate.label) round 1 vote share")
            .accessibilityValue("\(Int(share.rounded())) percent")
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(candidateColor.opacity(0.13))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(candidateColor.opacity(0.35), lineWidth: 1)
        )
    }

    private func stageScene(compact: Bool) -> some View {
        let showRunoffStage = stage != .editingRound1 || hasMajorityWinner

        return Group {
            if compact {
                VStack(spacing: 10) {
                    roundOneStage(compact: true)
                    if showRunoffStage {
                        runoffStage
                    }
                }
            } else {
                HStack(alignment: .top, spacing: 10) {
                    roundOneStage(compact: false)
                    if showRunoffStage {
                        runoffStage
                            .frame(maxWidth: 320)
                    }
                }
            }
        }
    }

    private func roundOneStage(compact: Bool) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Round 1")
                .font(.headline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            GeometryReader { geometry in
                let barAreaHeight = geometry.size.height - 42
                let thresholdY = barAreaHeight * (1 - CGFloat(configuredThreshold / 100))

                ZStack(alignment: .topLeading) {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color.white)

                    Path { path in
                        path.move(to: CGPoint(x: 10, y: thresholdY + 10))
                        path.addLine(to: CGPoint(x: geometry.size.width - 10, y: thresholdY + 10))
                    }
                    .stroke(Color.black.opacity(0.6), style: StrokeStyle(lineWidth: 2, dash: [6, 4]))

                    Text("\(Int(configuredThreshold))% threshold")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 3)
                        .background(Color.white.opacity(0.9), in: Capsule())
                        .offset(x: 14, y: thresholdY - 12)

                    HStack(alignment: .bottom, spacing: 10) {
                        ForEach(RunoffThresholdGateEngine.candidates) { candidate in
                            roundOneBar(for: candidate, maxHeight: barAreaHeight - 12)
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.bottom, 8)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)

                    if stage == .round1Counted && !hasMajorityWinner {
                        Text("No majority")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
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
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
            }
            .frame(height: compact ? 196 : 246)

            if let winnerIndex = roundOneResult.majorityWinnerIndex {
                Text("Majority reached in Round 1 by \(RunoffThresholdGateEngine.candidates[winnerIndex].label).")
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
            } else {
                Text("Top two by Round 1: \(topTwoLabelText)")
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    private var runoffStage: some View {
        let shares = stage == .round2Counted ? roundTwoShares : previewRunoffShares

        return VStack(alignment: .leading, spacing: 6) {
            Text("Runoff stage")
                .font(.headline.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)

            if hasMajorityWinner {
                Text("Runoff is not needed because a majority was reached in Round 1.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(Array(shares.enumerated()), id: \.offset) { idx, share in
                    runoffBar(indexInRunoff: idx, share: share)
                }

                Text(stage == .round2Counted ? "Round 2 counted." : "Round 2 preview based on transfer sliders.")
                    .font(.caption)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    private var transferControlsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Round 2 transfer controls")
                    .font(.headline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Spacer()
                tooltipButton(.transfer)
            }

            if let firstIndex = firstFinalistIndex,
               let secondIndex = secondFinalistIndex {
                let firstName = RunoffThresholdGateEngine.candidates[firstIndex].label
                let secondName = RunoffThresholdGateEngine.candidates[secondIndex].label

                ForEach(eliminatedIndices, id: \.self) { eliminatedIndex in
                    let eliminatedName = RunoffThresholdGateEngine.candidates[eliminatedIndex].label
                    let toFirst = transferToFirstFinalistByCandidateID[eliminatedIndex, default: 50]
                    let toSecond = 100 - toFirst

                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(eliminatedName) support split")
                            .font(.subheadline.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)

                        Slider(
                            value: Binding(
                                get: { transferToFirstFinalistByCandidateID[eliminatedIndex, default: 50] },
                                set: { newValue in
                                    transferToFirstFinalistByCandidateID[eliminatedIndex] = newValue.rounded()
                                    if stage == .round2Counted {
                                        stage = .runoffAdvanced
                                    }
                                }
                            ),
                            in: 0...100,
                            step: 1
                        )
                        .focused($focusedField, equals: .transferSlider(eliminatedIndex))
                        .accessibilityLabel("\(eliminatedName) support transfer")
                        .accessibilityValue("\(Int(toFirst)) percent to \(firstName), \(Int(toSecond)) percent to \(secondName)")

                        Text("\(Int(toFirst))% to \(firstName), \(Int(toSecond))% to \(secondName)")
                            .font(.caption)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 8)
                    .background(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .fill(colorForCandidate(eliminatedIndex).opacity(0.13))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(colorForCandidate(eliminatedIndex).opacity(0.35), lineWidth: 1)
                    )
                }
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("What happens next?")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Text("The runoff winner becomes the final winner for this office.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)

                Divider()

                Text("Why this matters")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Text("Second-choice support can change the final result even when a candidate leads in Round 1.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
            }
            .padding(.top, 4)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(VoteNowColors.surfaceWhite)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
        )
    }

    private func roundOneBar(for candidate: ThresholdGateCandidate, maxHeight: CGFloat) -> some View {
        let share = roundOneShares[candidate.id]
        let isTopTwo = topTwoIndices.contains(candidate.id)
        let shouldDim = stage == .round1Counted && !hasMajorityWinner && !isTopTwo
        let shouldZoom = (stage == .runoffAdvanced || stage == .round2Counted) && isTopTwo && !hasMajorityWinner

        return VStack(spacing: 6) {
            Spacer(minLength: 0)

            RoundedRectangle(cornerRadius: 8, style: .continuous)
                .fill(colorForCandidate(candidate.id))
                .frame(height: max(12, maxHeight * CGFloat(share / 100)))
                .overlay(
                    Text("\(Int(share.rounded()))%")
                        .font(.caption2.weight(.semibold))
                        .foregroundColor(.white)
                        .padding(.bottom, 4),
                    alignment: .bottom
                )

            Text(candidate.label)
                .font(.caption2.weight(.semibold))
                .foregroundColor(VoteNowColors.primaryText)
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

        return VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(label)
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Spacer(minLength: 0)
                Text("\(Int(share.rounded()))%")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(VoteNowColors.mutedText)
            }

            GeometryReader { geometry in
                RoundedRectangle(cornerRadius: 8, style: .continuous)
                    .fill(candidateColor.opacity(0.18))
                    .overlay(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(candidateColor)
                            .frame(width: geometry.size.width * CGFloat(share / 100))
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

    private func tooltipButton(_ tooltip: Tooltip) -> some View {
        Button {
            activeTooltip = tooltip
        } label: {
            Image(systemName: "info.circle")
                .font(.subheadline)
                .foregroundColor(VoteNowColors.mutedText)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show info")
    }

    private func roundedFocus(field: FocusedField) -> some View {
        RoundedRectangle(cornerRadius: 11, style: .continuous)
            .stroke(
                focusedField == field ? VoteNowColors.primaryText.opacity(0.5) : .clear,
                lineWidth: 2
            )
    }

    private var topTwoLabelText: String {
        let labels = topTwoIndices.compactMap { idx in
            RunoffThresholdGateEngine.candidates.first(where: { $0.id == idx })?.label
        }
        return labels.joined(separator: " and ")
    }

    private func countRoundOne() {
        stage = .round1Counted

        if !hasMajorityWinner {
            triggerNoMajorityFlash()
        } else {
            showNoMajorityFlash = false
        }
    }

    private func advanceToRunoff() {
        guard canAdvanceToRunoff else { return }
        performAnimated {
            stage = .runoffAdvanced
        }
    }

    private func countRoundTwo() {
        guard canCountRoundTwo else { return }

        roundTwoShares = RunoffThresholdGateEngine.runoffShares(
            roundOneShares: roundOneShares,
            transferToFirstFinalistByCandidateID: transferToFirstFinalistByCandidateID,
            finalists: topTwoIndices
        )

        performAnimated {
            stage = .round2Counted
        }
    }

    private func resetAll() {
        roundOneShares = RunoffThresholdGateEngine.defaultRoundOneShares
        transferToFirstFinalistByCandidateID = RunoffThresholdGateEngine.defaultTransferToFirstFinalistByCandidateID
        roundTwoShares = RunoffThresholdGateEngine.defaultRoundTwoShares
        stage = .editingRound1
        showNoMajorityFlash = false
    }

    private func invalidateAfterInputChange() {
        if stage != .editingRound1 {
            stage = .editingRound1
        }
        showNoMajorityFlash = false
    }

    private func triggerNoMajorityFlash() {
        showNoMajorityFlash = true
        guard !reduceMotion else { return }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
            showNoMajorityFlash = false
        }
    }

    private func performAnimated(_ updates: () -> Void) {
        if reduceMotion {
            updates()
        } else {
            withAnimation(.easeInOut(duration: 0.25), updates)
        }
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
