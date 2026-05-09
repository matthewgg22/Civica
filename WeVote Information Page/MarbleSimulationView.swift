import SwiftUI

struct MarbleSimulationView: View {
    let title: String
    let isEmbedded: Bool

    @Environment(\.dismiss) private var dismiss
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @StateObject private var controller: MarbleSimulationController
    @State private var infoPanelExpanded = true
    @State private var showAdminPanel = false
    @State private var voterPresetSelection: Int

    private let voterPresets = [100]
    private let palette: [Color] = [
        CivicaColors.brandSoftBlue,
        CivicaColors.brandSoftRed,
        Color(hex: "#88C7A8"),
        Color(hex: "#F1B76A"),
        Color(hex: "#A8A3D5"),
        Color(hex: "#F2A5B8"),
        Color(hex: "#9DD4D8"),
        Color(hex: "#D6B58E")
    ]

    init(
        title: String = "Ranked-Choice Voting",
        candidateCount: Int = 4,
        defaultMuted: Bool = false,
        idleTimeoutSeconds: TimeInterval = 30,
        isEmbedded: Bool = false
    ) {
        self.title = title
        self.isEmbedded = isEmbedded
        let cappedCandidates = max(4, min(4, candidateCount))
        let defaultVoters = 100
        _controller = StateObject(
            wrappedValue: MarbleSimulationController(
                candidateCount: cappedCandidates,
                voterCount: defaultVoters,
                defaultMuted: defaultMuted,
                idleTimeoutSeconds: idleTimeoutSeconds
            )
        )
        _voterPresetSelection = State(initialValue: defaultVoters)
    }

    var body: some View {
        GeometryReader { geometry in
            let wide = geometry.size.width >= 980

            ZStack {
                if !isEmbedded {
                    backgroundLayer
                }

                VStack(spacing: 12) {
                    if !isEmbedded {
                        header
                    }

                    if isEmbedded {
                        stageAndControls
                    } else if wide {
                        HStack(alignment: .top, spacing: 12) {
                            stageAndControls
                            if infoPanelExpanded {
                                sideInfoPanel
                                    .frame(width: 320)
                            } else {
                                collapsedInfoButton
                            }
                        }
                    } else {
                        VStack(spacing: 10) {
                            stageAndControls
                            compactInfoPanel
                        }
                    }
                }
                .padding(.horizontal, 14)
                .padding(.top, 10)
                .padding(.bottom, 10)
            }
        }
        .onAppear {
            controller.setReduceMotion(reduceMotion)
        }
        .onChange(of: reduceMotion) { _, newValue in
            controller.setReduceMotion(newValue)
        }
        .sheet(isPresented: $showAdminPanel) {
            adminPanel
        }
    }

    private var backgroundLayer: some View {
        LinearGradient(
            colors: [
                CivicaColors.appBackground,
                CivicaColors.brandSoftBlue.opacity(0.18),
                CivicaColors.brandSoftRed.opacity(0.10)
            ],
            startPoint: .topLeading,
            endPoint: .bottomTrailing
        )
        .ignoresSafeArea()
    }

    private var header: some View {
        HStack(spacing: 10) {
            Button {
                dismiss()
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.title2)
                    .foregroundColor(CivicaColors.primaryText.opacity(0.7))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close ranked-choice simulation")

            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.title2.weight(.black))
                    .foregroundColor(CivicaColors.primaryText)

                Text("Watch how your vote moves")
                    .font(.subheadline)
                    .foregroundColor(CivicaColors.mutedText)
            }
            .onLongPressGesture(minimumDuration: 1.1) {
                showAdminPanel = true
            }

            Spacer(minLength: 0)

            Text(controller.stageText)
                .font(.caption.weight(.semibold))
                .foregroundColor(CivicaColors.primaryText)
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color.white.opacity(0.9)))
        }
    }

    private var stageAndControls: some View {
        VStack(spacing: 10) {
            if !isEmbedded && controller.shouldShowFeaturedBallotBanner {
                featuredBallotBanner
            }
            roundSubheader
            simulationStage
            controlsRow
        }
    }

    private var roundSubheader: some View {
        let roundNumber = min(max(1, controller.currentRoundIndex + 1), max(1, controller.roundCount))
        return HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text("Round \(roundNumber)")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(CivicaColors.primaryText)

            Text(roundStatusSummaryText)
                .font(.caption.weight(.semibold))
                .foregroundColor(CivicaColors.mutedText)
                .lineLimit(1)
                .minimumScaleFactor(0.86)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 2)
    }

    private var roundStatusSummaryText: String {
        if controller.hasCompleted, let winnerID = controller.winnerCandidateID {
            return "\(controller.shortCandidateLabel(for: winnerID)) wins with a majority."
        }

        if controller.isTransitioning {
            switch controller.stageText {
            case "Elimination":
                if let eliminatedID = controller.currentRound?.eliminatedCandidateID {
                    return "\(controller.shortCandidateLabel(for: eliminatedID)) is eliminated."
                }
                return "Lowest candidate is eliminated."
            case "Transfers":
                return "Votes transfer to each ballot's next active choice."
            case "Re-stack":
                return "Totals update after transfers."
            default:
                break
            }
        }

        if let round = controller.currentRound {
            if let winnerID = round.winnerCandidateID {
                return "\(controller.shortCandidateLabel(for: winnerID)) has enough votes to win."
            }
            if let eliminatedID = round.eliminatedCandidateID {
                return "\(controller.shortCandidateLabel(for: eliminatedID)) has the fewest votes and transfers next."
            }
        }

        return "Votes are counted for each ballot's highest active choice."
    }

    private var featuredBallotBanner: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(controller.featuredBallotBannerTitle)
                .font(.caption.weight(.semibold))
                .foregroundColor(CivicaColors.primaryText)
                .lineLimit(2)
                .minimumScaleFactor(0.85)
            Text(controller.featuredBallotBannerDetail)
                .font(.caption)
                .foregroundColor(CivicaColors.mutedText)
                .lineLimit(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color.white.opacity(0.9))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(CivicaColors.borderWarm, lineWidth: 1)
        )
    }

    private var simulationStage: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: reduceMotion ? 1.0 / 24.0 : 1.0 / 60.0, paused: false)) { timeline in
                let now = timeline.date.timeIntervalSinceReferenceDate

                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(Color.white.opacity(0.9))
                        .overlay(
                            RoundedRectangle(cornerRadius: 18, style: .continuous)
                                .stroke(CivicaColors.borderWarm, lineWidth: 1.2)
                        )

                    Canvas { context, size in
                        drawStage(context: context, size: size, now: now)
                    }
                    .contentShape(Rectangle())
                    .gesture(
                        DragGesture(minimumDistance: 0)
                            .onEnded { value in
                                controller.selectMarble(
                                    near: value.location,
                                    canvasSize: proxy.size,
                                    now: now
                                )
                            }
                    )
                    .overlay {
                        candidateTapOverlay(size: proxy.size)
                    }

                }
            }
        }
        .aspectRatio(16 / 9, contentMode: .fit)
        .frame(maxWidth: .infinity)
    }

    private var controlsRow: some View {
        controlButtonPrimary
        .frame(maxWidth: .infinity)
    }

    private var controlButtonPrimary: some View {
        Button {
            if controller.hasCompleted {
                controller.reset()
            } else {
                controller.playPause()
            }
        } label: {
            if controller.hasCompleted {
                Label("Replay", systemImage: "arrow.clockwise")
            } else {
                Label(controller.isPlaying ? "Pause" : "Play", systemImage: controller.isPlaying ? "pause.fill" : "play.fill")
            }
        }
        .buttonStyle(
            RoundedControlButtonStyle(
                fill: CivicaColors.primaryCTA,
                minHeight: isEmbedded ? 44 : 52,
                verticalPadding: isEmbedded ? 3 : 6
            )
        )
        .keyboardShortcut(.space, modifiers: [])
        .accessibilityHint(controller.hasCompleted ? "Replay the simulation from round one" : "Play or pause automatic round progression")
    }

    private var sideInfoPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Round story")
                    .font(.headline.weight(.semibold))
                Spacer()
                Button {
                    infoPanelExpanded = false
                } label: {
                    Image(systemName: "chevron.right.circle.fill")
                        .font(.title3)
                        .foregroundColor(CivicaColors.mutedText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Collapse round details")
            }

            infoBadge(
                title: "🎬 What just happened",
                body: controller.narrativeText
            )

            if let currentRound = controller.currentRound,
               !currentRound.tieCandidateIDs.isEmpty {
                infoBadge(
                    title: "🤝 Tie detected",
                    body: "Deterministic rule: the lowest candidate ID is eliminated first."
                )
            }

            infoBadge(
                title: "🔁 What happens next?",
                body: "Lowest candidate is eliminated and each ballot moves to its next valid ranked choice."
            )

            infoBadge(
                title: "💡 Why this matters",
                body: "You can support your top choice first without wasting your vote if they are eliminated."
            )

            if let selectedBallotID = controller.selectedBallotID,
               selectedBallotID != controller.featuredBallotID {
                infoBadge(
                    title: "🔍 Ballot \(selectedBallotID) path",
                    body: controller.ballotPathDescription(ballotID: selectedBallotID)
                )
            }

            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(CivicaColors.borderWarm, lineWidth: 1)
        )
    }

    private var collapsedInfoButton: some View {
        Button {
            infoPanelExpanded = true
        } label: {
            Image(systemName: "chevron.left.circle.fill")
                .font(.title2)
                .foregroundColor(CivicaColors.mutedText)
                .padding(.top, 8)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Expand round details")
    }

    private var compactInfoPanel: some View {
        DisclosureGroup(isExpanded: $infoPanelExpanded) {
            VStack(alignment: .leading, spacing: 8) {
                infoBadge(
                    title: "🎬 What just happened",
                    body: controller.narrativeText
                )

                if let selectedBallotID = controller.selectedBallotID,
                   selectedBallotID != controller.featuredBallotID {
                    infoBadge(
                        title: "🔍 Ballot \(selectedBallotID) path",
                        body: controller.ballotPathDescription(ballotID: selectedBallotID)
                    )
                }

            }
            .padding(.top, 6)
        } label: {
            Text("Round story")
                .font(.subheadline.weight(.semibold))
                .foregroundColor(CivicaColors.primaryText)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color.white.opacity(0.92))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .stroke(CivicaColors.borderWarm, lineWidth: 1)
        )
    }

    private func candidateTapOverlay(size: CGSize) -> some View {
        let frames = controller.candidateFramesNormalized()

        return ZStack {
            ForEach(controller.candidates) { candidate in
                if let normalized = frames[candidate.id] {
                    let rect = CGRect(
                        x: normalized.minX * size.width,
                        y: normalized.minY * size.height,
                        width: normalized.width * size.width,
                        height: normalized.height * size.height
                    )
                    Button {
                        controller.selectCandidate(candidate.id)
                    } label: {
                        Color.clear
                    }
                    .buttonStyle(.plain)
                    .frame(width: rect.width, height: rect.height)
                    .position(x: rect.midX, y: rect.midY)
                    .accessibilityLabel("Highlight \(candidate.label) ballots")
                    .accessibilityHint("Filters marbles to the selected candidate")
                }
            }
        }
    }

    private func drawStage(context: GraphicsContext, size: CGSize, now: TimeInterval) {
        drawCandidateBins(context: context, size: size)
        drawExhaustedTray(context: context, size: size)
        drawMarbles(context: context, size: size, now: now)
    }

    private func drawCandidateBins(context: GraphicsContext, size: CGSize) {
        let frames = controller.candidateFramesNormalized()
        let counts = controller.displayedCountsByCandidateID
        let activeIDs = Set(controller.currentRound?.activeCandidateIDs ?? controller.candidates.map(\.id))
        let totalActiveVotes = max(1, activeIDs.reduce(0) { partial, candidateID in
            partial + counts[candidateID, default: 0]
        })
        let sortedActive = activeIDs
            .map { (id: $0, count: counts[$0, default: 0]) }
            .sorted { lhs, rhs in
                if lhs.count != rhs.count { return lhs.count > rhs.count }
                return lhs.id < rhs.id
            }
        let leaderID = sortedActive.first?.id
        let leaderCount = sortedActive.first?.count ?? 0
        let runnerUpCount = sortedActive.dropFirst().first?.count ?? 0

        for candidate in controller.candidates {
            guard let normalizedFrame = frames[candidate.id] else { continue }
            let frame = CGRect(
                x: normalizedFrame.minX * size.width,
                y: normalizedFrame.minY * size.height,
                width: normalizedFrame.width * size.width,
                height: normalizedFrame.height * size.height
            )

            let isActive = controller.isCandidateActive(candidate.id)
            let isWinner = controller.hasCompleted && controller.winnerCandidateID == candidate.id
            let candidateColor = isWinner ? CivicaColors.warningAmber : color(for: candidate.id)
            let fill = isActive
                ? candidateColor.opacity(0.18)
                : Color.gray.opacity(0.20)
            let stroke = controller.highlightedCandidateID == candidate.id
                ? CivicaColors.warningAmber
                : (isActive
                    ? candidateColor.opacity(0.65)
                    : Color.gray.opacity(0.70))

            context.fill(Path(roundedRect: frame, cornerRadius: 13), with: .color(fill))
            context.stroke(Path(roundedRect: frame, cornerRadius: 13), with: .color(stroke), lineWidth: controller.highlightedCandidateID == candidate.id ? 3 : 1.2)

            let count = counts[candidate.id, default: 0]
            let share: Double
            if isActive, totalActiveVotes > 0 {
                let rawShare = Double(count) / Double(totalActiveVotes)
                share = rawShare.isFinite ? min(1, max(0, rawShare)) : 0
            } else {
                share = 0
            }
            let percent = Int((share * 100).rounded())
            let countText = Text("\(count)")
                .font(.system(size: 15, weight: .bold))
                .foregroundColor(isActive ? CivicaColors.primaryText : Color.gray)
            context.draw(countText, at: CGPoint(x: frame.midX, y: frame.minY + 14))

            let trackFrame = CGRect(
                x: frame.minX + 8,
                y: frame.minY + 26,
                width: frame.width - 16,
                height: 6
            )
            context.fill(
                Path(roundedRect: trackFrame, cornerRadius: 3),
                with: .color(Color.black.opacity(0.12))
            )
            let fillFrame = CGRect(
                x: trackFrame.minX,
                y: trackFrame.minY,
                width: trackFrame.width * CGFloat(max(0, min(1, share))),
                height: trackFrame.height
            )
            context.fill(
                Path(roundedRect: fillFrame, cornerRadius: 3),
                with: .color(isActive ? candidateColor : Color.gray.opacity(0.5))
            )

            let outcomeText: String
            if isWinner {
                outcomeText = "WIN"
            } else if !isActive {
                outcomeText = "OUT"
            } else if candidate.id == leaderID {
                let leadBy = max(0, leaderCount - runnerUpCount)
                outcomeText = leadBy > 0 ? "+\(leadBy)" : "LEAD"
            } else {
                let behindBy = max(0, leaderCount - count)
                outcomeText = "-\(behindBy)"
            }
            let statusEmoji = controller.candidateOutcomeEmoji(for: candidate.id)
            let outcomeLabel = Text("\(statusEmoji) \(outcomeText) • \(percent)%")
                .font(.system(size: 8.5, weight: .semibold))
                .foregroundColor(isActive ? CivicaColors.mutedText : Color.gray)
            context.draw(outcomeLabel, at: CGPoint(x: frame.midX, y: frame.minY + 38))

            if controller.showCandidateLabels {
                let labelText = Text("\(controller.candidateEmoji(for: candidate.id)) \(controller.shortCandidateLabel(for: candidate.id))")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundColor((isActive ? CivicaColors.primaryText : Color.gray).opacity(0.92))
                context.draw(labelText, at: CGPoint(x: frame.midX, y: frame.maxY + 14))
            }
        }
    }

    private func drawExhaustedTray(context: GraphicsContext, size: CGSize) {
        let normalized = controller.exhaustedTrayFrameNormalized()
        let frame = CGRect(
            x: normalized.minX * size.width,
            y: normalized.minY * size.height,
            width: normalized.width * size.width,
            height: normalized.height * size.height
        )
        let totalBallots = max(1, controller.marbles.count)
        let inactiveFraction = min(
            1,
            max(0, CGFloat(controller.exhaustedCount) / CGFloat(totalBallots))
        )

        context.fill(
            Path(roundedRect: frame, cornerRadius: 12),
            with: .color(Color.black.opacity(0.06))
        )
        if inactiveFraction > 0 {
            let fillInset: CGFloat = 1.5
            let progressRect = CGRect(
                x: frame.minX + fillInset,
                y: frame.minY + fillInset,
                width: max(0, (frame.width - (fillInset * 2)) * inactiveFraction),
                height: max(0, frame.height - (fillInset * 2))
            )
            context.fill(
                Path(roundedRect: progressRect, cornerRadius: 10),
                with: .color(CivicaColors.warningAmber.opacity(0.23))
            )
        }
        context.stroke(
            Path(roundedRect: frame, cornerRadius: 12),
            with: .color(Color.black.opacity(0.18)),
            lineWidth: 1
        )

        if frame.height < 34 {
            let compactPercent = Int((inactiveFraction * 100).rounded())
            let compactLabel = Text("Inactive \(controller.exhaustedCount) • \(compactPercent)%")
                .font(.system(size: 9, weight: .semibold))
                .foregroundColor(CivicaColors.mutedText)
            context.draw(compactLabel, at: CGPoint(x: frame.midX, y: frame.midY))
        } else {
            let label = Text("No more ranked choices")
                .font(.system(size: 11, weight: .semibold))
                .foregroundColor(CivicaColors.mutedText)
            context.draw(label, at: CGPoint(x: frame.midX, y: frame.minY + 16))

            let percent = Int((inactiveFraction * 100).rounded())
            let countText = Text("Inactive: \(controller.exhaustedCount) (\(percent)%)")
                .font(.system(size: 10, weight: .bold))
                .foregroundColor(CivicaColors.mutedText)
            context.draw(countText, at: CGPoint(x: frame.midX, y: frame.maxY - 12))
        }
    }

    private func drawMarbles(context: GraphicsContext, size: CGSize, now: TimeInterval) {
        if controller.marbles.count > 150 {
            drawClusteredMarbles(context: context, size: size, now: now)
            return
        }

        for marble in controller.marbles {
            if marble.assignment.isExhausted {
                continue
            }
            let normalized = controller.displayedPosition(for: marble, now: now)
            let point = CGPoint(x: normalized.x * size.width, y: normalized.y * size.height)
            let color = marbleColor(for: marble)
            let dimmed = controller.marbleIsDimmed(marble)

            let rect = CGRect(x: point.x - 4.2, y: point.y - 4.2, width: 8.4, height: 8.4)
            context.fill(Ellipse().path(in: rect), with: .color(color.opacity(dimmed ? 0.22 : 0.96)))

            if let motion = marble.motion {
                let emoji: String?
                switch motion.style {
                case .transfer:
                    emoji = "➡️"
                case .exhaustedFall:
                    emoji = "📥"
                default:
                    emoji = nil
                }
                if let emoji {
                    let emojiText = Text(emoji)
                        .font(.system(size: 8))
                    context.draw(emojiText, at: CGPoint(x: point.x, y: point.y - 9))
                }
            }

            if controller.selectedBallotID == marble.ballotID {
                let ring = CGRect(x: point.x - 6.0, y: point.y - 6.0, width: 12.0, height: 12.0)
                context.stroke(Ellipse().path(in: ring), with: .color(CivicaColors.warningAmber), lineWidth: 1.8)
            }
        }
    }

    private func drawClusteredMarbles(context: GraphicsContext, size: CGSize, now: TimeInterval) {
        struct Cluster {
            var point: CGPoint
            var color: Color
            var count: Int
            var sampleMarble: MarbleNode
        }

        var clusters: [String: Cluster] = [:]

        for marble in controller.marbles {
            if marble.assignment.isExhausted {
                continue
            }
            let normalized = controller.displayedPosition(for: marble, now: now)
            let bucketX = Int((normalized.x * 42).rounded())
            let bucketY = Int((normalized.y * 36).rounded())
            let assignmentKey = marble.assignment.candidateID ?? -1
            let key = "\(assignmentKey)-\(bucketX)-\(bucketY)"

            if var cluster = clusters[key] {
                cluster.count += 1
                clusters[key] = cluster
            } else {
                clusters[key] = Cluster(
                    point: normalized,
                    color: marbleColor(for: marble),
                    count: 1,
                    sampleMarble: marble
                )
            }
        }

        for cluster in clusters.values {
            let point = CGPoint(x: cluster.point.x * size.width, y: cluster.point.y * size.height)
            let diameter: CGFloat = cluster.count > 1 ? 11 : 8
            let rect = CGRect(
                x: point.x - (diameter / 2),
                y: point.y - (diameter / 2),
                width: diameter,
                height: diameter
            )

            let dimmed = controller.marbleIsDimmed(cluster.sampleMarble)
            context.fill(Ellipse().path(in: rect), with: .color(cluster.color.opacity(dimmed ? 0.20 : 0.95)))
            context.stroke(Ellipse().path(in: rect), with: .color(Color.white.opacity(0.8)), lineWidth: 0.8)

            if let motion = cluster.sampleMarble.motion {
                let emoji: String?
                switch motion.style {
                case .transfer:
                    emoji = "➡️"
                case .exhaustedFall:
                    emoji = "📥"
                default:
                    emoji = nil
                }
                if let emoji {
                    let emojiText = Text(emoji)
                        .font(.system(size: 8))
                    context.draw(emojiText, at: CGPoint(x: point.x, y: point.y - 10))
                }
            }

        }
    }

    private func marbleColor(for marble: MarbleNode) -> Color {
        if let candidateID = marble.assignment.candidateID {
            return color(for: candidateID)
        }
        return Color.black.opacity(0.46)
    }

    private func color(for candidateID: RankedChoiceCandidateID) -> Color {
        palette[candidateID % palette.count]
    }

    private func infoBadge(title: String, body: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundColor(CivicaColors.primaryText)
            Text(body)
                .font(.caption)
                .foregroundColor(CivicaColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(8)
        .background(
            RoundedRectangle(cornerRadius: 10, style: .continuous)
                .fill(CivicaColors.appBackground.opacity(0.7))
        )
    }

    private var adminPanel: some View {
        NavigationStack {
            Form {
                Section("Playback") {
                    Stepper(
                        value: Binding(
                            get: { controller.speedMultiplier },
                            set: { controller.speedMultiplier = min(3.0, max(0.5, $0)) }
                        ),
                        in: 0.5...3.0,
                        step: 0.25
                    ) {
                        Text("Speed: \(controller.speedMultiplier, specifier: "%.2fx")")
                    }

                    Toggle("Show candidate labels", isOn: $controller.showCandidateLabels)
                    Toggle("Muted by default", isOn: $controller.isMuted)
                }

                Section("Dataset") {
                    Picker("Voters", selection: $voterPresetSelection) {
                        ForEach(voterPresets, id: \.self) { value in
                            Text("\(value)").tag(value)
                        }
                    }
                    Button("Apply Presets") {
                        controller.updatePresets(voterCount: voterPresetSelection)
                    }
                    Button("Reseed Demo Dataset") {
                        controller.reseedDataset()
                    }
                }

                Section("Actions") {
                    Button("Reset Simulation") {
                        controller.reset()
                    }
                }
            }
            .navigationTitle("Admin")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        showAdminPanel = false
                    }
                }
            }
        }
    }
}

private struct RoundedControlButtonStyle: ButtonStyle {
    let fill: Color
    var minHeight: CGFloat = 52
    var verticalPadding: CGFloat = 6

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundColor(CivicaColors.primaryText)
            .lineLimit(1)
            .minimumScaleFactor(0.88)
            .frame(maxWidth: .infinity, minHeight: minHeight)
            .padding(.horizontal, 10)
            .padding(.vertical, verticalPadding)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(fill.opacity(configuration.isPressed ? 0.78 : 1.0))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(CivicaColors.borderWarm, lineWidth: 1)
            )
    }
}

struct MarbleSimulationView_Previews: PreviewProvider {
    static var previews: some View {
        MarbleSimulationView(candidateCount: 4)
    }
}
