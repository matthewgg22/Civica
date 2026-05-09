//
//  CivicScorecardView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

// MARK: - CivicScorecardView
struct CivicScorecardView: View {
    var body: some View {
        VStack(spacing: 20) {
            Text("Civic Scorecard: 3 🔥")
                .font(CivicaTypography.sectionHeader)
                .padding(.top)
            Divider()
            VStack(alignment: .leading, spacing: 10) {
                Text("1x General Election")
                Text("1x Primary Election")
                Text("1x Gubernational Election")
            }
            .font(CivicaTypography.subhead)
            Divider()
            Text("You are in the top 25% of American Voters")
                .font(CivicaTypography.footnote)
                .padding(.bottom)
            Spacer()
        }
        .padding()
        .presentationDetents([.fraction(0.5)])
    }
}
