//
//  MailInBallotView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 5/20/25.
//

import SwiftUI

struct MailInBallotView: View {
    @Environment(\.locale) private var locale

    var body: some View {
        AbsenteeView()
            .navigationTitle(Text(l("app.mail_ballot.navigation.title", "Request Mail-in Ballot")))
            .navigationBarTitleDisplayMode(.inline)
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

struct MailInBallotView_Previews: PreviewProvider {
    static var previews: some View {
        MailInBallotView()
    }
}
