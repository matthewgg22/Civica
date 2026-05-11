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

// HANDOFF map · A board spec — custom teardrop pin with a paper-
// colored dot inside the upper bulb. Subclasses MKAnnotationView
// directly (not MKMarkerAnnotationView) so we control the shape
// rather than recoloring Apple's default marker.
//
// Pin colors by service type:
//   • Brick #9C3A24    SNAP application help
//   • Teal  #2A6F66    Food assistance
//   • Graphite #3A342E Both
//
// Path mirrors the SVG from the canvas: a 28×35 teardrop with the
// bulb centered at (14, 14) and the point at (14, 35). The view's
// centerOffset anchors the tip on the underlying coordinate.

final class FindHelpAnnotationView: MKAnnotationView {
    static let reuseID = "FindHelpAnnotationView"

    private static let teardropSize = CGSize(width: 28, height: 35)
    private static let paperDotSize: CGFloat = 9

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
        let color = brandColor(for: location.primaryServiceType)
        image = Self.teardropImage(fillColor: color)
        // Anchor the tip of the teardrop on the coordinate rather
        // than the bulb center — that's where map pins are expected
        // to "point at" the place they represent.
        centerOffset = CGPoint(x: 0, y: -Self.teardropSize.height / 2)
    }

    private func brandColor(for serviceType: FindHelpServiceType) -> UIColor {
        switch serviceType {
        case .snapApplicationHelp:
            return UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1)
        case .foodAssistance:
            return UIColor(red: 0x2A/255, green: 0x6F/255, blue: 0x66/255, alpha: 1)
        case .both:
            return UIColor(red: 0x3A/255, green: 0x34/255, blue: 0x2E/255, alpha: 1)
        }
    }

    private static func teardropImage(fillColor: UIColor) -> UIImage {
        let size = teardropSize
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { _ in
            // Teardrop path — bulb top, point bottom. Bezier control
            // points map to the SVG curve commands in the canvas spec.
            let path = UIBezierPath()
            path.move(to: CGPoint(x: 14, y: 0))
            path.addCurve(
                to: CGPoint(x: 0, y: 14),
                controlPoint1: CGPoint(x: 6, y: 0),
                controlPoint2: CGPoint(x: 0, y: 6)
            )
            path.addCurve(
                to: CGPoint(x: 14, y: 35),
                controlPoint1: CGPoint(x: 0, y: 22),
                controlPoint2: CGPoint(x: 14, y: 35)
            )
            path.addCurve(
                to: CGPoint(x: 28, y: 14),
                controlPoint1: CGPoint(x: 14, y: 35),
                controlPoint2: CGPoint(x: 28, y: 22)
            )
            path.addCurve(
                to: CGPoint(x: 14, y: 0),
                controlPoint1: CGPoint(x: 28, y: 6),
                controlPoint2: CGPoint(x: 22, y: 0)
            )
            path.close()
            fillColor.setFill()
            path.fill()

            // Paper dot inside the bulb. Sits at y=11 (just below the
            // bulb's vertical center) so the visual weight feels
            // balanced against the wider point below.
            let dotSize = paperDotSize
            let dotRect = CGRect(
                x: (size.width - dotSize) / 2,
                y: 11,
                width: dotSize,
                height: dotSize
            )
            UIColor(red: 0xF5/255, green: 0xF2/255, blue: 0xEC/255, alpha: 1).setFill()
            UIBezierPath(ovalIn: dotRect).fill()
        }
    }
}
