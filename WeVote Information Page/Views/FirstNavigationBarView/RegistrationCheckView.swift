
//  RegistrationCheckView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/8/25.
//

import SwiftUI

struct RegistrationCheckView: View {
    @Binding var registrationStatus: String?
    @EnvironmentObject private var planVM: PlanViewModel

    private let contextResolver = ElectionGuideContextResolver()
    private let contentProvider = RegistrationGuideContentProvider()
    private let fallbackCheckStatusURL = URL(string: "https://www.vote.gov/") ?? URL(fileURLWithPath: "/")

    private var checkStatusURL: URL {
        guard let context = contextResolver.resolve(for: planVM) else {
            return fallbackCheckStatusURL
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
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Are You Registered to Vote?")
                    .font(.title2)
                    .bold()

                Text("Use the button below to check your current voter registration status.")
                    .font(.body)
                    .padding(.bottom, 24)

                Link(destination: checkStatusURL) {
                    Text(checkStatusLabel)
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(VoteNowColors.ctaBlue.cornerRadius(10))
                        .foregroundColor(.white)
                }

                Spacer()
            }
            .padding()
        }
        .navigationTitle("Check Registration")
    }
}

#if DEBUG
struct RegistrationCheckView_Previews: PreviewProvider {
    static var previews: some View {
        RegistrationCheckView(registrationStatus: .constant(nil))
            .environmentObject(PlanViewModel())
    }
}
#endif
