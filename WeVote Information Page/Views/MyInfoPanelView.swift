//
//
//  MyInfoPanelView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//  Updated by ChatGPT on 05/22/25 (zip-only fetch)

import SwiftUI

struct MyInfoPanelView: View {
    @EnvironmentObject private var planVM: PlanViewModel
    @EnvironmentObject private var repsVM: MyRepsViewModel
    @Environment(\.dismiss)   private var dismiss

    @State private var zip:         String = ""
    @State private var affiliation: PoliticalParty = .independent

    var body: some View {
        NavigationStack {
            Form {
                Section("Your ZIP Code") {
                    TextField("e.g. 10044", text: $zip)
                        .keyboardType(.numberPad)
                        .textFieldStyle(.roundedBorder)
                }


                Button("Show My Representatives") {
                    // 1) Update zip & party
                    planVM.zip = zip
                    planVM.selectedParty = affiliation
                    // 2) Fetch by ZIP
                    repsVM.fetchReps(for: zip)
                    // 3) Dismiss
                    dismiss()
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color(.systemGray6))
                .cornerRadius(10)
                .foregroundColor(.blue)
            }
            .navigationTitle("My Info")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", role: .cancel) { dismiss() }
                }
            }
            .onAppear {
                zip = planVM.zip
                affiliation = planVM.selectedParty
            }
        }
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

