//
//  VoterRegistrationReminderView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

struct VoterRegistrationReminderView: View {
    @Binding var selectedTab: Tab
    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 24) {
            Text("Voter Registration")
                .font(.title2)
                .bold()

            Text("Make sure you’re registered and ready to vote!")
                .multilineTextAlignment(.center)

            // 👉 This Link will open the URL when tapped
            Link(destination: URL(string: "https://e-register.vote.nyc")!) {
                Text("Check Registration Status")
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue.cornerRadius(8))
                    .foregroundColor(.white)
            }

            Spacer()

            Button("Done") {
                // Dismiss
                selectedTab = .myReps
            }
            .padding(.top, 12)
        }
        .padding()
    }
}

