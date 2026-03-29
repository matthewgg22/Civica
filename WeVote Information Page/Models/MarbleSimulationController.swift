import SwiftUI
import AudioToolbox

enum MarbleExperienceMode: String, CaseIterable, Identifiable {
    case demo
    case interactive

    var id: String { rawValue }

    var label: String {
        switch self {
        case .demo:
            return "Demo"
        case .interactive:
            return "Interactive"
        }
    }
}

enum MarbleMotionStyle: Hashable {
    case drop
    case transfer
    case exhaustedFall
    case restack
}

struct MarbleMotion: Hashable {
    let style: MarbleMotionStyle
    let from: CGPoint
    let to: CGPoint
    let startTime: TimeInterval
    let duration: TimeInterval
    let arcHeight: CGFloat
}

struct MarbleNode: Identifiable, Hashable {
    let id: Int
    let ballotID: Int
    let rankingPath: [RankedChoiceCandidateID]
    var assignment: RankedChoiceAssignment
    var basePosition: CGPoint
    var motion: MarbleMotion?
}

@MainActor
final class MarbleSimulationController: ObservableObject {
    @Published private(set) var simulationPlan: RankedChoiceSimulationPlan
    @Published private(set) var marbles: [MarbleNode] = []
    @Published private(set) var currentRoundIndex: Int = 0
    @Published private(set) var narrativeText: String = "Round 1 begins. Every marble is one vote."
    @Published private(set) var stageText: String = "Round 1"
    @Published private(set) var highlightedCandidateID: RankedChoiceCandidateID?
    @Published private(set) var isTransitioning: Bool = false
    @Published var selectedCandidateID: RankedChoiceCandidateID?
    @Published var selectedBallotID: Int?
    @Published var isPlaying: Bool = false
    @Published var isMuted: Bool
    @Published var isAttractScreenVisible: Bool = false
    @Published var mode: MarbleExperienceMode = .demo
    @Published var voterPreset: Int
    @Published var candidatePreset: Int
    @Published var speedMultiplier: Double = 1.0
    @Published var showCandidateLabels: Bool = true
    @Published private(set) var featuredBallotID: Int?
    @Published private(set) var featuredBallotLastMoveText: String = "No transfer yet."

    private(set) var datasetSeed: UInt64 = 2_026_032_500

    private var idleTimeoutSeconds: TimeInterval
    private var reduceMotion: Bool = false
    private var lastInteractionAt = Date()
    private var autoPlayTask: Task<Void, Never>?
    private var transitionTask: Task<Void, Never>?
    private var idleTimer: Timer?
    private let minimumHeaderDisplaySeconds: Double = 2.0

    init(
        candidateCount: Int = 4,
        voterCount: Int = 100,
        defaultMuted: Bool = false,
        idleTimeoutSeconds: TimeInterval = 30
    ) {
        let normalizedCandidatePreset = max(4, min(4, candidateCount))
        let normalizedVoterPreset = min(100, max(100, voterCount))
        let initialSeed: UInt64 = 2_026_032_500

        self.candidatePreset = normalizedCandidatePreset
        self.voterPreset = normalizedVoterPreset
        self.isMuted = defaultMuted
        self.idleTimeoutSeconds = idleTimeoutSeconds
        self.datasetSeed = initialSeed
        self.simulationPlan = RankedChoiceEngine.makeDemoPlan(
            voterCount: normalizedVoterPreset,
            candidateCount: normalizedCandidatePreset,
            seed: initialSeed
        )
        rebuildSimulation(autoplay: true)
        startIdleMonitoring()
    }

    var candidates: [RankedChoiceCandidate] {
        simulationPlan.candidates
    }

    var visibleCandidateIDs: [RankedChoiceCandidateID] {
        return candidates.map(\.id).sorted()
    }

    var visibleCandidates: [RankedChoiceCandidate] {
        let byID = Dictionary(uniqueKeysWithValues: candidates.map { ($0.id, $0) })
        return visibleCandidateIDs.compactMap { byID[$0] }
    }

    var roundCount: Int {
        simulationPlan.rounds.count
    }

    var currentRound: RankedChoiceRound? {
        simulationPlan.rounds[safe: currentRoundIndex]
    }

    var hasCompleted: Bool {
        guard let round = currentRound else { return true }
        return round.winnerCandidateID != nil && currentRoundIndex >= (simulationPlan.rounds.count - 1)
    }

    var winnerCandidateID: RankedChoiceCandidateID? {
        simulationPlan.winnerCandidateID
    }

    var canStep: Bool {
        !isTransitioning && !hasCompleted && currentRoundIndex < max(0, simulationPlan.rounds.count - 1)
    }

    var canPlay: Bool {
        !isTransitioning && simulationPlan.rounds.count > 1
    }

    var exhaustedCount: Int {
        marbles.reduce(0) { partial, marble in
            partial + (marble.assignment.isExhausted ? 1 : 0)
        }
    }

    var displayedCountsByCandidateID: [RankedChoiceCandidateID: Int] {
        var counts = Dictionary(uniqueKeysWithValues: candidates.map { ($0.id, 0) })
        for marble in marbles {
            if case let .candidate(candidateID) = marble.assignment {
                counts[candidateID, default: 0] += 1
            }
        }
        return counts
    }

    var shouldShowFeaturedBallotBanner: Bool {
        isPlaying || currentRoundIndex > 0 || hasCompleted
    }

    func setReduceMotion(_ enabled: Bool) {
        reduceMotion = enabled
    }

    func setMode(_ newMode: MarbleExperienceMode) {
        mode = newMode
        registerInteraction()
        if newMode == .demo {
            startAutoPlay()
        } else {
            stopAutoPlay()
        }
    }

    func updatePresets(voterCount: Int, candidateCount: Int) {
        voterPreset = min(100, max(100, voterCount))
        candidatePreset = max(4, min(4, candidateCount))
        rebuildSimulation(autoplay: mode == .demo)
    }

    func updatePresets(voterCount: Int) {
        updatePresets(voterCount: voterCount, candidateCount: 4)
    }

    func reseedDataset() {
        datasetSeed = UInt64.random(in: 10_000...9_999_999)
        rebuildSimulation(autoplay: mode == .demo)
    }

    func reset() {
        rebuildSimulation(autoplay: mode == .demo)
    }

    func playPause() {
        registerInteraction()
        isPlaying ? stopAutoPlay() : startAutoPlay()
    }

    func stepOnce() {
        registerInteraction()
        guard canStep else { return }
        transitionTask?.cancel()
        transitionTask = Task { [weak self] in
            await self?.advanceOneRound()
        }
    }

    func registerInteraction() {
        lastInteractionAt = Date()
        if isAttractScreenVisible {
            isAttractScreenVisible = false
        }
    }

    func selectCandidate(_ candidateID: RankedChoiceCandidateID) {
        registerInteraction()
        if selectedCandidateID == candidateID {
            selectedCandidateID = nil
        } else {
            selectedCandidateID = candidateID
        }
    }

    func selectMarble(near normalizedPoint: CGPoint, canvasSize: CGSize, now: TimeInterval) {
        registerInteraction()
        let hitRadius = max(14, min(canvasSize.width, canvasSize.height) * 0.03)

        var nearest: (distance: CGFloat, ballotID: Int)?
        for marble in marbles {
            let normalized = displayedPosition(for: marble, now: now)
            let point = CGPoint(x: normalized.x * canvasSize.width, y: normalized.y * canvasSize.height)
            let distance = hypot(point.x - normalizedPoint.x, point.y - normalizedPoint.y)
            guard distance <= hitRadius else { continue }
            if let nearest, nearest.distance <= distance { continue }
            nearest = (distance, marble.ballotID)
        }

        selectedBallotID = nearest?.ballotID
    }

    func ballotPathDescription(ballotID: Int) -> String {
        guard let marble = marbles.first(where: { $0.ballotID == ballotID }) else {
            return "Ballot path unavailable."
        }
        let labels = marble.rankingPath.map { candidateDisplayLabel(for: $0) }
        return labels.isEmpty ? "No ranked choices on this ballot." : labels.joined(separator: " -> ")
    }

    var featuredBallotSummary: String {
        guard let featuredBallotID else {
            return "Pick a marble to inspect how a ballot can transfer."
        }
        let path = ballotPathDescription(ballotID: featuredBallotID)
        let currentAssignmentText: String
        if let marble = marbles.first(where: { $0.ballotID == featuredBallotID }) {
            currentAssignmentText = assignmentSummary(for: marble.assignment)
        } else {
            currentAssignmentText = "Current assignment unavailable."
        }
        return "🗳️ Sample ranking: \(path)\n📍 Currently counted for: \(currentAssignmentText)\n\(featuredBallotLastMoveText)"
    }

    var featuredBallotBannerTitle: String {
        guard let featuredBallot = featuredBallot else {
            return "Example ballot unavailable"
        }
        let ranked = featuredBallot.ranking.map { candidateDisplayLabel(for: $0) }
        return "Example ballot: " + ranked.joined(separator: " -> ")
    }

    var featuredBallotBannerDetail: String {
        guard let featuredBallot = featuredBallot else {
            return "Tracking unavailable."
        }

        let currentAssignmentText: String
        if let assignment = currentRound?.assignmentByBallotID[featuredBallot.id] {
            currentAssignmentText = assignmentSummary(for: assignment)
        } else {
            currentAssignmentText = "Unknown"
        }

        var message = "Now counting for: \(currentAssignmentText)."
        if let winnerID = winnerCandidateID,
           let winnerRank = featuredBallot.ranking.firstIndex(of: winnerID) {
            if winnerRank == max(0, featuredBallot.ranking.count - 2) {
                message += " Scenario: your second-to-last choice wins after transfers."
            } else {
                message += " Scenario: your #\(winnerRank + 1) ranked choice wins."
            }
        }
        return message
    }

    func candidateFramesNormalized() -> [RankedChoiceCandidateID: CGRect] {
        candidateFramesNormalized(for: visibleCandidateIDs)
    }

    private func candidateFramesNormalized(for candidateIDs: [RankedChoiceCandidateID]) -> [RankedChoiceCandidateID: CGRect] {
        let ids = candidateIDs.sorted()
        guard !ids.isEmpty else { return [:] }

        let startX: CGFloat = 0.05
        let totalWidth: CGFloat = 0.90
        let spacing: CGFloat = 0.012
        let width = (totalWidth - CGFloat(max(0, ids.count - 1)) * spacing) / CGFloat(ids.count)
        let y: CGFloat = 0.16
        let height: CGFloat = 0.52

        var frames: [RankedChoiceCandidateID: CGRect] = [:]
        for (index, id) in ids.enumerated() {
            let x = startX + CGFloat(index) * (width + spacing)
            frames[id] = CGRect(x: x, y: y, width: width, height: height)
        }
        return frames
    }

    func exhaustedTrayFrameNormalized() -> CGRect {
        CGRect(x: 0.07, y: 0.81, width: 0.86, height: 0.14)
    }

    func isCandidateActive(_ candidateID: RankedChoiceCandidateID) -> Bool {
        currentRound?.activeCandidateIDs.contains(candidateID) ?? true
    }

    func candidateLabel(for candidateID: RankedChoiceCandidateID) -> String {
        candidates.first(where: { $0.id == candidateID })?.label ?? "Candidate \(candidateID + 1)"
    }

    func shortCandidateLabel(for candidateID: RankedChoiceCandidateID) -> String {
        let label = candidateLabel(for: candidateID)
        if let suffix = label.split(separator: " ").last {
            return String(suffix)
        }
        return label
    }

    func displayedPosition(for marble: MarbleNode, now: TimeInterval) -> CGPoint {
        guard let motion = marble.motion else { return marble.basePosition }
        let elapsed = now - motion.startTime
        if elapsed <= 0 { return motion.from }
        if elapsed >= motion.duration { return motion.to }

        let t = CGFloat(elapsed / motion.duration)
        switch motion.style {
        case .drop:
            return dropInterpolation(from: motion.from, to: motion.to, t: t)
        case .transfer:
            return arcInterpolation(from: motion.from, to: motion.to, t: t, arcHeight: motion.arcHeight)
        case .exhaustedFall:
            return fallInterpolation(from: motion.from, to: motion.to, t: t)
        case .restack:
            return smoothInterpolation(from: motion.from, to: motion.to, t: t)
        }
    }

    func marbleIsDimmed(_ marble: MarbleNode) -> Bool {
        if let selectedCandidateID {
            return marble.assignment.candidateID != selectedCandidateID
        }
        return false
    }

    private func rebuildSimulation(autoplay: Bool) {
        stopAutoPlay()
        transitionTask?.cancel()
        isTransitioning = false
        highlightedCandidateID = nil
        selectedCandidateID = nil
        selectedBallotID = nil
        featuredBallotID = nil
        featuredBallotLastMoveText = "No transfer yet."
        isAttractScreenVisible = false

        simulationPlan = RankedChoiceEngine.makeDemoPlan(
            voterCount: voterPreset,
            candidateCount: candidatePreset,
            seed: datasetSeed
        )
        currentRoundIndex = 0
        narrativeText = "Round 1 begins. Every marble is one vote."
        stageText = "Round 1"

        let firstAssignments = simulationPlan.rounds.first?.assignmentByBallotID ?? [:]
        featuredBallotID = simulationPlan.ballots
            .sorted(by: { $0.id < $1.id })
            .first(where: { !$0.ranking.isEmpty })?
            .id
        let initialMarbles = simulationPlan.ballots.sorted(by: { $0.id < $1.id }).map { ballot in
            MarbleNode(
                id: ballot.id,
                ballotID: ballot.id,
                rankingPath: ballot.ranking,
                assignment: .exhausted,
                basePosition: stagingPoint(for: ballot),
                motion: nil
            )
        }
        marbles = initialMarbles
        if let featuredBallotID {
            selectedBallotID = featuredBallotID
        }

        transitionTask = Task { [weak self] in
            await self?.animateInitialDrop(assignments: firstAssignments)
            if autoplay {
                self?.startAutoPlay()
            }
        }
    }

    private func startAutoPlay() {
        guard canPlay else { return }
        isPlaying = true
        autoPlayTask?.cancel()
        autoPlayTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                if self.isTransitioning {
                    try? await Task.sleep(nanoseconds: 80_000_000)
                    continue
                }

                if self.hasCompleted {
                    if self.mode == .demo || self.isAttractScreenVisible {
                        try? await Task.sleep(nanoseconds: 1_400_000_000)
                        self.rebuildSimulation(autoplay: true)
                        return
                    } else {
                        self.isPlaying = false
                        return
                    }
                }

                guard self.canStep else {
                    self.isPlaying = false
                    return
                }

                await self.advanceOneRound()
                try? await Task.sleep(nanoseconds: UInt64(self.minimumHeaderDisplaySeconds * 1_000_000_000))
            }
        }
    }

    private func stopAutoPlay() {
        autoPlayTask?.cancel()
        autoPlayTask = nil
        isPlaying = false
    }

    private func animateInitialDrop(assignments: [Int: RankedChoiceAssignment]) async {
        guard !assignments.isEmpty else { return }
        let now = Date().timeIntervalSinceReferenceDate
        let targets = targetPositions(for: assignments)
        let baseDuration = reduceMotion ? 0.02 : 0.54 / max(0.2, speedMultiplier)
        let stagger = reduceMotion ? 0.0 : 0.0025 / max(0.2, speedMultiplier)

        for index in marbles.indices {
            let ballotID = marbles[index].ballotID
            let target = targets[ballotID] ?? marbles[index].basePosition
            let start = now + (Double(index) * stagger)
            marbles[index].assignment = assignments[ballotID] ?? .exhausted
            marbles[index].motion = MarbleMotion(
                style: .drop,
                from: marbles[index].basePosition,
                to: target,
                startTime: start,
                duration: baseDuration,
                arcHeight: 0
            )
        }

        playSound(.drop)
        let wait = baseDuration + (Double(marbles.count) * stagger) + 0.06
        try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
        resolveMotions(at: Date().timeIntervalSinceReferenceDate)

        if let firstRound = simulationPlan.rounds.first {
            narrativeText = firstRound.explanation
        }
        updateFeaturedBallotNarrative(initial: true)
    }

    private func advanceOneRound() async {
        guard canStep else { return }
        guard let round = simulationPlan.rounds[safe: currentRoundIndex],
              let eliminated = round.eliminatedCandidateID,
              let nextRound = simulationPlan.rounds[safe: currentRoundIndex + 1] else {
            return
        }

        isTransitioning = true
        stageText = "Elimination"
        highlightedCandidateID = eliminated
        narrativeText = round.explanation

        let eliminationStart = Date().timeIntervalSinceReferenceDate
        playSound(.drop)
        let highlightDelay = reduceMotion ? 0.02 : 0.75 / max(0.2, speedMultiplier)
        try? await Task.sleep(nanoseconds: UInt64(highlightDelay * 1_000_000_000))
        await enforceMinimumHeaderDisplay(from: eliminationStart)

        stageText = "Transfers"
        let transferStart = Date().timeIntervalSinceReferenceDate
        await animateTransfers(round: round, nextRound: nextRound)
        await enforceMinimumHeaderDisplay(from: transferStart)

        stageText = "Re-stack"
        let restackStart = Date().timeIntervalSinceReferenceDate
        await animateRestack(to: nextRound.assignmentByBallotID)
        await enforceMinimumHeaderDisplay(from: restackStart)

        currentRoundIndex += 1
        stageText = "Round \(currentRoundIndex + 1)"
        highlightedCandidateID = nil
        narrativeText = nextRound.explanation
        updateFeaturedBallotNarrative(initial: false)
        isTransitioning = false

        if hasCompleted {
            stageText = "Complete"
            stopAutoPlay()
        }
    }

    private func enforceMinimumHeaderDisplay(from stageStart: TimeInterval) async {
        let elapsed = Date().timeIntervalSinceReferenceDate - stageStart
        let remaining = minimumHeaderDisplaySeconds - elapsed
        guard remaining > 0 else { return }
        try? await Task.sleep(nanoseconds: UInt64(remaining * 1_000_000_000))
    }

    private func animateTransfers(round: RankedChoiceRound, nextRound: RankedChoiceRound) async {
        guard !round.transfers.isEmpty else { return }
        let transferTargets = targetPositions(for: nextRound.assignmentByBallotID)
        let transferCount = round.transfers.count
        let stepDuration: Double = reduceMotion
            ? 0.02
            : max(0.05, min(0.16, 5.0 / Double(max(1, transferCount)))) / max(0.2, speedMultiplier)

        for (index, transfer) in round.transfers.enumerated() {
            guard let idx = marbles.firstIndex(where: { $0.ballotID == transfer.ballotID }) else { continue }
            let now = Date().timeIntervalSinceReferenceDate
            resolveMotions(at: now)

            let target = transferTargets[transfer.ballotID] ?? marbles[idx].basePosition
            let from = marbles[idx].basePosition
            marbles[idx].assignment = transfer.toAssignment
            marbles[idx].motion = MarbleMotion(
                style: transfer.toAssignment.isExhausted ? .exhaustedFall : .transfer,
                from: from,
                to: target,
                startTime: now,
                duration: stepDuration,
                arcHeight: transfer.toAssignment.isExhausted ? 0 : 0.08
            )
            if index.isMultiple(of: 3) {
                playSound(.transfer)
            }
            if transfer.ballotID == featuredBallotID {
                let destination = assignmentSummary(for: transfer.toAssignment)
                let origin = candidateDisplayLabel(for: transfer.fromCandidateID)
                featuredBallotLastMoveText = "🧭 Your sample ballot moved from \(origin) to \(destination)."
            }
            try? await Task.sleep(nanoseconds: UInt64(stepDuration * 1_000_000_000))
        }

        resolveMotions(at: Date().timeIntervalSinceReferenceDate)
    }

    private func animateRestack(to assignments: [Int: RankedChoiceAssignment]) async {
        let targets = targetPositions(for: assignments)
        let now = Date().timeIntervalSinceReferenceDate
        resolveMotions(at: now)

        let duration = reduceMotion ? 0.02 : 0.30 / max(0.2, speedMultiplier)
        for index in marbles.indices {
            let ballotID = marbles[index].ballotID
            let target = targets[ballotID] ?? marbles[index].basePosition
            marbles[index].assignment = assignments[ballotID] ?? .exhausted
            marbles[index].motion = MarbleMotion(
                style: .restack,
                from: marbles[index].basePosition,
                to: target,
                startTime: now,
                duration: duration,
                arcHeight: 0
            )
        }

        try? await Task.sleep(nanoseconds: UInt64((duration + 0.04) * 1_000_000_000))
        resolveMotions(at: Date().timeIntervalSinceReferenceDate)
    }

    private func resolveMotions(at now: TimeInterval) {
        for index in marbles.indices {
            guard let motion = marbles[index].motion else { continue }
            if now >= motion.startTime + motion.duration {
                marbles[index].basePosition = motion.to
                marbles[index].motion = nil
            }
        }
    }

    private func targetPositions(for assignments: [Int: RankedChoiceAssignment]) -> [Int: CGPoint] {
        let allCandidateIDs = candidates.map(\.id).sorted()
        let frames = candidateFramesNormalized(for: allCandidateIDs)
        let exhaustedFrame = exhaustedTrayFrameNormalized()
        var targets: [Int: CGPoint] = [:]

        let sortedBallots = simulationPlan.ballots.map(\.id).sorted()
        var candidateBuckets: [RankedChoiceCandidateID: [Int]] = [:]
        var exhaustedBucket: [Int] = []

        for ballotID in sortedBallots {
            switch assignments[ballotID] ?? .exhausted {
            case let .candidate(candidateID):
                candidateBuckets[candidateID, default: []].append(ballotID)
            case .exhausted:
                exhaustedBucket.append(ballotID)
            }
        }

        for candidateID in allCandidateIDs {
            let frame = frames[candidateID] ?? .zero
            let ballots = candidateBuckets[candidateID, default: []]
            for (index, ballotID) in ballots.enumerated() {
                targets[ballotID] = stackPoint(in: frame, stackIndex: index, maxColumns: 5)
            }
        }

        for (index, ballotID) in exhaustedBucket.enumerated() {
            targets[ballotID] = stackPoint(in: exhaustedFrame, stackIndex: index, maxColumns: 10)
        }

        return targets
    }

    private func stackPoint(in frame: CGRect, stackIndex: Int, maxColumns: Int) -> CGPoint {
        let columns = max(3, maxColumns)
        let row = stackIndex / columns
        let column = stackIndex % columns
        let xSpacing = max(0.007, (frame.width - 0.02) / CGFloat(columns + 1))
        let ySpacing: CGFloat = 0.020

        let x = frame.minX + 0.012 + CGFloat(column + 1) * xSpacing
        let y = frame.maxY - 0.018 - CGFloat(row) * ySpacing
        return CGPoint(x: x, y: max(frame.minY + 0.015, y))
    }

    private func stagingPoint(for ballot: RankedChoiceBallot) -> CGPoint {
        let frames = candidateFramesNormalized()
        let seedCandidate = ballot.ranking.first ?? candidates.first?.id ?? 0
        let frame = frames[seedCandidate] ?? CGRect(x: 0.08, y: 0.18, width: 0.12, height: 0.56)
        let lanePosition = CGFloat((ballot.id % 7) + 1) / 8.0
        let x = frame.minX + lanePosition * frame.width
        let yOffset = CGFloat((ballot.id % 5)) * 0.012
        return CGPoint(x: x, y: -0.10 - yOffset)
    }

    private func startIdleMonitoring() {
        idleTimer?.invalidate()
        idleTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in
            Task { @MainActor [weak self] in
                self?.handleIdleTick()
            }
        }
    }

    private func handleIdleTick() {
        guard mode == .demo else { return }
        let inactiveFor = Date().timeIntervalSince(lastInteractionAt)
        if inactiveFor >= idleTimeoutSeconds {
            if !isAttractScreenVisible {
                isAttractScreenVisible = true
                startAutoPlay()
            }
        }
    }

    private func playSound(_ sound: MarbleSound) {
        guard !isMuted else { return }
        AudioServicesPlaySystemSound(sound.systemID)
    }

    private func updateFeaturedBallotNarrative(initial: Bool) {
        guard let featuredBallotID else { return }
        guard let assignment = currentRound?.assignmentByBallotID[featuredBallotID] else { return }
        if initial {
            featuredBallotLastMoveText = "🟢 Starts here: \(assignmentSummary(for: assignment))."
        } else {
            featuredBallotLastMoveText = "➡️ Now in: \(assignmentSummary(for: assignment))."
        }
    }

    private func assignmentSummary(for assignment: RankedChoiceAssignment) -> String {
        if let candidateID = assignment.candidateID {
            return candidateDisplayLabel(for: candidateID)
        }
        return "📭 Inactive (no more ranked choices)"
    }

    func candidateDisplayLabel(for candidateID: RankedChoiceCandidateID) -> String {
        "\(candidateEmoji(for: candidateID)) \(candidateLabel(for: candidateID))"
    }

    func candidateEmoji(for candidateID: RankedChoiceCandidateID) -> String {
        let emojis = ["🟦", "🟧", "🟩", "🟪", "🟨", "🟫", "⬜️", "⬛️"]
        return emojis[candidateID % emojis.count]
    }

    func candidateOutcomeEmoji(for candidateID: RankedChoiceCandidateID) -> String {
        if hasCompleted, winnerCandidateID == candidateID {
            return "🏆"
        }
        if highlightedCandidateID == candidateID {
            return "⬇️"
        }
        if isCandidateActive(candidateID) {
            return "➡️"
        }
        return "❌"
    }

    private var featuredBallot: RankedChoiceBallot? {
        guard let featuredBallotID else { return nil }
        return simulationPlan.ballots.first(where: { $0.id == featuredBallotID })
    }

    private func smoothInterpolation(from: CGPoint, to: CGPoint, t: CGFloat) -> CGPoint {
        let eased = easeOutCubic(t)
        return CGPoint(
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased
        )
    }

    private func dropInterpolation(from: CGPoint, to: CGPoint, t: CGFloat) -> CGPoint {
        let gravity = t * t
        var y = from.y + (to.y - from.y) * gravity
        let x = from.x + (to.x - from.x) * easeOutCubic(t)
        if !reduceMotion {
            let bounce = sin(t * .pi * 5) * (1 - t) * 0.015
            y += bounce
        }
        return CGPoint(x: x, y: y)
    }

    private func fallInterpolation(from: CGPoint, to: CGPoint, t: CGFloat) -> CGPoint {
        let eased = min(1, t * t * 1.15)
        return CGPoint(
            x: from.x + (to.x - from.x) * eased,
            y: from.y + (to.y - from.y) * eased
        )
    }

    private func arcInterpolation(from: CGPoint, to: CGPoint, t: CGFloat, arcHeight: CGFloat) -> CGPoint {
        let eased = easeInOutCubic(t)
        let x = from.x + (to.x - from.x) * eased
        let y = from.y + (to.y - from.y) * eased - (sin(.pi * eased) * arcHeight)
        return CGPoint(x: x, y: y)
    }

    private func easeOutCubic(_ t: CGFloat) -> CGFloat {
        1 - pow(1 - t, 3)
    }

    private func easeInOutCubic(_ t: CGFloat) -> CGFloat {
        if t < 0.5 {
            return 4 * t * t * t
        }
        return 1 - pow(-2 * t + 2, 3) / 2
    }
}

private enum MarbleSound {
    case drop
    case transfer

    var systemID: SystemSoundID {
        switch self {
        case .drop:
            return 1103
        case .transfer:
            return 1104
        }
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        guard indices.contains(index) else { return nil }
        return self[index]
    }
}
