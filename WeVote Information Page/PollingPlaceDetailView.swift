//
//  PollingPlaceDetailView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/30/25.
//  Updated by ChatGPT on 5/18/25.
//

import SwiftUI
import MapKit

struct PollingPlaceDetailView: View {
    let place: PollingPlace

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(place.name)
                .font(.largeTitle)
                .bold()

            Text(place.address)
                .font(.title3)

            HStack(alignment: .top) {
                Image(systemName: "clock")
                DisclosureGroup("Tap to View Voting Hours") {
                    VStack(alignment: .leading, spacing: 4) {
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

                        Divider().padding(.vertical, 4)

                        // Election Day
                        Text("Election Day Hours:")
                            .bold()
                        Text("Tuesday, June 24, 2025   6:00 AM – 9:00 PM")
                    }
                    .font(.subheadline)
                }
            }
            .font(.subheadline)

            Map(
                coordinateRegion: .constant(
                    MKCoordinateRegion(
                        center: place.coordinate,
                        span: MKCoordinateSpan(latitudeDelta: 0.01, longitudeDelta: 0.01)
                    )
                ),
                annotationItems: [place]
            ) { place in
                MapMarker(coordinate: place.coordinate)
            }
            .frame(height: 200)
            .cornerRadius(12)

            Spacer()
        }
        .padding()
        .navigationTitle("Details")
        .navigationBarTitleDisplayMode(.inline)
    }
}
