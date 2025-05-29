
//  MobilizationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/1/25.
//  Updated by ChatGPT on 05/24/25 (injected planVM into form sheet)

import SwiftUI

struct MobilizationView: View {
    @EnvironmentObject var planVM: PlanViewModel
    @State private var selectedPlace: PollingPlace?
    @State private var showPlanSheet = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // — Header —
                    PageHeader(title: "How to Vote")
                        .padding(.horizontal)

                    // — Plan card OR button —
                    if planVM.plan.voteTime != nil {
                        PlanCardView()
                            .padding(.horizontal)
                    } else {
                        Button("Make a Plan to Vote") {
                            showPlanSheet = true
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                        .padding(.horizontal)
                    }

                    Divider()

                    // — Section list —
                    VStack(spacing: 0) {
                        ForEach(SectionType.allCases, id: \.self) { section in
                            NavigationLink(
                                section.title,
                                destination: section.destination(selectedPlace: $selectedPlace)
                            )
                            .padding()
                            Divider()
                        }
                    }
                    .background(Color(.systemBackground))
                    .cornerRadius(8)
                    .padding(.horizontal)
                }
                .padding(.vertical)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
        // — Sheets —
        .sheet(isPresented: $showPlanSheet) {
            MultiStepFormView()
                .environmentObject(planVM)    // ← inject the shared PlanViewModel here
        }
        .sheet(item: $selectedPlace) { place in
            PollingPlaceDetailView(place: place)
        }
    }
}

enum SectionType: CaseIterable {
    case raceCandidates, pollingLocations, sampleBallot, mailInBallot, electionHotlines

    var title: String {
        switch self {
        case .raceCandidates:   return "Race Candidates"
        case .pollingLocations: return "Polling Locations"
        case .sampleBallot:     return "Sample Ballot"
        case .mailInBallot:     return "Request Mail-in Ballot"
        case .electionHotlines: return "Election Hotlines"
        }
    }

    @ViewBuilder
    func destination(selectedPlace: Binding<PollingPlace?>) -> some View {
        switch self {
        case .raceCandidates:
            RaceCandidatesView()
        case .pollingLocations:
            PollingLocationsView(selectedPlace: selectedPlace)
        case .sampleBallot:
            SampleBallotView()
        case .mailInBallot:
            MailInBallotView()
        case .electionHotlines:
            ElectionHotlinesView()
        }
    }
}

// Preview
struct MobilizationView_Previews: PreviewProvider {
    static var previews: some View {
        MobilizationView()
            .environmentObject(PlanViewModel())
    }
}

