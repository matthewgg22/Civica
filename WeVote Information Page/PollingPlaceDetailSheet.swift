//
//  PollingPlaceDetailSheet.swift
//  VoteNow
//
//  Created by Matthew Greer-Gentis on 5/26/25.
//
// PollingPlaceDetailSheet.swift
// WeVote Information Page
//
// Created by Matthew Greer-Gentis on 5/16/25.
// Updated by ChatGPT on 5/27/25

import SwiftUI
import MapKit

struct PollingPlaceDetailSheet: View {
    let place: PollingPlace
    @Environment(\.openURL) private var openURL
    @Environment(\.dismiss) private var dismiss

    // Hard-code your hours here once:
    private var hoursView: some View {
        HStack(alignment: .top) {
            Image(systemName: "clock")
            DisclosureGroup("Tap to View Voting Hours") {
                VStack(alignment: .leading, spacing: 4) {
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

                    Text("Election Day Hours:")
                        .bold()
                    Text("Tuesday, June 24, 2025   6:00 AM – 9:00 PM")
                }
                .font(.subheadline)
            }
        }
        .padding(.top)
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 16) {
                // 1) Mini map centered on this place
                Map(
                    coordinateRegion: .constant(
                        MKCoordinateRegion(
                            center: place.coordinate,
                            span: MKCoordinateSpan(latitudeDelta: 0.005,
                                                   longitudeDelta: 0.005)
                        )
                    ),
                    annotationItems: [place]
                ) { place in
                    MapMarker(coordinate: place.coordinate)
                }
                .frame(height: 200)
                .cornerRadius(12)

                // 2) Title + address
                Text(place.name)
                    .font(.headline)
                Text(place.address)
                    .font(.subheadline)
                    .foregroundColor(VoteNowColors.mutedText)

                // 3) Your DisclosureGroup hours
                hoursView

                // 4) Directions button
                HStack {
                    Spacer()
                    Button {
                        // Apple Maps URL scheme with driving directions
                        let urlString = "maps://?daddr=\(place.coordinate.latitude),\(place.coordinate.longitude)&dirflg=d"
                        if let url = URL(string: urlString) {
                            openURL(url)
                        }
                    } label: {
                        Label("Get Directions", systemImage: "arrow.up.right.diamond")
                    }
                }

                Spacer()
            }
            .padding()
            .navigationTitle("Location Details")
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}
