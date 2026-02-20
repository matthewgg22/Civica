import SwiftUI

struct WhyVoteView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @StateObject private var dataStore = WhyVoteDataStore()

    @State private var visibleFacts: [String] = []
    @State private var showPlanToVote = false

    private let zipStateResolver = USZipStateResolver()

    private var activeFacts: [String] {
        Array(visibleFacts.prefix(3))
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

    private var stateSectionHeader: String {
        if let info = stateInfo {
            return "Voter Turnout in \(info.stateName)"
        }
        return "Voter Turnout in Your Area"
    }

    private var addressSummaryLine: String? {
        let street = planVM.userAddress.street.trimmingCharacters(in: .whitespacesAndNewlines)
        let city = planVM.userAddress.city.trimmingCharacters(in: .whitespacesAndNewlines)
        let state = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines)

        let zipValue: String = {
            let planZip = String(planVM.zip.filter(\.isNumber).prefix(5))
            if planZip.count == 5 { return planZip }
            let addressZip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
            return addressZip.count == 5 ? addressZip : ""
        }()

        let line = [street, city, state, zipValue]
            .filter { !$0.isEmpty }
            .joined(separator: ", ")

        if !line.isEmpty { return line }

        let fallback = planVM.homeAddress.trimmingCharacters(in: .whitespacesAndNewlines)
        return fallback.isEmpty ? nil : fallback
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
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                quickFactsSection
                stateSection

                Color.clear
                    .frame(height: 130)
            }
            .padding(.horizontal, 16)
            .padding(.top, 16)
            .padding(.bottom, 12)
        }
        .navigationTitle("Why Vote")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom) {
            bottomCTA
        }
        .onAppear {
            seedFactsIfNeeded()
        }
        .sheet(isPresented: $showPlanToVote) {
            MultiStepFormView()
                .environmentObject(planVM)
        }
    }

    private var quickFactsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Facts on Voter Turnout in the U.S...")
                .font(.title3.weight(.semibold))

            VStack(alignment: .leading, spacing: 8) {
                if activeFacts.isEmpty {
                    Text("Voting participation trends and close-race facts will appear here.")
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)
                } else {
                    ForEach(Array(activeFacts.enumerated()), id: \.offset) { index, fact in
                        HStack(alignment: .top, spacing: 8) {
                            Text("\(index + 1).")
                                .font(.subheadline.weight(.semibold))
                                .foregroundColor(VoteNowColors.mutedText)
                            Text(fact)
                                .font(.subheadline)
                                .foregroundColor(VoteNowColors.primaryText)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(VoteNowColors.surfaceWhite.opacity(0.72))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
            )
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
    }

    private var stateSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(stateSectionHeader)
                .font(.title3.weight(.semibold))

            if let info = stateInfo {
                VStack(alignment: .leading, spacing: 12) {
                    if let addressSummaryLine {
                        Text(addressSummaryLine)
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                    }

                    Divider()

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Turnout snapshot")
                            .font(.subheadline.weight(.semibold))

                        ForEach(turnoutRows(for: info), id: \.label) { row in
                            HStack(alignment: .firstTextBaseline) {
                                Text(row.label)
                                    .font(.subheadline)
                                Spacer(minLength: 12)
                                Text(formattedPercent(row.value))
                                    .font(.subheadline.weight(.semibold))
                                    .foregroundColor(VoteNowColors.mutedText)
                            }
                        }
                    }

                    if let deltaLine = turnoutDeltaLine(for: info) {
                        Text(deltaLine)
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("Closest election")
                            .font(.subheadline.weight(.semibold))
                        Text(info.notableCloseRace)
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("State voting fact")
                            .font(.subheadline.weight(.semibold))
                        Text(info.funFact)
                            .font(.subheadline)
                            .foregroundColor(VoteNowColors.mutedText)
                    }

                    (
                        Text(takeawayLead(for: info) + " ")
                        + Text("Your vote can shift turnout.")
                            .fontWeight(.bold)
                            .italic()
                    )
                    .font(.subheadline)
                    .padding(.top, 2)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(VoteNowColors.surfaceWhite.opacity(0.72))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            } else {
                VStack(alignment: .leading, spacing: 8) {
                    if let zip = resolvedZipForState {
                        Text("We found ZIP \(zip), but could not map state stats yet.")
                            .font(.subheadline)
                        Text("Try re-entering ZIP and state in My Representatives to refresh this card.")
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                    } else {
                        Text("Enter a ZIP in My Representatives to load your state profile.")
                            .font(.subheadline)
                        Text("This section is state-specific and uses your current ZIP to choose the right state data.")
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                    }
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(VoteNowColors.surfaceWhite.opacity(0.72))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .stroke(VoteNowColors.primaryText.opacity(0.08), lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
    }

    private var bottomCTA: some View {
        VStack(spacing: 8) {
            Button {
                showPlanToVote = true
            } label: {
                Text("Make My Plan to Vote")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 13)
            }
            .buttonStyle(.plain)
            .background(VoteNowColors.richBlue)
            .foregroundColor(.white)
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .shadow(color: .black.opacity(0.18), radius: 10, x: 0, y: 6)
        }
        .padding(.horizontal, 16)
        .padding(.top, 10)
        .padding(.bottom, 24)
        .background(
            LinearGradient(
                colors: [VoteNowColors.primaryText.opacity(0.02), Color.clear],
                startPoint: .top,
                endPoint: .bottom
            )
        )
    }

    private func turnoutRows(for info: StateVoteInfo) -> [(label: String, value: Double?)] {
        [
            ("2022 Midterm", info.turnout2022Mid),
            ("2020 Presidential", info.turnout2020Pres),
            ("2018 Midterm", info.turnout2018Mid),
            ("2016 Presidential", info.turnout2016Pres)
        ]
    }

    private func formattedPercent(_ value: Double?) -> String {
        guard let value else { return "N/A" }
        return "\(Self.percentFormatter.string(from: NSNumber(value: value)) ?? "\(value)")%"
    }

    private func formattedPoints(_ value: Double) -> String {
        Self.percentFormatter.string(from: NSNumber(value: value)) ?? "\(value)"
    }

    private func turnoutDeltaLine(for info: StateVoteInfo) -> String? {
        guard let pres = info.turnout2020Pres,
              let mid = info.turnout2022Mid else {
            return nil
        }

        let delta = abs(pres - mid)
        if pres >= mid {
            return "From 2020 to 2022, participation fell by about \(formattedPoints(delta)) points."
        }
        return "From 2020 to 2022, participation rose by about \(formattedPoints(delta)) points."
    }

    private func takeawayLead(for info: StateVoteInfo) -> String {
        if let pres = info.turnout2020Pres, let mid = info.turnout2022Mid {
            return "In \(info.stateName), about \(formattedPercent(pres)) voted in the last presidential election, but only \(formattedPercent(mid)) voted in the last midterm. That means many eligible voters sat out, even though close races can be decided by tiny margins."
        }

        if let pres = info.turnout2020Pres {
            return "In \(info.stateName), turnout reached about \(formattedPercent(pres)) in the last presidential election. Midterm participation data in this summary is limited, but close-race history still shows that small vote shifts can change results."
        }

        if let mid = info.turnout2022Mid {
            return "In \(info.stateName), turnout was about \(formattedPercent(mid)) in the last midterm election. Presidential participation data in this summary is limited, but close races can still be decided by tiny margins."
        }

        return "In \(info.stateName), some turnout fields are not available in this summary. Even with incomplete data, close-race history shows that small vote shifts can change results."
    }

    private func seedFactsIfNeeded() {
        guard visibleFacts.isEmpty else { return }

        let source = dataStore.nationalFacts
        guard !source.isEmpty else {
            visibleFacts = []
            return
        }

        visibleFacts = source.shuffled()
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

    private static let percentFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 1
        return formatter
    }()

}

#Preview {
    WhyVoteView()
        .environmentObject(PlanViewModel())
        .environmentObject(MyRepsViewModel())
}
