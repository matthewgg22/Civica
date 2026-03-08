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
    @Environment(\.locale) private var locale

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
                            Label(l("app.how_to_vote.action.make_plan", "Make a Plan to Vote"), systemImage: "calendar.badge.plus")
                                .font(.headline.weight(.semibold))
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 12)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(Capsule(style: .continuous))
                                .voteNowPillDualOrbit(
                                    redColor: VoteNowColors.ctaRed,
                                    blueColor: VoteNowColors.ctaBlue,
                                    strokeThickness: 2.8,
                                    loopDuration: 3.3,
                                    glowIntensity: 0.36,
                                    idleOpacity: 0.30,
                                    borderInset: 0.7,
                                    segmentLength: 0.34
                                )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(.init())
                        .padding(.vertical, 8)
                    }
                }

                // 3) How-to-Vote menu
                Section {
                    NavigationLink(l("app.how_to_vote.section.race_candidates", "Race Candidates"),
                                   destination: RaceCandidatesView())
                    NavigationLink(l("app.how_to_vote.section.polling_locations", "Polling Locations"),
                                   destination: PollingLocationsView(selectedPlace: .constant(nil)))
                    NavigationLink(l("app.how_to_vote.section.sample_ballot", "Sample Ballot"),
                                   destination: SampleBallotView())
                    NavigationLink(l("app.how_to_vote.section.mail_in_ballot", "Request Mail-in Ballot"),
                                   destination: MailInBallotView())
                    // — Transportation Help removed —
                    NavigationLink(l("app.how_to_vote.section.hotlines", "Election Hotlines"),
                                   destination: ElectionHotlinesView())
                }
            }
            .listStyle(InsetGroupedListStyle())
            .navigationTitle(l("app.page.how_to_vote", "How to Vote"))
        }
    }

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
}

struct HowToVoteView_Previews: PreviewProvider {
    static var previews: some View {
        HowToVoteView()
            .environmentObject(PlanViewModel())
    }
}
