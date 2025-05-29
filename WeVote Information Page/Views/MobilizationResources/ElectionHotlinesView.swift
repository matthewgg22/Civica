//
//  ElectionHotlinesView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//

import SwiftUI

struct ElectionHotlinesView: View {
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("📞 Election Hotlines")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .padding(.top)

                VStack(alignment: .leading, spacing: 12) {
                    Text("🗳️ General Voter Hotline")
                        .font(.headline)

                    Text("Have questions about how, when, or where to vote? Contact this hotline to get clear info from trained professionals.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    HStack {
                        Image(systemName: "phone.circle.fill")
                            .foregroundColor(.blue)
                        Text("(866-390-2992)")
                            .fontWeight(.medium)
                    }
                }

                Divider()

                VStack(alignment: .leading, spacing: 12) {
                    Text("🚨 Report Voter Intimidation")
                        .font(.headline)

                    Text("If you or someone you know is being threatened or blocked from voting, call this national hotline immediately.")
                        .font(.subheadline)
                        .foregroundColor(.secondary)

                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.red)
                        Text("(866-868-3692)")
                            .fontWeight(.medium)
                    }
                }

                Spacer()
            }
            .padding()
        }
    }
}

struct ElectionHotlinesView_Previews: PreviewProvider {
    static var previews: some View {
        ElectionHotlinesView()
    }
}
