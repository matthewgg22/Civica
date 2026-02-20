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
    @State private var localRegion: MKCoordinateRegion
    let places: [PollingPlace]
    @Binding var selectedPlace: PollingPlace?
    let onDoneRegion: (MKCoordinateRegion) -> Void

    init(
        initialRegion: MKCoordinateRegion,
        places: [PollingPlace],
        selectedPlace: Binding<PollingPlace?>,
        onDoneRegion: @escaping (MKCoordinateRegion) -> Void
    ) {
        _localRegion = State(initialValue: initialRegion)
        self.places = places
        _selectedPlace = selectedPlace
        self.onDoneRegion = onDoneRegion
    }

    var body: some View {
        NavigationView {
            Map(coordinateRegion: $localRegion,
                annotationItems: places
            ) { place in
                MapAnnotation(coordinate: place.coordinate) {
                    Button {
                        deferToNextRunLoop {
                            selectedPlace = place
                        }
                    } label: {
                        FullMapPollingPinView(isSelected: selectedPlace?.id == place.id)
                    }
                    .buttonStyle(.plain)
                }
            }
            .ignoresSafeArea()
            .navigationTitle("Polling Places")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        onDoneRegion(localRegion)
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

    private func deferToNextRunLoop(_ action: @escaping () -> Void) {
        DispatchQueue.main.async(execute: action)
    }
}

private struct FullMapPollingPinView: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? Color(red: 0.87, green: 0.35, blue: 0.27) : VoteNowColors.richBlue)
                .frame(width: 28, height: 28)
            Image(systemName: "mappin")
                .font(.footnote.bold())
                .foregroundColor(.white)
        }
        .overlay(
            Circle()
                .stroke(VoteNowColors.surfaceWhite, lineWidth: 2)
        )
        .shadow(color: .black.opacity(0.2), radius: 3, x: 0, y: 2)
    }
}

struct FullScreenMapView_Previews: PreviewProvider {
    static var previews: some View {
        FullScreenMapView(
            initialRegion: MKCoordinateRegion(
                center: CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
                span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
            ),
            places: pollingPlaces,
            selectedPlace: .constant(nil),
            onDoneRegion: { _ in }
        )
    }
}
