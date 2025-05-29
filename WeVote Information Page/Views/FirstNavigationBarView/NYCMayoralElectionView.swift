//
//
//
//
//  NYCMayoralElectionView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/15/25.
//

import SwiftUI

struct NYCMayoralElectionView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                // ✅ Large title
                PageHeader(title: "NYC Mayoral Election 2025")

                // ──────────────────────────────────────────────────────────────────────────
                // Personalized eligibility intro
                Text("Based on your address, you’re eligible to vote in the NYC Mayoral Election. This is a Primary Election that uses Ranked Choice Voting. Based on your party registration, information is tailored for the Democrat/Republican primary.")
                    .font(.body)
                    .padding(.bottom, 8)

                // 🗳 Primary Info
                Group {
                    Text("🗳 What Is a Primary?")
                        .font(.title3).fontWeight(.semibold)

                    Text("A primary lets party members choose who will represent them in the general election. In New York, only registered party members can vote in their party's primary.")
                        .font(.body)
                }

                // 📊 Ranked Choice Voting
                Group {
                    Text("📊 What Is Ranked Choice Voting?")
                        .font(.title3).fontWeight(.semibold)

                    VStack(alignment: .leading, spacing: 8) {
                        Text("• You only vote once; your full ranking is used in each round and can rank up to 5 candidates")
                        Text("• If no one gets over 50% of first-choice votes, the lowest-scoring candidates are eliminated and your vote moves to your next choice.")
                        Text("• Rounds continue until one candidate reaches a majority.")
                    }
                    .font(.body)

                    // Visual RCV chart
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 0) {
                            RankedChoiceVotingView()
                                .frame(height: 300)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    .padding(.vertical, 16)
                }

                // 📅 When Will Results Be Counted?
                Group {
                    Text("📅 When Will Results Be Counted?")
                        .font(.title3).fontWeight(.semibold)

                    Text("First-choice results are shared on election night. Ranked results are released in weekly updates until all absentee ballots are counted and the election is certified.")
                        .font(.body)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 24)
        }
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct NYCMayoralElectionView_Previews: PreviewProvider {
    static var previews: some View {
        NYCMayoralElectionView()
    }
}
