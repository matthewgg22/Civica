//
//  VoterRegistrationReminderView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

struct VoterRegistrationReminderView: View {
    @Binding var selectedTab: Tab
    @EnvironmentObject private var planVM: PlanViewModel

    private let contextResolver = ElectionGuideContextResolver()
    private let contentProvider = RegistrationGuideContentProvider()

    private var checkStatusURL: URL {
        guard let context = contextResolver.resolve(for: planVM) else {
            return URL(string: "https://www.vote.gov/")!
        }
        return contentProvider.content(for: context).checkStatusURL
    }

    private var checkStatusLabel: String {
        guard let context = contextResolver.resolve(for: planVM) else {
            return "Check Registration Status"
        }
        return contentProvider.content(for: context).checkStatusLabel
    }

    var body: some View {
        VStack(spacing: 24) {
            Text("Voter Registration")
                .font(.title2)
                .bold()

            Text("Make sure you are registered and ready to vote.")
                .multilineTextAlignment(.center)

            Link(destination: checkStatusURL) {
                Text(checkStatusLabel)
                    .font(.headline)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(CivicaColors.richBlue.cornerRadius(8))
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
