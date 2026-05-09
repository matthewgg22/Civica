//
//  TransportationHelpView.swift
//  Civica
//
//  Created by Matthew Greer-Gentis on 5/19/25.
//

import SwiftUI
import UIKit   // for UIApplication.shared

struct TransportationHelpView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: CivicaSpacing.lg) {
                Text("Getting to the polls shouldn't be a barrier to voting.")
                    .font(.title2)
                    .multilineTextAlignment(.center)
                    .padding(.top)

                Text("That's why **Uber** and **Lyft** are offering special promo codes to help voters get a ride on Election Day.")
                    .font(.body)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                HStack(spacing: 40) {
                    // Uber
                    VStack {
                        Button {
                            if let url = URL(string: "uber://"),
                               UIApplication.shared.canOpenURL(url) {
                                UIApplication.shared.open(url)
                            } else if let appStoreURL = URL(string: "https://apps.apple.com/app/uber/id368677368") {
                                UIApplication.shared.open(appStoreURL)
                            }
                        } label: {
                            Image("UberIcon")
                                .resizable()
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.xl))
                                .shadow(radius: 5)
                        }
                        Text("Code: WEVOTE2024")
                            .font(CivicaTypography.subhead)
                    }

                    // Lyft
                    VStack {
                        Button {
                            if let url = URL(string: "lyft://"),
                               UIApplication.shared.canOpenURL(url) {
                                UIApplication.shared.open(url)
                            } else if let appStoreURL = URL(string: "https://apps.apple.com/app/lyft/id529379082") {
                                UIApplication.shared.open(appStoreURL)
                            }
                        } label: {
                            Image("LyftIcon")
                                .resizable()
                                .frame(width: 80, height: 80)
                                .clipShape(RoundedRectangle(cornerRadius: CivicaRadius.xl))
                                .shadow(radius: 5)
                        }
                        Text("Code: WEVOTE2024")
                            .font(CivicaTypography.subhead)
                    }
                }
                .padding(.top)

                Text("Open the app, enter the code, and schedule your ride to your polling place!")
                    .multilineTextAlignment(.center)
                    .padding()
            }
        }
        .navigationTitle("Transportation Help")
    }
}

struct TransportationHelpView_Previews: PreviewProvider {
    static var previews: some View {
        TransportationHelpView()
    }
}
