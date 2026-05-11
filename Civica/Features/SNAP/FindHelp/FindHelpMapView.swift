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
                // Homogeneous clusters take their category color; mixed
                // clusters fall back to graphite so the user can read
                // them as "various nearby" without misleading hue.
                view?.markerTintColor = FindHelpAnnotationView.dominantColor(
                    in: cluster.memberAnnotations
                )
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

// HANDOFF map · A board spec — custom teardrop pin with a category
// glyph inside the upper bulb. Subclasses MKAnnotationView directly
// (not MKMarkerAnnotationView) so we control the shape and inner
// glyph rather than recoloring Apple's default marker.
//
// Pin colors by (record_kind, service_type / retailer_category):
//   • Help directory + SNAP application help → Brick #9C3A24
//   • Help directory + Food assistance       → Teal  #2A6F66
//   • Help directory + Both                  → Graphite #3A342E
//   • EBT retailer  + Supermarket            → Teal-deep #1F4F4A
//   • EBT retailer  + Small grocer           → Amber #B5762A
//   • EBT retailer  + Farmers market         → Green #3B6B33
//   • EBT retailer  + Co-op                  → Indigo #3D4E6E
//   • EBT retailer  + Restaurant RMP         → Brick #9C3A24
//
// Pin glyphs by the same axis use SF Symbols rendered in paper-
// cream (#F5F2EC) inside the bulb. The glyph anchors the user's
// read of "what kind of place is this" before the color hits.
//
// Path mirrors the SVG from the canvas: a 28×35 teardrop with the
// bulb centered at (14, 14) and the point at (14, 35). The view's
// centerOffset anchors the tip on the underlying coordinate.

final class FindHelpAnnotationView: MKAnnotationView {
    static let reuseID = "FindHelpAnnotationView"

    private static let teardropSize = CGSize(width: 28, height: 35)
    private static let paperDotSize: CGFloat = 9
    private static let paperColor = UIColor(red: 0xF5/255, green: 0xF2/255, blue: 0xEC/255, alpha: 1)
    private static let graphiteColor = UIColor(red: 0x3A/255, green: 0x34/255, blue: 0x2E/255, alpha: 1)

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
        let color = Self.pinColor(for: location)
        let glyph = Self.glyphSymbolName(for: location)
        image = Self.teardropImage(fillColor: color, glyphName: glyph)
        // Anchor the tip of the teardrop on the coordinate rather
        // than the bulb center — that's where map pins are expected
        // to "point at" the place they represent.
        centerOffset = CGPoint(x: 0, y: -Self.teardropSize.height / 2)
    }

    // MARK: - Category routing

    /// Pin color for a single location. Lookups split first on
    /// `resolvedRecordKind`, then on the relevant inner axis
    /// (service type for help directory, retailer category for
    /// retailers).
    static func pinColor(for location: FindHelpLocation) -> UIColor {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch location.primaryServiceType {
            case .snapApplicationHelp:
                return UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1)
            case .foodAssistance:
                return UIColor(red: 0x2A/255, green: 0x6F/255, blue: 0x66/255, alpha: 1)
            case .both:
                return graphiteColor
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:
                return UIColor(red: 0x1F/255, green: 0x4F/255, blue: 0x4A/255, alpha: 1)
            case .smallGrocer:
                return UIColor(red: 0xB5/255, green: 0x76/255, blue: 0x2A/255, alpha: 1)
            case .farmersMarket:
                return UIColor(red: 0x3B/255, green: 0x6B/255, blue: 0x33/255, alpha: 1)
            case .coOp:
                return UIColor(red: 0x3D/255, green: 0x4E/255, blue: 0x6E/255, alpha: 1)
            case .restaurantRMP:
                return UIColor(red: 0x9C/255, green: 0x3A/255, blue: 0x24/255, alpha: 1)
            }
        }
    }

    /// SF Symbol name for a location's pin glyph. Rendered in paper-
    /// cream inside the bulb. Fallbacks to a paper dot if the symbol
    /// fails to load (e.g., older iOS without the named symbol).
    static func glyphSymbolName(for location: FindHelpLocation) -> String {
        switch location.resolvedRecordKind {
        case .helpDirectory:
            switch location.primaryServiceType {
            case .snapApplicationHelp: return "doc.text.fill"
            case .foodAssistance:      return "takeoutbag.and.cup.and.straw.fill"
            case .both:                return "square.stack.fill"
            }
        case .ebtRetailer:
            switch location.retailerCategory ?? .supermarket {
            case .supermarket:    return "cart.fill"
            case .smallGrocer:    return "basket.fill"
            case .farmersMarket:  return "leaf.fill"
            case .coOp:           return "building.2.fill"
            case .restaurantRMP:  return "fork.knife"
            }
        }
    }

    /// Cluster color picker: when every member shares one category
    /// the cluster takes that color; otherwise graphite signals
    /// "multiple kinds nearby" without misleading hue.
    static func dominantColor(in annotations: [MKAnnotation]) -> UIColor {
        let locations = annotations.compactMap { ($0 as? FindHelpAnnotation)?.location }
        guard let first = locations.first else { return graphiteColor }
        let firstKey = categoryKey(for: first)
        let allSame = locations.allSatisfy { categoryKey(for: $0) == firstKey }
        return allSame ? pinColor(for: first) : graphiteColor
    }

    private static func categoryKey(for location: FindHelpLocation) -> String {
        let kind = location.resolvedRecordKind.rawValue
        let inner = location.retailerCategory?.rawValue
            ?? location.primaryServiceType.rawValue
        return "\(kind):\(inner)"
    }

    // MARK: - Drawing

    private static func teardropImage(fillColor: UIColor, glyphName: String) -> UIImage {
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

            // Category glyph inside the bulb. 10pt semibold reads
            // legibly at the teardrop's small render size; centered
            // horizontally and vertically at y=15 to match where the
            // legacy paper-dot's visual center sat.
            let symbolConfig = UIImage.SymbolConfiguration(pointSize: 10, weight: .semibold)
            if let symbol = UIImage(systemName: glyphName, withConfiguration: symbolConfig)?
                .withTintColor(paperColor, renderingMode: .alwaysOriginal) {
                let symbolSize = symbol.size
                let symbolRect = CGRect(
                    x: (size.width - symbolSize.width) / 2,
                    y: 15 - symbolSize.height / 2,
                    width: symbolSize.width,
                    height: symbolSize.height
                )
                symbol.draw(in: symbolRect)
            } else {
                // Legacy fallback: plain paper dot. Reached only if
                // the SF Symbol lookup fails (which it shouldn't on
                // any iOS the Civica target deploys to).
                let dotSize = paperDotSize
                let dotRect = CGRect(
                    x: (size.width - dotSize) / 2,
                    y: 11,
                    width: dotSize,
                    height: dotSize
                )
                paperColor.setFill()
                UIBezierPath(ovalIn: dotRect).fill()
            }
        }
    }
}
