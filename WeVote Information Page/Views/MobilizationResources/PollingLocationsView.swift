//
//
//
//
//  PollingLocationsView.swift
//  WeVote Information Page
//
//  Created by Matthew Greer-Gentis on 4/22/25.
//  Updated on 05/27/25 — row highlighting, Maps integration, compiler-friendly
//

import SwiftUI
import MapKit
import CoreLocation

struct PollingLocationsView: View {
    @Binding var selectedPlace: PollingPlace?
    
    @StateObject private var locationManager = LocationManager()
    @State private var pollingLocations     = pollingPlaces
    @State private var showFullMap          = false
    
    @State private var region = MKCoordinateRegion(
        center: pollingPlaces.first?.coordinate
            ?? CLLocationCoordinate2D(latitude: 40.7128, longitude: -74.0060),
        span: MKCoordinateSpan(latitudeDelta: 0.1, longitudeDelta: 0.1)
    )
    
    private let geocoder = CLGeocoder()
    
    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                mapButton
                miniMap
                placeList
            }
            .padding(.vertical)
        }
        .onAppear { geocodeNext(at: 0) }
        .onChange(of: locationManager.location) { newLoc in
            if let user = newLoc { sortAndFit(userLocation: user) }
        }
        .fullScreenCover(isPresented: $showFullMap) {
            FullScreenMapView(
                region: $region,
                places: pollingLocations,
                selectedPlace: $selectedPlace
            )
        }
    }
    
    // MARK: — Subviews
    
    private var mapButton: some View {
        Button("Show Full Map") {
            showFullMap = true
        }
        .buttonStyle(.borderedProminent)
        .padding(.horizontal)
    }
    
    private var miniMap: some View {
        Map(
            coordinateRegion: $region,
            showsUserLocation: true,
            annotationItems: pollingLocations
        ) { place in
            MapAnnotation(coordinate: place.coordinate) {
                Image(systemName: "mappin.circle.fill")
                    .font(.title)
                    .foregroundColor(.red)
                    .onTapGesture { selectedPlace = place }
            }
        }
        .frame(height: 250)
        .cornerRadius(12)
        .padding(.horizontal)
    }
    
    private var placeList: some View {
        VStack(spacing: 0) {
            ForEach(pollingLocations) { place in
                placeRow(place)
                Divider()
            }
        }
        .background(Color(.systemBackground))
        .cornerRadius(8)
        .padding(.horizontal)
    }
    
    @ViewBuilder
    private func placeRow(_ place: PollingPlace) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text(place.name)
                    .font(.headline)
                    .fontWeight(
                        selectedPlace?.id == place.id ? .bold : .regular
                    )
                Text(place.distance)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            Spacer()
            Button {
                let item = MKMapItem(
                    placemark: MKPlacemark(coordinate: place.coordinate)
                )
                item.name = place.name.isEmpty
                    ? place.address
                    : place.name
                item.openInMaps(launchOptions: nil)
            } label: {
                Image(systemName: "arrow.triangle.turn.up.right.diamond")
                    .font(.title3)
                    .foregroundColor(.blue)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 8)
        .padding(.horizontal)
        .contentShape(Rectangle())
        .background(
            selectedPlace?.id == place.id
            ? Color.blue.opacity(0.1)
            : Color.clear
        )
        .cornerRadius(8)
        .onTapGesture { selectedPlace = place }
    }
    
    
    // MARK: — Sequential Geocode to Avoid Throttling
    
    private func geocodeNext(at index: Int) {
        guard index < pollingLocations.count else {
            if let userLoc = locationManager.location {
                sortAndFit(userLocation: userLoc)
            } else {
                fitAllPins()
            }
            return
        }
        
        geocoder.geocodeAddressString(pollingLocations[index].address) { results, _ in
            if let coord = results?.first?.location?.coordinate {
                DispatchQueue.main.async {
                    pollingLocations[index].coordinate = coord
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                geocodeNext(at: index + 1)
            }
        }
    }
    
    // MARK: — Compute Distances, Sort & Zoom
    
    private func sortAndFit(userLocation: CLLocation) {
        // 1) Compute & assign distances
        for i in pollingLocations.indices {
            let c = pollingLocations[i].coordinate
            let distMi = CLLocation(latitude: c.latitude,
                                     longitude: c.longitude)
                .distance(from: userLocation) / 1609.344
            pollingLocations[i].distance = String(format: "%.1f mi", distMi)
        }
        // 2) Sort nearest first
        pollingLocations.sort {
            let a = CLLocation(latitude: $0.coordinate.latitude,
                               longitude: $0.coordinate.longitude)
            let b = CLLocation(latitude: $1.coordinate.latitude,
                               longitude: $1.coordinate.longitude)
            return userLocation.distance(from: a)
                 < userLocation.distance(from: b)
        }
        // 3) Build a map rect covering user + pins
        var rect = MKMapRect.null
        let userPoint = MKMapPoint(userLocation.coordinate)
        rect = rect.union(
            MKMapRect(
                origin: userPoint,
                size: MKMapSize(width: 0, height: 0)
            )
        )
        for p in pollingLocations {
            let pt = MKMapPoint(p.coordinate)
            rect = rect.union(
                MKMapRect(
                    origin: pt,
                    size: MKMapSize(width: 0, height: 0)
                )
            )
        }
        withAnimation {
            region = MKCoordinateRegion(rect)
        }
    }
    
    // MARK: — Fit Map if No User Location
    
    private func fitAllPins() {
        guard !pollingLocations.isEmpty else { return }
        var rect = MKMapRect.null
        for p in pollingLocations {
            let pt = MKMapPoint(p.coordinate)
            rect = rect.union(
                MKMapRect(
                    origin: pt,
                    size: MKMapSize(width: 0, height: 0)
                )
            )
        }
        withAnimation {
            region = MKCoordinateRegion(rect)
        }
    }
}


struct PollingLocationsView_Previews: PreviewProvider {
    static var previews: some View {
        PollingLocationsView(selectedPlace: .constant(nil))
    }
}
