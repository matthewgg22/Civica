
//  RegistrationCheckView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/8/25.
//

import SwiftUI

struct RegistrationCheckView: View {
    @Binding var registrationStatus: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Are You Registered to Vote?")
                    .font(.title2)
                    .bold()

                Text("Click below to check your NYC voter registration status online.")
                    .font(.body)
                    .padding(.bottom, 24)

                // —––––––––––––––––––––––––––––––––––––––––––––––––––––
                // Replace the old form + submit button with this Link:
                Link(destination: URL(string: "https://e-register.vote.nyc")!) {
                    Text("Check Registration Status")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.cornerRadius(10))
                        .foregroundColor(.white)
                }
                // —––––––––––––––––––––––––––––––––––––––––––––––––––––

                Spacer()
            }
            .padding()
        }
        .navigationTitle("Check Registration")
    }
}

#Preview {
    RegistrationCheckView(registrationStatus: .constant(nil))
}

