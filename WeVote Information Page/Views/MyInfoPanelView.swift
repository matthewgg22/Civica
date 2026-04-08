//
//
//  MyInfoPanelView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/31/25 — safer dismiss logic and empty location check

import SwiftUI

struct MyInfoPanelView: View {
    private enum LanguageOption: String, CaseIterable {
        case english = "en"
        case spanish = "es"
        case mandarinSimplified = "zh-Hans"
        case mandarinTraditional = "zh-Hant"
        case filipino = "fil"
        case vietnamese = "vi"
        case french = "fr"
        case german = "de"

        static func fromStoredCode(_ code: String) -> LanguageOption? {
            let normalized = normalizeStoredCode(code)
            return LanguageOption(rawValue: normalized)
        }

        static func normalizeStoredCode(_ code: String) -> String {
            let trimmed = code.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !trimmed.isEmpty else { return LanguageOption.english.rawValue }

            let lower = trimmed.lowercased()
            switch lower {
            case "tl", "tagalog", "fil-ph":
                return LanguageOption.filipino.rawValue
            case "zh", "zh-cn", "zh-hans", "zh-hans-cn":
                return LanguageOption.mandarinSimplified.rawValue
            case "zh-tw", "zh-hk", "zh-mo", "zh-hant", "zh-hant-tw", "zh-hant-hk":
                return LanguageOption.mandarinTraditional.rawValue
            case "vi-vn":
                return LanguageOption.vietnamese.rawValue
            case "es-es", "es-mx":
                return LanguageOption.spanish.rawValue
            case "fr-fr", "fr-ca", "fr-be", "fr-ch":
                return LanguageOption.french.rawValue
            case "de-de", "de-at", "de-ch":
                return LanguageOption.german.rawValue
            case "en-us", "en-gb":
                return LanguageOption.english.rawValue
            default:
                return trimmed
            }
        }
    }

    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale

    @AppStorage("my_info.preferred_language_code")
    private var preferredLanguageCode: String = LanguageOption.english.rawValue

    @State private var locationInput: String = ""
    @State private var affiliation: PoliticalParty = .independent
    @State private var showInvalidZipAlert = false
    @State private var showFeedbackSheet = false
    @State private var isResolvingCurrentAddress = false
    @FocusState private var locationFieldFocused: Bool
    private let zipStateResolver = USZipStateResolver()

    private var selectedLanguage: LanguageOption {
        LanguageOption.fromStoredCode(preferredLanguageCode) ?? .english
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack(spacing: 10) {
                        TextField(
                            "",
                            text: $locationInput,
                            prompt: Text("app.reps.search.placeholder", tableName: "AppShell")
                        )
                            .font(.system(size: 18))
                            .textInputAutocapitalization(.words)
                            .autocorrectionDisabled()
                            .submitLabel(.search)
                            .focused($locationFieldFocused)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 12)
                            .background(VoteNowColors.surfaceWhite)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                            .overlay(
                                RoundedRectangle(cornerRadius: 10, style: .continuous)
                                    .stroke(VoteNowColors.borderWarm, lineWidth: 1)
                            )
                            .onChange(of: locationInput) { _, newValue in
                                repsVM.handleLocationInputTyping(newValue)
                            }
                            .onSubmit {
                                Task {
                                    await handleSaveAddressTapped()
                                }
                            }
                            .frame(maxWidth: .infinity)

                        Button {
                            locationInput = ""
                            repsVM.resetZipEntryState()
                        } label: {
                            Image(systemName: "xmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                                .frame(width: 26, height: 26)
                                .background(Color.gray.opacity(0.60))
                                .clipShape(Circle())
                        }
                        .buttonStyle(.plain)
                        .opacity(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.45 : 1.0)
                        .disabled(locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }

                    Text("my_info.zip.helper", tableName: "MyInfoPanel")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)

                    Button {
                        useCurrentAddressTapped()
                    } label: {
                        Label(
                            isResolvingCurrentAddress
                            ? l("my_info.action.current_address.loading", "Locating Current Address...")
                            : l("my_info.action.current_address", "Current Address"),
                            systemImage: "location.fill"
                        )
                        .font(.subheadline.weight(.semibold))
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 10)
                    }
                    .background(VoteNowColors.surfaceWhite)
                    .foregroundColor(VoteNowColors.primaryCTA)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(VoteNowColors.primaryCTA.opacity(0.28), lineWidth: 1)
                    )
                    .buttonStyle(.plain)
                    .disabled(isResolvingCurrentAddress)

                    Button {
                        Task {
                            await handleSaveAddressTapped()
                        }
                    } label: {
                        Text("my_info.action.show_reps", tableName: "MyInfoPanel")
                            .font(.subheadline.weight(.semibold))
                            .frame(maxWidth: .infinity)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 10)
                    }
                    .background(VoteNowColors.infoSurfaceBlue)
                    .foregroundColor(VoteNowColors.richBlue)
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(VoteNowColors.richBlue.opacity(0.24), lineWidth: 1)
                    )
                    .buttonStyle(.plain)
                } header: {
                    Text("my_info.section.zip.header", tableName: "MyInfoPanel")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }

                Section {
                    PartyAffiliationToggle(selection: $affiliation)
                        .padding(.vertical, 4)
                    Text("my_info.party.helper", tableName: "MyInfoPanel")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                } header: {
                    Text("my_info.section.party.header", tableName: "MyInfoPanel")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }

                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("my_info.language.title", tableName: "MyInfoPanel")
                            .font(.subheadline.weight(.semibold))
                            .padding(.bottom, 2)

                        ForEach(LanguageOption.allCases, id: \.self) { option in
                            Button {
                                preferredLanguageCode = option.rawValue
                            } label: {
                                HStack {
                                    languageLabel(for: option)
                                        .foregroundColor(VoteNowColors.primaryText)
                                    Spacer()
                                    Image(systemName: selectedLanguage == option ? "largecircle.fill.circle" : "circle")
                                        .foregroundColor(selectedLanguage == option ? .blue : .secondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }

                        Text("my_info.language.disclaimer", tableName: "MyInfoPanel")
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                            .italic()
                            .padding(.top, 4)
                    }
                } header: {
                    Text("my_info.section.accessibility.header", tableName: "MyInfoPanel")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }

                Section {
                    Button {
                        showFeedbackSheet = true
                    } label: {
                        Label(
                            String(localized: "app.how_to_vote.section.feedback", table: "AppShell"),
                            systemImage: "bubble.left.and.bubble.right.fill"
                        )
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(VoteNowColors.primaryCTA)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 7)
                        .frame(maxWidth: .infinity)
                        .background(VoteNowColors.surfaceWhite)
                        .clipShape(Capsule(style: .continuous))
                        .overlay(
                            Capsule(style: .continuous)
                                .stroke(VoteNowColors.primaryCTA.opacity(0.34), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                }
            }
            .navigationTitle(Text(l("my_info.navigation.title", "My Information")))
            .navigationBarTitleDisplayMode(.large)
            .sheet(isPresented: $showFeedbackSheet) {
                NavigationStack {
                    FeedbackView()
                }
            }
            .onChange(of: affiliation) { _, newValue in
                planVM.selectedParty = newValue
            }
            .alert(isPresented: $showInvalidZipAlert) {
                Alert(
                    title: Text("my_info.alert.invalid_zip.title", tableName: "MyInfoPanel"),
                    message: Text("my_info.alert.invalid_zip.message", tableName: "MyInfoPanel"),
                    dismissButton: .default(Text("my_info.alert.invalid_zip.ok", tableName: "MyInfoPanel"))
                )
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(role: .cancel) {
                        dismiss()
                    } label: {
                        Text("my_info.action.cancel", tableName: "MyInfoPanel")
                    }
                }
                ToolbarItemGroup(placement: .keyboard) {
                    Spacer()
                    Button(l("app.reps.action.done", "Done")) {
                        locationFieldFocused = false
                    }
                }
            }
            .onAppear {
                seedLookupInputIfNeeded()
                affiliation = planVM.selectedParty
                preferredLanguageCode = selectedLanguage.rawValue
            }
            .onChange(of: repsVM.resolvedLocationSelection) { _, _ in
                guard isResolvingCurrentAddress else { return }
                if applyCurrentAddressToInput(includeFallback: false) {
                    syncPlanAddressFromResolvedSelection()
                    isResolvingCurrentAddress = false
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                        dismiss()
                    }
                }
            }
            .onChange(of: repsVM.isLoading) { _, isLoading in
                guard isResolvingCurrentAddress else { return }
                if !isLoading {
                    isResolvingCurrentAddress = false
                }
            }
        }
    }

    @ViewBuilder
    private func languageLabel(for option: LanguageOption) -> some View {
        switch option {
        case .english:
            // Keep English label fixed across all app locales.
            Text(verbatim: "English")
        case .spanish:
            Text("my_info.language.spanish", tableName: "MyInfoPanel")
        case .mandarinSimplified:
            Text("my_info.language.chinese", tableName: "MyInfoPanel")
        case .mandarinTraditional:
            Text("my_info.language.traditional_mandarin", tableName: "MyInfoPanel")
        case .filipino:
            Text("my_info.language.filipino", tableName: "MyInfoPanel")
        case .vietnamese:
            Text("my_info.language.vietnamese", tableName: "MyInfoPanel")
        case .french:
            Text("my_info.language.french", tableName: "MyInfoPanel")
        case .german:
            Text("my_info.language.german", tableName: "MyInfoPanel")
        }
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "MyInfoPanel",
            locale: locale,
            fallback: fallback
        )
    }

    @MainActor
    private func handleSaveAddressTapped() async {
        let trimmedInput = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else {
            showInvalidZipAlert = true
            return
        }

        planVM.selectedParty = affiliation

        if let normalizedZip = USZipInputValidator.normalizedPrimaryZIP(from: trimmedInput) {
            planVM.zip = normalizedZip
            var updatedAddress = planVM.userAddress
            if updatedAddress.zip != normalizedZip {
                updatedAddress.zip = normalizedZip
            }
            if let inferredStateCode = zipStateResolver.stateCode(for: normalizedZip),
               updatedAddress.state != inferredStateCode {
                updatedAddress.state = inferredStateCode
            }
            planVM.userAddress = updatedAddress
        }

        locationFieldFocused = false
        repsVM.resolveLocationInput(trimmedInput)

        // Add slight delay to avoid dismissal race condition
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            dismiss()
        }
    }

    private func seedLookupInputIfNeeded() {
        guard locationInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        if let selection = repsVM.resolvedLocationSelection,
           let normalized = selection.normalizedAddress,
           !normalized.isEmpty {
            locationInput = normalized
            return
        }

        let address = [
            planVM.userAddress.street,
            planVM.userAddress.city,
            planVM.userAddress.state,
            planVM.userAddress.zip
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")

        if !address.isEmpty {
            locationInput = address
            return
        }

        if !planVM.zip.isEmpty {
            locationInput = planVM.zip
        }
    }

    private func useCurrentAddressTapped() {
        locationFieldFocused = false
        isResolvingCurrentAddress = true
        repsVM.centerOnCurrentLocation()
    }

    @discardableResult
    private func applyCurrentAddressToInput(includeFallback: Bool = true) -> Bool {
        if let selection = repsVM.resolvedLocationSelection {
            if let normalized = selection.normalizedAddress?.trimmingCharacters(in: .whitespacesAndNewlines),
               !normalized.isEmpty {
                locationInput = normalized
                return true
            }

            let city = (selection.city ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let state = (selection.administrativeArea ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            let zip = (selection.postalCode ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            if !city.isEmpty || !state.isEmpty || !zip.isEmpty {
                var composed = ""
                if !city.isEmpty && !state.isEmpty && !zip.isEmpty {
                    composed = "\(city), \(state) \(zip)"
                } else if !state.isEmpty && !zip.isEmpty {
                    composed = "\(state), \(zip)"
                } else if !city.isEmpty && !state.isEmpty {
                    composed = "\(city), \(state)"
                } else {
                    composed = [city, state, zip]
                        .filter { !$0.isEmpty }
                        .joined(separator: ", ")
                }
                if !composed.isEmpty {
                    locationInput = composed
                    return true
                }
            }
        }

        guard includeFallback else {
            return false
        }

        let address = [
            planVM.userAddress.street,
            planVM.userAddress.city,
            planVM.userAddress.state,
            planVM.userAddress.zip
        ]
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty }
        .joined(separator: ", ")

        if !address.isEmpty {
            locationInput = address
            return true
        }

        let normalizedZip = String(planVM.zip.filter(\.isNumber).prefix(5))
        if normalizedZip.count == 5 {
            locationInput = normalizedZip
            return true
        }

        return false
    }

    private func syncPlanAddressFromResolvedSelection() {
        guard let selection = repsVM.resolvedLocationSelection else { return }

        var updatedAddress = planVM.userAddress
        if let city = selection.city?.trimmingCharacters(in: .whitespacesAndNewlines),
           !city.isEmpty {
            updatedAddress.city = city
        }
        if let state = selection.administrativeArea?.trimmingCharacters(in: .whitespacesAndNewlines),
           !state.isEmpty {
            updatedAddress.state = state
        }
        if let postalCode = selection.postalCode?.trimmingCharacters(in: .whitespacesAndNewlines),
           !postalCode.isEmpty {
            let normalizedZip = String(postalCode.filter(\.isNumber).prefix(5))
            if normalizedZip.count == 5 {
                updatedAddress.zip = normalizedZip
                planVM.zip = normalizedZip
            }
        }

        planVM.userAddress = updatedAddress
        let normalizedInput = locationInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if !normalizedInput.isEmpty {
            planVM.homeAddress = normalizedInput
        }
    }
}

private struct PartyAffiliationToggle: View {
    @Binding var selection: PoliticalParty
    @Namespace private var highlightNamespace

    private let parties: [PoliticalParty] = [.democrat, .independent, .republican]

    var body: some View {
        HStack(spacing: 6) {
            ForEach(parties, id: \.self) { party in
                Button {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        selection = party
                    }
                } label: {
                    partyLabel(for: party)
                        .font(.subheadline.weight(.semibold))
                        .foregroundColor(textColor(for: party))
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background {
                            if selection == party {
                                RoundedRectangle(cornerRadius: 8, style: .continuous)
                                    .fill(highlightColor(for: party))
                                    .matchedGeometryEffect(id: "party-highlight", in: highlightNamespace)
                            }
                        }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(4)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(VoteNowColors.infoSurfaceBlue)
        )
    }

    @ViewBuilder
    private func partyLabel(for party: PoliticalParty) -> some View {
        switch party {
        case .democrat:
            Text("my_info.party.democrat", tableName: "MyInfoPanel")
        case .independent:
            Text("my_info.party.independent", tableName: "MyInfoPanel")
        case .republican:
            Text("my_info.party.republican", tableName: "MyInfoPanel")
        }
    }

    private func highlightColor(for party: PoliticalParty) -> Color {
        switch party {
        case .democrat: return VoteNowColors.richBlue
        case .independent: return .gray.opacity(0.35)
        case .republican: return VoteNowColors.richRed
        }
    }

    private func textColor(for party: PoliticalParty) -> Color {
        guard selection == party else { return .primary }
        return .white
    }
}

#if DEBUG
struct MyInfoPanelView_Previews: PreviewProvider {
    static var previews: some View {
        let planVM = PlanViewModel()
        planVM.zip = "10044"
        planVM.selectedParty = .democrat

        return MyInfoPanelView()
            .environmentObject(planVM)
            .environmentObject(MyRepsViewModel())
            .previewDevice("iPhone 12")
    }
}
#endif
