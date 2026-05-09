//
//
//  MyInfoPanelView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/31/25 — safer dismiss logic and empty location check

import CivicaDesignSystem
import SwiftUI

struct MyInfoPanelView: View {
    private enum SectionAnchor {
        static let language = "my_info.language.section.anchor"
    }

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
    @State private var showInvalidZipAlert = false
    @State private var showFeedbackSheet = false
    @State private var isResolvingCurrentAddress = false
    @State private var isSavingAddress = false
    @State private var addressSaveError: String?
    @State private var activeResolutionStartedAt: Date?
    @FocusState private var locationFieldFocused: Bool
    let focusLanguageSection: Bool

    init(focusLanguageSection: Bool = false) {
        self.focusLanguageSection = focusLanguageSection
    }

    private var selectedLanguage: LanguageOption {
        LanguageOption.fromStoredCode(preferredLanguageCode) ?? .english
    }

    private var sectionCornerRadius: CGFloat {
        CivicaColors.cardCornerRadius
    }

    private var locationSummaryText: String? {
        let selection = repsVM.resolvedLocationSelection
        let city = (selection?.city ?? planVM.userAddress.city)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let stateRaw = (selection?.administrativeArea ?? planVM.userAddress.state)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        let stateCode = normalizedUSStateCode(from: stateRaw) ?? stateRaw.uppercased()
        let zipCandidate = selection?.postalCode ?? planVM.userAddress.zip
        let zip = USZipInputValidator.normalizedPrimaryZIP(from: zipCandidate)

        guard !city.isEmpty, stateCode.count == 2, let zip else { return nil }
        return "Using: \(city), \(stateCode) (\(zip))"
    }

    var body: some View {
        NavigationStack {
            ScrollViewReader { proxy in
                Form {
                    Section {
                    VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                        HStack(spacing: CivicaSpacing.sm) {
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
                                .padding(.horizontal, CivicaSpacing.md)
                                .padding(.vertical, CivicaSpacing.md)
                                .background(CivicaColors.surfacePrimary)
                                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
                                .overlay(
                                    RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                        .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                                )
                                .onChange(of: locationInput) { _, newValue in
                                    repsVM.handleLocationInputTyping(newValue)
                                    if !newValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                                        addressSaveError = nil
                                    }
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
                            .font(CivicaTypography.footnote)
                            .foregroundColor(CivicaColors.textSecondary)

                        if let locationSummaryText {
                            HStack(spacing: CivicaSpacing.sm) {
                                Text(locationSummaryText)
                                    .font(CivicaTypography.footnoteStrong)
                                    .foregroundColor(CivicaColors.textSecondary)
                                    .lineLimit(1)
                                Spacer(minLength: 6)
                                Button("Edit location") {
                                    locationFieldFocused = true
                                }
                                .font(CivicaTypography.footnoteStrong)
                                .foregroundColor(CivicaColors.ctaBlue)
                                .buttonStyle(.plain)
                            }
                        }

                        Button {
                            useCurrentAddressTapped()
                        } label: {
                            Label(
                                isResolvingCurrentAddress
                                ? l("my_info.action.use_current_location.loading", "Locating Current Location...")
                                : l("my_info.action.use_current_location", "Use Current Location"),
                                systemImage: "location.fill"
                            )
                            .font(CivicaTypography.subheadStrong)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding(.horizontal, CivicaSpacing.md)
                            .padding(.vertical, CivicaSpacing.sm)
                        }
                        .background(CivicaColors.surfacePrimary)
                        .foregroundColor(CivicaColors.ctaBlue)
                        .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous))
                        .overlay(
                            RoundedRectangle(cornerRadius: CivicaRadius.md, style: .continuous)
                                .stroke(CivicaColors.ctaBlue.opacity(0.22), lineWidth: 1)
                        )
                        .buttonStyle(.plain)
                        .disabled(isResolvingCurrentAddress || isSavingAddress)

                        Button {
                            Task {
                                await handleSaveAddressTapped()
                            }
                        } label: {
                            if isSavingAddress {
                                HStack(spacing: CivicaSpacing.sm) {
                                    ProgressView()
                                        .controlSize(.small)
                                    Text(l("my_info.action.save_location.loading", "Saving Location..."))
                                        .font(CivicaTypography.subheadStrong)
                                }
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.horizontal, CivicaSpacing.md)
                                .padding(.vertical, CivicaSpacing.sm)
                            } else {
                                Text(l("my_info.action.save_location", "Save Location"))
                                    .font(CivicaTypography.subheadStrong)
                                    .frame(maxWidth: .infinity, alignment: .center)
                                    .padding(.horizontal, CivicaSpacing.md)
                                    .padding(.vertical, CivicaSpacing.sm)
                            }
                        }
                        .buttonStyle(CivicaPrimaryCTAButtonStyle())
                        .disabled(isResolvingCurrentAddress || isSavingAddress)

                        if let addressSaveError {
                            Text(addressSaveError)
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.ctaRed)
                        }

                        if addressSaveError == nil,
                           let timelineDataError = repsVM.timelineDataErrorMessage?
                            .trimmingCharacters(in: .whitespacesAndNewlines),
                           !timelineDataError.isEmpty {
                            Text(timelineDataError)
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.warningAmber)
                        }
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                            .fill(CivicaColors.infoSurfaceBlue.opacity(0.44))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                            .stroke(CivicaColors.ctaBlue.opacity(0.10), lineWidth: 1)
                    )
                } header: {
                    Text("my_info.section.zip.header", tableName: "MyInfoPanel")
                        .font(CivicaTypography.sectionHeaderBold)
                        .textCase(nil)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)

                    Section {
                        VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                            Text("my_info.language.title", tableName: "MyInfoPanel")
                                .font(CivicaTypography.subheadStrong)
                                .padding(.bottom, CivicaSpacing.xs)

                            ForEach(LanguageOption.allCases, id: \.self) { option in
                                Button {
                                    preferredLanguageCode = option.rawValue
                                } label: {
                                    HStack {
                                        languageLabel(for: option)
                                            .foregroundColor(CivicaColors.textPrimary)
                                        Spacer()
                                        Image(systemName: selectedLanguage == option ? "largecircle.fill.circle" : "circle")
                                            .foregroundColor(selectedLanguage == option ? .blue : .secondary)
                                    }
                                }
                                .buttonStyle(.plain)
                            }

                            Text("my_info.language.disclaimer", tableName: "MyInfoPanel")
                                .font(CivicaTypography.footnote)
                                .foregroundColor(CivicaColors.textSecondary)
                                .italic()
                                .padding(.top, CivicaSpacing.xs)
                        }
                        .padding(CivicaSpacing.md)
                        .background(
                            RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                                .fill(CivicaColors.surfacePrimary)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                                .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                        )
                    } header: {
                        Text("my_info.section.accessibility.header", tableName: "MyInfoPanel")
                            .font(CivicaTypography.sectionHeaderBold)
                            .textCase(nil)
                    }
                    .id(SectionAnchor.language)
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)

                Section {
                    VStack(alignment: .leading, spacing: CivicaSpacing.sm) {
                        Button {
                            showFeedbackSheet = true
                        } label: {
                            Label(
                                String(localized: "app.how_to_vote.section.feedback", table: "AppShell"),
                                systemImage: "bubble.left.and.bubble.right.fill"
                            )
                            .font(CivicaTypography.subheadStrong)
                            .foregroundColor(CivicaColors.ctaBlue)
                            .padding(.horizontal, CivicaSpacing.sm)
                            .padding(.vertical, CivicaSpacing.sm)
                            .frame(maxWidth: .infinity)
                            .background(CivicaColors.surfacePrimary)
                            .clipShape(Capsule(style: .continuous))
                            .overlay(
                                Capsule(style: .continuous)
                                    .stroke(CivicaColors.ctaBlue.opacity(0.30), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                    }
                    .padding(CivicaSpacing.md)
                    .background(
                        RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                            .fill(CivicaColors.surfacePrimary)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: sectionCornerRadius, style: .continuous)
                            .stroke(CivicaColors.borderSubtle, lineWidth: 1)
                    )
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
            }
                .scrollContentBackground(.hidden)
                .background(CivicaColors.canvasBackground)
                .navigationTitle(Text(l("my_info.navigation.title.location_profile", "Voting Location")))
                .navigationBarTitleDisplayMode(.large)
                .sheet(isPresented: $showFeedbackSheet) {
                    NavigationStack {
                        FeedbackView()
                    }
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
                    preferredLanguageCode = selectedLanguage.rawValue

                    guard focusLanguageSection else { return }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                        withAnimation(CivicaAnimation.standard) {
                            proxy.scrollTo(SectionAnchor.language, anchor: .top)
                        }
                    }
                }
                .onChange(of: repsVM.resolvedLocationSelection) { _, _ in
                    guard isResolvingCurrentAddress || isSavingAddress else { return }
                    guard let selection = repsVM.resolvedLocationSelection else { return }
                    guard selectionBelongsToActiveResolution(selection) else { return }
                    if applyCurrentAddressToInput(includeFallback: false) {
                        syncPlanAddressFromResolvedSelection()
                        addressSaveError = nil
                        resetActiveResolutionState()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                            dismiss()
                        }
                    }
                }
                .onChange(of: repsVM.isLoading) { _, isLoading in
                    guard isResolvingCurrentAddress || isSavingAddress else { return }
                    if !isLoading {
                        if let selection = repsVM.resolvedLocationSelection,
                           selectionBelongsToActiveResolution(selection),
                           applyCurrentAddressToInput(includeFallback: false) {
                            syncPlanAddressFromResolvedSelection()
                            addressSaveError = nil
                            resetActiveResolutionState()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
                                dismiss()
                            }
                            return
                        }

                        if isSavingAddress || isResolvingCurrentAddress {
                            let specificError = repsVM.errorMessage?.trimmingCharacters(in: .whitespacesAndNewlines)
                            addressSaveError = (specificError?.isEmpty == false)
                                ? specificError
                                : "We couldn’t verify that address. Try a full street address or ZIP code."
                        }
                        resetActiveResolutionState()
                    }
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
            addressSaveError = nil
            showInvalidZipAlert = true
            return
        }

        addressSaveError = nil
        isSavingAddress = true
        isResolvingCurrentAddress = false
        activeResolutionStartedAt = Date()
        locationFieldFocused = false
        repsVM.resolveLocationInput(trimmedInput)
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
        addressSaveError = nil
        isResolvingCurrentAddress = true
        isSavingAddress = false
        activeResolutionStartedAt = Date()
        repsVM.centerOnCurrentLocation()
    }

    private func selectionBelongsToActiveResolution(_ selection: RepsLocationSelection) -> Bool {
        guard let startedAt = activeResolutionStartedAt else { return true }
        return selection.timestamp >= startedAt.addingTimeInterval(-0.5)
    }

    private func resetActiveResolutionState() {
        isResolvingCurrentAddress = false
        isSavingAddress = false
        activeResolutionStartedAt = nil
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

#if DEBUG
struct MyInfoPanelView_Previews: PreviewProvider {
    static var previews: some View {
        let planVM = PlanViewModel()
        planVM.zip = "10044"

        return MyInfoPanelView()
            .environmentObject(planVM)
            .environmentObject(MyRepsViewModel())
            .previewDevice("iPhone 12")
    }
}
#endif
