import SwiftUI
import UIKit
import Combine

struct NYCMayoralElectionView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @Environment(\.locale) private var locale
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var upcomingElection: Election?
    @State private var stateCode: String?
    @State private var stateName: String = ""
    @State private var guideCards: [ElectionGuideInfoCard] = []
    @State private var errorMessage: String?
    @State private var officeExampleRotationTick = 0

    private let stateResolver = USZipStateResolver()
    private let officeExampleRotationTimer = Timer.publish(every: 15, on: .main, in: .common).autoconnect()
    private static let primaryTypeDataset: ElectionGuidePrimaryTypeDataset? = {
        guard let url = Bundle.main.url(forResource: "ElectionEligibilityDataset", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionGuidePrimaryTypeDataset.self, from: data) else {
            return nil
        }
        return decoded
    }()
    private static let ballotTimelineDataset: ElectionGuideBallotTimelineDataset? = {
        guard let url = Bundle.main.url(forResource: "ElectionEligibilityDataset", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionGuideBallotTimelineDataset.self, from: data) else {
            return nil
        }
        return decoded
    }()
    private static let stateVotingFeaturesByCode: [String: ElectionGuideStateVotingFeature] = {
        guard let url = Bundle.main.url(forResource: "USVotingFeaturesByJurisdiction", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: ElectionGuideStateVotingFeature].self, from: data) else {
            return [:]
        }
        return decoded
    }()
    private static let ballotMeasurePoliciesByState: [String: ElectionGuideBallotMeasurePolicy] = {
        guard let url = Bundle.main.url(forResource: "USBallotMeasurePoliciesByState", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: ElectionGuideBallotMeasurePolicy].self, from: data) else {
            return [:]
        }
        return decoded
    }()
    private static let statewideBallotMeasuresByStateCode: [String: [ElectionGuideStatewideBallotMeasure]] = {
        guard let url = Bundle.main.url(forResource: "USStatewideBallotMeasures2026", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: [ElectionGuideStatewideBallotMeasure]].self, from: data) else {
            return [:]
        }
        return decoded
    }()
    private static let officePowersByKey: [String: ElectionGuideOfficePowerRow] = {
        guard let url = Bundle.main.url(forResource: "USOfficePowersPlainEnglish", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionGuideOfficePowersDataset.self, from: data) else {
            return [:]
        }
        return Dictionary(uniqueKeysWithValues: decoded.rows.map { row in
            let normalized = row.officeKey
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            return (normalized, row)
        })
    }()
    private static let officePowerExamplesByKey: [String: [String]] = {
        guard let url = Bundle.main.url(forResource: "USOfficePowersExamplesByOffice", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionGuideOfficeExamplesDataset.self, from: data) else {
            return [:]
        }
        var mapped: [String: [String]] = [:]
        for row in decoded.rows {
            let key = row.officeKey
                .trimmingCharacters(in: .whitespacesAndNewlines)
                .lowercased()
            let examples = row.examples
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            if !key.isEmpty, !examples.isEmpty {
                mapped[key] = examples
            }
        }
        return mapped
    }()
    private static let runoffThresholdRulesByStateCode: [String: ElectionGuideRunoffThresholdRule] = {
        guard let url = Bundle.main.url(forResource: "USRunoffThresholdRulesByState", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([String: ElectionGuideRunoffThresholdRule].self, from: data) else {
            return [:]
        }
        return decoded
    }()
    private static let rankedChoiceByState2026: [String: ElectionGuideRankedChoiceStateSummary] = {
        guard let url = Bundle.main.url(forResource: "USRankedChoiceByState2026", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode(ElectionGuideRankedChoiceByStateDataset.self, from: data) else {
            return [:]
        }
        return decoded.states
    }()

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }

    private func lf(_ key: String, _ fallback: String, _ args: CVarArg...) -> String {
        let format = l(key, fallback)
        return String(format: format, locale: locale, arguments: args)
    }

    var body: some View {
        refreshedGuideView
    }

    private var refreshedGuideView: some View {
        navigationRootView
            .onAppear(perform: refreshGuide)
            .onChange(of: planVM.zip) { _, _ in refreshGuide() }
            .onChange(of: planVM.userAddress.state) { _, _ in refreshGuide() }
            .onChange(of: planVM.userAddress.zip) { _, _ in refreshGuide() }
            .onChange(of: planVM.selectedParty) { _, _ in refreshGuide() }
            .onChange(of: locale.identifier) { _, _ in refreshGuide() }
            .onReceive(officeExampleRotationTimer) { _ in
                if reduceMotion {
                    officeExampleRotationTick &+= 1
                } else {
                    withAnimation(.easeInOut(duration: 0.35)) {
                        officeExampleRotationTick &+= 1
                    }
                }
            }
    }

    private var navigationRootView: some View {
        NavigationStack {
            mainContentView
        }
        .navigationBarTitleDisplayMode(.inline)
    }

    private var mainContentView: some View {
        VStack(spacing: 0) {
            headerSectionView
            guideScrollView
        }
        .background(VoteNowColors.appBackground.ignoresSafeArea())
    }

    private var headerSectionView: some View {
        VStack(alignment: .leading, spacing: 0) {
            PageHeader(title: Text("app.page.election_guide", tableName: "AppShell"))
            Text(electionSubtitleText)
                .font(.subheadline.weight(.semibold))
                .foregroundColor(VoteNowColors.mutedText)
                .padding(.leading, 72)
                .padding(.top, -6)
        }
        .padding(.horizontal, 16)
        .padding(.top, 16)
        .padding(.bottom, 8)
        .background(VoteNowColors.appBackground)
    }

    private var guideScrollView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    guideContentView(proxy: proxy)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
            }
        }
    }

    @ViewBuilder
    private func guideContentView(proxy: ScrollViewProxy) -> some View {
        if let errorMessage {
            Text(errorMessage)
                .font(.body)
                .foregroundColor(VoteNowColors.mutedText)
        } else {
            introLineView(proxy: proxy)

            VoterIDGuideCard(stateCode: stateCode, stateName: stateName)
                .id(GuideCardAnchor.voterID.rawValue)

            ForEach(Array(guideCards.enumerated()), id: \.element.id) { index, card in
                guideCardView(card)
                    .id(guideCardScrollID(index: index))
            }
        }
    }

    @ViewBuilder
    private func guideCardView(_ card: ElectionGuideInfoCard) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            if let flagCode = card.flagStateCode,
               let assetName = StateFlagCatalog.assetName(for: flagCode),
               UIImage(named: assetName) != nil {
                HStack(alignment: .top, spacing: 10) {
                    Text(card.title)
                        .font(.headline.weight(.bold))
                        .italic()
                        .foregroundColor(card.accent.color)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    Image(assetName)
                        .resizable()
                        .scaledToFill()
                        .frame(width: 54, height: 36)
                        .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: 6, style: .continuous)
                                .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                        )
                        .opensMyInfoPanelOnLongPress()
                }
            } else {
                Text(card.title)
                    .font(.headline.weight(.bold))
                    .italic()
                    .foregroundColor(card.accent.color)
            }

            if let threeWays = card.threeWaysContext {
                threeWaysVotingContent(threeWays)
            } else if let primaryGuide = card.primaryGuideContext {
                primaryGuideBodyView(primaryGuide)
            } else if card.kind == .officesInfluence {
                officesInfluenceBodyView(card.ballotItems ?? [])
            } else if card.kind == .ballotMeasures {
                ballotMeasuresBodyView(intro: card.body, items: card.ballotItems ?? [])
            } else {
                Text(card.body)
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let rcvDemoContext = card.rcvDemoContext {
                if !rcvDemoContext.whereSummaryLines.isEmpty {
                    rankedChoiceWhereSummaryView(lines: rcvDemoContext.whereSummaryLines)
                    .padding(.top, 6)
                }

                RankedChoiceVotingView(
                    title: l("app.guide.card.special_rules.title.rcv", "Ranked-Choice Voting"),
                    candidateCount: 4,
                    defaultMuted: false,
                    idleTimeoutSeconds: 30,
                    isEmbedded: true
                )
                .frame(height: 305)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                )
                .padding(.top, 6)
            }

            if card.runoffDemoContext != nil {
                RunoffThresholdGateView(
                    title: l("app.guide.card.special_rules.title.runoff", "Runoff Rules"),
                    stateCode: stateCode,
                    stateName: stateName,
                    isEmbedded: true
                )
                .padding(.top, 6)
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
        .shadow(color: VoteNowColors.primaryText.opacity(0.05), radius: 2, x: 0, y: 1)
    }

    private func rankedChoiceWhereSummaryView(lines: [String]) -> some View {
        let items = parsedRankedChoiceSummaryItems(from: lines)
        return VStack(alignment: .leading, spacing: 8) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                HStack(alignment: .top, spacing: 8) {
                    Text(item.icon)
                        .font(.caption)
                        .padding(.top, 1)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(item.label)
                            .font(.caption2.weight(.bold))
                            .foregroundColor(Color(hex: "#5A43B5"))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 2)
                            .background(
                                Capsule()
                                    .fill(Color(hex: "#EDE7FF"))
                            )

                        Text(item.value)
                            .font(.caption)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
        }
        .padding(10)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(hex: "#F7F4FF"))
        )
        .overlay(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .stroke(Color(hex: "#D7CCFF"), lineWidth: 1)
        )
    }

    private func parsedRankedChoiceSummaryItems(from lines: [String]) -> [(label: String, value: String, icon: String)] {
        lines.compactMap { line in
            let parts = line.split(separator: ":", maxSplits: 1).map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
            guard !parts.isEmpty else { return nil }
            if parts.count == 1 {
                return ("Info", parts[0], "ℹ️")
            }
            let label = parts[0]
            let value = parts[1]
            let icon: String
            switch label.lowercased() {
            case "where":
                icon = "📍"
            case "examples":
                icon = "🗳️"
            case "status":
                icon = "✅"
            default:
                icon = "ℹ️"
            }
            return (label, value, icon)
        }
    }

    private var electionSubtitleText: String {
        guard let upcomingElection else {
            return l("app.guide.subtitle.none", "No upcoming election loaded")
        }
        return displayElectionTitle(for: upcomingElection)
    }

    private func introLineView(proxy: ScrollViewProxy) -> some View {
        Group {
            if let upcomingElection {
                VStack(alignment: .leading, spacing: 6) {
                    introMainLineText(for: upcomingElection)
                    introSupplementalBullets(for: upcomingElection)
                }
                .environment(\.openURL, OpenURLAction { url in
                    handleIntroLink(url, proxy: proxy)
                    return .handled
                })
            } else {
                Text(l("app.guide.error.enter_valid", "Enter a valid state or ZIP to load your upcoming election guide."))
            }
        }
        .font(.body)
        .foregroundColor(VoteNowColors.primaryText)
    }

    private func introMainLineText(for election: Election) -> Text {
        let voterLabel = stateName.isEmpty ? l("app.guide.voters.label", "voters") : "\(stateName) \(l("app.guide.voters.label", "voters"))"

        let prefix: String
        if Calendar.current.isDate(election.startDate, inSameDayAs: election.electionDay) {
            prefix = lf(
                "app.guide.intro.same_day.prefix",
                "On %@, %@ are eligible to vote in the ",
                formatLongDate(election.electionDay),
                voterLabel
            )
        } else {
            prefix = lf(
                "app.guide.intro.range.prefix",
                "Starting %@ through %@, %@ are eligible to vote in the ",
                formatLongDate(election.startDate),
                formatLongDate(election.electionDay),
                voterLabel
            )
        }

        let descriptor = displayElectionTitle(for: election)
        let primaryPhrase = primaryIntroPhraseWithState(for: election)

        var composed = AttributedString(prefix)
        composed += linkedDescriptorAttributedText(descriptor)
        composed += AttributedString(primaryPhrase.prefixText)
        composed += linkedDescriptorSegment(
            text: primaryPhrase.highlightedPhrase,
            color: VoteNowColors.successGreen,
            target: .primaryGuide
        )
        composed += AttributedString(".")

        return Text(composed)
    }

    @ViewBuilder
    private func introSupplementalBullets(for election: Election) -> some View {
        let state = (stateCodeForElection(election) ?? stateCode ?? "").uppercased()
        let feature = state.isEmpty ? nil : stateVotingFeature(for: state)
        let hasRankedChoice = feature.map { hasSubstantiveSpecialRule($0.rankedChoiceStatus, kind: .rankedChoice) } ?? false
        let hasRunoff = feature.map { hasSubstantiveSpecialRule($0.runoffRules, kind: .runoff) } ?? false
        let ballotMeasureCount = ballotMeasureCountForIntro(for: election)

        if hasRankedChoice, let feature {
            introBulletLine(
                descriptor: "Ranked-Choice Voting",
                descriptorColor: Color(hex: "#1E9C89"),
                detail: feature.rankedChoiceStatus,
                target: .specialRules
            )
        }

        if hasRunoff, let feature {
            introBulletLine(
                descriptor: "Runoff Rules",
                descriptorColor: Color(hex: "#A45A2A"),
                detail: feature.runoffRules,
                target: .specialRules
            )
        }

        if ballotMeasureCount > 0 {
            let measureLabel = ballotMeasureCount == 1 ? "measure" : "measures"
            introBulletLine(
                descriptor: "Ballot Measures",
                descriptorColor: ElectionGuideCardAccent.ballotMeasures.color,
                detail: "You will vote on \(ballotMeasureCount) statewide \(measureLabel).",
                target: .ballotMeasures
            )
        }
    }

    private func introBulletLine(
        descriptor: String,
        descriptorColor: Color,
        detail: String,
        target: GuideCardAnchor
    ) -> Text {
        let cleanedDetail = detail.trimmingCharacters(in: .whitespacesAndNewlines)
        let suffix = cleanedDetail.hasSuffix(".") ? cleanedDetail : "\(cleanedDetail)."
        var composed = AttributedString("• ")
        composed += linkedDescriptorSegment(
            text: descriptor,
            color: descriptorColor,
            target: target
        )
        composed += AttributedString(": \(suffix)")
        return Text(composed)
    }

    private func styledElectionDescriptorText(for election: Election) -> Text {
        let descriptor = displayElectionTitle(for: election)
        let tokens = descriptor.split(separator: " ", omittingEmptySubsequences: true)
        guard !tokens.isEmpty else { return Text(descriptor) }

        return tokens.enumerated().reduce(Text("")) { partial, part in
            let token = String(part.element)
            let accent = accentForDescriptorToken(token)

            var piece = Text(token)
            if let accent {
                piece = piece
                    .foregroundColor(accent.color)
                    .bold()
                    .italic()
            }

            if part.offset > 0 {
                piece = Text(" ") + piece
            }

            return partial + piece
        }
    }

    private func linkedDescriptorAttributedText(_ descriptor: String) -> AttributedString {
        let tokens = descriptor.split(separator: " ", omittingEmptySubsequences: true)
        guard !tokens.isEmpty else { return AttributedString(descriptor) }

        var composed = AttributedString("")
        for (offset, token) in tokens.enumerated() {
            if offset > 0 {
                composed += AttributedString(" ")
            }

            let raw = String(token)
            let normalized = raw.lowercased().trimmingCharacters(in: .punctuationCharacters)
            if normalized.contains("midterm") {
                composed += linkedDescriptorSegment(text: raw, color: ElectionGuideCardAccent.midterm.color, target: .mainElection)
            } else if normalized.contains("primary") {
                composed += linkedDescriptorSegment(text: raw, color: ElectionGuideCardAccent.primary.color, target: .primaryGuide)
            } else {
                composed += AttributedString(raw)
            }
        }
        return composed
    }

    private func linkedDescriptorSegment(text: String, color: Color, target: GuideCardAnchor) -> AttributedString {
        var segment = AttributedString(text)
        segment.foregroundColor = color
        segment.font = .body.bold().italic()
        segment.link = guideAnchorURL(for: target)
        return segment
    }

    private func primaryIntroPhraseWithState(for election: Election) -> (prefixText: String, highlightedPhrase: String) {
        guard phaseForElection(election) == .primary, let code = stateCode else {
            return (prefixText: "", highlightedPhrase: "")
        }

        let primaryType = primaryTypeLabel(for: election, stateCode: code)
        let primaryPhrase = primaryTypePhraseForIntro(primaryType)
        let stateDisplayName = election.jurisdictionName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? (Self.stateNameByCode[code] ?? "This state")
            : election.jurisdictionName
        return (prefixText: ". \(stateDisplayName) has ", highlightedPhrase: primaryPhrase)
    }

    private func guideCardScrollID(index: Int) -> String {
        "guide-card-\(index)"
    }

    private func guideAnchorURL(for target: GuideCardAnchor) -> URL {
        URL(string: "votenow-guide://\(target.rawValue)")!
    }

    private func handleIntroLink(_ url: URL, proxy: ScrollViewProxy) {
        guard url.scheme == "votenow-guide", let host = url.host, let target = GuideCardAnchor(rawValue: host) else {
            return
        }

        if target == .voterID {
            withAnimation(.easeInOut(duration: 0.3)) {
                proxy.scrollTo(GuideCardAnchor.voterID.rawValue, anchor: .top)
            }
            return
        }

        guard let index = targetCardIndex(for: target) else { return }
        withAnimation(.easeInOut(duration: 0.3)) {
            proxy.scrollTo(guideCardScrollID(index: index), anchor: .top)
        }
    }

    private func targetCardIndex(for target: GuideCardAnchor) -> Int? {
        switch target {
        case .mainElection:
            return guideCards.firstIndex(where: { $0.accent == .midterm || $0.accent == .presidential || $0.accent == .general })
        case .primaryGuide:
            return guideCards.firstIndex(where: { $0.primaryGuideContext != nil })
        case .specialRules:
            return guideCards.firstIndex(where: { $0.rcvDemoContext != nil || $0.runoffDemoContext != nil })
        case .ballotMeasures:
            return guideCards.firstIndex(where: { $0.kind == .ballotMeasures })
        case .voterID:
            return nil
        }
    }

    private func accentForDescriptorToken(_ token: String) -> ElectionGuideCardAccent? {
        let normalized = token
            .lowercased()
            .trimmingCharacters(in: .punctuationCharacters)

        if normalized.contains("midterm") { return .midterm }
        if normalized.contains("primary") { return .primary }
        return nil
    }

    private func refreshGuide() {
        guard let resolvedStateCode = resolveStateCode() else {
            clearGuide(message: l("app.guide.error.enter_valid_next", "Enter a valid state or ZIP to see your next election guide."))
            return
        }

        let candidates = loadUpcomingElections(for: resolvedStateCode)
        guard let nextElection = selectUpcomingElection(from: candidates) else {
            clearGuide(message: l("app.guide.error.no_upcoming", "No upcoming elections found for your state."))
            return
        }

        stateCode = resolvedStateCode
        stateName = nextElection.jurisdictionName
        upcomingElection = nextElection
        guideCards = buildGuideCards(for: nextElection, stateCode: resolvedStateCode, elections: candidates)
        errorMessage = nil
    }

    private func clearGuide(message: String) {
        upcomingElection = nil
        stateCode = nil
        stateName = ""
        guideCards = []
        errorMessage = message
    }

    private func resolveStateCode() -> String? {
        let directZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if directZip.count == 5, let code = stateResolver.stateCode(for: directZip) {
            return code
        }

        let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if addressZip.count == 5, let code = stateResolver.stateCode(for: addressZip) {
            return code
        }

        let rawState = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !rawState.isEmpty else { return nil }

        if rawState.count == 2 {
            return rawState.uppercased()
        }

        return Self.stateCodeByName[rawState.lowercased()]
    }

    private func loadUpcomingElections(for stateCode: String) -> [Election] {
        let today = Calendar.current.startOfDay(for: Date())

        let cached = planVM.upcomingElections
            .filter { stateCodeForElection($0) == stateCode }
            .filter { Calendar.current.startOfDay(for: $0.electionDay) >= today }
            .sorted { $0.electionDay < $1.electionDay }
        if !cached.isEmpty {
            return cached
        }

        return loadElectionsFromBundle(for: stateCode)
            .filter { Calendar.current.startOfDay(for: $0.electionDay) >= today }
            .sorted { $0.electionDay < $1.electionDay }
    }

    private func selectUpcomingElection(from elections: [Election]) -> Election? {
        elections.sorted {
            if $0.electionDay != $1.electionDay {
                return $0.electionDay < $1.electionDay
            }
            return displayElectionTitle(for: $0) < displayElectionTitle(for: $1)
        }
        .first
    }

    private func loadElectionsFromBundle(for stateCode: String) -> [Election] {
        guard let url = Bundle.main.url(forResource: "USMidterm2026ElectionDates", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let records = try? JSONDecoder().decode([MidtermStateElectionRecord].self, from: data),
              let record = records.first(where: { $0.state_code == stateCode }) else {
            return []
        }

        let stateName = record.state_name
        let midtermName = "\(stateName) 2026 Midterm"
        let presidentialName = "\(stateName) 2028 Presidential"
        var built: [Election] = []

        func appendElection(
            electionName: String,
            electionType: String,
            subtitle: String,
            electionDateISO: String?,
            registrationISO: String?,
            earlyVotingISO: String?
        ) {
            guard let electionDate = Self.isoDate(from: electionDateISO) else { return }
            let registrationDate = Self.isoDate(from: registrationISO) ?? electionDate
            let earlyVotingDate = Self.isoDate(from: earlyVotingISO)
            let earlyVotingText = displayText(from: earlyVotingISO, fallbackDate: earlyVotingDate)
            let registrationText = displayText(from: registrationISO, fallbackDate: registrationDate)

            built.append(
                Election(
                    name: electionName,
                    subtitle: subtitle,
                    registrationDeadline: registrationDate,
                    startDate: earlyVotingDate ?? electionDate,
                    electionDay: electionDate,
                    earlyVotingText: earlyVotingText,
                    registrationNotes: record.registration_notes,
                    jurisdictionLevel: "statewide",
                    jurisdictionName: stateName,
                    visibility: "public",
                    flags: [
                        "STATE_CODE:\(stateCode)",
                        "ELECTION_TYPE:\(electionType)",
                        "REGISTRATION_DEADLINE_TEXT:\(registrationText)"
                    ],
                    matchConfidence: nil,
                    sourceUrl: record.primary_source
                )
            )
        }

        appendElection(
            electionName: midtermName,
            electionType: "PRIMARY",
            subtitle: "Primary Election",
            electionDateISO: record.primary_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            electionType: "PRIMARY_RUNOFF",
            subtitle: "Primary Runoff Election",
            electionDateISO: record.primary_runoff_date,
            registrationISO: record.registration_deadline_primary,
            earlyVotingISO: record.early_voting_primary_runoff ?? record.early_voting_primary
        )

        appendElection(
            electionName: midtermName,
            electionType: "GENERAL",
            subtitle: "General Election",
            electionDateISO: record.general_election_date,
            registrationISO: record.registration_deadline_general,
            earlyVotingISO: record.early_voting_general
        )

        appendElection(
            electionName: presidentialName,
            electionType: "PRESIDENTIAL_PRIMARY",
            subtitle: "Presidential Primary Election",
            electionDateISO: Self.projectedPresidentialPrimaryISO(from: record.primary_date),
            registrationISO: "TBD for 2028 cycle",
            earlyVotingISO: "TBD for 2028 cycle"
        )

        appendElection(
            electionName: presidentialName,
            electionType: "PRESIDENTIAL_GENERAL",
            subtitle: "Presidential General Election",
            electionDateISO: "2028-11-07",
            registrationISO: "TBD for 2028 cycle",
            earlyVotingISO: "TBD for 2028 cycle"
        )

        return built
    }

    private func displayElectionTitle(for election: Election) -> String {
        let state = election.jurisdictionName
        let base = election.name
            .replacingOccurrences(of: state, with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let phase = election.subtitle
            .replacingOccurrences(of: "Election", with: "")
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if !base.isEmpty, !phase.isEmpty {
            let phaseWords = phase.split(separator: " ").map(String.init)
            if let lastBaseWord = base.split(separator: " ").last?.lowercased(),
               let firstPhaseWord = phaseWords.first?.lowercased(),
               lastBaseWord == firstPhaseWord {
                let dedupedPhase = phaseWords.dropFirst().joined(separator: " ")
                if !dedupedPhase.isEmpty {
                    return "\(base) \(dedupedPhase)"
                }
            }
            return "\(base) \(phase)"
        }

        if !base.isEmpty { return base }
        if !phase.isEmpty { return phase }
        return election.name
    }

    private func buildGuideCards(for election: Election, stateCode: String, elections: [Election]) -> [ElectionGuideInfoCard] {
        let phase = phaseForElection(election)
        let overviewCards = electionTypeOverviewCards(for: election)
        var cards: [ElectionGuideInfoCard] = []

        if phase == .primary,
           let midtermCard = overviewCards.first(where: { $0.accent == .midterm }) {
            cards.append(midtermCard)
        }

        switch phase {
        case .primary:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.primary.title", "A Primary Election"),
                    body: l("app.guide.card.primary.body", "A primary election decides which candidates advance to the general election."),
                    accent: .primary
                )
            )

            cards.append(
                primaryGuideCard(for: election, stateCode: stateCode, elections: elections)
            )

            if stateCode == "CA" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.jungle.title", "Jungle Primary"),
                        body: l("app.guide.card.jungle.body", "California uses a top-two primary for many offices: all candidates appear on one ballot, and the top two finishers advance to the general election regardless of party."),
                        accent: .primary
                    )
                )
            } else if stateCode == "WA" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.top_two.title", "Top-Two Primary"),
                        body: l("app.guide.card.top_two.body", "Washington uses a top-two style primary for many races, where all voters can choose from all candidates and the top two advance."),
                        accent: .primary
                    )
                )
            }

        case .runoff:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.runoff.title", "Primary Runoff"),
                    body: l("app.guide.card.runoff.body", "A runoff election happens when no candidate reaches the required threshold in the first primary round."),
                    accent: .runoff
                )
            )

        case .general:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.general.title", "General Election"),
                    body: l("app.guide.card.general.body", "The general election determines who takes office from the candidates who qualified in earlier rounds."),
                    accent: .general
                )
            )

            if stateCode == "AK" || stateCode == "ME" {
                cards.append(
                    ElectionGuideInfoCard(
                        title: l("app.guide.card.ranked_choice.title", "Ranked Choice"),
                        body: l("app.guide.card.ranked_choice.body", "Ranked-choice voting can apply in covered contests. You can rank candidates in order of preference where allowed."),
                        accent: .general
                    )
                )
            }

        case .special:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.special.title", "Special Election"),
                    body: l("app.guide.card.special.body", "Special elections fill vacancies or decide urgent ballot questions outside the normal election calendar."),
                    accent: .special
                )
            )

        case .unknown:
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.overview.title", "Election Overview"),
                    body: l("app.guide.card.overview.body", "This guide is personalized to your next upcoming election based on your current ZIP and state.")
                )
            )
        }

        if phase == .primary {
            cards.append(contentsOf: overviewCards.filter { $0.accent != .midterm })
        } else {
            cards.append(contentsOf: overviewCards)
        }

        cards.append(contentsOf: specialBallotRulesGuideCards(for: election, stateCode: stateCode))
        cards.append(ballotMeasuresGuideCard(for: election))
        return cards
    }

    private func electionTypeOverviewCards(for election: Election) -> [ElectionGuideInfoCard] {
        let subtitle = election.subtitle.lowercased()
        let title = displayElectionTitle(for: election).lowercased()
        let joined = "\(subtitle) \(title)"

        if joined.contains("presidential") {
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.presidential.title", "Presidential Elections"),
                    body: l(
                        "app.guide.card.presidential.body",
                        "Ballot contents below are pulled from your state timeline, plus statewide/local ballot measures where scheduled. This election happens every 4 years."
                    ),
                    accent: .presidential,
                    ballotItems: ballotItemsForOverviewCard(
                        for: election,
                        includeStatewideMeasures: true,
                        fallback: [
                            "President and Vice President",
                            "All U.S. House seats",
                            "Some U.S. Senate seats",
                            "State/local offices and ballot measures (where scheduled)"
                        ]
                    )
                )
            ]
        }

        if joined.contains("midterm") {
            let officeItems = officesAndInfluenceItems(for: election)
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.midterm.title", "Midterm Elections"),
                    body: l(
                        "app.guide.card.midterm.body.reused_offices",
                        "Offices below are pulled from your state timeline and matched to plain-English responsibilities."
                    ),
                    accent: .midterm,
                    kind: .officesInfluence,
                    ballotItems: officeItems
                )
            ]
        }

        if joined.contains("mayor") || joined.contains("mayoral") {
            return [
                ElectionGuideInfoCard(
                    title: l("app.guide.card.mayoral.title", "Mayoral Elections"),
                    body: l("app.guide.card.mayoral.body", "City-level election focused on municipal leadership and local policy."),
                    ballotItems: ballotItemsForOverviewCard(
                        for: election,
                        fallback: [
                            "Mayor",
                            "City council or other city offices",
                            "Local ballot questions (if applicable)"
                        ]
                    )
                )
            ]
        }

        return []
    }

    private func ballotItemsForOverviewCard(
        for election: Election,
        includeStatewideMeasures: Bool = false,
        ensureStateLegislature: Bool = false,
        fallback: [String]
    ) -> [String] {
        var items = timelineDerivedBallotItems(for: election, includePartyFilter: false)
        if items.isEmpty {
            items = fallback
        }

        if includeStatewideMeasures &&
            !items.contains(where: { $0.localizedCaseInsensitiveContains("ballot measure") }) {
            items.append("Statewide/local ballot measures (where scheduled)")
        }

        if ensureStateLegislature &&
            stateHasStateLegislatureOnBallot(for: election) &&
            !items.contains(where: { $0.localizedCaseInsensitiveContains("state legislature") }) {
            items.append("State Legislature")
        }

        return dedupedAndAnnotatedOverviewItems(items)
    }

    private func timelineDerivedBallotItems(for election: Election, includePartyFilter: Bool = true) -> [String] {
        guard let dataset = Self.ballotTimelineDataset,
              let rawStateCode = stateCodeForElection(election) ?? stateCode,
              let cycleYear = supportedCycleYear(for: election) else {
            return []
        }

        let state = rawStateCode.uppercased()
        let phase = phaseForElection(election)
        let stage = (phase == .general) ? "general" : "primary"
        let stageLabel = phase == .general ? "General" : (phase == .runoff ? "Runoff" : "Primary")

        let rows = dataset.timeline_dataset
            .filter { row in
                row.state_abbr.uppercased() == state &&
                    row.election_stage.lowercased() == stage &&
                    rowIsOnBallot(row, forCycleYear: cycleYear) &&
                    (!includePartyFilter || rowMatchesSelectedParty(row, phase: phase))
            }
            .sorted { lhs, rhs in
                let leftOffice = officeSortOrder(for: lhs.office_family)
                let rightOffice = officeSortOrder(for: rhs.office_family)
                if leftOffice != rightOffice { return leftOffice < rightOffice }

                let leftParty = partySortOrder(for: lhs.party)
                let rightParty = partySortOrder(for: rhs.party)
                if leftParty != rightParty { return leftParty < rightParty }

                return lhs.dropdown_label.localizedCaseInsensitiveCompare(rhs.dropdown_label) == .orderedAscending
            }

        if rows.isEmpty {
            return []
        }

        let collapseByOfficeFamily = planVM.selectedParty == .independent && (phase == .primary || phase == .runoff)
        var seenOfficeFamilies = Set<String>()
        var seenTitles = Set<String>()
        var output: [String] = []

        for row in rows {
            if collapseByOfficeFamily {
                let key = row.office_family.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
                if seenOfficeFamilies.contains(key) { continue }
                seenOfficeFamilies.insert(key)
            }

            let officeTitle = ballotOfficeTitle(for: row.office_family)
            let partyLabel = normalizedPartyLabel(for: row.party)
            let title: String
            if phase != .general, !partyLabel.isEmpty, !collapseByOfficeFamily {
                title = "\(officeTitle) \(partyLabel) \(stageLabel)"
            } else {
                title = "\(officeTitle) \(stageLabel)"
            }

            if seenTitles.insert(title).inserted {
                output.append(title)
            }
        }

        return output
    }

    private func stateHasStateLegislatureOnBallot(for election: Election) -> Bool {
        guard let dataset = Self.ballotTimelineDataset,
              let rawStateCode = stateCodeForElection(election) ?? stateCode,
              let cycleYear = supportedCycleYear(for: election) else {
            return false
        }

        let state = rawStateCode.uppercased()
        let phase = phaseForElection(election)
        let stage = (phase == .general) ? "general" : "primary"

        return dataset.timeline_dataset.contains { row in
            row.state_abbr.uppercased() == state &&
                row.election_stage.lowercased() == stage &&
                row.office_family.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "state_legislature" &&
                rowIsOnBallot(row, forCycleYear: cycleYear)
        }
    }

    private func dedupedAndAnnotatedOverviewItems(_ items: [String]) -> [String] {
        var seen = Set<String>()
        var output: [String] = []

        for item in items {
            let normalized = item.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !normalized.isEmpty, seen.insert(normalized).inserted else { continue }
            output.append(annotateOfficeCycleLength(in: normalized))
        }
        return output
    }

    private func annotateOfficeCycleLength(in item: String) -> String {
        let lower = item.lowercased()
        guard !lower.contains("every ") else { return item }

        if lower.contains("u.s. senate") {
            return "\(item) (every 6 years)"
        }
        if lower.contains("u.s. house") {
            return "\(item) (every 2 years)"
        }
        if lower.contains("president and vice president") || lower.contains("president") {
            return "\(item) (every 4 years)"
        }
        return item
    }

    private func supportedCycleYear(for election: Election) -> Int? {
        let year = Calendar.current.component(.year, from: election.electionDay)
        if year == 2026 || year == 2028 {
            return year
        }
        return nil
    }

    private func rowIsOnBallot(_ row: ElectionGuideBallotTimelineRow, forCycleYear year: Int) -> Bool {
        let raw = year == 2026 ? row.on_ballot_in_2026_cycle : row.on_ballot_in_2028_cycle
        return raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() == "yes"
    }

    private func rowMatchesSelectedParty(_ row: ElectionGuideBallotTimelineRow, phase: ElectionGuidePhase) -> Bool {
        let normalizedParty = row.party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if phase == .general {
            return normalizedParty == "n/a"
        }

        switch planVM.selectedParty {
        case .democrat:
            return normalizedParty == "democratic"
        case .republican:
            return normalizedParty == "republican"
        case .independent:
            return normalizedParty == "democratic" || normalizedParty == "republican"
        }
    }

    private func officeSortOrder(for officeFamily: String) -> Int {
        switch officeFamily.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "president": return 0
        case "us_senate": return 1
        case "us_house": return 2
        case "governor": return 3
        case "state_legislature": return 4
        case "statewide_exec": return 5
        case "judicial": return 6
        case "local": return 7
        case "ballot_measures": return 8
        default: return 100
        }
    }

    private func partySortOrder(for party: String) -> Int {
        switch party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "democratic": return 0
        case "republican": return 1
        case "n/a": return 2
        default: return 3
        }
    }

    private func ballotOfficeTitle(for officeFamily: String) -> String {
        switch officeFamily.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "president":
            return "President and Vice President"
        case "us_senate":
            return "U.S. Senate"
        case "us_house":
            return "U.S. House"
        case "governor":
            return "Governor"
        case "state_legislature":
            return "State Legislature"
        case "statewide_exec":
            return "Statewide Executive Offices"
        case "judicial":
            return "Judicial Offices"
        case "local":
            return "Local Offices"
        case "ballot_measures":
            return "Ballot Measures"
        default:
            return officeFamily
                .replacingOccurrences(of: "_", with: " ")
                .split(separator: " ")
                .map { $0.capitalized }
                .joined(separator: " ")
        }
    }

    private func normalizedPartyLabel(for party: String) -> String {
        switch party.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "democratic":
            return "Democrat"
        case "republican":
            return "Republican"
        default:
            return ""
        }
    }

    private func ballotMeasuresGuideCard(for election: Election) -> ElectionGuideInfoCard {
        let state = (stateCodeForElection(election) ?? stateCode ?? "").uppercased()
        let officialItems = officialStatewideMeasureItems(for: election, stateCode: state)
        let timelineItems = timelineMeasureItems(for: election, includePlaceholder: false)
        let policy = ballotMeasurePolicy(forStateCode: state)
        let policyItems = ballotMeasurePolicyItems(policy, stateCode: state)

        var combined: [String] = []
        if !officialItems.isEmpty {
            combined.append(contentsOf: officialItems)
        } else if !timelineItems.isEmpty {
            combined.append(contentsOf: timelineItems)
        } else if !policyItems.isEmpty {
            combined.append(contentsOf: policyItems)
        }

        if combined.isEmpty {
            combined.append(
                l(
                    "app.guide.card.ballot_measures.placeholder",
                    "Specific measure titles for your ballot are being integrated."
                )
            )
        }

        let introBody: String
        if !officialItems.isEmpty {
            let stateLabel = Self.stateNameByCode[state] ?? "your state"
            introBody = lf(
                "app.guide.card.ballot_measures.body.official.concise",
                "In %@, voters can directly vote yes or no on these statewide measures.",
                stateLabel
            )
        } else {
            introBody = l(
                "app.guide.card.ballot_measures.body.concise",
                "Ballot measures are direct votes on policy questions."
            )
        }

        return ElectionGuideInfoCard(
            title: l("app.guide.card.ballot_measures.title", "Ballot Measures You Will Decide"),
            body: introBody,
            accent: .ballotMeasures,
            kind: .ballotMeasures,
            ballotItems: combined
        )
    }

    private func ballotMeasureCountForIntro(for election: Election) -> Int {
        let state = (stateCodeForElection(election) ?? stateCode ?? "").uppercased()
        guard !state.isEmpty else { return 0 }
        let official = officialStatewideMeasureItems(for: election, stateCode: state)
        if !official.isEmpty {
            return official.count
        }

        let timeline = timelineMeasureItems(for: election, includePlaceholder: false)
        return timeline.count
    }

    private func officialStatewideMeasureItems(for election: Election, stateCode: String) -> [String] {
        guard !stateCode.isEmpty else { return [] }

        let rows = Self.statewideBallotMeasuresByStateCode[stateCode] ?? []
        guard !rows.isEmpty else { return [] }

        let cycleYear = supportedCycleYear(for: election)
        let filteredByCycle: [ElectionGuideStatewideBallotMeasure]
        if let cycleYear {
            filteredByCycle = rows.filter { $0.electionDate.hasPrefix("\(cycleYear)") }
        } else {
            filteredByCycle = rows
        }

        let sourceRows = filteredByCycle.isEmpty ? rows : filteredByCycle
        let sorted = sourceRows.sorted { lhs, rhs in
            if lhs.electionDate != rhs.electionDate {
                return lhs.electionDate < rhs.electionDate
            }
            return lhs.measure.localizedCaseInsensitiveCompare(rhs.measure) == .orderedAscending
        }

        return sorted.prefix(8).compactMap { row in
            let measure = row.measure.trimmingCharacters(in: .whitespacesAndNewlines)
            let summary = row.shortSummary.trimmingCharacters(in: .whitespacesAndNewlines)
            let dateText = displayText(from: row.electionDate, fallbackDate: nil)

            if measure.isEmpty && summary.isEmpty {
                return nil
            }
            if measure.isEmpty {
                return "\(summary) (\(dateText))"
            }
            if summary.isEmpty {
                return "\(measure) (\(dateText))"
            }
            return "\(measure) (\(dateText)): \(summary)"
        }
    }

    private func ballotMeasurePolicy(forStateCode stateCode: String) -> ElectionGuideBallotMeasurePolicy? {
        guard !stateCode.isEmpty else { return nil }
        return Self.ballotMeasurePoliciesByState[stateCode]
    }

    private func ballotMeasurePolicyItems(_ policy: ElectionGuideBallotMeasurePolicy?, stateCode: String) -> [String] {
        guard let policy else { return [] }

        var items: [String] = []
        let stateLabel = policy.state.isEmpty ? stateCode : policy.state

        if !policy.citizenProcess.isEmpty {
            items.append("\(stateLabel): citizen petition process is \(policy.citizenProcess).")
        }
        if !policy.vetoReferendum.isEmpty {
            items.append("Referendum to challenge a law: \(policy.vetoReferendum).")
        }
        if !policy.constitutionalAmendmentApprovalRequired.isEmpty {
            items.append("Constitution changes require voter approval: \(policy.constitutionalAmendmentApprovalRequired).")
        }
        if items.isEmpty, !policy.explicitPolicySummary.isEmpty {
            items.append(policy.explicitPolicySummary)
        }
        return Array(items.prefix(4))
    }

    private func officesAndInfluenceItems(for election: Election) -> [String] {
        let timelineItems = timelineDerivedBallotItems(for: election, includePartyFilter: false)
        let integrated = officePowerLineItems(forTimelineTitles: timelineItems)
        let fallback = framedOfficeInfluenceItems(from: timelineItems)
        return integrated.isEmpty ? fallback : integrated
    }

    private func officePowerLineItems(forTimelineTitles titles: [String]) -> [String] {
        let source = titles.isEmpty
            ? [
                "President and Vice President",
                "U.S. Senate",
                "U.S. House",
                "Governor",
                "State Legislature",
                "Statewide Executive Offices",
                "Local Offices"
            ]
            : titles

        var seen = Set<String>()
        var output: [String] = []

        for title in source {
            if let row = officePowerRow(forOfficeTitle: title) {
                let line = "\(row.office): \(row.plainEnglishResponsibility)\n    Example: \(row.currentExample)"
                if seen.insert(line).inserted {
                    output.append(line)
                }
                continue
            }

            let framed = frameInfluenceText(forOfficeTitle: title)
            if seen.insert(framed).inserted {
                output.append(framed)
            }
        }

        return Array(output.prefix(5))
    }

    private func officePowerRow(forOfficeTitle title: String) -> ElectionGuideOfficePowerRow? {
        guard let key = normalizedOfficePowerKey(from: title) else { return nil }
        return Self.officePowersByKey[key]
    }

    private func normalizedOfficePowerKey(from title: String) -> String? {
        let normalized = title
            .lowercased()
            .replacingOccurrences(of: "[^a-z0-9 ]", with: " ", options: .regularExpression)
            .replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)

        if normalized.contains("white house") || normalized.contains("president") {
            return "white house president"
        }
        if normalized.contains("u s senate") || normalized.contains("us senate") {
            return "us senate"
        }
        if normalized.contains("u s house") || normalized.contains("us house") {
            return "us house"
        }
        if normalized.contains("governor") {
            return "governor"
        }
        if normalized.contains("state legislature") || normalized.contains("state rep") {
            return "state rep"
        }
        if normalized.contains("attorney general") || normalized.contains("statewide executive") {
            return "state attorney general"
        }
        if normalized.contains("mayor") || normalized.contains("local offices") || normalized.contains("local office") {
            return "mayor"
        }

        return nil
    }

    private func framedOfficeInfluenceItems(from titles: [String]) -> [String] {
        let source = titles.isEmpty
            ? [
                "President and Vice President",
                "U.S. Senate",
                "U.S. House",
                "Governor",
                "State Legislature",
                "Local Offices"
            ]
            : titles

        var seen = Set<String>()
        var output: [String] = []

        for title in source {
            let framed = frameInfluenceText(forOfficeTitle: title)
            if seen.insert(framed).inserted {
                output.append(framed)
            }
        }
        return output
    }

    private func frameInfluenceText(forOfficeTitle title: String) -> String {
        let lower = title.lowercased()
        if lower.contains("president") {
            return "\(title): sets national executive priorities, federal agency direction, and veto/sign authority."
        }
        if lower.contains("u.s. senate") || lower.contains("senate") {
            return "\(title): shapes federal law, confirms judges/appointments, and approves treaties."
        }
        if lower.contains("u.s. house") || lower.contains("house") {
            return "\(title): initiates budget/tax bills and represents district interests in federal legislation."
        }
        if lower.contains("governor") {
            return "\(title): leads state executive branch, signs/vetoes state laws, and sets state policy direction."
        }
        if lower.contains("state legislature") {
            return "\(title): passes state laws, budgets, and policy frameworks that affect statewide programs."
        }
        if lower.contains("judicial") {
            return "\(title): interprets laws and legal disputes, affecting rights and policy application."
        }
        if lower.contains("local") || lower.contains("council") || lower.contains("mayor") {
            return "\(title): impacts city/county budgets, schools, zoning, transportation, and public safety decisions."
        }
        if lower.contains("ballot measure") {
            return "\(title): allows direct voter decisions on policy, funding, or constitutional/statutory changes."
        }
        return "\(title): affects policy and governance outcomes for your community and representation level."
    }

    private func specialBallotRulesGuideCards(for _: Election, stateCode: String) -> [ElectionGuideInfoCard] {
        guard let feature = stateVotingFeature(for: stateCode) else { return [] }

        let hasRankedChoice = hasSubstantiveSpecialRule(feature.rankedChoiceStatus, kind: .rankedChoice)
        let hasRunoff = hasSubstantiveSpecialRule(feature.runoffRules, kind: .runoff)

        var cards: [ElectionGuideInfoCard] = []

        if hasRankedChoice {
            let rcvWhereLines = rankedChoiceWhereSummaryLines(for: stateCode, fallbackStatus: feature.rankedChoiceStatus)
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.special_rules.title.rcv", "Ranked-Choice Voting"),
                    body: l(
                        "app.guide.card.special_rules.body",
                        "Your state has special vote-counting or advancement rules for some contests."
                    ),
                    accent: .specialRules,
                    ballotItems: ["Ranked-choice voting: \(feature.rankedChoiceStatus)"],
                    rcvDemoContext: ElectionGuideRCVDemoContext(
                        ctaText: l("app.guide.card.special_rules.rcv.cta", "Watch what happens in a RCV ballot"),
                        whereSummaryLines: rcvWhereLines
                    )
                )
            )
        }

        if hasRunoff {
            let runoffBody = runoffSecondElectionBodyText(for: stateCode)
            cards.append(
                ElectionGuideInfoCard(
                    title: l("app.guide.card.special_rules.title.runoff", "Runoff Rules"),
                    body: runoffBody,
                    accent: .runoff,
                    ballotItems: ["Runoff rules: \(feature.runoffRules)"],
                    runoffDemoContext: ElectionGuideRunoffDemoContext(
                        ctaText: l("app.guide.card.special_rules.runoff.cta", "Explore the threshold gate runoff demo")
                    )
                )
            )
        }

        return cards
    }

    private func rankedChoiceWhereSummaryLines(for stateCode: String, fallbackStatus: String) -> [String] {
        let code = stateCode.uppercased()
        guard let row = Self.rankedChoiceByState2026[code] else {
            let fallback = compactWhereLine(from: fallbackStatus)
            return fallback.isEmpty ? [] : [fallback]
        }

        var lines: [String] = []
        let whereClause = compactWhereLine(from: row.whereApplies)
        if !whereClause.isEmpty {
            lines.append("Where: \(whereClause)")
        } else {
            let mapClause = compactWhereLine(from: row.mapCategory)
            if !mapClause.isEmpty {
                lines.append("Where: \(mapClause)")
            }
        }

        let officeClause = firstListItem(from: row.explicitOffices)
        if !officeClause.isEmpty && officeClause.lowercased() != "none" {
            lines.append("Examples: \(officeClause)")
        }

        let statusClause = compactWhereLine(from: row.statusSnapshot)
        if !statusClause.isEmpty {
            lines.append("Status: \(statusClause)")
        }

        let uniqueLines = lines.reduce(into: [String]()) { partial, line in
            if !partial.contains(line) { partial.append(line) }
        }
        return Array(uniqueLines.prefix(3))
    }

    private func compactWhereLine(from raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        let stripped = trimmed.replacingOccurrences(of: "\n", with: " ")
        let condensed = stripped.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if condensed.count <= 110 {
            return condensed
        }
        let limit = 107
        let cutoffIndex = condensed.index(condensed.startIndex, offsetBy: min(limit, condensed.count))
        let prefix = condensed[..<cutoffIndex]
        let truncatedAtWord = prefix.lastIndex(where: { $0.isWhitespace }).map { prefix[..<$0] } ?? prefix
        return truncatedAtWord.trimmingCharacters(in: .whitespacesAndNewlines) + "..."
    }

    private func firstListItem(from raw: String) -> String {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "" }
        let firstChunk = trimmed
            .components(separatedBy: ";")
            .first?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed
        return compactWhereLine(from: firstChunk)
    }

    private func runoffSecondElectionBodyText(for stateCode: String) -> String {
        let normalized = stateCode.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let rule = Self.runoffThresholdRulesByStateCode[normalized]

        if let percent = rule?.primaryThresholdPercent {
            let thresholdText = abs(percent.rounded() - percent) < 0.001
                ? "\(Int(percent.rounded()))%"
                : String(format: "%.1f%%", percent)
            return "If no one gets over \(thresholdText) of the vote, the top candidates compete in a second election."
        }

        let thresholdLabel = rule?.primaryThresholdLabel.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !thresholdLabel.isEmpty {
            if thresholdLabel.contains("%") {
                return "If no one gets over \(thresholdLabel) of the vote, the top candidates compete in a second election."
            }
            return "If no one gets over the \(thresholdLabel) threshold, the top candidates compete in a second election."
        }

        return "If no one gets over 50% of the vote, the top candidates compete in a second election."
    }

    private func hasSubstantiveSpecialRule(_ value: String, kind: ElectionGuideSpecialRuleKind) -> Bool {
        let normalized = value
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
        guard !normalized.isEmpty else { return false }
        let noneMarkers = ["none", "no", "not used", "n/a", "na", "not applicable", "not statewide"]
        if noneMarkers.contains(where: { normalized == $0 || normalized.hasPrefix($0 + " ") }) {
            return false
        }

        if kind == .rankedChoice {
            let prohibitionMarkers = ["prohibited", "barred", "banned", "ban"]
            if prohibitionMarkers.contains(where: { normalized.contains($0) }) {
                return false
            }
        }

        return true
    }

    private func timelineMeasureItems(for election: Election, includePlaceholder: Bool = true) -> [String] {
        guard let dataset = Self.ballotTimelineDataset,
              let rawStateCode = stateCodeForElection(election) ?? stateCode,
              let cycleYear = supportedCycleYear(for: election) else {
            if includePlaceholder {
                return [
                    l(
                        "app.guide.card.ballot_measures.placeholder",
                        "Specific measure titles for your ballot are being integrated."
                    )
                ]
            }
            return []
        }

        let state = rawStateCode.uppercased()
        let phase = phaseForElection(election)
        let stage = (phase == .general) ? "general" : "primary"

        let measureRows = dataset.timeline_dataset.filter { row in
            let family = row.office_family.lowercased()
            let isMeasure = family.contains("measure")
                || family.contains("initiative")
                || family.contains("referendum")
                || family.contains("amendment")

            return isMeasure &&
                row.state_abbr.uppercased() == state &&
                row.election_stage.lowercased() == stage &&
                rowIsOnBallot(row, forCycleYear: cycleYear)
        }

        let items = measureRows
            .sorted { $0.dropdown_label.localizedCaseInsensitiveCompare($1.dropdown_label) == .orderedAscending }
            .map {
                $0.dropdown_label.trimmingCharacters(in: .whitespacesAndNewlines)
            }
            .filter { !$0.isEmpty }

        if items.isEmpty {
            if includePlaceholder {
                return [
                    l(
                        "app.guide.card.ballot_measures.placeholder",
                        "Specific measure titles for your ballot are being integrated."
                    )
                ]
            }
            return []
        }

        return items
    }

    private func phaseForElection(_ election: Election) -> ElectionGuidePhase {
        if let type = election.flags.first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "") {
            switch type {
            case "PRIMARY", "PRESIDENTIAL_PRIMARY":
                return .primary
            case "PRIMARY_RUNOFF":
                return .runoff
            case "GENERAL", "PRESIDENTIAL_GENERAL":
                return .general
            default:
                break
            }
        }

        let lower = election.subtitle.lowercased()
        if lower.contains("runoff") { return .runoff }
        if lower.contains("special") { return .special }
        if lower.contains("primary") { return .primary }
        if lower.contains("general") { return .general }
        return .unknown
    }

    private func stateCodeForElection(_ election: Election) -> String? {
        election.flags.first(where: { $0.hasPrefix("STATE_CODE:") })?
            .replacingOccurrences(of: "STATE_CODE:", with: "")
    }

    private func primaryGuideCard(for election: Election, stateCode: String, elections: [Election]) -> ElectionGuideInfoCard {
        let stateDisplayName = election.jurisdictionName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? (Self.stateNameByCode[stateCode] ?? "This state")
            : election.jurisdictionName
        let primaryType = primaryTypeLabel(for: election, stateCode: stateCode)
        let title = "\(stateDisplayName): \(primaryTypeHeaderLabel(for: primaryType))"
        let generalTransition = generalElectionTransitionDetails(for: election, in: elections)
        let primaryGuideContext = ElectionGuidePrimaryCardContext(
            usesTopTwoStyle: isTopTwoOrTopFourPrimaryType(primaryType),
            primaryTypeDescription: primaryTypeDescriptionLine(for: primaryType),
            generalStartInDays: generalTransition?.dayDelta,
            generalStartDateText: generalTransition?.startDateText,
            runoffLine: runoffSpecialCircumstanceLine(for: election, in: elections)
        )

        return ElectionGuideInfoCard(
            title: title,
            body: "",
            accent: .primaryHighlight,
            flagStateCode: stateCode,
            primaryGuideContext: primaryGuideContext
        )
    }

    private func primaryTypeLabel(for election: Election, stateCode: String) -> String {
        if let feature = stateVotingFeature(for: stateCode), !feature.primaryCategory.isEmpty {
            return feature.primaryCategory
        }

        guard let summary = Self.primaryTypeDataset?.state_summary.first(where: { $0.state_abbr.uppercased() == stateCode.uppercased() }) else {
            return "primary"
        }

        if electionType(for: election) == "PRESIDENTIAL_PRIMARY" {
            let presidential = summary.presidential_primary_type_2026.trimmingCharacters(in: .whitespacesAndNewlines)
            if !presidential.isEmpty {
                return presidential
            }
        }

        let statePrimary = summary.state_primary_type_2026.trimmingCharacters(in: .whitespacesAndNewlines)
        return statePrimary.isEmpty ? "primary" : statePrimary
    }

    private func primaryTypeHeaderLabel(for primaryType: String) -> String {
        let lower = primaryType.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if lower.contains("top-four") || lower.contains("top four") { return "Top-four primary" }
        if lower.contains("top-two") || lower.contains("top two") || lower.contains("jungle") { return "Top-two primary" }
        if lower.contains("partially open") || lower.contains("semi-open") || lower.contains("semi open") { return "Partially open primary" }
        if lower.contains("partially closed") || lower.contains("semi-closed") || lower.contains("semi closed") { return "Partially closed primary" }
        if lower.contains("open") { return "Open primary" }
        if lower.contains("closed") || lower.contains("affiliated") { return "Closed primary" }
        if lower.contains("nonpartisan") { return "Nonpartisan primary" }
        return "Primary"
    }

    private func primaryTypeDescriptionLine(for primaryType: String) -> String {
        let headerType = primaryTypeHeaderLabel(for: primaryType)
        switch headerType {
        case "Closed primary":
            return "Closed primary: voters generally participate only in their own party's primary."
        case "Open primary":
            return "Open primary: voters can choose one party's primary ballot."
        case "Partially open primary":
            return "Partially open primary: independents may be able to choose a party primary ballot, while party members stay in-party."
        case "Partially closed primary":
            return "Partially closed primary: registered party voters stay in-party, with limited independent access."
        case "Top-two primary":
            return "Top-two primary: all candidates appear on one ballot and the top two advance."
        case "Top-four primary":
            return "Top-four primary: all candidates appear on one ballot and top finishers advance under state rules."
        case "Nonpartisan primary":
            return "Nonpartisan primary: candidates run on one ballot without standard party-primary separation."
        default:
            return "Primary rules determine who can vote in each party ballot and who advances."
        }
    }

    private func stateVotingFeature(for stateCode: String) -> ElectionGuideStateVotingFeature? {
        Self.stateVotingFeaturesByCode[stateCode.uppercased()]
    }

    private func generalElectionTransitionDetails(for primary: Election, in elections: [Election]) -> (dayDelta: Int, startDateText: String)? {
        guard let general = nextGeneralElection(after: primary, in: elections) else { return nil }

        let primaryDay = Calendar.current.startOfDay(for: primary.electionDay)
        let generalStart = Calendar.current.startOfDay(for: general.startDate)
        let dayDelta = max(0, Calendar.current.dateComponents([.day], from: primaryDay, to: generalStart).day ?? 0)

        return (dayDelta, formatLongDate(general.startDate))
    }

    private func nextGeneralElection(after primary: Election, in elections: [Election]) -> Election? {
        let sorted = elections.sorted { $0.electionDay < $1.electionDay }
        let primaryDay = Calendar.current.startOfDay(for: primary.electionDay)
        let upcoming = sorted.filter { candidate in
            Calendar.current.startOfDay(for: candidate.electionDay) > primaryDay
        }

        if let sameCycleGeneral = upcoming.first(where: { candidate in
            isGeneralElection(candidate) && candidate.name == primary.name
        }) {
            return sameCycleGeneral
        }

        return upcoming.first(where: isGeneralElection)
    }

    private func runoffSpecialCircumstanceLine(for primary: Election, in elections: [Election]) -> String? {
        let sorted = elections.sorted { $0.electionDay < $1.electionDay }
        guard let runoff = sorted.first(where: { candidate in
            isRunoffElection(candidate) &&
            candidate.name == primary.name &&
            Calendar.current.startOfDay(for: candidate.electionDay) > Calendar.current.startOfDay(for: primary.electionDay)
        }) else {
            return nil
        }

        return "Special circumstance: if no candidate reaches the required threshold, a runoff is scheduled for \(formatLongDate(runoff.electionDay))."
    }

    private func isGeneralElection(_ election: Election) -> Bool {
        let type = electionType(for: election)
        if type == "GENERAL" || type == "PRESIDENTIAL_GENERAL" {
            return true
        }
        return election.subtitle.lowercased().contains("general")
    }

    private func isRunoffElection(_ election: Election) -> Bool {
        let type = electionType(for: election)
        if type == "PRIMARY_RUNOFF" || type == "GENERAL_RUNOFF" {
            return true
        }
        return election.subtitle.lowercased().contains("runoff")
    }

    private func electionType(for election: Election) -> String {
        election.flags
            .first(where: { $0.hasPrefix("ELECTION_TYPE:") })?
            .replacingOccurrences(of: "ELECTION_TYPE:", with: "")
            .uppercased() ?? ""
    }

    private func isTopTwoOrTopFourPrimaryType(_ type: String) -> Bool {
        let lower = type.lowercased()
        return lower.contains("top-two")
            || lower.contains("top two")
            || lower.contains("top-four")
            || lower.contains("top four")
            || lower.contains("multi-party")
            || lower.contains("multi party")
            || lower.contains("jungle")
    }

    private func styledPrimaryRuleInlineText(for election: Election) -> Text {
        guard phaseForElection(election) == .primary, let code = stateCode else { return Text("") }
        let primaryType = primaryTypeLabel(for: election, stateCode: code)
        let primaryPhrase = primaryTypePhraseForIntro(primaryType)
        let stateDisplayName = election.jurisdictionName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? (Self.stateNameByCode[code] ?? "This state")
            : election.jurisdictionName
        return Text(". \(stateDisplayName) has ")
            + Text(primaryPhrase)
                .foregroundColor(VoteNowColors.successGreen)
                .bold()
                .italic()
    }

    private func primaryTypePhraseForIntro(_ rawPrimaryType: String) -> String {
        let trimmed = rawPrimaryType.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "primaries" }

        let lower = trimmed
            .replacingOccurrences(of: ".", with: "")
            .lowercased()

        if lower.contains("primaries") {
            return lower
        }

        if lower.hasSuffix(" primary") {
            return String(lower.dropLast(" primary".count)) + " primaries"
        }

        if lower == "primary" {
            return "primaries"
        }

        return "\(lower) primaries"
    }

    @ViewBuilder
    private func primaryGuideBodyView(_ context: ElectionGuidePrimaryCardContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(context.primaryTypeDescription)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 2)

            if context.usesTopTwoStyle {
                Text("• All voters use one ballot with candidates from multiple parties.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)

                Text("• The top finishers advance to the general election regardless of party.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                (
                    Text("• ").foregroundColor(VoteNowColors.primaryText)
                    + Text("Registered Democrat")
                        .foregroundColor(VoteNowColors.richBlue)
                        .bold()
                        .fontWeight(.heavy)
                    + Text(": Only Democrats advance to the general election.")
                        .foregroundColor(VoteNowColors.primaryText)
                )
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)

                (
                    Text("• ").foregroundColor(VoteNowColors.primaryText)
                    + Text("Registered Republican")
                        .foregroundColor(VoteNowColors.richRed)
                        .bold()
                        .fontWeight(.heavy)
                    + Text(": Only Republicans advance to the general election.")
                        .foregroundColor(VoteNowColors.primaryText)
                )
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)

                (
                    Text("• ").foregroundColor(VoteNowColors.primaryText)
                    + Text("Independent/Unaffiliated")
                        .foregroundColor(VoteNowColors.primaryText)
                        .bold()
                        .fontWeight(.heavy)
                    + Text(": Ballot access depends on your state's primary rules.")
                        .foregroundColor(VoteNowColors.primaryText)
                )
                .font(.subheadline)
                .fixedSize(horizontal: false, vertical: true)
            }

            if let dayDelta = context.generalStartInDays,
               let startDateText = context.generalStartDateText {
                (
                    Text("Whoever wins the primary advances to the General Election. Voting starts in \(dayDelta) days (")
                    + Text(startDateText).bold()
                    + Text(").")
                )
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 8)
            } else {
                Text("Whoever wins the primary advances to the General Election.")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 8)
            }

            if let runoffLine = context.runoffLine {
                Text("• \(runoffLine)")
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    @ViewBuilder
    private func officesInfluenceBodyView(_ items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array(items.enumerated()), id: \.offset) { _, item in
                let lines = item
                    .components(separatedBy: .newlines)
                    .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                    .filter { !$0.isEmpty }
                let firstLine = lines.first ?? ""
                let officeName = firstLine.split(separator: ":", maxSplits: 1).first.map(String.init)
                let rotatingExampleLine = rotatingOfficeExampleLine(forOfficeTitle: officeName)
                let detailLines = rotatingExampleLine.map { [$0] } ?? Array(lines.dropFirst())

                VStack(alignment: .leading, spacing: 4) {
                    if let splitIndex = firstLine.firstIndex(of: ":") {
                        let office = String(firstLine[..<splitIndex])
                        let remainder = String(firstLine[splitIndex...])
                        (
                            Text(office).bold()
                            + Text(remainder)
                        )
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.primaryText)
                        .fixedSize(horizontal: false, vertical: true)
                    } else {
                        Text(firstLine)
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                    ForEach(Array(detailLines.enumerated()), id: \.offset) { _, line in
                        officesInfluenceDetailLineView(line)
                            .id(line)
                            .transition(.opacity)
                            .animation(reduceMotion ? nil : .easeInOut(duration: 0.35), value: line)
                            .padding(.leading, 12)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func officesInfluenceDetailLineView(_ line: String) -> some View {
        let trimmed = line.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.hasPrefix("Example:") {
            let remainder = String(trimmed.dropFirst("Example:".count)).trimmingCharacters(in: .whitespacesAndNewlines)
            let parsed = parsedOfficeExampleLine(remainder)
            (
                Text("Example").bold()
                + Text(": \(parsed.body)")
                + (parsed.monthYearSuffix.map { Text(" (\($0))").bold().italic() } ?? Text(""))
            )
            .font(.subheadline)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)
        } else {
            Text(line)
                .font(.subheadline)
                .foregroundColor(VoteNowColors.primaryText)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func parsedOfficeExampleLine(_ raw: String) -> ElectionGuideOfficeExampleLine {
        if let parsed = parsedISODateExample(raw) {
            return parsed
        }
        if let parsed = parsedNamedMonthDateExample(raw) {
            return parsed
        }
        return ElectionGuideOfficeExampleLine(
            body: raw.trimmingCharacters(in: .whitespacesAndNewlines),
            monthYearSuffix: nil
        )
    }

    private func parsedISODateExample(_ raw: String) -> ElectionGuideOfficeExampleLine? {
        let pattern = #"(\d{4})-(\d{2})-(\d{2})"#
        guard let regex = try? NSRegularExpression(pattern: pattern),
              let match = regex.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)),
              match.numberOfRanges >= 3,
              let fullRange = Range(match.range(at: 0), in: raw),
              let yearRange = Range(match.range(at: 1), in: raw),
              let monthRange = Range(match.range(at: 2), in: raw),
              let year = Int(raw[yearRange]),
              let month = Int(raw[monthRange]),
              let monthYear = monthYearLabel(year: year, month: month) else {
            return nil
        }

        var cleaned = raw
        cleaned.removeSubrange(fullRange)
        cleaned = cleanupExampleBody(cleaned)
        return ElectionGuideOfficeExampleLine(body: cleaned, monthYearSuffix: monthYear)
    }

    private func parsedNamedMonthDateExample(_ raw: String) -> ElectionGuideOfficeExampleLine? {
        let pattern = #"\(?\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep\.?|Sept\.?|Oct\.?|Nov\.?|Dec\.?)\s+\d{1,2},\s*(\d{4})\b\)?"#
        guard let regex = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]),
              let match = regex.firstMatch(in: raw, range: NSRange(raw.startIndex..., in: raw)),
              match.numberOfRanges >= 3,
              let fullRange = Range(match.range(at: 0), in: raw),
              let monthTokenRange = Range(match.range(at: 1), in: raw),
              let yearRange = Range(match.range(at: 2), in: raw),
              let year = Int(raw[yearRange]),
              let month = monthNumber(fromToken: String(raw[monthTokenRange])),
              let monthYear = monthYearLabel(year: year, month: month) else {
            return nil
        }

        var cleaned = raw
        cleaned.removeSubrange(fullRange)
        cleaned = cleanupExampleBody(cleaned)
        return ElectionGuideOfficeExampleLine(body: cleaned, monthYearSuffix: monthYear)
    }

    private func cleanupExampleBody(_ raw: String) -> String {
        var cleaned = raw
        cleaned = cleaned.replacingOccurrences(
            of: #"\s*[—-]\s*:\s*"#,
            with: ": ",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: #"^\s*[—-]\s*"#,
            with: "",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: #"\s{2,}"#,
            with: " ",
            options: .regularExpression
        )
        cleaned = cleaned.replacingOccurrences(
            of: #"\(\s*\)"#,
            with: "",
            options: .regularExpression
        )
        cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        while cleaned.hasPrefix(":") {
            cleaned.removeFirst()
            cleaned = cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return cleaned
    }

    private func monthYearLabel(year: Int, month: Int) -> String? {
        guard (1...12).contains(month) else { return nil }
        var components = DateComponents()
        components.year = year
        components.month = month
        components.day = 1
        guard let date = Calendar(identifier: .gregorian).date(from: components) else { return nil }

        let formatter = DateFormatter()
        formatter.locale = locale
        formatter.dateFormat = "LLLL, yyyy"
        return formatter.string(from: date)
    }

    private func monthNumber(fromToken rawToken: String) -> Int? {
        let cleaned = rawToken
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .replacingOccurrences(of: ".", with: "")

        let months: [String: Int] = [
            "january": 1, "jan": 1,
            "february": 2, "feb": 2,
            "march": 3, "mar": 3,
            "april": 4, "apr": 4,
            "may": 5,
            "june": 6, "jun": 6,
            "july": 7, "jul": 7,
            "august": 8, "aug": 8,
            "september": 9, "sep": 9, "sept": 9,
            "october": 10, "oct": 10,
            "november": 11, "nov": 11,
            "december": 12, "dec": 12
        ]
        return months[cleaned]
    }

    @ViewBuilder
    private func ballotMeasuresBodyView(intro: String, items: [String]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            if !intro.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text(intro)
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.primaryText)
                    .fixedSize(horizontal: false, vertical: true)
            }

            ForEach(Array(items.enumerated()), id: \.offset) { index, raw in
                let parsed = parsedBallotMeasureItem(from: raw)
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 6) {
                        Text("Measure \(index + 1)")
                            .font(.caption.weight(.semibold))
                            .foregroundColor(VoteNowColors.primaryText)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(
                                Capsule(style: .continuous)
                                    .fill(Color(red: 0.93, green: 0.58, blue: 0.16).opacity(0.26))
                            )

                        if let dateText = parsed.dateText {
                            Text(dateText)
                                .font(.caption.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 3)
                                .background(
                                    Capsule(style: .continuous)
                                        .fill(Color.black.opacity(0.06))
                                )
                        }

                        Spacer(minLength: 0)
                    }

                    Text(parsed.title)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryText)
                        .fixedSize(horizontal: false, vertical: true)

                    if !parsed.summary.isEmpty {
                        Text(parsed.summary)
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.primaryText)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(red: 0.96, green: 0.97, blue: 0.98))
                )
                .overlay(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .stroke(VoteNowColors.borderWarm.opacity(0.8), lineWidth: 1)
                )
            }

            Text("Disclosure: Descriptions are pulled from official bill text.")
                .font(.caption)
                .foregroundColor(VoteNowColors.mutedText)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 2)
        }
    }

    private func parsedBallotMeasureItem(from raw: String) -> ElectionGuideParsedBallotMeasureItem {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return ElectionGuideParsedBallotMeasureItem(title: "", summary: "", dateText: nil)
        }

        let parts = trimmed.split(separator: ":", maxSplits: 1, omittingEmptySubsequences: false)
        let headline = parts.first.map(String.init)?
            .trimmingCharacters(in: .whitespacesAndNewlines) ?? trimmed
        let summary = parts.count > 1
            ? String(parts[1]).trimmingCharacters(in: .whitespacesAndNewlines)
            : ""

        if let openParen = headline.lastIndex(of: "("),
           let closeParen = headline.lastIndex(of: ")"),
           openParen < closeParen {
            let dateCandidate = String(headline[headline.index(after: openParen)..<closeParen])
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let title = String(headline[..<openParen]).trimmingCharacters(in: .whitespacesAndNewlines)

            if !dateCandidate.isEmpty, dateCandidate.count <= 28, !title.isEmpty {
                return ElectionGuideParsedBallotMeasureItem(title: title, summary: summary, dateText: dateCandidate)
            }
        }

        return ElectionGuideParsedBallotMeasureItem(title: headline, summary: summary, dateText: nil)
    }

    private func rotatingOfficeExampleLine(forOfficeTitle officeTitle: String?) -> String? {
        guard let officeTitle,
              let key = normalizedOfficePowerKey(from: officeTitle),
              let examples = Self.officePowerExamplesByKey[key],
              !examples.isEmpty else {
            return nil
        }

        let index = officeExampleRotationTick % examples.count
        return "Example: \(examples[index])"
    }

    @ViewBuilder
    private func threeWaysVotingContent(_ context: ElectionGuideThreeWaysContext) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            (
                Text("• ")
                + Text(l("app.guide.voting.early_vote.label", "Early Vote")).bold()
                + Text(": \(lf("app.guide.voting.early_vote.body", "Starts %@. Vote in person before Election Day.", context.earlyVoteDateText))")
            )
            .font(.subheadline)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)

            (
                Text("• ")
                + Text(l("app.guide.voting.by_mail.label", "Vote by Mail")).bold()
                + Text(": \(l("app.guide.voting.by_mail.body", "Request and return your mail ballot by your state's deadlines."))")
            )
            .font(.subheadline)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)

            Button {
                openMailInBallotRequest()
            } label: {
                Text(l("app.guide.voting.by_mail.cta", "Open Request Mail-in Ballot"))
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(VoteNowColors.primaryCTA)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)

            (
                Text("• ")
                + Text(l("app.guide.voting.election_day.label", "Election Day")).bold()
                + Text(": \(lf("app.guide.voting.election_day.body", "Vote in person on %@.", context.electionDayDateText))")
            )
            .font(.subheadline)
            .foregroundColor(VoteNowColors.primaryText)
            .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func openMailInBallotRequest() {
        NotificationCenter.default.post(name: .openHowToVoteMailInBallot, object: nil)
    }

    private func threeWaysVotingCard(for election: Election) -> ElectionGuideInfoCard {
        let earlyVoteDateText = formatLongDate(election.startDate)
        let electionDayDateText = formatLongDate(election.electionDay)
        return ElectionGuideInfoCard(
            title: l("app.guide.card.voting_methods.title", "Three Ways You Can Vote"),
            body: "",
            threeWaysContext: ElectionGuideThreeWaysContext(
                earlyVoteDateText: earlyVoteDateText,
                electionDayDateText: electionDayDateText
            )
        )
    }

    private func formatLongDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = locale
        formatter.timeZone = TimeZone.current
        formatter.setLocalizedDateFormatFromTemplate("MMMM d")
        return formatter.string(from: date)
    }

    private static let isoFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    private static let fallbackPresidentialPrimaryISO = "2028-03-07"

    private static let stateCodeByName: [String: String] = [
        "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR", "california": "CA",
        "colorado": "CO", "connecticut": "CT", "delaware": "DE", "florida": "FL", "georgia": "GA",
        "hawaii": "HI", "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
        "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
        "massachusetts": "MA", "michigan": "MI", "minnesota": "MN", "mississippi": "MS", "missouri": "MO",
        "montana": "MT", "nebraska": "NE", "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
        "new mexico": "NM", "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
        "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
        "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT", "vermont": "VT",
        "virginia": "VA", "washington": "WA", "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
        "district of columbia": "DC"
    ]
    private static let stateNameByCode: [String: String] = [
        "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
        "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
        "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
        "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
        "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri",
        "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey",
        "NM": "New Mexico", "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
        "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
        "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
        "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
        "DC": "District of Columbia"
    ]

    private static func isoDate(from iso: String?) -> Date? {
        guard let iso, !iso.isEmpty else { return nil }
        return isoFormatter.date(from: iso)
    }

    private static func projectedPresidentialPrimaryISO(from midtermPrimaryISO: String?) -> String {
        shiftedISOYear(from: midtermPrimaryISO, toYear: 2028) ?? fallbackPresidentialPrimaryISO
    }

    private static func shiftedISOYear(from iso: String?, toYear year: Int) -> String? {
        guard let iso else { return nil }
        let parts = iso.split(separator: "-")
        guard parts.count == 3 else { return nil }

        let shifted = String(format: "%04d-%@-%@", year, String(parts[1]), String(parts[2]))
        return isoDate(from: shifted) == nil ? nil : shifted
    }

    private func displayText(from rawValue: String?, fallbackDate: Date?) -> String {
        let trimmed = rawValue?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let parsedDate = Self.isoDate(from: trimmed) {
            return formatLongDate(parsedDate)
        }
        if !trimmed.isEmpty {
            return trimmed
        }
        if let fallbackDate {
            return formatLongDate(fallbackDate)
        }
        return l("app.guide.not_listed_dataset", "Not listed in dataset")
    }
}

private struct MidtermStateElectionRecord: Decodable {
    let state_name: String
    let state_code: String
    let primary_date: String?
    let primary_runoff_date: String?
    let general_election_date: String?
    let registration_deadline_primary: String?
    let registration_deadline_general: String?
    let registration_notes: String?
    let early_voting_primary: String?
    let early_voting_primary_runoff: String?
    let early_voting_general: String?
    let primary_source: String?
}

private struct ElectionGuidePrimaryTypeDataset: Decodable {
    let state_summary: [ElectionGuidePrimaryTypeStateSummary]
}

private struct ElectionGuideBallotTimelineDataset: Decodable {
    let timeline_dataset: [ElectionGuideBallotTimelineRow]
}

private struct ElectionGuideBallotTimelineRow: Decodable {
    let dataset_key: String
    let state_abbr: String
    let office_family: String
    let election_stage: String
    let party: String
    let dropdown_label: String
    let on_ballot_in_2026_cycle: String
    let on_ballot_in_2028_cycle: String
}

private struct ElectionGuideStateVotingFeature: Decodable {
    let jurisdiction: String
    let type: String
    let primarySystem: String
    let rankedChoiceStatus: String
    let runoffRules: String
    let mailModel: String
    let notableRule: String
    let featureTags: String
    let explainer: String
    let sourceURLs: String
    let primaryCategory: String
    let rcvCategory: String
    let runoffCategory: String
    let mailCategory: String
}

private struct ElectionGuideRunoffThresholdRule: Decodable {
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

private struct ElectionGuideRankedChoiceByStateDataset: Decodable {
    let states: [String: ElectionGuideRankedChoiceStateSummary]
}

private struct ElectionGuideRankedChoiceStateSummary: Decodable {
    let state: String
    let type: String
    let mapCategory: String
    let whereApplies: String
    let explicitOffices: String
    let statusSnapshot: String
}

private struct ElectionGuideBallotMeasurePolicy: Decodable {
    let state: String
    let reviewFlag: String
    let citizenProcess: String
    let icaType: String
    let icaSignature: String
    let icaApprovalRule: String
    let statuteType: String
    let statuteSignature: String
    let vetoReferendum: String
    let referendumSignature: String
    let referendumBallotMeaning: String
    let singleSubjectRule: String
    let subjectRestrictions: String
    let signatureDistribution: String
    let legislativeAlterationProtection: String
    let constitutionalAmendmentApprovalRequired: String
    let explicitPolicySummary: String
    let integrationNote: String
    let sourceURLs: String
    let lastReviewed: String
}

private struct ElectionGuideStatewideBallotMeasure: Decodable {
    let stateCode: String
    let state: String
    let measure: String
    let type: String
    let electionDate: String
    let shortSummary: String
    let sourceURL: String
}

private struct ElectionGuideOfficePowersDataset: Decodable {
    let meta: ElectionGuideOfficePowersMeta
    let rows: [ElectionGuideOfficePowerRow]
}

private struct ElectionGuideOfficeExamplesDataset: Decodable {
    let meta: ElectionGuideOfficeExamplesMeta
    let rows: [ElectionGuideOfficeExamplesRow]
}

private struct ElectionGuideOfficeExamplesMeta: Decodable {
    let title: String
    let lastUpdated: String
    let sourceFile: String
}

private struct ElectionGuideOfficeExamplesRow: Decodable {
    let office: String
    let officeKey: String
    let context: String
    let examples: [String]
}

private struct ElectionGuideOfficePowersMeta: Decodable {
    let title: String
    let lastUpdated: String
    let sourceFile: String
}

private struct ElectionGuideOfficePowerRow: Decodable {
    let office: String
    let officeKey: String
    let plainEnglishResponsibility: String
    let easyMetric: String
    let currentExample: String
    let sourceURL: String
}

private struct ElectionGuidePrimaryTypeStateSummary: Decodable {
    let state: String
    let state_abbr: String
    let state_primary_type_2026: String
    let presidential_primary_type_2026: String
    let independent_primary_note: String?
}

private struct ElectionGuideInfoCard: Identifiable {
    let id = UUID()
    let title: String
    let body: String
    let accent: ElectionGuideCardAccent
    let kind: ElectionGuideCardKind
    let flagStateCode: String?
    let primaryGuideContext: ElectionGuidePrimaryCardContext?
    let threeWaysContext: ElectionGuideThreeWaysContext?
    let ballotItems: [String]?
    let rcvDemoContext: ElectionGuideRCVDemoContext?
    let runoffDemoContext: ElectionGuideRunoffDemoContext?

    init(
        title: String,
        body: String,
        accent: ElectionGuideCardAccent = .neutral,
        kind: ElectionGuideCardKind = .standard,
        flagStateCode: String? = nil,
        primaryGuideContext: ElectionGuidePrimaryCardContext? = nil,
        threeWaysContext: ElectionGuideThreeWaysContext? = nil,
        ballotItems: [String]? = nil,
        rcvDemoContext: ElectionGuideRCVDemoContext? = nil,
        runoffDemoContext: ElectionGuideRunoffDemoContext? = nil
    ) {
        self.title = title
        self.body = body
        self.accent = accent
        self.kind = kind
        self.flagStateCode = flagStateCode
        self.primaryGuideContext = primaryGuideContext
        self.threeWaysContext = threeWaysContext
        self.ballotItems = ballotItems
        self.rcvDemoContext = rcvDemoContext
        self.runoffDemoContext = runoffDemoContext
    }
}

private enum ElectionGuideCardKind {
    case standard
    case partyAffiliation
    case officesInfluence
    case ballotMeasures
}

private struct ElectionGuideThreeWaysContext {
    let earlyVoteDateText: String
    let electionDayDateText: String
}

private struct ElectionGuideRCVDemoContext {
    let ctaText: String
    let whereSummaryLines: [String]
}

private struct ElectionGuideRunoffDemoContext {
    let ctaText: String
}

private struct ElectionGuidePrimaryCardContext {
    let usesTopTwoStyle: Bool
    let primaryTypeDescription: String
    let generalStartInDays: Int?
    let generalStartDateText: String?
    let runoffLine: String?
}

private struct ElectionGuideParsedBallotMeasureItem {
    let title: String
    let summary: String
    let dateText: String?
}

private struct ElectionGuideOfficeExampleLine {
    let body: String
    let monthYearSuffix: String?
}

private enum ElectionGuideSpecialRuleKind {
    case rankedChoice
    case runoff
}

private enum GuideCardAnchor: String {
    case mainElection = "main-election"
    case primaryGuide = "primary-guide"
    case specialRules = "special-rules"
    case ballotMeasures = "ballot-measures"
    case voterID = "voter-id"
}

private enum ElectionGuideCardAccent {
    case neutral
    case primary
    case primaryHighlight
    case midterm
    case general
    case runoff
    case presidential
    case special
    case specialRules
    case ballotMeasures

    var color: Color {
        switch self {
        case .neutral:
            return VoteNowColors.primaryText
        case .primary:
            return VoteNowColors.richBlue
        case .primaryHighlight:
            return VoteNowColors.successGreen
        case .midterm:
            return VoteNowColors.warningAmber
        case .general:
            return VoteNowColors.successGreen
        case .runoff:
            return VoteNowColors.richRed
        case .presidential:
            return VoteNowColors.primaryCTA
        case .special:
            return VoteNowColors.richRed
        case .specialRules:
            return Color(hex: "#6A4CCF")
        case .ballotMeasures:
            return Color(hex: "#B85C36")
        }
    }
}

struct NYCMayoralElectionView_Previews: PreviewProvider {
    static var previews: some View {
        NYCMayoralElectionView()
    }
}
