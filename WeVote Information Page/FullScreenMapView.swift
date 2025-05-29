//
//
//
//  FullScreenMapView.swift
//  VoteNow
//
//  Created by Matthew Greer-Gentis on 5/25/25.
//  Updated on 05/27/25 to use SwiftUI dismiss action
//

import SwiftUI
import MapKit

struct FullScreenMapView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var region: MKCoordinateRegion
    let places: [PollingPlace]
    @Binding var selectedPlace: PollingPlace?

    var body: some View {
        NavigationView {
            Map(coordinateRegion: $region,
                annotationItems: places
            ) { place in
                MapAnnotation(coordinate: place.coordinate) {
                    Button {
                        // open the sheet
                        selectedPlace = place
                    } label: {
                        Image(systemName: "mappin.circle.fill")
                            .font(.title)
                            .foregroundColor(.red)
                    }
                }
            }
            .ignoresSafeArea()
            .navigationTitle("Polling Places")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            // ← when you tap an annotation, this will present your detail sheet
            .sheet(item: $selectedPlace) { place in
                PollingPlaceDetailSheet(place: place)
            }
        }
    }
}

struct FullScreenMapView_Previews: PreviewProvider {
    static var previews: some View {
        FullScreenMapView(
            region: .constant(
                MKCoordinateRegion(
                    center: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
                    span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
                )
            ),
            places: pollingPlaces,
            selectedPlace: .constant(nil)
        )
    }
}
