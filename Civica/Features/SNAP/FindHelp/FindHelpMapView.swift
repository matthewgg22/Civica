import CivicaDesignSystem
import CoreLocation
import MapKit
import SwiftUI

struct FindHelpMapView: UIViewRepresentable {
    let locations: [FindHelpLocation]
    let userLocation: CLLocation?
    let onSelect: (FindHelpLocation) -> Void

    func makeUIView(context: Context) -> MKMapView {
        let mapView = MKMapView()
        mapView.delegate = context.coordinator
        mapView.showsUserLocation = true
        mapView.register(
            FindHelpAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: FindHelpAnnotationView.reuseID
        )
        mapView.register(
            MKMarkerAnnotationView.self,
            forAnnotationViewWithReuseIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier
        )
        return mapView
    }

    func updateUIView(_ mapView: MKMapView, context: Context) {
        syncAnnotations(on: mapView)
        if !context.coordinator.didCenterInitially, let userLocation {
            mapView.setRegion(
                MKCoordinateRegion(
                    center: userLocation.coordinate,
                    span: MKCoordinateSpan(latitudeDelta: 0.3, longitudeDelta: 0.3)
                ),
                animated: false
            )
            context.coordinator.didCenterInitially = true
        }
    }

    private func syncAnnotations(on mapView: MKMapView) {
        let existing = mapView.annotations.compactMap { $0 as? FindHelpAnnotation }
        let existingIds = Set(existing.map(\.location.id))
        let newIds = Set(locations.map(\.id))

        // Remove stale annotations.
        let toRemove = existing.filter { !newIds.contains($0.location.id) }
        mapView.removeAnnotations(toRemove)

        // Add new annotations.
        let toAdd = locations
            .filter { !existingIds.contains($0.id) && $0.hasCoordinates }
            .map(FindHelpAnnotation.init(location:))
        mapView.addAnnotations(toAdd)
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelect: onSelect)
    }

    final class Coordinator: NSObject, MKMapViewDelegate {
        let onSelect: (FindHelpLocation) -> Void
        var didCenterInitially: Bool = false

        init(onSelect: @escaping (FindHelpLocation) -> Void) {
            self.onSelect = onSelect
        }

        func mapView(_ mapView: MKMapView, viewFor annotation: MKAnnotation) -> MKAnnotationView? {
            if annotation is MKUserLocation { return nil }
            if let cluster = annotation as? MKClusterAnnotation {
                let view = mapView.dequeueReusableAnnotationView(
                    withIdentifier: MKMapViewDefaultClusterAnnotationViewReuseIdentifier,
                    for: cluster
                ) as? MKMarkerAnnotationView
                view?.markerTintColor = UIColor.darkGray
                return view
            }
            guard let pin = annotation as? FindHelpAnnotation else { return nil }
            let view = mapView.dequeueReusableAnnotationView(
                withIdentifier: FindHelpAnnotationView.reuseID,
                for: pin
            ) as? FindHelpAnnotationView
            view?.configure(with: pin.location)
            return view
        }

        func mapView(_ mapView: MKMapView, didSelect view: MKAnnotationView) {
            mapView.deselectAnnotation(view.annotation, animated: false)
            if let pin = view.annotation as? FindHelpAnnotation {
                onSelect(pin.location)
            }
        }
    }
}

final class FindHelpAnnotation: NSObject, MKAnnotation {
    let location: FindHelpLocation
    var coordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(
            latitude: location.latitude ?? 0,
            longitude: location.longitude ?? 0
        )
    }
    var title: String? { location.name }
    var subtitle: String? { location.city }

    init(location: FindHelpLocation) {
        self.location = location
    }
}

final class FindHelpAnnotationView: MKMarkerAnnotationView {
    static let reuseID = "FindHelpAnnotationView"

    override var annotation: MKAnnotation? {
        didSet {
            if let pin = annotation as? FindHelpAnnotation {
                configure(with: pin.location)
            }
        }
    }

    func configure(with location: FindHelpLocation) {
        clusteringIdentifier = "findHelpCluster"
        canShowCallout = false
        glyphImage = UIImage(systemName: glyphName(for: location.primaryServiceType))
        markerTintColor = markerColor(for: location.primaryServiceType)
    }

    private func glyphName(for serviceType: FindHelpServiceType) -> String {
        switch serviceType {
        case .snapApplicationHelp: return "doc.text.fill"
        case .foodAssistance: return "fork.knife"
        case .both: return "square.stack.fill"
        }
    }

    // HANDOFF map · A board spec — pins map to the brand palette:
    // Brick #9C3A24 for SNAP help, Teal #2A6F66 for food assistance,
    // Graphite #3A342E for "both." No default iOS marker tints.
    private func markerColor(for serviceType: FindHelpServiceType) -> UIColor {
        switch serviceType {
        case .snapApplicationHelp:
            return UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1)
        case .foodAssistance:
            return UIColor(red: 0x2A/255, green: 0x6F/255, blue: 0x66/255, alpha: 1)
        case .both:
            return UIColor(red: 0x3A/255, green: 0x34/255, blue: 0x2E/255, alpha: 1)
        }
    }
}
