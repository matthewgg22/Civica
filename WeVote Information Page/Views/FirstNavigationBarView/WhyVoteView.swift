import SwiftUI

struct WhyVoteView: View {
    let onHeaderCueColorChange: (Color) -> Void

    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.locale) private var locale

    @StateObject private var dataStore = WhyVoteDataStore()
    @State private var selectedWhyCareCard = 0
    @State private var showFeedbackSheet = false
    @State private var turnoutBackdropColor: Color = CivicaColors.brandSoftBlue

    private let zipStateResolver = USZipStateResolver()
    private let powerOfVoteTimer = Timer.publish(every: 3.4, on: .main, in: .common).autoconnect()

    init(onHeaderCueColorChange: @escaping (Color) -> Void = { _ in }) {
        self.onHeaderCueColorChange = onHeaderCueColorChange
    }

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

    private func softenedHeaderBackgroundColor(from cueColor: Color) -> Color {
        blend(cueColor, with: .white, amount: 0.42)
    }

    private func blend(_ first: Color, with second: Color, amount: CGFloat) -> Color {
        let clamped = min(max(amount, 0), 1)
        let a = UIColor(first)
        let b = UIColor(second)

        var ar: CGFloat = 0
        var ag: CGFloat = 0
        var ab: CGFloat = 0
        var aa: CGFloat = 0
        var br: CGFloat = 0
        var bg: CGFloat = 0
        var bb: CGFloat = 0
        var ba: CGFloat = 0

        guard a.getRed(&ar, green: &ag, blue: &ab, alpha: &aa),
              b.getRed(&br, green: &bg, blue: &bb, alpha: &ba) else {
            return first
        }

        return Color(
            red: ar + ((br - ar) * clamped),
            green: ag + ((bg - ag) * clamped),
            blue: ab + ((bb - ab) * clamped),
            opacity: aa + ((ba - aa) * clamped)
        )
    }

    private var resolvedZipForState: String? {
        let planZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if planZip.count == 5 { return planZip }

        let userAddressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        if userAddressZip.count == 5 { return userAddressZip }

        let resolvedSelectionZip = String((repsVM.resolvedLocationSelection?.postalCode ?? "").filter(\.isNumber).prefix(5))
        return resolvedSelectionZip.count == 5 ? resolvedSelectionZip : nil
    }

    private var detectedStateCode: String? {
        if let zip = resolvedZipForState,
           let code = zipStateResolver.stateCode(for: zip) {
            return code
        }

        if let enteredState = normalizeStateCode(from: planVM.userAddress.state) {
            return enteredState
        }

        if let repsState = normalizeStateCode(from: repsVM.detectedStateCode) {
            return repsState
        }

        if let selectionState = normalizeStateCode(from: repsVM.resolvedLocationSelection?.administrativeArea) {
            return selectionState
        }

        for candidate in candidateAddresses where !candidate.isEmpty {
            if let code = dataStore.inferStateCode(from: candidate) {
                return code
            }
        }

        return nil
    }

    private var stateInfo: StateVoteInfo? {
        dataStore.stateInfo(for: detectedStateCode)
    }

    private var selectedTurnoutPair: ComparableTurnoutPair? {
        guard let stateInfo else { return nil }
        return getComparableTurnoutPair(
            from: stateInfo,
            preferredPresidentialYear: 2020,
            preferredMidtermYear: 2022
        )
    }

    private var whyCareCards: [WhyCareCardCopy] {
        [
            WhyCareCardCopy(
                title: l("app.why_vote.why_care.card1.title", "More power per voter"),
                body: l(
                    "app.why_vote.why_care.card1.body",
                    "When turnout is lower, each vote carries more weight."
                )
            ),
            WhyCareCardCopy(
                title: l("app.why_vote.why_care.card2.title", "These elections affect daily life"),
                body: l(
                    "app.why_vote.why_care.card2.body",
                    "State and local leaders shape housing, schools, transit, taxes, and public services."
                )
            ),
            WhyCareCardCopy(
                title: l("app.why_vote.why_care.card3.title", "If you don't choose, someone else does"),
                body: l(
                    "app.why_vote.why_care.card3.body",
                    "A smaller group ends up deciding who represents your community."
                )
            )
        ]
    }

    private var candidateAddresses: [String] {
        let street = planVM.userAddress.street.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
        let state = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)
        let userZip = planVM.userAddress.zip.trimmingCharacters(in: .whitespacesAndNewlines)
        let planZip = planVM.zip.trimmingCharacters(in: .whitespacesAndNewlines)

        let assembledAddress = [street, city, state, userZip]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")

        let fallbackAddress = [city, state, planZip]
            .filter { !$0.isEmpty }
            .joined(separator: " ")

        return [
            planVM.homeAddress.trimmingCharacters(in: .whitespacesAndNewlines),
            assembledAddress,
            fallbackAddress,
            state,
            planZip
        ]
    }

    var body: some View {
        ZStack {
            turnoutBackdropColor.opacity(0.28)
                .ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
                    TurnoutExplorer(
                        onSeeHowToVote: {
                            NotificationCenter.default.post(name: .openVotingStepsTab, object: nil)
                        },
                        onTurnoutCueColorChange: { cueColor in
                            let softenedCue = softenedHeaderBackgroundColor(from: cueColor)
                            withAnimation(.easeInOut(duration: 0.22)) {
                                turnoutBackdropColor = softenedCue
                            }
                            onHeaderCueColorChange(softenedCue)
                        }
                    )

                    outOfTenSection
                    powerOfVoteSection
                    feedbackButton

                    Color.clear
                        .frame(height: 24)
                }
                .padding(.horizontal, CivicaSpacing.lg)
                .padding(.top, CivicaSpacing.lg)
                .padding(.bottom, CivicaSpacing.md)
            }
        }
        .navigationTitle(l("app.page.why_vote.turnout_combined", "Why Vote? Historical Turnout by Age"))
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showFeedbackSheet) {
            NavigationStack {
                FeedbackView()
            }
        }
        .onReceive(powerOfVoteTimer) { _ in
            guard whyCareCards.count > 1 else { return }
            withAnimation(.easeInOut(duration: 0.32)) {
                selectedWhyCareCard = (selectedWhyCareCard + 1) % whyCareCards.count
            }
        }
    }

    @ViewBuilder
    private var outOfTenSection: some View {
        if let turnoutPair = selectedTurnoutPair,
           let info = stateInfo {
            outOfTenComparisonSection(for: turnoutPair, info: info)
        } else {
            VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                Text(outOfTenHeader())
                    .font(.title3.weight(.semibold))
                    .foregroundColor(CivicaColors.textPrimary)

                if let zip = resolvedZipForState {
                    Text(
                        lf(
                            "app.why_vote.state_missing.with_zip",
                            "We found ZIP %@, but could not map state stats yet.",
                            zip
                        )
                    )
                    .font(CivicaTypography.subhead)
                    .foregroundColor(CivicaColors.textSecondary)
                } else {
                    Text(l("app.why_vote.state_missing.enter_zip", "Enter a ZIP in My Representatives to load your state profile."))
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.textSecondary)
                }
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary.opacity(0.72))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .stroke(CivicaColors.textPrimary.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))
        }
    }

    private func outOfTenComparisonSection(for turnoutPair: ComparableTurnoutPair, info: StateVoteInfo) -> some View {
        let primaryTurnout = dataStore.primaryTurnoutPercent(for: info.stateCode) ?? turnoutPair.midtermTurnout

        return VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            HStack(alignment: .center, spacing: CivicaSpacing.sm) {
                Text(outOfTenHeader(for: info))
                    .font(.title3.weight(.semibold))
                    .foregroundColor(CivicaColors.textPrimary)

                Spacer(minLength: 8)

                stateFlagBadge(for: info.stateCode)
            }

            VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                OutOfTenTurnoutRowView(
                    label: "\(turnoutPair.presidentialYear) Presidential",
                    turnoutPercent: turnoutPair.presidentialTurnout,
                    summary: formatTurnoutAsOutOfTen(turnoutPair.presidentialTurnout),
                    filledColor: CivicaColors.successGreen
                )

                OutOfTenTurnoutRowView(
                    label: "\(turnoutPair.midtermYear) Midterm",
                    turnoutPercent: turnoutPair.midtermTurnout,
                    summary: formatTurnoutAsOutOfTen(turnoutPair.midtermTurnout),
                    filledColor: CivicaColors.warningAmber
                )

                OutOfTenTurnoutRowView(
                    label: "2022 Midterm Primary",
                    turnoutPercent: primaryTurnout,
                    summary: formatTurnoutAsOutOfTen(primaryTurnout),
                    filledColor: CivicaColors.ctaBlue
                )
            }
            .padding(CivicaSpacing.md)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(CivicaColors.surfacePrimary.opacity(0.72))
            .overlay(
                RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous)
                    .stroke(CivicaColors.textPrimary.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.lg, style: .continuous))
        }
    }

    private var powerOfVoteSection: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
            Text(l("app.why_vote.why_care.title", "The power of a vote"))
                .font(.title3.weight(.semibold))

            if !whyCareCards.isEmpty {
                let card = whyCareCards[selectedWhyCareCard]
                VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                    Text(card.title)
                        .font(CivicaTypography.sectionHeader)
                        .foregroundColor(CivicaColors.textPrimary)
                        .id("power-title-\(selectedWhyCareCard)")
                        .transition(.opacity)
                    Text(card.body)
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                        .id("power-body-\(selectedWhyCareCard)")
                        .transition(.opacity)
                }
                .animation(.easeInOut(duration: 0.26), value: selectedWhyCareCard)
            }
        }
    }

    private var feedbackButton: some View {
        Button {
            showFeedbackSheet = true
        } label: {
            Label(l("app.how_to_vote.section.feedback", "Feedback"), systemImage: "bubble.left.and.bubble.right.fill")
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.ctaBlue)
                .padding(.horizontal, CivicaSpacing.sm)
                .padding(.vertical, CivicaSpacing.sm)
                .background(CivicaColors.surfacePrimary)
                .clipShape(Capsule(style: .continuous))
                .overlay(
                    Capsule(style: .continuous)
                        .stroke(CivicaColors.ctaBlue.opacity(0.34), lineWidth: 1)
                )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func getComparableTurnoutPair(
        from info: StateVoteInfo,
        preferredPresidentialYear: Int,
        preferredMidtermYear: Int
    ) -> ComparableTurnoutPair? {
        let scope = scopeLabel(for: info)
        guard !scope.isEmpty else { return nil }

        let candidates: [(presidentialYear: Int, presidentialValue: Double?, midtermYear: Int, midtermValue: Double?)] = [
            (2020, info.turnout2020Pres, 2022, info.turnout2022Mid),
            (2016, info.turnout2016Pres, 2018, info.turnout2018Mid)
        ]

        if let preferred = candidates.first(where: { candidate in
            candidate.presidentialYear == preferredPresidentialYear
                && candidate.midtermYear == preferredMidtermYear
                && shouldRenderStat(value: candidate.presidentialValue, scope: scope)
                && shouldRenderStat(value: candidate.midtermValue, scope: scope)
        }),
           let presidentialTurnout = preferred.presidentialValue,
           let midtermTurnout = preferred.midtermValue {
            return ComparableTurnoutPair(
                scopeLabel: scope,
                presidentialYear: preferred.presidentialYear,
                presidentialTurnout: presidentialTurnout,
                midtermYear: preferred.midtermYear,
                midtermTurnout: midtermTurnout
            )
        }

        if let fallback = candidates.first(where: { candidate in
            shouldRenderStat(value: candidate.presidentialValue, scope: scope)
                && shouldRenderStat(value: candidate.midtermValue, scope: scope)
        }),
           let presidentialTurnout = fallback.presidentialValue,
           let midtermTurnout = fallback.midtermValue {
            return ComparableTurnoutPair(
                scopeLabel: scope,
                presidentialYear: fallback.presidentialYear,
                presidentialTurnout: presidentialTurnout,
                midtermYear: fallback.midtermYear,
                midtermTurnout: midtermTurnout
            )
        }

        return nil
    }

    private func shouldRenderStat(value: Double?, scope: String?) -> Bool {
        guard let value else { return false }
        guard let scope, !scope.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        return value.isFinite && (0...100).contains(value)
    }

    private func scopeLabel(for info: StateVoteInfo) -> String {
        lf("app.why_vote.scope.statewide", "%@ statewide turnout", info.stateName)
    }

    private func formatTurnoutAsOutOfTen(_ turnoutPercent: Double) -> String {
        let clamped = max(0, min(100, turnoutPercent))
        let tenScaleValue = clamped / 10

        if clamped < 50 {
            let threshold = min(10, Int(floor(tenScaleValue)) + 1)
            return lf(
                "app.why_vote.out_of_ten.fewer_than",
                "fewer than %d in 10 voted",
                threshold
            )
        }

        let rounded = max(0, min(10, Int(tenScaleValue.rounded())))
        return lf(
            "app.why_vote.out_of_ten.about",
            "about %d in 10 Americans voted",
            rounded
        )
    }

    private func outOfTenHeader(for info: StateVoteInfo? = nil) -> String {
        if let name = info?.stateName, !name.isEmpty {
            return "Out of 10 Eligible \(name) Voters"
        }
        return "Out of 10 Eligible Voters"
    }

    @ViewBuilder
    private func stateFlagBadge(for stateCode: String?) -> some View {
        if let asset = StateFlagCatalog.assetName(for: stateCode) {
            Image(asset)
                .resizable()
                .scaledToFill()
                .frame(width: 56, height: 40)
                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: CivicaRadius.sm, style: .continuous)
                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                )
                .accessibilityHidden(true)
        }
    }

    private func normalizeStateCode(from rawValue: String?) -> String? {
        guard let rawValue else { return nil }
        let trimmed = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return nil }

        if trimmed.count == 2 {
            return trimmed.uppercased()
        }

        return dataStore.inferStateCode(from: trimmed)
    }
}

private struct ComparableTurnoutPair {
    let scopeLabel: String
    let presidentialYear: Int
    let presidentialTurnout: Double
    let midtermYear: Int
    let midtermTurnout: Double
}

private struct WhyCareCardCopy {
    let title: String
    let body: String
}

private struct OutOfTenTurnoutRowView: View {
    let label: String
    let turnoutPercent: Double
    let summary: String
    let filledColor: Color

    private var filledCount: Int {
        max(0, min(10, Int(floor(turnoutPercent / 10))))
    }

    private static let percentFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    private var formattedPercent: String {
        let value = Self.percentFormatter.string(from: NSNumber(value: turnoutPercent)) ?? "\(turnoutPercent)"
        return "\(value)%"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
            Text(label)
                .font(CivicaTypography.subheadStrong)
                .foregroundColor(CivicaColors.textPrimary)

            HStack(spacing: 0) {
                ForEach(0..<10, id: \.self) { index in
                    Image(systemName: index < filledCount ? "person.fill" : "person")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundColor(index < filledCount ? filledColor : CivicaColors.textPrimary.opacity(0.28))
                        .frame(maxWidth: .infinity)
                        .accessibilityHidden(true)
                }
            }

            HStack(alignment: .firstTextBaseline) {
                Text(summary)
                    .font(CivicaTypography.footnote)
                    .foregroundColor(CivicaColors.textSecondary)
                Spacer(minLength: 8)
                Text(formattedPercent)
                    .font(CivicaTypography.footnoteStrong)
                    .foregroundColor(CivicaColors.textPrimary)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(label): \(summary), \(formattedPercent)")
    }
}

#Preview {
    WhyVoteView()
        .environmentObject(PlanViewModel())
        .environmentObject(MyRepsViewModel())
}
