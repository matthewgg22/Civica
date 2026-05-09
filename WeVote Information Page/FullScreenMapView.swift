//
//
//
//  FullScreenMapView.swift
//  Civica
//
//  Created by Matthew Greer-Gentis on 5/25/25.
//  Updated on 05/27/25 to use SwiftUI dismiss action
//

import SwiftUI
import MapKit

struct FullScreenMapView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.locale) private var locale
    @State private var localRegion: MKCoordinateRegion
    @State private var mapPosition: MapCameraPosition
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
        _mapPosition = State(initialValue: .region(initialRegion))
        self.places = places
        _selectedPlace = selectedPlace
        self.onDoneRegion = onDoneRegion
    }

    var body: some View {
        NavigationView {
            Map(position: $mapPosition) {
                ForEach(places) { place in
                    Annotation("", coordinate: place.coordinate) {
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
            }
            .onMapCameraChange { context in
                localRegion = context.region
            }
            .ignoresSafeArea()
            .navigationTitle(Text(l("app.polling_locations.full_map.title", "Polling Places")))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(l("app.polling_locations.full_map.done", "Done")) {
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

    private func l(_ key: String, _ fallback: String) -> String {
        localizedCatalogString(
            key,
            tableName: "AppShell",
            locale: locale,
            fallback: fallback
        )
    }
}

private struct FullMapPollingPinView: View {
    let isSelected: Bool

    var body: some View {
        ZStack {
            Circle()
                .fill(isSelected ? Color(red: 0.87, green: 0.35, blue: 0.27) : CivicaColors.ctaBlue)
                .frame(width: 28, height: 28)
            Image(systemName: "mappin")
                .font(.footnote.bold())
                .foregroundColor(.white)
        }
        .overlay(
            Circle()
                .stroke(CivicaColors.surfacePrimary, lineWidth: 2)
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
