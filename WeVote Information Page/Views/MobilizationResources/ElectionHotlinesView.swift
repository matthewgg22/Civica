//
//  ElectionHotlinesView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import CivicaDesignSystem
import SwiftUI

struct ElectionHotlinesView: View {
    @Environment(\.locale) private var locale

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: CivicaSpacing.xl) {
                Text(l("app.election_hotlines.title", "📞 Election Hotlines"))
                    .font(CivicaTypography.pageTitle)
                    .padding(.top)

                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    Text(l("app.election_hotlines.general.title", "🗳️ General Voter Hotline"))
                        .font(CivicaTypography.sectionHeader)

                    Text(l("app.election_hotlines.general.body", "Have questions about how, when, or where to vote? Contact this hotline to get clear info from trained professionals."))
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.graphite)

                    HStack {
                        Image(systemName: "phone.circle.fill")
                            .foregroundColor(CivicaColors.brickPrimary)
                        hotlineNumberLink(display: "(866-390-2992)", digits: "8663902992")
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: CivicaSpacing.md) {
                    Text(l("app.election_hotlines.intimidation.title", "🚨 Report Voter Intimidation"))
                        .font(CivicaTypography.sectionHeader)

                    Text(l("app.election_hotlines.intimidation.body", "If you or someone you know is being threatened or blocked from voting, call this national hotline immediately."))
                        .font(CivicaTypography.subhead)
                        .foregroundColor(CivicaColors.graphite)

                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(CivicaColors.destructive)
                        hotlineNumberLink(display: "(866-868-3692)", digits: "8668683692")
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

    @ViewBuilder
    private func hotlineNumberLink(display: String, digits: String) -> some View {
        if let telURL = URL(string: "tel:\(digits)") {
            Link(display, destination: telURL)
                .fontWeight(.medium)
                .foregroundColor(CivicaColors.brickPrimary)
        } else {
            Text(display)
                .fontWeight(.medium)
        }
    }
}

struct ElectionHotlinesView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionHotlinesView()
    }
}
