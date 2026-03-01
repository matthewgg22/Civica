//
//  ElectionHotlinesView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import SwiftUI

struct ElectionHotlinesView: View {
    @Environment(\.locale) private var locale

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text(l("app.election_hotlines.title", "📞 Election Hotlines"))
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top)

                VStack(alignment: .leading, spacing: 12) {
                    Text(l("app.election_hotlines.general.title", "🗳️ General Voter Hotline"))
                        .font(.headline)

                    Text(l("app.election_hotlines.general.body", "Have questions about how, when, or where to vote? Contact this hotline to get clear info from trained professionals."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)

                    HStack {
                        Image(systemName: "phone.circle.fill")
                            .foregroundColor(VoteNowColors.richBlue)
                        Text("(866-390-2992)")
                            .fontWeight(.medium)
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 12) {
                    Text(l("app.election_hotlines.intimidation.title", "🚨 Report Voter Intimidation"))
                        .font(.headline)

                    Text(l("app.election_hotlines.intimidation.body", "If you or someone you know is being threatened or blocked from voting, call this national hotline immediately."))
                        .font(.subheadline)
                        .foregroundColor(VoteNowColors.mutedText)

                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(VoteNowColors.richRed)
                        Text("(866-868-3692)")
                            .fontWeight(.medium)
                    }
                }

                Spacer()
            }
            .padding()
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

struct ElectionHotlinesView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionHotlinesView()
    }
}
