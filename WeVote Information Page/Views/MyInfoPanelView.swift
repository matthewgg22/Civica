//
//
//  MyInfoPanelView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/31/25 — safer dismiss logic and empty ZIP check

import SwiftUI

struct MyInfoPanelView: View {
    private enum LanguageOption: String, CaseIterable {
        case english = "en"
        case spanish = "es"
        case chinese = "zh-Hans"
        case filipino = "fil"
        case vietnamese = "vi"

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
                return LanguageOption.chinese.rawValue
            case "vi-vn":
                return LanguageOption.vietnamese.rawValue
            case "es-es", "es-mx":
                return LanguageOption.spanish.rawValue
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

    @State private var zip: String = ""
    @State private var affiliation: PoliticalParty = .independent
    @State private var showInvalidZipAlert = false
    private let zipStateResolver = USZipStateResolver()

    private var selectedLanguage: LanguageOption {
        LanguageOption.fromStoredCode(preferredLanguageCode) ?? .english
    }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(
                        "",
                        text: $zip,
                        prompt: Text("my_info.zip.placeholder", tableName: "MyInfoPanel")
                    )
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Text("my_info.zip.helper", tableName: "MyInfoPanel")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
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

                Button {
                    Task {
                        await handleSaveAddressTapped()
                    }
                } label: {
                    Text("my_info.action.show_reps", tableName: "MyInfoPanel")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(VoteNowColors.infoSurfaceBlue)
                .cornerRadius(10)
                .foregroundColor(VoteNowColors.richBlue)

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
            }
            .navigationTitle(Text(l("my_info.navigation.title", "My Information")))
            .navigationBarTitleDisplayMode(.large)
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
            }
            .onAppear {
                zip = planVM.zip
                affiliation = planVM.selectedParty
                preferredLanguageCode = selectedLanguage.rawValue
            }
        }
    }

    @ViewBuilder
    private func languageLabel(for option: LanguageOption) -> some View {
        switch option {
        case .english:
            Text("my_info.language.english", tableName: "MyInfoPanel")
        case .spanish:
            Text("my_info.language.spanish", tableName: "MyInfoPanel")
        case .chinese:
            Text("my_info.language.chinese", tableName: "MyInfoPanel")
        case .filipino:
            Text("my_info.language.filipino", tableName: "MyInfoPanel")
        case .vietnamese:
            Text("my_info.language.vietnamese", tableName: "MyInfoPanel")
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
        let normalizedZip = String(zip.filter(\.isNumber).prefix(5))
        guard normalizedZip.count == 5 else {
            print("ZIP is invalid — not proceeding.")
            showInvalidZipAlert = true
            return
        }

        planVM.zip = normalizedZip
        planVM.selectedParty = affiliation
        var updatedAddress = planVM.userAddress
        if updatedAddress.zip != normalizedZip {
            updatedAddress.zip = normalizedZip
        }
        if let inferredStateCode = zipStateResolver.stateCode(for: normalizedZip),
           updatedAddress.state != inferredStateCode {
            updatedAddress.state = inferredStateCode
        }
        planVM.userAddress = updatedAddress
        repsVM.fetchReps(for: normalizedZip)

        // Add slight delay to avoid dismissal race condition
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            dismiss()
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
