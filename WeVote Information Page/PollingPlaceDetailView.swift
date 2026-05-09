//
//  PollingPlaceDetailView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/30/25.
//  Updated by ChatGPT on 5/18/25.
//

import CivicaDesignSystem
import MapKit
import SwiftUI

struct PollingPlaceDetailView: View {
    let place: PollingPlace

    var body: some View {
        VStack(alignment: .leading, spacing: CivicaSpacing.lg) {
            Text(place.name)
                .font(CivicaTypography.pageTitle)

            Text(place.address)
                .font(.title3)

            HStack(alignment: .top) {
                Image(systemName: "clock")
                DisclosureGroup("Tap to View Voting Hours") {
                    VStack(alignment: .leading, spacing: CivicaSpacing.xs) {
                        // Early Voting breakdown
                        Text("Early Voting Dates & Hours:")
                            .bold()
                        Text("• Saturday, June 14, 2025   9:00 AM – 5:00 PM")
                        Text("• Sunday, June 15, 2025    9:00 AM – 5:00 PM")
                        Text("• Monday, June 16, 2025    9:00 AM – 5:00 PM")
                        Text("• Tuesday, June 17, 2025   10:00 AM – 8:00 PM")
                        Text("• Wednesday, June 18, 2025 10:00 AM – 8:00 PM")
                        Text("• Thursday, June 19, 2025  9:00 AM – 5:00 PM")
                        Text("• Friday, June 20, 2025    8:00 AM – 4:00 PM")
                        Text("• Saturday, June 21, 2025  9:00 AM – 5:00 PM")
                        Text("• Sunday, June 22, 2025    9:00 AM – 5:00 PM")

                        Divider().padding(.vertical, CivicaSpacing.xs)

                        // Election Day
                        Text("Election Day Hours:")
                            .bold()
                        Text("Tuesday, June 24, 2025   6:00 AM – 9:00 PM")
                    }
                    .font(CivicaTypography.subhead)
                }
            }
            .font(CivicaTypography.subhead)

            Map(
                initialPosition: .region(
                    MKCoordinateRegion(
                        center: place.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    )
                )
            ) {
                Marker(place.name, coordinate: place.coordinate)
            }
            .frame(height: 200)
            .cornerRadius(CivicaRadius.lg)

            Spacer()
        }
        .padding()
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
    }
}
