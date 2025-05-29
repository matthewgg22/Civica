//
//
//  HowToVoteView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/1/25.
//  Updated by ChatGPT on 5/19/25.
//

import SwiftUI

struct HowToVoteView: View {
    @EnvironmentObject var planVM: PlanViewModel

    var body: some View {
        NavigationView {
            List {
                // 1) Plan card if it exists
                if planVM.plan.voteTime != nil {
                    Section {
                        PlanCardView()
                            .environmentObject(planVM)
                            .listRowInsets(.init())
                            .padding(.vertical, 8)
                    }
                }
                // 2) Otherwise, prompt to make one
                else {
                    Section {
                        NavigationLink(
                            destination: MultiStepFormView()
                                .environmentObject(planVM)
                        ) {
                            Label("Make a Plan to Vote", systemImage: "calendar.badge.plus")
                                .font(.headline)
                                .frame(maxWidth: .infinity, alignment: .center)
                        }
                        .buttonStyle(.borderedProminent)
                        .listRowInsets(.init())
                        .padding(.vertical, 8)
                    }
                }

                // 3) How-to-Vote menu
                Section {
                    NavigationLink("Race Candidates",
                                   destination: RaceCandidatesView())
                    NavigationLink("Polling Locations",
                                   destination: PollingLocationsView(selectedPlace: .constant(nil)))
                    NavigationLink("Sample Ballot",
                                   destination: SampleBallotView())
                    NavigationLink("Request Mail-in Ballot",
                                   destination: AbsenteeView())
                    // — Transportation Help removed —
                    NavigationLink("Election Hotlines",
                                   destination: ElectionHotlinesView())
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle("How to Vote")
        }
    }
}

struct HowToVoteView_Previews: PreviewProvider {
    static var previews: some View {
        HowToVoteView()
            .environmentObject(PlanViewModel())
    }
}
