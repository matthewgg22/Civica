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
                                .font(CivicaTypography.sectionHeader)
                                .foregroundColor(.white)
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding(.vertical, 12)
                                .background(VoteNowColors.primaryCTA)
                                .clipShape(Capsule(style: .continuous))
                                .voteNowPillDualOrbit(
                                    redColor: VoteNowColors.ctaRed.opacity(0.94),
                                    blueColor: VoteNowColors.ctaBlue.opacity(0.88),
                                    strokeThickness: 2.8,
                                    loopDuration: 4.95,
                                    glowIntensity: 0.28,
                                    idleOpacity: 0.24,
                                    borderInset: 0.65,
                                    segmentLength: 0.34,
                                    separatorThickness: 0.75
                                )
                        }
                        .buttonStyle(.plain)
                        .listRowInsets(.init())
                        .padding(.vertical, 8)
                    }
                }

                // 3) How-to-Vote menu
                Section {
                    if shouldShowNYC2025ArchiveResources {
                        NavigationLink(
                            l(
                                "app.how_to_vote.section.race_candidates.archive",
                                "Candidates in this race (NYC 2025 archive)"
                            ),
                            destination: RaceCandidatesView(showArchiveDisclaimer: true)
                        )
                        NavigationLink(
                            l(
                                "app.how_to_vote.section.polling_locations.archive",
                                "Polling locations (NYC 2025 archive)"
                            ),
                            destination: PollingLocationsView(
                                selectedPlace: .constant(nil),
                                showArchiveDisclaimer: true
                            )
                        )
                        NavigationLink(
                            l(
                                "app.how_to_vote.section.sample_ballot.archive",
                                "Example ballot (NYC 2025 archive)"
                            ),
                            destination: SampleBallotView(showArchiveDisclaimer: true)
                        )
                    }
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

    private var shouldShowNYC2025ArchiveResources: Bool {
        guard isNYCJurisdiction else { return false }
        let years = Set(planVM.upcomingElections.map { Calendar.current.component(.year, from: $0.electionDay) })
        if years.isEmpty { return true }
        return years.contains(2025)
    }

    private var isNYCJurisdiction: Bool {
        let stateRaw = planVM.userAddress.state.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        let stateMatches = stateRaw == "NY" || stateRaw == "NEW YORK"
        let cityMatches = planVM.userAddress.city
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .lowercased()
            .contains("new york")
        let zip = String(planVM.userAddress.zip.filter(\.isNumber).prefix(5))
        let zipMatches = nycZipPrefixes.contains(String(zip.prefix(3)))
        return stateMatches && (cityMatches || zipMatches)
    }

    private var nycZipPrefixes: Set<String> {
        ["100", "101", "102", "103", "104", "111", "112", "113", "114", "116"]
    }
}

struct HowToVoteView_Previews: PreviewProvider {
    static var previews: some View {
        HowToVoteView()
            .environmentObject(PlanViewModel())
    }
}
