import SwiftUI

struct TurnoutExplorer: View {
    let onSeeHowToVote: () -> Void
    let onTurnoutCueColorChange: (Color) -> Void

    @StateObject private var store = TurnoutExplorerStore()
    @State private var selectedElectionType: TurnoutElectionType = .presidential
    @State private var selectedRange: ClosedRange<Int> = 0...0
    @State private var showMethodologySheet = false
    @State private var didApplyDatasetDefaults = false

    init(
        onSeeHowToVote: @escaping () -> Void = {},
        onTurnoutCueColorChange: @escaping (Color) -> Void = { _ in }
    ) {
        self.onSeeHowToVote = onSeeHowToVote
        self.onTurnoutCueColorChange = onTurnoutCueColorChange
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Move the slider to see how big each age group shows up to vote in the U.S. electorate")
                .font(.subheadline)
                .foregroundColor(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)

            content
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            ZStack {
                turnoutCueColor.opacity(0.16)
                VoteNowColors.surfaceWhite.opacity(0.86)
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .sheet(isPresented: $showMethodologySheet) {
            MethodologySheet()
        }
        .onChange(of: store.datasetVersionToken) { _, _ in
            didApplyDatasetDefaults = false
            if let adapter = store.adapter {
                applyDefaults(from: adapter)
            }
            publishTurnoutCueColor()
        }
        .onChange(of: selectedElectionType) { _, _ in
            publishTurnoutCueColor()
        }
        .onChange(of: selectedRange) { _, _ in
            publishTurnoutCueColor()
        }
        .onAppear {
            publishTurnoutCueColor()
        }
    }

    @ViewBuilder
    private var content: some View {
        if let adapter = store.adapter {
            loadedContent(adapter: adapter)
                .onAppear {
                    applyDefaults(from: adapter)
                }
                .onChange(of: selectedElectionType) { _, _ in
                    let stops = adapter.sliderStops(for: selectedElectionType)
                    selectedRange = clampedRange(selectedRange, within: stops)
                }
        } else if let loadError = store.loadError {
            VStack(alignment: .leading, spacing: 8) {
                Text("Turnout explorer data is unavailable right now.")
                    .font(.subheadline.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)
                Text(loadError)
                    .font(.footnote)
                    .foregroundColor(VoteNowColors.mutedText)
            }
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VoteNowColors.surfaceWhite)
            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        } else {
            HStack(spacing: 10) {
                ProgressView()
                Text("Loading historical turnout data…")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
            }
            .padding(.vertical, 8)
        }
    }

    @ViewBuilder
    private func loadedContent(adapter: TurnoutExplorerDataAdapter) -> some View {
        let stops = adapter.sliderStops(for: selectedElectionType)
        let activeRange = clampedRange(selectedRange, within: stops)
        let summary = adapter.selectionSummary(for: selectedElectionType, range: activeRange)
        let diagnostics = adapter.diagnostics(for: selectedElectionType)

        VStack(alignment: .leading, spacing: 12) {
            if !stops.isEmpty {
                AgeTurnoutBandSlider(
                    stops: stops,
                    selectedRange: activeRange,
                    eligiblePopulationThousands: summary?.citizenPopulationThousands,
                    votedThousands: summary?.votedThousands,
                    turnoutRatePct: summary?.turnoutRatePct,
                    representationGapPoints: summary?.representationGapPoints,
                    onRangeChange: { newRange in
                        selectedRange = clampedRange(newRange, within: stops)
                    }
                )
            }

            if !diagnostics.isEmpty {
                TurnoutRiskMap(
                    diagnostics: diagnostics,
                    selectedRange: activeRange
                )
            }

            if let summary {
                let palette = TurnoutGraphPalette.palette(forTurnoutRate: summary.turnoutRatePct)
                ElectorateDonut(summary: summary, palette: palette)

                HStack(spacing: 12) {
                    LegendKey(color: palette.votedColor, text: "voted")
                    LegendKey(color: palette.nonvotingColor, text: "eligible but did not vote")
                    LegendKey(color: VoteNowColors.primaryText.opacity(0.18), text: "everyone else")
                }

                VStack(alignment: .leading, spacing: 8) {
                    HStack(alignment: .top, spacing: 8) {
                        MetricMiniStat(
                            title: "Eligible share",
                            value: TurnoutExplorerFormatters.percent(summary.eligibleSharePct),
                            backgroundColor: palette.nonvotingColor.opacity(0.16),
                            borderColor: palette.nonvotingColor.opacity(0.35)
                        )

                        MetricMiniStat(
                            title: "Ballot share",
                            value: TurnoutExplorerFormatters.percent(summary.ballotSharePct),
                            backgroundColor: palette.votedColor.opacity(0.16),
                            borderColor: palette.votedColor.opacity(0.35)
                        )

                        MetricMiniStat(
                            title: "Eligible voters",
                            value: TurnoutExplorerFormatters.compactPopulationFromThousands(summary.citizenPopulationThousands),
                            backgroundColor: VoteNowColors.primaryCTA.opacity(0.12),
                            borderColor: VoteNowColors.primaryCTA.opacity(0.28)
                        )
                    }

                    MetricStat(
                        title: "Representation",
                        value: representationLabel(for: summary.representationIndex),
                        helper: "\(TurnoutExplorerFormatters.signedPoints(summary.representationGapPoints)) vs eligible share • \(TurnoutExplorerFormatters.compactPopulationFromThousands(summary.votedThousands)) who actually voted",
                        backgroundColor: representationCardColor(for: summary.representationGapPoints).opacity(0.14),
                        borderColor: representationCardColor(for: summary.representationGapPoints).opacity(0.34)
                    )
                }

                VStack(alignment: .leading, spacing: 4) {
                    let lines = representationScaleLines(for: summary)
                    ForEach(Array(lines.enumerated()), id: \.offset) { index, line in
                        Text(line)
                            .font(index == 0 ? .subheadline.weight(.semibold) : .footnote)
                            .foregroundColor(index == 0 ? VoteNowColors.primaryText : VoteNowColors.mutedText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                ElectionTypeSegmentedControl(
                    selected: selectedElectionType,
                    onSelect: { value in
                        withAnimation(.easeInOut(duration: 0.25)) {
                            selectedElectionType = value
                        }
                    }
                )

                Button {
                    showMethodologySheet = true
                } label: {
                    Text("How this data works")
                        .font(.footnote.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text("No turnout record is available for this age range in the selected election type.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)
                    .padding(.vertical, 8)
            }
        }
    }

    private func applyDefaults(from adapter: TurnoutExplorerDataAdapter) {
        guard !didApplyDatasetDefaults else { return }

        selectedElectionType = adapter.defaultElectionType
        let stops = adapter.sliderStops(for: selectedElectionType)
        selectedRange = clampedRange(adapter.defaultRange(for: selectedElectionType), within: stops)
        didApplyDatasetDefaults = true
        publishTurnoutCueColor()
    }

    private func clampedRange(_ range: ClosedRange<Int>, within stops: [TurnoutAgeStop]) -> ClosedRange<Int> {
        guard !stops.isEmpty else { return 0...0 }

        let lower = min(max(range.lowerBound, 0), stops.count - 1)
        let upper = min(max(range.upperBound, 0), stops.count - 1)

        if lower <= upper {
            return lower...upper
        }
        return upper...lower
    }

    private func representationLabel(for index: Double) -> String {
        let tolerance = 0.01
        if index < 1 - tolerance {
            return "Underrepresented"
        }
        if index > 1 + tolerance {
            return "Overrepresented"
        }
        return "In line with population"
    }

    private func representationScaleLines(for summary: TurnoutExplorerSelectionSummary) -> [String] {
        let gap = summary.representationGapPoints
        let status: String
        if gap < -0.35 {
            status = "Underrepresented"
        } else if gap > 0.35 {
            status = "Overrepresented"
        } else {
            status = "Near parity"
        }

        let totalReportedVotersThousands: Double
        if summary.ballotSharePct > 0 {
            totalReportedVotersThousands = summary.votedThousands / (summary.ballotSharePct / 100)
        } else {
            totalReportedVotersThousands = 0
        }

        let expectedVotersThousands = totalReportedVotersThousands * (summary.eligibleSharePct / 100)
        let deltaVotersThousands = summary.votedThousands - expectedVotersThousands
        let absoluteDeltaVoters = abs(deltaVotersThousands * 1_000)

        let line2: String
        switch status {
        case "Underrepresented":
            line2 = "\(TurnoutExplorerFormatters.compactPopulationFromThousands(abs(deltaVotersThousands))) fewer voters than parity in \(summary.cycleDisplayName)."
        case "Overrepresented":
            line2 = "\(TurnoutExplorerFormatters.compactPopulationFromThousands(abs(deltaVotersThousands))) more voters than parity in \(summary.cycleDisplayName)."
        default:
            line2 = "Almost exactly proportional to population share in \(summary.cycleDisplayName)."
        }

        guard status != "Near parity", absoluteDeltaVoters >= 5_000 else {
            return [line2]
        }

        let line3 = "Scale: \(benchmarkText(forAbsoluteVoters: absoluteDeltaVoters))."
        return [line2, line3]
    }

    private func benchmarkText(forAbsoluteVoters value: Double) -> String {
        if value < 10_000 {
            return "~\(TurnoutExplorerFormatters.wholeNumber(value / 5_000)) close local-race margins"
        }
        if value < 250_000 {
            return "~\(TurnoutExplorerFormatters.wholeNumber(value / 25_000)) close House-race margins"
        }
        return "~\(TurnoutExplorerFormatters.wholeNumber(value / 100_000)) close statewide margins"
    }

    private var turnoutCueColor: Color {
        guard let adapter = store.adapter else {
            return VoteNowColors.primaryCTA
        }

        let stops = adapter.sliderStops(for: selectedElectionType)
        guard !stops.isEmpty else {
            return VoteNowColors.primaryCTA
        }

        let activeRange = clampedRange(selectedRange, within: stops)
        if let turnoutRate = adapter.selectionSummary(for: selectedElectionType, range: activeRange)?.turnoutRatePct {
            return TurnoutGraphPalette.palette(forTurnoutRate: turnoutRate).votedColor
        }

        return VoteNowColors.primaryCTA
    }

    private func publishTurnoutCueColor() {
        onTurnoutCueColorChange(turnoutCueColor)
    }

    private func representationCardColor(for gapPoints: Double) -> Color {
        if gapPoints < -0.2 {
            return VoteNowColors.urgentCTA
        }
        if gapPoints > 0.2 {
            return VoteNowColors.richBlue
        }
        return VoteNowColors.warningAmber
    }
}

private struct ElectionTypeSegmentedControl: View {
    let selected: TurnoutElectionType
    let onSelect: (TurnoutElectionType) -> Void

    var body: some View {
        HStack(spacing: 8) {
            segment(label: "Presidential", isSelected: selected == .presidential) {
                onSelect(.presidential)
            }

            segment(label: "Midterm", isSelected: selected == .midterm) {
                onSelect(.midterm)
            }
        }
    }

    private func segment(label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.footnote.weight(.semibold))
                .foregroundColor(isSelected ? .white : VoteNowColors.primaryText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)
                .background(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .fill(isSelected ? VoteNowColors.primaryCTA : VoteNowColors.surfaceWhite)
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 9, style: .continuous)
                        .stroke(VoteNowColors.primaryText.opacity(0.10), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
    }
}

private struct AgeTurnoutBandSlider: View {
    let stops: [TurnoutAgeStop]
    let selectedRange: ClosedRange<Int>
    let eligiblePopulationThousands: Double?
    let votedThousands: Double?
    let turnoutRatePct: Double?
    let representationGapPoints: Double?
    let onRangeChange: (ClosedRange<Int>) -> Void

    @State private var activeThumb: Thumb?

    private enum Thumb {
        case lower
        case upper
    }

    private var activeLabel: String {
        guard stops.indices.contains(selectedRange.lowerBound),
              stops.indices.contains(selectedRange.upperBound) else {
            return ""
        }

        let lowerLabel = stops[selectedRange.lowerBound].label
        let upperLabel = stops[selectedRange.upperBound].label
        if selectedRange.lowerBound == selectedRange.upperBound {
            return "Age \(lowerLabel)"
        }
        return "Ages \(lowerLabel)-\(upperLabel)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack(alignment: .top, spacing: 10) {
                Text(activeLabel)
                    .font(.footnote.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                Spacer(minLength: 8)

                if let eligiblePopulationThousands {
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(TurnoutExplorerFormatters.compactPopulationFromThousands(eligiblePopulationThousands)) eligible")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .monospacedDigit()

                        if let votedThousands {
                            Text("\(TurnoutExplorerFormatters.compactPopulationFromThousands(votedThousands)) voted")
                                .font(.caption2)
                                .foregroundColor(VoteNowColors.mutedText)
                                .monospacedDigit()
                        }
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel(accessibilityPopulationLabel)
                }
            }

            GeometryReader { geometry in
                let thumbVisualSize: CGFloat = 22
                let thumbTouchSize: CGFloat = 44
                let sideInset: CGFloat = (thumbTouchSize / 2) + 1
                let trackWidth = max(geometry.size.width - (sideInset * 2), 1)
                let centerY = thumbTouchSize / 2
                let lowerX = xPosition(for: selectedRange.lowerBound, width: trackWidth) + sideInset
                let upperX = xPosition(for: selectedRange.upperBound, width: trackWidth) + sideInset

                ZStack(alignment: .leading) {
                    Capsule(style: .continuous)
                        .fill(VoteNowColors.primaryText.opacity(0.12))
                        .frame(height: 6)
                        .padding(.horizontal, sideInset)

                    Capsule(style: .continuous)
                        .fill(selectionFillColor(turnoutRatePct: turnoutRatePct, gapPoints: representationGapPoints))
                        .frame(width: max(0, upperX - lowerX), height: 6)
                        .padding(.leading, lowerX)

                    thumb(
                        at: lowerX,
                        y: centerY,
                        visualSize: thumbVisualSize,
                        touchSize: thumbTouchSize,
                        fillColor: sliderCueColor(turnoutRatePct: turnoutRatePct)
                    )
                        .allowsHitTesting(false)

                    thumb(
                        at: upperX,
                        y: centerY,
                        visualSize: thumbVisualSize,
                        touchSize: thumbTouchSize,
                        fillColor: sliderCueColor(turnoutRatePct: turnoutRatePct)
                    )
                        .allowsHitTesting(false)
                }
                .frame(height: thumbTouchSize)
                .contentShape(Rectangle())
                .highPriorityGesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            if activeThumb == nil {
                                activeThumb = nearestThumb(for: value.startLocation.x - sideInset, width: trackWidth)
                            }
                            updateRange(
                                for: value.location.x - sideInset,
                                width: trackWidth,
                                preferredThumb: activeThumb
                            )
                        }
                        .onEnded { value in
                            updateRange(
                                for: value.location.x - sideInset,
                                width: trackWidth,
                                preferredThumb: activeThumb
                            )
                            activeThumb = nil
                        }
                )
            }
            .frame(height: 44)

            HStack {
                Text(stops.first?.label ?? "")
                    .font(.caption2)
                    .foregroundColor(VoteNowColors.mutedText)

                Spacer()

                Text(activeLabel.replacingOccurrences(of: "Ages ", with: "").replacingOccurrences(of: "Age ", with: ""))
                    .font(.caption2.weight(.semibold))
                    .foregroundColor(VoteNowColors.primaryText)

                Spacer()

                Text(stops.last?.label ?? "")
                    .font(.caption2)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
    }

    private func thumb(at x: CGFloat, y: CGFloat, visualSize: CGFloat, touchSize: CGFloat, fillColor: Color) -> some View {
        ZStack {
            Circle()
                .fill(Color.clear)
                .frame(width: touchSize, height: touchSize)

            Circle()
                .fill(fillColor)
                .frame(width: visualSize, height: visualSize)
                .overlay(Circle().stroke(.white, lineWidth: 2))
                .shadow(color: VoteNowColors.primaryText.opacity(0.18), radius: 3, x: 0, y: 1)
        }
            .position(x: x, y: y)
            .contentShape(Rectangle())
    }

    private func updateRange(for rawX: CGFloat, width: CGFloat, preferredThumb: Thumb? = nil) {
        let nearest = nearestIndex(for: rawX, width: width)
        let thumb = preferredThumb ?? activeThumb ?? nearestThumb(for: rawX, width: width)
        activeThumb = thumb

        switch thumb {
        case .lower:
            let clampedLower = min(nearest, selectedRange.upperBound)
            onRangeChange(clampedLower...selectedRange.upperBound)
        case .upper:
            let clampedUpper = max(nearest, selectedRange.lowerBound)
            onRangeChange(selectedRange.lowerBound...clampedUpper)
        }
    }

    private func nearestThumb(for rawX: CGFloat, width: CGFloat) -> Thumb {
        let lowerX = xPosition(for: selectedRange.lowerBound, width: width)
        let upperX = xPosition(for: selectedRange.upperBound, width: width)

        // When both thumbs overlap, resolve intent by touch side so users can re-grab either handle.
        if selectedRange.lowerBound == selectedRange.upperBound {
            return rawX >= lowerX ? .upper : .lower
        }

        let lowerDistance = abs(rawX - lowerX)
        let upperDistance = abs(rawX - upperX)
        return lowerDistance <= upperDistance ? .lower : .upper
    }

    private func xPosition(for index: Int, width: CGFloat) -> CGFloat {
        let safeIndex = min(max(index, 0), max(stops.count - 1, 0))
        let denominator = max(stops.count - 1, 1)
        let progress = CGFloat(safeIndex) / CGFloat(denominator)
        return progress * width
    }

    private func nearestIndex(for rawX: CGFloat, width: CGFloat) -> Int {
        guard !stops.isEmpty else { return 0 }
        let x = min(max(rawX, 0), width)
        let denominator = max(stops.count - 1, 1)
        let step = width / CGFloat(denominator)
        guard step > 0 else { return 0 }
        let snapped = Int((x / step).rounded())
        return min(max(snapped, 0), stops.count - 1)
    }

    private var accessibilityPopulationLabel: String {
        guard let eligiblePopulationThousands else {
            return ""
        }

        let eligibleLabel = "\(TurnoutExplorerFormatters.compactPopulationFromThousands(eligiblePopulationThousands)) eligible voters"
        if let votedThousands {
            return "\(eligibleLabel), \(TurnoutExplorerFormatters.compactPopulationFromThousands(votedThousands)) voted"
        }
        return eligibleLabel
    }

    private func sliderCueColor(turnoutRatePct: Double?) -> Color {
        guard let turnoutRatePct else {
            return VoteNowColors.primaryCTA
        }
        return TurnoutGraphPalette.palette(forTurnoutRate: turnoutRatePct).votedColor
    }

    private func selectionFillColor(turnoutRatePct: Double?, gapPoints: Double?) -> Color {
        let base = sliderCueColor(turnoutRatePct: turnoutRatePct)
        let magnitude = min(max(abs(gapPoints ?? 0) / 8, 0), 1)
        let opacity = 0.30 + (0.30 * magnitude)
        return base.opacity(opacity)
    }
}

private struct TurnoutRiskMap: View {
    let diagnostics: [TurnoutAgeDiagnostic]
    let selectedRange: ClosedRange<Int>

    private var maxRisk: Double {
        max(diagnostics.map(\.riskScore).max() ?? 1, 1)
    }

    private var isFullRangeSelected: Bool {
        !diagnostics.isEmpty
            && selectedRange.lowerBound == 0
            && selectedRange.upperBound == diagnostics.count - 1
    }

    private var visibleRange: ClosedRange<Int> {
        guard !diagnostics.isEmpty else { return 0...0 }
        let maxIndex = diagnostics.count - 1

        if isFullRangeSelected {
            return 0...maxIndex
        }

        let span = max(1, selectedRange.upperBound - selectedRange.lowerBound + 1)
        let context = max(3, min(8, span / 2))
        let lower = max(0, selectedRange.lowerBound - context)
        let upper = min(maxIndex, selectedRange.upperBound + context)
        return lower...upper
    }

    private var visibleDiagnostics: [TurnoutAgeDiagnostic] {
        guard !diagnostics.isEmpty else { return [] }
        return Array(diagnostics[visibleRange])
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Turnout pressure map: Taller and redder bars indicate larger turnout/representation problems.")
                .font(.footnote.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)

            GeometryReader { geo in
                let count = max(visibleDiagnostics.count, 1)
                let spacing: CGFloat = 2
                let totalSpacing = spacing * CGFloat(max(count - 1, 0))
                let barWidth = max(3, (geo.size.width - totalSpacing) / CGFloat(count))

                HStack(alignment: .bottom, spacing: spacing) {
                    ForEach(Array(visibleDiagnostics.enumerated()), id: \.element.id) { offset, item in
                        let globalIndex = visibleRange.lowerBound + offset
                        let normalizedRisk = min(max(item.riskScore / maxRisk, 0), 1)
                        let barHeight = 8 + (normalizedRisk * 34)
                        let inSelection = selectedRange.contains(globalIndex)

                        VStack(spacing: 3) {
                            Capsule(style: .continuous)
                                .fill(riskColor(for: item).opacity(0.55 + (normalizedRisk * 0.45)))
                                .frame(width: barWidth, height: barHeight)

                            if shouldShowLabel(globalIndex: globalIndex) {
                                Text(item.label)
                                    .font(.system(size: 9, weight: .medium))
                                    .foregroundColor(VoteNowColors.mutedText)
                                    .lineLimit(1)
                                    .fixedSize(horizontal: true, vertical: false)
                                    .frame(width: barWidth, alignment: .center)
                                    .offset(x: labelXOffset(for: globalIndex, barWidth: barWidth))
                                    .zIndex(2)
                            } else {
                                Color.clear
                                    .frame(height: 10)
                            }
                        }
                        .frame(width: barWidth)
                        .padding(.vertical, 4)
                        .background(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .fill(inSelection ? VoteNowColors.primaryCTA.opacity(0.12) : Color.clear)
                        )
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottomLeading)
            }
            .frame(height: 66)

            if let first = diagnostics[safe: visibleRange.lowerBound]?.label,
               let last = diagnostics[safe: visibleRange.upperBound]?.label {
                Text("Showing ages \(first) to \(last)")
                    .font(.caption2)
                    .foregroundColor(VoteNowColors.mutedText)
            }
        }
    }

    private func shouldShowLabel(globalIndex: Int) -> Bool {
        globalIndex == visibleRange.lowerBound
            || globalIndex == visibleRange.upperBound
            || globalIndex == selectedRange.lowerBound
            || globalIndex == selectedRange.upperBound
    }

    private func labelXOffset(for globalIndex: Int, barWidth: CGFloat) -> CGFloat {
        let edgeNudge = max(10, 18 - (barWidth / 2))
        if globalIndex == visibleRange.lowerBound {
            return edgeNudge
        }
        if globalIndex == visibleRange.upperBound {
            return -edgeNudge
        }
        return 0
    }

    private func riskColor(for diagnostic: TurnoutAgeDiagnostic) -> Color {
        if diagnostic.representationGapPoints < -4 || diagnostic.turnoutRatePct < 45 {
            return VoteNowColors.urgentCTA
        }
        if diagnostic.representationGapPoints < 0 || diagnostic.turnoutRatePct < 55 {
            return VoteNowColors.warningAmber
        }
        if diagnostic.representationGapPoints > 2 {
            return VoteNowColors.richBlue
        }
        return VoteNowColors.successGreen
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else { return nil }
        return self[index]
    }
}

private struct ElectorateDonut: View {
    let summary: TurnoutExplorerSelectionSummary
    let palette: TurnoutGraphPalette

    private var votedFraction: CGFloat {
        CGFloat(max(0, min(100, summary.votedShareOfTotalEligiblePct)) / 100)
    }

    private var nonvotingFraction: CGFloat {
        CGFloat(max(0, min(100, summary.nonvotingShareOfTotalEligiblePct)) / 100)
    }

    private var eligibleEnd: CGFloat {
        min(1, votedFraction + nonvotingFraction)
    }

    var body: some View {
        ZStack {
            Circle()
                .stroke(VoteNowColors.primaryText.opacity(0.18), lineWidth: 18)

            Circle()
                .trim(from: 0, to: votedFraction)
                .stroke(palette.votedColor, style: StrokeStyle(lineWidth: 18, lineCap: .butt, lineJoin: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.35), value: votedFraction)

            Circle()
                .trim(from: votedFraction, to: eligibleEnd)
                .stroke(palette.nonvotingColor, style: StrokeStyle(lineWidth: 18, lineCap: .butt, lineJoin: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut(duration: 0.35), value: eligibleEnd)

            VStack(spacing: 2) {
                Text(TurnoutExplorerFormatters.percent(summary.turnoutRatePct))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundColor(palette.votedColor)
                    .minimumScaleFactor(0.8)

                Text("of this age group voted")
                    .font(.footnote)
                    .foregroundColor(VoteNowColors.mutedText)
            }
            .padding(.horizontal, 8)
        }
        .frame(maxWidth: .infinity)
        .frame(height: 180)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(TurnoutExplorerFormatters.percent(summary.turnoutRatePct)) of this age group voted")
    }
}

private struct TurnoutGraphPalette {
    let votedColor: Color
    let nonvotingColor: Color

    static func palette(forTurnoutRate turnoutRatePct: Double) -> TurnoutGraphPalette {
        switch turnoutRatePct {
        case ..<40:
            return TurnoutGraphPalette(
                votedColor: VoteNowColors.urgentCTA,
                nonvotingColor: VoteNowColors.urgentCTA.opacity(0.34)
            )
        case ..<50:
            return TurnoutGraphPalette(
                votedColor: Color(hex: "#D96A2A"),
                nonvotingColor: Color(hex: "#D96A2A").opacity(0.36)
            )
        case ..<60:
            return TurnoutGraphPalette(
                votedColor: VoteNowColors.warningAmber,
                nonvotingColor: VoteNowColors.warningAmber.opacity(0.34)
            )
        case ..<70:
            return TurnoutGraphPalette(
                votedColor: Color(hex: "#5D9D4A"),
                nonvotingColor: Color(hex: "#5D9D4A").opacity(0.34)
            )
        default:
            return TurnoutGraphPalette(
                votedColor: VoteNowColors.successGreen,
                nonvotingColor: VoteNowColors.successGreen.opacity(0.30)
            )
        }
    }
}

private struct MetricStat: View {
    let title: String
    let value: String
    let helper: String
    var backgroundColor: Color = VoteNowColors.surfaceWhite
    var borderColor: Color = VoteNowColors.primaryText.opacity(0.06)

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.footnote.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)
            Text(value)
                .font(.title3.weight(.bold))
                .foregroundColor(VoteNowColors.primaryText)
            Text(helper)
                .font(.footnote)
                .foregroundColor(VoteNowColors.mutedText)
                .lineLimit(1)
                .minimumScaleFactor(0.72)
        }
        .padding(10)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(borderColor, lineWidth: 1)
        )
    }
}

private struct MetricMiniStat: View {
    let title: String
    let value: String
    var backgroundColor: Color = VoteNowColors.surfaceWhite
    var borderColor: Color = VoteNowColors.primaryText.opacity(0.06)

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title)
                .font(.caption2.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)
                .lineLimit(1)

            Text(value)
                .font(.headline.weight(.bold))
                .foregroundColor(VoteNowColors.primaryText)
                .minimumScaleFactor(0.72)
                .lineLimit(1)
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 7)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(backgroundColor)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .stroke(borderColor, lineWidth: 1)
        )
    }
}

private struct LegendKey: View {
    let color: Color
    let text: String

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(color)
                .frame(width: 8, height: 8)
            Text(text)
                .font(.caption)
                .foregroundColor(VoteNowColors.mutedText)
        }
    }
}

private struct MethodologySheet: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 12) {
                    methodologyRow("Historical turnout from U.S. Census Bureau CPS Voting and Registration tables")
                    methodologyRow("This is descriptive historical data, not a prediction about you")
                    methodologyRow("Rates are based on reported voting among the citizen voting-age population")
                    methodologyRow("The highlighted arc shows the selected age group’s share of the total eligible electorate")
                    methodologyRow("Within that arc, the darker slice shows the portion that actually voted")
                    methodologyRow("Counts are shown in thousands in the source data and may be displayed as rounded millions in the UI")
                    methodologyRow("Primary elections are not included in this dataset")
                }
                .padding(16)
            }
            .navigationTitle("How this data works")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    private func methodologyRow(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Circle()
                .fill(VoteNowColors.primaryCTA)
                .frame(width: 6, height: 6)
                .padding(.top, 6)
            Text(text)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private enum TurnoutElectionType: String, CaseIterable {
    case presidential
    case midterm

    var kitType: WhyVoteElectionType {
        switch self {
        case .presidential:
            return .presidential
        case .midterm:
            return .midterm
        }
    }
}

private struct TurnoutAgeStop: Identifiable {
    let id: String
    let label: String
}

private struct TurnoutAgeDiagnostic: Identifiable {
    let id: String
    let label: String
    let turnoutRatePct: Double
    let representationGapPoints: Double
    let riskScore: Double
}

private struct TurnoutExplorerSelectionSummary {
    let cycleDisplayName: String
    let ageLabel: String
    let citizenPopulationThousands: Double
    let votedThousands: Double
    let turnoutRatePct: Double
    let eligibleSharePct: Double
    let ballotSharePct: Double
    let votedShareOfTotalEligiblePct: Double
    let nonvotingShareOfTotalEligiblePct: Double
    let representationIndex: Double
    let representationGapPoints: Double
}

private struct TurnoutExplorerDataAdapter {
    let dataset: USAgeTurnoutDataset

    var defaultElectionType: TurnoutElectionType {
        dataset.cycle(for: .presidential) != nil ? .presidential : .midterm
    }

    func defaultRange(for type: TurnoutElectionType) -> ClosedRange<Int> {
        let stops = sliderStops(for: type)
        guard !stops.isEmpty else { return 0...0 }
        return 0...(stops.count - 1)
    }

    var latestCycleLabel: String {
        let presidentialYear = dataset.cycle(for: .presidential)?.year ?? 2024
        let midtermYear = dataset.cycle(for: .midterm)?.year ?? 2022
        return "Based on the latest available Census cycle for this election type (\(presidentialYear) for presidential, \(midtermYear) for midterm)."
    }

    func sliderStops(for type: TurnoutElectionType) -> [TurnoutAgeStop] {
        sortedAges(for: type).map { TurnoutAgeStop(id: $0.id, label: $0.label) }
    }

    func diagnostics(for type: TurnoutElectionType) -> [TurnoutAgeDiagnostic] {
        sortedAges(for: type).map { point in
            let underrepresentation = max(0, -point.representationGapPctPoints)
            let lowTurnout = max(0, 55 - point.turnoutRateCitizenPct)
            let overrepresentation = max(0, point.representationGapPctPoints)

            // Weighted to make low turnout + underrepresentation feel most urgent.
            let riskScore = (underrepresentation * 1.4) + (lowTurnout * 0.6) + (overrepresentation * 0.35)

            return TurnoutAgeDiagnostic(
                id: point.id,
                label: point.label,
                turnoutRatePct: point.turnoutRateCitizenPct,
                representationGapPoints: point.representationGapPctPoints,
                riskScore: riskScore
            )
        }
    }

    func largestUnderrepresentation(for type: TurnoutElectionType) -> TurnoutAgeDiagnostic? {
        diagnostics(for: type).min(by: { $0.representationGapPoints < $1.representationGapPoints })
    }

    func selectionSummary(for type: TurnoutElectionType, range: ClosedRange<Int>) -> TurnoutExplorerSelectionSummary? {
        guard let cycle = dataset.cycle(for: type.kitType) else { return nil }
        let sorted = sortedAges(for: type)
        guard !sorted.isEmpty else { return nil }

        let lower = min(max(range.lowerBound, 0), sorted.count - 1)
        let upper = min(max(range.upperBound, 0), sorted.count - 1)
        let fixedRange = lower <= upper ? lower...upper : upper...lower
        let selected = Array(sorted[fixedRange])

        let citizenPopulationThousands = selected.reduce(0.0) { $0 + Double($1.citizenPopulationThousands) }
        let votedThousands = selected.reduce(0.0) { $0 + Double($1.votedThousands) }

        let totalCitizen = Double(cycle.totalCitizenPopulationThousands)
        let totalVoted = Double(cycle.totalVotedThousands)

        let eligibleSharePct = totalCitizen > 0
            ? (citizenPopulationThousands / totalCitizen) * 100
            : selected.reduce(0.0) { $0 + $1.shareOfTotalCitizenPct }

        let ballotSharePct = totalVoted > 0
            ? (votedThousands / totalVoted) * 100
            : selected.reduce(0.0) { $0 + $1.shareOfTotalVotersPct }

        let votedShareOfTotalEligiblePct = totalCitizen > 0
            ? (votedThousands / totalCitizen) * 100
            : selected.reduce(0.0) { $0 + $1.shareOfTotalCitizenWhoVotedPct }

        let nonvotingShareOfTotalEligiblePct = max(0, eligibleSharePct - votedShareOfTotalEligiblePct)
        let turnoutRatePct = citizenPopulationThousands > 0 ? (votedThousands / citizenPopulationThousands) * 100 : 0

        let representationIndex = eligibleSharePct > 0 ? ballotSharePct / eligibleSharePct : 0
        let representationGapPoints = ballotSharePct - eligibleSharePct

        let firstLabel = selected.first?.label ?? ""
        let lastLabel = selected.last?.label ?? ""
        let ageLabel = firstLabel == lastLabel ? firstLabel : "\(firstLabel)-\(lastLabel)"

        return TurnoutExplorerSelectionSummary(
            cycleDisplayName: cycle.displayName,
            ageLabel: ageLabel,
            citizenPopulationThousands: citizenPopulationThousands,
            votedThousands: votedThousands,
            turnoutRatePct: turnoutRatePct,
            eligibleSharePct: eligibleSharePct,
            ballotSharePct: ballotSharePct,
            votedShareOfTotalEligiblePct: votedShareOfTotalEligiblePct,
            nonvotingShareOfTotalEligiblePct: nonvotingShareOfTotalEligiblePct,
            representationIndex: representationIndex,
            representationGapPoints: representationGapPoints
        )
    }

    private func sortedAges(for type: TurnoutElectionType) -> [USAgeTurnoutDataset.AgePoint] {
        guard let cycle = dataset.cycle(for: type.kitType) else { return [] }
        return cycle.ages.sorted { $0.sortIndex < $1.sortIndex }
    }
}

private final class TurnoutExplorerStore: ObservableObject {
    @Published private(set) var adapter: TurnoutExplorerDataAdapter?
    @Published private(set) var loadError: String?

    var datasetVersionToken: String {
        adapter?.dataset.schemaVersion ?? loadError ?? "none"
    }

    init() {
        load()
    }

    private func load() {
        do {
            let dataset = try USAgeTurnoutDataset.loadEmbedded()
            adapter = TurnoutExplorerDataAdapter(dataset: dataset)
            loadError = nil
            return
        } catch {
            do {
                let dataset = try USAgeTurnoutDataset.loadFromBundle()
                adapter = TurnoutExplorerDataAdapter(dataset: dataset)
                loadError = nil
                return
            } catch {
                loadError = "Failed to load age turnout dataset: \(error.localizedDescription)"
            }
        }
    }
}

private enum TurnoutExplorerFormatters {
    private static let oneDecimalFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    static func percent(_ value: Double) -> String {
        let rendered = oneDecimalFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
        return "\(rendered)%"
    }

    static func compactPopulationFromThousands(_ value: Double) -> String {
        let actualValue = value * 1_000
        if actualValue >= 1_000_000_000 {
            let rendered = oneDecimalFormatter.string(from: NSNumber(value: actualValue / 1_000_000_000)) ?? "\(actualValue)"
            return "\(rendered)B"
        }
        if actualValue >= 1_000_000 {
            let rendered = oneDecimalFormatter.string(from: NSNumber(value: actualValue / 1_000_000)) ?? "\(actualValue)"
            return "\(rendered)M"
        }
        let rendered = oneDecimalFormatter.string(from: NSNumber(value: actualValue / 1_000)) ?? "\(actualValue)"
        return "\(rendered)K"
    }

    static func signedPoints(_ value: Double) -> String {
        let rendered = oneDecimalFormatter.string(from: NSNumber(value: abs(value))) ?? "\(abs(value))"
        if value > 0 {
            return "+\(rendered) pts"
        }
        if value < 0 {
            return "-\(rendered) pts"
        }
        return "0 pts"
    }

    static func wholeNumber(_ value: Double) -> String {
        String(format: "%.0f", max(1, value.rounded()))
    }
}

#Preview {
    TurnoutExplorer()
        .padding()
}
