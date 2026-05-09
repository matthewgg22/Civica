//
//  VoterRegistrationReminderView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import CivicaDesignSystem
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
        VStack(spacing: CivicaSpacing.xl) {
            Text("Voter Registration")
                .font(.title2)
                .bold()

            Text("Make sure you are registered and ready to vote.")
                .multilineTextAlignment(.center)

            Link(destination: checkStatusURL) {
                Text(checkStatusLabel)
                    .font(CivicaTypography.sectionHeader)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, CivicaSpacing.md)
                    .background(CivicaColors.ctaBlue.cornerRadius(CivicaRadius.sm))
                    .foregroundColor(.white)
            }

            Spacer()

            Button("Done") {
                // Dismiss
                selectedTab = .myReps
            }
            .padding(.top, CivicaSpacing.md)
        }
        .padding()
    }
}
