
//  VoterRegistrationView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/28/25.
//

import SwiftUI

// MARK: - VoterRegistrationView
struct VoterRegistrationView: View {
    @State private var registrationStatus: String? = nil
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            VStack {
                Text("Voter Registration")
                    .font(.largeTitle)
                    .bold()
                    .frame(maxWidth: .infinity)
                    .multilineTextAlignment(.center)
                    .padding(.vertical)

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {

                        // MARK: – Definition
                        Text("Voter registration is a required part of voting, whereby you provide your residency information to determine which elections you can vote in.")
                            .font(.body)

                        // MARK: – Key Points
                        VStack(alignment: .leading, spacing: 10) {
                            Text("• Register at your current address")
                            Text("• Each state sets its own deadline and requirements")
                        }
                        .font(.body)

                        // MARK: – Check status
                        Button(action: {
                            guard let url = URL(string: "https://e-register.vote.nyc") else { return }
                            openURL(url)
                        }) {
                            Text("Check Registration Status")
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.blue)
                                .foregroundColor(.white)
                                .cornerRadius(10)
                        }

                        // MARK: – Dynamic status
                        if let status = registrationStatus {
                            Divider().padding(.top)
                            Text(status)
                                .font(.callout)
                                .foregroundColor(.green)
                                .multilineTextAlignment(.leading)
                        }

                        Divider()

                        // MARK: – NYC-specific note
                        VStack(alignment: .leading, spacing: 10) {
                            Text("📍 Special Note for NYC Residents")
                                .font(.headline)
                            Text("""
In New York City, you must be registered at least 10 days before an election to vote. Online registration is available if you have a DMV-issued ID. Mail-in forms are also accepted. Same-day registration is **not** currently allowed in New York State.
""")
                        }

                        Spacer()
                    }
                    .padding()
                }
            }
            .navigationBarHidden(true)
        }
    }
}

// Optional preview
struct VoterRegistrationView_Previews: PreviewProvider {
    static var previews: some View {
        VoterRegistrationView()
    }
}
