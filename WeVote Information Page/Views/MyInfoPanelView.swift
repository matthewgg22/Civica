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
        case english = "English"
        case spanish = "Spanish"
        case chinese = "Chinese"
        case tagalog = "Tagalog"
        case vietnamese = "Vietnamese"
    }

    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var zip: String = ""
    @State private var affiliation: PoliticalParty = .independent
    @State private var selectedLanguage: LanguageOption = .english
    private let zipStateResolver = USZipStateResolver()

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("e.g. 10044", text: $zip)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                    Text("Provides Personal eligible elections logistics")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                } header: {
                    Text("YOUR ZIP CODE")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }

                Section {
                    PartyAffiliationToggle(selection: $affiliation)
                        .padding(.vertical, 4)
                    Text("Determines primary election eligibility")
                        .font(.footnote)
                        .foregroundColor(VoteNowColors.mutedText)
                } header: {
                    Text("PARTY REGISTRATION")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }

                Button("Show My Representatives") {
                    let normalizedZip = String(zip.filter(\.isNumber).prefix(5))
                    guard normalizedZip.count == 5 else {
                        print("ZIP is invalid — not proceeding.")
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
                .frame(maxWidth: .infinity)
                .padding()
                .background(VoteNowColors.infoSurfaceBlue)
                .cornerRadius(10)
                .foregroundColor(VoteNowColors.richBlue)

                Section {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Language Options")
                            .font(.subheadline.weight(.semibold))
                            .padding(.bottom, 2)

                        ForEach(LanguageOption.allCases, id: \.self) { option in
                            Button {
                                selectedLanguage = option
                            } label: {
                                HStack {
                                    Text(option.rawValue)
                                        .foregroundColor(VoteNowColors.primaryText)
                                    Spacer()
                                    Image(systemName: selectedLanguage == option ? "largecircle.fill.circle" : "circle")
                                        .foregroundColor(selectedLanguage == option ? .blue : .secondary)
                                }
                            }
                            .buttonStyle(.plain)
                        }

                        Text("These preferences were translated from English and therefore can have inaccuracies.")
                            .font(.footnote)
                            .foregroundColor(VoteNowColors.mutedText)
                            .italic()
                            .padding(.top, 4)
                    }
                } header: {
                    Text("ACCESSIBILITY")
                        .font(.headline.weight(.bold))
                        .textCase(nil)
                }
            }
            .navigationTitle("My Information")
            .navigationBarTitleDisplayMode(.large)
            .onChange(of: affiliation) { _, newValue in
                planVM.selectedParty = newValue
            }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
            }
            .onAppear {
                zip = planVM.zip
                affiliation = planVM.selectedParty
                selectedLanguage = .english
            }
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
                    Text(label(for: party))
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

    private func label(for party: PoliticalParty) -> String {
        switch party {
        case .democrat: return "Democrat"
        case .independent: return "Independent"
        case .republican: return "Republican"
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
